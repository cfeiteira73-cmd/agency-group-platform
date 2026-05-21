// =============================================================================
// Agency Group — Cross-Border Deal Routing
// lib/markets/crossBorderRouting.ts
//
// Computes cross-border match adjustments for deals where the property
// country differs from the investor's nationality. Layers on top of the
// base routing engine scores from lib/investors/routingEngine.ts.
//
// TypeScript strict — 0 errors
// =============================================================================

import {
  type EUCountry,
  COUNTRY_PROFILES,
  computeTransactionCosts,
} from './regulatoryAbstraction'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CrossBorderMatchConfig {
  property_country: EUCountry
  /** Investor's passport country — ISO 3166-1 alpha-2 */
  investor_nationality: string
  investor_type: 'individual' | 'company' | 'fund' | 'reit'
  deal_value_eur: number
}

export interface CrossBorderMatchScore {
  base_match_score: number       // pass-through from routing engine (0-100)
  cross_border_adjustment: number // -20 to +10

  adjustments: {
    tax_efficiency_bonus: number         // positive if low total acquisition cost
    process_complexity_penalty: number   // negative if slow/complex market
    currency_risk_penalty: number        // 0 for EUR pairs, -3 for non-EUR
    golden_visa_bonus: number            // +5 if investor qualifies
    language_barrier_penalty: number     // minor friction (-1 to -3)
  }

  final_score: number
  routing_recommendation: 'prioritize' | 'include' | 'deprioritize' | 'exclude'
  deal_structure_recommendation: 'direct' | 'spe' | 'fund'

  estimated_transaction_costs_eur: number
  net_yield_after_costs_pct: number
}

// ─── Private helpers ──────────────────────────────────────────────────────────

/** Language groups to compute friction between investor nationality and property country */
const LANGUAGE_GROUPS: Record<string, string> = {
  PT: 'romance', BR: 'romance', ES: 'romance', MX: 'romance', AR: 'romance',
  FR: 'romance', BE: 'romance', CH: 'romance',
  IT: 'romance', RO: 'romance',
  DE: 'germanic', AT: 'germanic', LU: 'germanic',
  NL: 'germanic', US: 'english', GB: 'english', AU: 'english', IE: 'english', CA: 'english',
  CN: 'sinitic', TW: 'sinitic', HK: 'sinitic',
  AE: 'arabic', SA: 'arabic', QA: 'arabic', KW: 'arabic',
}

const COUNTRY_LANGUAGE_GROUP: Record<EUCountry, string> = {
  PT: 'romance', ES: 'romance', FR: 'romance', IT: 'romance', BE: 'romance',
  DE: 'germanic', NL: 'germanic', AT: 'germanic',
}

function languageBarrierPenalty(investorNationality: string, propertyCountry: EUCountry): number {
  const investorGroup = LANGUAGE_GROUPS[investorNationality.toUpperCase()] ?? 'other'
  const countryGroup = COUNTRY_LANGUAGE_GROUP[propertyCountry]
  if (investorGroup === countryGroup) return 0
  if (investorGroup === 'english') return -1  // English investors adapt easily
  if (investorGroup === 'other') return -3    // Maximum friction (e.g. Arabic→German)
  return -2                                   // Different EU language families
}

function isCurrencyRisk(country: EUCountry): number {
  return COUNTRY_PROFILES[country].currency === 'EUR' ? 0 : -3
}

function taxEfficiencyBonus(totalCostPct: number): number {
  // Total acquisition cost below 3% = excellent → +5
  // 3–7% = average → 0
  // above 7% = expensive → -5
  if (totalCostPct < 3) return 5
  if (totalCostPct <= 7) return 0
  return -5
}

function processComplexityPenalty(country: EUCountry): number {
  const profile = COUNTRY_PROFILES[country]
  // IT = 120 days → -8, PT/FR = 90 days → -4, DE/AT = 60 days → -2, NL = 45 days → 0
  if (profile.avg_transaction_days >= 120) return -8
  if (profile.avg_transaction_days >= 90) return -4
  if (profile.avg_transaction_days >= 60) return -2
  return 0
}

function goldenVisaBonus(
  propertyCountry: EUCountry,
  investorNationality: string,
  investorType: 'individual' | 'company' | 'fund' | 'reit',
  dealValueEur: number,
): number {
  const profile = COUNTRY_PROFILES[propertyCountry]
  if (!profile.golden_visa_eligible) return 0
  if (investorType !== 'individual') return 0

  const euNationalities = ['PT', 'ES', 'FR', 'DE', 'NL', 'IT', 'BE', 'AT']
  if (euNationalities.includes(investorNationality.toUpperCase())) return 0 // EU don't need it

  const minimum = profile.investment_minimums['golden_visa'] ?? Infinity
  if (dealValueEur >= minimum) return 5
  return 0
}

function routingRecommendation(finalScore: number): CrossBorderMatchScore['routing_recommendation'] {
  if (finalScore >= 80) return 'prioritize'
  if (finalScore >= 60) return 'include'
  if (finalScore >= 40) return 'deprioritize'
  return 'exclude'
}

