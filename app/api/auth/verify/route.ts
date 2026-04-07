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

    const res = NextResponse.json({ ok: true, email: data.email })

    // Set ag-auth-token cookie — this is what proxy.ts checks to allow /portal access
    const cookieName = IS_PRODUCTION ? '__Secure-ag-auth-token' : 'ag-auth-token'
    res.cookies.set(cookieName, sessionCookieValue, {
      httpOnly: true,
      secure: IS_PRODUCTION,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE,
    })

    return res
  } catch {
    return NextResponse.json({ error: 'Token inválido' }, { status: 400 })
  }
}
