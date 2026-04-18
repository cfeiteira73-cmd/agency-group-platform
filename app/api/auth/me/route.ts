import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { safeCompare } from '@/lib/safeCompare'

const SECRET = process.env.AUTH_SECRET

// Applied to every response so browsers and CDNs never cache auth state.
// Without this, Edge (and other browsers with aggressive caches) can serve
// a previously-cached { ok: true } response even after the ag-auth-token
// cookie has expired or been cleared — causing the portal to render without
// a valid live session.
const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, private',
  'Pragma':        'no-cache',
  'Expires':       '0',
}

/**
 * GET /api/auth/me
 * Returns the current authenticated session from the ag-auth-token cookie.
 * Used by the portal page and the homepage CTA session gate to verify that
 * a live, unexpired server-side session exists before rendering the portal.
 *
 * Always returns Cache-Control: no-store so no browser or CDN ever caches
 * the result — every call must hit the server and re-validate the cookie.
 */
export async function GET(req: NextRequest) {
  if (!SECRET) {
    return NextResponse.json(
      { ok: false, error: 'Configuração inválida' },
      { status: 500, headers: NO_CACHE_HEADERS },
    )
  }

  // Accept both the production (__Secure-) and development cookie names
  const cookieValue =
    req.cookies.get('__Secure-ag-auth-token')?.value ||
    req.cookies.get('ag-auth-token')?.value

  if (!cookieValue) {
    return NextResponse.json(
      { ok: false },
      { status: 401, headers: NO_CACHE_HEADERS },
    )
  }

  try {
    const dotIdx = cookieValue.lastIndexOf('.')
    if (dotIdx === -1) {
      return NextResponse.json({ ok: false }, { status: 401, headers: NO_CACHE_HEADERS })
    }

    const payload  = cookieValue.slice(0, dotIdx)
    const sig      = cookieValue.slice(dotIdx + 1)
    const expected = createHmac('sha256', SECRET).update(payload).digest('hex')

    if (!safeCompare(sig, expected)) {
      return NextResponse.json({ ok: false }, { status: 401, headers: NO_CACHE_HEADERS })
    }

    const data = JSON.parse(Buffer.from(payload, 'base64url').toString())

    if (Date.now() > data.exp) {
      return NextResponse.json(
        { ok: false, error: 'Sessão expirada' },
        { status: 401, headers: NO_CACHE_HEADERS },
      )
    }

    return NextResponse.json(
      { ok: true, email: data.email },
      { headers: NO_CACHE_HEADERS },
    )
  } catch {
    return NextResponse.json({ ok: false }, { status: 401, headers: NO_CACHE_HEADERS })
  }
}
