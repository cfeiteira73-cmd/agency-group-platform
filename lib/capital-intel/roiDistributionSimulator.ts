// Agency Group — ROI Distribution Simulator
// lib/capital-intel/roiDistributionSimulator.ts
// Monte Carlo-style ROI distribution simulation using Box-Muller transform.
// No external ML libraries — pure TypeScript.
// TypeScript strict — 0 errors

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ROISimulation {
  simulation_id: string
  tenant_id: string
  opportunity_id: string
  simulations_run: number

  roi_p10: number
  roi_p50: number
  roi_p90: number
  roi_mean: number
  roi_std: number

  scenario_bull_eur_cents: number
  scenario_base_eur_cents: number
  scenario_bear_eur_cents: number

  probability_of_loss: number
  max_drawdown_pct: number
  sharpe_ratio: number | null

  simulated_at: string
}

// ─── Box-Muller Normal Distribution ──────────────────────────────────────────

/**
 * Generates a normally distributed random number using Box-Muller transform.
 * @param mean - distribution mean
 * @param std  - standard deviation
 */
function normalRandom(mean: number, std: number): number {
  const u1 = Math.random()
  const u2 = Math.random()
  // Avoid log(0)
  const safeU1 = u1 === 0 ? Number.EPSILON : u1
  const z = Math.sqrt(-2 * Math.log(safeU1)) * Math.cos(2 * Math.PI * u2)
  return mean + std * z
}

// ─── Percentile helper ────────────────────────────────────────────────────────

function percentile(sorted: number[], p: number): number {
  const index = Math.floor((p / 100) * (sorted.length - 1))
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))] ?? 0
}

// ─── simulateROI ──────────────────────────────────────────────────────────────

/**
 * Runs a simplified Monte Carlo ROI simulation for an opportunity.
 * Base ROI = potential_gain / asking_price * 100
 * Volatility: distressed ±30%, normal ±15%
 * Persists to: roi_simulations
 */
export async function simulateROI(
  opportunityId: string,
  tenantId: string,
  simulationsCount = 1000
): Promise<ROISimulation> {
  // Load opportunity data
  const { data: oppRows } = await (supabaseAdmin as any)
    .from('capital_opportunities')
    .select('asking_price_eur_cents, potential_gain_eur_cents, opportunity_type')
    .eq('id', opportunityId)
    .eq('tenant_id', tenantId)
    .limit(1)

  const opp = oppRows?.[0] as
    | {
        asking_price_eur_cents: number | null
        potential_gain_eur_cents: number | null
        opportunity_type: string | null
      }
    | undefined

  const askingPrice = opp?.asking_price_eur_cents ?? 1
  const potentialGain = opp?.potential_gain_eur_cents ?? 0
  const oppType = opp?.opportunity_type ?? ''

  // Base ROI in percent
  const baseRoi = askingPrice > 0 ? (potentialGain / askingPrice) * 100 : 0

  // Volatility: distressed assets ±30%, normal ±15%
  const isDistressed = oppType === 'DISTRESSED' || oppType === 'AUCTION'
  const volatility = isDistressed ? 30 : 15

  // Run simulations
  const samples: number[] = []
  for (let i = 0; i < simulationsCount; i++) {
    samples.push(normalRandom(baseRoi, volatility))
  }

  // Sort for percentiles
  const sorted = [...samples].sort((a, b) => a - b)

  const roiP10 = percentile(sorted, 10)
  const roiP50 = percentile(sorted, 50)
  const roiP90 = percentile(sorted, 90)

  const roiMean = samples.reduce((sum, v) => sum + v, 0) / samples.length
  const variance = samples.reduce((sum, v) => sum + (v - roiMean) ** 2, 0) / samples.length
  const roiStd = Math.sqrt(variance)

  const negativeCount = samples.filter((v) => v < 0).length
  const probabilityOfLoss = negativeCount / samples.length

  // Max drawdown: difference between roiP10 and roiP50 as a percentage
  const maxDrawdownPct = Math.max(0, roiP50 - roiP10)

  // Sharpe ratio: (mean - risk_free) / std, using 3% risk-free rate
  const riskFreeRate = 3
  const sharpeRatio = roiStd > 0 ? (roiMean - riskFreeRate) / roiStd : null

  // Capital scenarios
  const scenarioBull = Math.round((roiP90 / 100) * askingPrice)
  const scenarioBase = Math.round((roiP50 / 100) * askingPrice)
  const scenarioBear = Math.round((roiP10 / 100) * askingPrice)

  const simulation: ROISimulation = {
    simulation_id: randomUUID(),
    tenant_id: tenantId,
    opportunity_id: opportunityId,
    simulations_run: simulationsCount,
    roi_p10: roiP10,
    roi_p50: roiP50,
    roi_p90: roiP90,
    roi_mean: roiMean,
    roi_std: roiStd,
    scenario_bull_eur_cents: scenarioBull,
    scenario_base_eur_cents: scenarioBase,
    scenario_bear_eur_cents: scenarioBear,
    probability_of_loss: probabilityOfLoss,
    max_drawdown_pct: maxDrawdownPct,
    sharpe_ratio: sharpeRatio,
    simulated_at: new Date().toISOString(),
  }

  // Persist
  void (supabaseAdmin as any)
    .from('roi_simulations')
    .insert({
      id: randomUUID(),
      simulation_id: simulation.simulation_id,
      tenant_id: tenantId,
      opportunity_id: opportunityId,
      simulations_run: simulationsCount,
      roi_p10: roiP10,
      roi_p50: roiP50,
      roi_p90: roiP90,
      roi_mean: roiMean,
      roi_std: roiStd,
      scenario_bull_eur_cents: scenarioBull,
      scenario_base_eur_cents: scenarioBase,
      scenario_bear_eur_cents: scenarioBear,
      probability_of_loss: probabilityOfLoss,
      max_drawdown_pct: maxDrawdownPct,
      sharpe_ratio: sharpeRatio,
      simulated_at: simulation.simulated_at,
    })
    .catch((e: unknown) =>
      log.warn('[roiDistributionSimulator] insert roi_simulations', { error: e })
    )

  return simulation
}

