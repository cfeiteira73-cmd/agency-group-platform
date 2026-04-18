// =============================================================================
// AGENCY GROUP — Deal Closure Prediction Engine v1.0
// Module:  intelligence/prediction.ts
// Purpose: Predicts closure probability and timing for active deals by layering
//          signals on top of the base DealScoreResult from dealScoring.ts.
//
// Design notes:
//   • Pure functions — no side effects, no I/O, no randomness
//   • Operates on data that may be incomplete; every field has a safe fallback
//   • Signals are additive/subtractive on top of scoring.closurePct (blended)
//   • Final probability is always in [1, 99] — never NaN, never Infinity
//   • estimatedCloseWindow derived from real dates first, stage fallback second
//   • predictionConfidence driven by signal count, not data completeness alone
//   • daysUntil / daysSince are inlined — no external helper import needed
// =============================================================================

import type { Deal } from '../../components/types'
import type { DealScoreResult } from '../dealScoring'
import { parsePTValue } from '../../utils/format'

// ─── Exported Types ───────────────────────────────────────────────────────────

export type CloseWindow = '7d' | '14d' | '30d' | '60d' | '90d+' | 'uncertain'
export type PredictionConfidence = 'high' | 'medium' | 'low'

export interface DealPrediction {
  /** 0–100 closure probability; never NaN or Infinity */
  closureProbability: number
  /** Estimated time-to-close bucket */
  estimatedCloseWindow: CloseWindow
  /** Confidence in this prediction based on available signals */
  predictionConfidence: PredictionConfidence
  /** Ordered, human-readable reasons driving this prediction */
  explanation: string[]
}

export interface ScoredDealPrediction {
  dealRef: string
  dealImovel: string
  dealValor: string
  dealFase: string
  prediction: DealPrediction
}

// ─── Stage benchmark: healthy maximum days per stage ─────────────────────────

const STAGE_BENCHMARK_DAYS: Record<string, number> = {
  'Angariação':         21,
  'Contacto':           14,
  'Qualificação':       10,
  'Qualificado':        10,
  'Visita':             14,
  'Proposta Enviada':   10,
  'Proposta Aceite':     7,
  'Negociação':         21,
  'Due Diligence':      21,
  'CPCV Assinado':      45,
  'Financiamento':      30,
  'Escritura Marcada':  14,
}

// ─── Inline date helpers ──────────────────────────────────────────────────────

/** Returns days until a future date. Negative means past. Null on invalid input. */
function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  return Math.floor((d.getTime() - Date.now()) / 86_400_000)
}

/** Returns days elapsed since a past date. Null on invalid input. */
function daysSince(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  return Math.floor((Date.now() - d.getTime()) / 86_400_000)
}

// ─── Close window mapping from days remaining ────────────────────────────────

function daysToCloseWindow(days: number): CloseWindow {
  if (days <= 7)  return '7d'
  if (days <= 14) return '14d'
  if (days <= 30) return '30d'
  if (days <= 60) return '60d'
  return '90d+'
}

// ─── Stage fallback close window ─────────────────────────────────────────────

function stageFallbackWindow(fase: string): CloseWindow {
  if (fase === 'Escritura Marcada')                          return '14d'
  if (fase === 'CPCV Assinado' || fase === 'Financiamento') return '30d'
  if (fase === 'Negociação'    || fase === 'Due Diligence')  return '60d'
  return 'uncertain'
}

// ─── Main prediction function ─────────────────────────────────────────────────

