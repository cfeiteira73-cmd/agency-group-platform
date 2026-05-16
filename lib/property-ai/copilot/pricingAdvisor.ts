// AGENCY GROUP — SH-ROS Property AI | AMI: 22506

import { logger } from '@/lib/observability/logger'
import type { PropertyAnalysis, ZoneClassification } from '@/lib/property-ai/types'

const PORTUGAL_COMMISSION = 0.05
const PORTUGAL_AVG_DAYS = 210

const ZONE_PRICE_MAP: Record<string, number> = {
  Lisboa: 5000,
  Cascais: 4713,
  Algarve: 3941,
  Porto: 3643,
  Madeira: 3760,
  'Açores': 1952,
  default: 3076,
}

const LUXURY_MULTIPLIER: Record<ZoneClassification, number> = {
  'ultra-luxury': 1.4,
  'luxury': 1.2,
  'premium': 1.05,
  'mid-range': 1.0,
  'affordable': 0.9,
}

const CONDITION_ADJUSTMENT: Record<string, number> = {
  new: 1.1,
  excellent: 1.05,
  good: 1.0,
  needs_renovation: 0.85,
  unknown: 1.0,
}

export type PricingStrategy = 'aggressive' | 'market_rate' | 'premium' | 'luxury_positioning'

export interface PricingAdvice {
  recommended_price_eur: number
  price_range: { min: number; max: number }
  strategy: PricingStrategy
  rationale: string
  days_to_close_estimate: number
  expected_commission_eur: number
  price_per_sqm: number
  market_comparison: string
}

class PricingAdvisor {
  advise(analysis: PropertyAnalysis, agentPriceEur?: number): PricingAdvice {
    const zone = analysis.location?.zone ?? 'default'
    const city = analysis.location?.city ?? zone
    const zoneClass = analysis.location?.zone_classification ?? 'mid-range'
    const market_price_per_sqm = ZONE_PRICE_MAP[zone] ?? ZONE_PRICE_MAP[city] ?? ZONE_PRICE_MAP['default']
    const area = analysis.area_sqm ?? 100
    const multiplier = LUXURY_MULTIPLIER[zoneClass]
    const conditionAdj = CONDITION_ADJUSTMENT[analysis.condition] ?? 1.0

    const base_price = market_price_per_sqm * area * multiplier * conditionAdj

    const recommended_price_eur = agentPriceEur ?? base_price
    const price_per_sqm = recommended_price_eur / area

    // Strategy selection
    let strategy: PricingStrategy
    let days_to_close_estimate: number
    if (zoneClass === 'ultra-luxury') {
      strategy = 'luxury_positioning'
      days_to_close_estimate = 300
    } else if (zoneClass === 'luxury') {
      strategy = 'premium'
      days_to_close_estimate = 240
    } else if (recommended_price_eur < base_price * 0.95) {
      strategy = 'aggressive'
      days_to_close_estimate = 90
    } else {
      strategy = 'market_rate'
      days_to_close_estimate = PORTUGAL_AVG_DAYS
    }

    const deviation = ((price_per_sqm - market_price_per_sqm) / market_price_per_sqm) * 100
    const comparisonZone = city !== 'default' ? city : 'Portugal'
    const market_comparison =
      deviation >= 0
        ? `${deviation.toFixed(1)}% above ${comparisonZone} average (€${market_price_per_sqm}/m²)`
        : `${Math.abs(deviation).toFixed(1)}% below ${comparisonZone} average (€${market_price_per_sqm}/m²)`

    const rationale = `Based on ${comparisonZone} zone pricing (€${market_price_per_sqm}/m²), ${zoneClass} classification and ${analysis.condition} condition. ${strategy === 'aggressive' ? 'Priced below market to accelerate sale.' : strategy === 'luxury_positioning' ? 'Premium positioning to attract HNWI and institutional buyers.' : 'Balanced pricing for optimal market exposure.'}`

    const price_range = {
      min: Math.round(recommended_price_eur * 0.92),
      max: Math.round(recommended_price_eur * 1.08),
    }

    const expected_commission_eur = recommended_price_eur * PORTUGAL_COMMISSION

    logger.info('[PricingAdvisor] advised', {
      submission_id: analysis.submission_id,
      recommended_price_eur,
      strategy,
    })

    return {
      recommended_price_eur: Math.round(recommended_price_eur),
      price_range,
      strategy,
      rationale,
      days_to_close_estimate,
      expected_commission_eur: Math.round(expected_commission_eur),
      price_per_sqm: Math.round(price_per_sqm),
      market_comparison,
    }
  }
}

export const pricingAdvisor = new PricingAdvisor()
