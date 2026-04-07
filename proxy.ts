import { auth } from '@/auth'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// ─── Rate limit store (in-memory fallback per Edge worker) ──────────────────
const store = new Map<string, { count: number; reset: number }>()

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
    const authCookie =
      req.cookies.get('next-auth.session-token')?.value ||
      req.cookies.get('__Secure-next-auth.session-token')?.value ||
      req.cookies.get('ag-auth-token')?.value ||
      req.cookies.get('__Secure-ag-auth-token')?.value
    if (!authCookie) {
      const loginUrl = new URL('/portal/login', req.url)
      loginUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(loginUrl)
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
    '/api/automation',
    '/api/embeddings',
  ]
  const isProtected = protectedPaths.some(p => pathname.startsWith(p))

  if (isProtected && !req.auth) {
    const loginUrl = new URL('/auth/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // 3. Rate limiting
  const entry = Object.entries(LIMITS).find(([k]) => pathname.startsWith(k))
  if (!entry) return NextResponse.next()

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

  const res = NextResponse.next()
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
