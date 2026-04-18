// =============================================================================
// AGENCY GROUP — Opportunity Detection Engine v1.0
// Module:  intelligence/opportunity.ts
// Purpose: Detects revenue and pipeline opportunities from scored contacts and
//          deals. Pure, deterministic functions — no side effects, no I/O, no
//          randomness. Safe on incomplete data throughout.
//
// Design notes:
//   • All date math inlined — no external helper dependency
//   • estimatedCommission is only set when numerically computable and > 0
//   • Output is always sorted: critical → high → medium, then by commission desc
//   • NaN is never returned for numeric fields
//   • All user-facing strings are in Portuguese
// =============================================================================

import type { ScoredContact } from '../leadScoring'
import type { ScoredDeal } from '../dealScoring'
import { parsePTValue } from '../../utils/format'

// ─── Types ────────────────────────────────────────────────────────────────────

export type OpportunityType =
  | 'NEGLECTED_HIGH_VALUE_LEAD'
  | 'STALLED_HIGH_POTENTIAL_DEAL'
  | 'REENGAGEMENT_OPPORTUNITY'
  | 'FAST_CONVERSION_SIGNAL'
  | 'CLOSING_WINDOW_OPEN'

export interface Opportunity {
  /** Unique identifier: type + subject identifier */
  id: string
  type: OpportunityType
  priority: 'critical' | 'high' | 'medium'
  subjectName: string
  /** Deal ref or contact id */
  subjectRef?: string
  /** ≥2 data-backed reasons */
  reasoning: string[]
  /** Short, specific, actionable step */
  recommendedAction: string
  /** Euros — only set when computable and > 0 */
  estimatedCommission?: number
  confidence: 'high' | 'medium' | 'low'
}

// ─── Inline date helpers ──────────────────────────────────────────────────────

/** Days elapsed since a past date. Returns null on missing/invalid input. */
function daysSince(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  return Math.floor((Date.now() - d.getTime()) / 86_400_000)
}

/** Days until a future date. Negative means past. Returns null on missing/invalid input. */
function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  return Math.floor((d.getTime() - Date.now()) / 86_400_000)
}

// ─── Priority sort order ──────────────────────────────────────────────────────

const PRIORITY_ORDER: Record<Opportunity['priority'], number> = {
  critical: 0,
  high:     1,
  medium:   2,
}

// ─── Detection helpers ────────────────────────────────────────────────────────

function detectNeglectedHighValueLeads(contacts: ScoredContact[]): Opportunity[] {
  const results: Opportunity[] = []

  for (const { contact, scoring } of contacts) {
    if (scoring.band !== 'A' && scoring.band !== 'B') continue
    const budgetMax = contact.budgetMax ?? 0
    if (budgetMax < 500_000) continue
    const days = daysSince(contact.lastContact)
    if (days === null || days <= 14) continue

    const name     = contact.name ?? 'Contacto sem nome'
    const priority = scoring.band === 'A' ? 'critical' : 'high'
    const conf     = scoring.band === 'A' ? 'high' : 'medium'
    const comm     = budgetMax * 0.05

    results.push({
      id:                 `NEGLECTED_HIGH_VALUE_LEAD:${contact.id}`,
      type:               'NEGLECTED_HIGH_VALUE_LEAD',
      priority,
      subjectName:        name,
      subjectRef:         String(contact.id),
      reasoning: [
        `${name} (${scoring.band}) sem contacto há ${days}d`,
        `Budget €${(budgetMax / 1_000).toFixed(0)}K — receita potencial em risco`,
      ],
      recommendedAction:  `Contactar hoje — potencial receita de €${comm.toFixed(0)}`,
      estimatedCommission: comm,
      confidence:         conf,
    })
  }

  return results
}

