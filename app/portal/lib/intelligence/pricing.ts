// =============================================================================
// AGENCY GROUP — Pricing Optimisation Signal Engine v1.0
// Module:  intelligence/pricing.ts
// Purpose: Detect pricing misalignment or strong-demand signals from internal
//          deal data only. No external market feeds, no random data.
//
// Design notes:
//   • Pure functions — no side effects, no I/O, no external state
//   • Signals are counted discretely (≥2 needed for actionable output)
//   • POSSIBLY_OVERPRICED and STRONG_DEMAND require ≥2 independent signals
//   • WATCH is the intermediate state: 1 overpricing signal, not enough for flag
//   • NEUTRAL is the safe default when there is insufficient evidence
//   • checklistCompletionRate is inlined (not imported from dealScoring) to
//     prevent circular dependency risk as the module graph grows
//   • daysUntil / daysSince are inlined (not imported from prediction.ts)
//   • STALLED_NO_ACTIVITY_SIGNAL checked by DealRiskFlagCode string match
// =============================================================================

import type { Deal } from '../../components/types'
import type { DealScoreResult } from '../dealScoring'
import { parsePTValue } from '../../utils/format'

// ─── Exported Types ───────────────────────────────────────────────────────────

export type PricingSignal = 'POSSIBLY_OVERPRICED' | 'STRONG_DEMAND' | 'WATCH' | 'NEUTRAL'

export interface PricingInsight {
  signal: PricingSignal
  label: string
  reasoning: string[]
  suggestedAction: 'REVIEW_PRICE' | 'HOLD' | 'MONITOR' | 'TEST_ADJUSTMENT'
  confidence: 'high' | 'medium' | 'low'
}

// ─── Stage benchmark: healthy maximum days per stage (copy — no circular dep) ─

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

// ─── Stages considered "late" for buyer-hesitation assessment ────────────────

const LATE_STAGES = new Set([
  'Proposta Aceite',
  'Negociação',
  'Due Diligence',
  'CPCV Assinado',
  'Financiamento',
  'Escritura Marcada',
])

// ─── Inline date helpers ──────────────────────────────────────────────────────

/** Days since a past date. Null on missing/invalid input. */
function daysSince(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  return Math.floor((Date.now() - d.getTime()) / 86_400_000)
}

// ─── Inline checklist completion helper (mirrors dealScoring.ts) ─────────────

function checklistCompletionRate(checklist: Record<string, boolean[]>): number {
  if (!checklist || Object.keys(checklist).length === 0) return 0
  let total = 0
  let done  = 0
  for (const items of Object.values(checklist)) {
    if (!Array.isArray(items)) continue
    total += items.length
    done  += items.filter(Boolean).length
  }
  return total === 0 ? 0 : done / total
}

// ─── Main pricing insight function ───────────────────────────────────────────

