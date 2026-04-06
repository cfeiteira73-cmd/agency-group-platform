import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { rateLimit, getRetryAfterMinutes } from '@/lib/rateLimit'

const SECRET = process.env.AUTH_SECRET
if (!SECRET) {
  console.error('[auth/verify] AUTH_SECRET não configurado')
  // Não faz throw — deixa a rota tratar como 500 normalmente
}

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

    return NextResponse.json({ ok: true, email: data.email })
  } catch {
    return NextResponse.json({ error: 'Token inválido' }, { status: 400 })
  }
}
