// AGENCY GROUP — SH-ROS Property AI | AMI: 22506

import { logger } from '@/lib/observability/logger'
import { supabaseAdmin } from '@/lib/supabase'
import type { PropertyAnalysis, PropertyIntelligence } from '@/lib/property-ai/types'
import { demandScorer } from './demandScorer'
import { pricingCompetitivenessAnalyzer } from './pricingCompetitivenessAnalyzer'
import { investorAttractivenessScorer } from './investorAttractivenessScorer'
import { homepagePlacementScorer } from './homepagePlacementScorer'

const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }

const MEDIA_QUALITY_SCORE: Record<string, number> = {
  excellent: 100,
  good: 75,
  adequate: 50,
  poor: 25,
}

class PropertyIntelligenceEngine {
  async compute(
    analysis: PropertyAnalysis,
    priceEur?: number,
    mediaQuality = 'good',
  ): Promise<PropertyIntelligence> {
    // Run independent scorers in parallel
    const [demand, pricing, investor] = await Promise.all([
      Promise.resolve(demandScorer.score(analysis)),
      Promise.resolve(pricingCompetitivenessAnalyzer.analyze(analysis, priceEur)),
      Promise.resolve(investorAttractivenessScorer.score(analysis, priceEur)),
    ])

    // Homepage placement depends on demand result
    const placement = homepagePlacementScorer.score(analysis, demand, mediaQuality)

    // Composite listing readiness score
    const mediaScore = MEDIA_QUALITY_SCORE[mediaQuality.toLowerCase()] ?? 50
    const locationScore = analysis.location?.premium_zone ? 80 : 50
    const pricingScore = pricing.competitiveness * 100

    const listing_readiness_score = Math.min(
      100,
      demand.demand_score * 0.3 +
        mediaScore * 0.25 +
        pricingScore * 0.2 +
        investor.investor_attractiveness * 0.15 +
        locationScore * 0.1,
    )

    const intel_id = crypto.randomUUID()

    const intelligence: PropertyIntelligence = {
      intel_id,
      submission_id: analysis.submission_id,
      org_id: analysis.org_id,
      demand_score: demand.demand_score,
      conversion_probability: demand.conversion_probability,
      lead_attractiveness: demand.lead_attractiveness,
      investor_attractiveness: investor.investor_attractiveness,
      liquidity_speed_days: pricing.liquidity_speed_days,
      pricing_competitiveness: pricing.competitiveness,
      featured_priority_score: placement.featured_priority_score,
      luxury_visibility_score: placement.luxury_visibility_score,
      homepage_placement_score: placement.homepage_placement_score,
      listing_readiness_score,
      computed_at: new Date(),
    }

    // Persist to Supabase
    const store = sb.from('property_ai_intelligence') as {
      upsert: (data: unknown, opts: unknown) => Promise<{ error: unknown }>
    }
    const { error } = await store.upsert(intelligence, {
      onConflict: 'submission_id',
    })
    if (error) {
      logger.error('[PropertyIntelligenceEngine] persist failed', {
        submission_id: analysis.submission_id,
        error,
      })
    }

    logger.info('[PropertyIntelligenceEngine] computed', {
      submission_id: analysis.submission_id,
      listing_readiness_score,
      recommended_placement: placement.recommended_placement,
    })

    return intelligence
  }
}

export const propertyIntelligenceEngine = new PropertyIntelligenceEngine()
