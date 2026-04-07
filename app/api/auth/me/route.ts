import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { safeCompare } from '@/lib/safeCompare'

const SECRET = process.env.AUTH_SECRET
const IS_PRODUCTION = process.env.NODE_ENV === 'production'

/**
 * GET /api/auth/me
 * Returns the current authenticated session from the ag-auth-token cookie.
 * Used by the portal page as a fallback when localStorage is missing
 * (e.g. after a cookie-based login from a different browser/tab).
 */
export async function GET(req: NextRequest) {
  if (!SECRET) {
    return NextResponse.json({ ok: false, error: 'Configuração inválida' }, { status: 500 })
  }

  // Accept both the production (__Secure-) and development cookie names
  const cookieValue =
    req.cookies.get('__Secure-ag-auth-token')?.value ||
    req.cookies.get('ag-auth-token')?.value

  if (!cookieValue) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  try {
    const dotIdx = cookieValue.lastIndexOf('.')
    if (dotIdx === -1) return NextResponse.json({ ok: false }, { status: 401 })

    const payload = cookieValue.slice(0, dotIdx)
    const sig = cookieValue.slice(dotIdx + 1)
    const expected = createHmac('sha256', SECRET).update(payload).digest('hex')

    if (!safeCompare(sig, expected)) {
      return NextResponse.json({ ok: false }, { status: 401 })
    }

    const data = JSON.parse(Buffer.from(payload, 'base64url').toString())

    if (Date.now() > data.exp) {
      return NextResponse.json({ ok: false, error: 'Sessão expirada' }, { status: 401 })
    }

    return NextResponse.json({ ok: true, email: data.email })
  } catch {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
}
