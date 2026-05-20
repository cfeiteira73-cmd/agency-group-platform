// =============================================================================
// Agency Group — KPI Snapshot Cron
// GET /api/cron/kpi-snapshot
// Scheduled daily at 23:55 UTC via vercel.json
// Computes & upserts daily KPIs into kpi_snapshots table
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cronCorrelationId } from '@/lib/observability/correlation'
import { withCronLock } from '@/lib/ops/withCronLock'
import { safeCompare } from '@/lib/safeCompare'

export const runtime = 'nodejs'
export const maxDuration = 60

// ---------------------------------------------------------------------------
// Auth — CRON_SECRET only (Vercel cron)
// ---------------------------------------------------------------------------

function authCheck(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false
  const incoming =
    req.headers.get('x-cron-secret') ??
    req.headers.get('authorization')?.replace('Bearer ', '')
  return !!incoming && safeCompare(incoming, cronSecret)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// countTable is called inside the GET handler where `supabase` is in scope
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function countTable(sb: any, table: string, filter?: Record<string, unknown>): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (sb as any).from(table).select('*', { count: 'exact', head: true })
  if (filter) {
    for (const [col, val] of Object.entries(filter)) {
      q = q.eq(col, val as string | number | boolean)
    }
  }
  const { count } = await q
  return count ?? 0
}

