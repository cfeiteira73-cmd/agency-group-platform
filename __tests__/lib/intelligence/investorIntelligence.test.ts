// =============================================================================
// Tests — lib/intelligence/investorIntelligence.ts
// Pure function tests only (no DB calls)
// =============================================================================

import { describe, it, expect, vi } from 'vitest'

vi.mock('../../../lib/supabase', () => ({ supabaseAdmin: {}, supabase: {} }))

import {
  computeInvestorEngagementScore,
  computeFitConfidence,
  reRankInvestorMatches,
} from '../../../lib/intelligence/investorIntelligence'
import type {
  InvestorEngagementData,
  InvestorPreferences,
  PropertyForInvestorMatch,
} from '../../../lib/intelligence/investorIntelligence'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEngagementData(overrides: Partial<InvestorEngagementData> = {}): InvestorEngagementData {
  return {
    investor_id:    'inv-001',
    total_surfaced: 20,
    total_opened:   14,
    total_replied:  4,
    total_meetings: 2,
    total_offers:   1,
    total_deals:    1,
    ...overrides,
  }
}

function makePreferences(overrides: Partial<Omit<InvestorPreferences, 'fit_confidence'>> = {}): Omit<InvestorPreferences, 'fit_confidence'> {
  return {
    preferred_asset_types:   ['apartment'],
    preferred_zones:         ['lisboa-centro'],
    inferred_yield_target:   5.5,
    inferred_risk_tolerance: 0.3,
    budget_adherence:        0.85,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// computeInvestorEngagementScore — dimension tests
// ---------------------------------------------------------------------------

describe('computeInvestorEngagementScore', () => {
  it('zero activity returns all zeros', () => {
    const s = computeInvestorEngagementScore(makeEngagementData({ total_surfaced: 0 }))
    expect(s.open_rate_score).toBe(0)
    expect(s.reply_rate_score).toBe(0)
    expect(s.meeting_rate_score).toBe(0)
    expect(s.conversion_rate_score).toBe(0)
    expect(s.total).toBe(0)
  })

  it('all rates at zero when no opens/replies/meetings/deals', () => {
    const s = computeInvestorEngagementScore(makeEngagementData({
      total_surfaced: 10, total_opened: 0, total_replied: 0, total_meetings: 0, total_deals: 0,
    }))
    expect(s.open_rate).toBe(0)
    expect(s.reply_rate).toBe(0)
    expect(s.meeting_rate).toBe(0)
    expect(s.conversion_rate).toBe(0)
  })

  describe('open_rate_score (0-25)', () => {
    it('≥80% → 25', () => {
      const s = computeInvestorEngagementScore(makeEngagementData({ total_surfaced: 10, total_opened: 9 }))
      expect(s.open_rate_score).toBe(25)
    })
    it('≥65% → 21', () => {
      const s = computeInvestorEngagementScore(makeEngagementData({ total_surfaced: 10, total_opened: 7 }))
      expect(s.open_rate_score).toBe(21)
    })
    it('≥50% → 17', () => {
      const s = computeInvestorEngagementScore(makeEngagementData({ total_surfaced: 10, total_opened: 5 }))
      expect(s.open_rate_score).toBe(17)
    })
    it('≥35% → 12', () => {
      const s = computeInvestorEngagementScore(makeEngagementData({ total_surfaced: 10, total_opened: 4 }))
      expect(s.open_rate_score).toBe(12)
    })
    it('≥20% → 7', () => {
      const s = computeInvestorEngagementScore(makeEngagementData({ total_surfaced: 10, total_opened: 2 }))
      expect(s.open_rate_score).toBe(7)
    })
    it('>0% → 3', () => {
      const s = computeInvestorEngagementScore(makeEngagementData({ total_surfaced: 100, total_opened: 1 }))
      expect(s.open_rate_score).toBe(3)
    })
  })

  describe('reply_rate_score (0-30)', () => {
    it('≥40% → 30', () => {
      const s = computeInvestorEngagementScore(makeEngagementData({ total_surfaced: 10, total_replied: 4 }))
      expect(s.reply_rate_score).toBe(30)
    })
    it('≥25% → 24', () => {
      const s = computeInvestorEngagementScore(makeEngagementData({ total_surfaced: 10, total_replied: 3 }))
      expect(s.reply_rate_score).toBe(24)
    })
    it('≥15% → 18', () => {
      const s = computeInvestorEngagementScore(makeEngagementData({ total_surfaced: 10, total_replied: 2 }))
      expect(s.reply_rate_score).toBe(18)
    })
    it('0% → 0', () => {
      const s = computeInvestorEngagementScore(makeEngagementData({ total_surfaced: 10, total_replied: 0 }))
      expect(s.reply_rate_score).toBe(0)
    })
  })

  describe('meeting_rate_score (0-25)', () => {
    it('≥25% → 25', () => {
      const s = computeInvestorEngagementScore(makeEngagementData({ total_surfaced: 4, total_meetings: 1 }))
      expect(s.meeting_rate_score).toBe(25)
    })
    it('≥15% → 20', () => {
      const s = computeInvestorEngagementScore(makeEngagementData({ total_surfaced: 20, total_meetings: 3 }))
      expect(s.meeting_rate_score).toBe(20)
    })
    it('0% → 0', () => {
      const s = computeInvestorEngagementScore(makeEngagementData({ total_surfaced: 10, total_meetings: 0 }))
      expect(s.meeting_rate_score).toBe(0)
    })
  })

  describe('conversion_rate_score (0-20)', () => {
    it('≥15% → 20', () => {
      const s = computeInvestorEngagementScore(makeEngagementData({ total_surfaced: 10, total_deals: 2 }))
      expect(s.conversion_rate_score).toBe(20)
    })
    it('≥10% → 17', () => {
      const s = computeInvestorEngagementScore(makeEngagementData({ total_surfaced: 10, total_deals: 1 }))
      expect(s.conversion_rate_score).toBe(17)
    })
    it('0% → 0', () => {
      const s = computeInvestorEngagementScore(makeEngagementData({ total_surfaced: 10, total_deals: 0 }))
      expect(s.conversion_rate_score).toBe(0)
    })
  })

  it('total = sum of all dimension scores (capped at 100)', () => {
    const s = computeInvestorEngagementScore(makeEngagementData())
    const sum = s.open_rate_score + s.reply_rate_score + s.meeting_rate_score + s.conversion_rate_score
    expect(s.total).toBe(Math.min(100, Math.round(sum)))
  })

  it('rates are stored as floats (0-1)', () => {
    const s = computeInvestorEngagementScore(makeEngagementData({ total_surfaced: 10, total_opened: 7 }))
    expect(s.open_rate).toBeCloseTo(0.7, 4)
  })

  it('perfect engagement = 100', () => {
    // Max possible: open=25 + reply=30 + meeting=25 + conversion=20 = 100
    const s = computeInvestorEngagementScore(makeEngagementData({
      total_surfaced: 10,
      total_opened:   10,   // 100% open rate
      total_replied:  5,    // 50% reply rate (>40%) → 30
      total_meetings: 3,    // 30% meeting rate (>25%) → 25
      total_deals:    2,    // 20% conversion (>15%) → 20
    }))
    expect(s.total).toBe(100)
  })
})

// ---------------------------------------------------------------------------
// computeFitConfidence
// ---------------------------------------------------------------------------

describe('computeFitConfidence', () => {
  it('starts at 0.50 base with no data', () => {
    const prefs = makePreferences({
      preferred_asset_types:   [],
      preferred_zones:         [],
      inferred_yield_target:   null,
      inferred_risk_tolerance: null,
      budget_adherence:        null,
    })
    expect(computeFitConfidence(prefs)).toBe(0.5)
  })

  it('full data set → high confidence', () => {
    const prefs = makePreferences()
    const conf  = computeFitConfidence(prefs)
    expect(conf).toBeGreaterThan(0.8)
  })

  it('+0.15 for 2+ asset types', () => {
    const base  = computeFitConfidence(makePreferences({ preferred_asset_types: [] }))
    const with2 = computeFitConfidence(makePreferences({ preferred_asset_types: ['apartment', 'villa'] }))
    expect(with2 - base).toBeCloseTo(0.15, 3)
  })

  it('+0.07 for 1 asset type', () => {
    const base  = computeFitConfidence(makePreferences({ preferred_asset_types: [] }))
    const with1 = computeFitConfidence(makePreferences({ preferred_asset_types: ['apartment'] }))
    expect(with1 - base).toBeCloseTo(0.07, 3)
  })

  it('confidence is capped at 1.0', () => {
    const prefs = makePreferences({
      preferred_asset_types:   ['apartment', 'villa', 'commercial'],
      preferred_zones:         ['lisboa', 'porto'],
      inferred_yield_target:   5.5,
      inferred_risk_tolerance: 0.3,
      budget_adherence:        0.9,
    })
    expect(computeFitConfidence(prefs)).toBeLessThanOrEqual(1.0)
  })
})

// ---------------------------------------------------------------------------
// reRankInvestorMatches
// ---------------------------------------------------------------------------

describe('reRankInvestorMatches', () => {
  const property: PropertyForInvestorMatch = {
    id:        'prop-001',
    type:      'apartment',
    zone_key:  'lisboa-centro',
    price:     650_000,
    fit_score: 0.8,
  }

  it('returns empty array for empty investors', () => {
    expect(reRankInvestorMatches(property, [])).toEqual([])
  })

  it('preserves all investors in output', () => {
    const investors = Array.from({ length: 5 }, (_, i) => ({
      investor_id:           `inv-${i}`,
      fit_score:             0.6,
      engagement_score:      50,
      preferred_asset_types: [],
      preferred_zones:       [],
    }))
    const ranked = reRankInvestorMatches(property, investors)
    expect(ranked).toHaveLength(5)
  })

  it('sorts by composite_score descending', () => {
    const investors = [
      { investor_id: 'low', fit_score: 0.3, engagement_score: 20, preferred_asset_types: [], preferred_zones: [] },
      { investor_id: 'high', fit_score: 0.9, engagement_score: 90, preferred_asset_types: ['apartment'], preferred_zones: ['lisboa-centro'] },
      { investor_id: 'mid', fit_score: 0.6, engagement_score: 50, preferred_asset_types: [], preferred_zones: [] },
    ]
    const ranked = reRankInvestorMatches(property, investors)
    expect(ranked[0].investor_id).toBe('high')
    expect(ranked[0].new_rank).toBe(1)
    expect(ranked[ranked.length - 1].investor_id).toBe('low')
  })

  it('rank_change is positive when investor moved up', () => {
    const investors = [
      { investor_id: 'low-first',  fit_score: 0.3, engagement_score: 10, preferred_asset_types: [], preferred_zones: [] },
      { investor_id: 'high-second', fit_score: 0.9, engagement_score: 90, preferred_asset_types: ['apartment'], preferred_zones: ['lisboa-centro'] },
    ]
    const ranked = reRankInvestorMatches(property, investors)
    const movedUp = ranked.find(r => r.investor_id === 'high-second')
    // Was #2 originally, should be #1 now → rank_change = 2 - 1 = 1
    expect(movedUp?.rank_change).toBe(1)
  })

  it('rank_change is 0 for investors whose rank did not change', () => {
    const investors = [
      { investor_id: 'stable', fit_score: 0.9, engagement_score: 90, preferred_asset_types: ['apartment'], preferred_zones: [] },
    ]
    const ranked = reRankInvestorMatches(property, investors)
    expect(ranked[0].rank_change).toBe(0)
  })

  it('composite_score includes +5 type bonus and +5 zone bonus', () => {
    const baseInvestor    = { investor_id: 'base',    fit_score: 0.5, engagement_score: 50, preferred_asset_types: [], preferred_zones: [] }
    const typeInvestor    = { investor_id: 'type',    fit_score: 0.5, engagement_score: 50, preferred_asset_types: ['apartment'], preferred_zones: [] }
    const bothInvestor    = { investor_id: 'both',    fit_score: 0.5, engagement_score: 50, preferred_asset_types: ['apartment'], preferred_zones: ['lisboa-centro'] }
    const ranked = reRankInvestorMatches(property, [baseInvestor, typeInvestor, bothInvestor])

    const base = ranked.find(r => r.investor_id === 'base')!
    const type = ranked.find(r => r.investor_id === 'type')!
    const both = ranked.find(r => r.investor_id === 'both')!

    expect(type.composite_score - base.composite_score).toBe(5)
    expect(both.composite_score - base.composite_score).toBe(10)
  })

  it('all fields are present in each result', () => {
    const investors = [
      { investor_id: 'inv-1', fit_score: 0.7, engagement_score: 60, preferred_asset_types: [], preferred_zones: [] },
    ]
    const ranked = reRankInvestorMatches(property, investors)
    const result = ranked[0]
    expect(result).toHaveProperty('investor_id')
    expect(result).toHaveProperty('original_rank')
    expect(result).toHaveProperty('new_rank')
    expect(result).toHaveProperty('composite_score')
    expect(result).toHaveProperty('engagement_score')
    expect(result).toHaveProperty('fit_score_pct')
    expect(result).toHaveProperty('rank_change')
    expect(result).toHaveProperty('reason')
  })
})
