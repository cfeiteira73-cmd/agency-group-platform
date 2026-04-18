// =============================================================================
// AGENCY GROUP — Executive Ranking Engine v1.0
// Module:  intelligence/executiveRanking.ts
// Purpose: Portfolio-level ranking and health scoring from existing scoring
//          outputs. Produces the top-10 contact and deal views plus a composite
//          portfolio health index for executive dashboards.
//
// Design notes:
//   • All ranking is purely derived from already-scored data — no re-scoring
//   • parsePTValue handles Portuguese-formatted value strings safely (no NaN)
//   • Divide-by-zero safe: all means check length > 0 before dividing
//   • No side effects, no storage, no React — pure TypeScript computation
// =============================================================================

import type { ScoredContact } from '../leadScoring'
import type { ScoredDeal } from '../dealScoring'
import { parsePTValue } from '../../utils/format'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RankedContact {
  contactId: number
  contactName: string
  rank: number
  leadScore: number
  band: string                    // A / B / C / D
  /** budgetMax * 0.05 * (score/100) — probability-weighted commission */
  revenueOpportunity: number
  /** budgetMax * 0.05 — unweighted gross commission potential */
  rawRevenueOpportunity: number
  /** true when band A, or band B with score >= 55 */
  isUrgent: boolean
}

export interface RankedDeal {
  dealId: number
  dealRef: string
  dealImovel: string
  dealFase: string
  rank: number
  dealScore: number
  dealHealth: string
  closurePct: number
  /** parsePTValue(valor) * 0.05 */
  rawCommission: number
  /** rawCommission * (closurePct / 100) */
  expectedCommission: number
}

export type PortfolioHealthLabel = 'EXCELENTE' | 'BOM' | 'MODERADO' | 'EM_RISCO'

export interface PortfolioHealth {
  /** 0–100 weighted composite (leads 30%, deals 40%, closure 30%) */
  score: number
  label: PortfolioHealthLabel
  /** Mean of all contact lead scores */
  avgLeadScore: number
  /** Mean of dealScore for active deals (excluding Escritura Concluída) */
  avgDealScore: number
  /** Mean of closurePct for active deals */
  avgClosurePct: number
  /** Count of contacts with band D */
  contactsAtRisk: number
  /** Count of active deals with health CRITICO or EM_RISCO */
  dealsAtRisk: number
  /** Sum of (parsePTValue(valor) * 0.05 * closurePct/100) for active deals */
  totalWeightedGCI: number
  /** Sum of (parsePTValue(valor) * 0.05) for active deals */
  totalRawGCI: number
}

export interface ExecutiveRankingOutput {
  /** Top 10 contacts by revenueOpportunity descending */
  topContacts: RankedContact[]
  /** Top 10 deals by expectedCommission descending */
  topDeals: RankedDeal[]
  portfolioHealth: PortfolioHealth
}

// ─── rankContacts ─────────────────────────────────────────────────────────────

/**
 * Maps all scored contacts to RankedContact, sorts by revenueOpportunity
 * descending, and assigns sequential ranks starting at 1.
 * Returns all contacts — callers slice as needed.
 */
export function rankContacts(contacts: ScoredContact[]): RankedContact[] {
  const mapped: RankedContact[] = contacts.map(({ contact, scoring }) => {
    const budgetMax = contact.budgetMax ?? 0
    const score = scoring.score ?? 0
    const rawRevenueOpportunity = budgetMax * 0.05
    const revenueOpportunity = rawRevenueOpportunity * (score / 100)
    const isUrgent =
      scoring.band === 'A' ||
      (scoring.band === 'B' && score >= 55)

    return {
      contactId: contact.id,
      contactName: contact.name,
      rank: 0, // assigned after sort
      leadScore: score,
      band: scoring.band,
      revenueOpportunity: Math.round(revenueOpportunity),
      rawRevenueOpportunity: Math.round(rawRevenueOpportunity),
      isUrgent,
    }
  })

  mapped.sort((a, b) => b.revenueOpportunity - a.revenueOpportunity)

  return mapped.map((item, idx) => ({ ...item, rank: idx + 1 }))
}

// ─── rankDeals ────────────────────────────────────────────────────────────────

/**
 * Filters out completed deals, computes commissions, sorts by
 * expectedCommission descending, and assigns sequential ranks starting at 1.
 * Returns all active ranked deals — callers slice as needed.
 */
