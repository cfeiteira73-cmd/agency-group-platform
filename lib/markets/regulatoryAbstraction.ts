// =============================================================================
// Agency Group — European Regulatory Abstraction Layer
// lib/markets/regulatoryAbstraction.ts
//
// Per-country tax, compliance, and investor eligibility rules for the
// EU Real Estate Liquidity Infrastructure (Phase 5).
//
// Data sources: EU Tax Observatory 2026, each country's tax authority,
// FATF AML thresholds, Golden Visa schemes as of Q1 2026.
//
// TypeScript strict — 0 errors
// =============================================================================

// ─── Types ────────────────────────────────────────────────────────────────────

export type EUCountry = 'PT' | 'ES' | 'FR' | 'DE' | 'NL' | 'IT' | 'BE' | 'AT'

export interface CountryRegulatoryProfile {
  country: EUCountry
  country_name: string

  // Tax rules
  /** IMT in PT, ITP in ES, DMTO in FR, GrESt in DE */
  transaction_tax_pct: number
  /** IS in PT, AJD in ES */
  stamp_duty_pct: number
  /** Capital gains tax for non-residents */
  capital_gains_tax_pct: number
  /** Rental income tax for non-residents */
  rental_income_tax_pct: number
  vat_on_new_builds_pct: number

  // Foreign investment rules
  /** PT, ES, GR offer golden visas */
  golden_visa_eligible: boolean
  foreign_ownership_restrictions: string[]
  investment_minimums: Record<string, number>

  // Transaction process
  /** Average calendar days to close from accepted offer */
  avg_transaction_days: number
  notary_required: boolean
  mandatory_lawyers: boolean

  // Reporting requirements
  /** Mandatory AML reporting above this threshold (EUR) */
  aml_threshold_eur: number
  beneficial_owner_disclosure: boolean

  // Currency
  currency: 'EUR' | 'GBP' | 'CHF'

  // Market data
  /** Average price per m² by city */
  avg_price_per_m2_eur: Record<string, number>
  /** Liquidity index 0-100 */
  market_liquidity_index: number
}

// ─── Country Profiles ────────────────────────────────────────────────────────

