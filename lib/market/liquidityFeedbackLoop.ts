// Agency Group — Liquidity Feedback Loop
// lib/market/liquidityFeedbackLoop.ts
//
// Capital market flywheel: capital inflow → price increase → demand shift →
// investor reranking → capital reallocation
//
// Reads live market state from DB, models next-state, iterates until convergence.
//
// TypeScript strict — 0 errors

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FeedbackLoopIteration {
  tenant_id: string
  iteration: number
  state: {
    total_active_capital_eur: number
    avg_clearing_price_eur: number
    active_investor_count: number
    avg_liquidity_score: number
    market_temperature: number
  }
  signals: {
    price_adjustment_zones: Array<{ zone: string; adjustment_pct: number }>
    demand_shifted_investors: number
    reranked_properties: number
    capital_reallocated_eur: number
  }
  converged: boolean
  computed_at: string
}

export interface FeedbackLoopResult {
  tenant_id: string
  total_iterations: number
  converged: boolean
  convergence_iteration: number | null
  final_state: FeedbackLoopIteration['state']
  cumulative_price_adjustment_pct: number
  cumulative_capital_reallocation_eur: number
  equilibrium_market_temperature: number
  loop_duration_ms: number
  ran_at: string
}

// ─── Internal row types ───────────────────────────────────────────────────────

interface ClearingSnapshotRow {
  zone: string | null
  clearing_price_eur: number | null
  demand_pressure: number | null
}

interface InvestorBidRow {
  investor_id: string
  preferred_zone: string | null
  price_range_max: number | null
  bid_price_eur: number
  status: string
}

interface CapitalFlowRow {
  amount_eur: number | null
  flow_direction: string | null
  created_at: string
}

interface BidBookRow {
  active_bids: number | null
  capital_committed_eur: number | null
}

// ─── computeMarketTemperature ─────────────────────────────────────────────────

export async function computeMarketTemperature(tenantId: string): Promise<number> {
  const db = supabaseAdmin as any

  let avgMpiScore = 50
  let bidDensity = 0
  let capitalVelocity = 0
  let urgencyHeat = 50

  try {
    // Avg MPI score from market_clearing_snapshots
    const { data: snapshots } = await db
      .from('market_clearing_snapshots')
      .select('demand_pressure')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(50)

    const snapshotRows = (snapshots ?? []) as Array<{ demand_pressure: number | null }>
    if (snapshotRows.length > 0) {
      const total = snapshotRows.reduce((s, r) => s + (r.demand_pressure ?? 50), 0)
      avgMpiScore = total / snapshotRows.length
    }
  } catch { /* non-fatal */ }

  try {
    // Bid density = total active bids / active properties
    const { count: bidCount } = await db
      .from('investor_bids')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'active')

    const { count: propCount } = await db
      .from('bid_books')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gt('active_bids', 0)

    const activeBids = (bidCount as number) ?? 0
    const activeProps = (propCount as number) ?? 1
    bidDensity = Math.min(100, (activeBids / activeProps) * 10)
  } catch { /* non-fatal */ }

  try {
    // Capital velocity = EUR moved in last 7 days
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: flows } = await db
      .from('capital_flows')
      .select('amount_eur')
      .eq('tenant_id', tenantId)
      .gte('created_at', since)

    const flowRows = (flows ?? []) as Array<{ amount_eur: number | null }>
    const total7d = flowRows.reduce((s, r) => s + Math.abs(r.amount_eur ?? 0), 0)
    capitalVelocity = Math.min(100, total7d / 100_000) // 10M EUR/week → 100
  } catch { /* non-fatal */ }

  try {
    // Urgency heat from investor_bids urgency_level distribution
    const { data: urgencyBids } = await db
      .from('investor_bids')
      .select('urgency_level')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .limit(200)

    const urgencyRows = (urgencyBids ?? []) as Array<{ urgency_level: string | null }>
    if (urgencyRows.length > 0) {
      const urgencyWeights: Record<string, number> = {
        immediate: 100,
        within_30d: 70,
        within_90d: 40,
        flexible: 20,
      }
      const totalWeight = urgencyRows.reduce(
        (s, r) => s + (urgencyWeights[r.urgency_level ?? 'flexible'] ?? 20),
        0,
      )
      urgencyHeat = totalWeight / urgencyRows.length
    }
  } catch { /* non-fatal */ }

  // Composite: MPI*0.30 + bidDensity*0.25 + capitalVelocity*0.25 + urgencyHeat*0.20
  const temperature = Math.min(100, Math.max(0, Math.round(
    (avgMpiScore * 0.30 +
     bidDensity * 0.25 +
     capitalVelocity * 0.25 +
     urgencyHeat * 0.20) * 100
  ) / 100))

  return temperature
}