export function rankDeals(deals: ScoredDeal[]): RankedDeal[] {
  const active = deals.filter(({ deal }) => deal.fase !== 'Escritura Concluída')

  const mapped: RankedDeal[] = active.map(({ deal, scoring }) => {
    const rawCommission = parsePTValue(deal.valor) * 0.05
    const expectedCommission = rawCommission * ((scoring.closurePct ?? 0) / 100)

    return {
      dealId: deal.id,
      dealRef: deal.ref ?? String(deal.id),
      dealImovel: deal.imovel ?? '',
      dealFase: deal.fase ?? '',
      rank: 0, // assigned after sort
      dealScore: scoring.dealScore,
      dealHealth: scoring.dealHealth,
      closurePct: scoring.closurePct,
      rawCommission: Math.round(rawCommission),
      expectedCommission: Math.round(expectedCommission),
    }
  })

  mapped.sort((a, b) => b.expectedCommission - a.expectedCommission)

  return mapped.map((item, idx) => ({ ...item, rank: idx + 1 }))
}

// ─── computePortfolioHealth ───────────────────────────────────────────────────

export function computePortfolioHealth(
  contacts: ScoredContact[],
  deals: ScoredDeal[],
): PortfolioHealth {

  // ── avgLeadScore ──────────────────────────────────────────────────────────
  const avgLeadScore = contacts.length > 0
    ? contacts.reduce((sum, { scoring }) => sum + (scoring.score ?? 0), 0) / contacts.length
    : 0

  // ── Active deals (exclude Escritura Concluída) ────────────────────────────
  const activeDeals = deals.filter(({ deal }) => deal.fase !== 'Escritura Concluída')

  // ── avgDealScore ──────────────────────────────────────────────────────────
  const avgDealScore = activeDeals.length > 0
    ? activeDeals.reduce((sum, { scoring }) => sum + (scoring.dealScore ?? 0), 0) / activeDeals.length
    : 0

  // ── avgClosurePct ─────────────────────────────────────────────────────────
  const avgClosurePct = activeDeals.length > 0
    ? activeDeals.reduce((sum, { scoring }) => sum + (scoring.closurePct ?? 0), 0) / activeDeals.length
    : 0

  // ── contactsAtRisk ────────────────────────────────────────────────────────
  const contactsAtRisk = contacts.filter(({ scoring }) => scoring.band === 'D').length

  // ── dealsAtRisk ───────────────────────────────────────────────────────────
  const dealsAtRisk = activeDeals.filter(({ scoring }) =>
    scoring.dealHealth === 'CRITICO' || scoring.dealHealth === 'EM_RISCO',
  ).length

  // ── GCI totals ────────────────────────────────────────────────────────────
  const totalWeightedGCI = activeDeals.reduce(({ sum }, { deal, scoring }) => {
    const commission = parsePTValue(deal.valor) * 0.05 * ((scoring.closurePct ?? 0) / 100)
    return { sum: sum + commission }
  }, { sum: 0 }).sum

  const totalRawGCI = activeDeals.reduce(({ sum }, { deal }) => {
    return { sum: sum + parsePTValue(deal.valor) * 0.05 }
  }, { sum: 0 }).sum

  // ── Composite score ───────────────────────────────────────────────────────
  const leadComponent  = Math.min(100, avgLeadScore)   // weight 30%
  const dealComponent  = Math.min(100, avgDealScore)   // weight 40%
  const closureComp    = Math.min(100, avgClosurePct)  // weight 30%
  const score = Math.round(leadComponent * 0.3 + dealComponent * 0.4 + closureComp * 0.3)

  // ── Label ─────────────────────────────────────────────────────────────────
  let label: PortfolioHealthLabel
  if      (score >= 75) label = 'EXCELENTE'
  else if (score >= 55) label = 'BOM'
  else if (score >= 35) label = 'MODERADO'
  else                  label = 'EM_RISCO'

  return {
    score,
    label,
    avgLeadScore:     Math.round(avgLeadScore),
    avgDealScore:     Math.round(avgDealScore),
    avgClosurePct:    Math.round(avgClosurePct),
    contactsAtRisk,
    dealsAtRisk,
    totalWeightedGCI: Math.round(totalWeightedGCI),
    totalRawGCI:      Math.round(totalRawGCI),
  }
}

// ─── generateExecutiveRanking ─────────────────────────────────────────────────

export function generateExecutiveRanking(
  contacts: ScoredContact[],
  deals: ScoredDeal[],
): ExecutiveRankingOutput {
  const allRankedContacts = rankContacts(contacts)
  const allRankedDeals    = rankDeals(deals)
  const portfolioHealth   = computePortfolioHealth(contacts, deals)

  return {
    topContacts:     allRankedContacts.slice(0, 10),
    topDeals:        allRankedDeals.slice(0, 10),
    portfolioHealth,
  }
}
