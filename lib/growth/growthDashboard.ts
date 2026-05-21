// Agency Group — Real-Time Growth Dashboard
// lib/growth/growthDashboard.ts
// Assembles all growth KPIs into a single dashboard payload.
// Capital-first: every metric measured in capital generated.

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CampaignRoiEntry {
  campaign_id: string
  name: string
  roi_multiple: number
}

export interface CacLtvSummary {
  avg_cac_eur_cents: number
  avg_ltv_eur_cents: number
  ltv_cac_ratio: number
}

export interface GrowthDashboard {
  tenant_id: string
  generated_at: string
  capital_acquired_today_eur_cents: number
  capital_acquired_30d_eur_cents: number
  roi_by_campaign: CampaignRoiEntry[]
  cac_vs_ltv_summary: CacLtvSummary
  liquidity_impact_last_action_eur: number
  capital_weighted_conversion_rate: number
  flywheel_velocity: string
  loop_status: string
  active_campaigns: number
  dormant_capital_eur_cents: number
  whale_count: number
  top_channel: string | null
  growth_score: number
  optimization_decisions_pending: number
  alerts: string[]
}

// ─── buildGrowthDashboard ─────────────────────────────────────────────────────

/**
 * Assembles all growth KPIs from multiple tables.
 * Graceful fallback for missing data. Persists snapshot.
 */
