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
      { key: 'N8N_WEBHOOK_URL',              description: 'n8n automation disabled — leads not routed to workflows',      severity: 'WARNING' },
      { key: 'CRON_SECRET',                  description: 'Cron jobs unauthenticated — automation vulnerable',             severity: 'WARNING' },
      { key: 'INTERNAL_API_BASE',            description: 'Control Tower fetches will fail silently (all panels empty)',    severity: 'CRITICAL' },
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

    // SYSTEM_ORG_ID boot guard — fail-closed: validates UUID v4 + tenants table lookup.
    // If invalid → P1 incident. Revenue dashboard will show empty state until fixed.
    void (async () => {
      try {
        const { validateSystemOrgId } = await import('@/lib/bootstrap/systemOrgValidator')
        const orgResult = await validateSystemOrgId()
        if (!orgResult.ok) {
          console.error(
            `[AG] ✗ SYSTEM_ORG_ID INVALID — revenue dashboard will be empty: ${orgResult.error}`,
            '\n    Fix: add SYSTEM_ORG_ID=<UUID from tenants table> to Vercel env vars',
            '\n    Run: SELECT id, slug FROM tenants; in Supabase SQL editor',
          )
          const { supabaseAdmin } = await import('@/lib/supabase')
          await supabaseAdmin.from('incidents').insert({
            tenant_id:        orgResult.org_id ?? 'unknown',
            severity:         'P1',
            subsystem:        'config',
            raw_error:        `SYSTEM_ORG_ID boot validation failed: ${orgResult.error}`,
            status:           'open',
            metrics_snapshot: { org_id: orgResult.org_id, checked_at: orgResult.checked_at },
            detected_at:      new Date().toISOString(),
          })
        } else {
          console.log(`[AG] ✓ SYSTEM_ORG_ID valid — tenant: ${orgResult.tenant_slug} (${orgResult.org_id})`)
        }
      } catch (e) {
        console.warn('[AG] SYSTEM_ORG_ID validator failed (non-fatal):', e)
      }
    })()

    // Schema drift check — fire-and-forget, never blocks startup
    void (async () => {
      try {
        const { verifySchema } = await import('@/lib/db/schemaVerifier')
        const result = await verifySchema()
        if (!result.ok) {
          const driftSummary = result.drifts
            .map(d => `[${d.table}] missing: ${d.missing.join(', ')}`)
            .join(' | ')
          console.error(`[AG] ✗ SCHEMA DRIFT at startup: ${driftSummary}`)
          // Write P0 incident — pipeline is broken if columns are missing
          const { supabaseAdmin } = await import('@/lib/supabase')
          await supabaseAdmin.from('incidents').insert({
            tenant_id:        'agency-group',
            severity:         'P0',
            subsystem:        'database',
            raw_error:        `Schema drift detected at startup: ${driftSummary}`,
            status:           'open',
            metrics_snapshot: { drifts: result.drifts },
            detected_at:      new Date().toISOString(),
          })
        } else {
          console.log('[AG] ✓ Schema verified — no column drift')
        }
      } catch (e) {
        console.warn('[AG] Schema verifier failed (non-fatal):', e)
      }
    })()

    // INTERNAL_API_BASE must NOT be localhost in production.
    // All Control Tower RSC pages do server-side fetches via this base URL.
    // If it points to localhost, every Control Tower panel silently returns empty data.
    const internalApiBase = process.env.INTERNAL_API_BASE
    const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production'
    if (isProduction && internalApiBase) {
      if (internalApiBase.includes('localhost') || internalApiBase.includes('127.0.0.1')) {
        console.error(
          '[AG] ✗ CRITICAL: INTERNAL_API_BASE is set to localhost in production!',
          '\n    All Control Tower pages will show empty/skeleton state.',
          '\n    Fix: set INTERNAL_API_BASE=https://your-production-domain.vercel.app in Vercel env vars.',
          `\n    Current value: ${internalApiBase}`,
        )
        // Write incident to Supabase — fire-and-forget so startup never blocks
        void (async () => {
          try {
            const { supabaseAdmin } = await import('@/lib/supabase')
            await supabaseAdmin.from('incidents').insert({
              tenant_id:   'agency-group',
              severity:    'P0',
              subsystem:   'api',
              raw_error:   `INTERNAL_API_BASE misconfiguration: ${internalApiBase} — all Control Tower panels will return empty data`,
              status:      'open',
              metrics_snapshot: { env: process.env.VERCEL_ENV ?? process.env.NODE_ENV },
              detected_at: new Date().toISOString(),
            })
          } catch {
            // Best-effort — if Supabase isn't configured yet, just skip
          }
        })()
      }
    }
  }
}
