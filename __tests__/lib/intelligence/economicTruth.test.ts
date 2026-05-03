// =============================================================================
// Tests — lib/intelligence/economicTruth.ts  (pure functions only)
// =============================================================================

import { describe, it, expect, vi } from 'vitest'

vi.mock('../../../lib/supabase', () => ({ supabaseAdmin: {}, supabase: {} }))

import {
  computeAvmAccuracyScore,
  computeNegotiationScore,
  computeTimeToCloseScore,
  computeRoutingEfficiencyScore,
  computeSpreadVsPredictedScore,
  computeEconomicTruthScore,
  normalizeEconomicScore,
  computeAlignmentDivergence,
} from '../../../lib/intelligence/economicTruth'
import type { EconomicTruthInputs } from '../../../lib/intelligence/economicTruth'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInputs(overrides: Partial<EconomicTruthInputs> = {}): EconomicTruthInputs {
  return {
    property_id:            'prop-001',
    zone_key:               'lisboa',
    asset_class:            'apartment',
    price_band:             '500k-1m',
    asking_price:           600_000,
    final_sale_price:       580_000,
    avm_predicted_price:    575_000,
    system_predicted_price: 590_000,
    negotiation_days:       45,
    recipients_contacted:   5,
    recipients_converted:   2,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// computeAvmAccuracyScore
// ---------------------------------------------------------------------------

describe('computeAvmAccuracyScore', () => {
  it('≤2% error → 100', () => expect(computeAvmAccuracyScore(1.5)).toBe(100))
  it('≤5% error → 90',  () => expect(computeAvmAccuracyScore(4)).toBe(90))
  it('≤8% error → 78',  () => expect(computeAvmAccuracyScore(7)).toBe(78))
  it('≤12% error → 62', () => expect(computeAvmAccuracyScore(10)).toBe(62))
  it('≤18% error → 46', () => expect(computeAvmAccuracyScore(15)).toBe(46))
  it('≤25% error → 30', () => expect(computeAvmAccuracyScore(22)).toBe(30))
  it('>25% error → 10', () => expect(computeAvmAccuracyScore(30)).toBe(10))
  it('treats negative error as absolute value', () => {
    expect(computeAvmAccuracyScore(-3)).toBe(90)  // |-3| = 3, ≤5%
  })
})

// ---------------------------------------------------------------------------
// computeNegotiationScore
// ---------------------------------------------------------------------------

describe('computeNegotiationScore', () => {
  it('overbid (delta < -5%) → 100',    () => expect(computeNegotiationScore(-10)).toBe(100))
  it('tiny overbid (delta < 0) → 95',  () => expect(computeNegotiationScore(-1)).toBe(95))
  it('0-3% reduction → 88',            () => expect(computeNegotiationScore(2)).toBe(88))
  it('3-6% reduction → 78',            () => expect(computeNegotiationScore(5)).toBe(78))
  it('6-10% → 65',                     () => expect(computeNegotiationScore(8)).toBe(65))
  it('10-15% → 48',                    () => expect(computeNegotiationScore(12)).toBe(48))
  it('15-25% → 30',                    () => expect(computeNegotiationScore(20)).toBe(30))
  it('>25% → 15',                      () => expect(computeNegotiationScore(30)).toBe(15))
  it('score decreases as delta grows', () => {
    expect(computeNegotiationScore(0)).toBeGreaterThan(computeNegotiationScore(10))
    expect(computeNegotiationScore(10)).toBeGreaterThan(computeNegotiationScore(25))
  })
})

// ---------------------------------------------------------------------------
// computeTimeToCloseScore
// ---------------------------------------------------------------------------

describe('computeTimeToCloseScore', () => {
  it('≤30d → 100',   () => expect(computeTimeToCloseScore(20)).toBe(100))
  it('≤60d → 90',    () => expect(computeTimeToCloseScore(50)).toBe(90))
  it('≤90d → 78',    () => expect(computeTimeToCloseScore(75)).toBe(78))
  it('≤120d → 65',   () => expect(computeTimeToCloseScore(100)).toBe(65))
  it('≤150d → 52',   () => expect(computeTimeToCloseScore(140)).toBe(52))
  it('≤210d → 38',   () => expect(computeTimeToCloseScore(180)).toBe(38))
  it('>210d → 20',   () => expect(computeTimeToCloseScore(300)).toBe(20))
  it('monotonically decreasing', () => {
    expect(computeTimeToCloseScore(10)).toBeGreaterThan(computeTimeToCloseScore(90))
    expect(computeTimeToCloseScore(90)).toBeGreaterThan(computeTimeToCloseScore(210))
  })
})

// ---------------------------------------------------------------------------
// computeRoutingEfficiencyScore
// ---------------------------------------------------------------------------

describe('computeRoutingEfficiencyScore', () => {
  it('0 contacted → 50 (neutral)', () => expect(computeRoutingEfficiencyScore(0, 0)).toBe(50))
  it('50%+ precision → 100',      () => expect(computeRoutingEfficiencyScore(2, 1)).toBe(100))
  it('30-49% precision → 88',     () => expect(computeRoutingEfficiencyScore(10, 4)).toBe(88))
  it('20-29% precision → 76',     () => expect(computeRoutingEfficiencyScore(10, 2)).toBe(76))
  it('10-19% precision → 62',     () => expect(computeRoutingEfficiencyScore(10, 1)).toBe(62))
  it('5-9% precision → 46',       () => expect(computeRoutingEfficiencyScore(20, 1)).toBe(46))
  it('<5% precision → 25',        () => expect(computeRoutingEfficiencyScore(100, 0)).toBe(25))
})

// ---------------------------------------------------------------------------
// computeSpreadVsPredictedScore
// ---------------------------------------------------------------------------

describe('computeSpreadVsPredictedScore', () => {
  it('≤3% spread → 100',  () => expect(computeSpreadVsPredictedScore(2)).toBe(100))
  it('≤6% → 88',          () => expect(computeSpreadVsPredictedScore(5)).toBe(88))
  it('≤10% → 74',         () => expect(computeSpreadVsPredictedScore(8)).toBe(74))
  it('≤15% → 58',         () => expect(computeSpreadVsPredictedScore(12)).toBe(58))
  it('≤22% → 42',         () => expect(computeSpreadVsPredictedScore(18)).toBe(42))
  it('>22% → 22',         () => expect(computeSpreadVsPredictedScore(30)).toBe(22))
  it('negative spread treated as absolute', () => {
    expect(computeSpreadVsPredictedScore(-2)).toBe(100)
  })
})

// ---------------------------------------------------------------------------
// computeEconomicTruthScore
// ---------------------------------------------------------------------------

describe('computeEconomicTruthScore', () => {
  it('returns all component scores', () => {
    const result = computeEconomicTruthScore(makeInputs())
    expect(result.avm_accuracy_score).toBeGreaterThan(0)
    expect(result.negotiation_score).toBeGreaterThan(0)
    expect(result.time_to_close_score).toBeGreaterThan(0)
    expect(result.routing_efficiency_score).toBeGreaterThan(0)
    expect(result.spread_vs_predicted_score).toBeGreaterThan(0)
  })

  it('raw_truth_score is 0-100', () => {
    const result = computeEconomicTruthScore(makeInputs())
    expect(result.raw_truth_score).toBeGreaterThanOrEqual(0)
    expect(result.raw_truth_score).toBeLessThanOrEqual(100)
  })

  it('preserves property_id, zone_key, asset_class, price_band', () => {
    const result = computeEconomicTruthScore(makeInputs())
    expect(result.property_id).toBe('prop-001')
    expect(result.zone_key).toBe('lisboa')
    expect(result.asset_class).toBe('apartment')
    expect(result.price_band).toBe('500k-1m')
  })

  it('computes derived metrics correctly', () => {
    const inputs = makeInputs({
      asking_price:        600_000,
      final_sale_price:    540_000,   // 10% reduction
      avm_predicted_price: 570_000,   // ~5.6% error
      recipients_contacted: 10,
      recipients_converted: 2,        // 20% precision
    })
    const result = computeEconomicTruthScore(inputs)
    expect(result.negotiation_delta_pct).toBeCloseTo(10, 0)
    expect(result.routing_precision_pct).toBeCloseTo(20, 0)
  })

  it('perfect deal scores higher than distressed deal', () => {
    const perfect = computeEconomicTruthScore(makeInputs({
      final_sale_price:    600_000,   // at asking
      avm_predicted_price: 598_000,   // <1% error
      negotiation_days:    20,
      recipients_contacted: 3,
      recipients_converted: 2,
    }))
    const distressed = computeEconomicTruthScore(makeInputs({
      final_sale_price:    480_000,   // 20% reduction
      avm_predicted_price: 700_000,   // >30% error
      negotiation_days:    250,
      recipients_contacted: 50,
      recipients_converted: 1,
    }))
    expect(perfect.raw_truth_score).toBeGreaterThan(distressed.raw_truth_score)
  })
})

// ---------------------------------------------------------------------------
// normalizeEconomicScore
// ---------------------------------------------------------------------------

describe('normalizeEconomicScore', () => {
  it('at zone mean → 100', () => {
    expect(normalizeEconomicScore(70, 70)).toBe(100)
  })

  it('zero zone mean → 100 (no data fallback)', () => {
    expect(normalizeEconomicScore(70, 0)).toBe(100)
  })

  it('above mean → > 100', () => {
    expect(normalizeEconomicScore(80, 70)).toBeGreaterThan(100)
  })

  it('below mean → < 100', () => {
    expect(normalizeEconomicScore(50, 70)).toBeLessThan(100)
  })

  it('clamped to 0-150', () => {
    expect(normalizeEconomicScore(150, 1)).toBe(150)
    expect(normalizeEconomicScore(0, 70)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// computeAlignmentDivergence
// ---------------------------------------------------------------------------

describe('computeAlignmentDivergence', () => {
  it('over_estimated when realized < predicted', () => {
    const d = computeAlignmentDivergence(80, 60)
    expect(d.pattern).toBe('over_estimated')
    expect(d.divergence).toBeLessThan(0)
  })

  it('under_estimated when realized > predicted', () => {
    const d = computeAlignmentDivergence(60, 80)
    expect(d.pattern).toBe('under_estimated')
    expect(d.divergence).toBeGreaterThan(0)
  })

  it('aligned when within 10%', () => {
    const d = computeAlignmentDivergence(75, 78)
    expect(d.pattern).toBe('aligned')
  })

  it('divergence_pct calculation correct', () => {
    const d = computeAlignmentDivergence(100, 80)
    expect(d.divergence_pct).toBeCloseTo(-20, 0)
  })
})
