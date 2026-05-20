// AGENCY GROUP — SH-ROS | AMI: 22506
// lib/pricing-intelligence/advancedPricingIntelligence.ts
// Adds elasticity modelling, decay detection, and competitor pressure
// on top of the existing computePricingIntelligence() base card.
// PURE: no IO, no DB calls.
// =============================================================================

import type { PricingIntelligenceCard, PricingInputs } from './index'
import { computePricingIntelligence } from './index'
import { COMMISSION_RATE } from '@/lib/constants/pipeline'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ElasticityModel {
  price_elasticity: number          // % demand change per 1% price change (typically -1.2 to -3.0)
  absorption_rate: number           // % of similar listings that sell per month in zone
  market_depth: number              // estimated competing listings (from zone data)
  competitor_pressure_score: number // 0–100
}

export interface ListingDecaySignal {
  is_decaying: boolean
  days_at_current_price: number
  decay_velocity: number            // 0–1 (1 = fast decay)
  recommended_action: 'hold' | 'reduce_5pct' | 'reduce_8pct' | 'relaunch' | 'withdraw'
  action_rationale: string          // Portuguese
}

export interface PricingDecisionEngine {
  property_id: string
  base_card: PricingIntelligenceCard
  elasticity: ElasticityModel
  decay: ListingDecaySignal
  recommended_price: number
  price_range_tight: { min: number; max: number }
  expected_days_to_sale_at_recommended: number
  revenue_impact_vs_current: number   // € delta vs current price strategy
  competitor_price_pressure: 'none' | 'mild' | 'moderate' | 'severe'
  market_absorption_days: number
  urgency_sensitivity: 'low' | 'medium' | 'high' | 'extreme'
}

// ---------------------------------------------------------------------------
// Zone absorption rates — Portugal 2026
// ---------------------------------------------------------------------------

const ZONE_ABSORPTION_RATES: Record<string, number> = {
  Lisboa:  0.08,
  Cascais: 0.06,
  Algarve: 0.05,
  Porto:   0.07,
  Madeira: 0.04,
  default: 0.05,
}

// ---------------------------------------------------------------------------
// Elasticity defaults — Portugal luxury
// Elasticity = % demand change per 1% price change
// ---------------------------------------------------------------------------

