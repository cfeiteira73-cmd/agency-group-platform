// Agency Group — Network Effect Amplifier
// lib/expansion/networkEffectAmplifier.ts
// Measures and amplifies the self-reinforcing network effect:
//   more investors → more liquidity → better ROI → more capital → geographic expansion
// CORE MOAT: the system that makes the platform harder to replicate over time.

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { getActiveExpansions } from '@/lib/expansion/expansionExecutionEngine'

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_TENANT_ID =
  process.env.DEFAULT_TENANT_ID ??
  process.env.SYSTEM_ORG_ID ??
  '00000000-0000-0000-0000-000000000001'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NetworkEffect {
  tenant_id: string
  measured_at: string
  investor_count: number
  avg_liquidity_score: number
  avg_roi_pct: number
  total_capital_deployed_eur_cents: number
  geographic_coverage: number
  network_effect_score: number
  network_effect_stage: 'SPARK' | 'IGNITION' | 'MOMENTUM' | 'FLYWHEEL' | 'COMPOUNDING'
  liquidity_per_investor: number
  capital_per_asset: number
  roi_improvement_trend: number
  virtuous_cycle_active: boolean
}

export interface NetworkEffectReport {
  tenant_id: string
  generated_at: string
  current: NetworkEffect
  history_30d: Array<{ date: string; score: number }>
  growth_rate_pct: number
  moat_strength: 'NASCENT' | 'DEVELOPING' | 'STRONG' | 'UNASSAILABLE'
  key_drivers: string[]
  amplification_recommendations: string[]
}

// ─── _computeStage ───────────────────────────────────────────────────────────

function _computeStage(score: number): NetworkEffect['network_effect_stage'] {
  if (score < 20) return 'SPARK'
  if (score < 40) return 'IGNITION'
  if (score < 60) return 'MOMENTUM'
  if (score < 80) return 'FLYWHEEL'
  return 'COMPOUNDING'
}

// ─── measureNetworkEffect ─────────────────────────────────────────────────────

