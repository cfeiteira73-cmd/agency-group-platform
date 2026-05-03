// =============================================================================
// Agency Group — Transactional Decision Engine
// lib/intelligence/transactionalDecision.ts
//
// Phase 2: Real-time Consistency & Transactional Decision Engine
//
// Guarantees deterministic, idempotent, conflict-free decision execution
// across the full pipeline: score → route → distribute → log.
//
// PROBLEMS SOLVED:
//   - Duplicate routing decisions when Vercel retries cron
//   - Stale AVM used after a price change
//   - Conflicting distribution states (two workers picking same property)
//
// PURE FUNCTIONS:
//   generateDecisionId, validateDecisionConsistency,
//   checkIdempotency, assessDecisionRisk
//
// DB FUNCTIONS:
//   recordDecisionAttempt, getDecisionById, markDecisionComplete
// =============================================================================

import { createHash }  from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DecisionInputs {
  property_id:         string
  opportunity_score:   number
  avm_value:           number
  asking_price:        number
  scored_at:           string          // ISO — when scoring happened
  routing_tier:        string          // 'A+' | 'A' | 'B' | 'skip'
  recipient_ids:       string[]        // ordered recipient list
}

export interface StoredDecision {
  decision_id:   string
  property_id:   string
  status:        DecisionStatus
  created_at:    string
}

export type DecisionStatus = 'pending' | 'executing' | 'complete' | 'failed' | 'skipped'

export interface IdempotencyResult {
  is_duplicate:    boolean
  existing_status: DecisionStatus | null
  decision_id:     string
}

export interface ConsistencyValidation {
  is_consistent:  boolean
  issues:         string[]
  risk_level:     'low' | 'medium' | 'high' | 'critical'
}

export interface DecisionRisk {
  score:          number          // 0-100 (higher = riskier)
  flags:          string[]
  recommendation: 'proceed' | 'review' | 'block'
}

// ---------------------------------------------------------------------------
// PURE: Generate deterministic decision ID
// Same inputs → same ID → idempotency protection
// ---------------------------------------------------------------------------

export function generateDecisionId(inputs: DecisionInputs): string {
  const key = [
    inputs.property_id,
    inputs.routing_tier,
    inputs.opportunity_score.toFixed(2),
    // Truncate scored_at to hour so retries within same hour use same ID
    inputs.scored_at.substring(0, 13),
  ].join(':')
  return createHash('sha256').update(key).digest('hex').substring(0, 32)
}

// ---------------------------------------------------------------------------
// PURE: Validate decision consistency
// Catches stale data or conflicting state before execution
// ---------------------------------------------------------------------------

export function validateDecisionConsistency(
  inputs:          DecisionInputs,
  avmStalenessHours: number,
  lastDistributedAt: string | null,
): ConsistencyValidation {
  const issues: string[] = []

  // AVM staleness check — if AVM is > 72h old, flag it
  if (avmStalenessHours > 72) {
    issues.push(`AVM is ${avmStalenessHours.toFixed(0)}h stale (threshold: 72h)`)
  }

  // Price deviation check — if asking > avm × 1.4, suspicious
  const priceDeviation = Math.abs(inputs.asking_price - inputs.avm_value) / inputs.avm_value
  if (priceDeviation > 0.40) {
    issues.push(`Asking price deviates ${(priceDeviation * 100).toFixed(1)}% from AVM (threshold: 40%)`)
  }

  // Recent distribution check — don't re-distribute within 24h
  if (lastDistributedAt != null) {
    const hoursSinceLast = (Date.now() - new Date(lastDistributedAt).getTime()) / 3_600_000
    if (hoursSinceLast < 24) {
      issues.push(`Property distributed ${hoursSinceLast.toFixed(1)}h ago (cooldown: 24h)`)
    }
  }

  // Score vs routing tier check
  if (inputs.routing_tier === 'A+' && inputs.opportunity_score < 85) {
    issues.push(`A+ tier requires score ≥ 85 (got ${inputs.opportunity_score})`)
  }
  if (inputs.routing_tier === 'A' && (inputs.opportunity_score < 70 || inputs.opportunity_score >= 85)) {
    issues.push(`A tier requires score 70-84 (got ${inputs.opportunity_score})`)
  }

  // Empty recipients for non-skip tier
  if (inputs.routing_tier !== 'skip' && inputs.recipient_ids.length === 0) {
    issues.push('No recipients for a non-skip routing tier')
  }

  const risk_level: ConsistencyValidation['risk_level'] =
    issues.length === 0 ? 'low'
    : issues.length === 1 ? 'medium'
    : issues.length === 2 ? 'high'
    : 'critical'

  return {
    is_consistent: issues.length === 0,
    issues,
    risk_level,
  }
}

