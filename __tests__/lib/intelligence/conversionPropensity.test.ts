// =============================================================================
// Tests — lib/intelligence/conversionPropensity.ts  (pure functions only)
// =============================================================================

import { describe, it, expect, vi } from 'vitest'

vi.mock('../../../lib/supabase', () => ({ supabaseAdmin: {}, supabase: {} }))

import {
  getTierMultiplier,
  computePropertyFitScore,
  computeResponseSpeedScore,
  computeCapacityScore,
  computePropensityScore,
  rankRecipientsByPropensity,
  explainRanking,
} from '../../../lib/intelligence/conversionPropensity'
import type {
  RecipientSignals,
  PropertySignals,
} from '../../../lib/intelligence/conversionPropensity'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRecipient(overrides: Partial<RecipientSignals> = {}): RecipientSignals {
  return {
    recipient_email:          'inv@test.com',
    recipient_type:           'investor',
    tier:                     'PREMIUM',
    adjusted_roi_score:       70,
    avg_time_to_reply_hours:  12,
    distributions_last_7d:   1,
    distributions_last_30d:  3,
    is_fatigued:              false,
    preferred_zones:          ['lisboa'],
    preferred_property_types: ['apartment'],
    budget_min:               400_000,
    budget_max:               800_000,
    ...overrides,
  }
}

