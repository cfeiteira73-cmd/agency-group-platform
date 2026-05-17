// AGENCY GROUP — SH-ROS | AMI: 22506
// lib/discovery-v2/index.ts
// Pure TypeScript semantic discovery engine.
// No DB calls. No fetch. All scoring is deterministic and testable.
// =============================================================================

// ─── Intent & Query types ─────────────────────────────────────────────────────

export type DiscoveryIntent =
  | 'find_similar'
  | 'investor_yield'
  | 'luxury_search'
  | 'family_home'
  | 'international_buyer'
  | 'retirement'
  | 'quick_sale'

export interface DiscoveryQuery {
  intent: DiscoveryIntent
  budget_max_eur?: number
  min_bedrooms?: number
  preferred_zones?: string[]
  must_have_pool?: boolean
  must_have_sea_view?: boolean
  luxury_min_score?: number
  yield_min_pct?: number // for investor intent
}

// ─── Candidate & Result types ─────────────────────────────────────────────────

export interface PropertyCandidate {
  property_id: string
  listing_price_eur: number
  zone: string
  bedrooms?: number
  luxury_score: number
  demand_score: number
  has_pool: boolean
  has_sea_view: boolean
  days_on_market: number
  area_sqm?: number
}

export interface DiscoveryResult {
  property_id: string
  match_score: number         // 0–100
  intent_alignment: number    // 0–1 how well this matches the intent
  yield_estimate_pct?: number // gross yield if rental intent
  recommendation_text: string // 1 sentence Portuguese
  ranking_reason:
    | 'best_yield'
    | 'luxury_match'
    | 'budget_fit'
    | 'location_match'
    | 'quick_sale'
    | 'family_fit'
}

// ─── Hard-filter helper ───────────────────────────────────────────────────────

function passesHardFilters(
  property: PropertyCandidate,
  query: DiscoveryQuery,
): boolean {
  if (query.budget_max_eur !== undefined && property.listing_price_eur > query.budget_max_eur) {
    return false
  }
  if (query.min_bedrooms !== undefined && (property.bedrooms ?? 0) < query.min_bedrooms) {
    return false
  }
  if (query.must_have_pool && !property.has_pool) {
    return false
  }
  if (query.must_have_sea_view && !property.has_sea_view) {
    return false
  }
  if (query.luxury_min_score !== undefined && property.luxury_score < query.luxury_min_score) {
    return false
  }
  return true
}

// ─── Clamp utility ────────────────────────────────────────────────────────────

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value))
}

// ─── Core scoring function ────────────────────────────────────────────────────

export function scorePropertyForIntent(
  property: PropertyCandidate,
  query: DiscoveryQuery,
): DiscoveryResult {
  const { intent } = query
  const { demand_score, luxury_score, has_pool, has_sea_view, days_on_market, bedrooms = 0, listing_price_eur, property_id } = property

  // Derived sub-scores (reused across intents)
  const freshnessScore = clamp(100 - days_on_market / 2.1)

  let rawScore = 0
  let yield_estimate_pct: number | undefined
  let ranking_reason: DiscoveryResult['ranking_reason'] = 'quick_sale'

  switch (intent) {
    case 'investor_yield': {
      rawScore =
        demand_score * 0.4 +
        freshnessScore * 0.3 +
        (has_sea_view ? 15 : 0) +
        (luxury_score > 60 ? 10 : 0)
      // Approximate gross yield: 5.5% for PT market
      yield_estimate_pct = 5.5
      ranking_reason = 'best_yield'
      break
    }

    case 'luxury_search': {
      rawScore =
        luxury_score * 0.5 +
        (has_pool ? 20 : 0) +
        (has_sea_view ? 20 : 0) +
        demand_score * 0.1
      ranking_reason = 'luxury_match'
      break
    }

    case 'family_home': {
      const bedroomScore = bedrooms >= 3 ? 40 : bedrooms * 12
      rawScore =
        bedroomScore +
        demand_score * 0.3 +
        (has_pool ? 15 : 0) +
        freshnessScore * 0.1
      ranking_reason = 'family_fit'
      break
    }

    case 'international_buyer': {
      rawScore =
        luxury_score * 0.3 +
        (has_sea_view ? 30 : 0) +
        (has_pool ? 20 : 0) +
        (days_on_market < 30 ? 20 : 10)
      ranking_reason = 'luxury_match'
      break
    }

    case 'find_similar':
    case 'retirement':
    case 'quick_sale':
    default: {
      rawScore =
        demand_score * 0.4 +
        freshnessScore * 0.4 +
        luxury_score * 0.2
      ranking_reason = 'quick_sale'
      break
    }
  }

  const match_score = clamp(Math.round(rawScore))
  const intent_alignment = Math.round((match_score / 100) * 1000) / 1000

  const recommendation_text = generateRecommendationText(
    { property_id, match_score, intent_alignment, yield_estimate_pct, recommendation_text: '', ranking_reason },
    property,
    intent,
  )

  return {
    property_id,
    match_score,
    intent_alignment,
    ...(yield_estimate_pct !== undefined ? { yield_estimate_pct } : {}),
    recommendation_text,
    ranking_reason,
  }
}

