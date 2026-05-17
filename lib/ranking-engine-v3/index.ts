// AGENCY GROUP — SH-ROS | AMI: 22506
// lib/ranking-engine-v3/index.ts
// Revenue-optimised listing ranking incorporating buyer intent distribution
// and conversion probability directly into the composite score.
// PURE: no IO, no DB calls.
// =============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RankingV3Input {
  property_id: string
  listing_price_eur: number
  demand_score: number              // 0–100 from property_ai_intelligence
  homepage_placement_score: number  // 0–100 existing score
  days_on_market: number
  has_sea_view: boolean
  has_pool: boolean
  luxury_score: number              // 0–100
  inquiry_count: number             // inquiries received
  visit_count: number               // visits completed
  offer_count: number               // offers received
  zone: string                      // e.g. 'Lisboa', 'Cascais'
  buyer_intent_distribution?: {     // optional — from buyer tracker
    investor: number
    luxury_buyer: number
    family: number
    relocating: number
    [key: string]: number
  }
}

export interface RankingV3Result {
  property_id: string
  revenue_rank_score: number    // 0–100 (higher = more revenue potential)
  conversion_score: number      // 0–100 (probability-weighted conversion)
  urgency_score: number         // 0–100 (time pressure to act)
  opportunity_score: number     // 0–100 (undervalued / timing opportunity)
  final_score: number           // weighted composite 0–100
  rank: number                  // 1-based rank in sorted list
  reasoning: string             // 1-sentence Portuguese explanation
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function roundTwo(n: number): number {
  return Math.round(n * 100) / 100
}

// ---------------------------------------------------------------------------
// Sub-score computations
// ---------------------------------------------------------------------------

function computeConversionScore(input: RankingV3Input): number {
  const { inquiry_count, visit_count, offer_count, days_on_market } = input
  const monthsActive = Math.max(days_on_market / 30, 1)
  const raw = (inquiry_count * 15 + visit_count * 25 + offer_count * 40) / monthsActive
  return clamp(raw, 0, 100)
}

function computeRevenueRankScore(input: RankingV3Input): number {
  const priceFactor  = (input.listing_price_eur / 1_000_000) * 8
  const demandFactor = input.demand_score * 0.4
  const luxuryFactor = input.luxury_score * 0.2
  return clamp(priceFactor + demandFactor + luxuryFactor, 0, 100)
}

function computeUrgencyScore(days_on_market: number): number {
  if (days_on_market > 180) return 90
  if (days_on_market > 90)  return 70
  if (days_on_market > 30)  return 40
  return 15
}

function computeOpportunityScore(input: RankingV3Input): number {
  if (input.offer_count > 0)    return 80
  if (input.visit_count > 2)    return 60
  if (input.inquiry_count > 3)  return 40
  return clamp(input.demand_score * 0.4, 0, 100)
}

// ---------------------------------------------------------------------------
// Buyer intent distribution boost (up to +10 on final_score)
// Luxury and investor intents are the highest-value segments for AG.
// ---------------------------------------------------------------------------

function computeIntentBoost(
  distribution: RankingV3Input['buyer_intent_distribution'],
): number {
  if (!distribution) return 0
  const total = Object.values(distribution).reduce((sum, v) => sum + v, 0)
  if (total <= 0) return 0

  const luxuryShare   = (distribution['luxury_buyer']  ?? 0) / total
  const investorShare = (distribution['investor']      ?? 0) / total
  const highValueShare = luxuryShare + investorShare

  // Linear scale: 0% → 0 boost, 100% → 10 boost
  return roundTwo(clamp(highValueShare * 10, 0, 10))
}

// ---------------------------------------------------------------------------
// Reasoning builder — Portuguese, 1 sentence
// ---------------------------------------------------------------------------

function buildReasoning(input: RankingV3Input, result: Omit<RankingV3Result, 'rank' | 'reasoning'>): string {
  if (result.final_score >= 70) {
    return `Imóvel de alta prioridade em ${input.zone} — elevado potencial de receita e forte actividade de conversão justificam destaque imediato.`
  }
  if (result.urgency_score >= 70) {
    return `Imóvel em ${input.zone} com tempo de mercado elevado — acção urgente necessária para evitar desvalorização.`
  }
  if (result.conversion_score >= 60) {
    return `Pipeline activo em ${input.zone} — múltiplos sinais de interesse confirmam potencial de fecho a curto prazo.`
  }
  if (result.revenue_rank_score >= 60) {
    return `Imóvel premium em ${input.zone} com forte margem de comissão — foco em comprador de luxo ou investidor.`
  }
  return `Imóvel em ${input.zone} a monitorizar — oportunidade moderada com potencial de melhoria de posicionamento.`
}

// ---------------------------------------------------------------------------
// Public: scorePropertyV3
// ---------------------------------------------------------------------------

export function scorePropertyV3(input: RankingV3Input): RankingV3Result {
  const revenue_rank_score = roundTwo(computeRevenueRankScore(input))
  const conversion_score   = roundTwo(computeConversionScore(input))
  const urgency_score      = roundTwo(computeUrgencyScore(input.days_on_market))
  const opportunity_score  = roundTwo(computeOpportunityScore(input))

  const baseScore =
    revenue_rank_score * 0.35 +
    conversion_score   * 0.30 +
    urgency_score      * 0.20 +
    opportunity_score  * 0.15

  const intentBoost = computeIntentBoost(input.buyer_intent_distribution)
  const final_score = roundTwo(clamp(baseScore + intentBoost, 0, 100))

  const partial: Omit<RankingV3Result, 'rank' | 'reasoning'> = {
    property_id: input.property_id,
    revenue_rank_score,
    conversion_score,
    urgency_score,
    opportunity_score,
    final_score,
  }

  const reasoning = buildReasoning(input, partial)

  return {
    ...partial,
    rank: 0, // assigned by rankPropertiesV3
    reasoning,
  }
}

// ---------------------------------------------------------------------------
// Public: rankPropertiesV3
// ---------------------------------------------------------------------------

export function rankPropertiesV3(inputs: RankingV3Input[]): RankingV3Result[] {
  const scored = inputs.map(scorePropertyV3)
  scored.sort((a, b) => b.final_score - a.final_score)
  return scored.map((result, index) => ({ ...result, rank: index + 1 }))
}

// ---------------------------------------------------------------------------
// Namespace export
// ---------------------------------------------------------------------------

export const rankingEngineV3 = {
  scorePropertyV3,
  rankPropertiesV3,
} as const