function makeProperty(overrides: Partial<PropertySignals> = {}): PropertySignals {
  return {
    zone_key:            'lisboa',
    property_type:       'apartment',
    asking_price:        500_000,
    estimated_yield_pct: 5.5,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// getTierMultiplier
// ---------------------------------------------------------------------------

describe('getTierMultiplier', () => {
  it('ELITE = 1.0',    () => expect(getTierMultiplier('ELITE')).toBe(1.00))
  it('PREMIUM = 0.85', () => expect(getTierMultiplier('PREMIUM')).toBe(0.85))
  it('STANDARD = 0.70', () => expect(getTierMultiplier('STANDARD')).toBe(0.70))
  it('BASIC = 0.55',   () => expect(getTierMultiplier('BASIC')).toBe(0.55))
})

// ---------------------------------------------------------------------------
// computePropertyFitScore
// ---------------------------------------------------------------------------

describe('computePropertyFitScore', () => {
  it('starts at 50 (neutral) with no preferences', () => {
    const r = makeRecipient({ preferred_zones: [], preferred_property_types: [], budget_min: null, budget_max: null })
    const { score } = computePropertyFitScore(r, makeProperty())
    expect(score).toBe(50)
  })

  it('boosts score for zone match', () => {
    const r = makeRecipient({ preferred_zones: ['lisboa'] })
    const { score, reasons } = computePropertyFitScore(r, makeProperty({ zone_key: 'lisboa' }))
    expect(score).toBeGreaterThan(50)
    expect(reasons.some(r => r.includes('Zone match'))).toBe(true)
  })

  it('reduces score for zone mismatch (isolated — no other boosts)', () => {
    // Remove all other preferences so only zone matters
    const r = makeRecipient({
      preferred_zones:          ['porto'],
      preferred_property_types: [],
      budget_min:               null,
      budget_max:               null,
    })
    const { score } = computePropertyFitScore(r, makeProperty({ zone_key: 'lisboa' }))
    // base(50) - zone_mismatch(15) = 35 < 50
    expect(score).toBeLessThan(50)
  })

  it('boosts for type match', () => {
    const r = makeRecipient({ preferred_property_types: ['apartment'] })
    const { score } = computePropertyFitScore(r, makeProperty({ property_type: 'apartment' }))
    expect(score).toBeGreaterThan(50)
  })

  it('reduces for price above budget (isolated — no zone/type boosts)', () => {
    const r = makeRecipient({
      preferred_zones:          [],    // no zone boost
      preferred_property_types: [],    // no type boost
      budget_min:               200_000,
      budget_max:               400_000,
    })
    // asking_price 600k > 400k * 1.2 = 480k → -20 penalty
    const { score } = computePropertyFitScore(r, makeProperty({ asking_price: 600_000 }))
    // base(50) - budget_over(20) = 30 < 50
    expect(score).toBeLessThan(50)
  })

  it('boosts for price within budget', () => {
    const r = makeRecipient({ budget_min: 400_000, budget_max: 600_000 })
    const { score } = computePropertyFitScore(r, makeProperty({ asking_price: 500_000 }))
    expect(score).toBeGreaterThan(50)
  })

  it('score clamped 0-100', () => {
    const r = makeRecipient({ preferred_zones: [], preferred_property_types: [], budget_min: null, budget_max: null })
    const { score } = computePropertyFitScore(r, makeProperty())
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })
})

// ---------------------------------------------------------------------------
// computeResponseSpeedScore
// ---------------------------------------------------------------------------

describe('computeResponseSpeedScore', () => {
  it('null → 50 (unknown)', ()   => expect(computeResponseSpeedScore(null)).toBe(50))
  it('≤1h → 100', ()            => expect(computeResponseSpeedScore(0.5)).toBe(100))
  it('≤4h → 90', ()             => expect(computeResponseSpeedScore(3)).toBe(90))
  it('≤12h → 75', ()            => expect(computeResponseSpeedScore(8)).toBe(75))
  it('≤24h → 60', ()            => expect(computeResponseSpeedScore(18)).toBe(60))
  it('≤48h → 40', ()            => expect(computeResponseSpeedScore(36)).toBe(40))
  it('≤96h → 20', ()            => expect(computeResponseSpeedScore(72)).toBe(20))
  it('>96h → 10', ()            => expect(computeResponseSpeedScore(120)).toBe(10))
})

// ---------------------------------------------------------------------------
// computeCapacityScore
// ---------------------------------------------------------------------------

describe('computeCapacityScore', () => {
  it('100 when not fatigued and no recent distributions', () => {
    expect(computeCapacityScore(0, 0, false)).toBe(100)
  })

  it('0 when fatigued', () => {
    expect(computeCapacityScore(0, 0, true)).toBe(0)
  })

  it('penalizes high 7d frequency', () => {
    const low  = computeCapacityScore(0, 0, false)
    const high = computeCapacityScore(3, 0, false)
    expect(high).toBeLessThan(low)
  })

  it('penalizes high 30d frequency', () => {
    const low  = computeCapacityScore(0, 2, false)
    const high = computeCapacityScore(0, 8, false)
    expect(high).toBeLessThan(low)
  })

  it('result is 0-100', () => {
    expect(computeCapacityScore(10, 50, false)).toBeGreaterThanOrEqual(0)
    expect(computeCapacityScore(0, 0, false)).toBeLessThanOrEqual(100)
  })
})

// ---------------------------------------------------------------------------
// computePropensityScore
// ---------------------------------------------------------------------------

describe('computePropensityScore', () => {
  it('returns 0 and ineligible when fatigued', () => {
    const r = makeRecipient({ is_fatigued: true })
    const s = computePropensityScore(r, makeProperty())
    expect(s.is_eligible).toBe(false)
    expect(s.propensity_score).toBe(0)
    expect(s.ineligibility_reason).toBeDefined()
  })

  it('returns score 0-100 for eligible recipient', () => {
    const s = computePropensityScore(makeRecipient(), makeProperty())
    expect(s.is_eligible).toBe(true)
    expect(s.propensity_score).toBeGreaterThanOrEqual(0)
    expect(s.propensity_score).toBeLessThanOrEqual(100)
  })

  it('ELITE tier outscores BASIC tier, all else equal', () => {
    const elite = computePropensityScore(makeRecipient({ tier: 'ELITE' }), makeProperty())
    const basic = computePropensityScore(makeRecipient({ tier: 'BASIC' }), makeProperty())
    expect(elite.propensity_score).toBeGreaterThan(basic.propensity_score)
  })

  it('includes all 4 factors', () => {
    const s = computePropensityScore(makeRecipient(), makeProperty())
    expect(s.factors).toHaveLength(4)
    const names = s.factors.map(f => f.name)
    expect(names).toContain('Property Fit')
    expect(names).toContain('Engagement Quality')
    expect(names).toContain('Response Speed')
    expect(names).toContain('Capacity')
  })

  it('perfect match scores higher than mismatch', () => {
    const perfect   = computePropensityScore(makeRecipient(), makeProperty())
    const mismatch  = computePropensityScore(
      makeRecipient({ preferred_zones: ['porto'] }),
      makeProperty({ zone_key: 'algarve' }),
    )
    expect(perfect.propensity_score).toBeGreaterThan(mismatch.propensity_score)
  })
})

// ---------------------------------------------------------------------------
// rankRecipientsByPropensity
// ---------------------------------------------------------------------------

describe('rankRecipientsByPropensity', () => {
  it('returns empty for empty input', () => {
    expect(rankRecipientsByPropensity([], makeProperty())).toEqual([])
  })

  it('assigns sequential ranks starting at 1', () => {
    const recipients = [makeRecipient({ recipient_email: 'a@t.com' }), makeRecipient({ recipient_email: 'b@t.com' })]
    const ranked     = rankRecipientsByPropensity(recipients, makeProperty())
    expect(ranked[0].rank).toBe(1)
    expect(ranked[1].rank).toBe(2)
  })

  it('sorts highest propensity first', () => {
    const recipients = [
      makeRecipient({ recipient_email: 'low@t.com',  tier: 'BASIC',  is_fatigued: false }),
      makeRecipient({ recipient_email: 'high@t.com', tier: 'ELITE',  is_fatigued: false }),
    ]
    const ranked = rankRecipientsByPropensity(recipients, makeProperty())
    expect(ranked[0].recipient_email).toBe('high@t.com')
  })

  it('fatigued recipient ranks last', () => {
    const recipients = [
      makeRecipient({ recipient_email: 'good@t.com',     is_fatigued: false, tier: 'STANDARD' }),
      makeRecipient({ recipient_email: 'fatigued@t.com', is_fatigued: true }),
    ]
    const ranked = rankRecipientsByPropensity(recipients, makeProperty())
    expect(ranked[ranked.length - 1].recipient_email).toBe('fatigued@t.com')
  })
})

// ---------------------------------------------------------------------------
// explainRanking
// ---------------------------------------------------------------------------

describe('explainRanking', () => {
  it('returns ineligibility message when not eligible', () => {
    const r = makeRecipient({ is_fatigued: true })
    const scored = { ...computePropensityScore(r, makeProperty()), rank: 5 }
    const explanation = explainRanking(scored)
    expect(explanation).toContain('Not eligible')
  })

  it('includes rank number in explanation', () => {
    const scored = { ...computePropensityScore(makeRecipient(), makeProperty()), rank: 3 }
    const explanation = explainRanking(scored)
    expect(explanation).toContain('#3')
  })

  it('includes score in explanation', () => {
    const s    = computePropensityScore(makeRecipient(), makeProperty())
    const scored = { ...s, rank: 1 }
    const explanation = explainRanking(scored)
    expect(explanation).toContain('/100')
  })
})