function resolveElasticity(luxuryScore: number): number {
  if (luxuryScore > 80) return -1.2
  if (luxuryScore > 60) return -1.8
  if (luxuryScore > 40) return -2.4
  return -3.0
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function resolveZoneKey(city: string | null | undefined): string {
  if (!city) return 'default'
  return ZONE_ABSORPTION_RATES[city] !== undefined ? city : 'default'
}

// ---------------------------------------------------------------------------
// Public: computeElasticity
// ---------------------------------------------------------------------------

export function computeElasticity(
  city: string | null | undefined,
  luxuryScore: number,
): ElasticityModel {
  const zoneKey       = resolveZoneKey(city)
  const absorption    = ZONE_ABSORPTION_RATES[zoneKey] ?? ZONE_ABSORPTION_RATES['default']
  const elasticity    = resolveElasticity(luxuryScore)

  // Market depth: rough estimate — lower absorption → deeper inventory
  // Lisboa at 8% → ~12 competing listings baseline; Madeira at 4% → ~25
  const market_depth = Math.round(1 / absorption)

  // Competitor pressure: high absorption zones have less pressure
  const competitor_pressure_score = clamp(Math.round((1 - absorption) * 80 + (luxuryScore < 40 ? 20 : 0)), 0, 100)

  return {
    price_elasticity:          elasticity,
    absorption_rate:           absorption,
    market_depth,
    competitor_pressure_score,
  }
}

// ---------------------------------------------------------------------------
// Public: detectListingDecay
// ---------------------------------------------------------------------------

export function detectListingDecay(
  daysOnMarket: number,
  pricingRisk: string,
  city?: string | null,
): ListingDecaySignal {
  const isOverpriced = pricingRisk === 'overpriced'
  const dom          = daysOnMarket

  // decay_velocity: linear 0–1 mapped from 0–365 days
  const decay_velocity = clamp(dom / 365, 0, 1)

  if (dom > 240) {
    return {
      is_decaying:            true,
      days_at_current_price:  dom,
      decay_velocity,
      recommended_action:     'relaunch',
      action_rationale:       'Imóvel há mais de 240 dias no mercado — relançamento com nova estratégia de preço e marketing é essencial para recuperar visibilidade.',
    }
  }

  if (dom > 180) {
    return {
      is_decaying:            true,
      days_at_current_price:  dom,
      decay_velocity,
      recommended_action:     'reduce_8pct',
      action_rationale:       'Tempo de mercado elevado compromete percepção de valor — redução de 8% posiciona o imóvel como oportunidade competitiva.',
    }
  }

  if (dom > 120 && isOverpriced) {
    return {
      is_decaying:            true,
      days_at_current_price:  dom,
      decay_velocity,
      recommended_action:     'reduce_5pct',
      action_rationale:       'Imóvel acima do valor de mercado com mais de 120 dias activo — redução de 5% estimula novos inquéritos e visitas.',
    }
  }

  if (dom > 90 && isOverpriced) {
    return {
      is_decaying:            true,
      days_at_current_price:  dom,
      decay_velocity:         clamp(decay_velocity, 0, 0.5),
      recommended_action:     'hold',
      action_rationale:       'Sinal de decay incipiente — monitorizar inquéritos nas próximas 2 semanas antes de ajustar preço.',
    }
  }

  return {
    is_decaying:            false,
    days_at_current_price:  dom,
    decay_velocity:         clamp(decay_velocity, 0, 0.25),
    recommended_action:     'hold',
    action_rationale:       'Imóvel dentro do prazo normal de mercado — manter estratégia actual e focar em qualidade de exposição.',
  }
}

// ---------------------------------------------------------------------------
// Internal helpers for PricingDecisionEngine
// ---------------------------------------------------------------------------

function resolveCompetitorPressure(score: number): PricingDecisionEngine['competitor_price_pressure'] {
  if (score >= 75) return 'severe'
  if (score >= 50) return 'moderate'
  if (score >= 25) return 'mild'
  return 'none'
}

function resolveUrgencySensitivity(
  decay: ListingDecaySignal,
  elasticity: ElasticityModel,
): PricingDecisionEngine['urgency_sensitivity'] {
  if (decay.recommended_action === 'relaunch' || decay.recommended_action === 'reduce_8pct') return 'extreme'
  if (decay.is_decaying || elasticity.competitor_pressure_score >= 60) return 'high'
  if (decay.days_at_current_price > 60 || elasticity.competitor_pressure_score >= 35) return 'medium'
  return 'low'
}

function computeRecommendedPrice(
  baseCard: PricingIntelligenceCard,
  decay: ListingDecaySignal,
  listingPrice: number | null | undefined,
): number {
  const currentPrice = listingPrice && listingPrice > 0 ? listingPrice : baseCard.avm_base

  switch (decay.recommended_action) {
    case 'reduce_8pct': return Math.round(currentPrice * 0.92)
    case 'reduce_5pct': return Math.round(currentPrice * 0.95)
    case 'relaunch':    return Math.round(baseCard.avm_base)  // reset to AVM base on relaunch
    default:            return Math.round(baseCard.optimal_price_min)
  }
}

function computeExpectedDaysToSale(
  elasticity: ElasticityModel,
  decay: ListingDecaySignal,
  baseCard: PricingIntelligenceCard,
): number {
  const baseDays = baseCard.estimated_days_on_market
  // Applying recommended price reduces deviation → improvement proportional to absorption rate
  const absorptionBoost = elasticity.absorption_rate * 100  // e.g. 8% → ÷ 0.92
  const decayPenalty    = decay.is_decaying ? 1.2 : 1.0
  return Math.round((baseDays / (1 + absorptionBoost / 100)) * decayPenalty)
}

function computeRevenueImpact(
  recommendedPrice: number,
  listingPrice: number | null | undefined,
  pCloseBase: number = 0.07, // conservative Portugal 2026 average
): number {
  const current = listingPrice && listingPrice > 0 ? listingPrice : recommendedPrice
  const deltaPrice  = recommendedPrice - current
  const commissionImpact = deltaPrice * COMMISSION_RATE
  // Expected impact = commission delta × probability of close
  return Math.round(commissionImpact * pCloseBase)
}

// ---------------------------------------------------------------------------
// Public: buildPricingDecisionEngine
// ---------------------------------------------------------------------------

export function buildPricingDecisionEngine(
  inputs: PricingInputs,
  baseCard: PricingIntelligenceCard,
  daysOnMarket?: number,
): PricingDecisionEngine {
  const dom         = daysOnMarket ?? inputs.days_on_market ?? 0
  const luxuryScore = inputs.luxury_score ?? 50
  const city        = inputs.city ?? null

  // Property ID: derive from listing_price + city + area for traceability
  const property_id = [
    city ?? 'unknown',
    String(inputs.listing_price ?? 0),
    String(inputs.area_sqm ?? 0),
  ].join('-')

  const elasticity = computeElasticity(city, luxuryScore)
  const decay      = detectListingDecay(dom, baseCard.pricing_risk, city)

  const recommended_price = computeRecommendedPrice(baseCard, decay, inputs.listing_price)

  // Tight price range: ±3% around recommended
  const price_range_tight = {
    min: Math.round(recommended_price * 0.97),
    max: Math.round(recommended_price * 1.03),
  }

  const expected_days_to_sale_at_recommended = computeExpectedDaysToSale(elasticity, decay, baseCard)
  const revenue_impact_vs_current            = computeRevenueImpact(recommended_price, inputs.listing_price)

  // Market absorption days: 1 / monthly_absorption_rate converted to days
  const market_absorption_days = Math.round(30 / elasticity.absorption_rate)

  const competitor_price_pressure = resolveCompetitorPressure(elasticity.competitor_pressure_score)
  const urgency_sensitivity       = resolveUrgencySensitivity(decay, elasticity)

  return {
    property_id,
    base_card:                            baseCard,
    elasticity,
    decay,
    recommended_price,
    price_range_tight,
    expected_days_to_sale_at_recommended,
    revenue_impact_vs_current,
    competitor_price_pressure,
    market_absorption_days,
    urgency_sensitivity,
  }
}

// ---------------------------------------------------------------------------
// Namespace export
// ---------------------------------------------------------------------------

export const advancedPricingIntelligence = {
  computeElasticity,
  detectListingDecay,
  buildPricingDecisionEngine,
} as const
