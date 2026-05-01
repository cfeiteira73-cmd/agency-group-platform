// =============================================================================
// Intelligence Engine Test Suite
// Tests for lib/scoring/opportunityScore.ts + lib/scoring/signalDetector.ts
//
// Covers Phase 2+3 calibration fixes:
//   - D1 no-data fallback → 5 (not 7)
//   - D2 null area → penalized yield (zone * 0.80)
//   - D4 null DOM → 10 (not 15); only DOM ≤ half-median = 15
//   - investor_suitable: stricter when yield estimated from zone
//   - listing_removed signal: only fires for 'withdrawn' and 'off_market'
//   - MIN_SIGNAL_PRICE floor: sub-€100K properties return no signals
//   - score_breakdown included in BatchScoreResult
// =============================================================================

import { describe, it, expect } from 'vitest'
import {
  computeOpportunityScore,
  batchScoreProperties,
  type PropertyInput,
} from '../../../lib/scoring/opportunityScore'
import {
  detectSignals,
  type SignalPropertyInput,
} from '../../../lib/scoring/signalDetector'

// ---------------------------------------------------------------------------
// Shared fixtures
// Porto: pm2_trans=3600, renda_m2=13.0, yield_bruto=4.3, dias_mercado=55, demanda=8.5
// Lisboa: pm2_trans=5000, renda_m2=18.5, yield_bruto=4.4, dias_mercado=45, demanda=9.0
// ---------------------------------------------------------------------------

const BASE_PORTO: PropertyInput = {
  price:          250_000,
  area_m2:        100,
  zone:           'Porto',
  type:           'apartment',
  bedrooms:       2,
  days_on_market: 10,
}

// ---------------------------------------------------------------------------
// D1 — Price vs Zone
// ---------------------------------------------------------------------------

describe('D1 — Price vs Zone', () => {
  it('returns 5 when no pricing data (no area, no avm, no ppm2)', () => {
    const result = computeOpportunityScore({
      price: 300_000,
      zone:  'Porto',
      // no area_m2, no avm_estimate, no price_per_sqm
    })
    // D1 should be 5 (explicit data-insufficient penalty)
    expect(result.score_breakdown.d1_price_vs_zone).toBe(5)
  })

  it('returns 30 when property is 30%+ below zone pm2_trans', () => {
    // Porto pm2_trans=3600, ppm2=2500 → discount=(3600-2500)/3600=0.306 → ≥0.20 → 30pts
    const result = computeOpportunityScore({ ...BASE_PORTO })
    expect(result.score_breakdown.d1_price_vs_zone).toBe(30)
  })

  it('returns ≤ 7 when property is overpriced vs zone', () => {
    // ppm2 = 9000 vs pm2_trans=3600 → discount = (3600-9000)/3600 = -1.5 → return 2
    const result = computeOpportunityScore({
      price:   900_000,
      area_m2: 100,
      zone:    'Porto',
    })
    expect(result.score_breakdown.d1_price_vs_zone).toBeLessThanOrEqual(7)
  })

  it('uses AVM when available — 20% below AVM = 30 pts', () => {
    const result = computeOpportunityScore({
      price:        400_000,
      avm_estimate: 500_000,  // 20% above price = 20% discount
      zone:         'Porto',
    })
    expect(result.score_breakdown.d1_price_vs_zone).toBe(30)
  })
})

// ---------------------------------------------------------------------------
// D2 — Rental Yield
// ---------------------------------------------------------------------------

