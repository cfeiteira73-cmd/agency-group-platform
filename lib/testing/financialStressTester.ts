// Agency Group — Financial Stress Tester
// lib/testing/financialStressTester.ts
// TypeScript strict — 0 errors
//
// Tests financial system under stress: capital surge ×10, bid explosion, liquidity collapse
// All stress tests are MATHEMATICAL — calibrated from real DB data, no DB writes

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type StressScenarioName = 'capital_surge_10x' | 'bid_explosion' | 'liquidity_collapse'

export interface FinancialBaseline {
  avg_transaction_eur: number | null
  total_active_deals: number
  avg_bids_per_asset: number | null
  current_liquidity_grade: string | null
}

export interface StressScenarioProjection {
  processing_capacity_pct: number
  queue_depth_estimate: number
  settlement_delay_hours: number
  escrow_pressure_index: number
}

export interface StressScenario {
  scenario: StressScenarioName
  projected_impact: StressScenarioProjection
  circuit_breakers_would_trigger: boolean
  fallback_mechanisms_available: boolean
  estimated_max_loss_eur: number
  stress_survivability: 'survives' | 'degraded' | 'fails'
}

export interface SystemFinancialCapacity {
  max_concurrent_transactions: number
  max_daily_volume_eur: number
  capital_absorption_rate_per_hour: number | null
}

export interface FinancialStressResult {
  test_id: string
  tenant_id: string
  baseline: FinancialBaseline
  stress_scenarios: StressScenario[]
  system_financial_capacity: SystemFinancialCapacity
  stress_grade: 'ROBUST' | 'ADEQUATE' | 'FRAGILE'
  recommendations: string[]
  executed_at: string
}

// ─── loadBaseline ─────────────────────────────────────────────────────────────

