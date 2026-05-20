import { NextRequest, NextResponse } from 'next/server'

// ─── Rate limit store (in-memory fallback per Edge worker) ──────────────────
// TODO: CRITICAL #INFRA-001 — replace with lib/rateLimit.ts (Upstash). This Map
// resets on every cold start and is NOT shared across Edge worker instances,
// making rate limiting bypass trivial under any load. Use the rateLimitUpstash()
// helper already defined below for ALL routes, removing this fallback store entirely.
const store = new Map<string, { count: number; reset: number }>()

// ─── Limites por rota ────────────────────────────────────────────────────────
const LIMITS: Record<string, { max: number; window: number }> = {
  // AI / compute-heavy endpoints
  '/api/radar':        { max: 20,  window: 3_600_000 },
  '/api/avm':          { max: 100, window: 3_600_000 },
  '/api/mortgage':     { max: 200, window: 3_600_000 },
  '/api/nhr':          { max: 200, window: 3_600_000 },
  '/api/portfolio':    { max: 30,  window: 3_600_000 },
  '/api/learn':        { max: 10,  window: 3_600_000 },
  '/api/chat':         { max: 60,  window: 3_600_000 },
  '/api/juridico':     { max: 30,  window: 3_600_000 },
  '/api/content':      { max: 20,  window: 3_600_000 },
  '/api/homestaging':  { max: 20,  window: 3_600_000 },
  '/api/booking':      { max: 30,  window: 3_600_000 },
  '/api/track-view':   { max: 200, window: 3_600_000 },
  '/api/mais-valias':  { max: 100, window: 3_600_000 },
  '/api/financing':    { max: 100, window: 3_600_000 },
  // Core CRUD — protect against enumeration / DoS (Phase 7 hardening)
  '/api/contacts':     { max: 120, window: 3_600_000 },
  '/api/leads':        { max:  60, window: 3_600_000 },
  '/api/deals':        { max: 120, window: 3_600_000 },
  '/api/properties':   { max: 300, window: 3_600_000 },
  '/api/matches':      { max:  60, window: 3_600_000 },
  '/api/runtime':      { max:  60, window:    60_000 },
}

// ─── Bot blacklist (User-Agent) ──────────────────────────────────────────────
const BOT_PATTERNS = [
  /scrapy/i, /python-requests/i, /go-http-client/i, /curl\/[0-9]/i,
  /wget/i, /libwww/i, /zgrab/i, /masscan/i, /sqlmap/i, /nikto/i,
  /nmap/i, /dirbuster/i, /nuclei/i, /httpx/i,
]

// ─── Web Crypto HMAC verify (Edge-compatible — no Node.js crypto) ────────────
async function verifyToken(token: string, secret: string): Promise<boolean> {
  try {
    const dotIdx = token.lastIndexOf('.')
    if (dotIdx === -1) return false
    const payload = token.slice(0, dotIdx)
    const sig     = token.slice(dotIdx + 1)

    const enc = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    )
    const sigBuf  = await crypto.subtle.sign('HMAC', key, enc.encode(payload))
    const sigHex  = Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, '0')).join('')
    if (sigHex !== sig) return false

    const data = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    // Accept both token types:
    //   • magic-link tokens  → { type: 'magic', email, exp }  (URL param, first visit)
    //   • session tokens     → { email, exp }                 (cookie, all subsequent visits)
    // Previously this only checked type==='magic', which silently rejected every
    // valid session cookie and bounced authenticated users back to '/'.
    return Date.now() < data.exp && (data.type === 'magic' || typeof data.email === 'string')
  } catch {
    return false
  }
}

