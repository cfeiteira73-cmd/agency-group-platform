// =============================================================================
// Tests — lib/intelligence/distributionRouter.ts
// Pure function tests only (no DB calls)
// =============================================================================

import { describe, it, expect, vi } from 'vitest'

vi.mock('../../../lib/supabase', () => ({ supabaseAdmin: {}, supabase: {} }))

import {
  scoreAgentFit,
  scoreInvestorFit,
  getDistributionTier,
  routeDeal,
} from '../../../lib/intelligence/distributionRouter'
import type {
  PropertyForRouting,
  AgentForRouting,
  InvestorForRouting,
} from '../../../lib/intelligence/distributionRouter'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProperty(overrides: Partial<PropertyForRouting> = {}): PropertyForRouting {
  return {
    id:                'prop-001',
    opportunity_score: 80,
    opportunity_grade: 'A',
    zone_key:          'lisboa-centro',
    type:              'apartment',
    price:             650_000,
    ...overrides,
  }
}

function makeAgent(overrides: Partial<AgentForRouting> = {}): AgentForRouting {
  return {
    id:                    'agent-001',
    email:                 'agent@test.com',
    agent_execution_score: 70,
    top_property_types:    ['apartment'],
    top_zones:             ['lisboa-centro'],
    active_deals_count:    2,
    ...overrides,
  }
}

