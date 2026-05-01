// =============================================================================
// Agency Group — Opportunity Scoring Engine
// lib/scoring/opportunityScore.ts
//
// Computes opportunity_score (0-100) for any property based on 6 dimensions:
//   D1  Price vs Zone (0-30 pts) — discount vs median transaction price
//   D2  Rental Yield  (0-20 pts) — gross yield vs zone benchmark
//   D3  Momentum      (0-15 pts) — YoY growth + demand score
//   D4  DOM Position  (0-15 pts) — time-to-sell efficiency vs zone median
//   D5  Asset Type    (0-10 pts) — investor preference premium
//   D6  Investor Fit  (0-10 pts) — features + condition + market access
//
// Total: 100 pts
// Thresholds: ≥80 HIGH · 60-79 MEDIUM · <60 LOW
//
// Side effects: none (pure function — caller is responsible for DB writes)
// =============================================================================

import { ZoneMarket, getZone, resolvePropertyZone } from '@/lib/market/zones'

// ---------------------------------------------------------------------------
// Input / Output types
// ---------------------------------------------------------------------------

export interface PropertyInput {
  // Identity
  id?:                  string
  // Pricing
  price:                number         // Current asking price in EUR
  price_previous?:      number | null  // Previous price (for reduction detection)
  price_per_sqm?:       number | null  // If null, derived from price / area_m2
  avm_estimate?:        number | null  // AVM value for discount calculation
  // Physical
  area_m2?:             number | null
  bedrooms?:            number | null
  type?:                string | null  // property_type enum
  condition?:           string | null  // 'new','excellent','good','needs_renovation','ruin'
  features?:            string[] | null
  // Location
  zone?:                string | null
  zona?:                string | null
  city?:                string | null
  concelho?:            string | null
  address?:             string | null
  titulo?:              string | null
  title?:               string | null
  // Market
  days_on_market?:      number | null
  is_exclusive?:        boolean | null
  is_off_market?:       boolean | null
  // Existing scores (for reference only — not used in computation)
  opportunity_score?:   number | null
  investor_suitable?:   boolean | null
}

export interface ScoreBreakdown {
  d1_price_vs_zone:    number   // 0-30
  d2_rental_yield:     number   // 0-20
  d3_momentum:         number   // 0-15
  d4_dom_position:     number   // 0-15
  d5_asset_type:       number   // 0-10
  d6_investor_fit:     number   // 0-10
}

export interface ScoreResult {
  opportunity_score:      number          // 0-100 final score
  estimated_rental_yield: number | null   // Gross yield % or null if price=0
  estimated_cap_rate:     number | null   // Net yield (approx 75% of gross) or null
  investor_suitable:      boolean         // true if score ≥ 65 AND yield ≥ 4%
  score_reason:           string          // Human-readable 1-line reason
  score_breakdown:        ScoreBreakdown
  zone_key:               string          // Resolved zone key used for scoring
  zone_data:              ZoneMarket      // Zone data snapshot at time of scoring
}

// ---------------------------------------------------------------------------
// Asset type weights — investor desirability in PT market 2026
// ---------------------------------------------------------------------------

const ASSET_TYPE_SCORES: Record<string, number> = {
  apartment:        9,   // Highest demand, easiest to rent/sell
  penthouse:        10,  // Maximum premium
  villa:            8,   // High value, longer sale cycle
  townhouse:        7,
  development_plot: 6,   // High upside, higher risk
  commercial:       5,
  office:           4,
  hotel:            7,   // Specialist market
  warehouse:        3,
  land:             4,
}

// ---------------------------------------------------------------------------
// Condition multiplier for investor scoring
// ---------------------------------------------------------------------------

const CONDITION_MULTIPLIER: Record<string, number> = {
  new:               1.0,
  excellent:         0.95,
  good:              0.85,
  needs_renovation:  0.6,   // Price should compensate
  ruin:              0.4,
}

// ---------------------------------------------------------------------------
// Feature premium scoring (investor-relevant features)
// ---------------------------------------------------------------------------

const INVESTOR_FEATURES = [
  'pool', 'terrace', 'garage', 'sea_view', 'river_view', 'lift',
  'air_conditioning', 'concierge', 'gym', 'spa', 'parking',
  'storage', 'balcony', 'garden', 'fireplace', 'solar_panels',
]

