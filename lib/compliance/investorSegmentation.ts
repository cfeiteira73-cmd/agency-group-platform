// Agency Group — Investor Segmentation & Access Rules
// lib/compliance/investorSegmentation.ts
// MiFID-aligned investor classification.
// RETAIL: max €10K per deal, no leverage assets
// ACCREDITED: max €500K per deal, standard assets
// INSTITUTIONAL: no single-deal limit, all asset classes
// FAMILY_OFFICE: max €5M per deal, premium assets
// Rules enforced at bid submission and capital commitment.
// TypeScript strict — 0 errors

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { type InvestorType, isKycApproved } from '@/lib/compliance/investorKyc'
import { getLatestScreening } from '@/lib/compliance/amlScreening'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SegmentationRule {
  investor_type: InvestorType
  max_single_deal_eur_cents: number | null
  allowed_asset_classes: string[]
  requires_enhanced_kyc: boolean
  max_portfolio_concentration_pct: number
  cross_border_allowed: boolean
  leverage_allowed: boolean
}

export interface ExposureCheck {
  allowed: boolean
  reason: string | null
  investor_type: InvestorType
  current_exposure_eur_cents: number
  proposed_amount_eur_cents: number
  max_single_deal_eur_cents: number | null
  concentration_pct: number
}

// ─── Segmentation rules ───────────────────────────────────────────────────────

