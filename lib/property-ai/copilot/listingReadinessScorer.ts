// AGENCY GROUP — SH-ROS Property AI | AMI: 22506

import { logger } from '@/lib/observability/logger'
import type { PropertyAnalysis } from '@/lib/property-ai/types'

export type ReadinessGrade = 'A' | 'B' | 'C' | 'D' | 'F'

export interface ReadinessReport {
  listing_readiness_score: number
  grade: ReadinessGrade
  ready_to_publish: boolean
  blocking_issues: string[]
  improvement_suggestions: string[]
  dimension_scores: {
    media_quality: number
    description_quality: number
    pricing_clarity: number
    data_completeness: number
    seo_readiness: number
  }
  estimated_time_to_ready_hours: number
}

const MEDIA_QUALITY_SCORE: Record<string, number> = {
  excellent: 100,
  good: 75,
  adequate: 50,
  poor: 25,
}

function resolveGrade(score: number): ReadinessGrade {
  if (score >= 90) return 'A'
  if (score >= 75) return 'B'
  if (score >= 60) return 'C'
  if (score >= 45) return 'D'
  return 'F'
}

class ListingReadinessScorer {
  assess(
    analysis: PropertyAnalysis,
    hasListing: boolean,
    hasPrice: boolean,
    mediaQuality: string,
    imageCount: number,
  ): ReadinessReport {
    const blocking_issues: string[] = []
    const improvement_suggestions: string[] = []

    // Blocking checks
    if (imageCount === 0) blocking_issues.push('No photos uploaded — at least one photo is required')
    if (!hasPrice) blocking_issues.push('No asking price set — price is required to publish')
    if (!analysis.area_sqm) blocking_issues.push('Property area (m²) is missing')
    if (!analysis.location?.city && !analysis.location?.zone)
      blocking_issues.push('Property location not identified')

    // Improvement suggestions
    if (imageCount > 0 && imageCount < 5)
      improvement_suggestions.push('Add more photos (minimum 5 recommended for higher engagement)')
    if (mediaQuality === 'poor' || mediaQuality === 'adequate')
      improvement_suggestions.push('Upgrade to professional photography for better listing performance')
    improvement_suggestions.push('Add a video walkthrough to increase inquiries by up to 40%')
    improvement_suggestions.push('Upload a floorplan to improve qualified lead conversion')
    if (analysis.energy_class === 'unknown')
      improvement_suggestions.push('Add energy certificate class to meet legal requirements')
    if (!hasListing)
      improvement_suggestions.push('Generate AI listing descriptions in multiple languages')

    // Dimension scores
    const media_quality = MEDIA_QUALITY_SCORE[mediaQuality.toLowerCase()] ?? 25
    const description_quality = hasListing ? 80 : 20
    const pricing_clarity = hasPrice ? 90 : 10
    const data_completeness = (() => {
      let score = 0
      if (analysis.area_sqm) score += 25
      if (analysis.bedrooms !== undefined) score += 15
      if (analysis.bathrooms !== undefined) score += 15
      if (analysis.location?.city) score += 20
      if (analysis.energy_class !== 'unknown') score += 15
      if (analysis.property_type) score += 10
      return Math.min(100, score)
    })()
    const seo_readiness = hasListing && hasPrice ? 70 : hasListing ? 40 : 20

    const listing_readiness_score = Math.min(
      100,
      media_quality * 0.25 +
        description_quality * 0.2 +
        pricing_clarity * 0.2 +
        data_completeness * 0.2 +
        seo_readiness * 0.15,
    )

    const grade = resolveGrade(listing_readiness_score)
    const ready_to_publish = listing_readiness_score >= 75 && blocking_issues.length === 0

    // Rough time estimate: 2h per blocking issue, 0.5h per suggestion (max 20h)
    const estimated_time_to_ready_hours = Math.min(
      20,
      blocking_issues.length * 2 + improvement_suggestions.length * 0.5,
    )

    logger.info('[ListingReadinessScorer] assessed', {
      submission_id: analysis.submission_id,
      score: listing_readiness_score,
      grade,
      ready_to_publish,
    })

    return {
      listing_readiness_score,
      grade,
      ready_to_publish,
      blocking_issues,
      improvement_suggestions,
      dimension_scores: {
        media_quality,
        description_quality,
        pricing_clarity,
        data_completeness,
        seo_readiness,
      },
      estimated_time_to_ready_hours,
    }
  }
}

export const listingReadinessScorer = new ListingReadinessScorer()