function countInvestorFeatures(features: string[] | null | undefined): number {
  if (!features || features.length === 0) return 0
  const lower = features.map(f => f.toLowerCase())
  return INVESTOR_FEATURES.filter(f => lower.some(pf => pf.includes(f))).length
}

// ---------------------------------------------------------------------------
// D1 — Price vs Zone (0-30 pts)
// Measures how discounted the property is vs zone transaction median (pm2_trans)
// Uses AVM if available, otherwise price/m² vs pm2_trans
// ---------------------------------------------------------------------------

function scoreD1PriceVsZone(
  property: PropertyInput,
  zone:     ZoneMarket,
): number {
  const { price, avm_estimate, price_per_sqm, area_m2 } = property

  if (price <= 0) return 0

  // Preferred path: AVM discount
  if (avm_estimate && avm_estimate > 0) {
    const discount = (avm_estimate - price) / avm_estimate  // positive = below AVM
    // Scale: 0% discount = 10pts | 5% = 15pts | 10% = 20pts | 15% = 25pts | 20%+ = 30pts
    if (discount >= 0.20) return 30
    if (discount >= 0.15) return 25
    if (discount >= 0.10) return 20
    if (discount >= 0.05) return 15
    if (discount >= 0.00) return 10
    // Overpriced vs AVM (negative discount)
    if (discount >= -0.05) return 7
    if (discount >= -0.10) return 4
    return 2
  }

  // Fallback: price/m² vs zone pm2_trans
  let ppm2 = price_per_sqm ?? null
  if (!ppm2 && area_m2 && area_m2 > 0) {
    ppm2 = price / area_m2
  }
  if (!ppm2 || ppm2 <= 0) {
    // No pricing data at all — explicit data-insufficient penalty (not a real signal)
    return 5
  }

  const discount = (zone.pm2_trans - ppm2) / zone.pm2_trans
  if (discount >= 0.20) return 30
  if (discount >= 0.15) return 26
  if (discount >= 0.10) return 22
  if (discount >= 0.05) return 18
  if (discount >= 0.00) return 12
  if (discount >= -0.05) return 8
  if (discount >= -0.10) return 5
  return 2
}

// ---------------------------------------------------------------------------
// D2 — Rental Yield (0-20 pts)
// Gross yield derived from zone renda_m2 or AL yield
// ---------------------------------------------------------------------------

function scoreD2RentalYield(
  property: PropertyInput,
  zone:     ZoneMarket,
): { score: number; estimated_yield: number | null; yield_from_area: boolean } {
  const { price, area_m2 } = property

  if (price <= 0) return { score: 0, estimated_yield: null, yield_from_area: false }

  let grossYield: number
  let yield_from_area: boolean

  if (area_m2 && area_m2 > 0) {
    // Compute from zone rental data: annual_rent / price
    const monthly_rent = zone.renda_m2 * area_m2
    const annual_rent  = monthly_rent * 11.5  // account for vacancy (~3-4 weeks)
    grossYield     = (annual_rent / price) * 100
    yield_from_area = true
  } else {
    // No area data — penalized zone estimate (20% uncertainty discount)
    // Avoids phantom yield scores driven purely by zone median
    grossYield     = zone.yield_bruto * 0.80
    yield_from_area = false
  }

  // Score: <3% = 0 | 3-4% = 6 | 4-5% = 10 | 5-6% = 14 | 6-7% = 17 | 7%+ = 20
  let score: number
  if (grossYield >= 7)      score = 20
  else if (grossYield >= 6) score = 17
  else if (grossYield >= 5) score = 14
  else if (grossYield >= 4) score = 10
  else if (grossYield >= 3) score = 6
  else                      score = 0

  return {
    score,
    estimated_yield: parseFloat(grossYield.toFixed(2)),
    yield_from_area,
  }
}

// ---------------------------------------------------------------------------
// D3 — Market Momentum (0-15 pts)
// YoY appreciation + zone demand score
// ---------------------------------------------------------------------------

