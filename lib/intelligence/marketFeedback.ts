// =============================================================================
// Agency Group — Market Feedback Engine
// lib/intelligence/marketFeedback.ts
//
// Phase 5: Market Feedback Ingestion & Signal Classification
//
// Ingests external market signals and classifies their impact on
// platform routing, scoring, and distribution strategy.
//
// SIGNALS:
//   - Absorption rate (sold/listed per period)
//   - Listing velocity (speed of new inventory)
//   - Competitor pricing pressure
//   - Demand/supply ratio shifts
//
// PURE FUNCTIONS:
//   computeAbsorptionRate, computeListingVelocityChange,
//   classifyMarketPressure, computeMarketHealthScore,
//   buildMarketFeedbackSignal, computePricingPressureIndex
// =============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MarketPressure = 'strong_seller' | 'seller' | 'neutral' | 'buyer' | 'strong_buyer'

export type MarketRegime = 'hot' | 'warm' | 'neutral' | 'cooling' | 'cold'

export interface MarketFeedbackSignal {
  zone_key:             string
  asset_class:          string
  period_label:         string
  absorption_rate:      number        // 0-100 (sold / listed × 100)
  listing_velocity_chg: number        // % change in new listings vs prior
  price_delta_pct:      number        // asking price change vs prior period
  demand_supply_ratio:  number        // > 1 = more buyers than sellers
  market_pressure:      MarketPressure
  market_regime:        MarketRegime
  market_health_score:  number        // 0-100
  pricing_pressure_idx: number        // 0-100 (100 = extreme upward pressure)
  computed_at:          string
}

export interface CompetitorPricingInput {
  own_avg_asking_price:       number
  competitor_avg_asking_price: number
  market_median_price:        number
}

// ---------------------------------------------------------------------------
// PURE: Compute absorption rate (0-100)
// absorption = sold / listed per period
// 100 = everything listed sold; 0 = nothing sold
// ---------------------------------------------------------------------------

export function computeAbsorptionRate(
  newListings: number,
  soldListings: number,
): number {
  if (newListings === 0) return 0
  const rate = Math.min(1, soldListings / newListings)
  return Math.round(rate * 100)
}

// ---------------------------------------------------------------------------
// PURE: Compute listing velocity change (%)
// Positive = more listings (supply increase); negative = fewer (supply contraction)
// ---------------------------------------------------------------------------

export function computeListingVelocityChange(
  currentListings: number,
  priorListings:   number,
): number {
  if (priorListings === 0) return 0
  return Math.round((currentListings - priorListings) / priorListings * 100 * 100) / 100
}

// ---------------------------------------------------------------------------
// PURE: Classify market pressure from absorption + velocity + price delta
// ---------------------------------------------------------------------------

export function classifyMarketPressure(
  absorptionRate:      number,     // 0-100
  listingVelocityChg:  number,     // % change (negative = shrinking supply)
  priceDeltaPct:       number,     // price change (positive = rising)
): MarketPressure {
  // Strong seller: high absorption + shrinking supply + rising prices
  if (absorptionRate >= 70 && listingVelocityChg <= -10 && priceDeltaPct >= 5) {
    return 'strong_seller'
  }
  // Seller market
  if (absorptionRate >= 55 && priceDeltaPct >= 2) {
    return 'seller'
  }
  // Strong buyer: low absorption + growing supply + falling prices
  if (absorptionRate <= 25 && listingVelocityChg >= 15 && priceDeltaPct <= -5) {
    return 'strong_buyer'
  }
  // Buyer market
  if (absorptionRate <= 35 && priceDeltaPct <= -2) {
    return 'buyer'
  }
  return 'neutral'
}

// ---------------------------------------------------------------------------
// PURE: Compute market health score (0-100)
// Combines absorption, velocity stability, and price momentum
// ---------------------------------------------------------------------------

