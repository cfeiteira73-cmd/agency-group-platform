import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'

export async function GET(req: NextRequest) {
  const SECRET = process.env.AUTH_SECRET!
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
