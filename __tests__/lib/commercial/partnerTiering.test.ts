// =============================================================================
// Tests — lib/commercial/partnerTiering.ts  (pure functions only)
// =============================================================================

import { describe, it, expect, vi } from 'vitest'

vi.mock('../../../lib/supabase', () => ({ supabaseAdmin: {}, supabase: {} }))

import {
  scoreResponsiveness,
  computeAgentPartnerScore,
  computeInvestorPartnerScore,
  classifyTier,
  classifyAgentTier,
  classifyInvestorTier,
  rankPartners,
} from '../../../lib/commercial/partnerTiering'
import type { AgentTierInput, InvestorTierInput } from '../../../lib/commercial/partnerTiering'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAgentInput(overrides: Partial<AgentTierInput> = {}): AgentTierInput {
  return {
    agent_email:            'agent@test.com',
    agent_execution_score:  80,
    close_rate:             0.65,
    avg_response_hours:     4,
    total_deals_closed:     10,
    ...overrides,
  }
}

function makeInvestorInput(overrides: Partial<InvestorTierInput> = {}): InvestorTierInput {
  return {
    investor_id:      'inv-001',
    email:            'inv@test.com',
    engagement_score: 70,
    conversion_rate:  0.10,
    budget_adherence: 0.85,
    total_deals:      5,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// scoreResponsiveness
// ---------------------------------------------------------------------------

describe('scoreResponsiveness', () => {
  it('null returns 50 (neutral)', () => {
    expect(scoreResponsiveness(null)).toBe(50)
  })
  it('≤1h = 100', () => {
    expect(scoreResponsiveness(1)).toBe(100)
    expect(scoreResponsiveness(0.5)).toBe(100)
  })
  it('≤4h = 85', () => {
    expect(scoreResponsiveness(3)).toBe(85)
  })
  it('≤12h = 65', () => {
    expect(scoreResponsiveness(8)).toBe(65)
  })
  it('≤24h = 45', () => {
    expect(scoreResponsiveness(20)).toBe(45)
  })
  it('≤48h = 25', () => {
    expect(scoreResponsiveness(36)).toBe(25)
  })
  it('>48h = 10', () => {
    expect(scoreResponsiveness(72)).toBe(10)
  })
})

// ---------------------------------------------------------------------------
// computeAgentPartnerScore
// ---------------------------------------------------------------------------

describe('computeAgentPartnerScore', () => {
  it('formula: execution*0.5 + closeRate*100*0.3 + responsiveness*0.2', () => {
    const input = makeAgentInput({
      agent_execution_score: 80,   // → 40
      close_rate:            0.70, // → 70*0.3 = 21
      avg_response_hours:    4,    // responsiveness=85 → 85*0.2=17
    })
    const score = computeAgentPartnerScore(input)
    // 40 + 21 + 17 = 78
    expect(score).toBe(78)
  })

  it('capped at 100', () => {
    const input = makeAgentInput({
      agent_execution_score: 100,
      close_rate:             1.0,
      avg_response_hours:     0.5,
    })
    expect(computeAgentPartnerScore(input)).toBe(100)
  })

  it('returns ≥ 0', () => {
    const input = makeAgentInput({ agent_execution_score: 0, close_rate: 0, avg_response_hours: 200 })
    expect(computeAgentPartnerScore(input)).toBeGreaterThanOrEqual(0)
  })

  it('higher close rate → higher score', () => {
    const low  = computeAgentPartnerScore(makeAgentInput({ close_rate: 0.30 }))
    const high = computeAgentPartnerScore(makeAgentInput({ close_rate: 0.80 }))
    expect(high).toBeGreaterThan(low)
  })
})

// ---------------------------------------------------------------------------
// computeInvestorPartnerScore
// ---------------------------------------------------------------------------

describe('computeInvestorPartnerScore', () => {
  it('formula: engagement*0.6 + conversion*100*0.3 + adherence*100*0.1', () => {
    const input = makeInvestorInput({
      engagement_score: 70,   // → 42
      conversion_rate:  0.10, // → 10*0.3 = 3
      budget_adherence: 0.80, // → 80*0.1 = 8
    })
    // 42 + 3 + 8 = 53
    expect(computeInvestorPartnerScore(input)).toBe(53)
  })

  it('null budget_adherence uses 0.5 default', () => {
    const withNull    = computeInvestorPartnerScore(makeInvestorInput({ budget_adherence: null }))
    const withDefault = computeInvestorPartnerScore(makeInvestorInput({ budget_adherence: 0.5 }))
    expect(withNull).toBe(withDefault)
  })

  it('capped at 100', () => {
    const input = makeInvestorInput({ engagement_score: 100, conversion_rate: 1.0, budget_adherence: 1.0 })
    expect(computeInvestorPartnerScore(input)).toBe(100)
  })

  it('higher engagement → higher score', () => {
    const low  = computeInvestorPartnerScore(makeInvestorInput({ engagement_score: 20 }))
    const high = computeInvestorPartnerScore(makeInvestorInput({ engagement_score: 90 }))
    expect(high).toBeGreaterThan(low)
  })
})

// ---------------------------------------------------------------------------
// classifyTier
// ---------------------------------------------------------------------------

describe('classifyTier', () => {
  it('≥80 = ELITE',     () => expect(classifyTier(80)).toBe('ELITE'))
  it('65-79 = PRIORITY',() => expect(classifyTier(65)).toBe('PRIORITY'))
  it('79 = PRIORITY',   () => expect(classifyTier(79)).toBe('PRIORITY'))
  it('45-64 = STANDARD',() => expect(classifyTier(45)).toBe('STANDARD'))
  it('64 = STANDARD',   () => expect(classifyTier(64)).toBe('STANDARD'))
  it('<45 = WATCHLIST', () => expect(classifyTier(44)).toBe('WATCHLIST'))
  it('0 = WATCHLIST',   () => expect(classifyTier(0)).toBe('WATCHLIST'))
})

// ---------------------------------------------------------------------------
// classifyAgentTier
// ---------------------------------------------------------------------------

describe('classifyAgentTier', () => {
  it('returns correct partner_type', () => {
    const result = classifyAgentTier(makeAgentInput())
    expect(result.partner_type).toBe('agent')
  })

  it('assigns ELITE to top performer', () => {
    const result = classifyAgentTier(makeAgentInput({
      agent_execution_score: 95,
      close_rate:            0.90,
      avg_response_hours:    1,
    }))
    expect(result.tier).toBe('ELITE')
  })

  it('assigns WATCHLIST to poor performer', () => {
    const result = classifyAgentTier(makeAgentInput({
      agent_execution_score: 20,
      close_rate:            0.10,
      avg_response_hours:    96,
    }))
    expect(result.tier).toBe('WATCHLIST')
  })

  it('includes criteria in result', () => {
    const result = classifyAgentTier(makeAgentInput())
    expect(result.criteria).toHaveProperty('agent_execution_score')
    expect(result.criteria).toHaveProperty('close_rate')
  })

  it('partner_email = agent_email', () => {
    const result = classifyAgentTier(makeAgentInput({ agent_email: 'foo@test.com' }))
    expect(result.partner_email).toBe('foo@test.com')
  })
})

// ---------------------------------------------------------------------------
// classifyInvestorTier
// ---------------------------------------------------------------------------

describe('classifyInvestorTier', () => {
  it('returns correct partner_type', () => {
    const result = classifyInvestorTier(makeInvestorInput())
    expect(result.partner_type).toBe('investor')
  })

  it('assigns ELITE to highly engaged investor', () => {
    // engagement=100 → 60, conversion=0.70 → 21, adherence=1.0 → 10 → total=91
    const result = classifyInvestorTier(makeInvestorInput({
      engagement_score: 100,
      conversion_rate:  0.70,
      budget_adherence: 1.0,
    }))
    expect(result.tier).toBe('ELITE')
  })

  it('partner_email = email field', () => {
    const result = classifyInvestorTier(makeInvestorInput({ email: 'inv@wealthy.com' }))
    expect(result.partner_email).toBe('inv@wealthy.com')
  })
})

// ---------------------------------------------------------------------------
// rankPartners
// ---------------------------------------------------------------------------

describe('rankPartners', () => {
  it('returns empty array for empty input', () => {
    expect(rankPartners([])).toEqual([])
  })

  it('ranks by tier_score descending', () => {
    const partners = [
      { partner_email: 'low@t.com',  partner_type: 'agent' as const, tier: 'STANDARD' as const,  tier_score: 50, criteria: {} },
      { partner_email: 'high@t.com', partner_type: 'agent' as const, tier: 'ELITE' as const,     tier_score: 90, criteria: {} },
      { partner_email: 'mid@t.com',  partner_type: 'agent' as const, tier: 'PRIORITY' as const,  tier_score: 70, criteria: {} },
    ]
    const ranked = rankPartners(partners)
    expect(ranked[0].partner_email).toBe('high@t.com')
    expect(ranked[0].rank).toBe(1)
    expect(ranked[2].partner_email).toBe('low@t.com')
    expect(ranked[2].rank).toBe(3)
  })

  it('rank property equals array index + 1', () => {
    const partners = Array.from({ length: 5 }, (_, i) => ({
      partner_email: `p${i}@t.com`,
      partner_type:  'agent' as const,
      tier:          'STANDARD' as const,
      tier_score:    50 + i,
      criteria:      {},
    }))
    const ranked = rankPartners(partners)
    ranked.forEach((r, idx) => expect(r.rank).toBe(idx + 1))
  })

  it('does not mutate original array', () => {
    const original = [
      { partner_email: 'a@t.com', partner_type: 'agent' as const, tier: 'STANDARD' as const, tier_score: 50, criteria: {} },
      { partner_email: 'b@t.com', partner_type: 'agent' as const, tier: 'ELITE' as const,    tier_score: 90, criteria: {} },
    ]
    const copy = [...original]
    rankPartners(original)
    expect(original).toEqual(copy)
  })
})
