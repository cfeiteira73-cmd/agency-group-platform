// =============================================================================
// Tests — lib/quality/confidenceGate.ts  (pure functions only)
// =============================================================================

import { describe, it, expect } from 'vitest'
import {
  evaluateGate,
  getRequiredAction,
  shouldQueueForReview,
  isHardBlock,
} from '../../../lib/quality/confidenceGate'
import type { GateInput } from '../../../lib/quality/confidenceGate'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGateInput(overrides: Partial<GateInput> = {}): GateInput {
  return {
    opportunity_score: 72,
    opportunity_grade: 'A',
    avm_confidence:    0.80,
    distribution_tier: 'A',
    control_check: { is_paused: false, blocking_control: null, reason: '' },
    has_quality_flags: false,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// evaluateGate — BLOCK cases
// ---------------------------------------------------------------------------

describe('evaluateGate — BLOCK cases', () => {
  it('blocks when distribution is paused (global)', () => {
    const decision = evaluateGate(makeGateInput({
      control_check: {
        is_paused:        true,
        blocking_control: { id: 'c1', control_type: 'global', zone_key: null, asset_type: null, tier: null, status: 'paused', reason: 'Maintenance', controlled_by: null },
        reason:           'Distribution paused (global) — Maintenance',
      },
    }))
    expect(decision.action).toBe('block')
    expect(decision.reason).toContain('paused')
  })

  it('blocks when score below 55', () => {
    const decision = evaluateGate(makeGateInput({ opportunity_score: 54, opportunity_grade: 'C' }))
    expect(decision.action).toBe('block')
    expect(decision.reason).toContain('55')
  })

  it('blocks at score = 0', () => {
    const decision = evaluateGate(makeGateInput({ opportunity_score: 0, opportunity_grade: 'D' }))
    expect(decision.action).toBe('block')
  })

  it('distribution pause takes priority over score check', () => {
    const decision = evaluateGate(makeGateInput({
      opportunity_score: 90,
      opportunity_grade: 'A+',
      control_check: {
        is_paused: true,
        blocking_control: { id: 'c1', control_type: 'global', zone_key: null, asset_type: null, tier: null, status: 'paused', reason: null, controlled_by: null },
        reason: 'Distribution paused (global)',
      },
    }))
    expect(decision.action).toBe('block')
  })
})

// ---------------------------------------------------------------------------
// evaluateGate — REVIEW cases
// ---------------------------------------------------------------------------

describe('evaluateGate — REVIEW cases', () => {
  it('reviews A+ deals always', () => {
    const decision = evaluateGate(makeGateInput({ opportunity_grade: 'A+', distribution_tier: 'A+', opportunity_score: 88 }))
    expect(decision.action).toBe('review')
    expect(decision.review_reason).toBe('auto_grade_aplus')
  })

  it('reviews when distribution_tier is A+ even if grade differs', () => {
    const decision = evaluateGate(makeGateInput({ distribution_tier: 'A+', opportunity_grade: 'A', opportunity_score: 75 }))
    expect(decision.action).toBe('review')
  })

  it('reviews A-tier with low AVM confidence (<35%)', () => {
    const decision = evaluateGate(makeGateInput({
      opportunity_grade: 'A',
      distribution_tier: 'A',
      avm_confidence:    0.30,
      opportunity_score: 72,
    }))
    expect(decision.action).toBe('review')
    expect(decision.review_reason).toBe('low_avm_confidence')
  })

  it('does NOT review B-tier with low AVM confidence', () => {
    // B-tier doesn't require AVM confidence gate
    const decision = evaluateGate(makeGateInput({
      opportunity_grade: 'B',
      distribution_tier: 'B',
      avm_confidence:    0.20,
      opportunity_score: 60,
    }))
    expect(decision.action).toBe('auto')
  })

  it('reviews when grade/score mismatch (score > 10 below grade min)', () => {
    // Grade A requires ≥70, score 58 → mismatch
    const decision = evaluateGate(makeGateInput({
      opportunity_grade: 'A',
      opportunity_score: 58,
    }))
    expect(decision.action).toBe('review')
    expect(decision.review_reason).toBe('grade_score_mismatch')
  })

  it('reviews when critical quality flags present', () => {
    const decision = evaluateGate(makeGateInput({ has_quality_flags: true }))
    expect(decision.action).toBe('review')
    expect(decision.review_reason).toBe('critical_quality_flag')
  })

  it('quality flag review takes priority over A+ review', () => {
    const decision = evaluateGate(makeGateInput({
      has_quality_flags: true,
      opportunity_grade: 'A+',
      distribution_tier: 'A+',
    }))
    expect(decision.action).toBe('review')
    expect(decision.review_reason).toBe('critical_quality_flag')
  })
})

// ---------------------------------------------------------------------------
// evaluateGate — AUTO cases
// ---------------------------------------------------------------------------

describe('evaluateGate — AUTO cases', () => {
  it('auto-distributes clean A deal', () => {
    const decision = evaluateGate(makeGateInput())
    expect(decision.action).toBe('auto')
  })

  it('auto-distributes B deal with null AVM confidence', () => {
    const decision = evaluateGate(makeGateInput({
      opportunity_grade: 'B',
      distribution_tier: 'B',
      avm_confidence:    null,
      opportunity_score: 62,
    }))
    expect(decision.action).toBe('auto')
  })

  it('auto-distributes A deal with good AVM confidence (≥35%)', () => {
    const decision = evaluateGate(makeGateInput({
      opportunity_grade: 'A',
      avm_confidence:    0.40,
      opportunity_score: 72,
    }))
    expect(decision.action).toBe('auto')
  })

  it('auto-distributes at score exactly 55 (threshold boundary)', () => {
    const decision = evaluateGate(makeGateInput({
      opportunity_grade: 'B',
      distribution_tier: 'B',
      opportunity_score: 55,
    }))
    expect(decision.action).toBe('auto')
  })

  it('always includes score, grade, avm_confidence in decision', () => {
    const decision = evaluateGate(makeGateInput())
    expect(decision.score).toBe(72)
    expect(decision.grade).toBe('A')
    expect(decision.avm_confidence).toBe(0.80)
  })
})

// ---------------------------------------------------------------------------
// getRequiredAction / shouldQueueForReview / isHardBlock
// ---------------------------------------------------------------------------

describe('getRequiredAction', () => {
  it('returns action from decision', () => {
    const d = evaluateGate(makeGateInput())
    expect(getRequiredAction(d)).toBe('auto')
  })
})

describe('shouldQueueForReview', () => {
  it('true for review decisions', () => {
    const d = evaluateGate(makeGateInput({ opportunity_grade: 'A+', distribution_tier: 'A+', opportunity_score: 88 }))
    expect(shouldQueueForReview(d)).toBe(true)
  })
  it('false for auto decisions', () => {
    const d = evaluateGate(makeGateInput())
    expect(shouldQueueForReview(d)).toBe(false)
  })
})

describe('isHardBlock', () => {
  it('true for block decisions', () => {
    const d = evaluateGate(makeGateInput({ opportunity_score: 30, opportunity_grade: 'D' }))
    expect(isHardBlock(d)).toBe(true)
  })
  it('false for auto decisions', () => {
    const d = evaluateGate(makeGateInput())
    expect(isHardBlock(d)).toBe(false)
  })
  it('false for review decisions', () => {
    const d = evaluateGate(makeGateInput({ opportunity_grade: 'A+', distribution_tier: 'A+', opportunity_score: 88 }))
    expect(isHardBlock(d)).toBe(false)
  })
})