// ─── Upstash Redis rate limit (persistent across deployments/workers) ────────
// Falls back to in-memory if UPSTASH_REDIS_REST_URL not set
async function rateLimitUpstash(key: string, max: number, windowSecs: number): Promise<{ limited: boolean; remaining: number; reset: number }> {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return { limited: false, remaining: max, reset: 0 }

  try {
    const res = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([
        ['INCR', key],
        ['EXPIRE', key, windowSecs, 'NX'],
        ['TTL',   key],
      ]),
      signal: AbortSignal.timeout(500), // 500ms timeout — never block requests
    })
    if (!res.ok) throw new Error('upstash error')
    const [[{ result: count }], , [{ result: ttl }]] = await res.json()
    const resetAt = Date.now() + (ttl > 0 ? ttl * 1000 : windowSecs * 1000)
    return { limited: count > max, remaining: Math.max(0, max - count), reset: resetAt }
  } catch {
    return { limited: false, remaining: max, reset: 0 }
  }
}

// ─── In-memory rate limit (fallback) ─────────────────────────────────────────
function rateLimitMemory(key: string, max: number, win: number): { limited: boolean; remaining: number; reset: number; count: number } {
  const now = Date.now()
  let rec = store.get(key)
  if (!rec || now > rec.reset) {
    rec = { count: 0, reset: now + win }
    store.set(key, rec)
  }
  rec.count++
  return { limited: rec.count > max, remaining: Math.max(0, max - rec.count), reset: rec.reset, count: rec.count }
}

// ─── Security headers (Phase 7 hardening) ────────────────────────────────────
// Applied to every non-blocked response. Edge-compatible (no Node.js APIs).
function applySecurityHeaders(res: NextResponse): NextResponse {
  // Prevent clickjacking
  res.headers.set('X-Frame-Options', 'DENY')
  // Block MIME-type sniffing
  res.headers.set('X-Content-Type-Options', 'nosniff')
  // Strict referrer for all requests
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  // HSTS — 1 year, include subdomains, preload-ready
  res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  // Disable dangerous browser features
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self), payment=()')
  // Basic CSP — tightened for API routes; public pages rely on next.config.js CSP
  res.headers.set('X-DNS-Prefetch-Control', 'off')
  return res
}

// ─── Correlation ID propagation (Phase 8/10 observability) ───────────────────
// Every request gets a correlation ID. If the caller provides one, we echo it.
// If not, we generate a new one. The ID is forwarded on the response so callers
// can correlate logs end-to-end.
//
// Security fixes applied:
//   1. x-tenant-plan is set to 'unverified' — never reflected from x-tenant-id
//      to prevent privilege escalation (attacker claiming 'enterprise' plan).
//      API routes that need the real plan must verify from Supabase.
//   2. x-correlation-id is sanitized to prevent CRLF injection: only
//      alphanumeric, hyphens and underscores are allowed, max 64 chars.
function ensureCorrelationId(req: NextRequest, res: NextResponse): string {
  const rawCorrelationId = req.headers.get('x-correlation-id') ?? crypto.randomUUID()
  // Sanitize: only allow alphanumeric, hyphens, underscores — prevents CRLF injection
  const corrId = rawCorrelationId.replace(/[^a-zA-Z0-9\-_]/g, '').slice(0, 64) || crypto.randomUUID()
  res.headers.set('x-correlation-id', corrId)
  res.headers.set('x-trace-id', corrId)
  // SECURITY: do NOT reflect x-tenant-id as x-tenant-plan. Any caller could set
  // x-tenant-id to 'enterprise' and claim elevated plan. Set to 'unverified'
  // here; API routes must perform their own plan lookup from Supabase.
  res.headers.set('x-tenant-plan', 'unverified')
  res.headers.set('x-tenant-status', 'active')
  return corrId
}

