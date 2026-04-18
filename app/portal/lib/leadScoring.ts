// =============================================================================
// AGENCY GROUP — Lead Scoring Engine v1.0
// Deterministic, explainable, safe on incomplete data.
//
// Design principles:
//   • Every dimension has a documented weight and reason string
//   • Insufficient data degrades score but does not crash
//   • Score = 0-100; band = A/B/C/D
//   • Every output includes reasons[] and recommendedNextAction
//   • No ML, no opaque black box — every point is traceable
//   • Safe for undefined/null fields throughout
// =============================================================================

import type { CRMContact } from '../components/types'

// ─── Output Types ────────────────────────────────────────────────────────────

export type LeadScoreBand = 'A' | 'B' | 'C' | 'D'
export type LeadConfidence = 'high' | 'medium' | 'low' | 'insufficient'

export interface LeadScoreResult {
  /** 0–100 composite score */
  score: number
  /** A = alta prioridade, B = bom prospecto, C = em observação, D = baixa */
  band: LeadScoreBand
  /** Human-readable label for the band */
  bandLabel: string
  /** Ordered list of contributing reasons (positive and negative) */
  reasons: string[]
  /** Penalties applied — helps identify what's dragging the score down */
  penalties: string[]
  /** Recommended next action for this lead */
  recommendedNextAction: string
  /** Confidence in the score given data completeness */
  confidence: LeadConfidence
  /** Number of data dimensions that had sufficient data */
  dataCompleteness: number  // 0–1 fraction
}

// ─── Dimension weights (must sum to 100 for full data) ───────────────────────

const W = {
  status:       30,   // Relationship quality
  budget:       20,   // Investment signal
  recency:      20,   // Engagement recency
  activity:     15,   // Depth of interaction
  completeness: 10,   // Profile completeness
  urgency:       5,   // Follow-up urgency bonus
} as const

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysSince(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  return Math.floor((Date.now() - d.getTime()) / 86400000)
}

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  return Math.floor((d.getTime() - Date.now()) / 86400000)
}

// ─── Main Scoring Function ───────────────────────────────────────────────────

