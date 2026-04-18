// =============================================================================
// AGENCY GROUP — Workload Pressure Engine v1.0
// Module:  intelligence/workload.ts
// Purpose: Computes workload pressure metrics from existing scored data.
//          Pure computation — no storage, no side effects, no external calls.
//
// Design notes:
//   • All inputs are already scored; this module only aggregates signals
//   • workloadScore is a 0–100 index (higher = more pressure)
//   • priorityQueue gives the agent a max-5 ordered action list
//   • NaN-safe: all numeric ops guard against null / undefined
// =============================================================================

import type { ScoredContact } from '../leadScoring'
import type { ScoredDeal } from '../dealScoring'
import type { AgentCopilotOutput } from './copilot'

// ─── Types ────────────────────────────────────────────────────────────────────

export type WorkloadLabel = 'NORMAL' | 'ELEVADO' | 'CRITICO'

export interface WorkloadMetrics {
  /** Contacts with overdue nextFollowUp (daysUntil < 0) AND score >= 35 */
  urgentLeadCount: number
  /** Deals with health CRITICO or EM_RISCO (excluding Escritura Concluída) */
  atRiskDealCount: number
  /** Copilot suggestions with urgency 'immediate' or 'today' across leads + deals */
  immediateActions: number
  /** 0–100 computed workload index */
  workloadScore: number
  workloadLabel: WorkloadLabel
  /** true when workloadScore >= 70 */
  isOverloaded: boolean
  /** Max 5 items ordered by urgency — what to do first */
  priorityQueue: string[]
}

// ─── Inline date helper ───────────────────────────────────────────────────────

/** Days until a future date. Negative means already past. Null on invalid input. */
function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  return Math.floor((d.getTime() - Date.now()) / 86_400_000)
}

// ─── Main Function ────────────────────────────────────────────────────────────

export function computeWorkload(
  contacts: ScoredContact[],
  deals: ScoredDeal[],
  copilot: AgentCopilotOutput,
): WorkloadMetrics {

  // ── urgentLeadCount ───────────────────────────────────────────────────────
  const urgentLeadCount = contacts.filter(({ contact, scoring }) => {
    const days = daysUntil(contact.nextFollowUp)
    return days !== null && days < 0 && scoring.score >= 35
  }).length

  // ── atRiskDealCount ───────────────────────────────────────────────────────
  const atRiskDealCount = deals.filter(({ deal, scoring }) => {
    if (deal.fase === 'Escritura Concluída') return false
    return scoring.dealHealth === 'CRITICO' || scoring.dealHealth === 'EM_RISCO'
  }).length

  // ── immediateActions ──────────────────────────────────────────────────────
  const immediateActions = [
    ...copilot.topLeadSuggestions,
    ...copilot.topDealSuggestions,
  ].filter(s => s.urgency === 'immediate' || s.urgency === 'today').length

  // ── workloadScore (0–100) ─────────────────────────────────────────────────
  const base = urgentLeadCount * 15 + atRiskDealCount * 20 + immediateActions * 10
  const workloadScore = Math.round(Math.min(100, base))

  // ── workloadLabel ─────────────────────────────────────────────────────────
  let workloadLabel: WorkloadLabel
  if      (workloadScore >= 70) workloadLabel = 'CRITICO'
  else if (workloadScore >= 40) workloadLabel = 'ELEVADO'
  else                          workloadLabel = 'NORMAL'

  const isOverloaded = workloadScore >= 70

  // ── priorityQueue (max 5, ordered by urgency) ─────────────────────────────
  const queueItems: string[] = []

  // 1. Copilot lead suggestions urgency 'immediate'
  for (const s of copilot.topLeadSuggestions) {
    if (s.urgency === 'immediate') queueItems.push(s.headline)
  }

  // 2. Copilot deal suggestions urgency 'immediate'
  for (const s of copilot.topDealSuggestions) {
    if (s.urgency === 'immediate') queueItems.push(s.headline)
  }

  // 3. Copilot lead suggestions urgency 'today'
  for (const s of copilot.topLeadSuggestions) {
    if (s.urgency === 'today') queueItems.push(s.headline)
  }

  // 4. Copilot deal suggestions urgency 'today'
  for (const s of copilot.topDealSuggestions) {
    if (s.urgency === 'today') queueItems.push(s.headline)
  }

  // 5. Contacts with overdue follow-up (fill remainder)
  for (const { contact, scoring } of contacts) {
    const days = daysUntil(contact.nextFollowUp)
    if (days !== null && days < 0 && scoring.score >= 35) {
      const daysOverdue = Math.abs(days)
      queueItems.push(`${contact.name} — ${daysOverdue}d em atraso`)
    }
  }

  // Deduplicate (preserve order) then slice to 5
  const seen = new Set<string>()
  const priorityQueue: string[] = []
  for (const item of queueItems) {
    if (!seen.has(item)) {
      seen.add(item)
      priorityQueue.push(item)
    }
    if (priorityQueue.length === 5) break
  }

  return {
    urgentLeadCount,
    atRiskDealCount,
    immediateActions,
    workloadScore,
    workloadLabel,
    isOverloaded,
    priorityQueue,
  }
}