export const SEGMENTATION_RULES: Record<InvestorType, SegmentationRule> = {
  RETAIL: {
    investor_type: 'RETAIL',
    max_single_deal_eur_cents: 1_000_000,          // €10,000
    allowed_asset_classes: ['residential'],
    requires_enhanced_kyc: false,
    max_portfolio_concentration_pct: 25,
    cross_border_allowed: false,
    leverage_allowed: false,
  },
  ACCREDITED: {
    investor_type: 'ACCREDITED',
    max_single_deal_eur_cents: 50_000_000,          // €500,000
    allowed_asset_classes: ['residential', 'commercial', 'mixed'],
    requires_enhanced_kyc: false,
    max_portfolio_concentration_pct: 15,
    cross_border_allowed: true,
    leverage_allowed: false,
  },
  INSTITUTIONAL: {
    investor_type: 'INSTITUTIONAL',
    max_single_deal_eur_cents: null,                // unlimited
    allowed_asset_classes: ['residential', 'commercial', 'mixed', 'industrial', 'development', 'hospitality'],
    requires_enhanced_kyc: true,
    max_portfolio_concentration_pct: 5,
    cross_border_allowed: true,
    leverage_allowed: true,
  },
  FAMILY_OFFICE: {
    investor_type: 'FAMILY_OFFICE',
    max_single_deal_eur_cents: 500_000_000,         // €5,000,000
    allowed_asset_classes: ['residential', 'commercial', 'mixed', 'industrial', 'development', 'hospitality'],
    requires_enhanced_kyc: true,
    max_portfolio_concentration_pct: 10,
    cross_border_allowed: true,
    leverage_allowed: false,
  },
  SOVEREIGN_FUND: {
    investor_type: 'SOVEREIGN_FUND',
    max_single_deal_eur_cents: null,                // unlimited
    allowed_asset_classes: ['residential', 'commercial', 'mixed', 'industrial', 'development', 'hospitality'],
    requires_enhanced_kyc: true,
    max_portfolio_concentration_pct: 3,
    cross_border_allowed: true,
    leverage_allowed: true,
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getInvestorType(
  investorId: string,
  tenantId: string,
): Promise<InvestorType> {
  const { data, error } = await (supabaseAdmin as any)
    .from('investor_kyc_records')
    .select('investor_type')
    .eq('investor_id', investorId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error || !data) {
    log.warn('[investorSegmentation] investor_type lookup failed, defaulting to RETAIL', {
      investor_id: investorId,
    })
    return 'RETAIL'
  }

  return ((data as Record<string, unknown>)['investor_type'] as InvestorType) ?? 'RETAIL'
}

async function getTotalPortfolioExposure(
  investorId: string,
  tenantId: string,
): Promise<number> {
  // Sum committed + executed amounts from the capital ledger
  const { data, error } = await (supabaseAdmin as any)
    .from('capital_ledger_entries')
    .select('amount_eur_cents')
    .eq('investor_id', investorId)
    .eq('tenant_id', tenantId)
    .in('status', ['committed', 'executed'])

  if (error) {
    log.warn('[investorSegmentation] portfolio exposure lookup failed', {
      investor_id: investorId,
      error: (error as { message?: string }).message,
    })
    return 0
  }

  if (!data || !Array.isArray(data)) return 0

  return (data as Record<string, unknown>[]).reduce(
    (sum, row) => sum + Number(row['amount_eur_cents'] ?? 0),
    0,
  )
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Checks whether a proposed investment amount is within the investor's
 * segmentation limits (deal cap + portfolio concentration).
 */
export async function checkExposureLimit(
  investorId: string,
  tenantId: string,
  proposedAmountEurCents: number,
  assetClass: string,
): Promise<ExposureCheck> {
  const investor_type = await getInvestorType(investorId, tenantId)
  const rule = SEGMENTATION_RULES[investor_type]

  // 1. Single-deal cap check
  if (
    rule.max_single_deal_eur_cents !== null &&
    proposedAmountEurCents > rule.max_single_deal_eur_cents
  ) {
    return {
      allowed: false,
      reason: `Amount exceeds single-deal cap of ${rule.max_single_deal_eur_cents} cents for ${investor_type}`,
      investor_type,
      current_exposure_eur_cents: 0,
      proposed_amount_eur_cents: proposedAmountEurCents,
      max_single_deal_eur_cents: rule.max_single_deal_eur_cents,
      concentration_pct: 0,
    }
  }

  // 2. Asset class check
  if (!rule.allowed_asset_classes.includes(assetClass)) {
    return {
      allowed: false,
      reason: `Asset class '${assetClass}' not permitted for ${investor_type}`,
      investor_type,
      current_exposure_eur_cents: 0,
      proposed_amount_eur_cents: proposedAmountEurCents,
      max_single_deal_eur_cents: rule.max_single_deal_eur_cents,
      concentration_pct: 0,
    }
  }

  // 3. Portfolio concentration check
  const current_exposure_eur_cents = await getTotalPortfolioExposure(investorId, tenantId)
  const totalAfter = current_exposure_eur_cents + proposedAmountEurCents
  const concentration_pct = totalAfter > 0
    ? (proposedAmountEurCents / totalAfter) * 100
    : 0

  if (concentration_pct > rule.max_portfolio_concentration_pct) {
    return {
      allowed: false,
      reason: `Concentration ${concentration_pct.toFixed(1)}% exceeds max ${rule.max_portfolio_concentration_pct}% for ${investor_type}`,
      investor_type,
      current_exposure_eur_cents,
      proposed_amount_eur_cents: proposedAmountEurCents,
      max_single_deal_eur_cents: rule.max_single_deal_eur_cents,
      concentration_pct,
    }
  }

  return {
    allowed: true,
    reason: null,
    investor_type,
    current_exposure_eur_cents,
    proposed_amount_eur_cents: proposedAmountEurCents,
    max_single_deal_eur_cents: rule.max_single_deal_eur_cents,
    concentration_pct,
  }
}

/**
 * Full bid eligibility gate: KYC approved + AML cleared + exposure within limits
 * + cross-border rule + asset class allowed.
 */
export async function validateBidEligibility(
  investorId: string,
  tenantId: string,
  bidAmountEurCents: number,
  assetClass: string,
  isCrossBorder: boolean,
): Promise<{ eligible: boolean; violations: string[] }> {
  const violations: string[] = []

  // 1. KYC approved
  const kycOk = await isKycApproved(investorId, tenantId)
  if (!kycOk) {
    violations.push('KYC_NOT_APPROVED')
  }

  // 2. AML cleared
  const latestAml = await getLatestScreening(investorId, tenantId)
  if (!latestAml || latestAml.recommended_action === 'FREEZE' || latestAml.recommended_action === 'REJECT') {
    violations.push('AML_NOT_CLEARED')
  }
  if (latestAml && new Date(latestAml.expires_at) < new Date()) {
    violations.push('AML_SCREENING_EXPIRED')
  }

  // 3. Investor type + segmentation rules
  const investor_type = await getInvestorType(investorId, tenantId)
  const rule = SEGMENTATION_RULES[investor_type]

  // Cross-border check
  if (isCrossBorder && !rule.cross_border_allowed) {
    violations.push('CROSS_BORDER_NOT_ALLOWED')
  }

  // Exposure + asset class check
  const exposureCheck = await checkExposureLimit(investorId, tenantId, bidAmountEurCents, assetClass)
  if (!exposureCheck.allowed && exposureCheck.reason) {
    violations.push(exposureCheck.reason)
  }

  return {
    eligible: violations.length === 0,
    violations,
  }
}
