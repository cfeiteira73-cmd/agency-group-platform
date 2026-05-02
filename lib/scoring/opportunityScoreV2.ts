// =============================================================================
// Agency Group — Opportunity Score V2
// lib/scoring/opportunityScoreV2.ts
//
// Enriches the V1 base score (opportunityScore.ts) with 5 bonus factors and
// a confidence penalty, producing an institutional-grade output:
//
//   V1 BASE SCORE (0-100):
//     D1 Price vs Zone + D2 Yield + D3 Momentum + D4 DOM + D5 Type + D6 Fit
//
//   V2 BONUS FACTORS (max +31):
//     B1 Price Drop Momentum  (0-8)  — velocity of recent price reductions
//     B2 Seller Motivation    (0-8)  — renovation-need + stale DOM combo
//     B3 Quality Deficiency   (0-5)  — poor presentation = hidden gem
//     B4 Market Liquidity     (0-5)  — zone exit ease (zone.liquidez)
//     B5 Asset Scarcity       (0-5)  — tight supply (zone.abs_meses)
//
//   CONFIDENCE PENALTY (0-15 pts deducted):
//     Based on AVM confidence level + data completeness
//
//   OUTPUTS:
//     score_raw              = min(100, V1 + bonuses)
//     score_confidence_adjusted = max(0, score_raw − penalty)
//     opportunity_grade      = A+ (≥85) / A (70-84) / B (55-69) / C (40-54) / D (<40)
//
// PURE FUNCTION — no DB calls.
// Fully backward compatible — V1 is unchanged and still importable.
// =============================================================================

import {
  computeOpportunityScore,
  type PropertyInput,
} from '@/lib/scoring/opportunityScore'
import { getZone, resolvePropertyZone, type ZoneMarket } from '@/lib/market/zones'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OpportunityGrade = 'A+' | 'A' | 'B' | 'C' | 'D'

/** Extended input — V1 fields plus V2-specific enrichment fields */
export interface PropertyInputV2 extends PropertyInput {
  avm_value_base?:     number | null   // from AVM engine (preferred over avm_estimate)
  avm_confidence?:     number | null   // 0–1 from lib/valuation/avm.ts
  presentation_score?: number | null   // 0–100 from lib/scoring/presentationScore.ts
}

export interface ScoreBreakdownV2 {
  // ── V1 dimensions (unchanged) ──────────────────────────────────────────────
  d1_price_vs_zone:     number   // 0-30
  d2_rental_yield:      number   // 0-20
  d3_momentum:          number   // 0-15
  d4_dom_position:      number   // 0-15
  d5_asset_type:        number   // 0-10
  d6_investor_fit:      number   // 0-10
  v1_total:             number   // sum of D1-D6
  // ── V2 bonus factors ──────────────────────────────────────────────────────
  b1_price_momentum:    number   // 0-8
  b2_seller_motivation: number   // 0-8
  b3_quality_deficit:   number   // 0-5
  b4_market_liquidity:  number   // 0-5
  b5_asset_scarcity:    number   // 0-5
  v2_bonus_total:       number   // sum of B1-B5
  // ── Confidence adjustment ─────────────────────────────────────────────────
  confidence_penalty:   number   // 0-15 (deducted from raw score)
}

export interface ScoreResultV2 {
  // ── V1-compatible fields (safe to write to existing DB columns) ────────────
  opportunity_score:         number           // = score_confidence_adjusted
  estimated_rental_yield:    number | null
  estimated_cap_rate:        number | null
  investor_suitable:         boolean
  score_reason:              string
  zone_key:                  string
  zone_data:                 ZoneMarket
  // ── V2-specific fields ────────────────────────────────────────────────────
  score_raw:                 number           // pre-penalty score
  score_confidence_adjusted: number           // post-penalty (= opportunity_score)
  opportunity_grade:         OpportunityGrade
  confidence_penalty:        number           // pts deducted
  score_breakdown_v2:        ScoreBreakdownV2
}

// ---------------------------------------------------------------------------
// V2 Bonus factor: B1 — Price Drop Momentum (0-8 pts)
// Rewards velocity of seller capitulation (recent price reduction)
// ---------------------------------------------------------------------------

