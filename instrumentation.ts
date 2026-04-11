// ─── Startup env var validation ───────────────────────────────────────────────
// Runs once when the Next.js server starts.
// Logs clear, actionable warnings for missing/invalid critical env vars.
// Never throws — we prefer graceful degradation over crash.
// See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const REQUIRED: { key: string; description: string; severity: 'CRITICAL' | 'WARNING' }[] = [
      { key: 'ANTHROPIC_API_KEY',            description: 'Sofia AI chat disabled',                   severity: 'CRITICAL' },
      { key: 'NEXT_PUBLIC_SUPABASE_URL',     description: 'Database unavailable — all CRM disabled',  severity: 'CRITICAL' },
      { key: 'SUPABASE_SERVICE_ROLE_KEY',    description: 'Server-side DB writes disabled',            severity: 'CRITICAL' },
      { key: 'RESEND_API_KEY',               description: 'Email alerts disabled',                    severity: 'WARNING' },
      { key: 'AUTH_SECRET',                  description: 'Portal magic-link auth disabled',           severity: 'CRITICAL' },
      { key: 'NEXT_PUBLIC_SITE_URL',         description: 'Internal fetch URLs will fallback to agencygroup.pt', severity: 'WARNING' },
      { key: 'AGENT_ALERT_EMAIL',            description: 'Lead alert emails will not be sent',       severity: 'WARNING' },
      { key: 'UPSTASH_REDIS_REST_URL',       description: 'Rate limiting is in-memory only (single-instance)', severity: 'WARNING' },
      { key: 'UPSTASH_REDIS_REST_TOKEN',     description: 'Rate limiting is in-memory only (single-instance)', severity: 'WARNING' },
      { key: 'NEXT_PUBLIC_GTM_ID',           description: 'GTM analytics disabled — zero event tracking in production', severity: 'WARNING' },
      { key: 'PORTAL_API_SECRET',            description: 'Lead scoring disabled — all leads arrive without tier/score',  severity: 'CRITICAL' },
    ]

    const missing = REQUIRED.filter(v => !process.env[v.key])

    if (missing.length > 0) {
      const critical = missing.filter(v => v.severity === 'CRITICAL')
      const warnings = missing.filter(v => v.severity === 'WARNING')

      if (critical.length > 0) {
        console.error('[AG] ⚠ CRITICAL env vars missing:')
        critical.forEach(v => console.error(`  ✗ ${v.key} — ${v.description}`))
      }

      if (warnings.length > 0) {
        console.warn('[AG] WARN env vars not set:')
        warnings.forEach(v => console.warn(`  ⚠ ${v.key} — ${v.description}`))
      }
    } else {
      console.log('[AG] ✓ All env vars present')
    }

    // Validate formats for set vars
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (supabaseUrl && !supabaseUrl.startsWith('https://')) {
      console.error('[AG] ✗ NEXT_PUBLIC_SUPABASE_URL must start with https://')
    }

    const authSecret = process.env.AUTH_SECRET
    if (authSecret && authSecret.length < 32) {
      console.error('[AG] ✗ AUTH_SECRET is too short — must be >= 32 characters')
    }
  }
}