export function computeMarketHealthScore(
  absorptionRate:     number,     // 0-100
  priceGrowthPct:     number,     // price delta year-over-year or period
  supplyBalance:      number,     // 0-2+ (1 = balanced; <1 = undersupply; >1 = oversupply)
): number {
  // Absorption: healthy = 40-80%
  let absorptionScore: number
  if (absorptionRate >= 40 && absorptionRate <= 80) absorptionScore = 100
  else if (absorptionRate > 80) absorptionScore = 80      // overheated
  else if (absorptionRate >= 25) absorptionScore = 60
  else absorptionScore = 30

  // Price growth: healthy = 2-12% annualized
  let priceScore: number
  if (priceGrowthPct >= 2 && priceGrowthPct <= 12) priceScore = 100
  else if (priceGrowthPct > 12) priceScore = 70            // bubble risk
  else if (priceGrowthPct > 0)  priceScore = 80
  else if (priceGrowthPct > -5) priceScore = 55
  else priceScore = 25

  // Supply balance: healthy = 0.8-1.2
  let supplyScore: number
  if (supplyBalance >= 0.8 && supplyBalance <= 1.2) supplyScore = 100
  else if (supplyBalance > 1.2 && supplyBalance <= 1.8) supplyScore = 70   // mild oversupply
  else if (supplyBalance < 0.8) supplyScore = 75                            // mild undersupply
  else supplyScore = 40

  return Math.round(absorptionScore * 0.40 + priceScore * 0.35 + supplyScore * 0.25)
}

// ---------------------------------------------------------------------------
// PURE: Classify market regime from health score
// ---------------------------------------------------------------------------

export function classifyMarketRegime(healthScore: number): MarketRegime {
  if (healthScore >= 80) return 'hot'
  if (healthScore >= 65) return 'warm'
  if (healthScore >= 45) return 'neutral'
  if (healthScore >= 30) return 'cooling'
  return 'cold'
}

// ---------------------------------------------------------------------------
// PURE: Compute pricing pressure index (0-100)
// 100 = maximum upward pricing pressure; 0 = maximum downward
// ---------------------------------------------------------------------------

export function computePricingPressureIndex(input: CompetitorPricingInput): number {
  if (input.market_median_price === 0) return 50

  // How far are competitors from market median?
  const competitorRelative =
    (input.competitor_avg_asking_price - input.market_median_price) / input.market_median_price

  // How far is own pricing from median?
  const ownRelative =
    (input.own_avg_asking_price - input.market_median_price) / input.market_median_price

  // Pressure = how much above market median competitors are pricing
  // + own under-pricing discount
  const pressure = (competitorRelative + ownRelative) / 2 * 100 + 50
  return Math.round(Math.max(0, Math.min(100, pressure)))
}

// ---------------------------------------------------------------------------
// PURE: Build full market feedback signal
// ---------------------------------------------------------------------------

export function buildMarketFeedbackSignal(
  zoneKey:       string,
  assetClass:    string,
  periodLabel:   string,
  params: {
    new_listings:           number
    sold_listings:          number
    prior_new_listings:     number
    price_delta_pct:        number
    price_growth_yoy_pct:   number
    supply_balance:         number
    competitor_pricing?:    CompetitorPricingInput
  },
): MarketFeedbackSignal {
  const absorption   = computeAbsorptionRate(params.new_listings, params.sold_listings)
  const velocityChg  = computeListingVelocityChange(params.new_listings, params.prior_new_listings)
  const dsr          = params.prior_new_listings > 0
    ? params.new_listings > 0
      ? params.sold_listings / params.new_listings
      : 0
    : 1.0
  const pressure     = classifyMarketPressure(absorption, velocityChg, params.price_delta_pct)
  const healthScore  = computeMarketHealthScore(absorption, params.price_growth_yoy_pct, params.supply_balance)
  const regime       = classifyMarketRegime(healthScore)
  const ppi          = params.competitor_pricing
    ? computePricingPressureIndex(params.competitor_pricing)
    : 50

  return {
    zone_key:             zoneKey,
    asset_class:          assetClass,
    period_label:         periodLabel,
    absorption_rate:      absorption,
    listing_velocity_chg: velocityChg,
    price_delta_pct:      params.price_delta_pct,
    demand_supply_ratio:  Math.round(dsr * 100) / 100,
    market_pressure:      pressure,
    market_regime:        regime,
    market_health_score:  healthScore,
    pricing_pressure_idx: ppi,
    computed_at:          new Date().toISOString(),
  }
}