function scoreB1PriceDropMomentum(property: PropertyInputV2): number {
  const { price, price_previous } = property
  if (!price || price <= 0 || !price_previous || price_previous <= 0) return 0
  if (price >= price_previous) return 0  // no drop

  const drop = (price_previous - price) / price_previous
  if (drop >= 0.15) return 8
  if (drop >= 0.10) return 5
  if (drop >= 0.05) return 3
  if (drop >= 0.02) return 1
  return 0
}

// ---------------------------------------------------------------------------
// V2 Bonus factor: B2 — Seller Motivation Composite (0-8 pts)
// Renovation-needed + stale DOM = maximum negotiating leverage
// ---------------------------------------------------------------------------

function scoreB2SellerMotivation(property: PropertyInputV2, zone: ZoneMarket): number {
  let score = 0

  // Condition: needs renovation or ruin → fewer competing buyers → pricing power
  if (property.condition === 'needs_renovation' || property.condition === 'ruin') {
    score += 3
  }

  // Stale DOM: time pressure escalates seller motivation
  const isStale =
    typeof property.days_on_market === 'number' &&
    property.days_on_market > zone.dias_mercado * 1.5

  if (isStale) score += 3

  // Combo: stale listing AND price already dropped = escalating seller desperation
  const hasDrop =
    typeof property.price_previous === 'number' &&
    typeof property.price === 'number' &&
    property.price < property.price_previous

  if (hasDrop && isStale) score += 2

  return Math.min(8, score)
}

// ---------------------------------------------------------------------------
// V2 Bonus factor: B3 — Listing Quality Deficiency (0-5 pts)
// Poor presentation = other buyers overlook the property = less competition
// ---------------------------------------------------------------------------

function scoreB3QualityDeficit(property: PropertyInputV2): number {
  const ps = property.presentation_score
  if (ps == null)  return 1   // unknown — slight benefit of doubt
  if (ps < 40)     return 5   // very poor = significant hidden gem opportunity
  if (ps < 60)     return 2   // below average = moderate opportunity
  return 0                     // acceptable presentation = no opportunity bonus
}

// ---------------------------------------------------------------------------
// V2 Bonus factor: B4 — Market Liquidity (0-5 pts)
// High-liquidity zones allow faster exit → lower holding cost risk
// ---------------------------------------------------------------------------

function scoreB4MarketLiquidity(zone: ZoneMarket): number {
  return Math.round((zone.liquidez / 10) * 5)
}

// ---------------------------------------------------------------------------
// V2 Bonus factor: B5 — Asset Scarcity (0-5 pts)
// Tight supply (low abs_meses) = harder to find equivalent → pricing power
// ---------------------------------------------------------------------------

function scoreB5AssetScarcity(zone: ZoneMarket): number {
  const { abs_meses } = zone
  if (abs_meses <= 1.5) return 5
  if (abs_meses <= 2.0) return 4
  if (abs_meses <= 2.5) return 3
  if (abs_meses <= 3.0) return 2
  return 1
}

// ---------------------------------------------------------------------------
// Confidence penalty (0-15 pts deducted from score_raw)
// ---------------------------------------------------------------------------

function computeConfidencePenalty(property: PropertyInputV2): number {
  const { avm_confidence, area_m2, bedrooms, condition } = property

  // AVM confidence drives the base penalty
  let basePenalty: number
  if (avm_confidence != null) {
    if (avm_confidence >= 0.80)      basePenalty = 0
    else if (avm_confidence >= 0.60) basePenalty = 3
    else if (avm_confidence >= 0.40) basePenalty = 8
    else                             basePenalty = 12
  } else {
    // No AVM confidence — mild uncertainty (valuation may be zone-only)
    basePenalty = 5
  }

  // Data completeness penalty: missing key fields degrade scoring quality
  const dataPenalty =
    (!area_m2    ? 3 : 0) +   // area drives yield & discount calculations
    (!bedrooms   ? 1 : 0) +   // bedroom-specific liquidity
    (!condition  ? 1 : 0)     // condition adjusts both AVM and investor fit

  return Math.min(15, basePenalty + dataPenalty)
}

// ---------------------------------------------------------------------------
// Grade assignment
// ---------------------------------------------------------------------------

function assignGrade(score: number): OpportunityGrade {
  if (score >= 85) return 'A+'
  if (score >= 70) return 'A'
  if (score >= 55) return 'B'
  if (score >= 40) return 'C'
  return 'D'
}

// ---------------------------------------------------------------------------
// Main export: computeOpportunityScoreV2
// ---------------------------------------------------------------------------

