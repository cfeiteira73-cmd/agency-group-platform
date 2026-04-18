// =============================================================================
// AGENCY GROUP — Deal Scoring Engine v1.0
// Deterministic, explainable, safe on incomplete data.
//
// Design principles:
//   • Every dimension has a documented weight and reason string
//   • Missing dates / checklist items degrade score, not crash
//   • Risk flags are explicit, not implicit
//   • dealHealth and closureProbabilityBand computed independently
//   • No ML — every point is traceable and auditable
//   • dealAccelerationActions gives concrete next steps
// =============================================================================

import type { Deal } from '../components/types'
import { parsePTValue } from '../utils/format'

// ─── Output Types ────────────────────────────────────────────────────────────

export type DealHealth     = 'SAUDAVEL' | 'MODERADO' | 'EM_RISCO' | 'CRITICO'
export type ClosureBand    = 'ALTA' | 'MEDIA' | 'BAIXA'
export type DealConfidence = 'high' | 'medium' | 'low' | 'insufficient'

export type DealRiskFlagCode =
  | 'NO_CPCV_DATE_IN_LATE_STAGE'
  | 'NO_ESCRITURA_DATE_IN_LATE_STAGE'
  | 'LOW_CHECKLIST_COMPLETION'
  | 'NO_BUYER_NAME'
  | 'NO_NOTES'
  | 'HIGH_VALUE_LOW_DOCUMENTS'
  | 'STALLED_NO_ACTIVITY_SIGNAL'

export interface DealRiskFlag {
  code: DealRiskFlagCode
  label: string
  severity: 'high' | 'medium' | 'low'
}

export interface DealScoreResult {
  /** 0–100 composite score */
  dealScore: number
  /** Qualitative health label */
  dealHealth: DealHealth
  /** Human-readable health label */
  dealHealthLabel: string
  /** Expected closure probability band */
  closureProbabilityBand: ClosureBand
  /** Closure probability % (stage-adjusted) */
  closurePct: number
  /** Ordered reasons contributing to the score */
  reasons: string[]
  /** Explicit risk flags */
  dealRiskFlags: DealRiskFlag[]
  /** Concrete acceleration actions */
  dealAccelerationActions: string[]
  /** Confidence in the score given data completeness */
  confidence: DealConfidence
}

// ─── Stage probability map ────────────────────────────────────────────────────
// Baseline closure probability from stage alone (matches analytics/summary)
const STAGE_BASE_PROB: Record<string, number> = {
  'Angariação':          5,
  'Contacto':            8,
  'Qualificação':       15,
  'Qualificado':        18,
  'Visita':             30,
  'Proposta Enviada':   45,
  'Proposta Aceite':    60,
  'Negociação':         65,
  'Due Diligence':      72,
  'CPCV Assinado':      85,
  'Financiamento':      78,
  'Escritura Marcada':  92,
  'Escritura Concluída': 100,
}

// ─── Stage score contribution (0–35) ─────────────────────────────────────────
const STAGE_SCORE: Record<string, number> = {
  'Angariação':          3,
  'Contacto':            4,
  'Qualificação':        6,
  'Qualificado':         7,
  'Visita':             10,
  'Proposta Enviada':   14,
  'Proposta Aceite':    18,
  'Negociação':         22,
  'Due Diligence':      26,
  'CPCV Assinado':      32,
  'Financiamento':      28,
  'Escritura Marcada':  35,
}

// ─── Late stages that require date fields ───────────────────────────────────
const STAGES_REQUIRING_CPCV_DATE      = new Set(['CPCV Assinado', 'Financiamento', 'Escritura Marcada'])
const STAGES_REQUIRING_ESCRITURA_DATE = new Set(['Escritura Marcada'])

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  return Math.floor((d.getTime() - Date.now()) / 86400000)
}

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

// ─── Main Scoring Function ───────────────────────────────────────────────────

