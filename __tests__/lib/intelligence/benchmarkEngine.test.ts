// =============================================================================
// Tests — lib/intelligence/benchmarkEngine.ts  (pure functions only)
// =============================================================================

import { describe, it, expect } from 'vitest'

import {
  computeBaselineAccuracy,
  computeSystemAccuracy,
  computeUplift,
  computeConversionUplift,
  computeSpeedUplift,
  computeRoutingUplift,
  computeStatisticalSignificance,
  buildBenchmarkReport,
} from '../../../lib/intelligence/benchmarkEngine'
import type { BenchmarkComparison } from '../../../lib/intelligence/benchmarkEngine'

// ---------------------------------------------------------------------------
// computeBaselineAccuracy
// ---------------------------------------------------------------------------

describe('computeBaselineAccuracy', () => {
  it('empty list → zeros', () => {
    const r = computeBaselineAccuracy([])
    expect(r.mean).toBe(0)
    expect(r.mae).toBe(0)
    expect(r.accuracy_pct).toBe(0)
  })

  it('uniform list → mae = 0', () => {
    const r = computeBaselineAccuracy([50, 50, 50, 50])
    expect(r.mae).toBe(0)
    expect(r.mean).toBe(50)
  })

  it('spread list → mae > 0', () => {
    const r = computeBaselineAccuracy([10, 90, 10, 90])
    expect(r.mae).toBeGreaterThan(0)
  })

  it('mean is correctly computed', () => {
    const r = computeBaselineAccuracy([60, 80, 70])
    expect(r.mean).toBeCloseTo(70, 1)
  })
})

// ---------------------------------------------------------------------------
// computeSystemAccuracy
// ---------------------------------------------------------------------------

describe('computeSystemAccuracy', () => {
  it('empty → zeros', () => {
    const r = computeSystemAccuracy([], [])
    expect(r.mae).toBe(0)
    expect(r.accuracy_pct).toBe(0)
  })

  it('length mismatch → zeros', () => {
    const r = computeSystemAccuracy([1, 2, 3], [1, 2])
    expect(r.mae).toBe(0)
  })

  it('perfect predictions → mae = 0, accuracy = 100', () => {
    const outcomes = [60, 70, 80, 90]
    const r        = computeSystemAccuracy(outcomes, outcomes)
    expect(r.mae).toBe(0)
    expect(r.accuracy_pct).toBe(100)
  })

  it('RMSE ≥ MAE (by definition)', () => {
    const predictions = [65, 72, 85, 88]
    const outcomes    = [60, 70, 80, 90]
    const r           = computeSystemAccuracy(predictions, outcomes)
    expect(r.rmse).toBeGreaterThanOrEqual(r.mae)
  })
})

// ---------------------------------------------------------------------------
// computeUplift
// ---------------------------------------------------------------------------

