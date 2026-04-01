import type { NextConfig } from 'next'

const securityHeaders = [
  // Impede clickjacking — ninguém pode meter o site dentro de um iframe noutro domínio
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  // Impede MIME-type sniffing — protege contra uploads maliciosos
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Activa HTTPS forçado por 2 anos — protege contra ataques man-in-the-middle
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // Controla informação de referrer — não vaza URLs internas a terceiros
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Bloqueia acesso a câmara/microfone/geolocalização — privacidade do utilizador
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  // Protecção XSS adicional em browsers antigos
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  // Content Security Policy — define exactamente de onde podem vir scripts, imagens, fonts
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://vercel.live",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://images.unsplash.com https://plus.unsplash.com https://www.google.com",
      "connect-src 'self' https://api.anthropic.com https://api.stability.ai https://api.notion.com https://vercel.live wss://vercel.live",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
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
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

export default config