export async function buildGrowthDashboard(tenantId: string): Promise<GrowthDashboard> {
  const generatedAt = new Date().toISOString()
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const todayStr = today.toISOString()
  const now30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // ── Capital acquired today ─────────────────────────────────────────────────
  let capital_acquired_today_eur_cents = 0
  try {
    const todayRes = await (supabaseAdmin as any)
      .from('investor_ledger_entries')
      .select('amount_eur_cents')
      .eq('tenant_id', tenantId)
      .eq('entry_type', 'DEPOSIT')
      .gte('created_at', todayStr)

    capital_acquired_today_eur_cents = (
      (todayRes.data ?? []) as Array<{ amount_eur_cents: number }>
    ).reduce((s, r) => s + (r.amount_eur_cents ?? 0), 0)
  } catch {
    // no data
  }

  // ── Capital acquired last 30d ──────────────────────────────────────────────
  let capital_acquired_30d_eur_cents = 0
  try {
    const thirtyRes = await (supabaseAdmin as any)
      .from('investor_ledger_entries')
      .select('amount_eur_cents')
      .eq('tenant_id', tenantId)
      .eq('entry_type', 'DEPOSIT')
      .gte('created_at', now30d)

    capital_acquired_30d_eur_cents = (
      (thirtyRes.data ?? []) as Array<{ amount_eur_cents: number }>
    ).reduce((s, r) => s + (r.amount_eur_cents ?? 0), 0)
  } catch {
    // no data
  }

  // ── ROI by campaign (top 5) ────────────────────────────────────────────────
  let roi_by_campaign: CampaignRoiEntry[] = []
  try {
    const roiRes = await (supabaseAdmin as any)
      .from('campaign_roi_results')
      .select('campaign_id, campaign_name, roi_multiple')
      .eq('tenant_id', tenantId)
      .order('roi_multiple', { ascending: false })
      .limit(5)

    roi_by_campaign = (
      (roiRes.data ?? []) as Array<{
        campaign_id: string
        campaign_name: string
        roi_multiple: number
      }>
    ).map((r) => ({
      campaign_id: r.campaign_id,
      name: r.campaign_name ?? r.campaign_id,
      roi_multiple: r.roi_multiple ?? 0,
    }))
  } catch {
    // no roi data
  }

  // ── CAC vs LTV ─────────────────────────────────────────────────────────────
  let avg_cac_eur_cents = 0
  let avg_ltv_eur_cents = 0
  try {
    const cacRes = await (supabaseAdmin as any)
      .from('cac_metrics')
      .select('cac_eur_cents')
      .eq('tenant_id', tenantId)
      .order('recorded_at', { ascending: false })
      .limit(30)

    const cacRows: Array<{ cac_eur_cents: number }> =
      (cacRes.data ?? []) as Array<{ cac_eur_cents: number }>
    avg_cac_eur_cents =
      cacRows.length > 0
        ? Math.round(cacRows.reduce((s, r) => s + (r.cac_eur_cents ?? 0), 0) / cacRows.length)
        : 0
  } catch {
    // no cac data
  }

  try {
    const ltvRes = await (supabaseAdmin as any)
      .from('ltv_metrics')
      .select('ltv_eur_cents')
      .eq('tenant_id', tenantId)
      .order('recorded_at', { ascending: false })
      .limit(30)

    const ltvRows: Array<{ ltv_eur_cents: number }> =
      (ltvRes.data ?? []) as Array<{ ltv_eur_cents: number }>
    avg_ltv_eur_cents =
      ltvRows.length > 0
        ? Math.round(ltvRows.reduce((s, r) => s + (r.ltv_eur_cents ?? 0), 0) / ltvRows.length)
        : 0
  } catch {
    // no ltv data
  }

  const ltv_cac_ratio =
    avg_cac_eur_cents > 0
      ? parseFloat((avg_ltv_eur_cents / avg_cac_eur_cents).toFixed(2))
      : 0

  // ── Liquidity impact last action ───────────────────────────────────────────
  let liquidity_impact_last_action_eur = 0
  try {
    const liqRes = await (supabaseAdmin as any)
      .from('asset_liquidity_scores')
      .select('liquidity_delta_eur')
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()

    liquidity_impact_last_action_eur =
      (liqRes.data as { liquidity_delta_eur?: number } | null)?.liquidity_delta_eur ?? 0
  } catch {
    // no data
  }

  // ── Capital-weighted conversion rate ──────────────────────────────────────
  let capital_weighted_conversion_rate = 0
  try {
    const kpiRes = await (supabaseAdmin as any)
      .from('growth_kpi_snapshots')
      .select('capital_weighted_conversion_rate')
      .eq('tenant_id', tenantId)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .single()

    capital_weighted_conversion_rate =
      (
        kpiRes.data as { capital_weighted_conversion_rate?: number } | null
      )?.capital_weighted_conversion_rate ?? 0
  } catch {
    // no snapshot
  }

  // ── Flywheel velocity + loop status ───────────────────────────────────────
  let flywheel_velocity = 'STABLE'
  let loop_status = 'STABLE'
  try {
    const loopRes = await (supabaseAdmin as any)
      .from('closed_loop_snapshots')
      .select('loop_status, loop_velocity_score')
      .eq('tenant_id', tenantId)
      .order('measured_at', { ascending: false })
      .limit(1)
      .single()

    const loopData = loopRes.data as {
      loop_status?: string
      loop_velocity_score?: number
    } | null

    if (loopData) {
      loop_status = loopData.loop_status ?? 'STABLE'
      const velocity = loopData.loop_velocity_score ?? 5
      if (velocity >= 8) flywheel_velocity = 'HYPERGROWTH'
      else if (velocity >= 6) flywheel_velocity = 'ACCELERATING'
      else if (velocity >= 4) flywheel_velocity = 'GROWING'
      else if (velocity >= 2) flywheel_velocity = 'SLOW'
      else flywheel_velocity = 'STALLED'
    }
  } catch {
    // no closed loop data yet
  }

  // ── Active campaigns ───────────────────────────────────────────────────────
  let active_campaigns = 0
  try {
    const campRes = await (supabaseAdmin as any)
      .from('campaigns')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'ACTIVE')

    active_campaigns = (campRes.count as number | null) ?? 0
  } catch {
    // no campaigns
  }

  // ── Dormant capital ────────────────────────────────────────────────────────
  let dormant_capital_eur_cents = 0
  try {
    const dormantRes = await (supabaseAdmin as any)
      .from('investor_segment_profiles')
      .select('capital_size_eur_cents')
      .eq('tenant_id', tenantId)
      .eq('segment', 'DORMANT_CAPITAL')

    dormant_capital_eur_cents = (
      (dormantRes.data ?? []) as Array<{ capital_size_eur_cents: number }>
    ).reduce((s, r) => s + (r.capital_size_eur_cents ?? 0), 0)
  } catch {
    // no profiles
  }

  // ── Whale count ────────────────────────────────────────────────────────────
  let whale_count = 0
  try {
    const whaleRes = await (supabaseAdmin as any)
      .from('investor_segment_profiles')
      .select('investor_id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('segment', 'WHALE')

    whale_count = (whaleRes.count as number | null) ?? 0
  } catch {
    // no profiles
  }

  // ── Top channel ───────────────────────────────────────────────────────────
  let top_channel: string | null = null
  try {
    const chanRes = await (supabaseAdmin as any)
      .from('channel_attribution_summaries')
      .select('channel')
      .eq('tenant_id', tenantId)
      .order('roi_multiple', { ascending: false })
      .limit(1)
      .single()

    top_channel = (chanRes.data as { channel?: string } | null)?.channel ?? null
  } catch {
    // no channel data
  }

  // ── Pending optimization decisions ────────────────────────────────────────
  let optimization_decisions_pending = 0
  try {
    const pendingRes = await (supabaseAdmin as any)
      .from('optimization_decisions')
      .select('decision_id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('executed', false)

    optimization_decisions_pending = (pendingRes.count as number | null) ?? 0
  } catch {
    // no decisions table yet
  }

  // ── Growth score (composite 0-100) ────────────────────────────────────────
  // Weighted: capital velocity 40%, loop health 30%, ltv/cac 20%, active campaigns 10%
  const loopWeight =
    loop_status === 'COMPOUNDING'
      ? 1
      : loop_status === 'GROWING'
        ? 0.75
        : loop_status === 'STABLE'
          ? 0.5
          : loop_status === 'BREAKING'
            ? 0.25
            : 0

  const capitalVelocityScore =
    capital_acquired_30d_eur_cents > 0
      ? Math.min(1, capital_acquired_today_eur_cents / (capital_acquired_30d_eur_cents / 30))
      : 0

  const ltvCacScore = ltv_cac_ratio >= 3 ? 1 : ltv_cac_ratio >= 1.5 ? 0.7 : ltv_cac_ratio > 0 ? 0.3 : 0
  const campaignScore = active_campaigns > 0 ? Math.min(1, active_campaigns / 5) : 0

  const growth_score = parseFloat(
    (
      capitalVelocityScore * 40 +
      loopWeight * 30 +
      ltvCacScore * 20 +
      campaignScore * 10
    ).toFixed(2),
  )

  // ── Alerts ────────────────────────────────────────────────────────────────
  const alerts: string[] = []

  if (dormant_capital_eur_cents > 100_000_000) {
    // > €1M
    alerts.push(
      `ALERT: €${(dormant_capital_eur_cents / 100).toLocaleString()} dormant capital detected. Launch reactivation campaign immediately.`,
    )
  }

  if (ltv_cac_ratio < 1 && (avg_cac_eur_cents > 0 || avg_ltv_eur_cents > 0)) {
    alerts.push(
      `ALERT: LTV/CAC ratio is ${ltv_cac_ratio.toFixed(2)} — below 1.0. Acquisition costs exceed investor lifetime value. Review channel allocation.`,
    )
  }

  if (loop_status === 'BREAKING' || loop_status === 'BROKEN') {
    alerts.push(
      `ALERT: Growth flywheel is ${loop_status}. Run /api/growth/optimize?mode=loop-health for diagnosis.`,
    )
  }

  if (active_campaigns === 0) {
    alerts.push(
      'ALERT: No active campaigns. Growth engine is idle — create at least one campaign to activate the flywheel.',
    )
  }

  const dashboard: GrowthDashboard = {
    tenant_id: tenantId,
    generated_at: generatedAt,
    capital_acquired_today_eur_cents,
    capital_acquired_30d_eur_cents,
    roi_by_campaign,
    cac_vs_ltv_summary: { avg_cac_eur_cents, avg_ltv_eur_cents, ltv_cac_ratio },
    liquidity_impact_last_action_eur,
    capital_weighted_conversion_rate,
    flywheel_velocity,
    loop_status,
    active_campaigns,
    dormant_capital_eur_cents,
    whale_count,
    top_channel,
    growth_score,
    optimization_decisions_pending,
    alerts,
  }

  // Persist snapshot
  void (supabaseAdmin as any)
    .from('growth_dashboard_snapshots')
    .insert({
      tenant_id: tenantId,
      generated_at: generatedAt,
      capital_acquired_today_eur_cents,
      capital_acquired_30d_eur_cents,
      active_campaigns,
      growth_score,
      loop_status,
      flywheel_velocity,
      alerts,
    })
    .then(
      ({ error }: { error: { message: string } | null }) =>
        error &&
        log.info('[growthDashboard] persist snapshot warning', {
          tenantId,
          error: error.message,
        }),
    )

  log.info('[growthDashboard] dashboard built', {
    tenantId,
    growth_score,
    loop_status,
    flywheel_velocity,
    active_campaigns,
    alerts_count: alerts.length,
  })

  return dashboard
}
