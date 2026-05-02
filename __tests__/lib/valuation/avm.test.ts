// =============================================================================
// AVM Engine Tests
// __tests__/lib/valuation/avm.test.ts
//
// Tests for PURE functions in lib/valuation/avm.ts:
//   computeZoneBenchmarkValue, applyPropertyAdjustments,
//   rejectOutliers, weightedAverage, computeConfidence, computeAVM
// =============================================================================

import { describe, it, expect, vi } from 'vitest'

// Mock supabase — avm.ts imports it at module level for DB functions.
// Tests here only cover pure functions; DB functions are excluded.
vi.mock('../../../lib/supabase', () => ({
  supabaseAdmin: {},
  supabase:      {},
}))

import {
  computeZoneBenchmarkValue,
  applyPropertyAdjustments,
  rejectOutliers,
  weightedAverage,
  computeConfidence,
  computeAVM,
  type AVMInput,
} from '../../../lib/valuation/avm'
import type { ZoneMarket } from '../../../lib/market/zones'

// ---------------------------------------------------------------------------
// Shared fixture: Lisboa zone
// pm2_trans=5000, renda_m2=18.5, yield_bruto=4.4, dias_mercado=45, demanda=9
// ---------------------------------------------------------------------------

const LISBOA_ZONE: ZoneMarket = {
  pm2_trans:          5000,
  pm2_ask:            5400,
  var_yoy:            22.0,
  var_qtq:            5.5,
  renda_m2:           18.5,
  yield_bruto:        4.4,
  yield_al:           6.8,
  abs_meses:          1.8,
  dias_mercado:       45,
  comp_int_pct:       38,
  demanda:            9.0,
  liquidez:           8.5,
  risco:              3.5,
  construcao_novo_m2: 1800,
  region:             'Lisboa',
}

// ---------------------------------------------------------------------------
// computeZoneBenchmarkValue
// ---------------------------------------------------------------------------

describe('computeZoneBenchmarkValue', () => {
  it('computes pm2_trans × area when area provided', () => {
    const result = computeZoneBenchmarkValue(LISBOA_ZONE, 100)
    expect(result.value).toBe(500_000)     // 5000 × 100
    expect(result.has_area).toBe(true)
  })

  it('uses 80m² fallback when area is null', () => {
    const result = computeZoneBenchmarkValue(LISBOA_ZONE, null)
    expect(result.value).toBe(400_000)     // 5000 × 80
    expect(result.has_area).toBe(false)
  })

  it('uses 80m² fallback when area is 0', () => {
    const result = computeZoneBenchmarkValue(LISBOA_ZONE, 0)
    expect(result.value).toBe(400_000)
    expect(result.has_area).toBe(false)
  })

  it('uses 80m² fallback when area is undefined', () => {
    const result = computeZoneBenchmarkValue(LISBOA_ZONE, undefined)
    expect(result.has_area).toBe(false)
  })

  it('rounds to nearest integer', () => {
    const result = computeZoneBenchmarkValue(LISBOA_ZONE, 77)
    // 5000 × 77 = 385,000 (exact)
    expect(result.value).toBe(385_000)
  })
})

// ---------------------------------------------------------------------------
// applyPropertyAdjustments
// ---------------------------------------------------------------------------

describe('applyPropertyAdjustments', () => {
  it('applies new-build condition premium (+10%)', () => {
    const r = applyPropertyAdjustments(500_000, 'new', 2)
    expect(r.condition_mult).toBe(1.10)
    expect(r.adjusted).toBe(550_000)   // 500k × 1.10 × 1.00
  })

  it('applies ruin discount (−45%)', () => {
    const r = applyPropertyAdjustments(500_000, 'ruin', 2)
    expect(r.condition_mult).toBe(0.55)
    expect(r.adjusted).toBe(275_000)
  })

  it('applies needs_renovation discount (−20%)', () => {
    const r = applyPropertyAdjustments(500_000, 'needs_renovation', 2)
    expect(r.condition_mult).toBe(0.80)
    expect(r.adjusted).toBe(400_000)
  })

  it('applies studio bedroom discount (×0.85)', () => {
    const r = applyPropertyAdjustments(500_000, 'good', 0)
    expect(r.bedroom_mult).toBe(0.85)
    expect(r.adjusted).toBe(425_000)
  })

  it('T2/T3 is baseline (×1.00)', () => {
    const r = applyPropertyAdjustments(500_000, 'good', 2)
    expect(r.bedroom_mult).toBe(1.00)
    expect(r.adjusted).toBe(500_000)
  })

  it('combines condition and bedroom multipliers', () => {
    // excellent (×1.04) + studio (×0.85) = ×0.884
    const r = applyPropertyAdjustments(500_000, 'excellent', 0)
    expect(r.adjusted).toBe(Math.round(500_000 * 1.04 * 0.85))
  })

  it('defaults to good condition when null', () => {
    const r = applyPropertyAdjustments(500_000, null, null)
    expect(r.condition_mult).toBe(1.00)
    expect(r.bedroom_mult).toBe(1.00)
    expect(r.adjusted).toBe(500_000)
  })
})

