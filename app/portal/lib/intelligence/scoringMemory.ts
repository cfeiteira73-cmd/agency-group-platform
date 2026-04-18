// =============================================================================
// AGENCY GROUP — Intelligence Layer: Scoring Memory (scoringMemory.ts)
//
// Module:  scoringMemory.ts
// Purpose: Persist score snapshots to localStorage and compute session-over-
//          session deltas for both leads (ScoredContact) and deals (ScoredDeal).
//
// Design notes:
//   • All localStorage access is guarded by typeof window !== 'undefined'
//     so the module is fully SSR-safe (Next.js App Router compatible).
//   • Storage key versioned ('ag_score_memory_v1') — bump to purge on schema
//     change.
//   • MAX_HISTORY = 3: we keep only the last 3 snapshots per entity to bound
//     storage growth; older entries are discarded on every write.
//   • TTL_MS = 30 days: entries older than TTL are pruned on write.
//   • update* functions mutate localStorage and should be called ONCE per
//     session after the first data load.
//   • get* / batch* functions are read-only and safe to call any number of
//     times.
//   • No circular imports: only imports types from leadScoring / dealScoring.
//   • No React, no side-effects beyond localStorage.
// =============================================================================

import type { ScoredContact } from '../leadScoring'
import type { ScoredDeal } from '../dealScoring'

// ─── Public Types ─────────────────────────────────────────────────────────────

export type ScoreTrend = 'improving' | 'stable' | 'declining' | 'new'

export interface ScoreDelta {
  current: number
  previous: number | null      // null if no prior snapshot
  delta: number | null         // current - previous (null if no history)
  trend: ScoreTrend
  percentChange: number | null // rounded to 1dp, null if no history
}

// ─── Internal Types ───────────────────────────────────────────────────────────

type ScoreEntry = { score: number; ts: number }
type ScoreMemory = Record<string, ScoreEntry[]>

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY      = 'ag_score_memory_v1'
const MAX_HISTORY      = 3
const STABLE_THRESHOLD = 3
const TTL_MS           = 30 * 24 * 60 * 60 * 1000  // 30 days

// ─── SSR-safe Storage Helpers ─────────────────────────────────────────────────

function readStorage(): ScoreMemory {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return {}
    }
    return parsed as ScoreMemory
  } catch {
    return {}
  }
}

function writeStorage(data: ScoreMemory): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Quota exceeded or private browsing — fail silently
  }
}

// ─── History Pruning ──────────────────────────────────────────────────────────

/**
 * Remove entries older than TTL_MS and cap the array at MAX_HISTORY.
 * Oldest entries are trimmed first.
 */
function pruneHistory(entries: ScoreEntry[]): ScoreEntry[] {
  const now = Date.now()
  const fresh = entries.filter(e => now - e.ts <= TTL_MS)
  // Keep the most recent MAX_HISTORY entries
  return fresh.slice(-MAX_HISTORY)
}

// ─── Core Delta Computation ───────────────────────────────────────────────────

/**
 * Compute a ScoreDelta for `entityKey` using persisted history.
 * Does NOT write to storage.
 */
export function computeScoreDelta(entityKey: string, currentScore: number): ScoreDelta {
  const memory  = readStorage()
  const history = memory[entityKey] ?? []

  if (history.length === 0) {
    return {
      current:       currentScore,
      previous:      null,
      delta:         null,
      trend:         'new',
      percentChange: null,
    }
  }

  // If the most-recent stored score matches currentScore, the caller likely
  // just persisted this session's snapshot via updateLeadScoreMemory /
  // updateDealScoreMemory.  Compare against the entry BEFORE that snapshot
  // so we show session-over-session change rather than a trivial 0-delta.
  const lastIdx   = history.length - 1
  const lastScore = history[lastIdx].score
  const previous: number | null =
    lastScore === currentScore
      ? (lastIdx > 0 ? history[lastIdx - 1].score : null)
      : lastScore

  if (previous === null) {
    return {
      current:       currentScore,
      previous:      null,
      delta:         null,
      trend:         'new',
      percentChange: null,
    }
  }

  const delta = currentScore - previous

  let trend: ScoreTrend
  if      (delta >  STABLE_THRESHOLD) trend = 'improving'
  else if (delta < -STABLE_THRESHOLD) trend = 'declining'
  else                                trend = 'stable'

  const percentChange =
    previous > 0
      ? Math.round((delta / previous) * 1000) / 10  // 1dp
      : null

  return {
    current: currentScore,
    previous,
    delta,
    trend,
    percentChange,
  }
}

// ─── Write Functions (call ONCE per session) ──────────────────────────────────

/**
 * Snapshot the current lead scores into localStorage.
 * Should be called once after the first data load in the portal session.
 */
export function updateLeadScoreMemory(contacts: ScoredContact[]): void {
  const memory = readStorage()
  const now    = Date.now()

  for (const scored of contacts) {
    const key     = `lead_${scored.contact.id}`
    const current = memory[key] ?? []
    const updated = pruneHistory([...current, { score: scored.scoring.score, ts: now }])
    memory[key]   = updated
  }

  writeStorage(memory)
}

/**
 * Snapshot the current deal scores into localStorage.
 * Should be called once after the first data load in the portal session.
 */
export function updateDealScoreMemory(deals: ScoredDeal[]): void {
  const memory = readStorage()
  const now    = Date.now()

  for (const scored of deals) {
    const key     = `deal_${scored.deal.id}`
    const current = memory[key] ?? []
    const updated = pruneHistory([...current, { score: scored.scoring.dealScore, ts: now }])
    memory[key]   = updated
  }

  writeStorage(memory)
}

// ─── Read-only Delta Functions (safe to call any number of times) ─────────────

/**
 * Get the score delta for a single lead by contact ID.
 * Read-only — does not modify storage.
 */
export function getLeadScoreDelta(contactId: number, currentScore: number): ScoreDelta {
  return computeScoreDelta(`lead_${contactId}`, currentScore)
}

/**
 * Get the score delta for a single deal by deal ID.
 * Read-only — does not modify storage.
 */
export function getDealScoreDelta(dealId: number, currentScore: number): ScoreDelta {
  return computeScoreDelta(`deal_${dealId}`, currentScore)
}

/**
 * Compute score deltas for an entire batch of scored contacts.
 * Returns a Map keyed by contact.id. Read-only.
 */
export function batchLeadDeltas(contacts: ScoredContact[]): Map<number, ScoreDelta> {
  const result = new Map<number, ScoreDelta>()
  for (const scored of contacts) {
    result.set(
      scored.contact.id,
      computeScoreDelta(`lead_${scored.contact.id}`, scored.scoring.score),
    )
  }
  return result
}

/**
 * Compute score deltas for an entire batch of scored deals.
 * Returns a Map keyed by deal.id. Read-only.
 */
export function batchDealDeltas(deals: ScoredDeal[]): Map<number, ScoreDelta> {
  const result = new Map<number, ScoreDelta>()
  for (const scored of deals) {
    result.set(
      scored.deal.id,
      computeScoreDelta(`deal_${scored.deal.id}`, scored.scoring.dealScore),
    )
  }
  return result
}