export async function measureNetworkEffect(
  tenantId: string,
): Promise<NetworkEffect> {
  const now = new Date().toISOString()
  const date180dAgo = new Date(Date.now() - 180 * 24 * 3600 * 1000).toISOString()
  const date30dAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()

  // Fetch all data in parallel
  const [
    kycResult,
    liqResult,
    roiResult,
    roiPrev30dResult,
    ledgerResult,
    geoResult,
    assetResult,
    liqPrev30dResult,
  ] = await Promise.all([
    // investor_count
    (supabaseAdmin as any)
      .from('investor_kyc_records')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId),
    // avg_liquidity_score
    (supabaseAdmin as any)
      .from('asset_liquidity_scores')
      .select('score')
      .eq('tenant_id', tenantId)
      .order('scored_at', { ascending: false })
      .limit(100),
    // avg_roi_pct last 180d
    (supabaseAdmin as any)
      .from('execution_outcomes')
      .select('roi_pct')
      .eq('tenant_id', tenantId)
      .gte('closed_at', date180dAgo),
    // roi last 30d for trend
    (supabaseAdmin as any)
      .from('execution_outcomes')
      .select('roi_pct')
      .eq('tenant_id', tenantId)
      .gte('closed_at', date30dAgo),
    // total_capital_deployed
    (supabaseAdmin as any)
      .from('investor_ledger_entries')
      .select('amount_eur_cents')
      .eq('tenant_id', tenantId)
      .eq('entry_type', 'EXECUTED'),
    // geographic_coverage — count distinct countries
    (supabaseAdmin as any)
      .from('market_intelligence_snapshots')
      .select('country')
      .eq('tenant_id', tenantId),
    // capital_per_asset — count assets
    (supabaseAdmin as any)
      .from('asset_liquidity_scores')
      .select('asset_id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId),
    // liquidity 30d ago for trend
    (supabaseAdmin as any)
      .from('asset_liquidity_scores')
      .select('score')
      .eq('tenant_id', tenantId)
      .lte('scored_at', date30dAgo)
      .order('scored_at', { ascending: false })
      .limit(100),
  ])

  // investor_count
  const investor_count = Number(kycResult.count ?? 0)

  // avg_liquidity_score
  const liqScores = ((liqResult.data ?? []) as Array<{ score: number }>).map((r) =>
    Number(r.score ?? 0),
  )
  const avg_liquidity_score =
    liqScores.length > 0
      ? liqScores.reduce((sum, s) => sum + s, 0) / liqScores.length
      : 0

  // avg_roi_pct (180d)
  const roiRows = ((roiResult.data ?? []) as Array<{ roi_pct: number }>).map((r) =>
    Number(r.roi_pct ?? 0),
  )
  const avg_roi_pct =
    roiRows.length > 0
      ? roiRows.reduce((sum, r) => sum + r, 0) / roiRows.length
      : 0

  // roi_improvement_trend: compare last 30d avg ROI vs 180d avg
  const roi30dRows = ((roiPrev30dResult.data ?? []) as Array<{ roi_pct: number }>).map((r) =>
    Number(r.roi_pct ?? 0),
  )
  const avg_roi_30d =
    roi30dRows.length > 0
      ? roi30dRows.reduce((sum, r) => sum + r, 0) / roi30dRows.length
      : 0
  const roi_improvement_trend = avg_roi_30d - avg_roi_pct

  // total_capital_deployed
  const total_capital_deployed_eur_cents = (
    (ledgerResult.data ?? []) as Array<{ amount_eur_cents: number }>
  ).reduce((sum, r) => sum + Number(r.amount_eur_cents ?? 0), 0)

  // geographic_coverage — distinct countries
  const countrySet = new Set<string>(
    ((geoResult.data ?? []) as Array<{ country: string }>)
      .map((r) => r.country)
      .filter(Boolean),
  )
  const geographic_coverage = countrySet.size

  // liquidity_per_investor
  const liquidity_per_investor =
    investor_count > 0 ? avg_liquidity_score / investor_count : 0

  // capital_per_asset
  const asset_count = Number(assetResult.count ?? 1)
  const capital_per_asset =
    asset_count > 0 ? Math.round(total_capital_deployed_eur_cents / asset_count) : 0

  // liquidity trend (compare current avg vs 30d ago avg)
  const liqPrev30dScores = ((liqPrev30dResult.data ?? []) as Array<{ score: number }>).map((r) =>
    Number(r.score ?? 0),
  )
  const avg_liq_prev30d =
    liqPrev30dScores.length > 0
      ? liqPrev30dScores.reduce((sum, s) => sum + s, 0) / liqPrev30dScores.length
      : 0
  const liq_trend = avg_liquidity_score - avg_liq_prev30d

  // network_effect_score
  const network_effect_score =
    investor_count * 0.3 +
    avg_liquidity_score * 0.25 +
    Math.min(100, avg_roi_pct * 5) * 0.25 +
    geographic_coverage * 5 * 0.2

  const network_effect_stage = _computeStage(network_effect_score)

  // virtuous_cycle_active
  const virtuous_cycle_active = roi_improvement_trend > 0 && liq_trend > 0

  const effect: NetworkEffect = {
    tenant_id: tenantId,
    measured_at: now,
    investor_count,
    avg_liquidity_score,
    avg_roi_pct,
    total_capital_deployed_eur_cents,
    geographic_coverage,
    network_effect_score,
    network_effect_stage,
    liquidity_per_investor,
    capital_per_asset,
    roi_improvement_trend,
    virtuous_cycle_active,
  }

  // Persist to network_effect_snapshots
  void (supabaseAdmin as any)
    .from('network_effect_snapshots')
    .insert({
      tenant_id: tenantId,
      measured_at: now,
      investor_count,
      avg_liquidity_score,
      avg_roi_pct,
      total_capital_deployed_eur_cents,
      geographic_coverage,
      network_effect_score,
      network_effect_stage,
      virtuous_cycle_active,
    })
    .catch((e: unknown) =>
      log.warn('[networkEffectAmplifier] persist snapshot failed', { error: String(e) }),
    )

  log.info('[networkEffectAmplifier] network effect measured', {
    tenant_id: tenantId,
    score: network_effect_score,
    stage: network_effect_stage,
    investor_count,
    virtuous_cycle_active,
  })

  return effect
}

