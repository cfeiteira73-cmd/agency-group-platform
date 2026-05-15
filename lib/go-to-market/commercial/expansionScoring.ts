// AGENCY GROUP — SH-ROS | AMI: 22506

import { logger } from '@/lib/observability/logger'

import { PLANS, type PlanTier } from './packagingArchitecture'

export type ExpansionTrigger =
  | 'usage_ceiling'
  | 'team_growth'
  | 'market_expansion'
  | 'roi_proven'
  | 'feature_gap'
  | 'org_consolidation'

export interface ExpansionOpportunity {
  opportunity_id: string
  org_id: string
  current_tier: PlanTier
  recommended_tier: PlanTier
  trigger: ExpansionTrigger
  expansion_value_eur: number
  probability: number
  timing: 'immediate' | 'next_quarter' | 'next_renewal'
  pitch: string
}

export interface ExpansionScore {
  org_id: string
  score: number         // 0-100
  ready_to_expand: boolean
  opportunities: ExpansionOpportunity[]
  total_expansion_value_eur: number
}

// Trigger weights for scoring
const TRIGGER_WEIGHTS: Record<ExpansionTrigger, number> = {
  usage_ceiling: 25,
  roi_proven: 22,
  team_growth: 18,
  market_expansion: 15,
  feature_gap: 12,
  org_consolidation: 8,
}

// Probabilities by timing
const TIMING_PROBABILITIES: Record<ExpansionOpportunity['timing'], number> = {
  immediate: 0.75,
  next_quarter: 0.50,
  next_renewal: 0.35,
}

// Next tier map
const NEXT_TIER: Record<PlanTier, PlanTier> = {
  starter: 'pro',
  pro: 'elite',
  elite: 'institutional',
  institutional: 'institutional', // already top
}

export class ExpansionScoring {
  scoreOrg(
    orgId: string,
    currentTier: PlanTier,
    usageData: Record<string, unknown>,
  ): ExpansionScore {
    const triggers = this._detectTriggers(currentTier, usageData)
    const score = this.calculateScore(triggers)
    const readyToExpand = this.getReadyToExpand(score)
    const opportunities = this.identifyOpportunities(orgId, currentTier).map(opp => ({
      ...opp,
      trigger: triggers[0] ?? opp.trigger, // tag first detected trigger
    }))

    const totalValue = opportunities.reduce((s, o) => s + o.expansion_value_eur, 0)

    logger.info('ExpansionScoring: org scored', {
      org_id: orgId,
      current_tier: currentTier,
      score,
      ready_to_expand: readyToExpand,
      triggers,
    })

    return {
      org_id: orgId,
      score,
      ready_to_expand: readyToExpand,
      opportunities,
      total_expansion_value_eur: totalValue,
    }
  }

  identifyOpportunities(orgId: string, currentTier: PlanTier): ExpansionOpportunity[] {
    if (currentTier === 'institutional') {
      // No upgrade path, look for add-ons only
      return []
    }

    const recommendedTier = NEXT_TIER[currentTier]
    const opportunities: ExpansionOpportunity[] = []

    // Primary upgrade opportunity
    const primaryTrigger: ExpansionTrigger = 'usage_ceiling'
    const expansionValue = this._expansionDelta(currentTier, recommendedTier)
    const pitch = this.getPitchForTrigger(primaryTrigger, currentTier)

    opportunities.push({
      opportunity_id: crypto.randomUUID(),
      org_id: orgId,
      current_tier: currentTier,
      recommended_tier: recommendedTier,
      trigger: primaryTrigger,
      expansion_value_eur: expansionValue * 12, // annualised
      probability: TIMING_PROBABILITIES['next_quarter'],
      timing: 'next_quarter',
      pitch,
    })

    // ROI-driven secondary opportunity
    opportunities.push({
      opportunity_id: crypto.randomUUID(),
      org_id: orgId,
      current_tier: currentTier,
      recommended_tier: recommendedTier,
      trigger: 'roi_proven',
      expansion_value_eur: expansionValue * 12,
      probability: TIMING_PROBABILITIES['next_renewal'],
      timing: 'next_renewal',
      pitch: this.getPitchForTrigger('roi_proven', currentTier),
    })

    return opportunities
  }