export function computeOpportunityScoreV2(input: PropertyInputV2): ScoreResultV2 {
  // 1. Compute V1 base score
  // If avm_value_base is provided, inject it as avm_estimate for V1 D1 computation
  const v1Input: PropertyInput = {
    ...input,
    avm_estimate: input.avm_value_base ?? input.avm_estimate,
  }
  const v1 = computeOpportunityScore(v1Input)

  // 2. Resolve zone (reuse from V1 result)
  const zone_key = v1.zone_key
  const zone     = getZone(zone_key)

  // 3. Compute V2 bonus factors
  const b1 = scoreB1PriceDropMomentum(input)
  const b2 = scoreB2SellerMotivation(input, zone)
  const b3 = scoreB3QualityDeficit(input)
  const b4 = scoreB4MarketLiquidity(zone)
  const b5 = scoreB5AssetScarcity(zone)

  const v2_bonus = b1 + b2 + b3 + b4 + b5

  // 4. Compute raw score (V1 + V2 bonuses, capped at 100)
  const score_raw = Math.min(100, v1.opportunity_score + v2_bonus)

  // 5. Apply confidence penalty
  const confidence_penalty = computeConfidencePenalty(input)
  const score_confidence_adjusted = Math.max(0, score_raw - confidence_penalty)

  // 6. Assign grade
  const opportunity_grade = assignGrade(score_confidence_adjusted)

  // 7. Build breakdown
  const bd = v1.score_breakdown
  const score_breakdown_v2: ScoreBreakdownV2 = {
    d1_price_vs_zone:     bd.d1_price_vs_zone,
    d2_rental_yield:      bd.d2_rental_yield,
    d3_momentum:          bd.d3_momentum,
    d4_dom_position:      bd.d4_dom_position,
    d5_asset_type:        bd.d5_asset_type,
    d6_investor_fit:      bd.d6_investor_fit,
    v1_total:             v1.opportunity_score,
    b1_price_momentum:    b1,
    b2_seller_motivation: b2,
    b3_quality_deficit:   b3,
    b4_market_liquidity:  b4,
    b5_asset_scarcity:    b5,
    v2_bonus_total:       v2_bonus,
    confidence_penalty,
  }

  return {
    // V1-compatible
    opportunity_score:         score_confidence_adjusted,  // the authoritative score
    estimated_rental_yield:    v1.estimated_rental_yield,
    estimated_cap_rate:        v1.estimated_cap_rate,
    investor_suitable:         v1.investor_suitable,
    score_reason:              v1.score_reason,
    zone_key,
    zone_data:                 zone,
    // V2-specific
    score_raw,
    score_confidence_adjusted,
    opportunity_grade,
    confidence_penalty,
    score_breakdown_v2,
  }
}

// ---------------------------------------------------------------------------
// Batch helper: score array of properties with V2 enrichment
// ---------------------------------------------------------------------------

export interface BatchScoreResultV2 {
  id:                          string
  opportunity_score:           number
  estimated_rental_yield:      number | null
  estimated_cap_rate:          number | null
  investor_suitable:           boolean
  score_reason:                string
  score_raw:                   number
  score_confidence_adjusted:   number
  opportunity_grade:           OpportunityGrade
  confidence_penalty:          number
  score_breakdown_v2:          ScoreBreakdownV2
  zone_key:                    string
  changed:                     boolean
}

export function batchScorePropertiesV2(
  properties: (PropertyInputV2 & { id: string })[],
): BatchScoreResultV2[] {
  return properties.map(p => {
    const result    = computeOpportunityScoreV2(p)
    const prevScore = p.opportunity_score ?? -1
    const prevSuit  = p.investor_suitable ?? null
    const changed   =
      result.opportunity_score !== prevScore ||
      result.investor_suitable !== prevSuit

    return {
      id:                        p.id,
      opportunity_score:         result.opportunity_score,
      estimated_rental_yield:    result.estimated_rental_yield,
      estimated_cap_rate:        result.estimated_cap_rate,
      investor_suitable:         result.investor_suitable,
      score_reason:              result.score_reason,
      score_raw:                 result.score_raw,
      score_confidence_adjusted: result.score_confidence_adjusted,
      opportunity_grade:         result.opportunity_grade,
      confidence_penalty:        result.confidence_penalty,
      score_breakdown_v2:        result.score_breakdown_v2,
      zone_key:                  result.zone_key,
      changed,
    }
  })
}
