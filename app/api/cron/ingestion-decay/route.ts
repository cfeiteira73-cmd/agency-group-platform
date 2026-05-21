// =============================================================================
// Agency Group — Ingestion Decay Cron
// app/api/cron/ingestion-decay/route.ts
//
// POST /api/cron/ingestion-decay
//   Runs freshness decay model for all active tenants.
//   Updates freshness_score and auto-expires stale listings.
//
// Schedule: every Monday at 04:00 UTC (vercel.json: "0 4 * * 1")
// Auth: CRON_SECRET
// Max duration: 300s (Vercel Pro)
//
// TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { requireServiceAuth }        from '@/lib/auth/serviceAuth'
import { runDecayCron }              from '@/lib/ingestion/decayModel'
import { supabaseAdmin }             from '@/lib/supabase'

export const runtime     = 'nodejs'
export const maxDuration = 300

// ─── POST /api/cron/ingestion-decay ──────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── Auth ─────────────────────────────────────────────────────────────────────
  const auth = await requireServiceAuth(req)
  if (!auth.ok) return auth.response

  const startedAt = new Date().toISOString()
  console.log('[ingestion-decay] Starting decay cron at', startedAt)

  // ── Fetch all active tenants ──────────────────────────────────────────────────
  const { data: tenants, error: tenantsErr } = await (supabaseAdmin as any)
    .from('organizations')
    .select('id, name, slug')
    .eq('plan', 'starter') // placeholder — all plans
    .order('created_at', { ascending: true })

  // Also fetch tenants that might not filter by plan
  const { data: allTenants } = await (supabaseAdmin as any)
    .from('organizations')
    .select('id, name, slug')
    .order('created_at', { ascending: true })

  const tenantList = (allTenants ?? tenants ?? []) as {
    id: string
    name: string
    slug: string
  }[]

  if (tenantsErr && !allTenants) {
    console.error('[ingestion-decay] Failed to fetch tenants:', tenantsErr.message)
    return NextResponse.json(
      { error: 'Failed to fetch tenants', detail: tenantsErr.message },
      { status: 500 },
    )
  }

  if (tenantList.length === 0) {
    return NextResponse.json({
      status:    'ok',
      message:   'No tenants found',
      started_at: startedAt,
      tenants_processed: 0,
    })
  }

  // ── Run decay for each tenant ─────────────────────────────────────────────────
  const results: Array<{
    tenant_id:             string
    tenant_slug:           string
    properties_updated:    number
    properties_delisted:   number
    avg_freshness_before:  number
    avg_freshness_after:   number
    duration_ms:           number
    error?: string
  }> = []

  let totalUpdated  = 0
  let totalDelisted = 0

  for (const tenant of tenantList) {
    const tenantStart = Date.now()
    try {
      const stats = await runDecayCron(tenant.id)
      const duration = Date.now() - tenantStart

      totalUpdated  += stats.properties_updated
      totalDelisted += stats.properties_delisted

      results.push({
        tenant_id:            tenant.id,
        tenant_slug:          tenant.slug,
        properties_updated:   stats.properties_updated,
        properties_delisted:  stats.properties_delisted,
        avg_freshness_before: stats.avg_freshness_before,
        avg_freshness_after:  stats.avg_freshness_after,
        duration_ms:          duration,
      })

      console.log(
        `[ingestion-decay] tenant=${tenant.slug} updated=${stats.properties_updated} ` +
        `delisted=${stats.properties_delisted} freshness=${stats.avg_freshness_before}→${stats.avg_freshness_after} ` +
        `(${duration}ms)`,
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[ingestion-decay] tenant=${tenant.slug} error:`, msg)
      results.push({
        tenant_id:            tenant.id,
        tenant_slug:          tenant.slug,
        properties_updated:   0,
        properties_delisted:  0,
        avg_freshness_before: 0,
        avg_freshness_after:  0,
        duration_ms:          Date.now() - tenantStart,
        error:                msg,
      })
    }
  }

  const finishedAt = new Date().toISOString()
  const totalDurationMs = new Date(finishedAt).getTime() - new Date(startedAt).getTime()

  // ── Emit cron completion event ────────────────────────────────────────────────
  void (supabaseAdmin as any).from('runtime_events').insert({
    org_id:  tenantList[0]?.id ?? '00000000-0000-0000-0000-000000000001',
    type:    'cron.ingestion_decay.completed',
    status:  'completed',
    payload: {
      started_at:          startedAt,
      finished_at:         finishedAt,
      total_duration_ms:   totalDurationMs,
      tenants_processed:   tenantList.length,
      total_updated:       totalUpdated,
      total_delisted:      totalDelisted,
    },
    correlation_id: `decay-${startedAt}`,
    event_timestamp: finishedAt,
  })

  console.log(
    `[ingestion-decay] Done — tenants=${tenantList.length} updated=${totalUpdated} ` +
    `delisted=${totalDelisted} duration=${totalDurationMs}ms`,
  )

  return NextResponse.json({
    status:            'ok',
    started_at:        startedAt,
    finished_at:       finishedAt,
    total_duration_ms: totalDurationMs,
    tenants_processed: tenantList.length,
    total_updated:     totalUpdated,
    total_delisted:    totalDelisted,
    per_tenant:        results,
  })
}