// ─── readMarketState ──────────────────────────────────────────────────────────

interface MarketState {
  total_active_capital_eur: number
  avg_clearing_price_eur: number
  active_investor_count: number
  avg_liquidity_score: number
  market_temperature: number
  zone_pressures: Array<{ zone: string; demand_pressure: number; avg_price: number }>
  active_bids: InvestorBidRow[]
}

async function readMarketState(tenantId: string): Promise<MarketState> {
  const db = supabaseAdmin as any

  let total_active_capital_eur = 0
  let avg_clearing_price_eur = 0
  let active_investor_count = 0
  let avg_liquidity_score = 0
  const zone_pressures: Array<{ zone: string; demand_pressure: number; avg_price: number }> = []
  let active_bids: InvestorBidRow[] = []

  try {
    // Total capital from capital_flows (inflows, last 30 days)
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data: flows } = await db
      .from('capital_flows')
      .select('amount_eur, flow_direction')
      .eq('tenant_id', tenantId)
      .gte('created_at', since30d)

    const flowRows = (flows ?? []) as CapitalFlowRow[]
    total_active_capital_eur = flowRows
      .filter(f => f.flow_direction === 'inflow')
      .reduce((s, f) => s + (f.amount_eur ?? 0), 0)
  } catch { /* non-fatal */ }

  try {
    // Clearing price + demand pressure per zone
    const { data: snapshots } = await db
      .from('market_clearing_snapshots')
      .select('zone, clearing_price_eur, demand_pressure')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(100)

    const snapshotRows = (snapshots ?? []) as ClearingSnapshotRow[]

    // Aggregate per zone (latest values)
    const zoneMap = new Map<string, { prices: number[]; pressures: number[] }>()
    for (const row of snapshotRows) {
      const zone = row.zone ?? 'unknown'
      const entry = zoneMap.get(zone) ?? { prices: [], pressures: [] }
      if (row.clearing_price_eur != null) entry.prices.push(row.clearing_price_eur)
      if (row.demand_pressure != null) entry.pressures.push(row.demand_pressure)
      zoneMap.set(zone, entry)
    }

    for (const [zone, data] of zoneMap.entries()) {
      if (data.prices.length > 0) {
        zone_pressures.push({
          zone,
          demand_pressure: data.pressures.length > 0
            ? data.pressures.reduce((a, b) => a + b, 0) / data.pressures.length
            : 50,
          avg_price: data.prices.reduce((a, b) => a + b, 0) / data.prices.length,
        })
      }
    }

    if (zone_pressures.length > 0) {
      avg_clearing_price_eur = zone_pressures.reduce((s, z) => s + z.avg_price, 0) / zone_pressures.length
    }
  } catch { /* non-fatal */ }

  try {
    // Active investor count + bids
    const { data: bids } = await db
      .from('investor_bids')
      .select('investor_id, preferred_zone, price_range_max, bid_price_eur, status')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .limit(500)

    active_bids = (bids ?? []) as InvestorBidRow[]
    const uniqueInvestors = new Set(active_bids.map(b => b.investor_id))
    active_investor_count = uniqueInvestors.size
  } catch { /* non-fatal */ }

  try {
    // Avg liquidity score from bid_books
    const { data: bbRows } = await db
      .from('bid_books')
      .select('active_bids, capital_committed_eur')
      .eq('tenant_id', tenantId)
      .gt('active_bids', 0)
      .limit(200)

    const books = (bbRows ?? []) as BidBookRow[]
    if (books.length > 0) {
      const totalBids = books.reduce((s, b) => s + (b.active_bids ?? 0), 0)
      const avgBids = totalBids / books.length
      avg_liquidity_score = Math.min(100, avgBids * 15)
    }
  } catch { /* non-fatal */ }

  const market_temperature = await computeMarketTemperature(tenantId)

  return {
    total_active_capital_eur,
    avg_clearing_price_eur,
    active_investor_count,
    avg_liquidity_score,
    market_temperature,
    zone_pressures,
    active_bids,
  }
}

