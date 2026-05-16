// AGENCY GROUP — SH-ROS Property AI | AMI: 22506

import { logger } from '@/lib/observability/logger'
import type { PropertyAnalysis } from '@/lib/property-ai/types'
import type { DemandScore } from './demandScorer'

export type MediaQuality = 'excellent' | 'good' | 'adequate' | 'poor'
export type PlacementRecommendation = 'hero' | 'featured' | 'premium' | 'standard' | 'not_featured'

export interface HomepagePlacementScore {
  homepage_placement_score: number
  featured_priority_score: number
  luxury_visibility_score: number
  recommended_placement: PlacementRecommendation
  rotation_weight: number
  expected_ctr: number
}

const MEDIA_QUALITY_SCORE: Record<MediaQuality, number> = {
  excellent: 100,
  good: 75,
  adequate: 50,
  poor: 25,
}

function resolveMediaQuality(mediaQuality: string): MediaQuality {
  const q = mediaQuality.toLowerCase()
  if (q === 'excellent') return 'excellent'
  if (q === 'good') return 'good'
  if (q === 'adequate') return 'adequate'
  return 'poor'
}

function resolvePlacement(score: number): PlacementRecommendation {
  if (score > 85) return 'hero'
  if (score > 70) return 'featured'
  if (score > 55) return 'premium'
  if (score > 40) return 'standard'
  return 'not_featured'
}

// Rough CTR estimates per placement tier
const PLACEMENT_CTR: Record<PlacementRecommendation, number> = {
  hero: 0.12,
  featured: 0.07,
  premium: 0.04,
  standard: 0.02,
  not_featured: 0.005,
}

class HomepagePlacementScorer {
  score(
    analysis: PropertyAnalysis,
    demand: DemandScore,
    mediaQuality: string,
  ): HomepagePlacementScore {
    const mediaScore = MEDIA_QUALITY_SCORE[resolveMediaQuality(mediaQuality)]
    const luxury_score = analysis.luxury_score

    const homepage_placement_score = Math.min(
      100,
      demand.demand_score * 0.4 + luxury_score * 0.3 + mediaScore * 0.3,
    )

    const featured_priority_score = Math.min(
      100,
      (demand.demand_score + luxury_score) / 2,
    )

    const luxury_visibility_score = Math.min(100, luxury_score)

    const recommended_placement = resolvePlacement(homepage_placement_score)
    const rotation_weight = homepage_placement_score / 100
    const expected_ctr = PLACEMENT_CTR[recommended_placement]

    logger.info('[HomepagePlacementScorer] scored', {
      submission_id: analysis.submission_id,
      recommended_placement,
    })

    return {
      homepage_placement_score,
      featured_priority_score,
      luxury_visibility_score,
      recommended_placement,
      rotation_weight,
      expected_ctr,
    }
  }
}

export const homepagePlacementScorer = new HomepagePlacementScorer()