describe('D2 — Rental Yield', () => {
  it('computes actual yield when area_m2 is provided', () => {
    // Porto: renda_m2=13, area=100, price=250000
    // monthly=1300, annual=14950, yield=5.98% → 14 pts
    const result = computeOpportunityScore({ ...BASE_PORTO })
    expect(result.score_breakdown.d2_rental_yield).toBe(14)
    expect(result.estimated_rental_yield).toBeCloseTo(5.98, 1)
  })

  it('applies 20% penalty when area_m2 is null (zone-estimated yield)', () => {
    // Porto yield_bruto=4.3, penalized=4.3*0.80=3.44% → 6 pts (3–4% bracket)
    const result = computeOpportunityScore({
      price: 250_000,
      zone:  'Porto',
      // no area_m2
    })
    expect(result.score_breakdown.d2_rental_yield).toBe(6)
    expect(result.estimated_rental_yield).toBeCloseTo(3.44, 1)
  })

  it('returns score 0 when price is 0', () => {
    const result = computeOpportunityScore({ price: 0, zone: 'Porto' })
    expect(result.score_breakdown.d2_rental_yield).toBe(0)
    expect(result.estimated_rental_yield).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// D4 — DOM Position
// ---------------------------------------------------------------------------

describe('D4 — DOM Position', () => {
  it('returns 10 when days_on_market is null (data insufficient, not max)', () => {
    const result = computeOpportunityScore({
      price:          250_000,
      area_m2:        100,
      zone:           'Porto',
      days_on_market: null,  // unknown
    })
    expect(result.score_breakdown.d4_dom_position).toBe(10)
  })

  it('returns 15 when DOM is very fresh (≤ half of zone median)', () => {
    // Porto median=55 days, DOM=3 → ratio=0.055 → ≤0.5 → 15 pts
    const result = computeOpportunityScore({
      ...BASE_PORTO,
      days_on_market: 3,
    })
    expect(result.score_breakdown.d4_dom_position).toBe(15)
  })

  it('returns ≤ 3 when severely stale (> 2× zone median)', () => {
    // Porto median=55, DOM=200 → ratio=3.6 → > 2.0 → 1 pt (return 1)
    const result = computeOpportunityScore({
      ...BASE_PORTO,
      days_on_market: 200,
    })
    expect(result.score_breakdown.d4_dom_position).toBeLessThanOrEqual(3)
  })

  it('null DOM score (10) is lower than fresh DOM score (15)', () => {
    const nullDom  = computeOpportunityScore({ ...BASE_PORTO, days_on_market: null })
    const freshDom = computeOpportunityScore({ ...BASE_PORTO, days_on_market: 3 })
    expect(nullDom.score_breakdown.d4_dom_position).toBe(10)
    expect(freshDom.score_breakdown.d4_dom_position).toBe(15)
    expect(freshDom.opportunity_score).toBeGreaterThan(nullDom.opportunity_score)
  })
})

// ---------------------------------------------------------------------------
// investor_suitable — calibrated thresholds
// ---------------------------------------------------------------------------

describe('investor_suitable', () => {
  it('is true when actual yield ≥ 4% AND score ≥ 65', () => {
    // Porto, area=100, price=250000 → yield≈5.98%, score≈84
    const result = computeOpportunityScore({ ...BASE_PORTO })
    expect(result.investor_suitable).toBe(true)
  })

  it('is false when no area data and score < 75 (even if zone yield looks ok)', () => {
    // Porto without area → yield_from_area=false, estimated_yield=3.44%, total score ~51
    const result = computeOpportunityScore({
      price: 250_000,
      zone:  'Porto',
      type:  'apartment',
    })
    expect(result.investor_suitable).toBe(false)
  })

  it('is false when score is high but yield < 4% (area-based)', () => {
    // Very high price → yield below 4% even with area data
    // Porto renda_m2=13, area=100, price=600000 → monthly=1300, annual=14950, yield=2.49%
    const result = computeOpportunityScore({
      price:   600_000,
      area_m2: 100,
      zone:    'Porto',
    })
    expect(result.estimated_rental_yield).toBeDefined()
    expect(result.estimated_rental_yield!).toBeLessThan(4.0)
    expect(result.investor_suitable).toBe(false)
  })

  it('is false when price is 0', () => {
    const result = computeOpportunityScore({ price: 0, zone: 'Porto' })
    expect(result.investor_suitable).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// score_breakdown in BatchScoreResult
// ---------------------------------------------------------------------------

describe('batchScoreProperties — score_breakdown included', () => {
  it('includes score_breakdown in each result', () => {
    const results = batchScoreProperties([{ id: 'prop-1', ...BASE_PORTO }])
    expect(results).toHaveLength(1)
    const r = results[0]
    expect(r.score_breakdown).toBeDefined()
    expect(r.score_breakdown.d1_price_vs_zone).toBeGreaterThanOrEqual(0)
    expect(r.score_breakdown.d2_rental_yield).toBeGreaterThanOrEqual(0)
    expect(r.score_breakdown.d3_momentum).toBeGreaterThanOrEqual(0)
    expect(r.score_breakdown.d4_dom_position).toBeGreaterThanOrEqual(0)
    expect(r.score_breakdown.d5_asset_type).toBeGreaterThanOrEqual(0)
    expect(r.score_breakdown.d6_investor_fit).toBeGreaterThanOrEqual(0)
  })

  it('marks changed=true when score differs from stored opportunity_score', () => {
    const results = batchScoreProperties([{
      id: 'prop-2',
      opportunity_score: 10,   // old stored score — will differ from computed
      ...BASE_PORTO,
    }])
    expect(results[0].changed).toBe(true)
  })

  it('marks changed=false when score matches stored value', () => {
    // Compute score first, then re-run with same stored score
    const first = batchScoreProperties([{ id: 'prop-3', ...BASE_PORTO }])
    const storedScore    = first[0].opportunity_score
    const storedSuitable = first[0].investor_suitable

    const second = batchScoreProperties([{
      id:                'prop-3',
      opportunity_score: storedScore,
      investor_suitable: storedSuitable,
      ...BASE_PORTO,
    }])
    expect(second[0].changed).toBe(false)
  })

  it('breakdown dimensions sum equals total score', () => {
    const results = batchScoreProperties([{ id: 'prop-4', ...BASE_PORTO }])
    const r  = results[0]
    const bd = r.score_breakdown
    const dimSum = bd.d1_price_vs_zone + bd.d2_rental_yield + bd.d3_momentum
      + bd.d4_dom_position + bd.d5_asset_type + bd.d6_investor_fit
    expect(r.opportunity_score).toBe(Math.min(100, Math.max(0, dimSum)))
  })
})

// ---------------------------------------------------------------------------
// detectSignals — MIN_SIGNAL_PRICE floor
// ---------------------------------------------------------------------------

describe('detectSignals — price floor', () => {
  it('returns empty array when price < €100K', () => {
    const signals = detectSignals({
      price:          80_000,
      price_previous: 100_000,  // would trigger price_reduction if above floor
      zone:           'Porto',
      days_on_market: 500,       // would trigger stale
    })
    expect(signals).toHaveLength(0)
  })

  it('returns signals when price = €100K (exactly at floor)', () => {
    const signals = detectSignals({
      price:          100_000,
      price_previous: 120_000,  // 16.7% reduction → should trigger
      zone:           'Porto',
    })
    expect(signals.length).toBeGreaterThan(0)
    expect(signals.some(s => s.signal_type === 'price_reduction')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// detectSignals — price_reduction
// ---------------------------------------------------------------------------

describe('detectSignals — price_reduction', () => {
  it('no signal when reduction < 5%', () => {
    const signals = detectSignals({
      price:          500_000,
      price_previous: 510_000,  // 1.96% drop
      zone:           'Porto',
    })
    expect(signals.some(s => s.signal_type === 'price_reduction')).toBe(false)
  })

  it('MEDIUM signal when reduction is 5–10%', () => {
    const signals = detectSignals({
      price:          500_000,
      price_previous: 530_000,  // 5.66%
      zone:           'Porto',
    })
    const sig = signals.find(s => s.signal_type === 'price_reduction')
    expect(sig).toBeDefined()
    expect(sig!.severity).toBe('MEDIUM')
  })

  it('HIGH signal when reduction ≥ 10%', () => {
    const signals = detectSignals({
      price:          500_000,
      price_previous: 560_000,  // 10.7%
      zone:           'Porto',
    })
    const sig = signals.find(s => s.signal_type === 'price_reduction')
    expect(sig).toBeDefined()
    expect(sig!.severity).toBe('HIGH')
  })

  it('no signal when price increases', () => {
    const signals = detectSignals({
      price:          550_000,
      price_previous: 500_000,  // price went UP
      zone:           'Porto',
    })
    expect(signals.some(s => s.signal_type === 'price_reduction')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// detectSignals — listing_removed (bug fix: invalid enum 'listing_removed')
// ---------------------------------------------------------------------------

describe('detectSignals — listing_removed', () => {
  it('does NOT fire for status="listing_removed" (invalid property_status enum)', () => {
    const signals = detectSignals({
      price:  500_000,
      zone:   'Porto',
      status: 'listing_removed',  // invalid enum — should NOT trigger
    })
    expect(signals.some(s => s.signal_type === 'listing_removed')).toBe(false)
  })

  it('fires MEDIUM signal for status="withdrawn"', () => {
    const signals = detectSignals({
      price:  500_000,
      zone:   'Porto',
      status: 'withdrawn',
    })
    const sig = signals.find(s => s.signal_type === 'listing_removed')
    expect(sig).toBeDefined()
    expect(sig!.severity).toBe('MEDIUM')
  })

  it('fires MEDIUM signal for status="off_market"', () => {
    const signals = detectSignals({
      price:  500_000,
      zone:   'Porto',
      status: 'off_market',
    })
    const sig = signals.find(s => s.signal_type === 'listing_removed')
    expect(sig).toBeDefined()
    expect(sig!.severity).toBe('MEDIUM')
  })

  it('no signal for active status', () => {
    const signals = detectSignals({
      price:  500_000,
      zone:   'Porto',
      status: 'active',
    })
    expect(signals.some(s => s.signal_type === 'listing_removed')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// detectSignals — stagnated_listing
// ---------------------------------------------------------------------------

describe('detectSignals — stagnated_listing', () => {
  it('no signal when days_on_market is null', () => {
    const signals = detectSignals({
      price:          500_000,
      zone:           'Porto',
      days_on_market: null,
    })
    expect(signals.some(s => s.signal_type === 'stagnated_listing')).toBe(false)
  })

  it('no signal when DOM < 1.5× zone median', () => {
    // Porto median=55, DOM=70 → ratio=1.27 < 1.5
    const signals = detectSignals({
      price:          500_000,
      zone:           'Porto',
      days_on_market: 70,
    })
    expect(signals.some(s => s.signal_type === 'stagnated_listing')).toBe(false)
  })

  it('MEDIUM signal when DOM is 1.5–2.5× zone median', () => {
    // Porto median=55, DOM=120 → ratio=2.18 → MEDIUM
    const signals = detectSignals({
      price:          500_000,
      zone:           'Porto',
      days_on_market: 120,
    })
    const sig = signals.find(s => s.signal_type === 'stagnated_listing')
    expect(sig).toBeDefined()
    expect(sig!.severity).toBe('MEDIUM')
  })

  it('HIGH signal when DOM ≥ 2.5× zone median', () => {
    // Porto median=55, DOM=200 → ratio=3.6 → HIGH
    const signals = detectSignals({
      price:          500_000,
      zone:           'Porto',
      days_on_market: 200,
    })
    const sig = signals.find(s => s.signal_type === 'stagnated_listing')
    expect(sig).toBeDefined()
    expect(sig!.severity).toBe('HIGH')
  })
})

// ---------------------------------------------------------------------------
// detectSignals — hot_zone_new
// ---------------------------------------------------------------------------

describe('detectSignals — hot_zone_new', () => {
  it('fires for new listing in hot zone (Lisboa demanda=9.0 ≥ 8)', () => {
    // Lisboa demanda=9 → HIGH severity (≥9)
    const signals = detectSignals({
      price:          500_000,
      zone:           'Lisboa',
      days_on_market: 2,  // ≤ 3 = new
    })
    const sig = signals.find(s => s.signal_type === 'hot_zone_new')
    expect(sig).toBeDefined()
    expect(sig!.severity).toBe('HIGH')
  })

  it('does not fire when listing is not new (DOM > 3)', () => {
    const signals = detectSignals({
      price:          500_000,
      zone:           'Lisboa',
      days_on_market: 10,  // > 3 = not new
    })
    expect(signals.some(s => s.signal_type === 'hot_zone_new')).toBe(false)
  })

  it('does not fire in low-demand zone', () => {
    // Need a zone with demanda < 8. Use 'Interior Norte' or similar.
    // Actually let's just test the boundary — Algarve demanda=7.5 < 8
    const signals = detectSignals({
      price:          500_000,
      zone:           'Algarve',
      days_on_market: 1,
    })
    expect(signals.some(s => s.signal_type === 'hot_zone_new')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// detectSignals — revenue_impact calculation
// ---------------------------------------------------------------------------

describe('detectSignals — revenue_impact', () => {
  it('revenue_impact is proportional to price (5% commission × probability)', () => {
    const lowPrice  = detectSignals({ price: 200_000, price_previous: 230_000, zone: 'Porto' })
    const highPrice = detectSignals({ price: 800_000, price_previous: 920_000, zone: 'Porto' })

    const lowImpact  = lowPrice.find(s => s.signal_type === 'price_reduction')?.revenue_impact ?? 0
    const highImpact = highPrice.find(s => s.signal_type === 'price_reduction')?.revenue_impact ?? 0

    expect(highImpact).toBeGreaterThan(lowImpact)
  })
})

// ---------------------------------------------------------------------------
// detectSignals — signal ordering (HIGH first)
// ---------------------------------------------------------------------------

describe('detectSignals — ordering', () => {
  it('HIGH severity signals come before MEDIUM in returned array', () => {
    // price_reduction 15% (HIGH) + stale (MEDIUM if DOM ratio 1.5-2.5)
    // Porto median=55, DOM=120 → ratio=2.18 → MEDIUM stale
    const signals = detectSignals({
      price:          500_000,
      price_previous: 590_000,  // 15.25% → HIGH price_reduction
      zone:           'Porto',
      days_on_market: 120,      // MEDIUM stale
    })

    const highSignals   = signals.filter(s => s.severity === 'HIGH')
    const mediumSignals = signals.filter(s => s.severity === 'MEDIUM')

    if (highSignals.length > 0 && mediumSignals.length > 0) {
      const lastHighIdx   = signals.lastIndexOf(highSignals[highSignals.length - 1])
      const firstMedIdx   = signals.indexOf(mediumSignals[0])
      expect(lastHighIdx).toBeLessThan(firstMedIdx)
    }
  })
})
