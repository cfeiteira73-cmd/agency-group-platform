// =============================================================================
// Agency Group — European Yield Harmonization
// lib/markets/yieldHarmonization.ts
//
// Normalizes and benchmarks real estate yields across EU markets so that
// investors can compare risk-adjusted returns apples-to-apples.
//
// Reference data (Q2 2026):
//   - EU average gross yield: ~4.5% residential, ~6.2% commercial
//   - 10-year Bund yield: 2.8%
//   - Illiquidity premium: 60bps
//   - Country risk premiums: 0–150bps
//
// TypeScript strict — 0 errors
// =============================================================================

import { type EUCountry, COUNTRY_PROFILES } from './regulatoryAbstraction'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HarmonizedYield {
  gross_yield_pct: number
  net_yield_local_tax_pct: number
  net_yield_investor_tax_pct: number  // depends on investor's home country
  risk_adjusted_yield_pct: number     // adjusted for country + market risk

  // Benchmarks
  yield_vs_eu_average_bps: number      // basis points above/below EU average
  yield_vs_10yr_bund_bps: number       // spread vs German 10-year bond
  yield_premium_for_risk_bps: number   // extra yield per unit of risk

  market_context: {
    country: EUCountry
    city: string
    comparable_yield_range: [number, number]
    yield_percentile: number  // 0-100, where does this sit in the market
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** EU average gross yield 2026 by property type */
const EU_AVERAGE_YIELD_PCT: Record<string, number> = {
  residential: 4.5,
  apartment: 4.5,
  commercial: 6.2,
  retail: 6.0,
  office: 5.8,
  logistics: 5.5,
  hotel: 6.5,
  default: 4.5,
}

/** German 10-year Bund yield reference (Q2 2026) */
const BUND_10YR_PCT = 2.8

/** Illiquidity premium in basis points */
const ILLIQUIDITY_PREMIUM_BPS = 60

/**
 * Country risk premium in basis points above the risk-free rate.
 * Higher = riskier market.
 */
const COUNTRY_RISK_PREMIUM_BPS: Record<EUCountry, number> = {
  DE: 0,    // benchmark
  NL: 10,
  AT: 20,
  FR: 30,
  BE: 35,
  ES: 50,
  PT: 70,
  IT: 150,
}

/**
 * Approximate market yield ranges [min%, max%] per country by property type.
 * Based on Q1-Q2 2026 Cushman & Wakefield / Savills data.
 */
const MARKET_YIELD_RANGES: Record<EUCountry, Record<string, [number, number]>> = {
  PT: { residential: [3.5, 5.5], commercial: [5.0, 8.0], default: [3.5, 5.5] },
  ES: { residential: [3.2, 5.2], commercial: [4.5, 7.5], default: [3.2, 5.2] },
  FR: { residential: [2.8, 4.8], commercial: [4.0, 7.0], default: [2.8, 4.8] },
  DE: { residential: [2.5, 4.5], commercial: [3.5, 6.5], default: [2.5, 4.5] },
  NL: { residential: [3.0, 5.0], commercial: [4.0, 6.5], default: [3.0, 5.0] },
  IT: { residential: [3.8, 6.0], commercial: [5.5, 8.5], default: [3.8, 6.0] },
  BE: { residential: [3.0, 4.8], commercial: [4.5, 7.0], default: [3.0, 4.8] },
  AT: { residential: [2.8, 4.5], commercial: [3.8, 6.0], default: [2.8, 4.5] },
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function resolvePropertyType(propertyType: string): string {
  const norm = propertyType.toLowerCase()
  if (['apartment', 'house', 'villa', 'moradia', 'apartamento'].includes(norm)) return 'residential'
  if (['commercial', 'office', 'retail', 'loja', 'escritorio'].includes(norm)) return 'commercial'
  return 'default'
}

function getYieldRange(country: EUCountry, propertyType: string): [number, number] {
  const norm = resolvePropertyType(propertyType)
  return MARKET_YIELD_RANGES[country][norm] ?? MARKET_YIELD_RANGES[country]['default'] ?? [3.0, 7.0]
}

function computeYieldPercentile(yieldPct: number, range: [number, number]): number {
  const [min, max] = range
  if (max === min) return 50
  const pct = ((yieldPct - min) / (max - min)) * 100
  return Math.max(0, Math.min(100, Math.round(pct)))
}

function applyLocalTax(grossYieldPct: number, country: EUCountry): number {
  const profile = COUNTRY_PROFILES[country]
  const after = grossYieldPct * (1 - profile.rental_income_tax_pct / 100)
  return Math.round(after * 100) / 100
}

function applyInvestorTax(
  grossYieldPct: number,
  investorCountry: EUCountry | undefined,
  investorType: 'individual' | 'fund' | 'reit' | undefined,
): number {
  if (!investorCountry) {
    // Unknown investor — apply conservative 25% rate
    return Math.round(grossYieldPct * 0.75 * 100) / 100
  }
  const profile = COUNTRY_PROFILES[investorCountry]
  let rate = profile.rental_income_tax_pct
  if (investorType === 'fund') rate = rate * 0.5       // treaty/fund exemption
  if (investorType === 'reit') rate = rate * 0.3        // REIT pass-through
  return Math.round(grossYieldPct * (1 - rate / 100) * 100) / 100
}

function computeRiskAdjustedYield(
  grossYieldPct: number,
  country: EUCountry,
  liquidityIndex: number, // 0-100
): number {
  const countryRiskBps = COUNTRY_RISK_PREMIUM_BPS[country]
  // Required yield = Bund + illiquidity premium + country risk
  const requiredYieldPct = BUND_10YR_PCT + (ILLIQUIDITY_PREMIUM_BPS + countryRiskBps) / 100
  // Risk-adjusted = gross yield minus the required yield spread (normalised)
  const spreadPct = grossYieldPct - requiredYieldPct
  // Liquidity discount: lower liquidity = higher discount on realised yield
  const liquidityDiscount = ((100 - liquidityIndex) / 100) * 0.5
  const riskAdjusted = grossYieldPct - liquidityDiscount + Math.min(spreadPct * 0.1, 0.5)
  return Math.max(0, Math.round(riskAdjusted * 100) / 100)
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Harmonizes a gross yield for cross-market comparison.
 *
 * @param grossYieldPct - The raw gross yield of the property
 * @param country - Property country
 * @param city - Property city (for context)
 * @param propertyType - Property type string
 * @param investorCountry - Optional: investor's home country (for tax calculation)
 * @param investorType - Optional: investor classification
 */
export function harmonizeYield(
  grossYieldPct: number,
  country: EUCountry,
  city: string,
  propertyType: string,
  investorCountry?: EUCountry,
  investorType?: 'individual' | 'fund' | 'reit',
): HarmonizedYield {
  const profile = COUNTRY_PROFILES[country]
  const yieldRange = getYieldRange(country, propertyType)

  const resolvedType = resolvePropertyType(propertyType)
  const euAvg = EU_AVERAGE_YIELD_PCT[resolvedType] ?? EU_AVERAGE_YIELD_PCT['default']

  const net_yield_local_tax_pct = applyLocalTax(grossYieldPct, country)
  const net_yield_investor_tax_pct = applyInvestorTax(grossYieldPct, investorCountry, investorType)
  const risk_adjusted_yield_pct = computeRiskAdjustedYield(
    grossYieldPct,
    country,
    profile.market_liquidity_index,
  )

  const yield_vs_eu_average_bps = Math.round((grossYieldPct - euAvg) * 100)
  const yield_vs_10yr_bund_bps = Math.round((grossYieldPct - BUND_10YR_PCT) * 100)

  const requiredRiskPremiumPct = (ILLIQUIDITY_PREMIUM_BPS + COUNTRY_RISK_PREMIUM_BPS[country]) / 100
  const yield_premium_for_risk_bps = Math.round(
    (grossYieldPct - BUND_10YR_PCT - requiredRiskPremiumPct) * 100,
  )

  const yield_percentile = computeYieldPercentile(grossYieldPct, yieldRange)

  return {
    gross_yield_pct: grossYieldPct,
    net_yield_local_tax_pct,
    net_yield_investor_tax_pct,
    risk_adjusted_yield_pct,
    yield_vs_eu_average_bps,
    yield_vs_10yr_bund_bps,
    yield_premium_for_risk_bps,
    market_context: {
      country,
      city,
      comparable_yield_range: yieldRange,
      yield_percentile,
    },
  }
}
