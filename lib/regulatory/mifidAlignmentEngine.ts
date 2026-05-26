// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — MiFID II Alignment Engine v1.0
// lib/regulatory/mifidAlignmentEngine.ts
//
// MiFID II investor classification, transaction reporting, best execution.
// =============================================================================

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type MiFIDTier = 'RETAIL' | 'PROFESSIONAL' | 'ELIGIBLE_COUNTERPARTY'

export interface MiFIDClassification {
  classification_id: string
  tenant_id: string
  investor_id: string
  tier: MiFIDTier
  classification_basis: string[]
  portfolio_value_eur_cents: number
  professional_experience_years: number | null
  opt_up_requested: boolean
  opt_down_requested: boolean
  valid_from: string
  valid_until: string
  classified_by: string
  classified_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nowIso(): string {
  return new Date().toISOString()
}

function yearsFromNow(years: number): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() + years)
  return d.toISOString()
}

// ─── Investor Classification ──────────────────────────────────────────────────

/**
 * Determines MiFID II tier based on portfolio value and experience.
 * Thresholds (EUR cents):
 *   ELIGIBLE_COUNTERPARTY: >= €10,000,000 (1_000_000_000 cents)
 *   PROFESSIONAL: >= €2,000,000 (200_000_000 cents) OR (>= €500,000 AND experience >= 2 yr)
 *   RETAIL: otherwise
 */
export async function classifyInvestor(
  investorId: string,
  tenantId: string,
  portfolioValueEurCents: number,
  professionalExperienceYears?: number,
): Promise<MiFIDClassification> {
  const basis: string[] = []
  let tier: MiFIDTier = 'RETAIL'

  if (portfolioValueEurCents >= 1_000_000_000) {
    tier = 'ELIGIBLE_COUNTERPARTY'
    basis.push('PORTFOLIO_SIZE')
  } else if (portfolioValueEurCents >= 200_000_000) {
    tier = 'PROFESSIONAL'
    basis.push('PORTFOLIO_SIZE')
  } else if (
    portfolioValueEurCents >= 50_000_000 &&
    (professionalExperienceYears ?? 0) >= 2
  ) {
    tier = 'PROFESSIONAL'
    basis.push('PORTFOLIO_SIZE', 'PROFESSIONAL_EXPERIENCE')
  } else {
    tier = 'RETAIL'
    if (portfolioValueEurCents > 0) basis.push('PORTFOLIO_SIZE')
    if ((professionalExperienceYears ?? 0) > 0) basis.push('PROFESSIONAL_EXPERIENCE')
  }

  const classification: MiFIDClassification = {
    classification_id: randomUUID(),
    tenant_id: tenantId,
    investor_id: investorId,
    tier,
    classification_basis: basis,
    portfolio_value_eur_cents: portfolioValueEurCents,
    professional_experience_years: professionalExperienceYears ?? null,
    opt_up_requested: false,
    opt_down_requested: false,
    valid_from: nowIso(),
    valid_until: yearsFromNow(1),
    classified_by: 'SYSTEM',
    classified_at: nowIso(),
  }

  void (supabaseAdmin as any)
    .from('mifid_classifications')
    .insert({
      classification_id: classification.classification_id,
      tenant_id: classification.tenant_id,
      investor_id: classification.investor_id,
      tier: classification.tier,
      classification_basis: classification.classification_basis,
      portfolio_value_eur_cents: classification.portfolio_value_eur_cents,
      professional_experience_years: classification.professional_experience_years,
      opt_up_requested: classification.opt_up_requested,
      opt_down_requested: classification.opt_down_requested,
      valid_from: classification.valid_from,
      valid_until: classification.valid_until,
      classified_by: classification.classified_by,
      classified_at: classification.classified_at,
    })
    .catch((e: unknown) => log.warn('[mifidAlignmentEngine] persist classification failed', { e }))

  log.info('[mifidAlignmentEngine] investor classified', {
    investor_id: investorId,
    tier,
    portfolio_value_eur_cents: portfolioValueEurCents,
  })

  return classification
}

