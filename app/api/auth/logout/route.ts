import { NextResponse } from 'next/server'

const IS_PRODUCTION = process.env.NODE_ENV === 'production'

/**
 * POST /api/auth/logout
 *
 * Terminates the server-side session by expiring the ag-auth-token cookie.
 *
 * WHY THIS EXISTS:
 *   ag-auth-token is httpOnly — client-side JavaScript cannot access or clear
 *   it. The previous logout() in portal/page.tsx only removed localStorage,
 *   leaving the cookie alive. In Internet Explorer / IE mode, session restore
 *   keeps cookies across browser restarts, so the "logged-out" user would
 *   re-enter the portal on the next visit because the cookie was still valid
 *   and middleware accepted it.
 *
 *   This endpoint sets both Max-Age=0 (modern browsers) and Expires=epoch
 *   (Internet Explorer, which ignores Max-Age) so the cookie is deleted
 *   correctly in every browser.
 */
export async function POST() {
  const res = NextResponse.json({ ok: true })

  // Expire the cookie in all browsers:
  //   Max-Age=0  → Chrome, Firefox, Edge (modern)
  //   Expires=0  → Internet Explorer (ignores Max-Age, respects Expires)
  res.cookies.set('ag-auth-token', '', {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    expires: new Date(0), // Unix epoch — already in the past
  })

  return res
}