export function scoreDeal(deal: Deal): DealScoreResult {
  const reasons: string[] = []
  const riskFlags: DealRiskFlag[] = []
  const accelerationActions: string[] = []
  let dimensionsFilled = 0

  // Closed deals get a fixed score (not in active pipeline)
  if (deal.fase === 'Escritura Concluída') {
    return {
      dealScore:              100,
      dealHealth:             'SAUDAVEL',
      dealHealthLabel:        'Concluído',
      closureProbabilityBand: 'ALTA',
      closurePct:             100,
      reasons:                ['Escritura concluída — deal fechado'],
      dealRiskFlags:          [],
      dealAccelerationActions: [],
      confidence:             'high',
    }
  }

  // ── 1. Stage Maturity (0–35) ──────────────────────────────────────────────
  const stagePts = STAGE_SCORE[deal.fase] ?? 4
  const baseProb = STAGE_BASE_PROB[deal.fase] ?? 20
  if (deal.fase) {
    dimensionsFilled++
    reasons.push(`Fase "${deal.fase}" → ${stagePts}/35pts`)
  }

  // ── 2. Value Signal (0–25) ────────────────────────────────────────────────
  let valuePts = 0
  const dealValue = parsePTValue(deal.valor)
  if (dealValue > 0) {
    dimensionsFilled++
    if      (dealValue >= 3_000_000) { valuePts = 25; reasons.push(`Valor ≥€3M → ${valuePts}/25pts`) }
    else if (dealValue >= 1_000_000) { valuePts = 20; reasons.push(`Valor €1M-€3M → ${valuePts}/25pts`) }
    else if (dealValue >=   500_000) { valuePts = 15; reasons.push(`Valor €500K-€1M → ${valuePts}/25pts`) }
    else if (dealValue >=   200_000) { valuePts = 10; reasons.push(`Valor €200K-€500K → ${valuePts}/25pts`) }
    else                             { valuePts =  5; reasons.push(`Valor <€200K → ${valuePts}/25pts`) }
  } else {
    reasons.push('Valor não especificado → 0/25pts')
  }

  // ── 3. Timeline Clarity (0–20) ────────────────────────────────────────────
  let timelinePts = 0
  const cpcvDays      = daysUntil(deal.cpcvDate)
  const escrituraDays = daysUntil(deal.escrituraDate)
  const earliestDays  = (cpcvDays !== null && escrituraDays !== null)
    ? Math.min(cpcvDays, escrituraDays)
    : (cpcvDays ?? escrituraDays)

  if (earliestDays !== null) {
    dimensionsFilled++
    if      (earliestDays <= 0)   { timelinePts = 20; reasons.push(`Data iminente (${Math.abs(earliestDays)}d) → ${timelinePts}/20pts`) }
    else if (earliestDays <= 30)  { timelinePts = 18; reasons.push(`Data em ${earliestDays}d → ${timelinePts}/20pts`) }
    else if (earliestDays <= 60)  { timelinePts = 13; reasons.push(`Data em ${earliestDays}d → ${timelinePts}/20pts`) }
    else if (earliestDays <= 90)  { timelinePts =  8; reasons.push(`Data em ${earliestDays}d → ${timelinePts}/20pts`) }
    else                          { timelinePts =  4; reasons.push(`Data em +90d → ${timelinePts}/20pts`) }
  } else {
    reasons.push('Sem data CPCV/Escritura → 0/20pts')
  }

  // ── 4. Checklist Completion (0–15) ────────────────────────────────────────
  let checklistPts = 0
  const completionRate = checklistCompletionRate(deal.checklist)
  if (Object.keys(deal.checklist ?? {}).length > 0) {
    dimensionsFilled++
    const pct = Math.round(completionRate * 100)
    if      (pct >= 80) { checklistPts = 15; reasons.push(`Checklist ${pct}% → ${checklistPts}/15pts`) }
    else if (pct >= 60) { checklistPts = 11; reasons.push(`Checklist ${pct}% → ${checklistPts}/15pts`) }
    else if (pct >= 40) { checklistPts =  7; reasons.push(`Checklist ${pct}% → ${checklistPts}/15pts`) }
    else if (pct >= 20) { checklistPts =  3; reasons.push(`Checklist ${pct}% → ${checklistPts}/15pts`) }
    else                { checklistPts =  0; reasons.push(`Checklist ${pct}% → 0/15pts`) }
  } else {
    reasons.push('Checklist não disponível → 0/15pts')
  }

  // ── 5. Information Quality (0–5) ─────────────────────────────────────────
  let infoPts = 0
  if (deal.comprador)  { infoPts += 3; dimensionsFilled++ }
  if (deal.notas)      { infoPts += 2 }
  if (infoPts > 0) reasons.push(`Dados deal completos → ${infoPts}/5pts`)
  else reasons.push('Comprador/notas em falta → 0/5pts')

  // ── Raw score ─────────────────────────────────────────────────────────────
  const rawScore = stagePts + valuePts + timelinePts + checklistPts + infoPts
  const dealScore = Math.max(0, Math.min(100, Math.round(rawScore)))

  // ── Risk Flags ────────────────────────────────────────────────────────────
  if (STAGES_REQUIRING_CPCV_DATE.has(deal.fase) && !deal.cpcvDate) {
    riskFlags.push({
      code: 'NO_CPCV_DATE_IN_LATE_STAGE',
      label: `Fase "${deal.fase}" sem data CPCV definida`,
      severity: 'high',
    })
    accelerationActions.push('Definir data CPCV — requisito desta fase')
  }
  if (STAGES_REQUIRING_ESCRITURA_DATE.has(deal.fase) && !deal.escrituraDate) {
    riskFlags.push({
      code: 'NO_ESCRITURA_DATE_IN_LATE_STAGE',
      label: `Escritura Marcada sem data de escritura definida`,
      severity: 'high',
    })
    accelerationActions.push('Confirmar e registar data de escritura')
  }
  const completionPct = Math.round(completionRate * 100)
  if (completionPct < 30 && Object.keys(deal.checklist ?? {}).length > 0) {
    riskFlags.push({
      code: 'LOW_CHECKLIST_COMPLETION',
      label: `Checklist apenas ${completionPct}% completa`,
      severity: completionPct < 10 ? 'high' : 'medium',
    })
    accelerationActions.push('Completar checklist — documentos em falta')
  }
  if (!deal.comprador) {
    riskFlags.push({
      code: 'NO_BUYER_NAME',
      label: 'Nome do comprador não registado',
      severity: 'medium',
    })
    accelerationActions.push('Registar nome do comprador')
  }
  if (!deal.notas) {
    riskFlags.push({
      code: 'NO_NOTES',
      label: 'Sem notas de negociação',
      severity: 'low',
    })
    accelerationActions.push('Adicionar notas sobre estado da negociação')
  }
  if (dealValue >= 500_000 && completionPct < 20 && Object.keys(deal.checklist ?? {}).length > 0) {
    riskFlags.push({
      code: 'HIGH_VALUE_LOW_DOCUMENTS',
      label: `Deal ≥€500K com documentação insuficiente (${completionPct}%)`,
      severity: 'high',
    })
  }
  if (!deal.cpcvDate && !deal.escrituraDate && (stagePts >= 10)) {
    riskFlags.push({
      code: 'STALLED_NO_ACTIVITY_SIGNAL',
      label: 'Deal em fase avançada sem datas definidas',
      severity: 'medium',
    })
    accelerationActions.push('Agendar próxima data-chave com todas as partes')
  }

  // ── Deal Health ───────────────────────────────────────────────────────────
  let dealHealth: DealHealth
  let dealHealthLabel: string
  if      (dealScore >= 75) { dealHealth = 'SAUDAVEL'; dealHealthLabel = 'Saudável' }
  else if (dealScore >= 50) { dealHealth = 'MODERADO'; dealHealthLabel = 'Moderado' }
  else if (dealScore >= 25) { dealHealth = 'EM_RISCO'; dealHealthLabel = 'Em Risco' }
  else                      { dealHealth = 'CRITICO';  dealHealthLabel = 'Crítico' }

  // ── Closure Probability ───────────────────────────────────────────────────
  // Weighted blend: 70% stage probability, 30% score
  const blendedProb = Math.round(baseProb * 0.7 + dealScore * 0.3)
  const closurePct  = Math.min(99, blendedProb)
  let closureProbabilityBand: ClosureBand
  if      (closurePct >= 70) closureProbabilityBand = 'ALTA'
  else if (closurePct >= 40) closureProbabilityBand = 'MEDIA'
  else                       closureProbabilityBand = 'BAIXA'

  // ── Confidence ────────────────────────────────────────────────────────────
  const dataFraction = Math.min(1, dimensionsFilled / 4)
  let confidence: DealConfidence
  if (dataFraction >= 0.75)      confidence = 'high'
  else if (dataFraction >= 0.50) confidence = 'medium'
  else if (dataFraction >= 0.25) confidence = 'low'
  else                           confidence = 'insufficient'

  return {
    dealScore,
    dealHealth,
    dealHealthLabel,
    closureProbabilityBand,
    closurePct,
    reasons,
    dealRiskFlags: riskFlags,
    dealAccelerationActions: accelerationActions,
    confidence,
  }
}

