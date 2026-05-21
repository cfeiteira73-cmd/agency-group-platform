// Agency Group — Closed Loop Growth System
// lib/growth/closedLoopGrowth.ts
// The CORE MOAT: self-reinforcing growth flywheel.
// Marketing spend → Investor acquisition → Capital inflow → Liquidity increase
// → ROI improvement → Better targeting → Higher efficiency → Reinvestment
// Measures the closed loop health and identifies where the loop is breaking.

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type Trend = 'UP' | 'DOWN' | 'STABLE'
export type LoopStatus = 'COMPOUNDING' | 'GROWING' | 'STABLE' | 'BREAKING' | 'BROKEN'

export interface LoopStage {
  stage: string
  value: number
  unit: string
  trend: Trend
  bottleneck: boolean
  bottleneck_reason: string | null
}

export interface ClosedLoopHealth {
  tenant_id: string
  measured_at: string
  loop_efficiency_pct: number
  loop_velocity_score: number
  stages: LoopStage[]
  weakest_stage: string | null
  strongest_stage: string | null
  projected_loop_acceleration: number
  loop_status: LoopStatus
  recommendations: string[]
}

export interface ReinvestmentAllocation {
  channel: string
  amount_eur_cents: number
  expected_roi_multiple: number
  rationale: string
}

