// =============================================================================
// Tests — lib/intelligence/marketSegments.ts  (pure functions only)
// =============================================================================

import { describe, it, expect, vi } from 'vitest'

vi.mock('../../../lib/supabase', () => ({ supabaseAdmin: {}, supabase: {} }))

import {
  classifyPriceBand,
  computeConfidenceBand,
  computeMedian,
  detectRegimeShift,
  computeTrendDirection,
  computeSegmentConfidence,
  buildSegmentSnapshot,
} from '../../../lib/intelligence/marketSegments'
import type { SegmentSnapshotInput } from '../../../lib/intelligence/marketSegments'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInput(overrides: Partial<SegmentSnapshotInput> = {}): SegmentSnapshotInput {
  return {
    dealPrices:          [400_000, 500_000, 600_000],
    pricesPerSqm:        [4000, 4500, 5000],
    negotiationDeltas:   [-2, 0, 3],
    saleToAskRatios:     [0.98, 1.00, 1.03],
    daysToClose:         [30, 45, 60],
    avmErrors:           [5, -3, 8],
    investorDealCount:   2,
    agentDealCount:      1,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// classifyPriceBand
// ---------------------------------------------------------------------------

describe('classifyPriceBand', () => {
  it('under 200k', ()   => expect(classifyPriceBand(150_000)).toBe('under_200k'))
  it('200k to 500k', () => expect(classifyPriceBand(350_000)).toBe('200k_500k'))
  it('500k to 1m', ()   => expect(classifyPriceBand(750_000)).toBe('500k_1m'))
  it('1m to 3m', ()     => expect(classifyPriceBand(2_000_000)).toBe('1m_3m'))
  it('over 3m', ()      => expect(classifyPriceBand(5_000_000)).toBe('over_3m'))
  it('exact boundary 200k → 200k_500k', () => expect(classifyPriceBand(200_000)).toBe('200k_500k'))
  it('exact boundary 500k → 500k_1m',   () => expect(classifyPriceBand(500_000)).toBe('500k_1m'))
  it('exact boundary 3m → over_3m',     () => expect(classifyPriceBand(3_000_000)).toBe('over_3m'))
})

// ---------------------------------------------------------------------------
// computeConfidenceBand
// ---------------------------------------------------------------------------

describe('computeConfidenceBand', () => {
  it('returns zeros for empty array', () => {
    const b = computeConfidenceBand([])
    expect(b.mean).toBe(0)
    expect(b.low).toBe(0)
    expect(b.high).toBe(0)
    expect(b.sigma).toBe(0)
  })

  it('single value has zero sigma', () => {
    const b = computeConfidenceBand([5000])
    expect(b.mean).toBe(5000)
    expect(b.sigma).toBe(0)
    expect(b.low).toBe(5000)
    expect(b.high).toBe(5000)
  })

  it('computes mean correctly', () => {
    const b = computeConfidenceBand([4000, 5000, 6000])
    expect(b.mean).toBe(5000)
  })

  it('low < mean < high for varied data', () => {
    const b = computeConfidenceBand([3000, 4000, 5000, 6000, 7000])
    expect(b.low).toBeLessThan(b.mean)
    expect(b.high).toBeGreaterThan(b.mean)
  })

  it('band width proportional to spread', () => {
    const tight = computeConfidenceBand([100, 101, 102])
    const wide  = computeConfidenceBand([100, 200, 300])
    expect(wide.sigma).toBeGreaterThan(tight.sigma)
  })
})

// ---------------------------------------------------------------------------
// computeMedian
// ---------------------------------------------------------------------------

describe('computeMedian', () => {
  it('null for empty array', () => {
    expect(computeMedian([])).toBeNull()
  })

  it('single element', () => {
    expect(computeMedian([42])).toBe(42)
  })

  it('odd count returns middle', () => {
    expect(computeMedian([1, 3, 5])).toBe(3)
  })

  it('even count returns avg of two middles', () => {
    expect(computeMedian([1, 2, 3, 4])).toBe(2.5)
  })

  it('works with unsorted input', () => {
    expect(computeMedian([5, 1, 3])).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// detectRegimeShift
// ---------------------------------------------------------------------------

describe('detectRegimeShift', () => {
  it('no shift when change < threshold', () => {
    const r = detectRegimeShift(5000, 5200, 'price', 0.08)
    // 200/5200 = 3.8% < 8% → no shift
    expect(r.detected).toBe(false)
  })

  it('shift detected when change ≥ threshold', () => {
    const r = detectRegimeShift(5000, 4000, 'price', 0.08)
    // 1000/4000 = 25% > 8% → shift
    expect(r.detected).toBe(true)
    expect(r.metric).toBe('price')
    expect(r.magnitude).toBeGreaterThan(0)
  })

  it('returns false when prior is zero', () => {
    const r = detectRegimeShift(5000, 0, 'price', 0.08)
    expect(r.detected).toBe(false)
  })

  it('magnitude is absolute (not directional)', () => {
    const up   = detectRegimeShift(5500, 5000, 'p', 0.08)   // +10%
    const down = detectRegimeShift(4500, 5000, 'p', 0.08)   // -10%
    expect(up.magnitude).toBeCloseTo(down.magnitude ?? 0, 0)
  })
})

// ---------------------------------------------------------------------------
// computeTrendDirection
// ---------------------------------------------------------------------------

describe('computeTrendDirection', () => {
  it('rising when short > long by >3%', () => {
    expect(computeTrendDirection(5300, 5000)).toBe('rising')    // +6%
  })

  it('falling when short < long by >3%', () => {
    expect(computeTrendDirection(4700, 5000)).toBe('falling')   // -6%
  })

  it('stable when change ≤3%', () => {
    expect(computeTrendDirection(5100, 5000)).toBe('stable')    // +2%
  })

  it('unknown when either null', () => {
    expect(computeTrendDirection(null, 5000)).toBe('unknown')
    expect(computeTrendDirection(5000, null)).toBe('unknown')
  })

  it('unknown when long = 0', () => {
    expect(computeTrendDirection(5000, 0)).toBe('unknown')
  })
})

// ---------------------------------------------------------------------------
// computeSegmentConfidence
// ---------------------------------------------------------------------------

describe('computeSegmentConfidence', () => {
  it('0 when no data', () => {
    expect(computeSegmentConfidence(0, false, false)).toBe(0)
  })

  it('capped at 100', () => {
    expect(computeSegmentConfidence(1000, true, true)).toBe(100)
  })

  it('higher with negotiation and AVM data', () => {
    const base  = computeSegmentConfidence(10, false, false)
    const rich  = computeSegmentConfidence(10, true, true)
    expect(rich).toBeGreaterThan(base)
  })

  it('30+ samples gives full sample contribution (60 pts)', () => {
    const score = computeSegmentConfidence(30, false, false)
    expect(score).toBe(60)
  })
})

// ---------------------------------------------------------------------------
// buildSegmentSnapshot
// ---------------------------------------------------------------------------

describe('buildSegmentSnapshot', () => {
  it('builds snapshot with correct zone and type', () => {
    const s = buildSegmentSnapshot('lisboa', 'apartment', 'all', '30d', makeInput())
    expect(s.zone_key).toBe('lisboa')
    expect(s.property_type).toBe('apartment')
    expect(s.price_band).toBe('all')
    expect(s.period_label).toBe('30d')
  })

  it('computes avg_price_per_sqm', () => {
    const s = buildSegmentSnapshot('z', 't', 'all', '7d', makeInput({
      pricesPerSqm: [4000, 5000, 6000],
    }))
    expect(s.avg_price_per_sqm).toBe(5000)
  })

  it('investor/agent deal pct sums to 100', () => {
    const s = buildSegmentSnapshot('z', 't', 'all', '7d', makeInput({
      investorDealCount: 3,
      agentDealCount:    7,
    }))
    expect(s.investor_deal_pct).toBe(30)
    expect(s.agent_deal_pct).toBe(70)
  })

  it('no regime shift when no prior price', () => {
    const s = buildSegmentSnapshot('z', 't', 'all', '7d', makeInput())
    expect(s.regime_shift_detected).toBe(false)
  })

  it('detects regime shift vs prior price', () => {
    const s = buildSegmentSnapshot('z', 't', 'all', '30d', makeInput({
      pricesPerSqm: [3000, 3000, 3000],   // avg 3000
    }), 5000)   // prior was 5000 → -40% shift
    expect(s.regime_shift_detected).toBe(true)
  })

  it('pct_sold_above_ask reflects positive deltas', () => {
    const s = buildSegmentSnapshot('z', 't', 'all', '7d', makeInput({
      negotiationDeltas: [3, 5, -1],    // 2 of 3 above ask
    }))
    expect(s.pct_sold_above_ask).toBeCloseTo(66.67, 0)
  })

  it('empty input gives null metrics', () => {
    const s = buildSegmentSnapshot('z', 't', 'all', '7d', {
      dealPrices: [], pricesPerSqm: [], negotiationDeltas: [],
      saleToAskRatios: [], daysToClose: [], avmErrors: [],
      investorDealCount: 0, agentDealCount: 0,
    })
    expect(s.avg_price_per_sqm).toBeNull()
    expect(s.avg_negotiation_delta).toBeNull()
    expect(s.confidence_score).toBe(0)
  })
})