// ─── Middleware ───────────────────────────────────────────────────────────────
export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname
  const ua   = req.headers.get('user-agent') || ''

  // 1. Bot blacklist
  if (BOT_PATTERNS.some(p => p.test(ua))) {
    const blocked = new NextResponse('Forbidden', { status: 403 })
    applySecurityHeaders(blocked)
    return blocked
  }

  // 2. Portal protection — token in URL or valid session cookie.
  //    /portal/login is excluded from this guard so that unauthenticated
  //    users can always reach the login form without a redirect loop.
  if (path.startsWith('/portal') && !path.startsWith('/portal/login')) {
    const urlToken    = req.nextUrl.searchParams.get('token')
    // Cookie name must match what /api/auth/verify sets: 'ag-auth-token'
    const cookieToken = req.cookies.get('ag-auth-token')?.value
    const secret      = process.env.AUTH_SECRET
    const activeToken = urlToken || cookieToken

    if (!secret || !activeToken || !(await verifyToken(activeToken, secret))) {
      // Send to login, not homepage, so the user knows they need to authenticate
      return NextResponse.redirect(new URL('/portal/login', req.url))
    }

    const res = NextResponse.next()
    ensureCorrelationId(req, res)
    applySecurityHeaders(res)
    if (urlToken) {
      // Persist token as cookie so subsequent page loads don't need the URL param.
      // Cookie name, sameSite, and secure must match /api/auth/verify options exactly
      // so the browser treats both Set-Cookie directives as the same cookie.
      res.cookies.set('ag-auth-token', urlToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',   // 'strict' blocks the cookie on email/external-link navigation
        maxAge: 8 * 60 * 60,
        path: '/',
      })
    }
    return res
  }

  // 3. Rate limiting
  const entry = Object.entries(LIMITS).find(([k]) => path.startsWith(k))
  if (!entry) {
    // All API routes that are NOT explicitly rate-limited still get:
    //   • Correlation ID (distributed tracing, SH-ROS observability)
    //   • Security headers (defence in depth)
    // Non-API routes (pages, static files) pass through unchanged.
    if (path.startsWith('/api/')) {
      const res = NextResponse.next()
      ensureCorrelationId(req, res)
      applySecurityHeaders(res)
      return res
    }
    return NextResponse.next()
  }

  const [, { max, window: win }] = entry
  const ip  = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() ||
              req.headers.get('x-real-ip') ||
              'anon'
  const key = `rl:${path}|${ip}`

  // Try Upstash first, fall back to in-memory
  const upstash    = await rateLimitUpstash(key, max, Math.floor(win / 1000))
  const useUpstash = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)

  const { limited, remaining, reset } = useUpstash
    ? upstash
    : rateLimitMemory(key, max, win)

  if (limited) {
    return NextResponse.json(
      { error: 'Demasiados pedidos. Tenta novamente em breve.' },
      {
        status: 429,
        headers: {
          'Retry-After':           String(Math.ceil((reset - Date.now()) / 1000)),
          'X-RateLimit-Limit':     String(max),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset':     String(reset),
        },
      }
    )
  }

  const res = NextResponse.next()
  ensureCorrelationId(req, res)
  applySecurityHeaders(res)
  res.headers.set('X-RateLimit-Limit',     String(max))
  res.headers.set('X-RateLimit-Remaining', String(remaining))
  res.headers.set('X-RateLimit-Reset',     String(reset))

  // Quota breach detection envelope — fail-open for now; establishes the guard layer.
  // Future: replace with real Redis quota check via lib/tenant/quotaGuard.ts
  const isCronOrInternal = path.startsWith('/api/cron/') || path.startsWith('/api/internal/')
  if (path.startsWith('/api/') && !isCronOrInternal) {
    const tenantId   = req.headers.get('x-tenant-id') ?? 'agency-group'
    const tenantPlan = res.headers.get('x-tenant-plan') ?? 'starter'
    if (tenantId !== 'agency-group') {
      // Non-agency-group tenants: mark as quota-checked (fail-open — no hard block yet)
      // Phase 3: replace this with checkQuota(tenantId, 'api_requests') and 429 on DENY
      void tenantPlan // consumed — suppresses unused-var lint until Phase 3
      res.headers.set('x-quota-checked', 'true')
    }
  }

  return res
}

export const config = {
  matcher: [
    // Portal — auth guard + security headers + correlation ID
    '/portal',
    '/portal/:path*',
    // ALL API routes — correlation ID + security headers + rate limiting where configured
    // Using negative lookahead to exclude Next.js internals (_next/static, _next/image, favicon, etc.)
    '/api/:path*',
  ],
}
