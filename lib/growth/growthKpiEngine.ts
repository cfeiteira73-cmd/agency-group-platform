// Agency Group — Growth KPI Engine
// lib/growth/growthKpiEngine.ts
// Real-time KPIs for the growth layer:
//   capital acquired per channel
//   ROI per campaign
//   CAC vs LTV per segment
//   liquidity impact per marketing action
//   conversion rate weighted by capital

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

export const runtime = 'nodejs'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GrowthKPIs {
  tenant_id: string
  computed_at: string
  window_days: number
  capital_acquired_by_channel: Record<string, number>
  roi_by_campaign: Array<{
    campaign_id: string
    roi_multiple: number
    capital_eur_cents: number
  }>
  cac_vs_ltv: Array<{
    segment: string
    cac_eur_cents: number
    ltv_eur_cents: number
    ltv_cac_ratio: number
  }>
  liquidity_impact_by_action: Array<{
    action_type: string
    liquidity_delta: number
    assets_affected: number
  }>
  capital_weighted_conversion_rate: number
  overall_growth_score: number
  growth_velocity: 'HYPERGROWTH' | 'GROWTH' | 'STABLE' | 'DECLINING'
}

// ─── computeGrowthKPIs ────────────────────────────────────────────────────────

/**
 * Computes all Growth KPIs for the tenant within windowDays.
 * Reads from multiple attribution/capital tables. Persists to growth_kpi_snapshots.
 */
