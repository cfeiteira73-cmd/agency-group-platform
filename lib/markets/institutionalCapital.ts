// =============================================================================
// Agency Group — Institutional Capital Layer
// lib/markets/institutionalCapital.ts
//
// Routes properties to institutional capital pools: banks, funds, private
// equity, REITs, family offices, sovereign wealth, pension funds, hedge funds.
// Integrates with Supabase institutional_investor_profiles table.
//
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import type { EUCountry } from './regulatoryAbstraction'

// ─── Types ────────────────────────────────────────────────────────────────────

export type InstitutionalType =
  | 'bank'
  | 'private_equity'
  | 'reit'
  | 'family_office'
  | 'sovereign_wealth'
  | 'pension_fund'
  | 'hedge_fund'

export interface InstitutionalProfile {
  investor_id: string
  institutional_type: InstitutionalType

  // Capital characteristics
  aum_eur: number
  deployment_capacity_eur: number
  min_ticket_eur: number
  max_ticket_eur: number

  // Investment preferences
  target_countries: EUCountry[]
  target_property_types: string[]
  target_yield_range: [number, number]
  hold_period_years: [number, number]
  preferred_deal_structure: 'direct' | 'forward_purchase' | 'portfolio' | 'fund'

  // Risk appetite
  risk_tier: 'core' | 'core_plus' | 'value_add' | 'opportunistic'
  leverage_target_pct: number

  // Network
  co_investment_interest: boolean
  anchor_deal_min_eur: number

  // Compliance
  fatf_compliant: boolean
  kyc_verified: boolean
  aml_cleared: boolean
}

export interface InstitutionalMatchEntry {
  investor_id: string
  institutional_type: InstitutionalType
  match_score: number
  capital_fit: 'anchor' | 'co_investor' | 'full'
  recommended_structure: string
}

// ─── Deal grading constants ───────────────────────────────────────────────────

/** Minimum yield % required per institutional grade */
const GRADE_YIELD_THRESHOLDS: Record<string, number> = {
  trophy: 4.0,
  core: 4.5,
  core_plus: 5.0,
  value_add: 5.5,
}

/** Minimum deal value EUR per institutional grade */
const GRADE_VALUE_THRESHOLDS: Record<string, number> = {
  trophy: 10_000_000,
  core: 3_000_000,
  core_plus: 1_000_000,
  value_add: 250_000,
}

// ─── Institutional deal grading ───────────────────────────────────────────────

export function classifyDealForInstitutionalCapital(
  dealValueEur: number,
  propertyType: string,
  yieldPct: number,
  country: EUCountry,
): {
  institutional_grade: 'trophy' | 'core' | 'core_plus' | 'value_add' | 'below_threshold'
  recommended_buyer_types: InstitutionalType[]
  minimum_ticket_recommendation: number
} {
  // Country premium: prime EU markets command higher grades
  const primeMarkets: EUCountry[] = ['DE', 'NL', 'FR']
  const countryPremium = primeMarkets.includes(country) ? 0.5 : 0

  const effectiveYield = yieldPct + countryPremium

  let institutional_grade: 'trophy' | 'core' | 'core_plus' | 'value_add' | 'below_threshold'
  let recommended_buyer_types: InstitutionalType[]
  let minimum_ticket_recommendation: number

  if (
    dealValueEur >= GRADE_VALUE_THRESHOLDS['trophy'] &&
    effectiveYield >= GRADE_YIELD_THRESHOLDS['trophy']
  ) {
    institutional_grade = 'trophy'
    recommended_buyer_types = ['sovereign_wealth', 'pension_fund', 'reit', 'private_equity']
    minimum_ticket_recommendation = 10_000_000
  } else if (
    dealValueEur >= GRADE_VALUE_THRESHOLDS['core'] &&
    effectiveYield >= GRADE_YIELD_THRESHOLDS['core']
  ) {
    institutional_grade = 'core'
    recommended_buyer_types = ['reit', 'pension_fund', 'family_office', 'private_equity']
    minimum_ticket_recommendation = 3_000_000
  } else if (
    dealValueEur >= GRADE_VALUE_THRESHOLDS['core_plus'] &&
    effectiveYield >= GRADE_YIELD_THRESHOLDS['core_plus']
  ) {
    institutional_grade = 'core_plus'
    recommended_buyer_types = ['private_equity', 'family_office', 'hedge_fund', 'reit']
    minimum_ticket_recommendation = 1_000_000
  } else if (dealValueEur >= GRADE_VALUE_THRESHOLDS['value_add']) {
    institutional_grade = 'value_add'
    recommended_buyer_types = ['private_equity', 'hedge_fund', 'family_office']
    minimum_ticket_recommendation = 250_000
  } else {
    institutional_grade = 'below_threshold'
    recommended_buyer_types = []
    minimum_ticket_recommendation = 0
  }

  // Boost commercial/retail to get better deal types
  if (['commercial', 'retail', 'office', 'logistics', 'hotel'].includes(propertyType.toLowerCase())) {
    if (institutional_grade === 'value_add' && dealValueEur >= 500_000) {
      institutional_grade = 'core_plus'
      recommended_buyer_types = ['reit', 'private_equity', 'family_office']
      minimum_ticket_recommendation = 500_000
    }
  }

  return { institutional_grade, recommended_buyer_types, minimum_ticket_recommendation }
}