function detectStalledHighPotentialDeals(deals: ScoredDeal[]): Opportunity[] {
  const results: Opportunity[] = []

  for (const { deal, scoring } of deals) {
    if (scoring.dealScore < 60) continue
    if (deal.cpcvDate || deal.escrituraDate) continue

    const dealWithCreated = deal as typeof deal & { createdAt?: string }
    const age = daysSince(dealWithCreated.createdAt)
    if (age === null || age <= 30) continue

    const ref      = deal.ref ?? deal.id ?? 'Deal'
    const priority = scoring.dealScore >= 80 ? 'critical' : 'high'
    const dealVal  = parsePTValue(deal.valor)
    const comm     = dealVal > 0 ? dealVal * 0.05 : undefined

    results.push({
      id:                 `STALLED_HIGH_POTENTIAL_DEAL:${deal.id ?? ref}`,
      type:               'STALLED_HIGH_POTENTIAL_DEAL',
      priority,
      subjectName:        deal.imovel ?? ref,
      subjectRef:         ref,
      reasoning: [
        `Deal ${ref} com score ${scoring.dealScore} sem datas definidas`,
        `Em pipeline há ${age}d sem avanço de calendário`,
      ],
      recommendedAction:  'Agendar CPCV — deal de alto potencial parado',
      estimatedCommission: comm,
      confidence:         'medium',
    })
  }

  return results
}

function detectReengagementOpportunities(contacts: ScoredContact[]): Opportunity[] {
  const results: Opportunity[] = []

  for (const { contact, scoring } of contacts) {
    if (contact.status === 'cliente' || contact.status === 'vip') continue
    const actCount = contact.activities?.length ?? 0
    if (actCount < 3) continue
    const days = daysSince(contact.lastContact)
    if (days === null || days <= 30) continue

    const name     = contact.name ?? 'Contacto sem nome'
    const priority = scoring.band === 'A' ? 'high' : 'medium'
    const budgetMax = contact.budgetMax ?? 0
    const comm     = budgetMax > 0 ? budgetMax * 0.05 : undefined

    results.push({
      id:                 `REENGAGEMENT_OPPORTUNITY:${contact.id}`,
      type:               'REENGAGEMENT_OPPORTUNITY',
      priority,
      subjectName:        name,
      subjectRef:         String(contact.id),
      reasoning: [
        `${name} tinha ${actCount} actividades mas sem contacto há ${days}d`,
        'Engajamento anterior — reactivação com alta taxa de sucesso',
      ],
      recommendedAction:  'Enviar mensagem de reactivação com nova propriedade alinhada ao perfil',
      estimatedCommission: comm,
      confidence:         'medium',
    })
  }

  return results
}

function detectFastConversionSignals(contacts: ScoredContact[]): Opportunity[] {
  const results: Opportunity[] = []

  for (const { contact, scoring } of contacts) {
    const actCount  = contact.activities?.length ?? 0
    if (actCount < 5) continue
    if (scoring.score < 65) continue
    const lastDays = daysSince(contact.lastContact)
    if (lastDays === null || lastDays > 3) continue

    const name      = contact.name ?? 'Contacto sem nome'
    const budgetMax = contact.budgetMax ?? 0
    const comm      = budgetMax > 0 ? budgetMax * 0.05 : undefined

    results.push({
      id:                 `FAST_CONVERSION_SIGNAL:${contact.id}`,
      type:               'FAST_CONVERSION_SIGNAL',
      priority:           'high',
      subjectName:        name,
      subjectRef:         String(contact.id),
      reasoning: [
        `${name} com ${actCount} actividades e contacto há ${lastDays}d`,
        `Score ${scoring.score} — lead em aceleração`,
      ],
      recommendedAction:  'Apresentar proposta concreta — momento ideal',
      estimatedCommission: comm,
      confidence:         'high',
    })
  }

  return results
}

