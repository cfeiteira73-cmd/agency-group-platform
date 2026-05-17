// AGENCY GROUP — SH-ROS | Pricing Intelligence Engine | AMI: 22506
// Portugal 2026: €3.076/m² median · 210 days avg · top 5 luxury globally
// =============================================================================
// Wraps the existing AVM + signalDetector into a unified Pricing Intelligence
// Card shown on the property detail page and agent dashboard.
// PURE: no DB writes here — caller persists to Supabase if needed.
// =============================================================================

import { computeAVM, type AVMInput, type AVMResult } from '@/lib/valuation/avm'
import { getZone, resolvePropertyZone } from '@/lib/market/zones'
import { detectSignals, type SignalPropertyInput } from '@/lib/scoring/signalDetector'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PricingRisk = 'overpriced' | 'underpriced' | 'optimal' | 'unknown'
export type DemandLevel = 'hot' | 'strong' | 'moderate' | 'slow' | 'unknown'

export interface PricingIntelligenceCard {
  // ── AVM / Price ────────────────────────────────────────────────────────────
  avm_low: number
  avm_base: number
  avm_high: number
  avm_confidence: number     // 0–1
  optimal_price_min: number
  optimal_price_max: number

  // ── Risk ───────────────────────────────────────────────────────────────────
  pricing_risk: PricingRisk
  overpricing_probability: number   // 0–100
  underpricing_probability: number  // 0–100
  negotiation_probability: number   // 0–100

  // ── Demand ─────────────────────────────────────────────────────────────────
  demand_level: DemandLevel
  estimated_days_on_market: number
  inquiry_rate_estimate: number     // inquiries / week estimate
  conversion_probability: number    // 0–100

  // ── Opportunity ─────────────────────────────────────────────────────────────
  luxury_premium_potential: number  // additional € that premium marketing unlocks
  price_confidence_label: string    // human readable
  recommendation: string            // plain business language
  signals: ReturnType<typeof detectSignals>

  // ── Metadata ───────────────────────────────────────────────────────────────
  computed_at: Date
  confidence: number  // overall confidence 0–100
}

export interface PricingInputs {
  listing_price?: number | null
  area_sqm?: number | null
  bedrooms?: number | null
  city?: string | null
  zone?: string | null
  condition?: string | null
  luxury_score?: number | null
  has_pool?: boolean
  has_sea_view?: boolean
  demand_score?: number | null
  days_on_market?: number | null
  price_previous?: number | null
}

// ---------------------------------------------------------------------------
// Constants — Portugal 2026
// ---------------------------------------------------------------------------

const ZONE_MEDIAN_DAYS: Record<string, number> = {
  Lisboa: 180,
  Cascais: 160,
  Algarve: 200,
  Porto: 190,
  Madeira: 220,
  default: 210,
}

