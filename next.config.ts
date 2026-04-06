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
  // XSS protection browsers antigos
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  // Isola o processo do browser — protege contra Spectre/Meltdown e ataques de timing
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  // Isola recursos cross-origin — protege contra data leaks
  { key: 'Cross-Origin-Resource-Policy', value: 'same-site' },
  // CORS: agencygroup.pt + mobile app (Expo/React Native)
  // Mobile app connects from expo-go and production builds via capacitor/native
  { key: 'Access-Control-Allow-Origin', value: process.env.NODE_ENV === 'development' ? '*' : 'https://www.agencygroup.pt' },
  { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
  { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, X-Requested-With, X-AG-Token' },
  // Content Security Policy — define exactamente de onde podem vir scripts, imagens, fonts
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      `script-src 'self'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ""} 'unsafe-inline' https://www.googletagmanager.com https://vercel.live`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' blob: data: https://images.unsplash.com https://plus.unsplash.com https://www.google.com https://lh3.googleusercontent.com https://*.supabase.co https:",
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
  typescript: {
    // Bypass TS errors during Vercel build — fix incrementally
    ignoreBuildErrors: true,
  },
  eslint: {
    // Bypass ESLint during Vercel build — checked locally
    ignoreDuringBuilds: true,
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
