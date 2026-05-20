// =============================================================================
// Agency Group — Yield Predictor (Heuristic Baseline)
// lib/ml/models/yieldPredictor.ts
//
// Estimates gross rental yield from property features.
// Calibrated to Portuguese real estate market 2026.
// Heuristic ensemble — pluggable interface for trained XGBoost/LightGBM models.
// TypeScript strict — 0 errors
// =============================================================================

import type { PropertyFeatures } from '../featureExtractor'

// ---------------------------------------------------------------------------
// Output type
// ---------------------------------------------------------------------------

export interface YieldPrediction {
  /** Estimated gross yield in % (e.g. 5.5 = 5.5%) */
  estimated_yield_pct: number
  /** Model confidence score 0–1 */
  confidence: number
  /** Human-readable basis for the estimate */
  basis: string
  /** Yield tier classification */
  tier: 'low' | 'market' | 'high' | 'premium'
}

// ---------------------------------------------------------------------------
// Market calibration constants (Portugal 2026)
// ---------------------------------------------------------------------------

/** Base yield by geo_tier (gross, before costs) */
const GEO_TIER_BASE: Record<string, number> = {
  prime:     4.0,
  secondary: 5.5,
  emerging:  6.5,
}
const GEO_TIER_UNKNOWN_BASE = 5.0

/** Adjustment by investment_tier */
const INVESTMENT_TIER_ADJ: Record<string, number> = {
  luxury:  -1.0,
  premium: -0.5,
  mid:      0.0,
  entry:   +0.5,
}

/** Gross yield tier boundaries */
const TIER_THRESHOLDS = {
  low:     3.5,  // < 3.5% = low
  market:  5.0,  // 3.5–5.0% = market
  high:    7.0,  // 5.0–7.0% = high
  // > 7.0% = premium
} as const

/** Price per m² threshold for ultra-prime penalty */
const ULTRA_PRIME_PRICE_M2 = 6_000

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function classifyYieldTier(yieldPct: number): 'low' | 'market' | 'high' | 'premium' {
  if (yieldPct < TIER_THRESHOLDS.low)    return 'low'
  if (yieldPct < TIER_THRESHOLDS.market) return 'market'
  if (yieldPct < TIER_THRESHOLDS.high)   return 'high'
  return 'premium'
}

function roundToTwo(n: number): number {
  return Math.round(n * 100) / 100
}

// ---------------------------------------------------------------------------
// predictYield — main export
// ---------------------------------------------------------------------------

export function predictYield(features: PropertyFeatures): YieldPrediction {
  const basisParts: string[] = []

  // 1. Base yield from geo_tier
  const baseYield = features.geo_tier !== null
    ? (GEO_TIER_BASE[features.geo_tier] ?? GEO_TIER_UNKNOWN_BASE)
    : GEO_TIER_UNKNOWN_BASE

  basisParts.push(`geo_tier=${features.geo_tier ?? 'unknown'} → base ${baseYield}%`)

  // 2. Investment tier adjustment
  let tierAdj = 0
  if (features.investment_tier !== null) {
    tierAdj = INVESTMENT_TIER_ADJ[features.investment_tier] ?? 0
    if (tierAdj !== 0) {
      basisParts.push(`investment_tier=${features.investment_tier} adj ${tierAdj > 0 ? '+' : ''}${tierAdj}%`)
    }
  }

  // 3. Property type adjustment
  let typeAdj = 0
  if (features.property_type !== null) {
    const t = features.property_type.toLowerCase()
    if (t.includes('comercial') || t.includes('loja') || t.includes('escritório') || t.includes('escritorio')) {
      typeAdj = 1.5
      basisParts.push(`tipo=comercial/loja/escritório adj +1.5%`)
    } else if (t.includes('moradia') || t.includes('villa') || t.includes('house')) {
      typeAdj = 0.5
      basisParts.push(`tipo=moradia adj +0.5%`)
    }
  }

  // 4. Ultra-prime price_per_m2 penalty
  let priceAdj = 0
  if (features.price_per_m2 !== null && features.price_per_m2 > ULTRA_PRIME_PRICE_M2) {
    priceAdj = -0.5
    basisParts.push(`preco_m2=${features.price_per_m2} > ${ULTRA_PRIME_PRICE_M2} ultra-prime adj -0.5%`)
  }

  const estimatedYield = roundToTwo(baseYield + tierAdj + typeAdj + priceAdj)

  // 5. Confidence: based on feature completeness
  const nullCount = [
    features.geo_tier,
    features.investment_tier,
    features.property_type,
    features.price_per_m2,
    features.area_m2,
  ].filter(v => v === null).length

  const confidence =
    nullCount === 0 ? 0.70 :
    nullCount <= 2  ? 0.50 :
    0.30

  return {
    estimated_yield_pct: estimatedYield,
    confidence,
    basis: basisParts.join('; '),
    tier: classifyYieldTier(estimatedYield),
  }
}
