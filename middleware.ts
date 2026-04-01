import { NextRequest, NextResponse } from 'next/server'

// Module-level rate limit store (per Vercel Edge worker process)
// Provides effective protection for boutique real estate agency traffic levels
const store = new Map<string, { count: number; reset: number }>()

const LIMITS: Record<string, { max: number; window: number }> = {
  '/api/radar':    { max: 20,  window: 3_600_000 }, // 20 req/hour - AI calls
  '/api/avm':      { max: 100, window: 3_600_000 }, // 100 req/hour
  '/api/mortgage': { max: 200, window: 3_600_000 }, // 200 req/hour
  '/api/nhr':      { max: 200, window: 3_600_000 }, // 200 req/hour
  '/api/portfolio':{ max: 30,  window: 3_600_000 }, // 30 req/hour - AI calls
  '/api/learn':    { max: 10,  window: 3_600_000 }, // 10 req/hour
}

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname
  const entry = Object.entries(LIMITS).find(([k]) => path.startsWith(k))
  if (!entry) return NextResponse.next()

  const [, { max, window: win }] = entry
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() ||
             req.headers.get('x-real-ip') ||
             'anon'
  const key = `${path}|${ip}`
  const now  = Date.now()

  let rec = store.get(key)
  if (!rec || now > rec.reset) {
    rec = { count: 0, reset: now + win }
    store.set(key, rec)
  }

  rec.count++

  const res = NextResponse.next()
  res.headers.set('X-RateLimit-Limit',     String(max))
  res.headers.set('X-RateLimit-Remaining', String(Math.max(0, max - rec.count)))
  res.headers.set('X-RateLimit-Reset',     String(rec.reset))

  if (rec.count > max) {
    return NextResponse.json(
      { error: 'Demasiados pedidos. Tenta novamente em breve.' },
      {
        status: 429,
        headers: {
          'Retry-After':           String(Math.ceil((rec.reset - now) / 1000)),
          'X-RateLimit-Limit':     String(max),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset':     String(rec.reset),
        },
      }
    )
  }

  return res
}

export const config = {
  matcher: [
    '/api/radar',
    '/api/avm',
    '/api/mortgage',
    '/api/nhr',
    '/api/portfolio',
    '/api/learn',
  ],
}