// ---------------------------------------------------------------------------
// rejectOutliers
// ---------------------------------------------------------------------------

describe('rejectOutliers', () => {
  it('keeps all values when fewer than 4 elements', () => {
    const { kept, rejected } = rejectOutliers([100, 200, 300])
    expect(kept).toEqual([100, 200, 300])
    expect(rejected).toEqual([])
  })

  it('keeps all values when fewer than 4 elements (2 items)', () => {
    const { kept } = rejectOutliers([200_000, 300_000])
    expect(kept.length).toBe(2)
  })

  it('removes extreme outlier above upper fence', () => {
    // Values: 100, 110, 120, 130, 140, 1_000_000 (extreme outlier)
    const { kept, rejected } = rejectOutliers([100, 110, 120, 130, 140, 1_000_000])
    expect(rejected).toContain(1_000_000)
    expect(kept).not.toContain(1_000_000)
  })

  it('removes extreme outlier below lower fence', () => {
    const { kept, rejected } = rejectOutliers([1, 100, 110, 120, 130, 140])
    expect(rejected).toContain(1)
    expect(kept).not.toContain(1)
  })

  it('keeps values within IQR fences', () => {
    // Tight cluster — all should be kept
    const values = [200_000, 210_000, 220_000, 230_000, 240_000]
    const { rejected } = rejectOutliers(values)
    expect(rejected).toHaveLength(0)
  })

  it('does not mutate input array', () => {
    const input = [100, 200, 300, 400, 10_000]
    const inputCopy = [...input]
    rejectOutliers(input)
    expect(input).toEqual(inputCopy)
  })
})

// ---------------------------------------------------------------------------
// weightedAverage
// ---------------------------------------------------------------------------

describe('weightedAverage', () => {
  it('returns 0 for empty array', () => {
    expect(weightedAverage([], [])).toBe(0)
  })

  it('computes simple weighted average', () => {
    // (100×1 + 200×3) / (1+3) = 700/4 = 175
    expect(weightedAverage([100, 200], [1, 3])).toBe(175)
  })

  it('falls back to equal weights when arrays length mismatch', () => {
    // (100 + 200) / 2 = 150
    expect(weightedAverage([100, 200], [1])).toBe(150)
  })

  it('handles equal weights correctly', () => {
    expect(weightedAverage([100, 200, 300], [1, 1, 1])).toBe(200)
  })

  it('rounds to nearest integer', () => {
    // (100×1 + 101×1) / 2 = 100.5 → 101
    expect(weightedAverage([100, 101], [1, 1])).toBe(101)
  })
})

// ---------------------------------------------------------------------------
// computeConfidence
// ---------------------------------------------------------------------------

describe('computeConfidence', () => {
  it('returns 0.20 for zone_only method', () => {
    expect(computeConfidence(0, false, 'zone_only')).toBe(0.20)
  })

  it('returns 0.25 for zone_benchmark without area', () => {
    expect(computeConfidence(0, false, 'zone_benchmark')).toBe(0.25)
  })

  it('returns 0.40 for zone_benchmark with area', () => {
    expect(computeConfidence(0, true, 'zone_benchmark')).toBe(0.40)
  })

  it('returns at least 0.45 for comps_limited with 1 comp', () => {
    const conf = computeConfidence(1, true, 'comps_limited')
    expect(conf).toBeGreaterThanOrEqual(0.45)
  })

  it('increases with more comps for comps_weighted', () => {
    const conf3 = computeConfidence(3, true, 'comps_weighted')
    const conf8 = computeConfidence(8, true, 'comps_weighted')
    expect(conf8).toBeGreaterThan(conf3)
  })

  it('caps at 0.95', () => {
    const conf = computeConfidence(100, true, 'comps_weighted')
    expect(conf).toBeLessThanOrEqual(0.95)
  })
})

