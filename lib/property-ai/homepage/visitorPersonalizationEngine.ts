// AGENCY GROUP — SH-ROS Property AI | AMI: 22506

import { logger } from '@/lib/observability/logger'
import type { ListingLanguage } from '@/lib/property-ai/types'
import type { HomepageSlot } from '@/lib/property-ai/homepage/homepageRankingEngine'

export interface VisitorContext {
  session_id: string
  region?: string
  language?: ListingLanguage
  price_range?: { min: number; max: number }
  property_types_viewed?: string[]
  luxury_intent?: boolean
  investor_signals?: boolean
}

export interface PersonalizedFeed {
  session_id: string
  recommended_submission_ids: string[]
  personalization_factors: string[]
  confidence: number
}

class VisitorPersonalizationEngine {
  private static instance: VisitorPersonalizationEngine

  private constructor() {}

  static getInstance(): VisitorPersonalizationEngine {
    if (!VisitorPersonalizationEngine.instance) {
      VisitorPersonalizationEngine.instance = new VisitorPersonalizationEngine()
    }
    return VisitorPersonalizationEngine.instance
  }

  private scoreSlot(slot: HomepageSlot, context: VisitorContext): number {
    let score = slot.ranking_score

    if (context.region) {
      score += slot.geo_relevance * 20
    }

    if (context.price_range) {
      score += slot.budget_affinity * 15
    }

    if (context.luxury_intent) {
      score += slot.luxury_intent_match * 20
    }

    if (context.investor_signals) {
      // investor signal boosts slots already ranked high (proxy: ranking_score > 70)
      score += slot.ranking_score > 70 ? 10 : 0
    }

    return score
  }

  private buildFactors(context: VisitorContext): string[] {
    const factors: string[] = []
    if (context.region) factors.push(`geo:${context.region}`)
    if (context.language) factors.push(`language:${context.language}`)
    if (context.price_range) {
      factors.push(`price_range:${context.price_range.min}-${context.price_range.max}`)
    }
    if (context.property_types_viewed?.length) {
      factors.push(`types_viewed:${context.property_types_viewed.join(',')}`)
    }
    if (context.luxury_intent) factors.push('luxury_intent')
    if (context.investor_signals) factors.push('investor_signals')
    return factors
  }

  private computeConfidence(context: VisitorContext, total: number): number {
    let signals = 0
    if (context.region) signals++
    if (context.language) signals++
    if (context.price_range) signals++
    if (context.luxury_intent) signals++
    if (context.investor_signals) signals++
    if (context.property_types_viewed?.length) signals++

    if (total === 0 || signals === 0) return 0.1
    return Math.min(1, 0.3 + signals * 0.12)
  }

  personalize(context: VisitorContext, availableListings: HomepageSlot[]): PersonalizedFeed {
    const scored = availableListings.map((slot) => ({
      slot,
      score: this.scoreSlot(slot, context),
    }))

    scored.sort((a, b) => b.score - a.score)

    const recommendedIds = scored.map((s) => s.slot.submission_id)
    const factors = this.buildFactors(context)
    const confidence = this.computeConfidence(context, availableListings.length)

    logger.info('[VisitorPersonalizationEngine] personalized', {
      session_id: context.session_id,
      recommendations_count: recommendedIds.length,
      factors,
      confidence,
    })

    return {
      session_id: context.session_id,
      recommended_submission_ids: recommendedIds,
      personalization_factors: factors,
      confidence,
    }
  }
}

export const visitorPersonalizationEngine = VisitorPersonalizationEngine.getInstance()
