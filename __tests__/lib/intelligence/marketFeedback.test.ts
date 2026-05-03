// =============================================================================
// Tests — lib/intelligence/marketFeedback.ts  (pure functions only)
// =============================================================================

import { describe, it, expect } from 'vitest'

import {
  computeAbsorptionRate,
  computeListingVelocityChange,
  classifyMarketPressure,
  computeMarketHealthScore,
  classifyMarketRegime,
  computePricingPressureIndex,
  buildMarketFeedbackSignal,
} from '../../../lib/intelligence/marketFeedback'

// ---------------------------------------------------------------------------
// computeAbsorptionRate
// ---------------------------------------------------------------------------

describe('computeAbsorptionRate', () => {
  it('0 listings → 0', ()         => expect(computeAbsorptionRate(0, 0)).toBe(0))
  it('all sold → 100', ()         => expect(computeAbsorptionRate(10, 10)).toBe(100))
  it('half sold → 50', ()         => expect(computeAbsorptionRate(10, 5)).toBe(50))
  it('more sold than listed → capped at 100', () => expect(computeAbsorptionRate(5, 10)).toBe(100))
  it('none sold → 0', ()          => expect(computeAbsorptionRate(10, 0)).toBe(0))
})

// ---------------------------------------------------------------------------
// computeListingVelocityChange
// ---------------------------------------------------------------------------

describe('computeListingVelocityChange', () => {
  it('0 prior → 0', ()             => expect(computeListingVelocityChange(10, 0)).toBe(0))
  it('same listings → 0%', ()      => expect(computeListingVelocityChange(10, 10)).toBe(0))
  it('+50% increase', ()           => expect(computeListingVelocityChange(15, 10)).toBe(50))
  it('-50% decrease', ()           => expect(computeListingVelocityChange(5, 10)).toBe(-50))
  it('result is rounded to 2dp',() => {
    const v = computeListingVelocityChange(13, 10)
    expect(v).toBeCloseTo(30, 1)
  })
})

// ---------------------------------------------------------------------------
// classifyMarketPressure
// ---------------------------------------------------------------------------

describe('classifyMarketPressure', () => {
  it('strong seller: high absorption + shrinking supply + rising prices', () => {
    expect(classifyMarketPressure(80, -15, 8)).toBe('strong_seller')
  })

  it('seller: moderate absorption + price growth', () => {
    expect(classifyMarketPressure(60, 0, 4)).toBe('seller')
  })

  it('strong buyer: low absorption + growing supply + falling prices', () => {
    expect(classifyMarketPressure(20, 20, -8)).toBe('strong_buyer')
  })

  it('buyer: low absorption + negative prices', () => {
    expect(classifyMarketPressure(30, 5, -4)).toBe('buyer')
  })

  it('neutral: balanced conditions', () => {
    expect(classifyMarketPressure(50, 0, 0)).toBe('neutral')
  })
})

// ---------------------------------------------------------------------------
// computeMarketHealthScore
// ---------------------------------------------------------------------------

describe('computeMarketHealthScore', () => {
  it('healthy conditions → high score', () => {
    const score = computeMarketHealthScore(60, 6, 1.0)
    expect(score).toBeGreaterThan(80)
  })

  it('distressed conditions → low score', () => {
    const score = computeMarketHealthScore(15, -15, 2.5)
    expect(score).toBeLessThan(50)
  })

  it('score is 0-100', () => {
    for (const [a, p, s] of [[50, 5, 1.0], [10, -20, 2.0], [90, 20, 0.5]]) {
      const score = computeMarketHealthScore(a as number, p as number, s as number)
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(100)
    }
  })
})

// ---------------------------------------------------------------------------
// classifyMarketRegime
// ---------------------------------------------------------------------------

describe('classifyMarketRegime', () => {
  it('≥80 → hot',    () => expect(classifyMarketRegime(85)).toBe('hot'))
  it('65-79 → warm', () => expect(classifyMarketRegime(70)).toBe('warm'))
  it('45-64 → neutral', () => expect(classifyMarketRegime(55)).toBe('neutral'))
  it('30-44 → cooling', () => expect(classifyMarketRegime(35)).toBe('cooling'))
  it('<30 → cold',   () => expect(classifyMarketRegime(20)).toBe('cold'))
})

// ---------------------------------------------------------------------------
// computePricingPressureIndex
// ---------------------------------------------------------------------------

describe('computePricingPressureIndex', () => {
  it('median market price = 0 → 50 (neutral)', () => {
    expect(computePricingPressureIndex({ own_avg_asking_price: 500_000, competitor_avg_asking_price: 480_000, market_median_price: 0 })).toBe(50)
  })

  it('all at median → 50 (neutral)', () => {
    const r = computePricingPressureIndex({ own_avg_asking_price: 500_000, competitor_avg_asking_price: 500_000, market_median_price: 500_000 })
    expect(r).toBe(50)
  })

  it('competitors pricing above median → score > 50', () => {
    const r = computePricingPressureIndex({ own_avg_asking_price: 550_000, competitor_avg_asking_price: 570_000, market_median_price: 500_000 })
    expect(r).toBeGreaterThan(50)
  })

  it('both below median → score < 50', () => {
    const r = computePricingPressureIndex({ own_avg_asking_price: 450_000, competitor_avg_asking_price: 440_000, market_median_price: 500_000 })
    expect(r).toBeLessThan(50)
  })

  it('result is 0-100', () => {
    const r = computePricingPressureIndex({ own_avg_asking_price: 1_000_000, competitor_avg_asking_price: 1_000_000, market_median_price: 500_000 })
    expect(r).toBeLessThanOrEqual(100)
  })
})

// ---------------------------------------------------------------------------
// buildMarketFeedbackSignal
// ---------------------------------------------------------------------------

describe('buildMarketFeedbackSignal', () => {
  it('returns all required fields', () => {
    const s = buildMarketFeedbackSignal('lisboa', 'apartment', '30d', {
      new_listings:         100,
      sold_listings:        65,
      prior_new_listings:   90,
      price_delta_pct:      3,
      price_growth_yoy_pct: 8,
      supply_balance:       1.0,
    })
    expect(s.zone_key).toBe('lisboa')
    expect(s.asset_class).toBe('apartment')
    expect(s.absorption_rate).toBeGreaterThan(0)
    expect(s.market_pressure).toBeDefined()
    expect(s.market_regime).toBeDefined()
    expect(s.market_health_score).toBeGreaterThan(0)
    expect(s.computed_at).toBeDefined()
  })

  it('seller market conditions classified correctly', () => {
    const s = buildMarketFeedbackSignal('porto', 'villa', '30d', {
      new_listings:         50,
      sold_listings:        40,
      prior_new_listings:   70,
      price_delta_pct:      6,
      price_growth_yoy_pct: 10,
      supply_balance:       0.8,
    })
    expect(['seller', 'strong_seller']).toContain(s.market_pressure)
  })
})
