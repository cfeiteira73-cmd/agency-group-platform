// =============================================================================
// Agency Group — Business & Market Simulation Engine
// lib/intelligence/businessSimulation.ts
//
// Phase 4: Full Business & Market Simulation Engine
//
// Simulates the complete pipeline impact of model/strategy changes:
//   ingestion → scoring → routing → conversion → revenue
//
// Also models external market scenarios:
//   downturn, upturn, supply_shock, pricing_compression,
//   agent_shift, investor_shift
//
// All functions are PURE — no DB calls, fully unit testable.
//
// PURE FUNCTIONS:
//   simulateIngestionFunnel, simulateConversionRevenue,
//   simulateMarketScenario, computeRevenueImpact,
//   computeCapacityDelta, buildScenarioSensitivityTable
// =============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MarketScenarioType =
  | 'upturn'
  | 'downturn'
  | 'supply_shock'
  | 'pricing_compression'
  | 'agent_shift'
  | 'investor_shift'
  | 'baseline'

export interface FunnelStage {
  stage:         string
  input_count:   number
  output_count:  number
  pass_rate_pct: number
}

export interface FunnelOutput {
  stages:        FunnelStage[]
  total_leads:   number
  qualified:     number
  scored:        number
  routed:        number
  converted:     number
  pipeline_value: number
}

export interface RevenueOutput {
  deals_count:         number
  conversion_rate_pct: number
  avg_deal_value:      number
  avg_commission:      number
  total_gross_revenue: number
  total_net_revenue:   number
  confidence_band_low:  number
  confidence_band_high: number
}

export interface MarketScenarioAssumptions {
  price_delta_pct:       number    // e.g. -15 for downturn
  volume_delta_pct:      number    // listing volume change
  conversion_delta_pct:  number    // conversion rate change
  time_to_close_delta_pct: number  // +20 = 20% slower
  demand_supply_ratio:   number    // > 1 = seller market, < 1 = buyer market
}

export interface ScenarioResult {
  scenario:            MarketScenarioType
  assumptions:         MarketScenarioAssumptions
  funnel:              FunnelOutput
  revenue:             RevenueOutput
  revenue_delta_pct:   number      // vs baseline
  conversion_delta_pct: number
  capacity_delta_pct:  number
}

export interface RevenueDelta {
  before_revenue:     number
  after_revenue:      number
  absolute_delta:     number
  relative_delta_pct: number
  annualized_impact:  number
}

export interface CapacityDelta {
  before_capacity_pct: number    // 0-100 utilization
  after_capacity_pct:  number
  delta_pct:           number
  bottleneck:          string | null
}

export interface BaselineMetrics {
  total_leads_per_month:     number
  qualify_rate_pct:          number    // e.g. 40
  scoring_pass_rate_pct:     number    // e.g. 60
  routing_rate_pct:          number    // e.g. 80
  conversion_rate_pct:       number    // e.g. 5
  avg_deal_value:            number
  avg_commission_pct:        number    // e.g. 5
  avg_time_to_close_days:    number
}

// ---------------------------------------------------------------------------
// SCENARIO PARAMETER LIBRARY
// ---------------------------------------------------------------------------

const SCENARIO_PARAMS: Record<MarketScenarioType, MarketScenarioAssumptions> = {
  baseline: {
    price_delta_pct:         0,
    volume_delta_pct:        0,
    conversion_delta_pct:    0,
    time_to_close_delta_pct: 0,
    demand_supply_ratio:     1.0,
  },
  upturn: {
    price_delta_pct:         12,
    volume_delta_pct:        20,
    conversion_delta_pct:    15,
    time_to_close_delta_pct: -15,    // faster closes
    demand_supply_ratio:     1.4,
  },
  downturn: {
    price_delta_pct:         -18,
    volume_delta_pct:        -30,
    conversion_delta_pct:    -25,
    time_to_close_delta_pct: 30,     // slower closes
    demand_supply_ratio:     0.6,
  },
  supply_shock: {
    price_delta_pct:         8,
    volume_delta_pct:        -40,    // listings drop dramatically
    conversion_delta_pct:    10,
    time_to_close_delta_pct: -10,
    demand_supply_ratio:     1.8,
  },
  pricing_compression: {
    price_delta_pct:         -8,
    volume_delta_pct:        5,
    conversion_delta_pct:    -10,
    time_to_close_delta_pct: 15,
    demand_supply_ratio:     0.9,
  },
  agent_shift: {
    price_delta_pct:         0,
    volume_delta_pct:        0,
    conversion_delta_pct:    20,     // better agents → higher conversion
    time_to_close_delta_pct: -20,
    demand_supply_ratio:     1.0,
  },
  investor_shift: {
    price_delta_pct:         5,
    volume_delta_pct:        10,
    conversion_delta_pct:    25,     // investor wave → higher conversion
    time_to_close_delta_pct: -10,
    demand_supply_ratio:     1.2,
  },
}