export interface ReinvestmentPlan {
  tenant_id: string
  generated_at: string
  total_revenue_eur_cents: number
  suggested_reinvestment_eur_cents: number
  reinvestment_pct: number
  allocation: ReinvestmentAllocation[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toTrend(current: number, previous: number): Trend {
  if (previous === 0) return current > 0 ? 'UP' : 'STABLE'
  const delta = (current - previous) / Math.abs(previous)
  if (delta > 0.02) return 'UP'
  if (delta < -0.02) return 'DOWN'
  return 'STABLE'
}

function loopStatusFromEfficiency(efficiencyPct: number): LoopStatus {
  if (efficiencyPct > 80) return 'COMPOUNDING'
  if (efficiencyPct > 60) return 'GROWING'
  if (efficiencyPct > 40) return 'STABLE'
  if (efficiencyPct > 20) return 'BREAKING'
  return 'BROKEN'
}

// ─── measureClosedLoop ────────────────────────────────────────────────────────

/**
 * Measures all 7 stages of the growth flywheel.
 * Persists snapshot to closed_loop_snapshots.
 */
export async function measureClosedLoop(tenantId: string): Promise<ClosedLoopHealth> {
  const measuredAt = new Date().toISOString()
  const now30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const now60d = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
  const stages: LoopStage[] = []

  // ── Stage 1: MARKETING_SPEND ───────────────────────────────────────────────
  let marketingSpendCurrent = 0
  let marketingSpendPrior = 0
  try {
    const spendCurr = await (supabaseAdmin as any)
      .from('campaign_costs')
      .select('spend_eur_cents')
      .eq('tenant_id', tenantId)
      .gte('recorded_at', now30d)

    marketingSpendCurrent = (
      (spendCurr.data ?? []) as Array<{ spend_eur_cents: number }>
    ).reduce((s, r) => s + (r.spend_eur_cents ?? 0), 0)

    const spendPrior = await (supabaseAdmin as any)
      .from('campaign_costs')
      .select('spend_eur_cents')
      .eq('tenant_id', tenantId)
      .gte('recorded_at', now60d)
      .lt('recorded_at', now30d)

    marketingSpendPrior = (
      (spendPrior.data ?? []) as Array<{ spend_eur_cents: number }>
    ).reduce((s, r) => s + (r.spend_eur_cents ?? 0), 0)
  } catch {
    // no campaign_costs data
  }
  stages.push({
    stage: 'MARKETING_SPEND',
    value: marketingSpendCurrent,
    unit: 'eur_cents',
    trend: toTrend(marketingSpendCurrent, marketingSpendPrior),
    bottleneck: false,
    bottleneck_reason: null,
  })

  // ── Stage 2: INVESTOR_ACQUISITION ─────────────────────────────────────────
  let acquisitionCurrent = 0
  let acquisitionPrior = 0
  try {
    const acqCurr = await (supabaseAdmin as any)
      .from('investor_segment_profiles')
      .select('investor_id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('computed_at', now30d)

    acquisitionCurrent = (acqCurr.count as number | null) ?? 0

    const acqPrior = await (supabaseAdmin as any)
      .from('investor_segment_profiles')
      .select('investor_id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('computed_at', now60d)
      .lt('computed_at', now30d)

    acquisitionPrior = (acqPrior.count as number | null) ?? 0
  } catch {
    // no profiles data
  }
  stages.push({
    stage: 'INVESTOR_ACQUISITION',
    value: acquisitionCurrent,
    unit: 'count',
    trend: toTrend(acquisitionCurrent, acquisitionPrior),
    bottleneck: false,
    bottleneck_reason: null,
  })

  // ── Stage 3: CAPITAL_INFLOW ────────────────────────────────────────────────
  let capitalInflowCurrent = 0
  let capitalInflowPrior = 0
  try {
    const inflowCurr = await (supabaseAdmin as any)
      .from('investor_ledger_entries')
      .select('amount_eur_cents')
      .eq('tenant_id', tenantId)
      .eq('entry_type', 'DEPOSIT')
      .gte('created_at', now30d)

    capitalInflowCurrent = (
      (inflowCurr.data ?? []) as Array<{ amount_eur_cents: number }>
    ).reduce((s, r) => s + (r.amount_eur_cents ?? 0), 0)

    const inflowPrior = await (supabaseAdmin as any)
      .from('investor_ledger_entries')
      .select('amount_eur_cents')
      .eq('tenant_id', tenantId)
      .eq('entry_type', 'DEPOSIT')
      .gte('created_at', now60d)
      .lt('created_at', now30d)

    capitalInflowPrior = (
      (inflowPrior.data ?? []) as Array<{ amount_eur_cents: number }>
    ).reduce((s, r) => s + (r.amount_eur_cents ?? 0), 0)
  } catch {
    // no ledger data
  }
  stages.push({
    stage: 'CAPITAL_INFLOW',
    value: capitalInflowCurrent,
    unit: 'eur_cents',
    trend: toTrend(capitalInflowCurrent, capitalInflowPrior),
    bottleneck: false,
    bottleneck_reason: null,
  })

  // ── Stage 4: LIQUIDITY_CREATION ───────────────────────────────────────────
  let liquidityCurrent = 0
  let liquidityPrior = 0
  try {
    const liqCurr = await (supabaseAdmin as any)
      .from('asset_liquidity_scores')
      .select('liquidity_score')
      .eq('tenant_id', tenantId)
      .gte('updated_at', now30d)

    const liqCurrRows: Array<{ liquidity_score: number }> =
      (liqCurr.data ?? []) as Array<{ liquidity_score: number }>
    liquidityCurrent =
      liqCurrRows.length > 0
        ? liqCurrRows.reduce((s, r) => s + (r.liquidity_score ?? 0), 0) / liqCurrRows.length
        : 0

    const liqPrior = await (supabaseAdmin as any)
      .from('asset_liquidity_scores')
      .select('liquidity_score')
      .eq('tenant_id', tenantId)
      .gte('updated_at', now60d)
      .lt('updated_at', now30d)

    const liqPriorRows: Array<{ liquidity_score: number }> =
      (liqPrior.data ?? []) as Array<{ liquidity_score: number }>
    liquidityPrior =
      liqPriorRows.length > 0
        ? liqPriorRows.reduce((s, r) => s + (r.liquidity_score ?? 0), 0) / liqPriorRows.length
        : 0
  } catch {
    // no liquidity data
  }
  stages.push({
    stage: 'LIQUIDITY_CREATION',
    value: liquidityCurrent,
    unit: 'avg_score',
    trend: toTrend(liquidityCurrent, liquidityPrior),
    bottleneck: false,
    bottleneck_reason: null,
  })

  // ── Stage 5: ROI_IMPROVEMENT ──────────────────────────────────────────────
  let roiCurrent = 0
  let roiPrior = 0
  try {
    const roiCurrRes = await (supabaseAdmin as any)
      .from('execution_outcomes')
      .select('reward_score')
      .eq('tenant_id', tenantId)
      .gte('created_at', now30d)

    const roiCurrRows: Array<{ reward_score: number }> =
      (roiCurrRes.data ?? []) as Array<{ reward_score: number }>
    roiCurrent =
      roiCurrRows.length > 0
        ? roiCurrRows.reduce((s, r) => s + (r.reward_score ?? 0), 0) / roiCurrRows.length
        : 0

    const roiPriorRes = await (supabaseAdmin as any)
      .from('execution_outcomes')
      .select('reward_score')
      .eq('tenant_id', tenantId)
      .gte('created_at', now60d)
      .lt('created_at', now30d)

    const roiPriorRows: Array<{ reward_score: number }> =
      (roiPriorRes.data ?? []) as Array<{ reward_score: number }>
    roiPrior =
      roiPriorRows.length > 0
        ? roiPriorRows.reduce((s, r) => s + (r.reward_score ?? 0), 0) / roiPriorRows.length
        : 0
  } catch {
    // no execution outcomes
  }
  stages.push({
    stage: 'ROI_IMPROVEMENT',
    value: roiCurrent,
    unit: 'avg_reward_score',
    trend: toTrend(roiCurrent, roiPrior),
    bottleneck: false,
    bottleneck_reason: null,
  })

  // ── Stage 6: TARGETING_EFFICIENCY ────────────────────────────────────────
  let targetingCurrent = 0
  let targetingPrior = 0
  try {
    const tgtCurr = await (supabaseAdmin as any)
      .from('channel_attribution_summaries')
      .select('conversion_rate_pct')
      .eq('tenant_id', tenantId)
      .gte('updated_at', now30d)

    const tgtCurrRows: Array<{ conversion_rate_pct: number }> =
      (tgtCurr.data ?? []) as Array<{ conversion_rate_pct: number }>
    targetingCurrent =
      tgtCurrRows.length > 0
        ? tgtCurrRows.reduce((s, r) => s + (r.conversion_rate_pct ?? 0), 0) / tgtCurrRows.length
        : 0

    const tgtPrior = await (supabaseAdmin as any)
      .from('channel_attribution_summaries')
      .select('conversion_rate_pct')
      .eq('tenant_id', tenantId)
      .gte('updated_at', now60d)
      .lt('updated_at', now30d)

    const tgtPriorRows: Array<{ conversion_rate_pct: number }> =
      (tgtPrior.data ?? []) as Array<{ conversion_rate_pct: number }>
    targetingPrior =
      tgtPriorRows.length > 0
        ? tgtPriorRows.reduce((s, r) => s + (r.conversion_rate_pct ?? 0), 0) / tgtPriorRows.length
        : 0
  } catch {
    // no channel data
  }
  stages.push({
    stage: 'TARGETING_EFFICIENCY',
    value: targetingCurrent,
    unit: 'avg_conversion_pct',
    trend: toTrend(targetingCurrent, targetingPrior),
    bottleneck: false,
    bottleneck_reason: null,
  })

  // ── Stage 7: EFFICIENCY_GAIN (CAC trend — lower is better) ────────────────
  let cacCurrent = 0
  let cacPrior = 0
  try {
    const cacCurrRes = await (supabaseAdmin as any)
      .from('cac_metrics')
      .select('cac_eur_cents')
      .eq('tenant_id', tenantId)
      .gte('recorded_at', now30d)

    const cacCurrRows: Array<{ cac_eur_cents: number }> =
      (cacCurrRes.data ?? []) as Array<{ cac_eur_cents: number }>
    cacCurrent =
      cacCurrRows.length > 0
        ? cacCurrRows.reduce((s, r) => s + (r.cac_eur_cents ?? 0), 0) / cacCurrRows.length
        : 0

    const cacPriorRes = await (supabaseAdmin as any)
      .from('cac_metrics')
      .select('cac_eur_cents')
      .eq('tenant_id', tenantId)
      .gte('recorded_at', now60d)
      .lt('recorded_at', now30d)

    const cacPriorRows: Array<{ cac_eur_cents: number }> =
      (cacPriorRes.data ?? []) as Array<{ cac_eur_cents: number }>
    cacPrior =
      cacPriorRows.length > 0
        ? cacPriorRows.reduce((s, r) => s + (r.cac_eur_cents ?? 0), 0) / cacPriorRows.length
        : 0
  } catch {
    // no cac_metrics
  }
  // For CAC, DOWN trend is GOOD (efficiency gain)
  const cacRawTrend = toTrend(cacCurrent, cacPrior)
  const cacEfficiencyTrend: Trend =
    cacRawTrend === 'DOWN' ? 'UP' : cacRawTrend === 'UP' ? 'DOWN' : 'STABLE'
  stages.push({
    stage: 'EFFICIENCY_GAIN',
    value: cacCurrent,
    unit: 'avg_cac_eur_cents',
    trend: cacEfficiencyTrend,
    bottleneck: false,
    bottleneck_reason: null,
  })

  // ── Identify bottlenecks ──────────────────────────────────────────────────
  const downStages = stages.filter((s) => s.trend === 'DOWN')
  if (downStages.length > 0) {
    // Bottleneck = first DOWN stage in the funnel order
    const bottleneckStage = downStages[0]!
    const stageIdx = stages.findIndex((s) => s.stage === bottleneckStage.stage)
    stages[stageIdx] = {
      ...bottleneckStage,
      bottleneck: true,
      bottleneck_reason: `Stage "${bottleneckStage.stage}" is trending DOWN — investigate and resolve to unlock flywheel progression.`,
    }
  }

  // ── Compute loop health metrics ───────────────────────────────────────────
  const upCount = stages.filter((s) => s.trend === 'UP').length
  const loop_efficiency_pct = (upCount / stages.length) * 100
  const loop_velocity_score = parseFloat(
    ((upCount / stages.length) * 10).toFixed(2),
  )
  const loop_status = loopStatusFromEfficiency(loop_efficiency_pct)

  const weakest_stage =
    stages.find((s) => s.bottleneck)?.stage ??
    stages.find((s) => s.trend === 'DOWN')?.stage ??
    null

  const strongest_stage =
    stages
      .filter((s) => s.trend === 'UP')
      .slice()
      .sort((a, b) => b.value - a.value)[0]?.stage ?? null

  // Projected acceleration: number of UP stages / total * 2
  const projected_loop_acceleration = parseFloat(
    ((upCount / stages.length) * 2).toFixed(4),
  )

  // ── Recommendations ───────────────────────────────────────────────────────
  const recommendations: string[] = []

  if (loop_status === 'BROKEN' || loop_status === 'BREAKING') {
    recommendations.push(
      `CRITICAL: Loop is ${loop_status}. Immediate action required on ${weakest_stage ?? 'all stages'}.`,
    )
  }

  if (weakest_stage) {
    recommendations.push(
      `Focus resources on recovering "${weakest_stage}" stage — it is the primary growth constraint.`,
    )
  }

  if (strongest_stage) {
    recommendations.push(
      `Leverage "${strongest_stage}" stage as the growth anchor — amplify its performance for flywheel momentum.`,
    )
  }

  if (loop_status === 'COMPOUNDING') {
    recommendations.push(
      'Loop is compounding. Maintain current trajectory and increase reinvestment to accelerate velocity.',
    )
  }

  if (marketingSpendCurrent === 0) {
    recommendations.push(
      'No marketing spend recorded. Activating first campaign will seed the flywheel.',
    )
  }

  const health: ClosedLoopHealth = {
    tenant_id: tenantId,
    measured_at: measuredAt,
    loop_efficiency_pct: parseFloat(loop_efficiency_pct.toFixed(2)),
    loop_velocity_score,
    stages,
    weakest_stage,
    strongest_stage,
    projected_loop_acceleration,
    loop_status,
    recommendations,
  }

  // Persist snapshot
  void (supabaseAdmin as any)
    .from('closed_loop_snapshots')
    .insert({
      tenant_id: tenantId,
      measured_at: measuredAt,
      loop_efficiency_pct: health.loop_efficiency_pct,
      loop_velocity_score: health.loop_velocity_score,
      stages: stages,
      weakest_stage: weakest_stage,
      strongest_stage: strongest_stage,
      projected_loop_acceleration: health.projected_loop_acceleration,
      loop_status: loop_status,
      recommendations: recommendations,
    })
    .then(
      ({ error }: { error: { message: string } | null }) =>
        error &&
        log.info('[closedLoopGrowth] persist snapshot warning', {
          tenantId,
          error: error.message,
        }),
    )

  log.info('[closedLoopGrowth] loop measured', {
    tenantId,
    loop_efficiency_pct: health.loop_efficiency_pct,
    loop_status,
    weakest_stage,
  })

  return health
}

// ─── generateReinvestmentPlan ─────────────────────────────────────────────────

/**
 * Computes a 20% reinvestment plan from last 90d commission revenue,
 * allocated across channels by ROI from channel_attribution_summaries.
 */
export async function generateReinvestmentPlan(tenantId: string): Promise<ReinvestmentPlan> {
  const generatedAt = new Date().toISOString()
  const since90d = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  // Total revenue from FEE entries last 90d
  let total_revenue_eur_cents = 0
  try {
    const feeRes = await (supabaseAdmin as any)
      .from('investor_ledger_entries')
      .select('amount_eur_cents')
      .eq('tenant_id', tenantId)
      .eq('entry_type', 'FEE')
      .gte('created_at', since90d)

    total_revenue_eur_cents = (
      (feeRes.data ?? []) as Array<{ amount_eur_cents: number }>
    ).reduce((s, r) => s + Math.abs(r.amount_eur_cents ?? 0), 0)
  } catch {
    // graceful fallback
  }

  const reinvestment_pct = 20
  const suggested_reinvestment_eur_cents = Math.round(
    total_revenue_eur_cents * (reinvestment_pct / 100),
  )

  // Channel allocation by ROI
  const allocation: ReinvestmentAllocation[] = []
  try {
    const channelRes = await (supabaseAdmin as any)
      .from('channel_attribution_summaries')
      .select('channel, roi_multiple, conversion_rate_pct')
      .eq('tenant_id', tenantId)
      .order('roi_multiple', { ascending: false })
      .limit(5)

    const channelRows: Array<{
      channel: string
      roi_multiple: number
      conversion_rate_pct: number
    }> = (channelRes.data ?? []) as Array<{
      channel: string
      roi_multiple: number
      conversion_rate_pct: number
    }>

    if (channelRows.length > 0) {
      const totalRoi = channelRows.reduce((s, r) => s + (r.roi_multiple ?? 1), 0)

      for (const ch of channelRows) {
        const share = totalRoi > 0 ? (ch.roi_multiple ?? 1) / totalRoi : 1 / channelRows.length
        const amount_eur_cents = Math.round(suggested_reinvestment_eur_cents * share)
        allocation.push({
          channel: ch.channel,
          amount_eur_cents,
          expected_roi_multiple: ch.roi_multiple ?? 1,
          rationale: `Channel "${ch.channel}" delivers ${(ch.roi_multiple ?? 1).toFixed(2)}x ROI and ${(ch.conversion_rate_pct ?? 0).toFixed(1)}% conversion. Proportional allocation based on performance share.`,
        })
      }
    } else {
      // Fallback: allocate 100% to email
      allocation.push({
        channel: 'email',
        amount_eur_cents: suggested_reinvestment_eur_cents,
        expected_roi_multiple: 2.5,
        rationale:
          'No channel attribution data. Defaulting to email as highest-baseline ROI channel.',
      })
    }
  } catch {
    // fallback allocation
    allocation.push({
      channel: 'email',
      amount_eur_cents: suggested_reinvestment_eur_cents,
      expected_roi_multiple: 2.5,
      rationale: 'Channel data unavailable. Defaulting to email.',
    })
  }

  const plan: ReinvestmentPlan = {
    tenant_id: tenantId,
    generated_at: generatedAt,
    total_revenue_eur_cents,
    suggested_reinvestment_eur_cents,
    reinvestment_pct,
    allocation,
  }

  // Persist
  void (supabaseAdmin as any)
    .from('reinvestment_plans')
    .insert({
      tenant_id: tenantId,
      generated_at: generatedAt,
      total_revenue_eur_cents,
      suggested_reinvestment_eur_cents,
      reinvestment_pct,
      allocation,
    })
    .then(
      ({ error }: { error: { message: string } | null }) =>
        error &&
        log.info('[closedLoopGrowth] persist reinvestment_plan warning', {
          tenantId,
          error: error.message,
        }),
    )

  log.info('[closedLoopGrowth] reinvestment plan generated', {
    tenantId,
    total_revenue_eur_cents,
    suggested_reinvestment_eur_cents,
    channels: allocation.length,
  })

  return plan
}

// ─── getLoopHistory ───────────────────────────────────────────────────────────

/**
 * Returns last N closed_loop_snapshots for trend analysis.
 */
export async function getLoopHistory(
  tenantId: string,
  periods = 12,
): Promise<ClosedLoopHealth[]> {
  try {
    const res = await (supabaseAdmin as any)
      .from('closed_loop_snapshots')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('measured_at', { ascending: false })
      .limit(periods)

    const rows: Array<{
      tenant_id: string
      measured_at: string
      loop_efficiency_pct: number
      loop_velocity_score: number
      stages: LoopStage[]
      weakest_stage: string | null
      strongest_stage: string | null
      projected_loop_acceleration: number
      loop_status: LoopStatus
      recommendations: string[]
    }> = (res.data ?? []) as Array<{
      tenant_id: string
      measured_at: string
      loop_efficiency_pct: number
      loop_velocity_score: number
      stages: LoopStage[]
      weakest_stage: string | null
      strongest_stage: string | null
      projected_loop_acceleration: number
      loop_status: LoopStatus
      recommendations: string[]
    }>

    return rows.map((r) => ({
      tenant_id: r.tenant_id,
      measured_at: r.measured_at,
      loop_efficiency_pct: r.loop_efficiency_pct,
      loop_velocity_score: r.loop_velocity_score,
      stages: r.stages ?? [],
      weakest_stage: r.weakest_stage,
      strongest_stage: r.strongest_stage,
      projected_loop_acceleration: r.projected_loop_acceleration,
      loop_status: r.loop_status,
      recommendations: r.recommendations ?? [],
    }))
  } catch (err) {
    log.info('[closedLoopGrowth] getLoopHistory error', { tenantId, error: String(err) })
    return []
  }
}