// ---------------------------------------------------------------------------
// PURE: Check idempotency against existing record
// ---------------------------------------------------------------------------

export function checkIdempotency(
  decisionId: string,
  existing?:  StoredDecision | null,
): IdempotencyResult {
  if (!existing) {
    return { is_duplicate: false, existing_status: null, decision_id: decisionId }
  }
  return {
    is_duplicate:    true,
    existing_status: existing.status,
    decision_id:     decisionId,
  }
}

// ---------------------------------------------------------------------------
// PURE: Assess overall decision risk before execution
// ---------------------------------------------------------------------------

export function assessDecisionRisk(
  consistency:      ConsistencyValidation,
  avmStalenessHours: number,
  scoreConfidence:  number,    // 0-1
): DecisionRisk {
  const flags: string[] = [...consistency.issues]
  let riskScore = 0

  if (!consistency.is_consistent) riskScore += consistency.issues.length * 15
  if (avmStalenessHours > 48)      riskScore += 20
  if (scoreConfidence < 0.5)       riskScore += 25

  riskScore = Math.min(100, riskScore)

  const recommendation: DecisionRisk['recommendation'] =
    riskScore >= 60 ? 'block'
    : riskScore >= 30 ? 'review'
    : 'proceed'

  return { score: riskScore, flags, recommendation }
}

// ---------------------------------------------------------------------------
// DB: Record decision attempt (pre-execution)
// ---------------------------------------------------------------------------

export async function recordDecisionAttempt(
  decisionId: string,
  inputs:     DecisionInputs,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabaseAdmin as any)
    .from('transactional_decisions')
    .upsert({
      decision_id:       decisionId,
      property_id:       inputs.property_id,
      opportunity_score: inputs.opportunity_score,
      routing_tier:      inputs.routing_tier,
      recipient_count:   inputs.recipient_ids.length,
      status:            'pending',
      inputs_snapshot:   JSON.stringify(inputs),
    }, { onConflict: 'decision_id' })
  if (error) throw new Error(`recordDecisionAttempt: ${error.message}`)
}

// ---------------------------------------------------------------------------
// DB: Get decision by ID (for idempotency check)
// ---------------------------------------------------------------------------

export async function getDecisionById(
  decisionId: string,
): Promise<StoredDecision | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from('transactional_decisions')
    .select('decision_id, property_id, status, created_at')
    .eq('decision_id', decisionId)
    .maybeSingle()
  if (error) throw new Error(`getDecisionById: ${error.message}`)
  return data ?? null
}

// ---------------------------------------------------------------------------
// DB: Mark decision complete / failed
// ---------------------------------------------------------------------------

export async function markDecisionComplete(
  decisionId: string,
  status:     'complete' | 'failed' | 'skipped',
  summary?:   Record<string, unknown>,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabaseAdmin as any)
    .from('transactional_decisions')
    .update({
      status,
      completed_at:    new Date().toISOString(),
      result_summary:  summary ? JSON.stringify(summary) : null,
    })
    .eq('decision_id', decisionId)
  if (error) throw new Error(`markDecisionComplete: ${error.message}`)
}
