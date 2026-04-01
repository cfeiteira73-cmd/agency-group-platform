import type { NextConfig } from 'next'

const securityHeaders = [
  // Impede clickjacking
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  // Impede MIME-type sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // HTTPS forçado 2 anos + preload list
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // Não vaza URLs internas
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Bloqueia câmara, microfone, geolocalização
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=()' },
  // XSS protection browsers antigos
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  // Isola o processo do browser — protege contra Spectre/Meltdown e ataques de timing
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  // Isola recursos cross-origin — protege contra data leaks
  { key: 'Cross-Origin-Resource-Policy', value: 'same-site' },
  // CORS: só agencygroup.pt pode chamar as APIs — bloqueia todos os outros sites
  { key: 'Access-Control-Allow-Origin', value: 'https://www.agencygroup.pt' },
  { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
  { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
  // Content Security Policy — define exactamente de onde podem vir scripts, imagens, fonts
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://vercel.live",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://images.unsplash.com https://plus.unsplash.com https://www.google.com",
      "connect-src 'self' https://api.anthropic.com https://api.stability.ai https://api.notion.com https://vercel.live wss://vercel.live https://www.wixapis.com",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join('; '),
  },
]

const config: NextConfig = {
  reactStrictMode: false,
  typescript: { ignoreBuildErrors: true },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com', pathname: '/**' },
      { protocol: 'https', hostname: 'plus.unsplash.com', pathname: '/**' },
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  async headers() {
    return [
      {
        // Segurança geral em todas as páginas
        source: '/(.*)',
        headers: securityHeaders,
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
    ]
  },
}

export default config