  calculateScore(triggers: ExpansionTrigger[]): number {
    const total = triggers.reduce((s, t) => s + (TRIGGER_WEIGHTS[t] ?? 0), 0)
    // Normalize to 0-100
    const maxScore = Object.values(TRIGGER_WEIGHTS).reduce((s, v) => s + v, 0)
    return Math.min(Math.round((total / maxScore) * 100), 100)
  }

  getPitchForTrigger(trigger: ExpansionTrigger, currentTier: PlanTier): string {
    const nextTier = NEXT_TIER[currentTier]
    const nextPlan = PLANS[nextTier]
    const currentPlan = PLANS[currentTier]

    const pitches: Record<ExpansionTrigger, string> = {
      usage_ceiling: `You're consistently hitting your ${currentPlan.name} plan limits. Upgrading to ${nextPlan.name} unlocks ${nextPlan.max_agents === Infinity ? 'unlimited' : nextPlan.max_agents} agents, ${nextPlan.max_workflows === Infinity ? 'unlimited' : nextPlan.max_workflows} workflows, and ${nextPlan.ai_executions_per_month === Infinity ? 'unlimited' : nextPlan.ai_executions_per_month.toLocaleString()} AI executions/month.`,
      roi_proven: `Your SH-ROS ROI has been validated. ${nextPlan.name} at €${nextPlan.price_monthly_eur}/mo delivers ${((nextPlan.price_monthly_eur / currentPlan.price_monthly_eur - 1) * 100).toFixed(0)}% more capacity. With Portugal market at 5% commission and €320K avg deal, the payback is typically under 60 days.`,
      team_growth: `As your team grows beyond ${currentPlan.max_agents} agent${currentPlan.max_agents !== 1 ? 's' : ''}, ${nextPlan.name} is your natural home — with ${nextPlan.max_agents === Infinity ? 'unlimited' : nextPlan.max_agents} agents and ${nextPlan.support_level} support.`,
      market_expansion: `Expanding into new markets (Spain, Madeira, Açores) requires multi-market orchestration. ${nextPlan.name} provides the workflow capacity and analytics to run parallel market operations.`,
      feature_gap: `Features like ${nextPlan.tier === 'elite' ? 'white-label branding and dedicated CSM' : 'custom AI training and dedicated engineer'} are blocking your next growth phase. ${nextPlan.name} unlocks these immediately.`,
      org_consolidation: `Consolidating teams onto a single ${nextPlan.name} plan saves an estimated ${(currentPlan.price_monthly_eur * 1.3).toFixed(0)}€/mo vs multiple Starter/Pro subscriptions, with unified reporting.`,
    }

    return pitches[trigger]
  }

  getReadyToExpand(score: number): boolean {
    return score >= 40
  }

  private _detectTriggers(
    currentTier: PlanTier,
    usageData: Record<string, unknown>,
  ): ExpansionTrigger[] {
    const triggers: ExpansionTrigger[] = []
    const plan = PLANS[currentTier]

    // Usage ceiling: agents or executions >= 80% of limit
    const agentUsage = usageData['agents'] as number | undefined
    const execUsage = usageData['ai_executions'] as number | undefined

    if (agentUsage && plan.max_agents !== Infinity && agentUsage >= plan.max_agents * 0.8) {
      triggers.push('usage_ceiling')
    }
    if (execUsage && plan.ai_executions_per_month !== Infinity && execUsage >= plan.ai_executions_per_month * 0.8) {
      triggers.push('usage_ceiling')
    }

    // ROI proven: roi > 3x
    const roi = usageData['roi_multiplier'] as number | undefined
    if (roi && roi >= 3) triggers.push('roi_proven')

    // Team growth
    const teamGrowth = usageData['team_growth_pct'] as number | undefined
    if (teamGrowth && teamGrowth >= 20) triggers.push('team_growth')

    // Market expansion
    if (usageData['markets_active'] && (usageData['markets_active'] as number) > 1) {
      triggers.push('market_expansion')
    }

    // Feature gap
    if (usageData['feature_requests'] && (usageData['feature_requests'] as number) >= 3) {
      triggers.push('feature_gap')
    }

    // Org consolidation
    if (usageData['sub_accounts'] && (usageData['sub_accounts'] as number) >= 2) {
      triggers.push('org_consolidation')
    }

    return [...new Set(triggers)] // deduplicate
  }

  private _expansionDelta(currentTier: PlanTier, nextTier: PlanTier): number {
    return PLANS[nextTier].price_monthly_eur - PLANS[currentTier].price_monthly_eur
  }
}

export const expansionScoring = new ExpansionScoring()