// ─── generateNetworkEffectReport ─────────────────────────────────────────────

export async function generateNetworkEffectReport(
  tenantId: string,
): Promise<NetworkEffectReport> {
  const generated_at = new Date().toISOString()

  // Measure current state
  const current = await measureNetworkEffect(tenantId)

  // Read last 30 snapshots for history
  const { data: snapRows } = await (supabaseAdmin as any)
    .from('network_effect_snapshots')
    .select('measured_at, network_effect_score')
    .eq('tenant_id', tenantId)
    .order('measured_at', { ascending: false })
    .limit(30)

  const history_30d: Array<{ date: string; score: number }> = (
    (snapRows ?? []) as Array<{ measured_at: string; network_effect_score: number }>
  ).map((r) => ({
    date: r.measured_at,
    score: Number(r.network_effect_score ?? 0),
  }))

  // growth_rate — compare to oldest score in history (proxy for 30d ago)
  const oldest_score = history_30d[history_30d.length - 1]?.score ?? current.network_effect_score
  const growth_rate_pct =
    oldest_score > 0
      ? ((current.network_effect_score - oldest_score) / oldest_score) * 100
      : 0

  // moat_strength
  const moatMap: Record<NetworkEffect['network_effect_stage'], NetworkEffectReport['moat_strength']> = {
    COMPOUNDING: 'UNASSAILABLE',
    FLYWHEEL: 'STRONG',
    MOMENTUM: 'DEVELOPING',
    IGNITION: 'NASCENT',
    SPARK: 'NASCENT',
  }
  const moat_strength = moatMap[current.network_effect_stage]

  // key_drivers
  const key_drivers: string[] = []
  if (current.investor_count > 0) {
    key_drivers.push(`${current.investor_count} active investors providing liquidity depth`)
  }
  if (current.avg_roi_pct > 0) {
    key_drivers.push(`${current.avg_roi_pct.toFixed(1)}% average ROI attracting capital`)
  }
  if (current.geographic_coverage > 0) {
    key_drivers.push(`${current.geographic_coverage} market(s) providing diversification`)
  }
  if (current.virtuous_cycle_active) {
    key_drivers.push('Virtuous cycle active: ROI + liquidity trends positive')
  }

  // amplification_recommendations
  const amplification_recommendations: string[] = []
  if (current.investor_count < 20) {
    amplification_recommendations.push(
      'Focus on investor acquisition to trigger network effects — target 20 active investors to reach IGNITION stage',
    )
  }
  if (current.avg_liquidity_score < 40) {
    amplification_recommendations.push(
      'Improve asset liquidity scoring — list more liquid assets to attract institutional capital',
    )
  }
  if (current.avg_roi_pct < 8) {
    amplification_recommendations.push(
      'Curate higher-yield assets to improve average ROI above 8% — ROI is the primary flywheel trigger',
    )
  }
  if (current.geographic_coverage < 3) {
    amplification_recommendations.push(
      'Expand to at least 3 markets to diversify capital flows and strengthen network moat',
    )
  }
  if (!current.virtuous_cycle_active) {
    amplification_recommendations.push(
      'Activate virtuous cycle: improve both liquidity and ROI trends simultaneously',
    )
  }

  const report: NetworkEffectReport = {
    tenant_id: tenantId,
    generated_at,
    current,
    history_30d,
    growth_rate_pct,
    moat_strength,
    key_drivers,
    amplification_recommendations,
  }

  // Persist to network_effect_reports
  void (supabaseAdmin as any)
    .from('network_effect_reports')
    .insert({
      tenant_id: tenantId,
      generated_at,
      growth_rate_pct,
      moat_strength,
      key_drivers,
      amplification_recommendations,
      history_30d,
    })
    .catch((e: unknown) =>
      log.warn('[networkEffectAmplifier] persist report failed', { error: String(e) }),
    )

  log.info('[networkEffectAmplifier] network effect report generated', {
    tenant_id: tenantId,
    moat_strength,
    growth_rate_pct,
    stage: current.network_effect_stage,
  })

  return report
}

