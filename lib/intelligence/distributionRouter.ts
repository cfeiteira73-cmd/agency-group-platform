// =============================================================================
// Agency Group — Distribution Economics Engine
// lib/intelligence/distributionRouter.ts
//
// Optimizes who receives each deal opportunity to maximize close probability
// while protecting exclusivity and managing agent workload.
//
// DISTRIBUTION TIERS:
//   A+ (score ≥85): max 3 recipients — elite execution only
//   A  (70-84):     max 5 recipients — high-quality agents
//   B  (55-69):     max 10 recipients — broader distribution
//   skip (<55):     no distribution
//
// SELECTION CRITERIA (ranked):
//   For agents:    type specialization → zone fit → execution score → workload
//   For investors: engagement_score × fit_score → type preference → zone preference
//
// PURE FUNCTIONS (unit-testable, no DB):
//   routeDeal, scoreAgentFit, scoreInvestorFit
//
// DB FUNCTIONS:
//   persistDistributionEvent, getDistributionHistory
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PropertyForRouting {
  id:                 string
  opportunity_score:  number
  opportunity_grade:  string
  zone_key:           string
  type:               string
  price:              number
}

export interface AgentForRouting {
  id:                    string
  email:                 string
  agent_execution_score: number   // 0-100
  top_property_types:    string[]
  top_zones:             string[]
  active_deals_count?:   number   // for workload balancing
}

export interface InvestorForRouting {
  id:                   string
  email:                string
  engagement_score:     number    // 0-100 from investorIntelligence
  fit_score:            number    // 0-1 from existing match engine
  preferred_asset_types: string[]
  preferred_zones:       string[]
}

export interface RoutingTarget {
  id:     string
  email:  string
  score:  number   // composite fit score (0-100)
  reason: string
}

export interface DistributionDecision {
  tier:                   'A+' | 'A' | 'B' | 'skip'
  max_recipients:         number
  recommended_agents:     RoutingTarget[]
  recommended_investors:  RoutingTarget[]
  routing_rationale:      string
  total_recommended:      number
}

// ---------------------------------------------------------------------------
// PURE: Score agent fit for a specific property (0-100)
// ---------------------------------------------------------------------------

export function scoreAgentFit(
  agent:    AgentForRouting,
  property: PropertyForRouting,
): number {
  let score = agent.agent_execution_score  // base = execution score

  // Type specialization bonus (+15 if agent specializes in this type)
  if (agent.top_property_types.includes(property.type)) {
    score += 15
  }

  // Zone specialization bonus (+10 if agent knows this zone)
  if (agent.top_zones.includes(property.zone_key)) {
    score += 10
  }

  // Workload penalty (if agent already has many active deals)
  const active = agent.active_deals_count ?? 0
  if (active >= 10)     score -= 20
  else if (active >= 7) score -= 10
  else if (active >= 5) score -= 5

  return Math.max(0, Math.min(100, score))
}

// ---------------------------------------------------------------------------
// PURE: Score investor fit for a specific property (0-100)
// ---------------------------------------------------------------------------

export function scoreInvestorFit(
  investor: InvestorForRouting,
  property: PropertyForRouting,
): number {
  // Combined: 60% existing fit score + 40% engagement quality
  const fitContrib        = investor.fit_score * 60          // 0-60
  const engagementContrib = (investor.engagement_score / 100) * 40  // 0-40
  let score = fitContrib + engagementContrib

  // Type preference bonus
  if (investor.preferred_asset_types.includes(property.type)) {
    score += 10
  }

  // Zone preference bonus
  if (investor.preferred_zones.includes(property.zone_key)) {
    score += 8
  }

  return Math.max(0, Math.min(100, Math.round(score)))
}

// ---------------------------------------------------------------------------
// PURE: Determine distribution tier from grade/score
// ---------------------------------------------------------------------------

export function getDistributionTier(
  grade: string,
  score: number,
): DistributionDecision['tier'] {
  if (grade === 'A+' || score >= 85) return 'A+'
  if (grade === 'A'  || score >= 70) return 'A'
  if (grade === 'B'  || score >= 55) return 'B'
  return 'skip'
}

// ---------------------------------------------------------------------------
// PURE: Main routing function
// ---------------------------------------------------------------------------

