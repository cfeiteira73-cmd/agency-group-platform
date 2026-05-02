// =============================================================================
// Agency Group — Confidence Gate
// lib/quality/confidenceGate.ts
//
// Determines whether a deal can auto-distribute or requires manual review.
// This is the final safety check before any distribution is executed.
//
// GATE RULES (in priority order):
//   1. Distribution paused        → BLOCK
//   2. Grade A+ (always review)   → REVIEW
//   3. Low AVM confidence         → REVIEW
//   4. Low opportunity score      → BLOCK
//   5. Score below grade minimum  → REVIEW (grade/score mismatch)
//   6. Otherwise                  → AUTO
//
// PURE FUNCTIONS (unit-testable, no DB):
//   evaluateGate, getRequiredAction
// =============================================================================

import type { ControlCheckResult } from '@/lib/ops/distributionControl'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GateAction = 'auto' | 'review' | 'block'

export interface GateInput {
  opportunity_score:   number
  opportunity_grade:   string
  avm_confidence:      number | null
  distribution_tier:   string
  control_check:       ControlCheckResult
  has_quality_flags?:  boolean   // critical data quality flags present
}

export interface GateDecision {
  action:        GateAction
  reason:        string
  review_reason?: string   // if action === 'review', why it was queued
  score:          number
  grade:          string
  avm_confidence: number | null
}

// ---------------------------------------------------------------------------
// PURE: Evaluate gate for a deal
// ---------------------------------------------------------------------------

export function evaluateGate(input: GateInput): GateDecision {
  const { opportunity_score, opportunity_grade, avm_confidence, control_check, has_quality_flags } = input

  // 1. Distribution paused — hard block
  if (control_check.is_paused) {
    return {
      action:        'block',
      reason:        control_check.reason || 'Distribution paused',
      score:         opportunity_score,
      grade:         opportunity_grade,
      avm_confidence,
    }
  }

  // 2. Critical quality flags — require review
  if (has_quality_flags) {
    return {
      action:        'review',
      review_reason: 'critical_quality_flag',
      reason:        'Listing has critical data quality flags — manual review required.',
      score:         opportunity_score,
      grade:         opportunity_grade,
      avm_confidence,
    }
  }

  // 3. A+ deals always require review (high-value gate)
  if (opportunity_grade === 'A+' || input.distribution_tier === 'A+') {
    return {
      action:        'review',
      review_reason: 'auto_grade_aplus',
      reason:        'A+ grade deal requires manual review before distribution.',
      score:         opportunity_score,
      grade:         opportunity_grade,
      avm_confidence,
    }
  }

  // 4. Score below distribution threshold — block
  if (opportunity_score < 55) {
    return {
      action: 'block',
      reason: `Score ${opportunity_score} below distribution threshold (55). Deal skipped.`,
      score:  opportunity_score,
      grade:  opportunity_grade,
      avm_confidence,
    }
  }

  // 5. Very low AVM confidence → require review for A-tier
  if (
    avm_confidence != null &&
    avm_confidence < 0.35 &&
    (opportunity_grade === 'A' || opportunity_grade === 'A+')
  ) {
    return {
      action:        'review',
      review_reason: 'low_avm_confidence',
      reason:        `AVM confidence ${(avm_confidence * 100).toFixed(0)}% below 35% — A-tier deal requires review.`,
      score:         opportunity_score,
      grade:         opportunity_grade,
      avm_confidence,
    }
  }

  // 6. Grade/score mismatch — suspicious
  const gradeMinScore: Record<string, number> = { 'A+': 85, 'A': 70, 'B': 55, 'C': 40 }
  const expected = gradeMinScore[opportunity_grade]
  if (expected != null && opportunity_score < expected - 10) {
    return {
      action:        'review',
      review_reason: 'grade_score_mismatch',
      reason:        `Score ${opportunity_score} is significantly below grade ${opportunity_grade} minimum (${expected}). Possible recalibration needed.`,
      score:         opportunity_score,
      grade:         opportunity_grade,
      avm_confidence,
    }
  }

  // All checks passed — auto-distribute
  return {
    action: 'auto',
    reason: 'All confidence checks passed.',
    score:  opportunity_score,
    grade:  opportunity_grade,
    avm_confidence,
  }
}

// ---------------------------------------------------------------------------
// PURE: Extract the required action from a gate decision (convenience)
// ---------------------------------------------------------------------------

export function getRequiredAction(decision: GateDecision): GateAction {
  return decision.action
}

// ---------------------------------------------------------------------------
// PURE: Check if gate should queue for review
// ---------------------------------------------------------------------------

export function shouldQueueForReview(decision: GateDecision): boolean {
  return decision.action === 'review'
}

// ---------------------------------------------------------------------------
// PURE: Check if gate is a hard block (no distribution at all)
// ---------------------------------------------------------------------------

export function isHardBlock(decision: GateDecision): boolean {
  return decision.action === 'block'
}