// ─── Get Investor Classification ─────────────────────────────────────────────

export async function getInvestorClassification(
  investorId: string,
  tenantId: string,
): Promise<MiFIDClassification | null> {
  const { data, error } = await (supabaseAdmin as any)
    .from('mifid_classifications')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('investor_id', investorId)
    .gte('valid_until', nowIso())
    .order('classified_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) return null

  const row = data as Record<string, unknown>
  return {
    classification_id: row.classification_id as string,
    tenant_id: row.tenant_id as string,
    investor_id: row.investor_id as string,
    tier: row.tier as MiFIDTier,
    classification_basis: row.classification_basis as string[],
    portfolio_value_eur_cents: row.portfolio_value_eur_cents as number,
    professional_experience_years: row.professional_experience_years as number | null,
    opt_up_requested: row.opt_up_requested as boolean,
    opt_down_requested: row.opt_down_requested as boolean,
    valid_from: row.valid_from as string,
    valid_until: row.valid_until as string,
    classified_by: row.classified_by as string,
    classified_at: row.classified_at as string,
  }
}

// ─── Transaction Reporting ────────────────────────────────────────────────────

export async function reportTransaction(
  tenantId: string,
  dealId: string,
  investorId: string,
  amountEurCents: number,
  instrumentType: string,
): Promise<void> {
  await (supabaseAdmin as any)
    .from('mifid_transaction_reports')
    .insert({
      id: randomUUID(),
      tenant_id: tenantId,
      deal_id: dealId,
      investor_id: investorId,
      amount_eur_cents: amountEurCents,
      instrument_type: instrumentType,
      reported_at: nowIso(),
    })

  log.info('[mifidAlignmentEngine] transaction reported', {
    tenant_id: tenantId,
    deal_id: dealId,
    amount_eur_cents: amountEurCents,
  })
}

// ─── Best Execution Report ────────────────────────────────────────────────────

export async function generateBestExecutionReport(
  tenantId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<{ deals_assessed: number; best_execution_achieved_pct: number }> {
  // Fetch execution outcomes in period
  const { data: outcomes } = await (supabaseAdmin as any)
    .from('execution_outcomes')
    .select('id, deal_id')
    .eq('tenant_id', tenantId)
    .gte('executed_at', periodStart.toISOString())
    .lte('executed_at', periodEnd.toISOString())
    .limit(1000)

  const deals = (outcomes as Array<{ id: string; deal_id: string }> | null) ?? []
  const dealsAssessed = deals.length

  let bestExecutionCount = 0

  if (dealsAssessed > 0) {
    // Check each deal for bid competition (> 1 bid)
    const dealIds = [...new Set(deals.map(d => d.deal_id))]
    for (const dealId of dealIds) {
      const { data: bids } = await (supabaseAdmin as any)
        .from('asset_bids')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('deal_id', dealId)
        .limit(2)
      const bidCount = Array.isArray(bids) ? bids.length : 0
      if (bidCount > 1) bestExecutionCount++
    }
  }

  const bestExecutionAchievedPct = dealsAssessed > 0
    ? Math.round((bestExecutionCount / dealsAssessed) * 10000) / 100
    : 0

  // Persist report
  void (supabaseAdmin as any)
    .from('best_execution_reports')
    .insert({
      id: randomUUID(),
      tenant_id: tenantId,
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      deals_assessed: dealsAssessed,
      best_execution_achieved_pct: bestExecutionAchievedPct,
      generated_at: nowIso(),
    })
    .catch((e: unknown) => log.warn('[mifidAlignmentEngine] persist best execution report failed', { e }))

  log.info('[mifidAlignmentEngine] best execution report generated', {
    tenant_id: tenantId,
    deals_assessed: dealsAssessed,
    best_execution_achieved_pct: bestExecutionAchievedPct,
  })

  return { deals_assessed: dealsAssessed, best_execution_achieved_pct: bestExecutionAchievedPct }
}
