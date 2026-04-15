import { auth } from '@/auth'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// ─── Rate limit store (in-memory fallback per Edge worker) ──────────────────
const store = new Map<string, { count: number; reset: number }>()

// ─── Paths that should not be indexed ────────────────────────────────────────
const NOINDEX_PREFIXES = ['/portal', '/auth', '/onboarding', '/admin', '/deal', '/api', '/collection', '/_next']

// ─── Add security + cache headers to a response ──────────────────────────────
function addStandardHeaders(res: NextResponse, pathname: string): NextResponse {
  // Security headers
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('X-Frame-Options', 'SAMEORIGIN')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)')

  // X-Robots-Tag for private routes
  if (NOINDEX_PREFIXES.some(p => pathname.startsWith(p))) {
    res.headers.set('X-Robots-Tag', 'noindex, nofollow')
  }

  // Cache-Control by route type
  if (pathname.startsWith('/api/')) {
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
  } else if (pathname.startsWith('/portal') || pathname.startsWith('/auth')) {
    res.headers.set('Cache-Control', 'private, no-store')
  } else if (pathname.startsWith('/blog/')) {
    res.headers.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400')
  } else if (pathname.startsWith('/zonas/') || pathname.startsWith('/imoveis/')) {
    res.headers.set('Cache-Control', 'public, max-age=1800, stale-while-revalidate=7200')
  } else if (pathname === '/faq' || pathname === '/blog') {
    res.headers.set('Cache-Control', 'public, max-age=7200, stale-while-revalidate=86400')
  } else if (pathname === '/') {
    res.headers.set('Cache-Control', 'public, max-age=900, stale-while-revalidate=3600')
    res.headers.set('Vary', 'Accept-Language')
  } else {
    res.headers.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600')
  }

  return res
}

// ─── Limites por rota ────────────────────────────────────────────────────────
const LIMITS: Record<string, { max: number; window: number }> = {
  '/api/search':       { max: 30,  window: 3_600_000 },
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
  '/api/neighborhood': { max: 100, window: 3_600_000 },
  '/api/premarket':    { max: 50,  window: 3_600_000 },
  '/api/alerts':        { max: 30,  window: 3_600_000 },
  '/api/voice-search':  { max: 20,  window: 3_600_000 },
  '/api/heygen':        { max: 10,  window: 3_600_000 },
  '/api/automation':   { max: 5,   window: 3_600_000 },
  '/api/tts':          { max: 50,  window: 3_600_000 },
}

// ─── Bot blacklist (User-Agent) ──────────────────────────────────────────────
const BOT_PATTERNS = [
  /scrapy/i, /python-requests/i, /go-http-client/i, /curl\/[0-9]/i,
  /wget/i, /libwww/i, /zgrab/i, /masscan/i, /sqlmap/i, /nikto/i,
  /nmap/i, /dirbuster/i, /nuclei/i, /httpx/i,
]

// ─── Upstash Redis rate limit ────────────────────────────────────────────────
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
      signal: AbortSignal.timeout(500),
    })
    if (!res.ok) throw new Error('upstash error')
    const [[{ result: count }], , [{ result: ttl }]] = await res.json()
    const resetAt = Date.now() + (ttl > 0 ? ttl * 1000 : windowSecs * 1000)
    return { limited: count > max, remaining: Math.max(0, max - count), reset: resetAt }
  } catch {
    return { limited: false, remaining: max, reset: 0 }
  }
}

// ─── In-memory rate limit ─────────────────────────────────────────────────────
function rateLimitMemory(key: string, max: number, win: number): { limited: boolean; remaining: number; reset: number } {
  const now = Date.now()
  let rec = store.get(key)
  if (!rec || now > rec.reset) {
    rec = { count: 0, reset: now + win }
    store.set(key, rec)
  }
  rec.count++
  return { limited: rec.count > max, remaining: Math.max(0, max - rec.count), reset: rec.reset }
}

