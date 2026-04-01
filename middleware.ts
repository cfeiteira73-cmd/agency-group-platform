import { NextRequest, NextResponse } from 'next/server'

// ─── Rate limit store (in-memory fallback per Edge worker) ──────────────────
const store = new Map<string, { count: number; reset: number }>()

// ─── Limites por rota ────────────────────────────────────────────────────────
const LIMITS: Record<string, { max: number; window: number }> = {
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
    return data.type === 'magic' && Date.now() < data.exp
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

// ─── Middleware ───────────────────────────────────────────────────────────────
export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname
  const ua   = req.headers.get('user-agent') || ''

  // 1. Bot blacklist
  if (BOT_PATTERNS.some(p => p.test(ua))) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  // 2. Portal protection — requires valid magic-link token
  if (path.startsWith('/portal')) {
    const token  = req.nextUrl.searchParams.get('token')
    const secret = process.env.AUTH_SECRET
    if (!secret || !token || !(await verifyToken(token, secret))) {
      return NextResponse.redirect(new URL('/', req.url))
    }
  }

  // 3. Rate limiting
  const entry = Object.entries(LIMITS).find(([k]) => path.startsWith(k))
  if (!entry) return NextResponse.next()

  const [, { max, window: win }] = entry
  const ip  = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() ||
              req.headers.get('x-real-ip') ||
              'anon'
  const key = `rl:${path}|${ip}`

  // Try Upstash first, fall back to in-memory
  const upstash    = await rateLimitUpstash(key, max, Math.floor(win / 1000))
  const useUpstash = process.env.UPSTASH_REDIS_REST_URL && upstash.remaining <= max

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
  res.headers.set('X-RateLimit-Limit',     String(max))
  res.headers.set('X-RateLimit-Remaining', String(remaining))
  res.headers.set('X-RateLimit-Reset',     String(reset))
  return res
}

export const config = {
  matcher: [
    '/portal/:path*',
    '/api/radar/:path*',
    '/api/avm',
    '/api/mortgage',
    '/api/nhr',
    '/api/portfolio',
    '/api/learn',
    '/api/chat',
    '/api/juridico',
    '/api/content',
    '/api/homestaging',
    '/api/booking',
    '/api/track-view',
    '/api/mais-valias',
    '/api/financing',
  ],
}
