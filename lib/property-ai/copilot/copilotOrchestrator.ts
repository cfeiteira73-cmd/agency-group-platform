// AGENCY GROUP — SH-ROS Property AI | AMI: 22506

import { logger } from '@/lib/observability/logger'
import { supabaseAdmin } from '@/lib/supabase'
import type { PropertyAnalysis, PropertyIntelligence } from '@/lib/property-ai/types'
import { listingReadinessScorer } from './listingReadinessScorer'
import type { ReadinessReport } from './listingReadinessScorer'
import { pricingAdvisor } from './pricingAdvisor'
import type { PricingAdvice } from './pricingAdvisor'
import { publishingTimingAdvisor } from './publishingTimingAdvisor'
import type { PublishingStrategy } from './publishingTimingAdvisor'
import { targetAudienceAdvisor } from './targetAudienceAdvisor'
import type { AudienceProfile } from './targetAudienceAdvisor'

const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }

export interface CopilotRecommendations {
  submission_id: string
  readiness: ReadinessReport
  pricing: PricingAdvice
  publishing: PublishingStrategy
  audience: AudienceProfile
  ai_summary: string
  action_items: string[]
  generated_at: Date
}

function buildSummary(
  readiness: ReadinessReport,
  pricing: PricingAdvice,
  publishing: PublishingStrategy,
): string {
  const status = readiness.ready_to_publish
    ? `This listing is ready to publish (Grade ${readiness.grade}, score ${readiness.listing_readiness_score.toFixed(0)}/100) at a recommended price of €${pricing.recommended_price_eur.toLocaleString('pt-PT')} using a ${pricing.strategy.replace('_', ' ')} strategy.`
    : `This listing requires ${readiness.blocking_issues.length} fix(es) before publishing (Grade ${readiness.grade}, score ${readiness.listing_readiness_score.toFixed(0)}/100) — estimated €${pricing.recommended_price_eur.toLocaleString('pt-PT')} at ${pricing.strategy.replace('_', ' ')} positioning.`
  const timing = `Optimal publish window: ${publishing.target_day} at ${String(publishing.target_hour).padStart(2, '0')}:00${publishing.seasonal_note ? ` — ${publishing.seasonal_note}` : ''}.`
  return `${status} ${timing}`
}

function buildActionItems(
  readiness: ReadinessReport,
  pricing: PricingAdvice,
  publishing: PublishingStrategy,
  audience: AudienceProfile,
): string[] {
  const items: string[] = []

  // Blocking issues first
  for (const issue of readiness.blocking_issues) {
    items.push(`[REQUIRED] ${issue}`)
  }

  // Pricing action
  items.push(
    `Set asking price to €${pricing.recommended_price_eur.toLocaleString('pt-PT')} (${pricing.strategy.replace(/_/g, ' ')}) — ${pricing.market_comparison}`,
  )

  // Publishing action
  items.push(
    `Schedule publish for ${publishing.target_day} ${String(publishing.target_hour).padStart(2, '0')}:00${publishing.boost_first_48h ? ' and activate 48h paid boost' : ''}`,
  )

  // Audience action
  items.push(
    `Target primary audience: ${audience.primary_persona} — nationality focus: ${audience.nationality_targets.slice(0, 3).join(', ')}`,
  )

  // Top improvement
  if (readiness.improvement_suggestions.length > 0) {
    items.push(`[RECOMMENDED] ${readiness.improvement_suggestions[0]}`)
  }

  // Channel action
  items.push(
    `Distribute via: ${publishing.channel_priority.slice(0, 4).join(', ')}`,
  )

  return items
}

class CopilotOrchestrator {
  async generate(
    analysis: PropertyAnalysis,
    intelligence: PropertyIntelligence,
    priceEur?: number,
  ): Promise<CopilotRecommendations> {
    // Infer media quality from intel (listing_readiness_score as proxy if not known)
    const mediaQuality =
      intelligence.homepage_placement_score >= 80
        ? 'excellent'
        : intelligence.homepage_placement_score >= 60
          ? 'good'
          : intelligence.homepage_placement_score >= 40
            ? 'adequate'
            : 'poor'

    const hasListing = false  // caller can pass this in future versions
    const hasPrice = priceEur !== undefined
    const imageCount = 5      // default assumption — caller can override in future versions

    // Run all advisors in parallel
    const [readiness, pricing, publishing, audience] = await Promise.all([
      Promise.resolve(
        listingReadinessScorer.assess(
          analysis,
          hasListing,
          hasPrice,
          mediaQuality,
          imageCount,
        ),
      ),
      Promise.resolve(pricingAdvisor.advise(analysis, priceEur)),
      Promise.resolve(publishingTimingAdvisor.advise(analysis, intelligence)),
      Promise.resolve(targetAudienceAdvisor.advise(analysis, intelligence, priceEur)),
    ])

    const ai_summary = buildSummary(readiness, pricing, publishing)
    const action_items = buildActionItems(readiness, pricing, publishing, audience)

    const recommendations: CopilotRecommendations = {
      submission_id: analysis.submission_id,
      readiness,
      pricing,
      publishing,
      audience,
      ai_summary,
      action_items,
      generated_at: new Date(),
    }

    // Persist to Supabase
    const store = sb.from('property_ai_copilot') as {
      upsert: (data: unknown, opts: unknown) => Promise<{ error: unknown }>
    }
    const payload = {
      copilot_id: crypto.randomUUID(),
      submission_id: analysis.submission_id,
      org_id: analysis.org_id,
      readiness_score: readiness.listing_readiness_score,
      ready_to_publish: readiness.ready_to_publish,
      recommended_price_eur: pricing.recommended_price_eur,
      strategy: pricing.strategy,
      recommended_publish_time: publishing.recommended_publish_time,
      primary_persona: audience.primary_persona,
      ai_summary,
      action_items,
      generated_at: recommendations.generated_at,
    }

    const { error } = await store.upsert(payload, { onConflict: 'submission_id' })
    if (error) {
      logger.error('[CopilotOrchestrator] persist failed', {
        submission_id: analysis.submission_id,
        error,
      })
    }

    logger.info('[CopilotOrchestrator] generated', {
      submission_id: analysis.submission_id,
      ready_to_publish: readiness.ready_to_publish,
      recommended_price_eur: pricing.recommended_price_eur,
    })

    return recommendations
  }
}

export const copilotOrchestrator = new CopilotOrchestrator()
