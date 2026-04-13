// =============================================================================
// Agency Group — Next.js Middleware
// Cache strategy + SEO headers + X-Robots-Tag for private routes
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'

export const config = {
  matcher: [
    // Apply to all routes except Next.js internals
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)).*)',
  ],
}

export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl
  const res = NextResponse.next()

  // ── Security headers (all routes) ────────────────────────────────────────
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('X-Frame-Options', 'SAMEORIGIN')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)')

  // ── X-Robots-Tag: noindex for private/internal routes ───────────────────
  const noindexPaths = [
    '/portal',
    '/auth',
    '/onboarding',
    '/admin',
    '/deal',
    '/api',
    '/collection',
    '/_next',
  ]
  const isPrivate = noindexPaths.some(p => pathname.startsWith(p))
  if (isPrivate) {
    res.headers.set('X-Robots-Tag', 'noindex, nofollow')
  }

  // ── Cache-Control by route type ──────────────────────────────────────────
  if (pathname.startsWith('/api/')) {
    // API routes: no cache
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
  } else if (pathname.startsWith('/portal') || pathname.startsWith('/auth')) {
    // Portal: no cache (auth-gated)
    res.headers.set('Cache-Control', 'private, no-store')
  } else if (pathname.startsWith('/blog/')) {
    // Blog articles: cache 1h, stale-while-revalidate 24h
    res.headers.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400')
  } else if (pathname.startsWith('/zonas/') || pathname.startsWith('/imoveis/')) {
    // Zone & property pages: cache 30min, SWR 2h
    res.headers.set('Cache-Control', 'public, max-age=1800, stale-while-revalidate=7200')
  } else if (pathname === '/faq' || pathname === '/blog') {
    // High-value static pages: cache 2h
    res.headers.set('Cache-Control', 'public, max-age=7200, stale-while-revalidate=86400')
  } else if (pathname === '/') {
    // Homepage: cache 15min, SWR 1h
    res.headers.set('Cache-Control', 'public, max-age=900, stale-while-revalidate=3600')
  } else {
    // Default: cache 5min
    res.headers.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600')
  }

  // ── Redirect www to non-www (canonical) ─────────────────────────────────
  const host = req.headers.get('host') ?? ''
  if (host.startsWith('www.agencygroup.pt')) {
    const url = req.nextUrl.clone()
    url.host = 'agencygroup.pt'
    return NextResponse.redirect(url, { status: 301 })
  }

  // ── Accept-Language default locale hint ──────────────────────────────────
  // Let the homepage decide — no forced redirect to avoid SEO issues
  // Just pass through with Vary header for CDN
  if (pathname === '/') {
    res.headers.set('Vary', 'Accept-Language')
  }

  return res
}