export function scoreLeadContact(contact: CRMContact): LeadScoreResult {
  const reasons: string[] = []
  const penalties: string[] = []
  let dimensionsFilled = 0

  // ── 1. Status / Relationship Quality (0–30) ──────────────────────────────
  let statusPts = 0
  if (contact.status) {
    dimensionsFilled++
    const statusMap: Record<string, number> = {
      vip:      30,
      cliente:  22,
      prospect: 14,
      lead:      6,
    }
    statusPts = statusMap[contact.status] ?? 6
    const statusLabel = contact.status.toUpperCase()
    reasons.push(`Status ${statusLabel} → ${statusPts}/${W.status}pts`)
  } else {
    reasons.push(`Status desconhecido → 0/${W.status}pts`)
  }

  // ── 2. Budget Signal (0–20) ───────────────────────────────────────────────
  let budgetPts = 0
  const budgetMax = contact.budgetMax ?? 0
  if (budgetMax > 0) {
    dimensionsFilled++
    if      (budgetMax >= 2_000_000) { budgetPts = 20; reasons.push(`Budget ≥€2M → ${budgetPts}/${W.budget}pts`) }
    else if (budgetMax >= 1_000_000) { budgetPts = 16; reasons.push(`Budget €1M-€2M → ${budgetPts}/${W.budget}pts`) }
    else if (budgetMax >=   500_000) { budgetPts = 12; reasons.push(`Budget €500K-€1M → ${budgetPts}/${W.budget}pts`) }
    else if (budgetMax >=   200_000) { budgetPts =  8; reasons.push(`Budget €200K-€500K → ${budgetPts}/${W.budget}pts`) }
    else                             { budgetPts =  4; reasons.push(`Budget <€200K → ${budgetPts}/${W.budget}pts`) }
  } else {
    reasons.push(`Budget não especificado → 0/${W.budget}pts`)
  }

  // ── 3. Engagement Recency (0–20) ─────────────────────────────────────────
  let recencyPts = 0
  const lastContactDays = daysSince(contact.lastContact)
  if (lastContactDays !== null) {
    dimensionsFilled++
    if      (lastContactDays === 0)    { recencyPts = 20; reasons.push(`Contactado hoje → ${recencyPts}/${W.recency}pts`) }
    else if (lastContactDays <= 3)     { recencyPts = 16; reasons.push(`Último contacto há ${lastContactDays}d → ${recencyPts}/${W.recency}pts`) }
    else if (lastContactDays <= 7)     { recencyPts = 12; reasons.push(`Último contacto há ${lastContactDays}d → ${recencyPts}/${W.recency}pts`) }
    else if (lastContactDays <= 14)    { recencyPts =  7; reasons.push(`Último contacto há ${lastContactDays}d → ${recencyPts}/${W.recency}pts`) }
    else if (lastContactDays <= 30)    { recencyPts =  3; reasons.push(`Último contacto há ${lastContactDays}d → ${recencyPts}/${W.recency}pts`) }
    else {
      recencyPts = 0
      reasons.push(`Último contacto há ${lastContactDays}d → 0/${W.recency}pts`)
      penalties.push(`Sem contacto há ${lastContactDays}d (>30d) → -10pts`)
    }
  } else {
    reasons.push(`Último contacto desconhecido → 0/${W.recency}pts`)
  }

  // ── 4. Activity Depth (0–15) ──────────────────────────────────────────────
  let activityPts = 0
  const actCount = (contact.activities?.length ?? 0)
  if (actCount > 0) {
    dimensionsFilled++
    if      (actCount >= 10) { activityPts = 15; reasons.push(`${actCount} actividades → ${activityPts}/${W.activity}pts`) }
    else if (actCount >= 5)  { activityPts = 12; reasons.push(`${actCount} actividades → ${activityPts}/${W.activity}pts`) }
    else if (actCount >= 3)  { activityPts =  8; reasons.push(`${actCount} actividades → ${activityPts}/${W.activity}pts`) }
    else                     { activityPts =  4; reasons.push(`${actCount} actividades → ${activityPts}/${W.activity}pts`) }
  } else {
    reasons.push(`Sem actividades registadas → 0/${W.activity}pts`)
    if (contact.status === 'prospect' || contact.status === 'vip') {
      penalties.push(`${contact.status.toUpperCase()} sem actividades registadas → -5pts`)
    }
  }

  // ── 5. Profile Completeness (0–10) ───────────────────────────────────────
  let completePts = 0
  if (contact.email)                                { completePts += 2 }
  if (contact.phone)                                { completePts += 2 }
  if (contact.nationality)                          { completePts += 2 }
  if (contact.zonas && contact.zonas.length > 0)    { completePts += 2 }
  if (contact.tipos && contact.tipos.length > 0)    { completePts += 2 }
  if (completePts > 0) {
    dimensionsFilled++
    reasons.push(`Perfil ${completePts * 10}% completo → ${completePts}/${W.completeness}pts`)
  } else {
    reasons.push(`Perfil incompleto → 0/${W.completeness}pts`)
  }

  // ── 6. Follow-up Urgency Bonus (0–5) ────────────────────────────────────
  let urgencyPts = 0
  const followUpDays = daysUntil(contact.nextFollowUp)
  if (followUpDays !== null) {
    dimensionsFilled++
    if      (followUpDays < 0)  { urgencyPts = 5; reasons.push(`Follow-up em atraso (${Math.abs(followUpDays)}d) → +${urgencyPts}pts urgência`) }
    else if (followUpDays === 0) { urgencyPts = 4; reasons.push('Follow-up marcado para hoje → +4pts urgência') }
    else if (followUpDays <= 7)  { urgencyPts = 2; reasons.push(`Follow-up em ${followUpDays}d → +2pts urgência`) }
  } else {
    // Missing follow-up date for active prospects is a mild penalty
    if (contact.status === 'prospect' || contact.status === 'vip') {
      penalties.push(`${contact.status.toUpperCase()} sem próximo follow-up agendado → -5pts`)
    }
  }

  // ── Apply penalties ───────────────────────────────────────────────────────
  let totalPenalty = 0
  if (lastContactDays !== null && lastContactDays > 30)    totalPenalty += 10
  if (actCount === 0 && (contact.status === 'prospect' || contact.status === 'vip')) totalPenalty += 5
  if (!contact.nextFollowUp && (contact.status === 'prospect' || contact.status === 'vip')) totalPenalty += 5

  // ── Raw score (before capping) ────────────────────────────────────────────
  const rawScore = statusPts + budgetPts + recencyPts + activityPts + completePts + urgencyPts - totalPenalty
  const score = Math.max(0, Math.min(100, Math.round(rawScore)))

  // ── Data completeness ─────────────────────────────────────────────────────
  // 5 core dimensions + 1 urgency = 6 total tracked
  const dataCompleteness = Math.min(1, dimensionsFilled / 5)

  // ── Score band ────────────────────────────────────────────────────────────
  let band: LeadScoreBand
  let bandLabel: string
  if      (score >= 75) { band = 'A'; bandLabel = 'Alta Prioridade' }
  else if (score >= 55) { band = 'B'; bandLabel = 'Bom Prospecto' }
  else if (score >= 35) { band = 'C'; bandLabel = 'Em Observação' }
  else                  { band = 'D'; bandLabel = 'Baixa Prioridade' }

  // ── Confidence ────────────────────────────────────────────────────────────
  let confidence: LeadConfidence
  if (dataCompleteness >= 0.8)      confidence = 'high'
  else if (dataCompleteness >= 0.5) confidence = 'medium'
  else if (dataCompleteness >= 0.2) confidence = 'low'
  else                              confidence = 'insufficient'

  // ── Recommended Next Action ───────────────────────────────────────────────
  let recommendedNextAction: string
  const followUpOverdue = followUpDays !== null && followUpDays < 0

  if (score >= 75 && followUpOverdue) {
    recommendedNextAction = 'Contactar hoje — follow-up em atraso'
  } else if (score >= 75 && (lastContactDays === null || lastContactDays > 7)) {
    recommendedNextAction = 'Contactar esta semana — alta probabilidade'
  } else if (score >= 75) {
    recommendedNextAction = 'Manter ritmo de contacto — cliente prioritário'
  } else if (score >= 55 && followUpOverdue) {
    recommendedNextAction = 'Agendar seguimento — não deixar esfriar'
  } else if (score >= 55 && actCount === 0) {
    recommendedNextAction = 'Iniciar sequência de contacto'
  } else if (score >= 55) {
    recommendedNextAction = 'Enviar conteúdo relevante ou nova proposta'
  } else if (score >= 35) {
    recommendedNextAction = 'Manter em drip · monitorizar envolvimento'
  } else if (confidence === 'insufficient') {
    recommendedNextAction = 'Completar perfil para avaliação adequada'
  } else {
    recommendedNextAction = 'Avaliar remoção activa do pipeline'
  }

  return {
    score,
    band,
    bandLabel,
    reasons,
    penalties,
    recommendedNextAction,
    confidence,
    dataCompleteness,
  }
}