function detectClosingWindowOpen(deals: ScoredDeal[]): Opportunity[] {
  const results: Opportunity[] = []

  for (const { deal, scoring } of deals) {
    if (scoring.closureProbabilityBand !== 'ALTA') continue

    const cpcvDays      = daysUntil(deal.cpcvDate)
    const escrituraDays = daysUntil(deal.escrituraDate)
    const validDays     = [cpcvDays, escrituraDays].filter((d): d is number => d !== null)
    const nearestDate   = validDays.length > 0 ? Math.min(...validDays) : null

    const isClosingWindow = (nearestDate !== null && nearestDate <= 30) ||
      deal.fase === 'Escritura Marcada'

    if (!isClosingWindow) continue

    // Checklist completion
    const checklist    = deal.checklist ?? {}
    const checkKeys    = Object.keys(checklist)
    let   total        = 0
    let   done         = 0
    for (const items of Object.values(checklist)) {
      if (!Array.isArray(items)) continue
      total += items.length
      done  += items.filter(Boolean).length
    }
    const completionRate = (checkKeys.length === 0 || total === 0) ? 0 : done / total
    if (completionRate >= 0.8) continue

    const pct      = Math.round(completionRate * 100)
    const priority = completionRate < 0.5 ? 'critical' : 'high'
    const ref      = deal.ref ?? deal.id ?? 'Deal'
    const dealVal  = parsePTValue(deal.valor)
    const comm     = dealVal > 0 ? dealVal * 0.05 : undefined

    results.push({
      id:                 `CLOSING_WINDOW_OPEN:${deal.id ?? ref}`,
      type:               'CLOSING_WINDOW_OPEN',
      priority,
      subjectName:        deal.imovel ?? ref,
      subjectRef:         ref,
      reasoning: [
        `${deal.imovel ?? ref} a fechar em ≤30d com checklist apenas ${pct}% completa`,
        'Documentação incompleta pode atrasar escritura',
      ],
      recommendedAction:  'Completar checklist urgente — escritura próxima',
      estimatedCommission: comm,
      confidence:         'high',
    })
  }

  return results
}

// ─── Sort helper ──────────────────────────────────────────────────────────────

function sortOpportunities(opps: Opportunity[]): Opportunity[] {
  return [...opps].sort((a, b) => {
    const pDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
    if (pDiff !== 0) return pDiff
    const commA = a.estimatedCommission ?? 0
    const commB = b.estimatedCommission ?? 0
    return commB - commA
  })
}

// ─── Main detection function ──────────────────────────────────────────────────

/**
 * Detects all actionable revenue and pipeline opportunities from scored
 * contacts and deals. Returns sorted list: critical → high → medium,
 * then by estimatedCommission descending within the same priority.
 */
export function detectOpportunities(
  contacts: ScoredContact[],
  deals: ScoredDeal[],
): Opportunity[] {
  const all: Opportunity[] = [
    ...detectNeglectedHighValueLeads(contacts),
    ...detectStalledHighPotentialDeals(deals),
    ...detectReengagementOpportunities(contacts),
    ...detectFastConversionSignals(contacts),
    ...detectClosingWindowOpen(deals),
  ]

  return sortOpportunities(all)
}

// ─── Utility exports ──────────────────────────────────────────────────────────

/**
 * Returns the first `limit` opportunities from an already-sorted list.
 */
export function getTopOpportunities(opps: Opportunity[], limit = 5): Opportunity[] {
  return opps.slice(0, limit)
}

/**
 * Summary stats for the opportunity list.
 * revenueAtRisk = sum of estimatedCommission where priority === 'critical'.
 */
export function opportunitySummary(opps: Opportunity[]): {
  total: number
  critical: number
  revenueAtRisk: number
} {
  let critical      = 0
  let revenueAtRisk = 0

  for (const opp of opps) {
    if (opp.priority === 'critical') {
      critical++
      revenueAtRisk += opp.estimatedCommission ?? 0
    }
  }

  return {
    total: opps.length,
    critical,
    revenueAtRisk,
  }
}