export const COUNTRY_PROFILES: Record<EUCountry, CountryRegulatoryProfile> = {
  PT: {
    country: 'PT',
    country_name: 'Portugal',
    transaction_tax_pct: 6.5,   // IMT variable rate, avg for residential >500K
    stamp_duty_pct: 0.8,
    capital_gains_tax_pct: 28,
    rental_income_tax_pct: 25,
    vat_on_new_builds_pct: 23,
    golden_visa_eligible: true,
    foreign_ownership_restrictions: [],
    investment_minimums: { golden_visa: 500000 },
    avg_transaction_days: 90,
    notary_required: true,
    mandatory_lawyers: false,
    aml_threshold_eur: 15000,
    beneficial_owner_disclosure: true,
    currency: 'EUR',
    avg_price_per_m2_eur: {
      Lisbon: 5000,
      Porto: 3643,
      Algarve: 3941,
      Cascais: 4713,
      Madeira: 3760,
    },
    market_liquidity_index: 78,
  },

  ES: {
    country: 'ES',
    country_name: 'Spain',
    transaction_tax_pct: 7,     // ITP (used property), varies by region (6-10%)
    stamp_duty_pct: 0.5,        // AJD
    capital_gains_tax_pct: 24,
    rental_income_tax_pct: 24,
    vat_on_new_builds_pct: 10,
    golden_visa_eligible: true,
    foreign_ownership_restrictions: [],
    investment_minimums: { golden_visa: 500000 },
    avg_transaction_days: 75,
    notary_required: true,
    mandatory_lawyers: false,
    aml_threshold_eur: 15000,
    beneficial_owner_disclosure: true,
    currency: 'EUR',
    avg_price_per_m2_eur: {
      Madrid: 4500,
      Barcelona: 4200,
      Marbella: 5500,
      Valencia: 2500,
    },
    market_liquidity_index: 82,
  },

  FR: {
    country: 'FR',
    country_name: 'France',
    transaction_tax_pct: 5.8,   // DMTO (droits de mutation à titre onéreux)
    stamp_duty_pct: 0,
    capital_gains_tax_pct: 36.2, // 19% + 17.2% social charges for non-EU
    rental_income_tax_pct: 30,
    vat_on_new_builds_pct: 20,
    golden_visa_eligible: false,
    foreign_ownership_restrictions: [],
    investment_minimums: {},
    avg_transaction_days: 90,
    notary_required: true,
    mandatory_lawyers: false,
    aml_threshold_eur: 10000,
    beneficial_owner_disclosure: true,
    currency: 'EUR',
    avg_price_per_m2_eur: {
      Paris: 10000,
      Lyon: 4500,
      Bordeaux: 4000,
      "Côte d'Azur": 7000,
    },
    market_liquidity_index: 70,
  },

  DE: {
    country: 'DE',
    country_name: 'Germany',
    transaction_tax_pct: 5.0,   // GrESt varies by state 3.5–6.5%, avg 5%
    stamp_duty_pct: 0,
    capital_gains_tax_pct: 25,
    rental_income_tax_pct: 25,
    vat_on_new_builds_pct: 19,
    golden_visa_eligible: false,
    foreign_ownership_restrictions: [],
    investment_minimums: {},
    avg_transaction_days: 60,
    notary_required: true,
    mandatory_lawyers: false,
    aml_threshold_eur: 10000,
    beneficial_owner_disclosure: true,
    currency: 'EUR',
    avg_price_per_m2_eur: {
      Berlin: 5500,
      Munich: 8500,
      Frankfurt: 6500,
      Hamburg: 6000,
    },
    market_liquidity_index: 85,
  },

  NL: {
    country: 'NL',
    country_name: 'Netherlands',
    transaction_tax_pct: 2,
    stamp_duty_pct: 0,
    capital_gains_tax_pct: 26.9,  // Box 3 deemed return on assets
    rental_income_tax_pct: 26.9,
    vat_on_new_builds_pct: 21,
    golden_visa_eligible: false,
    foreign_ownership_restrictions: [],
    investment_minimums: {},
    avg_transaction_days: 45,
    notary_required: true,
    mandatory_lawyers: false,
    aml_threshold_eur: 10000,
    beneficial_owner_disclosure: true,
    currency: 'EUR',
    avg_price_per_m2_eur: {
      Amsterdam: 7000,
      Rotterdam: 4000,
    },
    market_liquidity_index: 88,
  },

  IT: {
    country: 'IT',
    country_name: 'Italy',
    transaction_tax_pct: 9,     // Imposta di registro (secondary market)
    stamp_duty_pct: 0,
    capital_gains_tax_pct: 26,
    rental_income_tax_pct: 21,
    vat_on_new_builds_pct: 22,
    golden_visa_eligible: false,
    foreign_ownership_restrictions: [],
    investment_minimums: {},
    avg_transaction_days: 120,
    notary_required: true,
    mandatory_lawyers: false,
    aml_threshold_eur: 10000,
    beneficial_owner_disclosure: true,
    currency: 'EUR',
    avg_price_per_m2_eur: {
      Rome: 4500,
      Milan: 6000,
      Florence: 4000,
    },
    market_liquidity_index: 60,
  },

  BE: {
    country: 'BE',
    country_name: 'Belgium',
    transaction_tax_pct: 10,    // Droits d'enregistrement / Registratierechten
    stamp_duty_pct: 0,
    capital_gains_tax_pct: 0,   // Generally exempt after 5 years
    rental_income_tax_pct: 30,
    vat_on_new_builds_pct: 21,
    golden_visa_eligible: false,
    foreign_ownership_restrictions: [],
    investment_minimums: {},
    avg_transaction_days: 60,
    notary_required: true,
    mandatory_lawyers: false,
    aml_threshold_eur: 10000,
    beneficial_owner_disclosure: true,
    currency: 'EUR',
    avg_price_per_m2_eur: {
      Brussels: 3500,
      Antwerp: 3000,
    },
    market_liquidity_index: 72,
  },

  AT: {
    country: 'AT',
    country_name: 'Austria',
    transaction_tax_pct: 3.5,   // Grunderwerbsteuer
    stamp_duty_pct: 1.2,        // Eintragungsgebühr (land register)
    capital_gains_tax_pct: 30,  // ImmoESt
    rental_income_tax_pct: 27.5,
    vat_on_new_builds_pct: 20,
    golden_visa_eligible: false,
    foreign_ownership_restrictions: [],
    investment_minimums: {},
    avg_transaction_days: 60,
    notary_required: true,
    mandatory_lawyers: false,
    aml_threshold_eur: 10000,
    beneficial_owner_disclosure: true,
    currency: 'EUR',
    avg_price_per_m2_eur: {
      Vienna: 6000,
      Salzburg: 5000,
    },
    market_liquidity_index: 75,
  },
}

// ─── Transaction Cost Calculator ─────────────────────────────────────────────

/**
 * Estimates total acquisition costs for a property purchase.
 * Note: notary fees are estimated at 0.5–1% depending on deal size.
 */
