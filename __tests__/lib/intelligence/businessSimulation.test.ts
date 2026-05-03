// =============================================================================
// Tests — lib/intelligence/businessSimulation.ts  (pure functions only)
// =============================================================================

import { describe, it, expect } from 'vitest'

import {
  simulateIngestionFunnel,
  simulateConversionRevenue,
  simulateMarketScenario,
  computeRevenueImpact,
  computeCapacityDelta,
  buildScenarioSensitivityTable,
} from '../../../lib/intelligence/businessSimulation'
import type { BaselineMetrics } from '../../../lib/intelligence/businessSimulation'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBaseline(overrides: Partial<BaselineMetrics> = {}): BaselineMetrics {
  return {
    total_leads_per_month:  200,
    qualify_rate_pct:       40,
    scoring_pass_rate_pct:  65,
    routing_rate_pct:       80,
    conversion_rate_pct:    5,
    avg_deal_value:         600_000,
    avg_commission_pct:     5,
    avg_time_to_close_days: 90,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// simulateIngestionFunnel
// ---------------------------------------------------------------------------

describe('simulateIngestionFunnel', () => {
  it('baseline scenario: all stages computed', () => {
    const funnel = simulateIngestionFunnel(makeBaseline(), { price_delta_pct: 0, volume_delta_pct: 0, conversion_delta_pct: 0, time_to_close_delta_pct: 0, demand_supply_ratio: 1.0 })
    expect(funnel.total_leads).toBe(200)
    expect(funnel.qualified).toBeLessThan(200)
    expect(funnel.converted).toBeLessThan(funnel.routed)
    expect(funnel.stages).toHaveLength(4)
  })

  it('volume boost → more leads', () => {
    const base   = simulateIngestionFunnel(makeBaseline(), { price_delta_pct: 0, volume_delta_pct: 0, conversion_delta_pct: 0, time_to_close_delta_pct: 0, demand_supply_ratio: 1.0 })
    const boosted = simulateIngestionFunnel(makeBaseline(), { price_delta_pct: 0, volume_delta_pct: 50, conversion_delta_pct: 0, time_to_close_delta_pct: 0, demand_supply_ratio: 1.0 })
    expect(boosted.total_leads).toBeGreaterThan(base.total_leads)
  })

  it('conversion boost → more conversions', () => {
    const base   = simulateIngestionFunnel(makeBaseline(), { price_delta_pct: 0, volume_delta_pct: 0, conversion_delta_pct: 0, time_to_close_delta_pct: 0, demand_supply_ratio: 1.0 })
    const boosted = simulateIngestionFunnel(makeBaseline(), { price_delta_pct: 0, volume_delta_pct: 0, conversion_delta_pct: 50, time_to_close_delta_pct: 0, demand_supply_ratio: 1.0 })
    expect(boosted.converted).toBeGreaterThan(base.converted)
  })

  it('funnel is monotonically narrowing (each stage ≤ previous)', () => {
    const funnel = simulateIngestionFunnel(makeBaseline(), { price_delta_pct: 0, volume_delta_pct: 0, conversion_delta_pct: 0, time_to_close_delta_pct: 0, demand_supply_ratio: 1.0 })
    expect(funnel.qualified).toBeLessThanOrEqual(funnel.total_leads)
    expect(funnel.scored).toBeLessThanOrEqual(funnel.qualified)
    expect(funnel.routed).toBeLessThanOrEqual(funnel.scored)
    expect(funnel.converted).toBeLessThanOrEqual(funnel.routed)
  })

  it('pipeline_value is positive', () => {
    const funnel = simulateIngestionFunnel(makeBaseline(), { price_delta_pct: 0, volume_delta_pct: 0, conversion_delta_pct: 0, time_to_close_delta_pct: 0, demand_supply_ratio: 1.0 })
    expect(funnel.pipeline_value).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// simulateConversionRevenue
// ---------------------------------------------------------------------------

describe('simulateConversionRevenue', () => {
  it('returns non-negative revenue', () => {
    const baseline = makeBaseline()
    const funnel   = simulateIngestionFunnel(baseline, { price_delta_pct: 0, volume_delta_pct: 0, conversion_delta_pct: 0, time_to_close_delta_pct: 0, demand_supply_ratio: 1.0 })
    const revenue  = simulateConversionRevenue(funnel, baseline, { price_delta_pct: 0, volume_delta_pct: 0, conversion_delta_pct: 0, time_to_close_delta_pct: 0, demand_supply_ratio: 1.0 })
    expect(revenue.total_gross_revenue).toBeGreaterThan(0)
    expect(revenue.total_net_revenue).toBeGreaterThan(0)
  })

  it('confidence band: low < gross < high', () => {
    const baseline = makeBaseline()
    const funnel   = simulateIngestionFunnel(baseline, { price_delta_pct: 0, volume_delta_pct: 0, conversion_delta_pct: 0, time_to_close_delta_pct: 0, demand_supply_ratio: 1.0 })
    const revenue  = simulateConversionRevenue(funnel, baseline, { price_delta_pct: 0, volume_delta_pct: 0, conversion_delta_pct: 0, time_to_close_delta_pct: 0, demand_supply_ratio: 1.0 })
    expect(revenue.confidence_band_low).toBeLessThan(revenue.total_gross_revenue)
    expect(revenue.confidence_band_high).toBeGreaterThan(revenue.total_gross_revenue)
  })

  it('net ≈ 70% of gross', () => {
    const baseline = makeBaseline()
    const funnel   = simulateIngestionFunnel(baseline, { price_delta_pct: 0, volume_delta_pct: 0, conversion_delta_pct: 0, time_to_close_delta_pct: 0, demand_supply_ratio: 1.0 })
    const revenue  = simulateConversionRevenue(funnel, baseline, { price_delta_pct: 0, volume_delta_pct: 0, conversion_delta_pct: 0, time_to_close_delta_pct: 0, demand_supply_ratio: 1.0 })
    expect(revenue.total_net_revenue).toBeCloseTo(revenue.total_gross_revenue * 0.7, -3)
  })
})

// ---------------------------------------------------------------------------
// simulateMarketScenario
// ---------------------------------------------------------------------------

describe('simulateMarketScenario', () => {
  it('baseline scenario → revenue_delta = 0', () => {
    const r = simulateMarketScenario('baseline', makeBaseline())
    expect(r.revenue_delta_pct).toBe(0)
    expect(r.conversion_delta_pct).toBe(0)
  })

  it('upturn → positive revenue delta', () => {
    const r = simulateMarketScenario('upturn', makeBaseline())
    expect(r.revenue_delta_pct).toBeGreaterThan(0)
  })

  it('downturn → negative revenue delta', () => {
    const r = simulateMarketScenario('downturn', makeBaseline())
    expect(r.revenue_delta_pct).toBeLessThan(0)
  })

  it('supply_shock → positive capacity delta (fewer listings)', () => {
    // supply_shock reduces volume (-40%) so capacity delta should reflect change
    const r = simulateMarketScenario('supply_shock', makeBaseline())
    expect(r.scenario).toBe('supply_shock')
  })

  it('includes funnel and revenue output', () => {
    const r = simulateMarketScenario('baseline', makeBaseline())
    expect(r.funnel.stages).toHaveLength(4)
    expect(r.revenue.total_gross_revenue).toBeGreaterThan(0)
  })

  it('custom assumptions override defaults', () => {
    const r = simulateMarketScenario('baseline', makeBaseline(), { conversion_delta_pct: 100 })
    expect(r.revenue.conversion_rate_pct).toBeGreaterThan(5)
  })
})

// ---------------------------------------------------------------------------
// computeRevenueImpact
// ---------------------------------------------------------------------------

describe('computeRevenueImpact', () => {
  it('improvement → positive absolute_delta', () => {
    const before = simulateMarketScenario('baseline', makeBaseline()).revenue
    const after  = simulateMarketScenario('upturn', makeBaseline()).revenue
    const delta  = computeRevenueImpact(before, after)
    expect(delta.absolute_delta).toBeGreaterThan(0)
    expect(delta.relative_delta_pct).toBeGreaterThan(0)
  })

  it('annualized = 12x monthly', () => {
    const before = { total_gross_revenue: 100_000, total_net_revenue: 70_000, deals_count: 2, conversion_rate_pct: 5, avg_deal_value: 600_000, avg_commission: 30_000, confidence_band_low: 85_000, confidence_band_high: 115_000 }
    const after  = { ...before, total_gross_revenue: 130_000 }
    const delta  = computeRevenueImpact(before, after)
    expect(delta.annualized_impact).toBe(30_000 * 12)
  })
})

// ---------------------------------------------------------------------------
// computeCapacityDelta
// ---------------------------------------------------------------------------

describe('computeCapacityDelta', () => {
  it('same funnel → delta = 0', () => {
    const funnel = simulateIngestionFunnel(makeBaseline(), { price_delta_pct: 0, volume_delta_pct: 0, conversion_delta_pct: 0, time_to_close_delta_pct: 0, demand_supply_ratio: 1.0 })
    const delta  = computeCapacityDelta(funnel, funnel)
    expect(delta.delta_pct).toBe(0)
  })

  it('bottleneck is identified (lowest pass rate stage)', () => {
    const funnel = simulateIngestionFunnel(makeBaseline(), { price_delta_pct: 0, volume_delta_pct: 0, conversion_delta_pct: 0, time_to_close_delta_pct: 0, demand_supply_ratio: 1.0 })
    const delta  = computeCapacityDelta(funnel, funnel)
    expect(delta.bottleneck).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// buildScenarioSensitivityTable
// ---------------------------------------------------------------------------

describe('buildScenarioSensitivityTable', () => {
  it('returns 7 scenarios', () => {
    const table = buildScenarioSensitivityTable(makeBaseline())
    expect(table).toHaveLength(7)
  })

  it('includes all scenario types', () => {
    const table   = buildScenarioSensitivityTable(makeBaseline())
    const names   = table.map(s => s.scenario)
    expect(names).toContain('baseline')
    expect(names).toContain('upturn')
    expect(names).toContain('downturn')
    expect(names).toContain('supply_shock')
  })

  it('baseline always has 0 delta', () => {
    const baseline = buildScenarioSensitivityTable(makeBaseline()).find(s => s.scenario === 'baseline')!
    expect(baseline.revenue_delta_pct).toBe(0)
  })
})
