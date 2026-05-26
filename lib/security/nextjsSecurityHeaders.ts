// =============================================================================
// Agency Group — SH-ROS | AMI: 22506
// Next.js Security Headers — Production Configuration
// Wave 45 Agent 2 — Maximum Security Hardening
// =============================================================================

export const SECURITY_HEADERS = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(self), usb=()',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' https://*.supabase.co https://*.anthropic.com wss://*.supabase.co",
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      'report-uri /api/security/csp-report',
    ].join('; '),
  },
]

export function getSecurityHeadersConfig(): Array<{
  source: string
  headers: typeof SECURITY_HEADERS
}> {
  return [
    {
      source: '/(.*)',
      headers: SECURITY_HEADERS,
    },
  ]
}

// Validates that all required headers are present in a response
export function validateSecurityHeaders(responseHeaders: Record<string, string>): {
  compliant: boolean
  missing: string[]
  score: number // 0–100
} {
  const required = [
    'Strict-Transport-Security',
    'X-Content-Type-Options',
    'X-Frame-Options',
    'Content-Security-Policy',
    'Referrer-Policy',
  ]

  const lower = Object.fromEntries(
    Object.entries(responseHeaders).map(([k, v]) => [k.toLowerCase(), v]),
  )

  const missing = required.filter(
    (h) => !responseHeaders[h] && !lower[h.toLowerCase()],
  )

  const score = Math.round(((required.length - missing.length) / required.length) * 100)

  return { compliant: missing.length === 0, missing, score }
}
