// =============================================================================
// Agency Group — Investor Match Engine
// lib/investors/matchEngine.ts
//
// Pure scoring functions — NO DB calls. Caller fetches data; engine computes.
//
// MATCH SCORE FORMULA:
//   match_score = (
//     capital_fit   * 0.30 +
//     yield_fit     * 0.25 +
//     geography_fit * 0.20 +
//     risk_fit      * 0.15 +
//     type_fit      * 0.10
//   ) * 100   →  0-100
//
// All dimension functions return 0-1 (clamped).
// =============================================================================

import type {
  InvestorProfile,
  InvestorMatchResult,
  MatchScoreDimensions,
  PropertyInput,
} from './types'

// ---------------------------------------------------------------------------
// Weights
// ---------------------------------------------------------------------------

const WEIGHTS = {
  capital_fit:   0.30,
  yield_fit:     0.25,
  geography_fit: 0.20,
  risk_fit:      0.15,
  type_fit:      0.10,
} as const

// ---------------------------------------------------------------------------
// Zone yield adjustments (gross yield multipliers applied to 4.5% base)
// ---------------------------------------------------------------------------

const ZONE_YIELD_ADJUSTMENTS: Array<{ keys: string[]; adjustment: number }> = [
  { keys: ['algarve', 'faro', 'portimão', 'albufeira', 'lagos', 'tavira', 'silves'], adjustment: 0.15 },
  { keys: ['lisboa', 'lisbon', 'alfama', 'belém', 'chiado', 'mouraria', 'intendente', 'avenida', 'príncipe real'], adjustment: 0.10 },
  { keys: ['cascais', 'estoril', 'sintra', 'parede', 'carcavelos', 'birre'], adjustment: 0.10 },
  { keys: ['porto', 'gaia', 'matosinhos', 'foz', 'ribeira', 'cedofeita', 'bonfim'], adjustment: 0.05 },
  { keys: ['madeira', 'funchal', 'açores', 'azores', 'ponta delgada'], adjustment: 0.05 },
]

// ---------------------------------------------------------------------------
// Property type normalisation
// Possible raw values from properties.tipo: T0 T1 T2 T3 T4 Moradia Villa Loja Escritório
// ---------------------------------------------------------------------------

const APARTMENT_TYPES  = /^t[0-9]/i
const HOUSE_TYPES      = /moradia|villa|vivenda|chalet|quinta/i
const COMMERCIAL_TYPES = /loja|escritório|escritorio|comercial|armazem|armazém|office|retail|industrial/i

function normalisePropertyType(tipo: string | null): string {
  if (!tipo) return 'unknown'
  if (APARTMENT_TYPES.test(tipo))  return 'apartment'
  if (HOUSE_TYPES.test(tipo))      return 'house'
  if (COMMERCIAL_TYPES.test(tipo)) return 'commercial'
  return 'other'
}

// ---------------------------------------------------------------------------
// Risk level resolution
// ---------------------------------------------------------------------------

type RiskLevel = 'low' | 'medium' | 'high'

const RISK_LEVEL_STEPS: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2 }
const RISK_FIT_BY_DISTANCE: Record<number, number> = { 0: 1.0, 1: 0.6, 2: 0.3 }

function propertyRiskLevel(precoM2: number | null): RiskLevel {
  if (precoM2 === null || precoM2 <= 0) return 'medium' // unknown → medium
  if (precoM2 >= 5_000)  return 'high'
  if (precoM2 >= 2_500)  return 'medium'
  return 'low'
}

function investorRiskLevel(riskTolerance: InvestorProfile['risk_tolerance']): RiskLevel {
  switch (riskTolerance) {
    case 'conservative': return 'low'
    case 'moderate':     return 'medium'
    case 'aggressive':   return 'high'
    default:             return 'medium' // null → assume moderate
  }
}

// ---------------------------------------------------------------------------
// Clamp helper
// ---------------------------------------------------------------------------

function clamp(v: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, v))
}

// ---------------------------------------------------------------------------
// Dimension: capital_fit
// ---------------------------------------------------------------------------

function computeCapitalFit(property: PropertyInput, investor: InvestorProfile): number {
  const { capital_min_eur: cMin, capital_max_eur: cMax } = investor
  const preco = property.preco

  if (cMin === null && cMax === null) return 0.5 // no preference → neutral

  const min = cMin ?? 0
  const max = cMax ?? Infinity

  if (preco >= min && preco <= max) return 1.0

  if (preco > max) {
    // Over budget — decay
    const decay = (preco - max) / max
    return clamp(1 - decay)
  }

  // Under budget floor
  if (preco < min * 0.5) return 0.5 // too cheap — yield likely inadequate

  // Between min*0.5 and min — partial fit
  const partial = (preco - min * 0.5) / (min - min * 0.5)
  return clamp(0.5 + partial * 0.5)
}