// ---------------------------------------------------------------------------
// GET /api/cron/kpi-snapshot
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!authCheck(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Guard env vars before creating client (prevents cold-start crash with non-null assertions)
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const lockResult = await withCronLock('kpi-snapshot', 3, async () => {
    const corrId = cronCorrelationId('kpi-snapshot')
    const tenantId = process.env.DEFAULT_TENANT_ID ?? 'agency-group'

    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    const snapshotDate = today.toISOString().split('T')[0] // 'YYYY-MM-DD'
    const startOfDay   = today.toISOString()

    try {
      // ── Lead metrics ──────────────────────────────────────────────────────────
      const [
        totalLeads,
        newLeadsToday,
        activeLeads,
        vipLeads,
      ] = await Promise.all([
        countTable(supabase, 'contacts', { tenant_id: tenantId }),
        supabase
          .from('contacts')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .gte('created_at', startOfDay)
          .then(({ count }) => count ?? 0),
        countTable(supabase, 'contacts', { tenant_id: tenantId, status: 'lead' }),
        countTable(supabase, 'contacts', { tenant_id: tenantId, status: 'vip' }),
      ])

      // Leads by status breakdown
      const { data: leadsByStatusRaw } = await supabase
        .from('contacts')
        .select('status')
        .eq('tenant_id', tenantId)

      const leadsByStatus: Record<string, number> = {}
      for (const row of leadsByStatusRaw ?? []) {
        const s = (row as { status: string }).status ?? 'unknown'
        leadsByStatus[s] = (leadsByStatus[s] ?? 0) + 1
      }

      // ── Deal metrics ──────────────────────────────────────────────────────────
      // REVENUE FIX: pipeline_value must only include ACTIVE (non-closed) deals.
      // Previously summed ALL deals — inflated pipeline as closed deals accumulated.
      // CLOSED_STAGES must match businessPrimitiveEngine.ts and revenueAttribution.ts.
      const CLOSED_STAGES = ['Escritura Concluída', 'Escritura', 'fechado', 'pos_venda', 'post_sale', 'Perdido', 'Rejeitado', 'escritura_sell']

      const { data: allDeals } = await supabase
        .from('deals')
        .select('fase, deal_value')
        .eq('tenant_id', tenantId)

      const totalDeals    = allDeals?.length ?? 0
      const activeDeals   = allDeals?.filter(d => !CLOSED_STAGES.includes((d as { fase: string }).fase ?? '')) ?? []
      const pipelineValue = activeDeals.reduce(
        (sum, d) => sum + (Number((d as { deal_value: string | number }).deal_value) || 0), 0
      )
      const avgDealValue  = activeDeals.length > 0 ? Math.round(pipelineValue / activeDeals.length) : 0

      const dealsByStage: Record<string, number> = {}
      for (const d of allDeals ?? []) {
        const fase = (d as { fase: string }).fase ?? 'unknown'
        dealsByStage[fase] = (dealsByStage[fase] ?? 0) + 1
      }

      // ── Property metrics ──────────────────────────────────────────────────────
      const [totalProperties, activeProperties] = await Promise.all([
        countTable(supabase, 'properties', { tenant_id: tenantId }),
        countTable(supabase, 'properties', { tenant_id: tenantId, status: 'active' }),
      ])

      // Exclusive + off-market
      let exclusiveProperties = 0
      let offMarketProperties = 0
      try {
        const { count: ex } = await supabase
          .from('properties')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('is_exclusive', true)
        const { count: om } = await supabase
          .from('properties')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('is_off_market', true)
        exclusiveProperties = ex ?? 0
        offMarketProperties = om ?? 0
      } catch { /* columns may not exist yet */ }

      // ── Match metrics ─────────────────────────────────────────────────────────
      let totalMatches = 0
      let matchesToday = 0
      let interestedMatches = 0
      let avgMatchScore: number | null = null

      try {
        const { data: allMatches } = await supabase
          .from('matches')
          .select('match_score, status, created_at')
          .eq('tenant_id', tenantId)

        totalMatches = allMatches?.length ?? 0
        matchesToday = allMatches?.filter(
          (m) => new Date((m as { created_at: string }).created_at) >= today
        ).length ?? 0
        interestedMatches = allMatches?.filter(
          (m) => ['interested', 'visit_scheduled'].includes((m as { status: string }).status)
        ).length ?? 0

        if (totalMatches > 0) {
          const scoreSum = allMatches!.reduce(
            (s, m) => s + ((m as { match_score: number }).match_score ?? 0), 0
          )
          avgMatchScore = Math.round((scoreSum / totalMatches) * 100) / 100
        }
      } catch { /* matches table may not exist yet */ }

      // ── Campaign metrics ──────────────────────────────────────────────────────
      let campaignsSent = 0
      let emailsDelivered = 0

      try {
        const { data: sentCampaigns } = await supabase
          .from('campanhas')
          .select('sent_count, delivered_count')
          .eq('status', 'sent')
        // Note: campanhas table does not have tenant_id column yet

        campaignsSent    = sentCampaigns?.length ?? 0
        emailsDelivered  = sentCampaigns?.reduce(
          (s, c) => s + ((c as { delivered_count: number }).delivered_count ?? 0), 0
        ) ?? 0
      } catch { /* campanhas table may not exist yet */ }

      // ── Deal Pack metrics ─────────────────────────────────────────────────────
      let dealPacksGenerated = 0
      let dealPacksSent = 0
      let dealPacksViewed = 0

      try {
        const [gen, sent, viewed] = await Promise.all([
          countTable(supabase, 'deal_packs', { tenant_id: tenantId }),
          countTable(supabase, 'deal_packs', { tenant_id: tenantId, status: 'sent' }),
          countTable(supabase, 'deal_packs', { tenant_id: tenantId, status: 'viewed' }),
        ])
        dealPacksGenerated = gen
        dealPacksSent      = sent
        dealPacksViewed    = viewed
      } catch { /* deal_packs table may not exist yet */ }

      // ── Upsert snapshot ───────────────────────────────────────────────────────
      const snapshot = {
        snapshot_date:        snapshotDate,
        total_leads:          totalLeads,
        new_leads_today:      newLeadsToday,
        active_leads:         activeLeads,
        vip_leads:            vipLeads,
        leads_by_status:      leadsByStatus,
        total_deals:          totalDeals,
        deals_by_stage:       dealsByStage,
        pipeline_value:       pipelineValue,
        avg_deal_value:       avgDealValue,
        total_properties:     totalProperties,
        active_properties:    activeProperties,
        exclusive_properties: exclusiveProperties,
        off_market_properties: offMarketProperties,
        total_matches:        totalMatches,
        matches_today:        matchesToday,
        interested_matches:   interestedMatches,
        avg_match_score:      avgMatchScore,
        campaigns_sent:       campaignsSent,
        emails_delivered:     emailsDelivered,
        deal_packs_generated: dealPacksGenerated,
        deal_packs_sent:      dealPacksSent,
        deal_packs_viewed:    dealPacksViewed,
        raw_data: {
          leadsByStatus,
          dealsByStage,
          computed_at: new Date().toISOString(),
        },
      }

      const { error: upsertError } = await supabase
        .from('kpi_snapshots')
        .upsert(snapshot, { onConflict: 'snapshot_date' })

      if (upsertError) {
        console.error('[kpi-snapshot] Upsert error:', upsertError)
        return NextResponse.json({ error: upsertError.message }, { status: 500 })
      }

      const res = NextResponse.json({
        success:        true,
        snapshot_date:  snapshotDate,
        summary: {
          total_leads:          totalLeads,
          total_deals:          totalDeals,
          pipeline_value:       `€${Math.round(pipelineValue / 1000)}K`,
          total_properties:     totalProperties,
          total_matches:        totalMatches,
          campaigns_sent:       campaignsSent,
          deal_packs_generated: dealPacksGenerated,
        },
        correlation_id: corrId,
      })
      res.headers.set('x-correlation-id', corrId)
      return res

    } catch (err) {
      console.error('[kpi-snapshot] Unexpected error:', err)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  })

  if (lockResult === null) {
    return NextResponse.json({ skipped: true, reason: 'already_running' }, { status: 200 })
  }
  return lockResult
}