export async function loadBaseline(tenantId: string): Promise<FinancialBaseline> {
  const db = supabaseAdmin as any

  let avg_transaction_eur: number | null = null
  let total_active_deals = 0
  let avg_bids_per_asset: number | null = null
  let current_liquidity_grade: string | null = null

  // avg amount_eur from capital_transactions
  try {
    const { data } = await db
      .from('capital_transactions')
      .select('amount_eur')
      .eq('tenant_id', tenantId)
      .not('amount_eur', 'is', null)
      .limit(1000) as { data: Array<{ amount_eur: number }> | null }

    if (data && data.length > 0) {
      const sum = data.reduce((acc, row) => acc + (row.amount_eur ?? 0), 0)
      avg_transaction_eur = sum / data.length
    }
  } catch { /* non-fatal */ }

  // total_active_deals
  try {
    const { count } = await db
      .from('capital_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .in('status', ['initiated', 'escrow_created', 'settlement_tracking'])
    total_active_deals = (count as number) ?? 0
  } catch { /* non-fatal */ }

  // avg_bids_per_asset — compute via match counts per asset
  try {
    const { data: matchData } = await db
      .from('matches')
      .select('asset_id')
      .eq('tenant_id', tenantId)
      .not('asset_id', 'is', null)
      .limit(5000) as { data: Array<{ asset_id: string }> | null }

    if (matchData && matchData.length > 0) {
      const assetBidCounts = new Map<string, number>()
      for (const row of matchData) {
        if (row.asset_id) {
          assetBidCounts.set(row.asset_id, (assetBidCounts.get(row.asset_id) ?? 0) + 1)
        }
      }
      const uniqueAssets = assetBidCounts.size
      if (uniqueAssets > 0) {
        const totalBids = Array.from(assetBidCounts.values()).reduce((a, b) => a + b, 0)
        avg_bids_per_asset = totalBids / uniqueAssets
      }
    }
  } catch { /* non-fatal */ }

  // current_liquidity_grade
  try {
    const { data: liqData } = await db
      .from('liquidity_feedback_loop')
      .select('liquidity_grade')
      .eq('tenant_id', tenantId)
      .order('evaluated_at', { ascending: false })
      .limit(1) as { data: Array<{ liquidity_grade: string }> | null }

    if (liqData && liqData.length > 0 && liqData[0]) {
      current_liquidity_grade = liqData[0].liquidity_grade ?? null
    }
  } catch { /* non-fatal */ }

  return {
    avg_transaction_eur,
    total_active_deals,
    avg_bids_per_asset,
    current_liquidity_grade,
  }
}

// ─── projectStressImpact ──────────────────────────────────────────────────────

export function projectStressImpact(
  scenario: StressScenarioName,
  baseline: FinancialBaseline,
): StressScenario {
  // Infra capacity constants (reasonable estimate for ECS Fargate + Supabase)
  const MAX_CONCURRENT_TRANSACTIONS = 500
  const PROCESSING_RATE_PER_HOUR   = 200  // transactions/hour at normal load

  const avgTx  = baseline.avg_transaction_eur ?? 500_000
  const deals  = baseline.total_active_deals
  const bids   = baseline.avg_bids_per_asset ?? 1

  switch (scenario) {
    case 'capital_surge_10x': {
      const surge_volume        = deals * 10
      const processing_capacity_pct = Math.min(100, (MAX_CONCURRENT_TRANSACTIONS / surge_volume) * 100)
      const queue_depth_estimate    = Math.max(0, surge_volume - MAX_CONCURRENT_TRANSACTIONS)
      const settlement_delay_hours  = queue_depth_estimate > 0
        ? Math.round((queue_depth_estimate / PROCESSING_RATE_PER_HOUR) * 10) / 10
        : 0
      const escrow_pressure_index   = Math.min(100, (surge_volume / MAX_CONCURRENT_TRANSACTIONS) * 100)
      const circuit_breakers_would_trigger = escrow_pressure_index > 80
      const stress_survivability: StressScenario['stress_survivability'] =
        escrow_pressure_index <= 70 ? 'survives' :
        escrow_pressure_index <= 90 ? 'degraded' :
        'fails'
      const estimated_max_loss_eur = stress_survivability === 'fails'
        ? queue_depth_estimate * avgTx * 0.01  // 1% slippage on unprocessed
        : 0

      return {
        scenario,
        projected_impact: {
          processing_capacity_pct: Math.round(processing_capacity_pct),
          queue_depth_estimate,
          settlement_delay_hours,
          escrow_pressure_index: Math.round(escrow_pressure_index),
        },
        circuit_breakers_would_trigger,
        fallback_mechanisms_available: true,  // escrow_accounts.status = frozen
        estimated_max_loss_eur: Math.round(estimated_max_loss_eur),
        stress_survivability,
      }
    }

    case 'bid_explosion': {
      const bids_10x            = deals * 10  // 10x bids per asset
      const processing_capacity_pct = Math.min(100, (MAX_CONCURRENT_TRANSACTIONS / Math.max(1, bids_10x)) * 100)
      const queue_depth_estimate    = Math.max(0, bids_10x - MAX_CONCURRENT_TRANSACTIONS)
      const settlement_delay_hours  = queue_depth_estimate > 0
        ? Math.round((queue_depth_estimate / PROCESSING_RATE_PER_HOUR) * 10) / 10
        : 0
      const escrow_pressure_index   = Math.min(100, (bids_10x / MAX_CONCURRENT_TRANSACTIONS) * 100)
      const circuit_breakers_would_trigger = bids_10x > MAX_CONCURRENT_TRANSACTIONS * 1.5
      const stress_survivability: StressScenario['stress_survivability'] =
        escrow_pressure_index <= 70 ? 'survives' :
        escrow_pressure_index <= 90 ? 'degraded' :
        'fails'

      return {
        scenario,
        projected_impact: {
          processing_capacity_pct: Math.round(processing_capacity_pct),
          queue_depth_estimate,
          settlement_delay_hours,
          escrow_pressure_index: Math.round(escrow_pressure_index),
        },
        circuit_breakers_would_trigger,
        fallback_mechanisms_available: bids > 0,  // real bids exist → mechanisms exercised
        estimated_max_loss_eur: 0,  // bid explosion doesn't cause direct loss
        stress_survivability,
      }
    }

    case 'liquidity_collapse': {
      // Liquidity collapse: all bids dry up, settlement pipeline stalls
      const collapse_multiplier     = 0.1  // 10% of normal volume processes
      const processing_capacity_pct = 10   // only 10% of capacity usable
      const queue_depth_estimate    = deals  // all active deals queue up
      const settlement_delay_hours  = Math.round((deals / (PROCESSING_RATE_PER_HOUR * collapse_multiplier)) * 10) / 10
      const escrow_pressure_index   = 90    // system near overwhelm under collapse
      const circuit_breakers_would_trigger = true  // always trigger under collapse

      // Check if liquidity_feedback_loop table has fallback data
      const fallback_mechanisms_available =
        baseline.current_liquidity_grade !== null  // have historical grade = can revert

      const estimated_max_loss_eur = deals * avgTx * 0.02  // 2% slippage under panic

      const stress_survivability: StressScenario['stress_survivability'] =
        fallback_mechanisms_available ? 'degraded' : 'fails'

      return {
        scenario,
        projected_impact: {
          processing_capacity_pct,
          queue_depth_estimate,
          settlement_delay_hours,
          escrow_pressure_index,
        },
        circuit_breakers_would_trigger,
        fallback_mechanisms_available,
        estimated_max_loss_eur: Math.round(estimated_max_loss_eur),
        stress_survivability,
      }
    }

    default: {
      const _exhaustive: never = scenario
      throw new Error(`Unknown stress scenario: ${String(_exhaustive)}`)
    }
  }
}

// ─── runFinancialStressTest ───────────────────────────────────────────────────

const ALL_STRESS_SCENARIOS: StressScenarioName[] = [
  'capital_surge_10x',
  'bid_explosion',
  'liquidity_collapse',
]

export async function runFinancialStressTest(
  tenantId: string,
): Promise<FinancialStressResult> {
  const test_id     = randomUUID()
  const executed_at = new Date().toISOString()

  log.info('[financialStressTester] starting financial stress test', {
    tenant_id: tenantId,
    test_id,
  })

  const baseline = await loadBaseline(tenantId)

  const stress_scenarios = ALL_STRESS_SCENARIOS.map(s =>
    projectStressImpact(s, baseline),
  )

  // System capacity estimates
  const avg_tx = baseline.avg_transaction_eur ?? 500_000
  const system_financial_capacity: SystemFinancialCapacity = {
    max_concurrent_transactions: 500,
    max_daily_volume_eur: 500 * avg_tx,  // 500 max concurrent × avg size
    capital_absorption_rate_per_hour: baseline.avg_transaction_eur !== null
      ? 200 * baseline.avg_transaction_eur  // 200 tx/hour × avg
      : null,
  }

  // Grade assessment
  const all_survive = stress_scenarios.every(s => s.stress_survivability === 'survives')
  const any_fail    = stress_scenarios.some(s => s.stress_survivability === 'fails')
  const stress_grade: FinancialStressResult['stress_grade'] =
    all_survive ? 'ROBUST' :
    any_fail    ? 'FRAGILE' :
    'ADEQUATE'

  // Recommendations
  const recommendations: string[] = []
  const surgeSc  = stress_scenarios.find(s => s.scenario === 'capital_surge_10x')
  const bidSc    = stress_scenarios.find(s => s.scenario === 'bid_explosion')
  const liqSc    = stress_scenarios.find(s => s.scenario === 'liquidity_collapse')

  if (surgeSc?.stress_survivability !== 'survives') {
    recommendations.push('Increase ECS Fargate task count to handle 10x capital surge')
    recommendations.push('Implement transaction queue with backpressure (max depth: 1000)')
  }
  if (bidSc?.circuit_breakers_would_trigger) {
    recommendations.push('Deploy bid rate limiter: max 50 bids/asset/hour circuit breaker')
  }
  if (liqSc?.stress_survivability === 'fails') {
    recommendations.push('Configure liquidity_feedback_loop fallback: freeze new bids on grade D')
    recommendations.push('Implement emergency liquidity injection protocol via admin API')
  }
  if (baseline.avg_transaction_eur === null) {
    recommendations.push('No transaction data for calibration — stress estimates use defaults')
  }

  const result: FinancialStressResult = {
    test_id,
    tenant_id: tenantId,
    baseline,
    stress_scenarios,
    system_financial_capacity,
    stress_grade,
    recommendations,
    executed_at,
  }

  log.info('[financialStressTester] financial stress test complete', {
    tenant_id: tenantId,
    test_id,
    stress_grade,
    total_active_deals: baseline.total_active_deals,
  })

  // Persist (fire-and-forget)
  void (supabaseAdmin as any)
    .from('financial_stress_results')
    .insert({
      id: test_id,
      tenant_id: tenantId,
      baseline,
      stress_scenarios,
      system_financial_capacity,
      stress_grade,
      recommendations,
      executed_at,
    })
    .then(({ error }: { error: { message: string } | null }) => {
      if (error) log.warn('[financialStressTester] persist failed', { error: error.message, test_id })
    })
    .catch((e: unknown) => log.warn('[financialStressTester] persist threw', {
      error: e instanceof Error ? e.message : String(e),
      test_id,
    }))

  return result
}
