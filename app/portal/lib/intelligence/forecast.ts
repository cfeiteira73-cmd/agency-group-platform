// =============================================================================
// AGENCY GROUP — Intelligence Layer: Revenue Forecasting (forecast.ts)
//
// Module:  forecast.ts
// Purpose: Deterministic GCI (Gross Commission Income) forecasting derived
//          purely from ScoredDeal[] outputs produced by dealScoring.ts.
//
// Design notes:
//   • No new scoring logic — all probability weights come from dealScoring.
//   • Three forecast windows: 30d (monthly), 90d (quarterly), 180d (semi-annual).
//   • Commission rate fixed at 5% per AG Elite standard.
//   • Pessimistic / optimistic bands are simple ±25% around expected GCI.
//   • All numbers are Math.round()ed; parsePTValue returns 0 for unparseable
//     values so expectedCommission can never be NaN.
//   • Pure TypeScript, no React, no side-effects.
// =============================================================================

import type { ScoredDeal } from '../dealScoring'
import { parsePTValue } from '../../utils/format'

// ─── Public Types ─────────────────────────────────────────────────────────────

export interface ForecastContributor {
  dealRef: string
  dealImovel: string
  dealValor: string
  dealFase: string
  expectedCommission: number   // dealValue * 0.05 * (closurePct / 100)
  closurePct: number
  band: string                 // closureProbabilityBand
}

export interface PeriodForecast {
  period: '30d' | '90d' | '180d'
  expectedGCI: number          // sum of expectedCommission for included deals
  pessimisticGCI: number       // expectedGCI * 0.75
  optimisticGCI: number        // expectedGCI * 1.25
  dealsCount: number
  confidence: 'high' | 'medium' | 'low'
  topContributors: ForecastContributor[]  // max 3, sorted by expectedCommission desc
}

export interface ForecastOutput {
  monthly: PeriodForecast      // 30d — closureProbabilityBand 'ALTA' only
  quarterly: PeriodForecast    // 90d — ALTA + MEDIA bands
  semiAnnual: PeriodForecast   // 180d — all active deals
  rawPipelineGCI: number       // sum of ALL deal values * 0.05 (unweighted, 100%)
  weightedPipelineGCI: number  // sum of expectedCommission across ALL active deals
  generatedAt: number          // Date.now() — for display
}

// ─── Internal Constants ────────────────────────────────────────────────────────

const COMMISSION_RATE = 0.05

// Fases that are treated as late-stage (included in monthly even without a date)
const LATE_STAGES_FOR_MONTHLY = new Set([
  'Escritura Marcada',
  'CPCV Assinado',
  'Financiamento',
])

// Fases eligible for inclusion in the quarterly window for MEDIA band deals
const QUARTERLY_MEDIA_STAGES = new Set([
  'Negociação',
  'Due Diligence',
  'CPCV Assinado',
  'Financiamento',
  'Escritura Marcada',
  'Proposta Aceite',
])

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  return Math.floor((d.getTime() - Date.now()) / 86400000)
}

function computeExpectedCommission(scored: ScoredDeal): number {
  const dealValue = parsePTValue(scored.deal.valor)
  if (dealValue <= 0) return 0
  return dealValue * COMMISSION_RATE * (scored.scoring.closurePct / 100)
}

function toContributor(scored: ScoredDeal): ForecastContributor {
  return {
    dealRef:            scored.deal.ref,
    dealImovel:         scored.deal.imovel,
    dealValor:          scored.deal.valor,
    dealFase:           scored.deal.fase,
    expectedCommission: Math.round(computeExpectedCommission(scored)),
    closurePct:         scored.scoring.closurePct,
    band:               scored.scoring.closureProbabilityBand,
  }
}

function topThree(deals: ScoredDeal[]): ForecastContributor[] {
  return deals
    .map(toContributor)
    .sort((a, b) => b.expectedCommission - a.expectedCommission)
    .slice(0, 3)
}