export function computePricingInsight(deal: Deal, scoring: DealScoreResult): PricingInsight {
  const dealWithCreated = deal as Deal & { createdAt?: string }
  const dealAge         = daysSince(dealWithCreated.createdAt)
  const benchmark       = STAGE_BENCHMARK_DAYS[deal.fase] ?? 14
  const completionRate  = checklistCompletionRate(deal.checklist ?? {})
  const completionPct   = Math.round(completionRate * 100)
  const dealValue       = parsePTValue(deal.valor)
  const isLateStage     = LATE_STAGES.has(deal.fase)

  // ── Count POSSIBLY_OVERPRICED signals ────────────────────────────────────

  let overpricedSignals = 0
  const overpricedReasons: string[] = []

  // Signal 1: Deal age > 2× stage benchmark
  if (dealAge !== null && dealAge > benchmark * 2) {
    overpricedSignals++
    overpricedReasons.push(
      `Deal com ${dealAge}d (>${2}× benchmark ${benchmark}d) — progressão estagnada`
    )
  }

  // Signal 2: Checklist < 30% AND stage is late (buyer hesitation proxy)
  if (completionPct < 30 && isLateStage && Object.keys(deal.checklist ?? {}).length > 0) {
    overpricedSignals++
    overpricedReasons.push(
      `Checklist apenas ${completionPct}% em fase "${deal.fase}" — possível hesitação do comprador`
    )
  }

  // Signal 3: STALLED_NO_ACTIVITY_SIGNAL present in risk flags
  const hasStalled = scoring.dealRiskFlags.some(
    f => f.code === 'STALLED_NO_ACTIVITY_SIGNAL'
  )
  if (hasStalled) {
    overpricedSignals++
    overpricedReasons.push('Sinal STALLED_NO_ACTIVITY — deal parado sem datas definidas')
  }

  // Signal 4: CRITICO score on high-value deal
  if (scoring.dealScore < 35 && dealValue >= 500_000) {
    overpricedSignals++
    overpricedReasons.push(
      `Score CRÍTICO (${scoring.dealScore}) em deal ≥€500K — risco de sobrevalorização`
    )
  }

  // ── Count STRONG_DEMAND signals ──────────────────────────────────────────

  let demandSignals = 0
  const demandReasons: string[] = []

  // Signal 1: High closure probability, no HIGH-severity flags
  const hasHighRisk = scoring.dealRiskFlags.some(f => f.severity === 'high')
  if (scoring.closurePct >= 75 && !hasHighRisk) {
    demandSignals++
    demandReasons.push(
      `Probabilidade de fecho ${scoring.closurePct}% sem riscos críticos — sinal de procura forte`
    )
  }

  // Signal 2: Checklist > 60% (proxy for proposal/cpcv activity progression)
  if (completionPct > 60) {
    demandSignals++
    demandReasons.push(`Checklist ${completionPct}% — documentação avançada, comprador comprometido`)
  }

  // Signal 3: Deal within benchmark AND in late stage (fast progression)
  if (dealAge !== null && dealAge <= benchmark && isLateStage) {
    demandSignals++
    demandReasons.push(
      `Progressão rápida: ${dealAge}d ≤ benchmark ${benchmark}d em fase "${deal.fase}"`
    )
  }

  // Signal 4: High composite score
  if (scoring.dealScore >= 70) {
    demandSignals++
    demandReasons.push(`Score composite ${scoring.dealScore}/100 — deal saudável e bem documentado`)
  }

  // ── Determine signal and build output ────────────────────────────────────

  // POSSIBLY_OVERPRICED requires ≥2 overpriced signals
  if (overpricedSignals >= 2) {
    return {
      signal:          'POSSIBLY_OVERPRICED',
      label:           'Possível sobrevalorização',
      reasoning:       overpricedReasons,
      suggestedAction: 'REVIEW_PRICE',
      confidence:      overpricedSignals >= 3 ? 'high' : 'medium',
    }
  }

  // STRONG_DEMAND requires ≥2 demand signals
  if (demandSignals >= 2) {
    return {
      signal:          'STRONG_DEMAND',
      label:           'Alta procura detectada',
      reasoning:       demandReasons,
      suggestedAction: 'HOLD',
      confidence:      demandSignals >= 3 ? 'high' : 'medium',
    }
  }

  // WATCH: exactly 1 overpricing signal — monitor, not yet actionable
  if (overpricedSignals === 1) {
    return {
      signal:          'WATCH',
      label:           'Monitorizar evolução',
      reasoning:       overpricedReasons,
      suggestedAction: 'MONITOR',
      confidence:      'low',
    }
  }

  // NEUTRAL: insufficient signals for any conclusion
  return {
    signal:          'NEUTRAL',
    label:           'Sem sinal de pricing',
    reasoning:       ['Dados insuficientes para determinar sinal de pricing'],
    suggestedAction: 'MONITOR',
    confidence:      'low',
  }
}

// ─── Batch pricing insights ───────────────────────────────────────────────────

export function computeAllPricingInsights(
  scoredDeals: Array<{ deal: Deal; scoring: DealScoreResult }>
): Array<{ dealRef: string; dealImovel: string; dealValor: string; insight: PricingInsight }> {
  const SIGNAL_ORDER: Record<PricingSignal, number> = {
    POSSIBLY_OVERPRICED: 0,
    WATCH:               1,
    STRONG_DEMAND:       2,
    NEUTRAL:             3,
  }

  return scoredDeals
    // Exclude closed deals and neutral results
    .filter(({ deal }) => deal.fase !== 'Escritura Concluída')
    .map(({ deal, scoring }) => ({
      dealRef:    deal.ref    ?? '',
      dealImovel: deal.imovel ?? '',
      dealValor:  deal.valor  ?? '',
      insight:    computePricingInsight(deal, scoring),
    }))
    .filter(({ insight }) => insight.signal !== 'NEUTRAL')
    .sort((a, b) => SIGNAL_ORDER[a.insight.signal] - SIGNAL_ORDER[b.insight.signal])
}
