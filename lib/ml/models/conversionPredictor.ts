// =============================================================================
// Agency Group — Conversion Probability Predictor (Heuristic Baseline)
// lib/ml/models/conversionPredictor.ts
//
// Estimates the probability that a given investor–property match converts to
// a closed deal. Calibrated against Agency Group pipeline data 2026.
// Heuristic ensemble — pluggable interface for trained models.
// TypeScript strict — 0 errors
// =============================================================================

import type { PropertyFeatures } from '../featureExtractor'
import type { InvestorFeatures } from '../featureExtractor'

// ---------------------------------------------------------------------------
// Output type
// ---------------------------------------------------------------------------

export interface ConversionPrediction {
  /** Probability 0–1 that this match converts to a deal */
  probability: number
  /** Normalised score 0–100 */
  score: number
  /** Human-readable positive factors that contributed to the probability */
  factors: string[]
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Conversion ceiling from match score alone (avoids over-claiming) */
const MATCH_SCORE_CEILING = 0.40

/** Threshold for high conversion rate investors (pct, 0–100 scale) */
const HIGH_CONVERSION_RATE_THRESHOLD = 30

/** Threshold for experienced investor deal count */
const EXPERIENCED_DEAL_COUNT = 3

/** Threshold for "browser not buyer" — many matches, zero deals */
const BROWSER_MATCH_THRESHOLD = 50

// ---------------------------------------------------------------------------
// predictConversion — main export
// ---------------------------------------------------------------------------

export function predictConversion(
  investor: InvestorFeatures,
  property: PropertyFeatures,
  matchScore: number,
): ConversionPrediction {
  const factors: string[] = []
  let probability = 0

  // 1. Base probability from match score (ceiling: 40%)
  const baseProbability = (Math.min(100, Math.max(0, matchScore)) / 100) * MATCH_SCORE_CEILING
  probability += baseProbability

  // 2. Boost: investor has a track record of high conversion
  if (investor.conversion_rate !== null && investor.conversion_rate > HIGH_CONVERSION_RATE_THRESHOLD) {
    probability += 0.10
    factors.push(`high conversion rate (${investor.conversion_rate.toFixed(1)}%)`)
  }

  // 3. Boost: experienced investor (has closed deals before)
  if (investor.deal_count > EXPERIENCED_DEAL_COUNT) {
    probability += 0.05
    factors.push(`experienced investor (${investor.deal_count} closed deals)`)
  }

  // 4. Penalty: browsing investor — many matches, no deals
  if (investor.match_count > BROWSER_MATCH_THRESHOLD && investor.deal_count === 0) {
    probability -= 0.10
    // Not added to factors (negative signal)
  }

  // 5. Boost: property price fits investor capital range
  if (
    investor.capital_min_eur !== null &&
    investor.capital_max_eur !== null &&
    property.price_eur >= investor.capital_min_eur &&
    property.price_eur <= investor.capital_max_eur
  ) {
    probability += 0.10
    factors.push(`capital fit (price €${property.price_eur.toLocaleString('pt-PT')} within [${investor.capital_min_eur.toLocaleString('pt-PT')}, ${investor.capital_max_eur.toLocaleString('pt-PT')}])`)
  } else if (
    investor.capital_min_eur !== null &&
    investor.capital_max_eur === null &&
    property.price_eur >= investor.capital_min_eur
  ) {
    // Partial capital fit — min known, max open
    probability += 0.05
    factors.push(`capital fit (price ≥ min €${investor.capital_min_eur.toLocaleString('pt-PT')})`)
  }

  // Clamp to [0, 1]
  const clampedProbability = Math.min(1, Math.max(0, probability))
  const score = Math.round(clampedProbability * 100)

  return {
    probability: Math.round(clampedProbability * 1000) / 1000,  // 3 d.p.
    score,
    factors,
  }
}