// ─── Batch scoring utility ───────────────────────────────────────────────────

export interface ScoredDeal {
  deal: Deal
  scoring: DealScoreResult
}

export function scoreAllDeals(deals: Deal[]): ScoredDeal[] {
  return deals
    .filter(d => d.fase !== 'Escritura Concluída')
    .map(d => ({ deal: d, scoring: scoreDeal(d) }))
    .sort((a, b) => {
      // Sort by: risk first (CRITICO > EM_RISCO), then by deal value
      const healthOrder: Record<DealHealth, number> = { CRITICO: 0, EM_RISCO: 1, MODERADO: 2, SAUDAVEL: 3 }
      const hDiff = healthOrder[a.scoring.dealHealth] - healthOrder[b.scoring.dealHealth]
      if (hDiff !== 0) return hDiff
      return parsePTValue(b.deal.valor) - parsePTValue(a.deal.valor)
    })
}

/** Deals with at least one HIGH severity risk flag */
export function getDealsAtRisk(scored: ScoredDeal[]): ScoredDeal[] {
  return scored.filter(s =>
    s.scoring.dealRiskFlags.some(f => f.severity === 'high') ||
    s.scoring.dealHealth === 'CRITICO' ||
    s.scoring.dealHealth === 'EM_RISCO'
  )
}

/** Deals nearing closure — high probability + upcoming date */
export function getDealsNearingClosure(scored: ScoredDeal[]): ScoredDeal[] {
  return scored.filter(s => {
    if (s.scoring.closureProbabilityBand !== 'ALTA') return false
    const cpcvD      = daysUntil(s.deal.cpcvDate)
    const escrituraD = daysUntil(s.deal.escrituraDate)
    const nearest    = [cpcvD, escrituraD].filter(d => d !== null) as number[]
    return nearest.some(d => d <= 60)
  })
}
