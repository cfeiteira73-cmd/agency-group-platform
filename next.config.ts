import type { NextConfig } from 'next'

const securityHeaders = [
  // DNS prefetch para performance
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  // Impede clickjacking
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  // Impede MIME-type sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // HTTPS forçado 2 anos + preload list
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // Não vaza URLs internas
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Câmara e microfone bloqueados; geolocalização apenas para o próprio site
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), interest-cohort=(), payment=()' },
  // Isola o processo do browser — protege contra Spectre/Meltdown e ataques de timing
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  // Isola recursos cross-origin — protege contra data leaks
  { key: 'Cross-Origin-Resource-Policy', value: 'same-site' },
  // CORS: agencygroup.pt + mobile app (Expo/React Native)
  // Mobile app connects from expo-go and production builds via capacitor/native
  // NOT wildcard * in development — locked to localhost only (security hardening)
  { key: 'Access-Control-Allow-Origin', value: process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'https://www.agencygroup.pt' },
  { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
  { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, X-Requested-With, X-AG-Token' },
  // Content Security Policy — define exactamente de onde podem vir scripts, imagens, fonts
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      `script-src 'self'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ""} 'unsafe-inline' https://www.googletagmanager.com https://vercel.live https://unpkg.com`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' blob: data: https://images.unsplash.com https://plus.unsplash.com https://www.google.com https://lh3.googleusercontent.com https://*.supabase.co https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com https://unpkg.com https:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.anthropic.com https://api.resend.com https://graph.facebook.com https://o*.ingest.sentry.io https://api.stability.ai https://api.notion.com https://vercel.live wss://vercel.live https://www.wixapis.com https://accounts.google.com https://api.heygen.com https://production-sfo.browserless.io https://www.idealista.pt https://api.twilio.com",
      "frame-src 'self' https://my.matterport.com https://www.youtube.com https://player.vimeo.com",
      "object-src 'none'",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join('; '),
  },
]

const config: NextConfig = {
  reactStrictMode: true,

  // CI builds work without all env vars; Vercel has all secrets
  typescript: { ignoreBuildErrors: true },
  // eslint: { ignoreDuringBuilds: true }, // moved to eslint.config.ts / .eslintrc

  // Compress responses at edge (Vercel + Node.js)
  compress: true,

  // Tree-shake large packages — reduces bundle size significantly
  experimental: {
    optimizePackageImports: [
      '@anthropic-ai/sdk',
      'gsap',
      'zustand',
      'leaflet',
    ],
  },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com', pathname: '/**' },
      { protocol: 'https', hostname: 'plus.unsplash.com', pathname: '/**' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com', pathname: '/**' },
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/**' },
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // 1-year cache for optimised images — massive LCP improvement on repeat visits
    minimumCacheTTL: 31536000,
  },
  async headers() {
    return [
      {
        // Segurança geral em todas as páginas
        source: '/(.*)',
        headers: securityHeaders,
      },
      {
        // Service worker: NUNCA em cache — browser e CDN devem sempre buscar a versão nova
        // Se o sw.js ficar em cache, versões antigas do SW continuam a servir HTML antigo
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        // Manifest PWA: sem cache longo — permite que mudanças (background_color, theme_color) propaguem
        source: '/manifest.json',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
        ],
      },
      {
        // Portal — NEVER cache in browser or CDN.
        // /portal is an auth-protected page. If the browser (especially IE)
        // serves a cached copy, Next.js middleware never runs, and the only
        // remaining auth check is the client-side localStorage path in
        // portal/page.tsx — which an attacker (or stale session) can bypass.
        // no-store forces every visit through the server so middleware always
        // validates the ag-auth-token cookie before the page is delivered.
        source: '/portal',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
        ],
      },
      {
        source: '/portal/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
        ],
      },
      {
        // Blog articles: estáticos — CDN pode fazer cache por 24h, revalidar em background
        // Vercel Edge vai servir de cache após o primeiro request — TTFB ~10ms no repeat
        source: '/blog/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, s-maxage=86400, stale-while-revalidate=43200' },
        ],
      },
      {
        // Marketing pages: semi-estáticos — cache 1h no CDN
        source: '/(zonas|relatorio-2026|vendidos|parceiros|equipa|faq|privacy|off-market|vender-imovel-portugal)/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, s-maxage=3600, stale-while-revalidate=1800' },
        ],
      },
      {
        // Static assets (_next/static): imutáveis por versão — 1 ano de cache
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        // Public media (hero, og images, fonts): 7 dias
        source: '/(hero-poster.jpg|og-image.jpg|og-imoveis.jpg|favicon.ico|icons/:path*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' },
        ],
      },
    ]
  },
  async redirects() {
    return [
      // Força www — consistência e HSTS preload requer domínio único
      {
        source: '/(.*)',
        has: [{ type: 'host', value: 'agencygroup.pt' }],
        destination: 'https://www.agencygroup.pt/:path*',
        permanent: true,
      },
      // Static OG image placeholders → dynamic generator (edge ImageResponse)
      {
        source: '/og-image.jpg',
        destination: '/api/og',
        permanent: false,
      },
      {
        source: '/og-imoveis.jpg',
        destination: '/api/og?title=Propriedades+de+Luxo+em+Portugal&subtitle=Lisboa+%C2%B7+Cascais+%C2%B7+Porto+%C2%B7+Algarve&type=property',
        permanent: false,
      },
    ]
  },
}

export default config