// ─── NextAuth middleware (wraps our logic) ────────────────────────────────────
export default auth(async (req) => {
  const { pathname } = req.nextUrl
  const ua = req.headers.get('user-agent') || ''

  // 1. Bot blacklist
  if (BOT_PATTERNS.some(p => p.test(ua))) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  // 2a. Portal routes — require ag-auth-token cookie (magic link) or NextAuth session
  if (pathname.startsWith('/portal') && pathname !== '/portal/login') {
    // Check plain name first — verify route now always sets 'ag-auth-token'
    // (without __Secure- prefix) so Chrome doesn't silently drop it during
    // the www-redirect chain. The __Secure- variants remain as fallback for
    // any cookies set by a previous deployment.
    const authCookie =
      req.cookies.get('ag-auth-token')?.value ||
      req.cookies.get('__Secure-ag-auth-token')?.value ||
      req.cookies.get('next-auth.session-token')?.value ||
      req.cookies.get('__Secure-next-auth.session-token')?.value
    if (!authCookie) {
      const loginUrl = new URL('/portal/login', req.url)
      loginUrl.searchParams.set('callbackUrl', pathname)
      const r = NextResponse.redirect(loginUrl)
      r.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
      return r
    }
  }

  // 2b. Protected API routes — require NextAuth session
  const protectedPaths = [
    '/api/crm', '/api/deal', '/api/agent', '/api/reports',
    '/api/contacts', '/api/deals', '/api/visitas/db', '/api/properties/db',
    '/api/radar', '/api/portfolio', '/api/juridico', '/api/financing',
    '/api/marketing', '/api/content', '/api/homestaging', '/api/heygen',
    '/api/sofia', '/api/investor', '/api/collections', '/api/learn',
    '/api/admin', '/api/push/send', '/api/market',
    '/api/notion',
    // /api/automation intentionally excluded — each route has its own isAuthorized()
    // check that accepts PORTAL_API_SECRET / CRON_SECRET Bearer tokens (used by n8n + crons)
    '/api/embeddings',
  ]
  const isProtected = protectedPaths.some(p => pathname.startsWith(p))

  if (isProtected && !req.auth) {
    // Also accept magic-link portal auth cookie (ag-auth-token set by /api/auth/verify)
    // HttpOnly + SameSite=Lax prevents cross-site forgery; HMAC verified at login time
    const magicCookie =
      req.cookies.get('ag-auth-token')?.value ||
      req.cookies.get('__Secure-ag-auth-token')?.value

    // Accept server-to-server Bearer tokens (n8n workflows, Vercel crons, internal services)
    // Routes like /api/automation/* are called by n8n with PORTAL_API_SECRET — no session cookie
    const authHeader = req.headers.get('authorization') ?? ''
    const validTokens = [
      process.env.PORTAL_API_SECRET,
      process.env.CRON_SECRET,
      process.env.ADMIN_SECRET,
    ].filter(Boolean) as string[]
    const hasValidToken = validTokens.some(t => authHeader === `Bearer ${t}`)

    if (!magicCookie && !hasValidToken) {
      const loginUrl = new URL('/auth/login', req.url)
      loginUrl.searchParams.set('callbackUrl', pathname)
      const r = NextResponse.redirect(loginUrl)
      // Prevent CDN from caching auth redirects — each request must be evaluated individually
      r.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
      r.headers.set('Vary', 'Authorization')
      return r
    }
  }

  // 3. Rate limiting
  const entry = Object.entries(LIMITS).find(([k]) => pathname.startsWith(k))
  if (!entry) return addStandardHeaders(NextResponse.next(), pathname)

  const [, { max, window: win }] = entry
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() ||
              req.headers.get('x-real-ip') ||
              'anon'
  const key = `rl:${pathname}|${ip}`

  const upstash    = await rateLimitUpstash(key, max, Math.floor(win / 1000))
  const useUpstash = !!process.env.UPSTASH_REDIS_REST_URL && upstash.reset > 0

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

  const res = addStandardHeaders(NextResponse.next(), pathname)
  res.headers.set('X-RateLimit-Limit',     String(max))
  res.headers.set('X-RateLimit-Remaining', String(remaining))
  res.headers.set('X-RateLimit-Reset',     String(reset))
  return res
})

export const config = {
  matcher: [
    // Include /portal/* so we can enforce auth, exclude static assets + public API routes
    '/((?!_next/static|_next/image|favicon.ico|api/chat|api/avm|api/properties(?!/db)|api/mortgage|api/imt|api/nhr|api/mais-valias).*)',
  ],
}