describe('computeUplift', () => {
  it('improvement → positive uplift', () => {
    const r = computeUplift(50, 70)
    expect(r.relative_uplift_pct).toBeGreaterThan(0)
    expect(r.absolute_improvement).toBeGreaterThan(0)
  })

  it('no change → 0 uplift', () => {
    const r = computeUplift(50, 50)
    expect(r.relative_uplift_pct).toBe(0)
    expect(r.is_significant).toBe(false)
  })

  it('lowerIsBetter=true: lower system = positive uplift', () => {
    const r = computeUplift(100, 80, true)   // 80 < 100 = improvement
    expect(r.relative_uplift_pct).toBeGreaterThan(0)
  })

  it('≥5% relative → is_significant = true', () => {
    const r = computeUplift(100, 106)
    expect(r.is_significant).toBe(true)
  })

  it('<5% relative → is_significant = false', () => {
    const r = computeUplift(100, 103)
    expect(r.is_significant).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// computeConversionUplift
// ---------------------------------------------------------------------------

describe('computeConversionUplift', () => {
  it('higher system conversion → positive uplift', () => {
    const r = computeConversionUplift(5, 8)
    expect(r.relative_uplift_pct).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// computeSpeedUplift
// ---------------------------------------------------------------------------

describe('computeSpeedUplift', () => {
  it('faster system (lower days) → positive uplift', () => {
    const r = computeSpeedUplift(90, 70)   // 70 < 90 = faster = better
    expect(r.relative_uplift_pct).toBeGreaterThan(0)
  })

  it('slower system → negative uplift', () => {
    const r = computeSpeedUplift(70, 90)
    expect(r.relative_uplift_pct).toBeLessThan(0)
  })
})

// ---------------------------------------------------------------------------
// computeRoutingUplift
// ---------------------------------------------------------------------------

describe('computeRoutingUplift', () => {
  it('better precision → positive uplift', () => {
    const r = computeRoutingUplift(0.05, 0.25)   // broadcast vs targeted
    expect(r.relative_uplift_pct).toBeGreaterThan(0)
    expect(r.is_significant).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// computeStatisticalSignificance
// ---------------------------------------------------------------------------

describe('computeStatisticalSignificance', () => {
  it('insufficient data → not significant', () => {
    const r = computeStatisticalSignificance([50], [60])
    expect(r.is_significant).toBe(false)
  })

  it('identical distributions → not significant', () => {
    const data = [50, 55, 48, 52, 51]
    const r    = computeStatisticalSignificance(data, data)
    expect(r.effect_size).toBeCloseTo(0, 2)
  })

  it('large effect size (Cohen d ≥ 0.8) → large interpretation', () => {
    // Very different distributions
    const baseline = [50, 50, 50, 50, 50]
    const system   = [80, 82, 78, 81, 79]
    const r        = computeStatisticalSignificance(baseline, system)
    expect(r.effect_size).toBeGreaterThanOrEqual(0.8)
    expect(r.interpretation).toBe('large')
  })

  it('confidence_pct is 0-100', () => {
    const r = computeStatisticalSignificance([50, 55, 48], [70, 72, 68])
    expect(r.confidence_pct).toBeGreaterThanOrEqual(0)
    expect(r.confidence_pct).toBeLessThanOrEqual(100)
  })
})

// ---------------------------------------------------------------------------
// buildBenchmarkReport
// ---------------------------------------------------------------------------

describe('buildBenchmarkReport', () => {
  const sampleComparisons: BenchmarkComparison[] = [
    { dimension: 'conversion', baseline: 'random', baseline_value: 3, system_value: 7, uplift_pct: 133, is_significant: true,  sample_size: 100 },
    { dimension: 'speed',      baseline: 'human',  baseline_value: 90, system_value: 70, uplift_pct: 22, is_significant: true,  sample_size: 80  },
    { dimension: 'avm_mae',    baseline: 'market',  baseline_value: 12, system_value: 7, uplift_pct: 42, is_significant: false, sample_size: 50  },
  ]

  it('returns report with all fields', () => {
    const r = buildBenchmarkReport('Q1 2026', 200, sampleComparisons)
    expect(r.comparisons).toHaveLength(3)
    expect(r.period_label).toBe('Q1 2026')
    expect(r.sample_size).toBe(200)
    expect(r.overall_uplift_score).toBeGreaterThanOrEqual(0)
    expect(r.overall_uplift_score).toBeLessThanOrEqual(100)
  })

  it('strong uplift → superior verdict', () => {
    const r = buildBenchmarkReport('Q1', 200, sampleComparisons)
    expect(['superior', 'competitive']).toContain(r.verdict)
  })

  it('headline includes verdict and score', () => {
    const r = buildBenchmarkReport('Q1', 200, sampleComparisons)
    expect(r.headline).toContain('/100')
  })

  it('empty comparisons → at_parity or underperforming', () => {
    const r = buildBenchmarkReport('Q1', 0, [])
    expect(r.overall_uplift_score).toBe(50)   // neutral when no data
  })
})
