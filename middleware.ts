import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'

// Rate limit store (por processo Edge worker)
const store = new Map<string, { count: number; reset: number }>()

// Limites por rota
const LIMITS: Record<string, { max: number; window: number }> = {
  '/api/radar':      { max: 20,  window: 3_600_000 },
  '/api/avm':        { max: 100, window: 3_600_000 },
  '/api/mortgage':   { max: 200, window: 3_600_000 },
  '/api/nhr':        { max: 200, window: 3_600_000 },
  '/api/portfolio':  { max: 30,  window: 3_600_000 },
  '/api/learn':      { max: 10,  window: 3_600_000 },
  '/api/chat':       { max: 60,  window: 3_600_000 }, // Sofia AI — protege custos Anthropic
  '/api/juridico':   { max: 30,  window: 3_600_000 }, // Juridico AI — protege custos
  '/api/content':    { max: 20,  window: 3_600_000 }, // Content gen — operação pesada
  '/api/homestaging':{ max: 20,  window: 3_600_000 }, // Stability AI — protege custos
  '/api/booking':    { max: 30,  window: 3_600_000 }, // Booking confirmations
  '/api/track-view': { max: 200, window: 3_600_000 }, // View tracking
  '/api/mais-valias':{ max: 100, window: 3_600_000 }, // Mais-valias simulator
}

// Bots e scrapers conhecidos a bloquear (User-Agent blacklist)
const BOT_PATTERNS = [
  /scrapy/i, /python-requests/i, /go-http-client/i, /curl\/[0-9]/i,
  /wget/i, /libwww/i, /zgrab/i, /masscan/i, /sqlmap/i, /nikto/i,
  /nmap/i, /dirbuster/i, /nuclei/i, /httpx/i,
]

// Verifica token magic-link para proteger o portal
function verifyToken(token: string, secret: string): boolean {
  try {
    const dotIdx = token.lastIndexOf('.')
    if (dotIdx === -1) return false
    const payload = token.slice(0, dotIdx)
    const sig = token.slice(dotIdx + 1)
    const expected = createHmac('sha256', secret).update(payload).digest('hex')
    if (sig !== expected) return false
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString())
    return data.type === 'magic' && Date.now() < data.exp
  } catch {
    return false
  }
}

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname
  const ua = req.headers.get('user-agent') || ''

  // 1. BLOQUEIO DE BOTS MALICIOSOS
  if (BOT_PATTERNS.some(p => p.test(ua))) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  // 2. PROTECÇÃO DO PORTAL — obriga a token válido
  if (path.startsWith('/portal')) {
    const token = req.nextUrl.searchParams.get('token')
    const secret = process.env.AUTH_SECRET
    if (!secret || !token || !verifyToken(token, secret)) {
      // Sem token válido → redireciona para homepage
      return NextResponse.redirect(new URL('/', req.url))
    }
  }

  // 3. RATE LIMITING nas APIs
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
  ],
}