// ─── Recommendation text generator ───────────────────────────────────────────

export function generateRecommendationText(
  result: DiscoveryResult,
  property: PropertyCandidate,
  intent: DiscoveryIntent,
): string {
  const { zone, listing_price_eur, days_on_market, bedrooms, luxury_score } = property
  const priceLabel =
    listing_price_eur >= 1_000_000
      ? `€${(listing_price_eur / 1_000_000).toFixed(1)}M`
      : `€${Math.round(listing_price_eur / 1_000)}K`

  switch (intent) {
    case 'investor_yield':
      return `Imóvel em ${zone} com yield bruto estimado de 5,5% e procura sólida — excelente oportunidade de investimento a ${priceLabel}.`

    case 'luxury_search':
      return `Propriedade de luxo em ${zone} com score ${luxury_score}/100${property.has_pool ? ', piscina' : ''}${property.has_sea_view ? ' e vista mar' : ''} — referência de mercado a ${priceLabel}.`

    case 'family_home':
      return `${bedrooms ?? 'Vários'} quartos em ${zone}, ideal para família, com excelente relação qualidade-preço a ${priceLabel}.`

    case 'international_buyer':
      return `Prime location em ${zone}${property.has_sea_view ? ' com vista mar' : ''} — propriedade premium a ${priceLabel}, indicada para comprador internacional.`

    case 'retirement':
      return `Imóvel tranquilo em ${zone} com ${days_on_market} dias de mercado e gestão simples — adequado para residência de reforma a ${priceLabel}.`

    case 'quick_sale':
      return `Imóvel em ${zone} com ${days_on_market} dias no mercado e forte procura — oportunidade de fecho rápido a ${priceLabel}.`

    case 'find_similar':
    default:
      return `Imóvel em ${zone} com perfil semelhante ao pesquisado — score de compatibilidade ${result.match_score}/100 a ${priceLabel}.`
  }
}

// ─── Main discovery function ──────────────────────────────────────────────────

export function discoverProperties(
  candidates: PropertyCandidate[],
  query: DiscoveryQuery,
  limit = 10,
): DiscoveryResult[] {
  const results: DiscoveryResult[] = []

  for (const candidate of candidates) {
    if (!passesHardFilters(candidate, query)) continue

    const result = scorePropertyForIntent(candidate, query)

    // Additional yield filter for investor intent
    if (
      query.intent === 'investor_yield' &&
      query.yield_min_pct !== undefined &&
      (result.yield_estimate_pct ?? 0) < query.yield_min_pct
    ) {
      continue
    }

    results.push(result)
  }

  // Sort descending by match_score
  results.sort((a, b) => b.match_score - a.match_score)

  return results.slice(0, limit)
}

// ─── Namespace export ─────────────────────────────────────────────────────────

export const discoveryV2 = {
  scorePropertyForIntent,
  discoverProperties,
  generateRecommendationText,
}
