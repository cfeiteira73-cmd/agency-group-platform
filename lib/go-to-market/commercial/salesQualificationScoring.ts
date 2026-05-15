// AGENCY GROUP — SH-ROS | AMI: 22506

import { logger } from '@/lib/observability/logger'
import { PLANS, type PlanTier } from './packagingArchitecture'

// MEDDIC-inspired qualification for SH-ROS real estate AI platform
// Portugal context: 5% commission, €320K avg deal, 210 days avg, 18% close rate

export interface MEDDICProfile {
  metrics: { score: number; evidence: string }
  economic_buyer: { score: number; identified: boolean; name?: string }
  decision_criteria: { score: number; criteria: string[] }
  decision_process: { score: number; steps: string[] }
  identify_pain: { score: number; pains: string[] }
  champion: { score: number; identified: boolean }
}

export interface QualifiedLead {
  lead_id: string
  org_id: string
  company_name: string
  agent_count: number
  estimated_arr_eur: number
  meddic: MEDDICProfile
  qualification_score: number    // 0-100
  tier_fit: PlanTier
  recommended_action: 'disqualify' | 'nurture' | 'demo' | 'propose' | 'close'
  urgency_score: number
  qualified_at: Date
}

export const SCORE_THRESHOLDS = {
  disqualify: { min: 0, max: 25 },
  nurture: { min: 26, max: 50 },
  demo: { min: 51, max: 70 },
  propose: { min: 71, max: 85 },
  close: { min: 86, max: 100 },
} as const

// MEDDIC component weights (sum to 100)
const MEDDIC_WEIGHTS = {
  metrics: 20,
  economic_buyer: 20,
  decision_criteria: 15,
  decision_process: 15,
  identify_pain: 20,
  champion: 10,
} as const

export class SalesQualificationScoring {
  qualify(
    data: Omit<QualifiedLead, 'qualification_score' | 'recommended_action' | 'tier_fit' | 'qualified_at'>,
  ): QualifiedLead {
    const qualificationScore = this.calculateMEDDICScore(data.meddic)
    const recommendedAction = this.recommendAction(qualificationScore)
    const tierFit = this.recommendTier(data.agent_count, data.estimated_arr_eur)

    const lead: QualifiedLead = {
      ...data,
      qualification_score: qualificationScore,
      recommended_action: recommendedAction,
      tier_fit: tierFit,
      qualified_at: new Date(),
    }

    logger.info('SalesQualificationScoring: lead qualified', {
      lead_id: data.lead_id,
      org_id: data.org_id,
      company_name: data.company_name,
      qualification_score: qualificationScore,
      recommended_action: recommendedAction,
      tier_fit: tierFit,
    })

    return lead
  }

  calculateMEDDICScore(meddic: MEDDICProfile): number {
    const components: [keyof typeof MEDDIC_WEIGHTS, number][] = [
      ['metrics', meddic.metrics.score],
      ['economic_buyer', meddic.economic_buyer.score],
      ['decision_criteria', meddic.decision_criteria.score],
      ['decision_process', meddic.decision_process.score],
      ['identify_pain', meddic.identify_pain.score],
      ['champion', meddic.champion.score],
    ]

    // Weighted average, each component score is 0-100
    const weighted = components.reduce((sum, [key, score]) => {
      const normalised = Math.min(Math.max(score, 0), 100)
      return sum + (normalised * MEDDIC_WEIGHTS[key]) / 100
    }, 0)

    // Boolean boosts: +5 each for identified economic_buyer and champion
    const buyerBoost = meddic.economic_buyer.identified ? 5 : 0
    const championBoost = meddic.champion.identified ? 5 : 0

    return Math.min(Math.round(weighted + buyerBoost + championBoost), 100)
  }

  recommendAction(score: number): QualifiedLead['recommended_action'] {
    if (score >= SCORE_THRESHOLDS.close.min) return 'close'
    if (score >= SCORE_THRESHOLDS.propose.min) return 'propose'
    if (score >= SCORE_THRESHOLDS.demo.min) return 'demo'
    if (score >= SCORE_THRESHOLDS.nurture.min) return 'nurture'
    return 'disqualify'
  }

  recommendTier(agentCount: number, estimatedARR: number): PlanTier {
    // Tier by agent count first
    if (agentCount > 25 || estimatedARR >= PLANS.institutional.price_monthly_eur * 12) {
      return 'institutional'
    }
    if (agentCount > 10 || estimatedARR >= PLANS.elite.price_monthly_eur * 12) {
      return 'elite'
    }
    if (agentCount > 1 || estimatedARR >= PLANS.pro.price_monthly_eur * 12) {
      return 'pro'
    }
    return 'starter'
  }

  batchQualify(
    leads: Array<Omit<QualifiedLead, 'qualification_score' | 'recommended_action' | 'tier_fit' | 'qualified_at'>>,
  ): QualifiedLead[] {
    const results = leads.map(lead => this.qualify(lead))

    logger.info('SalesQualificationScoring: batch qualification complete', {
      total: leads.length,
      close: results.filter(r => r.recommended_action === 'close').length,
      propose: results.filter(r => r.recommended_action === 'propose').length,
      demo: results.filter(r => r.recommended_action === 'demo').length,
      nurture: results.filter(r => r.recommended_action === 'nurture').length,
      disqualify: results.filter(r => r.recommended_action === 'disqualify').length,
    })

    // Return sorted: close first, then by score descending
    return results.sort((a, b) => b.qualification_score - a.qualification_score)
  }
}

export const salesQualificationScoring = new SalesQualificationScoring()