function scoreD3Momentum(zone: ZoneMarket): number {
  const { var_yoy, demanda, abs_meses } = zone

  // YoY component (0-8 pts): price appreciation signals demand
  let yoy_score: number
  if (var_yoy >= 20)     yoy_score = 8
  else if (var_yoy >= 15) yoy_score = 7
  else if (var_yoy >= 10) yoy_score = 5
  else if (var_yoy >= 5)  yoy_score = 3
  else if (var_yoy >= 0)  yoy_score = 1
  else                    yoy_score = 0  // negative growth

  // Demand component (0-5 pts): zone demanda 0-10 mapped to 0-5
  const demand_score = Math.round((demanda / 10) * 5)

  // Absorption component (0-2 pts): fast absorption = tight supply
  const abs_score = abs_meses <= 1.5 ? 2 : abs_meses <= 2.5 ? 1 : 0

  return Math.min(15, yoy_score + demand_score + abs_score)
}

// ---------------------------------------------------------------------------
// D4 — DOM Position (0-15 pts)
// How quickly will this sell vs zone median
// ---------------------------------------------------------------------------

function scoreD4DomPosition(
  property: PropertyInput,
  zone:     ZoneMarket,
): number {
  const { days_on_market } = property
  const median = zone.dias_mercado

  if (!days_on_market || days_on_market <= 0) {
    // Unknown DOM — neutral score (missing data ≠ fresh listing)
    return 10
  }

  const ratio = days_on_market / median  // >1 = stale

  // Fresh (under half median) = max score; stale (2× median) = near 0
  if (ratio <= 0.5)  return 15
  if (ratio <= 0.75) return 12
  if (ratio <= 1.0)  return 10
  if (ratio <= 1.25) return 8
  if (ratio <= 1.5)  return 6
  if (ratio <= 2.0)  return 3
  return 1  // severely stale but not zero — could negotiate hard
}

// ---------------------------------------------------------------------------
// D5 — Asset Type Desirability (0-10 pts)
// ---------------------------------------------------------------------------

function scoreD5AssetType(property: PropertyInput): number {
  const { type, bedrooms } = property
  const base = ASSET_TYPE_SCORES[type ?? 'apartment'] ?? 6

  // Bedroom premium for apartments: T2-T3 are most liquid
  if ((type === 'apartment' || type === 'penthouse') && bedrooms) {
    if (bedrooms === 2 || bedrooms === 3) return Math.min(10, base + 1)
    if (bedrooms === 4)                  return Math.min(10, base)
    if (bedrooms === 1)                  return Math.max(0, base - 1) // studios less liquid
    if (bedrooms >= 5)                   return Math.min(10, base)    // ultra luxury — niche
  }

  return base
}

// ---------------------------------------------------------------------------
// D6 — Investor Fit (0-10 pts)
// Condition + features + access type (exclusive/off-market premium)
// ---------------------------------------------------------------------------

function scoreD6InvestorFit(
  property: PropertyInput,
  zone:     ZoneMarket,
): number {
  const { condition, features, is_exclusive, is_off_market } = property

  // Condition multiplier (0-4 pts base)
  const condMult = CONDITION_MULTIPLIER[condition ?? 'good'] ?? 0.85
  const condScore = Math.round(4 * condMult)

  // Feature premium (0-3 pts)
  const featureCount = countInvestorFeatures(features)
  const featureScore = featureCount >= 5 ? 3 : featureCount >= 3 ? 2 : featureCount >= 1 ? 1 : 0

  // Access premium: exclusive/off-market = harder to find = higher value (0-2 pts)
  const accessScore = (is_exclusive || is_off_market) ? 2 : 0

  // International buyer zone bonus (0-1 pt): high intl demand zones score better
  const intlScore = zone.comp_int_pct >= 40 ? 1 : 0

  return Math.min(10, condScore + featureScore + accessScore + intlScore)
}

// ---------------------------------------------------------------------------
// Main export: computeOpportunityScore
// ---------------------------------------------------------------------------

