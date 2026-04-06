import { NextRequest, NextResponse } from 'next/server'

// Protect all /portal/* routes — require auth cookie
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Only protect portal routes
  if (!pathname.startsWith('/portal')) {
    return NextResponse.next()
  }

  // Allow the login page itself
  if (pathname === '/portal/login') {
    return NextResponse.next()
  }

  // Check for auth token (cookie set by NextAuth / our auth system)
  const authCookie =
    request.cookies.get('next-auth.session-token')?.value ||
    request.cookies.get('__Secure-next-auth.session-token')?.value ||
    request.cookies.get('ag-auth-token')?.value

  if (!authCookie) {
    const loginUrl = new URL('/portal/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/portal/:path*'],
}