// ---------------------------------------------------------------------------
// PURE: Simulate ingestion funnel
// ---------------------------------------------------------------------------

export function simulateIngestionFunnel(
  baseline:    BaselineMetrics,
  assumptions: MarketScenarioAssumptions,
): FunnelOutput {
  const volumeMultiplier = 1 + (assumptions.volume_delta_pct / 100)
  const convMultiplier   = 1 + (assumptions.conversion_delta_pct / 100)

  const totalLeads   = Math.round(baseline.total_leads_per_month * volumeMultiplier)
  const qualifyRate  = baseline.qualify_rate_pct / 100
  const qualifiedN   = Math.round(totalLeads * qualifyRate)
  const scoringRate  = baseline.scoring_pass_rate_pct / 100
  const scoredN      = Math.round(qualifiedN * scoringRate)
  const routingRate  = baseline.routing_rate_pct / 100
  const routedN      = Math.round(scoredN * routingRate)
  const baseConvRate = baseline.conversion_rate_pct / 100
  const adjConvRate  = Math.max(0, Math.min(0.5, baseConvRate * convMultiplier))
  const convertedN   = Math.round(routedN * adjConvRate)

  const priceMult     = 1 + (assumptions.price_delta_pct / 100)
  const adjDealValue  = baseline.avg_deal_value * priceMult
  const pipelineValue = routedN * adjDealValue

  const stages: FunnelStage[] = [
    { stage: 'ingestion',  input_count: totalLeads,  output_count: qualifiedN,  pass_rate_pct: Math.round(qualifyRate * 100)  },
    { stage: 'scoring',    input_count: qualifiedN,  output_count: scoredN,     pass_rate_pct: Math.round(scoringRate * 100)  },
    { stage: 'routing',    input_count: scoredN,     output_count: routedN,     pass_rate_pct: Math.round(routingRate * 100)  },
    { stage: 'conversion', input_count: routedN,     output_count: convertedN,  pass_rate_pct: Math.round(adjConvRate * 100)  },
  ]

  return {
    stages,
    total_leads:    totalLeads,
    qualified:      qualifiedN,
    scored:         scoredN,
    routed:         routedN,
    converted:      convertedN,
    pipeline_value: Math.round(pipelineValue),
  }
}

// ---------------------------------------------------------------------------
// PURE: Simulate revenue from conversion
// ---------------------------------------------------------------------------

export function simulateConversionRevenue(
  funnel:      FunnelOutput,
  baseline:    BaselineMetrics,
  assumptions: MarketScenarioAssumptions,
): RevenueOutput {
  const priceMult      = 1 + (assumptions.price_delta_pct / 100)
  const adjDealValue   = baseline.avg_deal_value * priceMult
  const avgCommission  = adjDealValue * (baseline.avg_commission_pct / 100)
  const totalGross     = funnel.converted * avgCommission
  const netRevenue     = totalGross * 0.7   // 70% after costs — standard
  const convRatePct    = funnel.routed > 0 ? funnel.converted / funnel.routed * 100 : 0

  // Confidence band: ±15% from uncertainty
  const uncertainty = 0.15
  return {
    deals_count:          funnel.converted,
    conversion_rate_pct:  Math.round(convRatePct * 100) / 100,
    avg_deal_value:       Math.round(adjDealValue),
    avg_commission:       Math.round(avgCommission),
    total_gross_revenue:  Math.round(totalGross),
    total_net_revenue:    Math.round(netRevenue),
    confidence_band_low:  Math.round(totalGross * (1 - uncertainty)),
    confidence_band_high: Math.round(totalGross * (1 + uncertainty)),
  }
}

// ---------------------------------------------------------------------------
// PURE: Simulate full market scenario
// ---------------------------------------------------------------------------

