// AGENCY GROUP — SH-ROS Property AI | AMI: 22506

import { logger } from '@/lib/observability/logger'
import type { PropertyAnalysis, ZoneClassification } from '@/lib/property-ai/types'

const PORTUGAL_COMMISSION = 0.05
const ZONE_PRICE_MAP: Record<string, number> = {
  Lisboa: 5000,
  Cascais: 4713,
  Algarve: 3941,
  Porto: 3643,
  Madeira: 3760,
  'Açores': 1952,
  default: 3076,
}

export type PricingRecommendation =
  | 'price_below_market'
  | 'at_market'
  | 'above_market'
  | 'premium_justified'

export interface PricingAnalysis {
  estimated_price_eur: number
  price_per_sqm: number
  market_price_per_sqm: number
  competitiveness: number
  pricing_recommendation: PricingRecommendation
  liquidity_speed_days: number
  commission_estimate_eur: number
}

const LUXURY_MULTIPLIER: Record<ZoneClassification, number> = {
  'ultra-luxury': 1.4,
  'luxury': 1.2,
  'premium': 1.05,
  'mid-range': 1.0,
  'affordable': 0.9,
}

const LIQUIDITY_DAYS: Record<PricingRecommendation, number> = {
  at_market: 180,
  price_below_market: 90,
  above_market: 300,
  premium_justified: 240,
}

class PricingCompetitivenessAnalyzer {
  analyze(analysis: PropertyAnalysis, listingPriceEur?: number): PricingAnalysis {
    const zone = analysis.location?.zone ?? 'default'
    const market_price_per_sqm = ZONE_PRICE_MAP[zone] ?? ZONE_PRICE_MAP['default']
    const area = analysis.area_sqm ?? 100
    const zoneClass = analysis.location?.zone_classification ?? 'mid-range'
    const multiplier = LUXURY_MULTIPLIER[zoneClass]

    const estimated_price_eur =
      listingPriceEur ?? market_price_per_sqm * area * multiplier

    const price_per_sqm = estimated_price_eur / area

    const rawCompetitiveness =
      1 - (price_per_sqm - market_price_per_sqm) / market_price_per_sqm
    const competitiveness = Math.max(0, Math.min(1, rawCompetitiveness))

    let pricing_recommendation: PricingRecommendation
    if (zoneClass === 'ultra-luxury' || zoneClass === 'luxury') {
      pricing_recommendation =
        price_per_sqm > market_price_per_sqm * 1.2
          ? 'premium_justified'
          : 'above_market'
    } else if (price_per_sqm < market_price_per_sqm * 0.95) {
      pricing_recommendation = 'price_below_market'
    } else if (price_per_sqm <= market_price_per_sqm * 1.05) {
      pricing_recommendation = 'at_market'
    } else {
      pricing_recommendation = 'above_market'
    }

    const liquidity_speed_days = LIQUIDITY_DAYS[pricing_recommendation]
    const commission_estimate_eur = estimated_price_eur * PORTUGAL_COMMISSION

    logger.info('[PricingCompetitivenessAnalyzer] analyzed', {
      submission_id: analysis.submission_id,
      estimated_price_eur,
      pricing_recommendation,
    })

    return {
      estimated_price_eur,
      price_per_sqm,
      market_price_per_sqm,
      competitiveness,
      pricing_recommendation,
      liquidity_speed_days,
      commission_estimate_eur,
    }
  }
}

export const pricingCompetitivenessAnalyzer = new PricingCompetitivenessAnalyzer()
