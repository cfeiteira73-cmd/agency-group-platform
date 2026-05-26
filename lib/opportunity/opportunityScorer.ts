// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — Opportunity Scorer (Wave 42)
// lib/opportunity/opportunityScorer.ts
//
// Advanced scoring with urgency decay model and investor demand injection.
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { computeOpportunityScore } from './opportunityDetectionEngine'

// ─── Re-exports ───────────────────────────────────────────────────────────────

export type { Opportunity } from './opportunityDetectionEngine'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScoringContext {
  asset_id: string
  asking_price_eur_cents: number
  fair_value_eur_cents: number
  liquidity_score: number
  risk_score: number
  days_on_market: number
  source_confidence: number
  is_distressed: boolean
  is_auction: boolean
  investor_demand_score: number
  market: string
  city: string
}

export interface ScoreBreakdown {
  final_score: number
  undervaluation_component: number
  liquidity_component: number
  investor_demand_component: number
  risk_adjusted_roi_component: number
  source_confidence_component: number
  urgency_multiplier: number
  explanation: string[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// ─── scoreOpportunity ─────────────────────────────────────────────────────────

/**
 * Pure function — full formula with urgency multiplier.
 *
 * urgency_multiplier = 1.0 + (0.2 * exp(-days_on_market / 60))   [freshness bonus]
 * For auctions: urgency_multiplier += 0.3
 * final_score = clamp(weighted_sum * urgency_multiplier, 0, 100)
 */
export function scoreOpportunity(ctx: ScoringContext): ScoreBreakdown {
  const {
    asking_price_eur_cents: asking,
    fair_value_eur_cents: fair,
    liquidity_score,
    risk_score,
    days_on_market,
    source_confidence,
    is_distressed,
    is_auction,
    investor_demand_score,
    city,
    market,
  } = ctx

  // Undervaluation
  const undervaluation_pct =
    fair > 0 ? ((fair - asking) / fair) * 100 : 0
  const undervaluation_component = clamp((undervaluation_pct / 30) * 100, 0, 100)

  // Liquidity
  const liquidity_component = clamp(liquidity_score, 0, 100)

  // Investor demand
  const investor_demand_component = clamp(investor_demand_score, 0, 100)

  // ROI
  const commission = fair * 0.05
  const potential_gain = fair - asking - commission
  const roi_pct = asking > 0 ? (potential_gain / asking) * 100 : 0
  const risk_adjusted_roi_component = clamp((roi_pct / 20) * 100, 0, 100)

  // Source confidence
  const source_confidence_component = clamp(source_confidence * 100, 0, 100)

  // Weighted sum (pre-multiplier)
  const weighted_sum =
    undervaluation_component    * 0.30 +
    liquidity_component         * 0.25 +
    investor_demand_component   * 0.20 +
    risk_adjusted_roi_component * 0.15 +
    source_confidence_component * 0.10

  // Urgency multiplier — freshness bonus decays exponentially
  let urgency_multiplier = 1.0 + 0.2 * Math.exp(-days_on_market / 60)
  if (is_auction) urgency_multiplier += 0.3

  const final_score = clamp(round2(weighted_sum * urgency_multiplier), 0, 100)

  // Human-readable explanation
  const explanation: string[] = []

  if (undervaluation_pct > 0) {
    explanation.push(`Undervalued by ${round2(undervaluation_pct)}% vs fair market value`)
  }
  if (liquidity_score >= 70) {
    explanation.push(`High liquidity market: ${market} / ${city} (score ${round2(liquidity_score)}/100)`)
  } else if (liquidity_score >= 40) {
    explanation.push(`Moderate liquidity: ${market} / ${city} (score ${round2(liquidity_score)}/100)`)
  } else {
    explanation.push(`Low liquidity market (score ${round2(liquidity_score)}/100)`)
  }
  explanation.push(
    `Source confidence: ${round2(source_confidence * 100)}%`,
  )
  if (is_distressed) explanation.push('Distressed asset — elevated opportunity')
  if (is_auction)    explanation.push('Auction asset — time-sensitive, urgency bonus applied')
  if (roi_pct > 0) {
    explanation.push(`Estimated ROI: ${round2(roi_pct)}% (net of 5% commission)`)
  }
  if (risk_score > 60) {
    explanation.push(`Elevated risk score: ${round2(risk_score)}/100 — due diligence required`)
  }
  if (days_on_market > 90) {
    explanation.push(`${days_on_market} days on market — freshness penalty applied`)
  }
  explanation.push(`Urgency multiplier: ${round2(urgency_multiplier)}x`)

  return {
    final_score,
    undervaluation_component: round2(undervaluation_component),
    liquidity_component:      round2(liquidity_component),
    investor_demand_component: round2(investor_demand_component),
    risk_adjusted_roi_component: round2(risk_adjusted_roi_component),
    source_confidence_component: round2(source_confidence_component),
    urgency_multiplier: round2(urgency_multiplier),
    explanation,
  }
}

// ─── batchRescoreOpportunities ────────────────────────────────────────────────

/**
 * Reads all ACTIVE opportunities for the tenant, rescores with latest demand
 * data, and updates detected_opportunities scores.
 *
 * investorDemandMap: { asset_id: score 0–100 }
 */
export async function batchRescoreOpportunities(
  tenantId: string,
  investorDemandMap?: Record<string, number>,
): Promise<{ rescored: number }> {
  try {
    // Fetch ACTIVE opportunities
    const { data: rows, error } = await (supabaseAdmin as any)
      .from('detected_opportunities')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'ACTIVE')

    if (error) {
      log.error('[opportunityScorer] Failed to fetch ACTIVE opportunities', error)
      return { rescored: 0 }
    }

    const opportunities = (rows ?? []) as Record<string, unknown>[]
    let rescored = 0

    for (const opp of opportunities) {
      try {
        const assetId = String(opp.asset_id ?? '')
        const investorDemand = investorDemandMap?.[assetId] ?? 50

        const ctx: ScoringContext = {
          asset_id:               assetId,
          asking_price_eur_cents: Number(opp.asking_price_eur_cents ?? 0),
          fair_value_eur_cents:   Number(opp.fair_value_eur_cents ?? 0),
          liquidity_score:        Number(opp.liquidity_score ?? 50),
          risk_score:             Number(opp.risk_score ?? 50),
          days_on_market:         Number(opp.days_on_market ?? 0),
          source_confidence:      Number(opp.source_confidence ?? 0.7),
          is_distressed:          opp.opportunity_type === 'DISTRESSED_ASSET',
          is_auction:             opp.opportunity_type === 'AUCTION_ARBITRAGE',
          investor_demand_score:  investorDemand,
          market:                 String(opp.market ?? 'PT'),
          city:                   String(opp.city ?? ''),
        }

        const breakdown = scoreOpportunity(ctx)

        const { error: updateError } = await (supabaseAdmin as any)
          .from('detected_opportunities')
          .update({
            opportunity_score: breakdown.final_score,
            liquidity_score:   breakdown.liquidity_component,
            urgency_score: clamp(
              100 * Math.exp(-ctx.days_on_market / 90),
              0,
              100,
            ),
          })
          .eq('tenant_id', tenantId)
          .eq('asset_id', assetId)
          .eq('status', 'ACTIVE')

        if (!updateError) rescored++
      } catch (itemErr) {
        log.warn('[opportunityScorer] Rescore item error', {
          asset_id: String(opp.asset_id ?? ''),
          error: String(itemErr),
        })
      }
    }

    log.info('[opportunityScorer] batchRescoreOpportunities complete', {
      tenant_id: tenantId,
      rescored,
    })

    return { rescored }
  } catch (err) {
    log.error('[opportunityScorer] batchRescoreOpportunities failed', err)
    return { rescored: 0 }
  }
}

// ─── rankOpportunities ────────────────────────────────────────────────────────

/**
 * Pure sort function.
 * Primary: opportunity_score DESC.
 * Secondary: urgency_score DESC (auctions first).
 */
export function rankOpportunities<T extends {
  opportunity_score: number
  urgency_score: number
  opportunity_type: string
}>(
  opportunities: T[],
  _investorProfile?: Record<string, unknown>,
): T[] {
  return [...opportunities].sort((a, b) => {
    if (b.opportunity_score !== a.opportunity_score) {
      return b.opportunity_score - a.opportunity_score
    }
    // Auctions get urgency priority
    const aIsAuction = a.opportunity_type === 'AUCTION_ARBITRAGE' ? 1 : 0
    const bIsAuction = b.opportunity_type === 'AUCTION_ARBITRAGE' ? 1 : 0
    if (bIsAuction !== aIsAuction) return bIsAuction - aIsAuction
    return b.urgency_score - a.urgency_score
  })
}

// Re-export computeOpportunityScore for consumers that need the raw formula
export { computeOpportunityScore }