export function simulateMarketScenario(
  scenario:       MarketScenarioType,
  baselineMetrics: BaselineMetrics,
  customAssumptions?: Partial<MarketScenarioAssumptions>,
): ScenarioResult {
  const assumptions: MarketScenarioAssumptions = {
    ...SCENARIO_PARAMS[scenario],
    ...customAssumptions,
  }

  const funnel  = simulateIngestionFunnel(baselineMetrics, assumptions)
  const revenue = simulateConversionRevenue(funnel, baselineMetrics, assumptions)

  // Compute deltas vs baseline
  const baselineFunnel  = simulateIngestionFunnel(baselineMetrics, SCENARIO_PARAMS.baseline)
  const baselineRevenue = simulateConversionRevenue(baselineFunnel, baselineMetrics, SCENARIO_PARAMS.baseline)

  const revDelta  = baselineRevenue.total_gross_revenue > 0
    ? (revenue.total_gross_revenue - baselineRevenue.total_gross_revenue) / baselineRevenue.total_gross_revenue * 100
    : 0

  const convDelta = baselineRevenue.conversion_rate_pct > 0
    ? (revenue.conversion_rate_pct - baselineRevenue.conversion_rate_pct) / baselineRevenue.conversion_rate_pct * 100
    : 0

  const capDelta  = baselineFunnel.routed > 0
    ? (funnel.routed - baselineFunnel.routed) / baselineFunnel.routed * 100
    : 0

  return {
    scenario,
    assumptions,
    funnel,
    revenue,
    revenue_delta_pct:    Math.round(revDelta * 100) / 100,
    conversion_delta_pct: Math.round(convDelta * 100) / 100,
    capacity_delta_pct:   Math.round(capDelta * 100) / 100,
  }
}

// ---------------------------------------------------------------------------
// PURE: Compute revenue impact between two scenarios
// ---------------------------------------------------------------------------

export function computeRevenueImpact(
  before: RevenueOutput,
  after:  RevenueOutput,
): RevenueDelta {
  const absolute = after.total_gross_revenue - before.total_gross_revenue
  const relative = before.total_gross_revenue > 0
    ? absolute / before.total_gross_revenue * 100
    : 0
  return {
    before_revenue:     before.total_gross_revenue,
    after_revenue:      after.total_gross_revenue,
    absolute_delta:     Math.round(absolute),
    relative_delta_pct: Math.round(relative * 100) / 100,
    annualized_impact:  Math.round(absolute * 12),   // monthly → annual
  }
}

// ---------------------------------------------------------------------------
// PURE: Compute capacity delta (routing throughput change)
// ---------------------------------------------------------------------------

export function computeCapacityDelta(
  beforeFunnel: FunnelOutput,
  afterFunnel:  FunnelOutput,
): CapacityDelta {
  // Capacity expressed as percentage of max theoretical throughput
  const maxTheoreticalRouted = Math.max(beforeFunnel.total_leads, afterFunnel.total_leads)
  const beforeCapPct = maxTheoreticalRouted > 0 ? beforeFunnel.routed / maxTheoreticalRouted * 100 : 0
  const afterCapPct  = maxTheoreticalRouted > 0 ? afterFunnel.routed  / maxTheoreticalRouted * 100 : 0
  const delta        = afterCapPct - beforeCapPct

  // Find bottleneck stage (lowest pass rate in after scenario)
  const bottleneckStage = afterFunnel.stages.reduce(
    (min, s) => s.pass_rate_pct < min.pass_rate_pct ? s : min,
    afterFunnel.stages[0],
  )

  return {
    before_capacity_pct: Math.round(beforeCapPct * 100) / 100,
    after_capacity_pct:  Math.round(afterCapPct * 100) / 100,
    delta_pct:           Math.round(delta * 100) / 100,
    bottleneck:          bottleneckStage ? bottleneckStage.stage : null,
  }
}

// ---------------------------------------------------------------------------
// PURE: Build sensitivity table across all scenarios
// ---------------------------------------------------------------------------

export function buildScenarioSensitivityTable(
  baseline: BaselineMetrics,
): ScenarioResult[] {
  const scenarios: MarketScenarioType[] = [
    'baseline', 'upturn', 'downturn', 'supply_shock',
    'pricing_compression', 'agent_shift', 'investor_shift',
  ]
  return scenarios.map(s => simulateMarketScenario(s, baseline))
}