// ---------------------------------------------------------------------------
// computeAVM — integration tests
// ---------------------------------------------------------------------------

describe('computeAVM', () => {
  const input: AVMInput = {
    area_m2:   100,
    bedrooms:  2,
    condition: 'good',
    zone:      'Lisboa',
  }

  it('returns zone_benchmark when no comps', () => {
    const result = computeAVM(input, LISBOA_ZONE, 'Lisboa', [])
    expect(result.method).toBe('zone_benchmark')
    expect(result.comps_used).toBe(0)
    expect(result.value_base).toBe(500_000)   // 5000 × 100, good condition = ×1.00
  })

  it('returns comps_limited when 1-2 comps', () => {
    const result = computeAVM(input, LISBOA_ZONE, 'Lisboa', [450_000])
    expect(result.method).toBe('comps_limited')
    expect(result.comps_used).toBe(1)
    // 50% comp + 50% zone: 0.5×450k + 0.5×500k = 475k
    expect(result.value_base).toBe(475_000)
  })

  it('returns comps_weighted when 3+ comps (70/30 blend)', () => {
    const comps = [450_000, 480_000, 510_000]
    const result = computeAVM(input, LISBOA_ZONE, 'Lisboa', comps)
    expect(result.method).toBe('comps_weighted')
    expect(result.comps_used).toBe(3)
    // comp avg = 480k; 0.7×480k + 0.3×500k = 336k + 150k = 486k
    expect(result.value_base).toBe(486_000)
  })

  it('value_low < value_base < value_high', () => {
    const result = computeAVM(input, LISBOA_ZONE, 'Lisboa', [])
    expect(result.value_low).toBeLessThan(result.value_base)
    expect(result.value_high).toBeGreaterThan(result.value_base)
  })

  it('spread is ±20% for zone_benchmark', () => {
    const result = computeAVM(input, LISBOA_ZONE, 'Lisboa', [])
    expect(result.value_low).toBe(Math.round(result.value_base * 0.80))
    expect(result.value_high).toBe(Math.round(result.value_base * 1.20))
  })

  it('spread is ±10% for comps_weighted', () => {
    const comps = [450_000, 480_000, 510_000, 490_000]
    const result = computeAVM(input, LISBOA_ZONE, 'Lisboa', comps)
    expect(result.value_low).toBe(Math.round(result.value_base * 0.90))
    expect(result.value_high).toBe(Math.round(result.value_base * 1.10))
  })

  it('rejects extreme outliers from comps', () => {
    // Normal comps around 500k + one extreme outlier
    const comps = [480_000, 490_000, 500_000, 510_000, 520_000, 50_000_000]
    const result = computeAVM(input, LISBOA_ZONE, 'Lisboa', comps)
    expect(result.breakdown.outliers_rejected).toBe(1)
    // Base value should not be inflated by the outlier
    expect(result.value_base).toBeLessThan(2_000_000)
  })

  it('returns zone_only when no area and no comps', () => {
    const result = computeAVM({ zone: 'Lisboa' }, LISBOA_ZONE, 'Lisboa', [])
    expect(result.method).toBe('zone_only')
    expect(result.confidence).toBe(0.20)
  })

  it('applies condition multiplier in breakdown', () => {
    const newInput: AVMInput = { ...input, condition: 'new' }
    const result = computeAVM(newInput, LISBOA_ZONE, 'Lisboa', [])
    expect(result.breakdown.condition_multiplier).toBe(1.10)
    expect(result.value_base).toBe(550_000)  // 500k × 1.10
  })

  it('includes zone_key in result', () => {
    const result = computeAVM(input, LISBOA_ZONE, 'Lisboa', [])
    expect(result.zone_key).toBe('Lisboa')
  })
})