// ─── Batch scoring utility ────────────────────────────────────────────────────

export interface ScoredContact {
  contact: CRMContact
  scoring: LeadScoreResult
}

export function scoreAllContacts(contacts: CRMContact[]): ScoredContact[] {
  return contacts
    .map(c => ({ contact: c, scoring: scoreLeadContact(c) }))
    .sort((a, b) => b.scoring.score - a.scoring.score)
}

// ─── Priority filter helpers ──────────────────────────────────────────────────

/** Leads that need immediate action today (overdue follow-up + score ≥ 35) */
export function getUrgentLeads(scored: ScoredContact[]): ScoredContact[] {
  return scored.filter(({ contact, scoring }) => {
    if (scoring.score < 35) return false
    const followUp = daysUntil(contact.nextFollowUp)
    return followUp !== null && followUp <= 0
  })
}

/** Top-scoring leads that haven't been contacted in 7+ days */
export function getHighPriorityLeads(scored: ScoredContact[]): ScoredContact[] {
  return scored.filter(({ contact, scoring }) => {
    if (scoring.band !== 'A' && scoring.band !== 'B') return false
    const lastDays = daysSince(contact.lastContact)
    return lastDays === null || lastDays > 7
  })
}

/** Stalled leads: last contact > 30 days and not a completed client */
export function getStalledLeads(scored: ScoredContact[]): ScoredContact[] {
  return scored.filter(({ contact }) => {
    if (contact.status === 'cliente' || contact.status === 'vip') return false
    const lastDays = daysSince(contact.lastContact)
    return lastDays === null || lastDays > 30
  })
}