// ---------------------------------------------------------------------------
// Dimension: yield_fit
// ---------------------------------------------------------------------------

function estimateGrossYield(property: PropertyInput): number {
  const BASE_YIELD = 4.5 // percentage

  // Zone adjustment
  let adjustment = 0
  const search = [property.zona, property.bairro]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  for (const { keys, adjustment: adj } of ZONE_YIELD_ADJUSTMENTS) {
    if (keys.some(k => search.includes(k))) {
      adjustment = adj
      break
    }
  }

  return BASE_YIELD * (1 + adjustment)
}

function computeYieldFit(property: PropertyInput, investor: InvestorProfile): number {
  const { yield_target_pct: target } = investor
  if (target === null || target === undefined) return 0.5 // no preference → neutral
  if (target <= 0) return 0.5

  const estimated = estimateGrossYield(property)
  const diff = Math.abs(estimated - target) / target
  return clamp(1 - diff)
}

// ---------------------------------------------------------------------------
// Dimension: geography_fit
// ---------------------------------------------------------------------------

function computeGeographyFit(property: PropertyInput, investor: InvestorProfile): number {
  const prefs = investor.geography_preference
  if (!prefs || prefs.length === 0) return 0.5

  const prefsLower = prefs.map(p => p.toLowerCase().trim())
  const propertyLocation = [property.zona, property.bairro]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  // Direct match — any preference keyword appears in the property location
  for (const pref of prefsLower) {
    if (propertyLocation.includes(pref) || pref.includes(propertyLocation.split(' ')[0] ?? '')) {
      return 1.0
    }
  }

  // Country-level fallback — investor accepts anything in Portugal
  if (prefsLower.some(p => p === 'portugal' || p === 'pt')) return 0.7

  return 0.0
}

// ---------------------------------------------------------------------------
// Dimension: risk_fit
// ---------------------------------------------------------------------------

function computeRiskFit(property: PropertyInput, investor: InvestorProfile): number {
  const propRisk     = propertyRiskLevel(property.preco_m2)
  const investorRisk = investorRiskLevel(investor.risk_tolerance)

  const distance = Math.abs(RISK_LEVEL_STEPS[propRisk] - RISK_LEVEL_STEPS[investorRisk])
  return RISK_FIT_BY_DISTANCE[distance] ?? 0.3
}

// ---------------------------------------------------------------------------
// Dimension: type_fit
// ---------------------------------------------------------------------------

function computeTypeFit(property: PropertyInput, investor: InvestorProfile): number {
  const prefs = investor.property_type_preference
  if (!prefs || prefs.length === 0) return 0.5

  const normalisedPropertyType = normalisePropertyType(property.tipo)
  const prefsLower = prefs.map(p => p.toLowerCase().trim())

  if (prefsLower.includes(normalisedPropertyType)) return 1.0
  return 0.0
}

// ---------------------------------------------------------------------------
// Core: computeMatchScore
// ---------------------------------------------------------------------------

export function computeMatchScore(
  property: PropertyInput,
  investor: InvestorProfile,
): InvestorMatchResult {
  const capital_fit   = computeCapitalFit(property, investor)
  const yield_fit     = computeYieldFit(property, investor)
  const geography_fit = computeGeographyFit(property, investor)
  const risk_fit      = computeRiskFit(property, investor)
  const type_fit      = computeTypeFit(property, investor)

  const dimensions: MatchScoreDimensions = {
    capital_fit,
    yield_fit,
    geography_fit,
    risk_fit,
    type_fit,
  }

  const raw =
    capital_fit   * WEIGHTS.capital_fit   +
    yield_fit     * WEIGHTS.yield_fit     +
    geography_fit * WEIGHTS.geography_fit +
    risk_fit      * WEIGHTS.risk_fit      +
    type_fit      * WEIGHTS.type_fit

  const match_score = Math.round(clamp(raw, 0, 1) * 100 * 100) / 100 // 2 decimal places

  return {
    investor_id:  investor.id,
    property_id:  property.id,
    match_score,
    dimensions,
    investor,
    computed_at: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// rankInvestorsForProperty
// Returns all investors scored for a property, sorted descending by match_score
// ---------------------------------------------------------------------------

export function rankInvestorsForProperty(
  property: PropertyInput,
  investors: InvestorProfile[],
): InvestorMatchResult[] {
  return investors
    .map(investor => computeMatchScore(property, investor))
    .sort((a, b) => b.match_score - a.match_score)
}

// ---------------------------------------------------------------------------
// findTopPropertiesForInvestor
// Returns topN properties scored for an investor, sorted descending by match_score
// ---------------------------------------------------------------------------

export function findTopPropertiesForInvestor(
  investor: InvestorProfile,
  properties: PropertyInput[],
  topN = 10,
): InvestorMatchResult[] {
  return properties
    .map(property => computeMatchScore(property, investor))
    .sort((a, b) => b.match_score - a.match_score)
    .slice(0, topN)
}