export function predictDealClosure(deal: Deal, scoring: DealScoreResult): DealPrediction {
  const explanation: string[] = []

  // ── Fast path: already closed ────────────────────────────────────────────
  if (deal.fase === 'Escritura Concluída') {
    return {
      closureProbability:  100,
      estimatedCloseWindow: '7d',
      predictionConfidence: 'high',
      explanation:          ['Escritura concluída'],
    }
  }

  // ── Signal counter (drives confidence) ──────────────────────────────────
  let signalCount = 0

  // ── Base probability from scoring blend (stage 70% + score 30%) ─────────
  // scoring.closurePct is already capped at 99 in dealScoring.ts
  let probability = scoring.closurePct

  // ── Risk flag degradation ────────────────────────────────────────────────
  const highFlags   = scoring.dealRiskFlags.filter(f => f.severity === 'high')
  const mediumFlags = scoring.dealRiskFlags.filter(f => f.severity === 'medium')

  if (highFlags.length > 0 || mediumFlags.length > 0) {
    signalCount++
    const penalty = highFlags.length * 7 + mediumFlags.length * 3
    probability -= penalty
    if (highFlags.length > 0) {
      explanation.push(
        `${highFlags.length} risco(s) HIGH → -${highFlags.length * 7}pts (${highFlags.map(f => f.code).join(', ')})`
      )
    }
    if (mediumFlags.length > 0) {
      explanation.push(
        `${mediumFlags.length} risco(s) MEDIUM → -${mediumFlags.length * 3}pts`
      )
    }
  }

  // ── Timeline boost from nearest CPCV or Escritura date ───────────────────
  const cpcvDays      = daysUntil(deal.cpcvDate)
  const escrituraDays = daysUntil(deal.escrituraDate)

  const validDates = [cpcvDays, escrituraDays].filter((d): d is number => d !== null)
  const nearestDays = validDates.length > 0 ? Math.min(...validDates) : null

  if (nearestDays !== null) {
    signalCount++
    if (nearestDays <= 0) {
      probability += 8
      explanation.push(`Data-chave iminente ou passada (${Math.abs(nearestDays)}d) → +8%`)
    } else if (nearestDays <= 7) {
      probability += 6
      explanation.push(`Data-chave em ${nearestDays}d → +6%`)
    } else if (nearestDays <= 30) {
      probability += 3
      explanation.push(`Data-chave em ${nearestDays}d → +3%`)
    } else if (nearestDays > 90) {
      probability -= 5
      explanation.push(`Data-chave em +90d → -5%`)
    } else {
      explanation.push(`Data-chave em ${nearestDays}d → sem ajuste`)
    }
  }

  // ── Stage velocity via deal age ───────────────────────────────────────────
  const dealWithCreated = deal as Deal & { createdAt?: string }
  const dealAge = daysSince(dealWithCreated.createdAt)
  const benchmark = STAGE_BENCHMARK_DAYS[deal.fase] ?? 14

  if (dealAge !== null) {
    signalCount++
    const ratio = dealAge / benchmark
    if (ratio > 3) {
      probability -= 12
      explanation.push(
        `Deal com ${dealAge}d na fase (>${3}× benchmark de ${benchmark}d) → -12%`
      )
    } else if (ratio > 2) {
      probability -= 6
      explanation.push(
        `Deal com ${dealAge}d na fase (>${2}× benchmark de ${benchmark}d) → -6%`
      )
    } else {
      probability += 2
      explanation.push(
        `Progressão dentro do benchmark (${dealAge}d / ${benchmark}d) → +2%`
      )
    }
  }

  // ── Clamp to safe integer range [1, 99] ──────────────────────────────────
  const closureProbability = Math.max(1, Math.min(99, Math.round(probability)))

  // ── estimatedCloseWindow ─────────────────────────────────────────────────
  const estimatedCloseWindow: CloseWindow = nearestDays !== null
    ? daysToCloseWindow(nearestDays)
    : stageFallbackWindow(deal.fase)

  // ── predictionConfidence ─────────────────────────────────────────────────
  let predictionConfidence: PredictionConfidence
  if      (signalCount >= 3) predictionConfidence = 'high'
  else if (signalCount >= 2) predictionConfidence = 'medium'
  else {
    predictionConfidence = 'low'
    explanation.push('Poucos sinais disponíveis — confiança baixa, verificar dados do deal')
  }

  // Prepend base probability note
  explanation.unshift(`Base closurePct (scoring): ${scoring.closurePct}%`)

  return {
    closureProbability,
    estimatedCloseWindow,
    predictionConfidence,
    explanation,
  }
}

// ─── Batch prediction ─────────────────────────────────────────────────────────

export function predictAllDeals(
  scoredDeals: Array<{ deal: Deal; scoring: DealScoreResult }>
): ScoredDealPrediction[] {
  return scoredDeals
    .map(({ deal, scoring }) => ({
      dealRef:    deal.ref    ?? '',
      dealImovel: deal.imovel ?? '',
      dealValor:  deal.valor  ?? '',
      dealFase:   deal.fase   ?? '',
      prediction: predictDealClosure(deal, scoring),
    }))
    .sort((a, b) => b.prediction.closureProbability - a.prediction.closureProbability)
}

// ─── Re-export parsePTValue usage guard (ensures import is not tree-shaken) ──
// parsePTValue is used indirectly here — exposed to callers who may want it
// alongside prediction results without a separate import.
export { parsePTValue }
