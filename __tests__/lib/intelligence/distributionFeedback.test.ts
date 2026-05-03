// =============================================================================
// Tests — lib/intelligence/distributionFeedback.ts  (pure functions only)
// =============================================================================

import { describe, it, expect, vi } from 'vitest'

vi.mock('../../../lib/supabase', () => ({ supabaseAdmin: {}, supabase: {} }))

import {
  computeAcceptanceWeight,
  computeConversionWeight,
  computeResponseWeight,
  computeFatigueRisk,
  classifyDistributionOutcome,
  applyWeightReinforcement,
  buildFeedbackWeightAdjustment,
  computeNetworkFeedbackScore,
} from '../../../lib/intelligence/distributionFeedback'
import type { DistributionOutcomeSummary } from '../../../lib/intelligence/distributionFeedback'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSummary(overrides: Partial<DistributionOutcomeSummary> = {}): DistributionOutcomeSummary {
  return {
    recipient_email:    'a@test.com',
    total_sent:         10,
    total_accepted:     4,
    total_converted:    2,
    total_rejected:     6,
    avg_response_hours: 8,
    distributions_7d:   1,
    distributions_30d:  3,
    is_fatigued:        false,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// computeAcceptanceWeight
// ---------------------------------------------------------------------------

describe('computeAcceptanceWeight', () => {
  it('0 sent → 1.0 (neutral)', () => expect(computeAcceptanceWeight(0, 0)).toBe(1.0))
  it('50%+ rate → 2.0',        () => expect(computeAcceptanceWeight(2, 1)).toBe(2.0))
  it('30-49% → 1.6',           () => expect(computeAcceptanceWeight(10, 4)).toBe(1.6))
  it('20-29% → 1.3',           () => expect(computeAcceptanceWeight(10, 2)).toBe(1.3))
  it('10-19% → 1.0',           () => expect(computeAcceptanceWeight(10, 1)).toBe(1.0))
  it('5-9% → 0.7',             () => expect(computeAcceptanceWeight(20, 1)).toBe(0.7))
  it('<5% → 0.4',              () => expect(computeAcceptanceWeight(100, 0)).toBe(0.4))
})

// ---------------------------------------------------------------------------
// computeConversionWeight
// ---------------------------------------------------------------------------

describe('computeConversionWeight', () => {
  it('0 accepted → 1.0 (neutral)', () => expect(computeConversionWeight(0, 0)).toBe(1.0))
  it('40%+ → 2.0',                 () => expect(computeConversionWeight(5, 2)).toBe(2.0))
  it('25-39% → 1.7',               () => expect(computeConversionWeight(4, 1)).toBe(1.7))
  it('<3% → 0.5',                  () => expect(computeConversionWeight(100, 0)).toBe(0.5))
})

// ---------------------------------------------------------------------------
// computeResponseWeight
// ---------------------------------------------------------------------------

describe('computeResponseWeight', () => {
  it('null → 1.0 (neutral)',  () => expect(computeResponseWeight(null)).toBe(1.0))
  it('≤2h → 1.8',            () => expect(computeResponseWeight(1)).toBe(1.8))
  it('≤6h → 1.5',            () => expect(computeResponseWeight(4)).toBe(1.5))
  it('≤12h → 1.2',           () => expect(computeResponseWeight(10)).toBe(1.2))
  it('≤24h → 1.0',           () => expect(computeResponseWeight(18)).toBe(1.0))
  it('≤48h → 0.8',           () => expect(computeResponseWeight(36)).toBe(0.8))
  it('≤96h → 0.5',           () => expect(computeResponseWeight(72)).toBe(0.5))
  it('>96h → 0.3',           () => expect(computeResponseWeight(120)).toBe(0.3))
})

// ---------------------------------------------------------------------------
// computeFatigueRisk
// ---------------------------------------------------------------------------

describe('computeFatigueRisk', () => {
  it('0 distributions, good response → 0 risk', () => {
    expect(computeFatigueRisk(0, 0.3)).toBe(0)
  })

  it('high 7d frequency → elevated risk', () => {
    expect(computeFatigueRisk(5, 0.2)).toBeGreaterThan(computeFatigueRisk(1, 0.2))
  })

  it('low response rate amplifies risk', () => {
    expect(computeFatigueRisk(2, 0.02)).toBeGreaterThan(computeFatigueRisk(2, 0.3))
  })

  it('result capped at 100', () => {
    expect(computeFatigueRisk(100, 0.01)).toBeLessThanOrEqual(100)
  })
})

// ---------------------------------------------------------------------------
// classifyDistributionOutcome
// ---------------------------------------------------------------------------

describe('classifyDistributionOutcome', () => {
  it('fatigued → negative', () => {
    expect(classifyDistributionOutcome(makeSummary({ is_fatigued: true }))).toBe('negative')
  })

  it('high conv + high accept → excellent', () => {
    const s = makeSummary({ total_sent: 10, total_accepted: 5, total_converted: 2, is_fatigued: false })
    expect(classifyDistributionOutcome(s)).toBe('excellent')
  })

  it('moderate metrics → good', () => {
    const s = makeSummary({ total_sent: 20, total_accepted: 4, total_converted: 1, is_fatigued: false })
    expect(classifyDistributionOutcome(s)).toBe('good')
  })

  it('very low acceptance rate → poor (acceptRate <5% fires before convRate check)', () => {
    // acceptRate = 2/100 = 2% < 5% → 'poor' (checked before conv=0 'negative')
    const s = makeSummary({ total_sent: 100, total_accepted: 2, total_converted: 0, is_fatigued: false })
    expect(classifyDistributionOutcome(s)).toBe('poor')
  })

  it('zero conversions + many sent → negative', () => {
    // accepted = 0 so convRate check: 0/0 = 0, acceptRate = 0/10 = 0 → poor
    // use accepted > 0 so convRate can be 0, then meets the negative branch
    const s = makeSummary({ total_sent: 20, total_accepted: 3, total_converted: 0, is_fatigued: false })
    expect(classifyDistributionOutcome(s)).toBe('negative')  // convRate=0, sent=20≥10
  })

  it('moderate → neutral', () => {
    const s = makeSummary({ total_sent: 3, total_accepted: 1, total_converted: 0, is_fatigued: false })
    expect(classifyDistributionOutcome(s)).toBe('neutral')
  })
})

// ---------------------------------------------------------------------------
// applyWeightReinforcement
// ---------------------------------------------------------------------------

describe('applyWeightReinforcement', () => {
  it('excellent → strengthens weight', () => {
    expect(applyWeightReinforcement(1.0, 'excellent')).toBeGreaterThan(1.0)
  })

  it('good → mild strengthening', () => {
    expect(applyWeightReinforcement(1.0, 'good')).toBeGreaterThan(1.0)
  })

  it('neutral → unchanged', () => {
    expect(applyWeightReinforcement(1.0, 'neutral')).toBe(1.0)
  })

  it('poor → decays weight', () => {
    expect(applyWeightReinforcement(1.0, 'poor')).toBeLessThan(1.0)
  })

  it('negative → strong decay', () => {
    expect(applyWeightReinforcement(1.0, 'negative')).toBeLessThan(applyWeightReinforcement(1.0, 'poor'))
  })

  it('result clamped to 0.1-2.0', () => {
    expect(applyWeightReinforcement(2.0, 'excellent')).toBe(2.0)   // capped at 2.0
    expect(applyWeightReinforcement(0.1, 'negative')).toBe(0.1)    // floored at 0.1
  })
})

// ---------------------------------------------------------------------------
// buildFeedbackWeightAdjustment
// ---------------------------------------------------------------------------

describe('buildFeedbackWeightAdjustment', () => {
  it('returns 3 adjustments', () => {
    const r = buildFeedbackWeightAdjustment(makeSummary(), { acceptance: 1.0, conversion: 1.0, speed: 1.0 })
    expect(r.adjustments).toHaveLength(3)
  })

  it('fatigued recipient → suppress', () => {
    const r = buildFeedbackWeightAdjustment(makeSummary({ is_fatigued: true }), { acceptance: 1.0, conversion: 1.0, speed: 1.0 })
    expect(r.recommended_action).toBe('suppress')
    expect(r.outcome_class).toBe('negative')
  })

  it('excellent outcome → prioritize', () => {
    const s = makeSummary({ total_sent: 10, total_accepted: 5, total_converted: 2 })
    const r = buildFeedbackWeightAdjustment(s, { acceptance: 1.0, conversion: 1.0, speed: 1.0 })
    expect(r.recommended_action).toBe('prioritize')
  })

  it('composite_weight is between 0.1 and 2.0', () => {
    const r = buildFeedbackWeightAdjustment(makeSummary(), { acceptance: 1.0, conversion: 1.0, speed: 1.0 })
    expect(r.composite_weight).toBeGreaterThan(0)
    expect(r.composite_weight).toBeLessThanOrEqual(2.0)
  })
})

// ---------------------------------------------------------------------------
// computeNetworkFeedbackScore
// ---------------------------------------------------------------------------

describe('computeNetworkFeedbackScore', () => {
  it('empty list → score 50', () => {
    const r = computeNetworkFeedbackScore([])
    expect(r.score).toBe(50)
  })

  it('high acceptance + conversion → score > 50', () => {
    const summaries = [
      makeSummary({ total_sent: 10, total_accepted: 6, total_converted: 3 }),
      makeSummary({ total_sent: 10, total_accepted: 5, total_converted: 2 }),
    ]
    const r = computeNetworkFeedbackScore(summaries)
    expect(r.score).toBeGreaterThan(50)
  })

  it('all fatigued + zero activity → low score', () => {
    // Use zero accepted/converted so the score is purely from (100 - fatigue%) × 0.2
    const summaries = [
      makeSummary({ is_fatigued: true, total_sent: 10, total_accepted: 0, total_converted: 0 }),
      makeSummary({ is_fatigued: true, total_sent: 10, total_accepted: 0, total_converted: 0 }),
    ]
    const r = computeNetworkFeedbackScore(summaries)
    expect(r.fatigued_pct).toBe(100)
    expect(r.score).toBeLessThan(50)
  })

  it('score clamped 0-100', () => {
    const summaries = Array(10).fill(null).map(() => makeSummary({ total_sent: 10, total_accepted: 9, total_converted: 8 }))
    const r = computeNetworkFeedbackScore(summaries)
    expect(r.score).toBeLessThanOrEqual(100)
    expect(r.score).toBeGreaterThanOrEqual(0)
  })
})