// ─── Feedback loop iteration logic ────────────────────────────────────────────

interface IterationSignals {
  price_adjustment_zones: Array<{ zone: string; adjustment_pct: number }>
  demand_shifted_investors: number
  reranked_properties: number
  capital_reallocated_eur: number
}

function computeIterationSignals(
  state: MarketState,
  previousZoneAdjustments: Map<string, number>,
): IterationSignals {
  // 1. Price adjustment per zone: (demand_pressure - 50) / 1000 → [-5%, +5%]
  const price_adjustment_zones = state.zone_pressures.map(zp => {
    const rawAdj = (zp.demand_pressure - 50) / 1000
    const adj = Math.round(rawAdj * 10_000) / 10_000 // 4 decimal places
    return { zone: zp.zone, adjustment_pct: adj }
  })

  // 2. Demand shift: investors whose price_range_max < new_avg_price * 1.1 → 30% shift out
  let demand_shifted_investors = 0
  for (const bid of state.active_bids) {
    if (bid.preferred_zone == null) continue
    const zoneData = state.zone_pressures.find(z => z.zone === bid.preferred_zone)
    if (!zoneData) continue

    const prevAdj = previousZoneAdjustments.get(bid.preferred_zone) ?? 0
    const newAvgPrice = zoneData.avg_price * (1 + prevAdj / 100)
    const maxBudget = bid.price_range_max ?? bid.bid_price_eur

    if (maxBudget < newAvgPrice * 1.1) {
      // 30% probability of shifting to adjacent zone
      if (Math.random() < 0.30) {
        demand_shifted_investors++
      }
    }
  }

  // 3. Reranked properties = zones with non-zero price adjustments × average listings per zone
  const zonesWithMovement = price_adjustment_zones.filter(z => Math.abs(z.adjustment_pct) > 0.001)
  const reranked_properties = zonesWithMovement.length * 3 // estimate 3 properties per affected zone

  // 4. Capital reallocation estimate
  const avgBid = state.active_bids.length > 0
    ? state.active_bids.reduce((s, b) => s + b.bid_price_eur, 0) / state.active_bids.length
    : state.avg_clearing_price_eur * 0.95

  const capital_reallocated_eur = demand_shifted_investors * avgBid

  return {
    price_adjustment_zones,
    demand_shifted_investors,
    reranked_properties,
    capital_reallocated_eur,
  }
}

function checkConvergence(
  capital_reallocated_eur: number,
  total_active_capital_eur: number,
): boolean {
  if (total_active_capital_eur === 0) return true
  const reallocationRatio = capital_reallocated_eur / total_active_capital_eur
  return reallocationRatio < 0.005 // < 0.5% of total capital → converged
}

// ─── runFeedbackLoop ──────────────────────────────────────────────────────────