export async function computeGrowthKPIs(
  tenantId: string,
  windowDays = 30,
): Promise<GrowthKPIs> {
  const since = new Date(Date.now() - windowDays * 86_400_000).toISOString()
  const computedAt = new Date().toISOString()

  // ── 1. capital_acquired_by_channel ──────────────────────────────────────────
  let capital_acquired_by_channel: Record<string, number> = {}

  // Try channel_attribution_summaries first (precomputed)
  const { data: summaryData } = await (supabaseAdmin as any)
    .from('channel_attribution_summaries')
    .select('channel, total_attributed_capital_eur_cents')
    .eq('tenant_id', tenantId)
    .gte('computed_at', since)
    .order('computed_at', { ascending: false })

  if (summaryData && (summaryData as Array<unknown>).length > 0) {
    for (const row of (summaryData as Array<{ channel: string; total_attributed_capital_eur_cents: number }>)) {
      capital_acquired_by_channel[row.channel] =
        (capital_acquired_by_channel[row.channel] ?? 0) + row.total_attributed_capital_eur_cents
    }
  } else {
    // Fallback: compute from attribution_touchpoints + investor_ledger_entries
    const { data: tpData } = await (supabaseAdmin as any)
      .from('attribution_touchpoints')
      .select('investor_id, channel')
      .eq('tenant_id', tenantId)
      .gte('occurred_at', since)

    if (tpData) {
      const investorChannelMap = new Map<string, string>()
      for (const tp of (tpData as Array<{ investor_id: string; channel: string }>)) {
        if (!investorChannelMap.has(tp.investor_id)) {
          investorChannelMap.set(tp.investor_id, tp.channel)
        }
      }

      for (const [investorId, channel] of investorChannelMap) {
        const { data: ledger } = await (supabaseAdmin as any)
          .from('investor_ledger_entries')
          .select('amount_eur_cents')
          .eq('tenant_id', tenantId)
          .eq('investor_id', investorId)

        const capital = ((ledger ?? []) as Array<{ amount_eur_cents: number }>)
          .filter(e => e.amount_eur_cents > 0)
          .reduce((sum, e) => sum + e.amount_eur_cents, 0)

        capital_acquired_by_channel[channel] =
          (capital_acquired_by_channel[channel] ?? 0) + capital
      }
    }
  }

  // ── 2. roi_by_campaign ──────────────────────────────────────────────────────
  const { data: roiData } = await (supabaseAdmin as any)
    .from('campaign_roi_results')
    .select('campaign_id, roi_multiple, capital_generated_eur_cents, computed_at')
    .eq('tenant_id', tenantId)
    .gte('computed_at', since)
    .order('computed_at', { ascending: false })

  const roi_by_campaign: GrowthKPIs['roi_by_campaign'] = (
    (roiData ?? []) as Array<{
      campaign_id: string
      roi_multiple: string | number
      capital_generated_eur_cents: number
    }>
  ).map(r => ({
    campaign_id: r.campaign_id,
    roi_multiple: Number(r.roi_multiple),
    capital_eur_cents: r.capital_generated_eur_cents,
  }))

  // ── 3. cac_vs_ltv ───────────────────────────────────────────────────────────
  // Join cac_metrics + ltv_metrics; segment from investor_segment_profiles
  const { data: cacData } = await (supabaseAdmin as any)
    .from('cac_metrics')
    .select('channel_breakdown, cac_eur_cents')
    .eq('tenant_id', tenantId)
    .order('computed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: ltvData } = await (supabaseAdmin as any)
    .from('ltv_metrics')
    .select('investor_id, ltv_eur_cents')
    .eq('tenant_id', tenantId)
    .order('ltv_eur_cents', { ascending: false })
    .limit(100)

  // Enrich with segment
  const investorIds = ((ltvData ?? []) as Array<{ investor_id: string }>)
    .map(r => r.investor_id)

  const segmentMap = new Map<string, string>()
  if (investorIds.length > 0) {
    const { data: segData } = await (supabaseAdmin as any)
      .from('investor_segment_profiles')
      .select('investor_id, segment')
      .eq('tenant_id', tenantId)
      .in('investor_id', investorIds)

    for (const s of ((segData ?? []) as Array<{ investor_id: string; segment: string }>)) {
      segmentMap.set(s.investor_id, s.segment)
    }
  }

  // Group LTV by segment
  const segmentLtv: Record<string, { total_ltv: number; count: number }> = {}
  for (const r of ((ltvData ?? []) as Array<{ investor_id: string; ltv_eur_cents: number }>)) {
    const seg = segmentMap.get(r.investor_id) ?? 'unknown'
    if (!segmentLtv[seg]) segmentLtv[seg] = { total_ltv: 0, count: 0 }
    segmentLtv[seg].total_ltv += r.ltv_eur_cents
    segmentLtv[seg].count++
  }

  const globalCac = (cacData as { cac_eur_cents?: number } | null)?.cac_eur_cents ?? 0

  const cac_vs_ltv: GrowthKPIs['cac_vs_ltv'] = Object.entries(segmentLtv).map(([segment, data]) => {
    const avg_ltv = data.count > 0 ? Math.round(data.total_ltv / data.count) : 0
    const ltv_cac_ratio = globalCac > 0
      ? parseFloat((avg_ltv / globalCac).toFixed(4))
      : 0
    return {
      segment,
      cac_eur_cents: globalCac,
      ltv_eur_cents: avg_ltv,
      ltv_cac_ratio,
    }
  })

  // ── 4. liquidity_impact_by_action ────────────────────────────────────────────
  // For each campaign, compute delta in asset_liquidity_scores before/after campaign period
  const { data: campaignData } = await (supabaseAdmin as any)
    .from('campaign_costs')
    .select('campaign_id, channel, period_start, period_end')
    .eq('tenant_id', tenantId)
    .gte('period_start', since)
    .limit(20)

  const liquidity_impact_by_action: GrowthKPIs['liquidity_impact_by_action'] = []

  for (const campaign of ((campaignData ?? []) as Array<{
    campaign_id: string
    channel: string
    period_start: string
    period_end: string
  }>)) {
    // Average score before campaign start
    const { data: beforeScores } = await (supabaseAdmin as any)
      .from('asset_liquidity_scores')
      .select('score')
      .eq('tenant_id', tenantId)
      .lt('computed_at', campaign.period_start)
      .order('computed_at', { ascending: false })
      .limit(20)

    // Average score after campaign end
    const { data: afterScores } = await (supabaseAdmin as any)
      .from('asset_liquidity_scores')
      .select('score')
      .eq('tenant_id', tenantId)
      .gt('computed_at', campaign.period_end)
      .order('computed_at', { ascending: true })
      .limit(20)

    const avg = (arr: Array<{ score: number | null }>) => {
      const valid = arr.filter(r => r.score !== null)
      return valid.length > 0
        ? valid.reduce((s, r) => s + (r.score ?? 0), 0) / valid.length
        : 0
    }

    const beforeAvg = avg((beforeScores ?? []) as Array<{ score: number | null }>)
    const afterAvg = avg((afterScores ?? []) as Array<{ score: number | null }>)
    const delta = parseFloat((afterAvg - beforeAvg).toFixed(4))

    liquidity_impact_by_action.push({
      action_type: `campaign:${campaign.channel}`,
      liquidity_delta: delta,
      assets_affected: ((afterScores ?? []) as Array<unknown>).length,
    })
  }

  // ── 5. capital_weighted_conversion_rate ──────────────────────────────────────
  // = sum(capital × converted) / sum(capital × total) from attribution_touchpoints
  const { data: cwData } = await (supabaseAdmin as any)
    .from('attribution_touchpoints')
    .select('investor_id, metadata')
    .eq('tenant_id', tenantId)
    .gte('occurred_at', since)

  let cwNumerator = 0
  let cwDenominator = 0

  for (const tp of ((cwData ?? []) as Array<{ investor_id: string; metadata: Record<string, unknown> | null }>)) {
    const meta = tp.metadata ?? {}
    const capital = typeof meta.eur_cents_value === 'number' ? meta.eur_cents_value : 1
    const converted = meta.converted === true ? 1 : 0
    cwNumerator += capital * converted
    cwDenominator += capital
  }

  const capital_weighted_conversion_rate = cwDenominator > 0
    ? parseFloat((cwNumerator / cwDenominator).toFixed(4))
    : 0

  // ── 6. overall_growth_score ──────────────────────────────────────────────────
  // Weighted: channel_diversity×0.2 + roi_multiple×0.3 + ltv_cac_ratio×0.3 + conversion_rate×0.2

  const channelCount = Object.keys(capital_acquired_by_channel).length
  const channel_diversity_score = Math.min(100, channelCount * 10) // 10 pts per unique channel, cap 100

  const avgRoiMultiple = roi_by_campaign.length > 0
    ? roi_by_campaign.reduce((s, r) => s + r.roi_multiple, 0) / roi_by_campaign.length
    : 0
  const roi_score = Math.min(100, avgRoiMultiple * 20) // 1× ROI = 20 pts

  const avgLtvCacRatio = cac_vs_ltv.length > 0
    ? cac_vs_ltv.reduce((s, c) => s + c.ltv_cac_ratio, 0) / cac_vs_ltv.length
    : 0
  const ltv_cac_score = Math.min(100, avgLtvCacRatio * 10) // 10× LTV:CAC = 100 pts

  const conversion_score = Math.min(100, capital_weighted_conversion_rate * 100)

  const overall_growth_score = parseFloat(
    (
      channel_diversity_score * 0.2 +
      roi_score * 0.3 +
      ltv_cac_score * 0.3 +
      conversion_score * 0.2
    ).toFixed(2),
  )

  // ── 7. growth_velocity ───────────────────────────────────────────────────────
  let growth_velocity: GrowthKPIs['growth_velocity']
  if (overall_growth_score > 80) growth_velocity = 'HYPERGROWTH'
  else if (overall_growth_score > 60) growth_velocity = 'GROWTH'
  else if (overall_growth_score > 40) growth_velocity = 'STABLE'
  else growth_velocity = 'DECLINING'

  const kpis: GrowthKPIs = {
    tenant_id: tenantId,
    computed_at: computedAt,
    window_days: windowDays,
    capital_acquired_by_channel,
    roi_by_campaign,
    cac_vs_ltv,
    liquidity_impact_by_action,
    capital_weighted_conversion_rate,
    overall_growth_score,
    growth_velocity,
  }

  // Persist to growth_kpi_snapshots
  void (supabaseAdmin as any)
    .from('growth_kpi_snapshots')
    .insert({
      tenant_id: tenantId,
      computed_at: computedAt,
      window_days: windowDays,
      capital_acquired_by_channel,
      roi_by_campaign,
      cac_vs_ltv,
      capital_weighted_conversion_rate,
      overall_growth_score,
      growth_velocity,
    })
    .catch((e: unknown) => console.warn('[growthKpiEngine] persist growth_kpi_snapshots', e))

  log.info('[growthKpiEngine] computeGrowthKPIs', {
    tenant_id: tenantId,
    windowDays,
    overall_growth_score,
    growth_velocity,
    channels: channelCount,
  })

  return kpis
}

// ─── getGrowthTrend ───────────────────────────────────────────────────────────

/**
 * Returns the last N growth KPI snapshots as a trend.
 */
export async function getGrowthTrend(
  tenantId: string,
  periods = 12,
): Promise<Array<{
  period: string
  overall_growth_score: number
  capital_acquired_eur_cents: number
}>> {
  const { data, error } = await (supabaseAdmin as any)
    .from('growth_kpi_snapshots')
    .select('computed_at, overall_growth_score, capital_acquired_by_channel')
    .eq('tenant_id', tenantId)
    .order('computed_at', { ascending: false })
    .limit(periods)

  if (error) {
    log.warn('[growthKpiEngine] getGrowthTrend error', { error })
  }

  return ((data ?? []) as Array<{
    computed_at: string
    overall_growth_score: number | string
    capital_acquired_by_channel: Record<string, number> | null
  }>)
    .map(row => {
      const capitalMap = row.capital_acquired_by_channel ?? {}
      const totalCapital = Object.values(capitalMap).reduce((s, v) => s + v, 0)
      return {
        period: (row.computed_at as string).slice(0, 10),
        overall_growth_score: Number(row.overall_growth_score),
        capital_acquired_eur_cents: totalCapital,
      }
    })
    .reverse() // oldest first for trend display
}