function dealStructureRecommendation(
  investorType: 'individual' | 'company' | 'fund' | 'reit',
  dealValueEur: number,
): CrossBorderMatchScore['deal_structure_recommendation'] {
  if (investorType === 'fund' || investorType === 'reit') return 'fund'
  if (dealValueEur >= 3_000_000 || investorType === 'company') return 'spe'
  return 'direct'
}

// ─── Main exports ─────────────────────────────────────────────────────────────

/**
 * Computes a cross-border adjusted match score for a deal.
 *
 * @param baseMatchScore - Score from the routing engine (0-100)
 * @param propertyYieldPct - Gross rental yield of the property
 * @param config - Deal configuration including countries and investor type
 */
export function computeCrossBorderMatchScore(
  baseMatchScore: number,
  propertyYieldPct: number,
  config: CrossBorderMatchConfig,
): CrossBorderMatchScore {
  const { property_country, investor_nationality, investor_type, deal_value_eur } = config

  // Compute transaction costs
  const costs = computeTransactionCosts(deal_value_eur, property_country, investor_nationality)
  const totalCostPct = costs.total_cost_pct

  // Individual adjustments
  const taxBonus = taxEfficiencyBonus(totalCostPct)
  const complexityPenalty = processComplexityPenalty(property_country)
  const currencyPenalty = isCurrencyRisk(property_country)
  const visaBonus = goldenVisaBonus(property_country, investor_nationality, investor_type, deal_value_eur)
  const languagePenalty = languageBarrierPenalty(investor_nationality, property_country)

  const cross_border_adjustment = Math.max(
    -20,
    Math.min(10, taxBonus + complexityPenalty + currencyPenalty + visaBonus + languagePenalty),
  )

  const final_score = Math.max(0, Math.min(100, Math.round(baseMatchScore + cross_border_adjustment)))

  // Net yield after costs: amortise transaction costs over 5-year hold
  const annualCostDrag = totalCostPct / 5
  const net_yield_after_costs_pct = Math.max(0, Math.round((propertyYieldPct - annualCostDrag) * 100) / 100)

  return {
    base_match_score: baseMatchScore,
    cross_border_adjustment,
    adjustments: {
      tax_efficiency_bonus: taxBonus,
      process_complexity_penalty: complexityPenalty,
      currency_risk_penalty: currencyPenalty,
      golden_visa_bonus: visaBonus,
      language_barrier_penalty: languagePenalty,
    },
    final_score,
    routing_recommendation: routingRecommendation(final_score),
    deal_structure_recommendation: dealStructureRecommendation(investor_type, deal_value_eur),
    estimated_transaction_costs_eur: costs.transaction_tax_eur + costs.stamp_duty_eur + costs.notary_fees_eur,
    net_yield_after_costs_pct,
  }
}

/**
 * Normalizes gross yield for a given investor's tax situation.
 * Accounts for rental income tax and amortised acquisition costs.
 */
export function normalizeYieldAcrossCountries(
  grossYieldPct: number,
  country: EUCountry,
  investorNationality: string,
  investorType: 'individual' | 'company' | 'fund' | 'reit',
): {
  gross_yield_pct: number
  net_yield_after_tax_pct: number
  net_yield_after_all_costs_pct: number
  effective_tax_rate_pct: number
} {
  const profile = COUNTRY_PROFILES[country]

  // Select applicable tax rate
  let taxRatePct: number
  if (investorType === 'fund' || investorType === 'reit') {
    // Funds typically benefit from treaty rates or REIT exemptions — use 50% of standard
    taxRatePct = profile.rental_income_tax_pct * 0.5
  } else if (investorType === 'company') {
    // Corporate rental income often taxed at corporate rate — use 75% of standard
    taxRatePct = profile.rental_income_tax_pct * 0.75
  } else {
    taxRatePct = profile.rental_income_tax_pct
  }

  // Additional non-resident surcharge (5% for non-EU nationals)
  const euNationalities = ['PT', 'ES', 'FR', 'DE', 'NL', 'IT', 'BE', 'AT', 'GR']
  const isEU = euNationalities.includes(investorNationality.toUpperCase())
  if (!isEU && investorType === 'individual') {
    taxRatePct = Math.min(taxRatePct + 5, 40)
  }

  const net_yield_after_tax_pct = Math.round(grossYieldPct * (1 - taxRatePct / 100) * 100) / 100

  // Amortise total acquisition costs over 5-year assumed hold
  const annualCostDrag = (profile.transaction_tax_pct + profile.stamp_duty_pct + 0.75) / 5
  const net_yield_after_all_costs_pct = Math.max(
    0,
    Math.round((net_yield_after_tax_pct - annualCostDrag) * 100) / 100,
  )

  return {
    gross_yield_pct: grossYieldPct,
    net_yield_after_tax_pct,
    net_yield_after_all_costs_pct,
    effective_tax_rate_pct: Math.round(taxRatePct * 100) / 100,
  }
}