export async function runFeedbackLoop(
  tenantId: string,
  maxIterations = 5,
): Promise<FeedbackLoopResult> {
  const t0 = Date.now()
  const ran_at = new Date().toISOString()

  log.info('[LiquidityFeedbackLoop] starting feedback loop', {
    tenant_id: tenantId,
    max_iterations: maxIterations,
  })

  const iterations: FeedbackLoopIteration[] = []
  let cumulative_price_adjustment_pct = 0
  let cumulative_capital_reallocation_eur = 0
  let convergence_iteration: number | null = null

  // Track accumulated zone adjustments across iterations
  const accumulatedZoneAdj = new Map<string, number>()

  for (let i = 1; i <= maxIterations; i++) {
    const state = await readMarketState(tenantId)

    const signals = computeIterationSignals(state, accumulatedZoneAdj)

    // Accumulate zone adjustments
    for (const adj of signals.price_adjustment_zones) {
      const prev = accumulatedZoneAdj.get(adj.zone) ?? 0
      accumulatedZoneAdj.set(adj.zone, prev + adj.adjustment_pct)
    }

    const totalAdjThisIter = signals.price_adjustment_zones.reduce(
      (s, z) => s + Math.abs(z.adjustment_pct),
      0,
    )
    cumulative_price_adjustment_pct = Math.round(
      (cumulative_price_adjustment_pct + totalAdjThisIter) * 10_000
    ) / 10_000
    cumulative_capital_reallocation_eur += signals.capital_reallocated_eur

    const converged = checkConvergence(signals.capital_reallocated_eur, state.total_active_capital_eur)

    const iteration: FeedbackLoopIteration = {
      tenant_id: tenantId,
      iteration: i,
      state: {
        total_active_capital_eur:  state.total_active_capital_eur,
        avg_clearing_price_eur:    state.avg_clearing_price_eur,
        active_investor_count:     state.active_investor_count,
        avg_liquidity_score:       state.avg_liquidity_score,
        market_temperature:        state.market_temperature,
      },
      signals,
      converged,
      computed_at: new Date().toISOString(),
    }

    iterations.push(iteration)

    log.info('[LiquidityFeedbackLoop] iteration complete', {
      iteration: i,
      capital_reallocated_eur: signals.capital_reallocated_eur,
      demand_shifted_investors: signals.demand_shifted_investors,
      converged,
    })

    if (converged) {
      convergence_iteration = i
      break
    }
  }

  const finalIteration = iterations[iterations.length - 1]
  const finalState = finalIteration?.state ?? {
    total_active_capital_eur: 0,
    avg_clearing_price_eur: 0,
    active_investor_count: 0,
    avg_liquidity_score: 0,
    market_temperature: 0,
  }

  const result: FeedbackLoopResult = {
    tenant_id:                          tenantId,
    total_iterations:                   iterations.length,
    converged:                          convergence_iteration != null,
    convergence_iteration,
    final_state:                        finalState,
    cumulative_price_adjustment_pct:    Math.round(cumulative_price_adjustment_pct * 10_000) / 10_000,
    cumulative_capital_reallocation_eur: Math.round(cumulative_capital_reallocation_eur * 100) / 100,
    equilibrium_market_temperature:     finalState.market_temperature,
    loop_duration_ms:                   Date.now() - t0,
    ran_at,
  }

  log.info('[LiquidityFeedbackLoop] loop complete', {
    tenant_id: tenantId,
    total_iterations: result.total_iterations,
    converged: result.converged,
    convergence_iteration: result.convergence_iteration,
    cumulative_price_adjustment_pct: result.cumulative_price_adjustment_pct,
    cumulative_capital_reallocation_eur: result.cumulative_capital_reallocation_eur,
    equilibrium_market_temperature: result.equilibrium_market_temperature,
    loop_duration_ms: result.loop_duration_ms,
  })

  return result
}

// ─── persistFeedbackLoopResult ────────────────────────────────────────────────

export async function persistFeedbackLoopResult(result: FeedbackLoopResult): Promise<void> {
  void (supabaseAdmin as any)
    .from('feedback_loop_runs')
    .insert({
      tenant_id:                          result.tenant_id,
      total_iterations:                   result.total_iterations,
      converged:                          result.converged,
      convergence_iteration:              result.convergence_iteration,
      final_state:                        result.final_state,
      cumulative_price_adjustment_pct:    result.cumulative_price_adjustment_pct,
      cumulative_capital_reallocation_eur: result.cumulative_capital_reallocation_eur,
      equilibrium_market_temperature:     result.equilibrium_market_temperature,
      loop_duration_ms:                   result.loop_duration_ms,
      ran_at:                             result.ran_at,
    })
    .then(({ error }: { error: { message: string } | null }) => {
      if (error) {
        log.warn('[LiquidityFeedbackLoop] persistFeedbackLoopResult error', {
          error: error.message,
          tenant_id: result.tenant_id,
        })
      }
    })
    .catch((err: unknown) => {
      log.warn('[LiquidityFeedbackLoop] persistFeedbackLoopResult threw', {
        error: err instanceof Error ? err.message : String(err),
        tenant_id: result.tenant_id,
      })
    })
}
