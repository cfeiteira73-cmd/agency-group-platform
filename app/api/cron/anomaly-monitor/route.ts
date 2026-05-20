// =============================================================================
// Agency Group — Anomaly Monitor Cron
// GET /api/cron/anomaly-monitor
// Scheduled every 5 minutes (*/5 * * * *) via vercel.json
//
// Runs all anomaly checks (DLQ spike, latency regression, economic score drop,
// agent failure rate) for all configured tenants. Emits critical alerts to
// system_alerts in Supabase when anomalies are detected.
//
// Replaces the dead setInterval in AnomalyMonitor with a proper cron invocation
// that is compatible with Vercel serverless (stateless, no background timers).
//
// Auth : CRON_SECRET bearer token
// TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { runAnomalyCheck }           from '@/lib/observability/anomalyMonitoring'
import { safeCompare }               from '@/lib/safeCompare'
import { withCronLock }              from '@/lib/ops/withCronLock'

export const runtime     = 'nodejs'
export const maxDuration = 120

// ─── Auth ─────────────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false
  const incoming =
    req.headers.get('x-cron-secret') ??
    req.headers.get('authorization')?.replace('Bearer ', '')
  return !!incoming && safeCompare(incoming, cronSecret)
}

// ─── Tenant resolution ────────────────────────────────────────────────────────

function resolveTenantIds(): string[] {
  const raw = process.env.TENANT_IDS ?? ''
  const ids = raw.split(',').map((s) => s.trim()).filter(Boolean)
  return ids.length > 0 ? ids : ['agency-group']
}

// ─── GET handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const locked = await withCronLock('anomaly-monitor', 3, async () => {
    const tenantIds = resolveTenantIds()
    const startMs   = Date.now()
    const results: Array<{
      tenant_id:  string
      total:      number
      critical:   number
      warning:    number
      error?:     string
    }> = []

    for (const tenantId of tenantIds) {
      // Time budget: stop after 90 s to leave margin within maxDuration=120
      if (Date.now() - startMs > 90_000) {
        console.warn(
          `[anomaly-monitor cron] time budget exceeded, stopping at tenant=${tenantId}`,
        )
        break
      }
      try {
        const summary = await runAnomalyCheck(tenantId)
        results.push({
          tenant_id: tenantId,
          total:     summary.total,
          critical:  summary.critical,
          warning:   summary.warning,
        })
        if (summary.total > 0) {
          console.info(
            `[anomaly-monitor cron] tenant=${tenantId} total=${summary.total} critical=${summary.critical} warning=${summary.warning}`,
          )
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error(`[anomaly-monitor cron] tenant=${tenantId} error:`, message)
        results.push({ tenant_id: tenantId, total: 0, critical: 0, warning: 0, error: message })
      }
    }

    const totalAnomalies = results.reduce((a, r) => a + r.total, 0)
    const totalCritical  = results.reduce((a, r) => a + r.critical, 0)

    return NextResponse.json({
      ran_at:           new Date().toISOString(),
      duration_ms:      Date.now() - startMs,
      tenants_scanned:  tenantIds.length,
      total_anomalies:  totalAnomalies,
      total_critical:   totalCritical,
      results,
    })
  })

  if (locked === null) {
    return NextResponse.json({ skipped: true, reason: 'another_instance_running' })
  }

  return locked
}