const LUXURY_PREMIUM_RATES: Record<string, number> = {
  Lisboa: 0.12,
  Cascais: 0.10,
  Algarve: 0.08,
  Madeira: 0.07,
  default: 0.06,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function classifyRisk(
  listing_price: number | null | undefined,
  avm_base: number,
  overpricing_prob: number,
  underpricing_prob: number,
): PricingRisk {
  if (!listing_price || listing_price <= 0) return 'unknown'
  if (overpricing_prob > 60) return 'overpriced'
  if (underpricing_prob > 60) return 'underpriced'
  return 'optimal'
}

function estimateDaysOnMarket(
  demand_score: number | null | undefined,
  city: string | null | undefined,
  pricing_risk: PricingRisk,
): number {
  const zoneKey = city ?? 'default'
  const baseDays = ZONE_MEDIAN_DAYS[zoneKey] ?? ZONE_MEDIAN_DAYS['default']
  const demandFactor = demand_score ? (1 - (demand_score / 100) * 0.5) : 1
  const priceFactor = pricing_risk === 'overpriced' ? 1.6 : pricing_risk === 'underpriced' ? 0.7 : 1
  return Math.round(baseDays * demandFactor * priceFactor)
}

function estimateInquiryRate(demand_score: number | null | undefined, pricing_risk: PricingRisk): number {
  const base = demand_score ? demand_score / 100 * 3.5 : 1.2
  const factor = pricing_risk === 'optimal' ? 1.2 : pricing_risk === 'underpriced' ? 1.5 : 0.7
  return Math.round(base * factor * 10) / 10 // inquiries/week
}

function buildRecommendation(
  pricing_risk: PricingRisk,
  days: number,
  luxury_premium: number,
  city: string | null | undefined,
): string {
  const zone = city ?? 'Portugal'
  if (pricing_risk === 'overpriced') {
    return `Imóvel possivelmente acima do valor de mercado. Redução de preço de 5–8% pode reduzir o tempo de venda em ~${Math.round(days * 0.4)} dias e aumentar a taxa de inquéritos significativamente.`
  }
  if (pricing_risk === 'underpriced') {
    return `Imóvel com potencial de valorização. Aumento de preço de 3–6% mantém-se dentro do intervalo de mercado e melhora a margem de comissão sem impacto significativo na velocidade de venda em ${zone}.`
  }
  if (luxury_premium > 30_000) {
    return `Preço óptimo de mercado. Marketing premium pode desbloquear um adicional de €${(luxury_premium / 1000).toFixed(0)}K através de exposição a compradores internacionais de luxo.`
  }
  return `Preço alinhado com o mercado de ${zone}. Foco em qualidade de fotos e distribuição multi-canal para maximizar a velocidade de venda.`
}

// ---------------------------------------------------------------------------
// Main compute function
// ---------------------------------------------------------------------------

export function computePricingIntelligence(inputs: PricingInputs): PricingIntelligenceCard {
  const now = new Date()
  const city = inputs.city ?? null

  // ── AVM ──────────────────────────────────────────────────────────────────
  const avmInput: AVMInput = {
    price: inputs.listing_price ?? null,
    area_m2: inputs.area_sqm ?? null,
    bedrooms: inputs.bedrooms ?? null,
    condition: inputs.condition ?? 'good',
    zone: inputs.zone ?? inputs.city ?? null,
    city: inputs.city ?? null,
  }

  const zone_key = resolvePropertyZone({
    zone: inputs.zone ?? null,
    city: inputs.city ?? null,
  })
  const zone = getZone(zone_key)
  const avmResult: AVMResult = computeAVM(avmInput, zone, zone_key, [])

  // ── Optimal range: AVM base ± 5% adjusted for luxury score ───────────────
  const luxuryAdj = inputs.luxury_score ? (inputs.luxury_score - 50) / 100 * 0.08 : 0
  const optimal_min = Math.round(avmResult.value_low * (1 + luxuryAdj))
  const optimal_max = Math.round(avmResult.value_high * (1 + luxuryAdj) * 1.05)

  // ── Overpricing / underpricing probabilities ──────────────────────────────
  const listing = inputs.listing_price ?? 0
  let overpricing_probability = 0
  let underpricing_probability = 0

  if (listing > 0 && avmResult.value_base > 0) {
    const deviation = (listing - avmResult.value_base) / avmResult.value_base
    if (deviation > 0.08) {
      overpricing_probability = Math.min(95, Math.round(deviation * 300))
    } else if (deviation < -0.08) {
      underpricing_probability = Math.min(95, Math.round(Math.abs(deviation) * 300))
    }
  }

  // ── Pricing risk ──────────────────────────────────────────────────────────
  const pricing_risk = classifyRisk(listing, avmResult.value_base, overpricing_probability, underpricing_probability)

  // ── Demand ────────────────────────────────────────────────────────────────
  const ds = inputs.demand_score
  const demand_level: DemandLevel =
    ds === null || ds === undefined ? 'unknown'
    : ds >= 75 ? 'hot'
    : ds >= 55 ? 'strong'
    : ds >= 35 ? 'moderate'
    : 'slow'

  const estimated_days = estimateDaysOnMarket(ds, city, pricing_risk)
  const inquiry_rate = estimateInquiryRate(ds, pricing_risk)
  const conversion_probability = Math.min(100, Math.round(
    (ds ?? 50) * 0.4 +
    (pricing_risk === 'optimal' ? 20 : pricing_risk === 'underpriced' ? 25 : 5) +
    (inputs.has_sea_view ? 8 : 0) +
    (inputs.has_pool ? 5 : 0)
  ))
  const negotiation_probability = Math.min(85, Math.round(overpricing_probability * 0.7 + 20))

  // ── Luxury premium ────────────────────────────────────────────────────────
  const premiumRate = LUXURY_PREMIUM_RATES[city ?? 'default'] ?? LUXURY_PREMIUM_RATES['default']
  const luxScore = inputs.luxury_score ?? 50
  const luxury_premium_potential = listing > 0 && luxScore > 60
    ? Math.round(listing * premiumRate * (luxScore / 100))
    : 0

  // ── Signals ───────────────────────────────────────────────────────────────
  const sigInput: SignalPropertyInput = {
    price: listing || avmResult.value_base,
    price_previous: inputs.price_previous ?? null,
    avm_estimate: avmResult.value_base,
    area_m2: inputs.area_sqm ?? null,
    zone: inputs.zone ?? null,
    city: inputs.city ?? null,
    days_on_market: inputs.days_on_market ?? null,
    status: 'live',
  }
  const signals = detectSignals(sigInput)

  // ── Confidence ────────────────────────────────────────────────────────────
  const confidence = Math.round(
    avmResult.confidence * 40 +
    (listing > 0 ? 20 : 0) +
    (inputs.area_sqm ? 15 : 0) +
    (inputs.city ? 15 : 0) +
    (inputs.bedrooms ? 10 : 0)
  )

  // ── Price label ───────────────────────────────────────────────────────────
  const price_confidence_label =
    avmResult.confidence > 0.75 ? 'Alta confiança'
    : avmResult.confidence > 0.5 ? 'Confiança moderada'
    : 'Estimativa indicativa'

  const recommendation = buildRecommendation(pricing_risk, estimated_days, luxury_premium_potential, city)

  return {
    avm_low: avmResult.value_low,
    avm_base: avmResult.value_base,
    avm_high: avmResult.value_high,
    avm_confidence: avmResult.confidence,
    optimal_price_min: optimal_min,
    optimal_price_max: optimal_max,
    pricing_risk,
    overpricing_probability,
    underpricing_probability,
    negotiation_probability,
    demand_level,
    estimated_days_on_market: estimated_days,
    inquiry_rate_estimate: inquiry_rate,
    conversion_probability,
    luxury_premium_potential,
    price_confidence_label,
    recommendation,
    signals,
    computed_at: now,
    confidence,
  }
}