export function routeDeal(
  property:  PropertyForRouting,
  agents:    AgentForRouting[],
  investors: InvestorForRouting[],
): DistributionDecision {
  const tier = getDistributionTier(property.opportunity_grade, property.opportunity_score)

  if (tier === 'skip') {
    return {
      tier:                  'skip',
      max_recipients:        0,
      recommended_agents:    [],
      recommended_investors: [],
      routing_rationale:     `Score ${property.opportunity_score} / grade ${property.opportunity_grade} — below distribution threshold (min B / 55)`,
      total_recommended:     0,
    }
  }

  // Per-tier configuration
  const config = {
    'A+': { maxTotal: 3, agentMinScore: 70, investorMinFit: 0.80, investorMinEngagement: 60 },
    'A':  { maxTotal: 5, agentMinScore: 55, investorMinFit: 0.65, investorMinEngagement: 40 },
    'B':  { maxTotal: 10, agentMinScore: 0, investorMinFit: 0.50, investorMinEngagement: 0  },
  }[tier]!

  // ── Select agents ─────────────────────────────────────────────────────────
  const scoredAgents = agents
    .filter(a => a.agent_execution_score >= config.agentMinScore)
    .map(a => {
      const fitScore = scoreAgentFit(a, property)
      const reasons: string[] = []
      if (a.top_property_types.includes(property.type))  reasons.push(`${property.type} specialist`)
      if (a.top_zones.includes(property.zone_key))        reasons.push(`${property.zone_key} specialist`)
      reasons.push(`execution score ${a.agent_execution_score}`)
      return {
        id:     a.id,
        email:  a.email,
        score:  fitScore,
        reason: reasons.join(' · '),
      }
    })
    .sort((a, b) => b.score - a.score)

  // Max half the recipients for agents (rounded up), rest for investors
  const maxAgents    = Math.ceil(config.maxTotal / 2)
  const topAgents    = scoredAgents.slice(0, maxAgents)

  // ── Select investors ──────────────────────────────────────────────────────
  const scoredInvestors = investors
    .filter(i =>
      i.fit_score >= config.investorMinFit &&
      i.engagement_score >= config.investorMinEngagement,
    )
    .map(i => {
      const fitScore = scoreInvestorFit(i, property)
      const reasons: string[] = []
      if (i.preferred_asset_types.includes(property.type))  reasons.push(`${property.type} preference`)
      if (i.preferred_zones.includes(property.zone_key))     reasons.push(`${property.zone_key} preference`)
      reasons.push(`engagement ${Math.round(i.engagement_score)}/100`)
      return {
        id:     i.id,
        email:  i.email,
        score:  fitScore,
        reason: reasons.join(' · '),
      }
    })
    .sort((a, b) => b.score - a.score)

  const maxInvestors = config.maxTotal - topAgents.length
  const topInvestors = scoredInvestors.slice(0, maxInvestors)

  const total = topAgents.length + topInvestors.length

  const rationaleLines = [
    `${tier} deal — ${property.type} in ${property.zone_key} at €${property.price.toLocaleString('pt-PT')}`,
    `Score ${property.opportunity_score}/100 · max ${config.maxTotal} recipients`,
    topAgents.length > 0    ? `${topAgents.length} agent(s) selected (min execution ${config.agentMinScore})` : 'no qualifying agents',
    topInvestors.length > 0 ? `${topInvestors.length} investor(s) selected (fit ≥${config.investorMinFit})` : 'no qualifying investors',
  ]

  return {
    tier,
    max_recipients:        config.maxTotal,
    recommended_agents:    topAgents,
    recommended_investors: topInvestors,
    routing_rationale:     rationaleLines.join(' · '),
    total_recommended:     total,
  }
}

// ---------------------------------------------------------------------------
// DB: Persist distribution event (audit trail)
// ---------------------------------------------------------------------------

export async function persistDistributionEvent(
  property:  PropertyForRouting,
  decision:  DistributionDecision,
  triggeredBy = 'system',
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from('distribution_events')
    .insert({
      property_id:          property.id,
      opportunity_score:    property.opportunity_score,
      opportunity_grade:    property.opportunity_grade,
      distribution_tier:    decision.tier,
      max_recipients:       decision.max_recipients,
      recommended_agents:   decision.recommended_agents,
      recommended_investors: decision.recommended_investors,
      routing_rationale:    decision.routing_rationale,
      event_status:         'recommended',
      distributed_by:       triggeredBy,
    })
    .select('id')
    .single()

  if (error) throw new Error(`persistDistributionEvent: ${error.message}`)
  return data.id as string
}

// ---------------------------------------------------------------------------
// DB: Get distribution history for a property
// ---------------------------------------------------------------------------

export async function getDistributionHistory(propertyId: string): Promise<unknown[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from('distribution_events')
    .select('*')
    .eq('property_id', propertyId)
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) throw new Error(`getDistributionHistory: ${error.message}`)
  return data ?? []
}
