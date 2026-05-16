// AGENCY GROUP — SH-ROS Property AI | AMI: 22506

import { logger } from '@/lib/observability/logger'
import type { PropertyAnalysis, ZoneClassification } from '@/lib/property-ai/types'

export type InvestorProfile =
  | 'high_net_worth'
  | 'institutional'
  | 'family_office'
  | 'retail'
  | 'not_suitable'

export interface InvestorScore {
  investor_attractiveness: number
  rental_yield_estimate: number
  capital_appreciation_potential: number
  golden_visa_eligible: boolean
  nhr_relevant: boolean
  investor_profile: InvestorProfile
  highlights: string[]
}

// Midpoints of rental yield ranges by zone classification
const RENTAL_YIELD: Record<ZoneClassification, number> = {
  'ultra-luxury': 4.5,   // 4–5%
  'luxury': 5.5,          // 5–6%
  'premium': 6.5,         // 6–7%
  'mid-range': 6.0,
  'affordable': 5.5,
}

// Capital appreciation base (Portugal +17.6% context, scaled per zone)
const CAPITAL_APPRECIATION_BASE: Record<ZoneClassification, number> = {
  'ultra-luxury': 85,
  'luxury': 75,
  'premium': 65,
  'mid-range': 55,
  'affordable': 45,
}

function resolveInvestorProfile(priceEur: number): InvestorProfile {
  if (priceEur >= 5_000_000) return 'family_office'
  if (priceEur >= 2_000_000) return 'institutional'
  if (priceEur >= 500_000) return 'high_net_worth'
  if (priceEur >= 100_000) return 'retail'
  return 'not_suitable'
}

function buildHighlights(
  golden_visa_eligible: boolean,
  nhr_relevant: boolean,
  zone: ZoneClassification,
  rental_yield: number,
): string[] {
  const highlights: string[] = []
  if (golden_visa_eligible) highlights.push('Golden Visa eligible (≥€500K)')
  if (nhr_relevant) highlights.push('NHR tax regime applicable')
  if (zone === 'ultra-luxury' || zone === 'luxury')
    highlights.push('Prime location — strong capital appreciation potential')
  highlights.push(`Estimated gross rental yield: ${rental_yield.toFixed(1)}% p.a.`)
  return highlights.slice(0, 3)
}

class InvestorAttractivenessScorer {
  score(analysis: PropertyAnalysis, priceEur?: number): InvestorScore {
    const zone = analysis.location?.zone_classification ?? 'mid-range'
    const locationPremium =
      zone === 'ultra-luxury'
        ? 20
        : zone === 'luxury'
          ? 15
          : zone === 'premium'
            ? 10
            : 5

    const investor_attractiveness = Math.min(
      100,
      analysis.luxury_score * 0.6 + locationPremium,
    )

    const rental_yield_estimate = RENTAL_YIELD[zone]
    const capital_appreciation_potential = CAPITAL_APPRECIATION_BASE[zone]

    const effectivePrice = priceEur ?? 0
    const golden_visa_eligible = effectivePrice >= 500_000
    const nhr_relevant = effectivePrice >= 500_000 && analysis.luxury_score >= 60

    const investor_profile = resolveInvestorProfile(effectivePrice)

    const highlights = buildHighlights(
      golden_visa_eligible,
      nhr_relevant,
      zone,
      rental_yield_estimate,
    )

    logger.info('[InvestorAttractivenessScorer] scored', {
      submission_id: analysis.submission_id,
      investor_attractiveness,
    })

    return {
      investor_attractiveness,
      rental_yield_estimate,
      capital_appreciation_potential,
      golden_visa_eligible,
      nhr_relevant,
      investor_profile,
      highlights,
    }
  }
}

export const investorAttractivenessScorer = new InvestorAttractivenessScorer()