/**
 * Count how many deals in a set have at least one real date (cpcvDate or escrituraDate).
 */
function countWithRealDates(deals: ScoredDeal[]): number {
  return deals.filter(s =>
    daysUntil(s.deal.cpcvDate) !== null || daysUntil(s.deal.escrituraDate) !== null
  ).length
}

function computeConfidence(
  deals: ScoredDeal[],
): 'high' | 'medium' | 'low' {
  const withRealDates = countWithRealDates(deals)
  if (withRealDates >= 3) return 'high'
  if (withRealDates >= 1 || deals.length >= 3) return 'medium'
  return 'low'
}

function buildPeriodForecast(
  period: '30d' | '90d' | '180d',
  deals: ScoredDeal[],
): PeriodForecast {
  const expectedGCI = Math.round(
    deals.reduce((sum, s) => sum + computeExpectedCommission(s), 0),
  )
  return {
    period,
    expectedGCI,
    pessimisticGCI: Math.round(expectedGCI * 0.75),
    optimisticGCI:  Math.round(expectedGCI * 1.25),
    dealsCount:     deals.length,
    confidence:     computeConfidence(deals),
    topContributors: topThree(deals),
  }
}

// ─── Monthly (30d) inclusion predicate ────────────────────────────────────────

function includeInMonthly(scored: ScoredDeal): boolean {
  if (scored.scoring.closureProbabilityBand !== 'ALTA') return false

  // Always include late-stage fases regardless of calendar date
  if (LATE_STAGES_FOR_MONTHLY.has(scored.deal.fase)) return true

  // Include if nearest date is within 30 days
  const cpcvDays      = daysUntil(scored.deal.cpcvDate)
  const escrituraDays = daysUntil(scored.deal.escrituraDate)
  const dates = [cpcvDays, escrituraDays].filter((d): d is number => d !== null)
  if (dates.length === 0) return false
  const nearest = Math.min(...dates)
  return nearest <= 30
}

// ─── Quarterly (90d) inclusion predicate ──────────────────────────────────────

function includeInQuarterly(scored: ScoredDeal): boolean {
  const band = scored.scoring.closureProbabilityBand
  if (band === 'ALTA') return true
  if (band === 'MEDIA' && QUARTERLY_MEDIA_STAGES.has(scored.deal.fase)) return true
  return false
}

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * Generates a three-window revenue forecast from pre-scored deals.
 *
 * @param scoredDeals - Output of scoreAllDeals() or any ScoredDeal[] array.
 *                      Closed deals (Escritura Concluída) are filtered out
 *                      internally if present.
 */
export function generateRevenueForecast(scoredDeals: ScoredDeal[]): ForecastOutput {
  // Active pipeline only — closed deals carry no future revenue expectation
  const activeDeals = scoredDeals.filter(s => s.deal.fase !== 'Escritura Concluída')

  // Period buckets
  const monthlyDeals    = activeDeals.filter(includeInMonthly)
  const quarterlyDeals  = activeDeals.filter(includeInQuarterly)
  const semiAnnualDeals = activeDeals  // all active

  // Pipeline aggregates (unweighted and weighted)
  const rawPipelineGCI = Math.round(
    activeDeals.reduce((sum, s) => {
      const v = parsePTValue(s.deal.valor)
      return sum + (v > 0 ? v * COMMISSION_RATE : 0)
    }, 0),
  )

  const weightedPipelineGCI = Math.round(
    activeDeals.reduce((sum, s) => sum + computeExpectedCommission(s), 0),
  )

  return {
    monthly:            buildPeriodForecast('30d',  monthlyDeals),
    quarterly:          buildPeriodForecast('90d',  quarterlyDeals),
    semiAnnual:         buildPeriodForecast('180d', semiAnnualDeals),
    rawPipelineGCI,
    weightedPipelineGCI,
    generatedAt:        Date.now(),
  }
}
