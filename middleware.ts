// =============================================================================
// Agency Group — Edge Middleware
// 1. Bot blacklist
// 2. Rate limiting for all AI/expensive API routes
// =============================================================================
import { NextRequest, NextResponse } from 'next/server'

// ─── Rate limit store (in-memory per Edge worker — no persistence across cold-starts) ──
const store = new Map<string, { count: number; reset: number }>()

// ─── Rate limits per route prefix ────────────────────────────────────────────
// Tighter limits on AI routes to cap cost exposure
const LIMITS: Record<string, { max: number; windowMs: number }> = {
  '/api/sofia-agent': { max: 20,  windowMs: 3_600_000 },  // 20/hr public chatbot
  '/api/search':      { max: 30,  windowMs: 3_600_000 },  // 30/hr public search
  '/api/avm':         { max: 15,  windowMs: 3_600_000 },  // 15/hr AVM
  '/api/chat':        { max: 30,  windowMs: 3_600_000 },  // 30/hr generic chat
  '/api/content':     { max: 15,  windowMs: 3_600_000 },  // 15/hr content gen
  '/api/draft-offer': { max: 10,  windowMs: 3_600_000 },  // 10/hr offer drafting
  '/api/ai':          { max: 15,  windowMs:    60_000 },  // 15/min AI proxy
  '/api/radar':       { max: 20,  windowMs: 3_600_000 },
  '/api/mortgage':    { max: 200, windowMs: 3_600_000 },
  '/api/nhr':         { max: 200, windowMs: 3_600_000 },
  '/api/portfolio':   { max: 30,  windowMs: 3_600_000 },
  '/api/juridico':    { max: 30,  windowMs: 3_600_000 },
  '/api/homestaging': { max: 20,  windowMs: 3_600_000 },
  '/api/mais-valias': { max: 100, windowMs: 3_600_000 },
  '/api/financing':   { max: 100, windowMs: 3_600_000 },
}

// ─── Known scanner/scraper User-Agents ───────────────────────────────────────
const BOT_PATTERNS = [
  /scrapy/i, /python-requests/i, /go-http-client/i, /curl\/[0-9]/i,
  /wget/i, /libwww/i, /zgrab/i, /masscan/i, /sqlmap/i, /nikto/i,
  /nmap/i, /dirbuster/i, /nuclei/i, /httpx/i,
]

// ─── In-memory rate limit ─────────────────────────────────────────────────────
function rateLimitMemory(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  let rec = store.get(key)
  if (!rec || now > rec.reset) {
    rec = { count: 0, reset: now + windowMs }
    store.set(key, rec)
  }
  rec.count++
  return rec.count > max
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname
  const ua   = req.headers.get('user-agent') ?? ''

  // 1. Block known scanners
  if (BOT_PATTERNS.some(p => p.test(ua))) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  // 2. Rate limiting for AI/expensive routes
  const limitEntry = Object.entries(LIMITS).find(([prefix]) => path.startsWith(prefix))
  if (!limitEntry) return NextResponse.next()

  const [, { max, windowMs }] = limitEntry
  const ip  = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'anon'
  const key = `rl:${path}|${ip}`

  const isLimited = rateLimitMemory(key, max, windowMs)
  if (isLimited) {
    return NextResponse.json(
      { error: 'Demasiados pedidos. Tenta novamente mais tarde.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(windowMs / 1000)) } }
    )
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/api/sofia-agent/:path*',
    '/api/search',
    '/api/avm',
    '/api/chat',
    '/api/content',
    '/api/draft-offer',
    '/api/ai',
    '/api/radar/:path*',
    '/api/mortgage',
    '/api/nhr',
    '/api/portfolio',
    '/api/juridico',
    '/api/homestaging',
    '/api/mais-valias',
    '/api/financing',
  ],
}
