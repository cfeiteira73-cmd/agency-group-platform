import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { rateLimit, getRetryAfterMinutes } from '@/lib/rateLimit'

const SECRET = process.env.AUTH_SECRET
if (!SECRET) {
  console.error('[auth/verify] AUTH_SECRET não configurado')
  // Não faz throw — deixa a rota tratar como 500 normalmente
}

const IS_PRODUCTION = process.env.NODE_ENV === 'production'
const SESSION_MAX_AGE = 8 * 60 * 60 // 8 horas em segundos

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const limit = rateLimit(ip, { maxAttempts: 10, windowMs: 15 * 60 * 1000 })
  if (!limit.success) {
    const minutes = getRetryAfterMinutes(limit.reset)
    return NextResponse.json(
      { error: `Demasiadas tentativas. Tente novamente em ${minutes} minuto${minutes !== 1 ? 's' : ''}.` },
      { status: 429, headers: { 'Retry-After': String(minutes * 60) } }
    )
  }

  if (!SECRET) {
    return NextResponse.json({ error: 'Configuração inválida' }, { status: 500 })
  }
  try {
    const token = req.nextUrl.searchParams.get('token')
    if (!token) return NextResponse.json({ error: 'Token em falta' }, { status: 400 })

    const dotIdx = token.lastIndexOf('.')
    if (dotIdx === -1) return NextResponse.json({ error: 'Token inválido' }, { status: 400 })

    const payload = token.slice(0, dotIdx)
    const sig = token.slice(dotIdx + 1)
    const expected = createHmac('sha256', SECRET).update(payload).digest('hex')

    if (sig !== expected) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }

    const data = JSON.parse(Buffer.from(payload, 'base64url').toString())

    if (data.type !== 'magic') {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }
    if (Date.now() > data.exp) {
      return NextResponse.json({ error: 'Link expirado. Pede um novo acesso.' }, { status: 401 })
    }

    // Build session cookie value (signed with AUTH_SECRET so it can't be forged)
    const sessionPayload = Buffer.from(JSON.stringify({
      email: data.email,
      exp: Date.now() + SESSION_MAX_AGE * 1000,
    })).toString('base64url')
    const sessionSig = createHmac('sha256', SECRET).update(sessionPayload).digest('hex')
    const sessionCookieValue = `${sessionPayload}.${sessionSig}`

    // Detect whether the client wants JSON (called via fetch from login page)
    // or a browser navigation (direct GET from email link)
    const acceptHeader = req.headers.get('accept') || ''
    const wantsJson = acceptHeader.includes('application/json') && !acceptHeader.includes('text/html')

    // Use a plain cookie name without the __Secure- prefix.
    // Chrome silently drops __Secure- cookies when they arrive via a redirect
    // chain (agencygroup.pt → www.agencygroup.pt → /api/auth/verify) because
    // the prefix requires the cookie to be set in a "secure context" with no
    // cross-origin hops — a constraint Chrome enforces strictly while IE ignores.
    // proxy.ts already checks both variants so the fallback is preserved.
    const cookieName = 'ag-auth-token'
    const cookieOptions = {
      httpOnly: true,
      secure: IS_PRODUCTION,   // HTTPS-only in production, as required
      sameSite: 'lax' as const,
      path: '/',
      maxAge: SESSION_MAX_AGE,
    }

    if (wantsJson) {
      // Called via fetch() from login page — return JSON with cookie
      const res = NextResponse.json({ ok: true, email: data.email })
      res.cookies.set(cookieName, sessionCookieValue, cookieOptions)
      return res
    }

    // Direct browser navigation from email link — set cookie ON the redirect response
    // so the browser has it before hitting /portal (avoids race condition with fetch+navigate).
    // Use req.nextUrl.origin so the URL is always the public-facing origin
    // (www.agencygroup.pt) rather than any internal Vercel proxy URL.
    const redirectRes = NextResponse.redirect(new URL('/portal', req.nextUrl.origin))
    redirectRes.cookies.set(cookieName, sessionCookieValue, cookieOptions)
    // Prevent any intermediate proxy from caching this response and replaying
    // a stale Set-Cookie header to a different user.
    redirectRes.headers.set('Cache-Control', 'no-store, no-cache')
    redirectRes.headers.set('Pragma', 'no-cache')
    return redirectRes
  } catch {
    return NextResponse.json({ error: 'Token inválido' }, { status: 400 })
  }
}