export function computeTransactionCosts(
  propertyPriceEur: number,
  country: EUCountry,
  _investorNationality?: string, // ISO 3166-1 alpha-2 — reserved for future DTA lookup
): {
  transaction_tax_eur: number
  stamp_duty_eur: number
  notary_fees_eur: number
  total_acquisition_cost_eur: number
  total_cost_pct: number
} {
  const profile = COUNTRY_PROFILES[country]

  const transaction_tax_eur = (propertyPriceEur * profile.transaction_tax_pct) / 100
  const stamp_duty_eur = (propertyPriceEur * profile.stamp_duty_pct) / 100

  // Notary fees: 1% for deals ≤500K, 0.75% for 500K–2M, 0.5% above 2M
  let notary_pct: number
  if (propertyPriceEur <= 500_000) {
    notary_pct = 1.0
  } else if (propertyPriceEur <= 2_000_000) {
    notary_pct = 0.75
  } else {
    notary_pct = 0.5
  }
  const notary_fees_eur = profile.notary_required
    ? (propertyPriceEur * notary_pct) / 100
    : 0

  const total_acquisition_cost_eur = propertyPriceEur + transaction_tax_eur + stamp_duty_eur + notary_fees_eur
  const total_cost_pct =
    ((transaction_tax_eur + stamp_duty_eur + notary_fees_eur) / propertyPriceEur) * 100

  return {
    transaction_tax_eur: Math.round(transaction_tax_eur),
    stamp_duty_eur: Math.round(stamp_duty_eur),
    notary_fees_eur: Math.round(notary_fees_eur),
    total_acquisition_cost_eur: Math.round(total_acquisition_cost_eur),
    total_cost_pct: Math.round(total_cost_pct * 100) / 100,
  }
}

// ─── Investor Eligibility Check ───────────────────────────────────────────────

/**
 * Checks whether an investor can participate in a specific country's market
 * and recommends the most efficient legal structure for acquisition.
 */
export function checkInvestorEligibility(
  investorNationality: string,
  country: EUCountry,
  investmentAmountEur: number,
  investorType: 'individual' | 'company' | 'fund' | 'reit',
): {
  eligible: boolean
  golden_visa_eligible: boolean
  restrictions: string[]
  recommended_structure: 'direct' | 'spe' | 'reit_vehicle' | 'fund'
} {
  const profile = COUNTRY_PROFILES[country]
  const restrictions: string[] = [...profile.foreign_ownership_restrictions]

  // EU nationals have no additional restrictions within the single market
  const euNationalities = ['PT', 'ES', 'FR', 'DE', 'NL', 'IT', 'BE', 'AT', 'GR', 'LU',
    'FI', 'SE', 'DK', 'IE', 'PL', 'CZ', 'SK', 'HU', 'RO', 'BG', 'HR', 'SI',
    'EE', 'LV', 'LT', 'CY', 'MT']
  const isEU = euNationalities.includes(investorNationality.toUpperCase())

  // Non-EU non-EEA may face additional scrutiny in some countries
  if (!isEU && country === 'DE' && investmentAmountEur > 25_000_000) {
    restrictions.push('Foreign investment screening required (AWG §4a) for deals >€25M')
  }
  if (!isEU && country === 'FR' && investmentAmountEur > 10_000_000) {
    restrictions.push('French strategic investment review may apply (FIRMAN)')
  }

  // AML pre-clearance threshold
  if (investmentAmountEur > profile.aml_threshold_eur) {
    restrictions.push(`AML declaration mandatory (threshold: €${profile.aml_threshold_eur.toLocaleString()})`)
  }

  // Beneficial owner disclosure
  if (profile.beneficial_owner_disclosure && investorType === 'company') {
    restrictions.push('Beneficial owner registration required in national register')
  }

  // Golden visa eligibility
  const goldenVisaMin = profile.investment_minimums['golden_visa']
  const golden_visa_eligible =
    profile.golden_visa_eligible &&
    goldenVisaMin !== undefined &&
    investmentAmountEur >= goldenVisaMin &&
    investorType === 'individual'

  // Recommended structure
  let recommended_structure: 'direct' | 'spe' | 'reit_vehicle' | 'fund'
  if (investorType === 'reit') {
    recommended_structure = 'reit_vehicle'
  } else if (investorType === 'fund') {
    recommended_structure = 'fund'
  } else if (investmentAmountEur >= 5_000_000 || investorType === 'company') {
    // SPE (Special Purpose Entity) makes sense for large individual deals or corporate buyers
    recommended_structure = 'spe'
  } else {
    recommended_structure = 'direct'
  }

  return {
    eligible: restrictions.filter(r => r.startsWith('Prohibited')).length === 0,
    golden_visa_eligible,
    restrictions,
    recommended_structure,
  }
}
