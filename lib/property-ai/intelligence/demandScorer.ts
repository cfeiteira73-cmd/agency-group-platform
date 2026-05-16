// AGENCY GROUP — SH-ROS Property AI | AMI: 22506

import { logger } from '@/lib/observability/logger'
import type { PropertyAnalysis, ZoneClassification } from '@/lib/property-ai/types'

const PORTUGAL_CLOSE_RATE = 0.18

export interface DemandScore {
  demand_score: number
  conversion_probability: number
  lead_attractiveness: number
  score_factors: {
    location_weight: number
    luxury_weight: number
    view_premium: number
    condition_weight: number
    media_quality_weight: number
  }
  confidence: number
}

const ZONE_BASE: Record<ZoneClassification, number> = {
  'ultra-luxury': 90,
  'luxury': 75,
  'premium': 60,
  'mid-range': 45,
  'affordable': 30,
}

class DemandScorer {
  score(analysis: PropertyAnalysis): DemandScore {
    const zone = analysis.location?.zone_classification ?? 'mid-range'
    const locationWeight = ZONE_BASE[zone]

    let luxuryWeight = 0
    if (analysis.luxury_score > 80) luxuryWeight = 20
    else if (analysis.luxury_score > 60) luxuryWeight = 10

    let viewPremium = 0
    if (analysis.has_sea_view) viewPremium += 15
    if (analysis.has_pool) viewPremium += 10
    if (analysis.has_golf_view) viewPremium += 8

    let conditionWeight = 0
    if (analysis.condition === 'new' || analysis.condition === 'excellent') conditionWeight = 10

    // media_quality_weight is a placeholder at this layer — upstream callers may fold it in
    const mediaQualityWeight = 0

    const demand_score = Math.min(
      100,
      locationWeight + luxuryWeight + viewPremium + conditionWeight,
    )

    const conversion_probability = Math.min(
      0.85,
      (demand_score / 100) * PORTUGAL_CLOSE_RATE * 5,
    )

    const lead_attractiveness = Math.min(100, demand_score * 1.1)

    const result: DemandScore = {
      demand_score,
      conversion_probability,
      lead_attractiveness,
      score_factors: {
        location_weight: locationWeight,
        luxury_weight: luxuryWeight,
        view_premium: viewPremium,
        condition_weight: conditionWeight,
        media_quality_weight: mediaQualityWeight,
      },
      confidence: analysis.confidence,
    }

    logger.info('[DemandScorer] scored', {
      submission_id: analysis.submission_id,
      demand_score,
    })

    return result
  }
}

export const demandScorer = new DemandScorer()