function makeInvestor(overrides: Partial<InvestorForRouting> = {}): InvestorForRouting {
  return {
    id:                    'inv-001',
    email:                 'investor@test.com',
    engagement_score:      75,
    fit_score:             0.85,
    preferred_asset_types: ['apartment'],
    preferred_zones:       ['lisboa-centro'],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// scoreAgentFit
// ---------------------------------------------------------------------------

describe('scoreAgentFit', () => {
  it('base = agent_execution_score', () => {
    const agent    = makeAgent({ top_property_types: [], top_zones: [], active_deals_count: 0 })
    const property = makeProperty()
    expect(scoreAgentFit(agent, property)).toBe(70)
  })

  it('+15 for type specialization match', () => {
    const agent    = makeAgent({ top_property_types: ['apartment'], top_zones: [], active_deals_count: 0 })
    const property = makeProperty({ type: 'apartment' })
    expect(scoreAgentFit(agent, property)).toBe(85)
  })

  it('+10 for zone specialization match', () => {
    const agent    = makeAgent({ top_property_types: [], top_zones: ['lisboa-centro'], active_deals_count: 0 })
    const property = makeProperty({ zone_key: 'lisboa-centro' })
    expect(scoreAgentFit(agent, property)).toBe(80)
  })

  it('+25 for both type and zone match', () => {
    const agent    = makeAgent({ top_property_types: ['apartment'], top_zones: ['lisboa-centro'], active_deals_count: 0 })
    const property = makeProperty({ type: 'apartment', zone_key: 'lisboa-centro' })
    expect(scoreAgentFit(agent, property)).toBe(95)
  })

  it('-5 workload penalty for 5-6 active deals', () => {
    const agent    = makeAgent({ top_property_types: [], top_zones: [], active_deals_count: 5 })
    const property = makeProperty()
    expect(scoreAgentFit(agent, property)).toBe(65)
  })

  it('-10 workload penalty for 7-9 active deals', () => {
    const agent    = makeAgent({ top_property_types: [], top_zones: [], active_deals_count: 7 })
    const property = makeProperty()
    expect(scoreAgentFit(agent, property)).toBe(60)
  })

  it('-20 workload penalty for 10+ active deals', () => {
    const agent    = makeAgent({ top_property_types: [], top_zones: [], active_deals_count: 10 })
    const property = makeProperty()
    expect(scoreAgentFit(agent, property)).toBe(50)
  })

  it('score cannot go below 0', () => {
    const agent    = makeAgent({ agent_execution_score: 5, top_property_types: [], top_zones: [], active_deals_count: 15 })
    const property = makeProperty()
    expect(scoreAgentFit(agent, property)).toBe(0)
  })

  it('score cannot exceed 100', () => {
    const agent    = makeAgent({ agent_execution_score: 95, top_property_types: ['apartment'], top_zones: ['lisboa-centro'], active_deals_count: 0 })
    const property = makeProperty({ type: 'apartment', zone_key: 'lisboa-centro' })
    expect(scoreAgentFit(agent, property)).toBe(100)
  })
})

// ---------------------------------------------------------------------------
// scoreInvestorFit
// ---------------------------------------------------------------------------

describe('scoreInvestorFit', () => {
  it('pure fit: 60% fit + 40% engagement', () => {
    const investor = makeInvestor({ fit_score: 0.5, engagement_score: 50, preferred_asset_types: [], preferred_zones: [] })
    const property = makeProperty()
    // fitContrib = 0.5 * 60 = 30, engContrib = (50/100)*40 = 20 → 50
    expect(scoreInvestorFit(investor, property)).toBe(50)
  })

  it('+10 for asset type preference match', () => {
    const investor = makeInvestor({ fit_score: 0.5, engagement_score: 50, preferred_asset_types: ['apartment'], preferred_zones: [] })
    const property = makeProperty({ type: 'apartment' })
    // 30 + 20 + 10 = 60
    expect(scoreInvestorFit(investor, property)).toBe(60)
  })

  it('+8 for zone preference match', () => {
    const investor = makeInvestor({ fit_score: 0.5, engagement_score: 50, preferred_asset_types: [], preferred_zones: ['lisboa-centro'] })
    const property = makeProperty({ zone_key: 'lisboa-centro' })
    // 30 + 20 + 8 = 58
    expect(scoreInvestorFit(investor, property)).toBe(58)
  })

  it('+18 for both type and zone match', () => {
    const investor = makeInvestor({ fit_score: 0.5, engagement_score: 50, preferred_asset_types: ['apartment'], preferred_zones: ['lisboa-centro'] })
    const property = makeProperty({ type: 'apartment', zone_key: 'lisboa-centro' })
    // 30 + 20 + 10 + 8 = 68
    expect(scoreInvestorFit(investor, property)).toBe(68)
  })

  it('score cannot exceed 100', () => {
    const investor = makeInvestor({ fit_score: 1.0, engagement_score: 100, preferred_asset_types: ['apartment'], preferred_zones: ['lisboa-centro'] })
    const property = makeProperty({ type: 'apartment', zone_key: 'lisboa-centro' })
    expect(scoreInvestorFit(investor, property)).toBe(100)
  })

  it('score cannot go below 0', () => {
    const investor = makeInvestor({ fit_score: 0, engagement_score: 0, preferred_asset_types: [], preferred_zones: [] })
    const property = makeProperty()
    expect(scoreInvestorFit(investor, property)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// getDistributionTier
// ---------------------------------------------------------------------------

describe('getDistributionTier', () => {
  it('A+ grade → A+ tier', () => {
    expect(getDistributionTier('A+', 80)).toBe('A+')
  })
  it('score ≥85 → A+ tier', () => {
    expect(getDistributionTier('B', 85)).toBe('A+')
  })
  it('A grade → A tier', () => {
    expect(getDistributionTier('A', 60)).toBe('A')
  })
  it('score 70-84 → A tier', () => {
    expect(getDistributionTier('C', 72)).toBe('A')
  })
  it('B grade → B tier', () => {
    expect(getDistributionTier('B', 40)).toBe('B')
  })
  it('score 55-69 → B tier', () => {
    expect(getDistributionTier('C', 60)).toBe('B')
  })
  it('score <55 → skip', () => {
    expect(getDistributionTier('C', 54)).toBe('skip')
  })
  it('D grade + low score → skip', () => {
    expect(getDistributionTier('D', 30)).toBe('skip')
  })
})

// ---------------------------------------------------------------------------
// routeDeal
// ---------------------------------------------------------------------------

describe('routeDeal', () => {
  describe('skip tier', () => {
    it('returns skip decision for low-score property', () => {
      const property  = makeProperty({ opportunity_score: 40, opportunity_grade: 'C' })
      const decision  = routeDeal(property, [makeAgent()], [makeInvestor()])
      expect(decision.tier).toBe('skip')
      expect(decision.max_recipients).toBe(0)
      expect(decision.recommended_agents).toHaveLength(0)
      expect(decision.recommended_investors).toHaveLength(0)
      expect(decision.total_recommended).toBe(0)
    })
  })

  describe('A+ tier', () => {
    const property = makeProperty({ opportunity_score: 90, opportunity_grade: 'A+' })

    it('max 3 total recipients', () => {
      const agents    = Array.from({ length: 5 }, (_, i) => makeAgent({ id: `a${i}`, email: `a${i}@t.com`, agent_execution_score: 80 }))
      const investors = Array.from({ length: 5 }, (_, i) => makeInvestor({ id: `i${i}`, email: `i${i}@t.com` }))
      const decision  = routeDeal(property, agents, investors)
      expect(decision.tier).toBe('A+')
      expect(decision.max_recipients).toBe(3)
      expect(decision.total_recommended).toBeLessThanOrEqual(3)
    })

    it('requires agentMinScore 70 for A+ deals', () => {
      const lowAgent  = makeAgent({ agent_execution_score: 69 })
      const decision  = routeDeal(property, [lowAgent], [])
      expect(decision.recommended_agents).toHaveLength(0)
    })

    it('qualifies agents with score ≥70', () => {
      const agent    = makeAgent({ agent_execution_score: 70 })
      const decision = routeDeal(property, [agent], [])
      expect(decision.recommended_agents).toHaveLength(1)
    })

    it('requires investorMinFit 0.80 for A+ deals', () => {
      const lowInvestor = makeInvestor({ fit_score: 0.79, engagement_score: 80 })
      const decision    = routeDeal(property, [], [lowInvestor])
      expect(decision.recommended_investors).toHaveLength(0)
    })

    it('requires investorMinEngagement 60 for A+ deals', () => {
      const lowEngInv = makeInvestor({ fit_score: 0.90, engagement_score: 59 })
      const decision  = routeDeal(property, [], [lowEngInv])
      expect(decision.recommended_investors).toHaveLength(0)
    })
  })

  describe('A tier', () => {
    const property = makeProperty({ opportunity_score: 75, opportunity_grade: 'A' })

    it('max 5 total recipients', () => {
      const agents    = Array.from({ length: 5 }, (_, i) => makeAgent({ id: `a${i}`, email: `a${i}@t.com`, agent_execution_score: 60 }))
      const investors = Array.from({ length: 5 }, (_, i) => makeInvestor({ id: `i${i}`, email: `i${i}@t.com`, fit_score: 0.70, engagement_score: 50 }))
      const decision  = routeDeal(property, agents, investors)
      expect(decision.tier).toBe('A')
      expect(decision.max_recipients).toBe(5)
      expect(decision.total_recommended).toBeLessThanOrEqual(5)
    })
  })

  describe('B tier', () => {
    const property = makeProperty({ opportunity_score: 60, opportunity_grade: 'B' })

    it('max 10 total recipients', () => {
      const agents    = Array.from({ length: 8 }, (_, i) => makeAgent({ id: `a${i}`, email: `a${i}@t.com` }))
      const investors = Array.from({ length: 8 }, (_, i) => makeInvestor({ id: `i${i}`, email: `i${i}@t.com`, fit_score: 0.55, engagement_score: 0 }))
      const decision  = routeDeal(property, agents, investors)
      expect(decision.tier).toBe('B')
      expect(decision.max_recipients).toBe(10)
      expect(decision.total_recommended).toBeLessThanOrEqual(10)
    })

    it('B tier: no minimum filters on agents or investors', () => {
      const zeroAgent    = makeAgent({ agent_execution_score: 0 })
      const lowestInv    = makeInvestor({ fit_score: 0.50, engagement_score: 0 })
      const decision     = routeDeal(property, [zeroAgent], [lowestInv])
      expect(decision.recommended_agents).toHaveLength(1)
      expect(decision.recommended_investors).toHaveLength(1)
    })
  })

  describe('agent/investor split', () => {
    it('agents get ceil(maxTotal/2), investors get the rest', () => {
      const property  = makeProperty({ opportunity_score: 75, opportunity_grade: 'A' })
      const agents    = Array.from({ length: 5 }, (_, i) => makeAgent({ id: `a${i}`, email: `a${i}@t.com`, agent_execution_score: 60 }))
      const investors = Array.from({ length: 5 }, (_, i) => makeInvestor({ id: `i${i}`, email: `i${i}@t.com`, fit_score: 0.70, engagement_score: 50 }))
      const decision  = routeDeal(property, agents, investors)
      // A tier: maxTotal=5, maxAgents=ceil(5/2)=3, maxInvestors=5-topAgents.length
      expect(decision.recommended_agents.length).toBeLessThanOrEqual(3)
      const expectedMaxInvestors = 5 - decision.recommended_agents.length
      expect(decision.recommended_investors.length).toBeLessThanOrEqual(expectedMaxInvestors)
    })
  })

  describe('result structure', () => {
    it('every recommended target has id, email, score, reason', () => {
      const property = makeProperty({ opportunity_score: 75, opportunity_grade: 'A' })
      const decision = routeDeal(property, [makeAgent()], [makeInvestor()])

      for (const target of [...decision.recommended_agents, ...decision.recommended_investors]) {
        expect(target).toHaveProperty('id')
        expect(target).toHaveProperty('email')
        expect(target).toHaveProperty('score')
        expect(target).toHaveProperty('reason')
        expect(typeof target.score).toBe('number')
      }
    })

    it('routing_rationale is a non-empty string', () => {
      const property = makeProperty({ opportunity_score: 75, opportunity_grade: 'A' })
      const decision = routeDeal(property, [makeAgent()], [makeInvestor()])
      expect(typeof decision.routing_rationale).toBe('string')
      expect(decision.routing_rationale.length).toBeGreaterThan(0)
    })

    it('total_recommended = agents + investors', () => {
      const property = makeProperty({ opportunity_score: 60, opportunity_grade: 'B' })
      const decision = routeDeal(property, [makeAgent(), makeAgent()], [makeInvestor()])
      expect(decision.total_recommended).toBe(
        decision.recommended_agents.length + decision.recommended_investors.length,
      )
    })
  })

  describe('ordering', () => {
    it('agents sorted by fit score descending', () => {
      const property = makeProperty({ opportunity_score: 60, opportunity_grade: 'B' })
      const agents   = [
        makeAgent({ id: 'a1', email: 'a1@t.com', agent_execution_score: 50, top_property_types: [] }),
        makeAgent({ id: 'a2', email: 'a2@t.com', agent_execution_score: 90, top_property_types: ['apartment'] }),
      ]
      const decision = routeDeal(property, agents, [])
      if (decision.recommended_agents.length >= 2) {
        expect(decision.recommended_agents[0].score).toBeGreaterThanOrEqual(
          decision.recommended_agents[1].score,
        )
      }
    })
  })
})