// ─── getLatestSimulation ──────────────────────────────────────────────────────

/**
 * Retrieves the most recent simulation for an opportunity.
 */
export async function getLatestSimulation(
  opportunityId: string,
  tenantId: string
): Promise<ROISimulation | null> {
  const { data: rows } = await (supabaseAdmin as any)
    .from('roi_simulations')
    .select('*')
    .eq('opportunity_id', opportunityId)
    .eq('tenant_id', tenantId)
    .order('simulated_at', { ascending: false })
    .limit(1)

  return (rows?.[0] as ROISimulation | undefined) ?? null
}

// ─── batchSimulate ────────────────────────────────────────────────────────────

/**
 * Runs simulations for opportunities without a recent simulation (> 24h or no simulation).
 * If opportunityIds is provided, only simulates those.
 */
export async function batchSimulate(
  tenantId: string,
  opportunityIds?: string[]
): Promise<{ simulated: number }> {
  const since = new Date(Date.now() - 24 * 3_600_000).toISOString()

  // Get opportunities that need simulation
  let oppQuery = (supabaseAdmin as any)
    .from('capital_opportunities')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('status', 'ACTIVE')

  if (opportunityIds && opportunityIds.length > 0) {
    oppQuery = oppQuery.in('id', opportunityIds)
  }

  const { data: oppRows } = await oppQuery
  const opps: Array<{ id: string }> = (oppRows ?? []) as Array<{ id: string }>

  // Get recent simulations to skip
  const recentSimIds = new Set<string>()
  if (opps.length > 0) {
    const ids = opps.map((o) => o.id)
    const { data: recentRows } = await (supabaseAdmin as any)
      .from('roi_simulations')
      .select('opportunity_id')
      .eq('tenant_id', tenantId)
      .in('opportunity_id', ids)
      .gte('simulated_at', since)

    const recent: Array<{ opportunity_id: string }> = (recentRows ?? []) as Array<{
      opportunity_id: string
    }>
    for (const r of recent) {
      recentSimIds.add(r.opportunity_id)
    }
  }

  const toSimulate = opps.filter((o) => !recentSimIds.has(o.id))
  let simulated = 0

  for (const opp of toSimulate) {
    try {
      await simulateROI(opp.id, tenantId)
      simulated++
    } catch (e: unknown) {
      log.warn('[roiDistributionSimulator] batchSimulate failed for opp', { opp_id: opp.id, error: e })
    }
  }

  log.info('[roiDistributionSimulator] batchSimulate complete', {
    tenant_id: tenantId,
    simulated,
    skipped: opps.length - toSimulate.length,
  })

  return { simulated }
}
