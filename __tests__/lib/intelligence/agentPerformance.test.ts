// =============================================================================
// Tests — lib/intelligence/agentPerformance.ts
// Pure function tests only (no DB calls)
// =============================================================================

import { describe, it, expect, vi } from 'vitest'

vi.mock('../../../lib/supabase', () => ({ supabaseAdmin: {}, supabase: {} }))

import {
  computeAgentExecutionScore,
  assignAgentTier,
  rankAgents,
} from '../../../lib/intelligence/agentPerformance'
import type { AgentMetrics } from '../../../lib/intelligence/agentPerformance'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMetrics(overrides: Partial<AgentMetrics> = {}): AgentMetrics {
  return {
    agent_email:             'agent@test.com',
    total_deals_assigned:    10,
    total_deals_closed:      7,
    total_deals_lost:        3,
    avg_days_to_close:       60,
    avg_negotiation_delta:   -5,
    avg_deal_size:           400_000,
    top_property_types:      ['apartment'],
    top_zones:               ['lisboa-centro'],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// computeAgentExecutionScore — dimension tests
// ---------------------------------------------------------------------------

describe('computeAgentExecutionScore', () => {
  describe('close_rate_score (0-30)', () => {
    it('no data returns neutral 15', () => {
      const s = computeAgentExecutionScore(makeMetrics({ total_deals_assigned: 0 }))
      expect(s.close_rate_score).toBe(15)
    })
    it('70%+ close rate = 30', () => {
      const s = computeAgentExecutionScore(makeMetrics({ total_deals_assigned: 10, total_deals_closed: 7 }))
      expect(s.close_rate_score).toBe(30)
    })
    it('60-69% = 25', () => {
      const s = computeAgentExecutionScore(makeMetrics({ total_deals_assigned: 10, total_deals_closed: 6 }))
      expect(s.close_rate_score).toBe(25)
    })
    it('50-59% = 20', () => {
      const s = computeAgentExecutionScore(makeMetrics({ total_deals_assigned: 10, total_deals_closed: 5 }))
      expect(s.close_rate_score).toBe(20)
    })
    it('40-49% = 14', () => {
      const s = computeAgentExecutionScore(makeMetrics({ total_deals_assigned: 10, total_deals_closed: 4 }))
      expect(s.close_rate_score).toBe(14)
    })
    it('30-39% = 8', () => {
      const s = computeAgentExecutionScore(makeMetrics({ total_deals_assigned: 10, total_deals_closed: 3 }))
      expect(s.close_rate_score).toBe(8)
    })
    it('<30% = 3', () => {
      const s = computeAgentExecutionScore(makeMetrics({ total_deals_assigned: 10, total_deals_closed: 2 }))
      expect(s.close_rate_score).toBe(3)
    })
  })

  describe('speed_score (0-20)', () => {
    it('no data returns neutral 10', () => {
      const s = computeAgentExecutionScore(makeMetrics({ avg_days_to_close: null }))
      expect(s.speed_score).toBe(10)
    })
    it('≤30 days = 20', () => {
      const s = computeAgentExecutionScore(makeMetrics({ avg_days_to_close: 25 }))
      expect(s.speed_score).toBe(20)
    })
    it('≤45 days = 17', () => {
      const s = computeAgentExecutionScore(makeMetrics({ avg_days_to_close: 42 }))
      expect(s.speed_score).toBe(17)
    })
    it('≤60 days = 14', () => {
      const s = computeAgentExecutionScore(makeMetrics({ avg_days_to_close: 60 }))
      expect(s.speed_score).toBe(14)
    })
    it('≤90 days = 10', () => {
      const s = computeAgentExecutionScore(makeMetrics({ avg_days_to_close: 90 }))
      expect(s.speed_score).toBe(10)
    })
    it('≤120 days = 6', () => {
      const s = computeAgentExecutionScore(makeMetrics({ avg_days_to_close: 110 }))
      expect(s.speed_score).toBe(6)
    })
    it('≤180 days = 3', () => {
      const s = computeAgentExecutionScore(makeMetrics({ avg_days_to_close: 150 }))
      expect(s.speed_score).toBe(3)
    })
    it('>180 days = 1', () => {
      const s = computeAgentExecutionScore(makeMetrics({ avg_days_to_close: 200 }))
      expect(s.speed_score).toBe(1)
    })
  })

  describe('negotiation_score (0-25)', () => {
    it('null returns neutral 12', () => {
      const s = computeAgentExecutionScore(makeMetrics({ avg_negotiation_delta: null }))
      expect(s.negotiation_score).toBe(12)
    })
    it('≥-2% = 25 (exceptional)', () => {
      const s = computeAgentExecutionScore(makeMetrics({ avg_negotiation_delta: -1 }))
      expect(s.negotiation_score).toBe(25)
    })
    it('≥-4% = 22', () => {
      const s = computeAgentExecutionScore(makeMetrics({ avg_negotiation_delta: -3 }))
      expect(s.negotiation_score).toBe(22)
    })
    it('≥-6% = 18 (strong)', () => {
      const s = computeAgentExecutionScore(makeMetrics({ avg_negotiation_delta: -5 }))
      expect(s.negotiation_score).toBe(18)
    })
    it('≥-8% = 14', () => {
      const s = computeAgentExecutionScore(makeMetrics({ avg_negotiation_delta: -7 }))
      expect(s.negotiation_score).toBe(14)
    })
    it('≥-12% = 9 (PT market average)', () => {
      const s = computeAgentExecutionScore(makeMetrics({ avg_negotiation_delta: -10 }))
      expect(s.negotiation_score).toBe(9)
    })
    it('≥-15% = 5', () => {
      const s = computeAgentExecutionScore(makeMetrics({ avg_negotiation_delta: -14 }))
      expect(s.negotiation_score).toBe(5)
    })
    it('<-15% = 2 (heavy discounting)', () => {
      const s = computeAgentExecutionScore(makeMetrics({ avg_negotiation_delta: -20 }))
      expect(s.negotiation_score).toBe(2)
    })
  })

  describe('deal_size_score (0-15)', () => {
    it('null returns neutral 7', () => {
      const s = computeAgentExecutionScore(makeMetrics({ avg_deal_size: null }))
      expect(s.deal_size_score).toBe(7)
    })
    it('≥1M = 15', () => {
      const s = computeAgentExecutionScore(makeMetrics({ avg_deal_size: 1_200_000 }))
      expect(s.deal_size_score).toBe(15)
    })
    it('≥750K = 13', () => {
      const s = computeAgentExecutionScore(makeMetrics({ avg_deal_size: 800_000 }))
      expect(s.deal_size_score).toBe(13)
    })
    it('≥500K = 10', () => {
      const s = computeAgentExecutionScore(makeMetrics({ avg_deal_size: 550_000 }))
      expect(s.deal_size_score).toBe(10)
    })
    it('≥300K = 7', () => {
      const s = computeAgentExecutionScore(makeMetrics({ avg_deal_size: 350_000 }))
      expect(s.deal_size_score).toBe(7)
    })
    it('≥150K = 4', () => {
      const s = computeAgentExecutionScore(makeMetrics({ avg_deal_size: 200_000 }))
      expect(s.deal_size_score).toBe(4)
    })
    it('<150K = 2', () => {
      const s = computeAgentExecutionScore(makeMetrics({ avg_deal_size: 100_000 }))
      expect(s.deal_size_score).toBe(2)
    })
  })

  describe('specialization_score (0-10)', () => {
    it('1 top type + 5+ closed deals = 10', () => {
      const s = computeAgentExecutionScore(makeMetrics({
        top_property_types: ['apartment'],
        total_deals_closed: 5,
      }))
      expect(s.specialization_score).toBe(10)
    })
    it('1 top type + 3-4 closed deals = 7', () => {
      const s = computeAgentExecutionScore(makeMetrics({
        top_property_types: ['villa'],
        total_deals_closed: 3,
      }))
      expect(s.specialization_score).toBe(7)
    })
    it('1 top type + 2 closed deals = 5', () => {
      const s = computeAgentExecutionScore(makeMetrics({
        top_property_types: ['commercial'],
        total_deals_closed: 2,
      }))
      expect(s.specialization_score).toBe(5)
    })
    it('zone only + 1 deal = 3', () => {
      const s = computeAgentExecutionScore(makeMetrics({
        top_property_types: [],
        top_zones:          ['porto-centro'],
        total_deals_closed: 1,
      }))
      expect(s.specialization_score).toBe(3)
    })
    it('no specialization = 2', () => {
      const s = computeAgentExecutionScore(makeMetrics({
        top_property_types: [],
        top_zones:          [],
        total_deals_closed: 0,
      }))
      expect(s.specialization_score).toBe(2)
    })
  })

  it('total = sum of dimensions', () => {
    const s = computeAgentExecutionScore(makeMetrics())
    const expected = s.close_rate_score + s.speed_score + s.negotiation_score
      + s.deal_size_score + s.specialization_score
    expect(s.total).toBe(Math.min(100, Math.round(expected)))
  })

  it('total is capped at 100', () => {
    // All max dimensions
    const s = computeAgentExecutionScore(makeMetrics({
      total_deals_assigned:  10,
      total_deals_closed:    10,  // 100% close rate → 30
      avg_days_to_close:     20,  // ≤30 → 20
      avg_negotiation_delta: -1,  // ≥-2 → 25
      avg_deal_size:         2_000_000,  // ≥1M → 15
      top_property_types:    ['apartment'],
      total_deals_closed:    10,  // ≥5 → 10
    }))
    expect(s.total).toBeLessThanOrEqual(100)
  })

  it('total is non-negative', () => {
    const s = computeAgentExecutionScore(makeMetrics({
      total_deals_assigned: 10,
      total_deals_closed:   0,
      avg_days_to_close:    365,
      avg_negotiation_delta: -50,
      avg_deal_size:         50_000,
      top_property_types:   [],
      top_zones:            [],
    }))
    expect(s.total).toBeGreaterThanOrEqual(0)
  })
})

// ---------------------------------------------------------------------------
// assignAgentTier
// ---------------------------------------------------------------------------

describe('assignAgentTier', () => {
  it('≥80 = ELITE', () => {
    expect(assignAgentTier(80)).toBe('ELITE')
    expect(assignAgentTier(95)).toBe('ELITE')
  })
  it('65-79 = SENIOR', () => {
    expect(assignAgentTier(65)).toBe('SENIOR')
    expect(assignAgentTier(79)).toBe('SENIOR')
  })
  it('45-64 = STANDARD', () => {
    expect(assignAgentTier(45)).toBe('STANDARD')
    expect(assignAgentTier(64)).toBe('STANDARD')
  })
  it('<45 = DEVELOPING', () => {
    expect(assignAgentTier(44)).toBe('DEVELOPING')
    expect(assignAgentTier(0)).toBe('DEVELOPING')
  })
})

// ---------------------------------------------------------------------------
// rankAgents
// ---------------------------------------------------------------------------

describe('rankAgents', () => {
  it('returns empty array for empty input', () => {
    expect(rankAgents([])).toEqual([])
  })

  it('ranks by execution score descending', () => {
    const agents = [
      makeMetrics({ agent_email: 'low@test.com',  total_deals_assigned: 10, total_deals_closed: 2, avg_days_to_close: 200 }),
      makeMetrics({ agent_email: 'high@test.com', total_deals_assigned: 10, total_deals_closed: 8, avg_days_to_close: 30 }),
      makeMetrics({ agent_email: 'mid@test.com',  total_deals_assigned: 10, total_deals_closed: 5, avg_days_to_close: 90 }),
    ]
    const ranked = rankAgents(agents)
    expect(ranked[0].agent_email).toBe('high@test.com')
    expect(ranked[0].rank).toBe(1)
    expect(ranked[1].rank).toBe(2)
    expect(ranked[2].rank).toBe(3)
  })

  it('assigns correct tiers', () => {
    const agents = [
      makeMetrics({ total_deals_assigned: 10, total_deals_closed: 8, avg_days_to_close: 30, avg_negotiation_delta: -1, avg_deal_size: 1_200_000, top_property_types: ['apartment'], agent_email: 'elite@test.com' }),
      makeMetrics({ total_deals_assigned: 10, total_deals_closed: 2, avg_days_to_close: 200, avg_negotiation_delta: -20, avg_deal_size: 80_000, top_property_types: [], top_zones: [], agent_email: 'dev@test.com' }),
    ]
    const ranked = rankAgents(agents)
    const elite = ranked.find(r => r.agent_email === 'elite@test.com')
    const dev   = ranked.find(r => r.agent_email === 'dev@test.com')
    expect(elite?.tier).toBe('ELITE')
    // dev should be STANDARD or DEVELOPING
    expect(['STANDARD', 'DEVELOPING']).toContain(dev?.tier)
  })

  it('rank property equals array index + 1', () => {
    const agents = Array.from({ length: 5 }, (_, i) =>
      makeMetrics({ agent_email: `agent${i}@test.com` }),
    )
    const ranked = rankAgents(agents)
    ranked.forEach((r, idx) => expect(r.rank).toBe(idx + 1))
  })
})
