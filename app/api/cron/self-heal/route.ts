// =============================================================================
// Agency Group — Self-Healing Cron
// GET /api/cron/self-heal
// Scheduled every 2 minutes (*/2 * * * *) via vercel.json
//
// Runs runHealingBatch() for all configured tenants.
// Logs aggregated results and exits cleanly.
//
// Auth : CRON_SECRET bearer token
// TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { runHealingBatch }           from '@/lib/remediation/selfHealingOrchestrator'
import { safeCompare }               from '@/lib/safeCompare'
import { withCronLock }              from '@/lib/ops/withCronLock'

export const runtime     = 'nodejs'
export const maxDuration = 300

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
  const ids = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return ids.length > 0 ? ids : ['agency-group']
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Distributed lock — prevents overlap with detect-incidents and concurrent
  // self-heal invocations. Using a distinct prefix so the two crons do not
  // share the same lock key (each can run independently, just not concurrently
  // with itself). TTL: 6 minutes (maxDuration=300s + 60s buffer).
  const locked = await withCronLock('self-heal', 6, async () => {
    const tenantIds = resolveTenantIds()
    const startMs   = Date.now()
    const summary: Array<{
      tenant_id:    string
      cycles:       number
      healed:       number
      escalated:    number
      avg_ms:       number
      heal_rate:    number
    }> = []

    for (const tenantId of tenantIds) {
      // Time budget: stop after 240s (4 min) to leave 60s margin within maxDuration=300
      if (Date.now() - startMs > 240_000) {
        console.warn(
          `[self-heal cron] time budget exceeded, stopping at ${tenantIds.indexOf(tenantId)} of ${tenantIds.length} tenants`,
        )
        break
      }
      try {
        const results = await runHealingBatch(tenantId)
        const healed    = results.filter((r) => r.healed).length
        const escalated = results.filter((r) => r.escalated).length
        const avgMs     = results.length > 0
          ? Math.round(results.reduce((a, r) => a + r.duration_ms, 0) / results.length)
          : 0

        summary.push({
          tenant_id: tenantId,
          cycles:    results.length,
          healed,
          escalated,
          avg_ms:    avgMs,
          heal_rate: results.length > 0 ? Math.round((healed / results.length) * 1000) / 1000 : 0,
        })

        if (results.length > 0) {
          console.info(
            `[self-heal cron] tenant=${tenantId} cycles=${results.length} healed=${healed} escalated=${escalated} avg_ms=${avgMs}`,
          )
        }
      } catch (err) {
        console.error(
          `[self-heal cron] tenant=${tenantId} error:`,
          err instanceof Error ? err.message : err,
        )
        summary.push({
          tenant_id: tenantId,
          cycles:    0,
          healed:    0,
          escalated: 0,
          avg_ms:    0,
          heal_rate: 0,
        })
      }
    }

    const totalCycles  = summary.reduce((a, s) => a + s.cycles, 0)
    const totalHealed  = summary.reduce((a, s) => a + s.healed, 0)

    return NextResponse.json({
      ran_at:       new Date().toISOString(),
      duration_ms:  Date.now() - startMs,
      tenants:      tenantIds.length,
      total_cycles: totalCycles,
      total_healed: totalHealed,
      global_heal_rate: totalCycles > 0
        ? Math.round((totalHealed / totalCycles) * 1000) / 1000
        : 0,
      summary,
    })
  })

  if (locked === null) {
    return NextResponse.json({ skipped: true, reason: 'another_instance_running' })
  }

  return locked
}