// ─── Institutional capital routing ───────────────────────────────────────────

/**
 * Routes a property to matching institutional investors from the DB.
 * Queries institutional_investor_profiles joined to investors.
 */
export async function routeToInstitutionalCapital(
  propertyId: string,
  tenantId: string,
  dealValueEur: number,
): Promise<{
  eligible_institutions: InstitutionalMatchEntry[]
  total_accessible_institutional_capital_eur: number
  portfolio_deal_potential: boolean
}> {
  const db = supabaseAdmin as any

  // Fetch all active institutional profiles for this tenant
  const { data, error } = await db
    .from('institutional_investor_profiles')
    .select(`
      id,
      investor_id,
      institutional_type,
      aum_eur,
      deployment_capacity_eur,
      min_ticket_eur,
      max_ticket_eur,
      target_countries,
      target_property_types,
      risk_tier,
      leverage_target_pct,
      co_investment_interest,
      kyc_verified,
      aml_cleared,
      profile_data,
      investors!inner(
        id,
        tenant_id,
        status
      )
    `)
    .eq('tenant_id', tenantId)
    .eq('investors.status', 'active')
    .eq('kyc_verified', true)
    .eq('aml_cleared', true)

  if (error) {
    log.error('[InstitutionalCapital] failed to load profiles', undefined, {
      error: error.message,
      property_id: propertyId,
      tenant_id: tenantId,
    })
    return {
      eligible_institutions: [],
      total_accessible_institutional_capital_eur: 0,
      portfolio_deal_potential: false,
    }
  }

  const profiles: Array<Record<string, unknown>> = data ?? []

  const eligible_institutions: InstitutionalMatchEntry[] = []
  let total_capital = 0

  for (const p of profiles) {
    const minTicket = (p['min_ticket_eur'] as number) ?? 0
    const maxTicket = (p['max_ticket_eur'] as number) ?? Infinity
    const deploymentCapacity = (p['deployment_capacity_eur'] as number) ?? 0

    // Ticket size check
    if (dealValueEur < minTicket || dealValueEur > maxTicket) continue
    if (deploymentCapacity < dealValueEur) continue

    const institutionalType = p['institutional_type'] as InstitutionalType

    // Compute match score — simple heuristic based on capacity fit
    let matchScore = 60 // base score for cleared, active institutional investor
    if (deploymentCapacity >= dealValueEur * 5) matchScore += 10  // large capital buffer
    if (p['co_investment_interest']) matchScore += 5
    if (['sovereign_wealth', 'pension_fund'].includes(institutionalType)) matchScore += 10

    matchScore = Math.min(100, matchScore)

    // Capital fit classification
    let capital_fit: 'anchor' | 'co_investor' | 'full'
    const anchorMin = (p['profile_data'] as Record<string, unknown>)?.['anchor_deal_min_eur'] as number ?? dealValueEur * 0.5
    if (dealValueEur >= anchorMin && deploymentCapacity >= dealValueEur) {
      capital_fit = 'anchor'
    } else if (dealValueEur <= maxTicket && deploymentCapacity >= dealValueEur * 0.3) {
      capital_fit = 'co_investor'
    } else {
      capital_fit = 'full'
    }

    // Recommended structure
    let recommended_structure: string
    if (['reit', 'pension_fund', 'sovereign_wealth'].includes(institutionalType)) {
      recommended_structure = 'forward_purchase'
    } else if (institutionalType === 'private_equity') {
      recommended_structure = 'spe'
    } else {
      recommended_structure = 'direct'
    }

    eligible_institutions.push({
      investor_id: p['investor_id'] as string,
      institutional_type: institutionalType,
      match_score: matchScore,
      capital_fit,
      recommended_structure,
    })

    total_capital += deploymentCapacity
  }

  // Sort by match score descending
  eligible_institutions.sort((a, b) => b.match_score - a.match_score)

  // Portfolio deal potential: >=3 eligible institutions AND deal >=€3M
  const portfolio_deal_potential =
    eligible_institutions.length >= 3 && dealValueEur >= 3_000_000

  return {
    eligible_institutions,
    total_accessible_institutional_capital_eur: total_capital,
    portfolio_deal_potential,
  }
}