// ─── getAmplificationActions ──────────────────────────────────────────────────

export async function getAmplificationActions(
  tenantId: string,
): Promise<
  Array<{
    action: string
    expected_network_score_gain: number
    priority: 'IMMEDIATE' | 'SHORT_TERM' | 'LONG_TERM'
  }>
> {
  const [current, expansions] = await Promise.all([
    measureNetworkEffect(tenantId),
    getActiveExpansions(tenantId),
  ])

  const actions: Array<{
    action: string
    expected_network_score_gain: number
    priority: 'IMMEDIATE' | 'SHORT_TERM' | 'LONG_TERM'
  }> = []

  // Action 1: Investor acquisition if count is low
  if (current.investor_count < 10) {
    actions.push({
      action: `Launch targeted acquisition campaign for ${10 - current.investor_count} more investors — each investor adds ~0.3 points to network score`,
      expected_network_score_gain: (10 - current.investor_count) * 0.3,
      priority: 'IMMEDIATE',
    })
  }

  // Action 2: Liquidity improvement
  if (current.avg_liquidity_score < 50) {
    actions.push({
      action: `Improve asset liquidity scoring from ${current.avg_liquidity_score.toFixed(1)} to 50 — onboard higher-velocity assets`,
      expected_network_score_gain: (50 - current.avg_liquidity_score) * 0.25,
      priority: 'IMMEDIATE',
    })
  }

  // Action 3: ROI improvement
  if (current.avg_roi_pct < 10) {
    const roiGain = Math.min(100, 10 * 5) - Math.min(100, current.avg_roi_pct * 5)
    actions.push({
      action: `Curate portfolio to push average ROI from ${current.avg_roi_pct.toFixed(1)}% to 10% — ROI multiplier capped at 100`,
      expected_network_score_gain: roiGain * 0.25,
      priority: 'SHORT_TERM',
    })
  }

  // Action 4: Geographic expansion
  if (current.geographic_coverage < 5 && expansions.length === 0) {
    actions.push({
      action: `Launch expansion plans in 2 new markets — each market adds up to 1 geographic coverage point (×5×0.2 = 1 score point)`,
      expected_network_score_gain: 2 * 5 * 0.2,
      priority: 'SHORT_TERM',
    })
  }

  // Action 5: Activate virtuous cycle
  if (!current.virtuous_cycle_active) {
    actions.push({
      action: `Activate virtuous cycle by aligning ROI improvement trend (${current.roi_improvement_trend.toFixed(2)}%) with liquidity growth — target positive trends on both axes`,
      expected_network_score_gain: 5,
      priority: 'LONG_TERM',
    })
  }

  // Sort by expected gain descending, return top 5
  actions.sort((a, b) => b.expected_network_score_gain - a.expected_network_score_gain)

  log.info('[networkEffectAmplifier] amplification actions computed', {
    tenant_id: tenantId,
    action_count: actions.length,
    stage: current.network_effect_stage,
  })

  return actions.slice(0, 5)
}

export { DEFAULT_TENANT_ID as NETWORK_DEFAULT_TENANT_ID }