export function computeOpportunityScore(property: PropertyInput): ScoreResult {
  // 1. Resolve zone
  const zone_key = resolvePropertyZone(property)
  const zone     = getZone(zone_key)

  // 2. Compute each dimension
  const d1 = scoreD1PriceVsZone(property, zone)

  const { score: d2, estimated_yield, yield_from_area } = scoreD2RentalYield(property, zone)

  const d3 = scoreD3Momentum(zone)
  const d4 = scoreD4DomPosition(property, zone)
  const d5 = scoreD5AssetType(property)
  const d6 = scoreD6InvestorFit(property, zone)

  const total = Math.min(100, Math.max(0, d1 + d2 + d3 + d4 + d5 + d6))

  // 3. Derived investment metrics
  const estimated_cap_rate = estimated_yield
    ? parseFloat((estimated_yield * 0.75).toFixed(2))  // ~75% of gross (expenses ~25%)
    : null

  // 4. Investor suitability: high score + verified yield
  // When yield is computed from actual area data: score ≥ 65 AND yield ≥ 4.0%
  // When yield is estimated from zone (no area_m2): require higher score ≥ 75 AND
  //   penalized zone yield ≥ 3.5% (already discounted 20% from zone.yield_bruto)
  const investor_suitable = yield_from_area
    ? total >= 65 && (estimated_yield ?? 0) >= 4.0
    : total >= 75 && (estimated_yield ?? 0) >= 3.5

  // 5. Score reason — top contributing dimension label
  const breakdown: ScoreBreakdown = {
    d1_price_vs_zone:  d1,
    d2_rental_yield:   d2,
    d3_momentum:       d3,
    d4_dom_position:   d4,
    d5_asset_type:     d5,
    d6_investor_fit:   d6,
  }

  const score_reason = buildScoreReason(total, breakdown, zone, estimated_yield)

  return {
    opportunity_score:      total,
    estimated_rental_yield: estimated_yield,
    estimated_cap_rate,
    investor_suitable,
    score_reason,
    score_breakdown:        breakdown,
    zone_key,
    zone_data:              zone,
  }
}

// ---------------------------------------------------------------------------
// Score reason builder — concise 1-line human summary
// ---------------------------------------------------------------------------

function buildScoreReason(
  score:     number,
  bd:        ScoreBreakdown,
  zone:      ZoneMarket,
  yld:       number | null,
): string {
  const tier = score >= 80 ? 'HIGH' : score >= 60 ? 'MEDIUM' : 'LOW'

  // Find top driver
  const drivers = [
    { label: 'preço abaixo da zona',    pts: bd.d1_price_vs_zone,  threshold: 18 },
    { label: `yield ${yld?.toFixed(1)}%`, pts: bd.d2_rental_yield, threshold: 12 },
    { label: `momentum ${zone.var_yoy}% YoY`, pts: bd.d3_momentum, threshold: 10 },
    { label: 'nova listagem em zona activa', pts: bd.d4_dom_position, threshold: 12 },
    { label: 'tipo de activo premium',  pts: bd.d5_asset_type,     threshold: 8  },
    { label: 'imóvel exclusivo',        pts: bd.d6_investor_fit,   threshold: 7  },
  ]

  const topDrivers = drivers
    .filter(d => d.pts >= d.threshold)
    .sort((a, b) => b.pts - a.pts)
    .slice(0, 2)
    .map(d => d.label)

  if (topDrivers.length === 0) {
    return `Score ${tier} (${score}/100) — potencial moderado em ${zone.region}`
  }

  return `Score ${tier} (${score}/100) — ${topDrivers.join(' · ')}`
}

// ---------------------------------------------------------------------------
// Batch helper: score array of properties, returns only changed ones
// ---------------------------------------------------------------------------

export interface BatchScoreResult {
  id:                     string
  opportunity_score:      number
  estimated_rental_yield: number | null
  estimated_cap_rate:     number | null
  investor_suitable:      boolean
  score_reason:           string
  score_breakdown:        ScoreBreakdown
  zone_key:               string
  changed:                boolean          // true if score differs from existing
}

export function batchScoreProperties(
  properties: (PropertyInput & { id: string })[],
): BatchScoreResult[] {
  return properties.map(p => {
    const result     = computeOpportunityScore(p)
    const prevScore  = p.opportunity_score ?? -1
    const prevYield  = p.investor_suitable ?? null

    const changed =
      result.opportunity_score !== prevScore ||
      result.investor_suitable !== prevYield

    return {
      id:                     p.id,
      opportunity_score:      result.opportunity_score,
      estimated_rental_yield: result.estimated_rental_yield,
      estimated_cap_rate:     result.estimated_cap_rate,
      investor_suitable:      result.investor_suitable,
      score_reason:           result.score_reason,
      score_breakdown:        result.score_breakdown,
      zone_key:               result.zone_key,
      changed,
    }
  })
}
