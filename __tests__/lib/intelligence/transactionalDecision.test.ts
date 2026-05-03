// =============================================================================
// Tests — lib/intelligence/transactionalDecision.ts  (pure functions only)
// =============================================================================

import { describe, it, expect, vi } from 'vitest'

vi.mock('../../../lib/supabase', () => ({ supabaseAdmin: {}, supabase: {} }))

import {
  generateDecisionId,
  validateDecisionConsistency,
  checkIdempotency,
  assessDecisionRisk,
} from '../../../lib/intelligence/transactionalDecision'
import type {
  DecisionInputs,
  StoredDecision,
} from '../../../lib/intelligence/transactionalDecision'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInputs(overrides: Partial<DecisionInputs> = {}): DecisionInputs {
  return {
    property_id:       'prop-001',
    opportunity_score: 88,
    avm_value:         500_000,
    asking_price:      520_000,
    scored_at:         '2026-05-02T10:00:00Z',
    routing_tier:      'A+',
    recipient_ids:     ['r1', 'r2', 'r3'],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// generateDecisionId
// ---------------------------------------------------------------------------

describe('generateDecisionId', () => {
  it('returns a non-empty string', () => {
    expect(generateDecisionId(makeInputs())).toBeTruthy()
  })

  it('same inputs → same ID (deterministic)', () => {
    const a = generateDecisionId(makeInputs())
    const b = generateDecisionId(makeInputs())
    expect(a).toBe(b)
  })

  it('different property → different ID', () => {
    const a = generateDecisionId(makeInputs({ property_id: 'p1' }))
    const b = generateDecisionId(makeInputs({ property_id: 'p2' }))
    expect(a).not.toBe(b)
  })

  it('different tier → different ID', () => {
    const a = generateDecisionId(makeInputs({ routing_tier: 'A+' }))
    const b = generateDecisionId(makeInputs({ routing_tier: 'A' }))
    expect(a).not.toBe(b)
  })

  it('same hour → same ID (retry-safe within same hour)', () => {
    const a = generateDecisionId(makeInputs({ scored_at: '2026-05-02T10:00:00Z' }))
    const b = generateDecisionId(makeInputs({ scored_at: '2026-05-02T10:59:59Z' }))
    expect(a).toBe(b)
  })

  it('different hour → different ID', () => {
    const a = generateDecisionId(makeInputs({ scored_at: '2026-05-02T10:00:00Z' }))
    const b = generateDecisionId(makeInputs({ scored_at: '2026-05-02T11:00:00Z' }))
    expect(a).not.toBe(b)
  })

  it('output is 32 hex chars', () => {
    const id = generateDecisionId(makeInputs())
    expect(id).toMatch(/^[a-f0-9]{32}$/)
  })
})

// ---------------------------------------------------------------------------
// validateDecisionConsistency
// ---------------------------------------------------------------------------

describe('validateDecisionConsistency', () => {
  it('clean inputs → is_consistent=true, risk=low', () => {
    const result = validateDecisionConsistency(makeInputs(), 10, null)
    expect(result.is_consistent).toBe(true)
    expect(result.risk_level).toBe('low')
    expect(result.issues).toHaveLength(0)
  })

  it('stale AVM (>72h) → issue flagged', () => {
    const result = validateDecisionConsistency(makeInputs(), 100, null)
    expect(result.issues.some(i => i.includes('stale'))).toBe(true)
  })

  it('price deviation >40% → issue flagged', () => {
    const inputs = makeInputs({ avm_value: 300_000, asking_price: 600_000 })  // 100% deviation
    const result = validateDecisionConsistency(inputs, 10, null)
    expect(result.issues.some(i => i.includes('deviates'))).toBe(true)
  })

  it('distributed <24h ago → issue flagged', () => {
    const recent = new Date(Date.now() - 2 * 3_600_000).toISOString()
    const result = validateDecisionConsistency(makeInputs(), 10, recent)
    expect(result.issues.some(i => i.includes('distributed'))).toBe(true)
  })

  it('A+ tier with score 70 → issue flagged', () => {
    const inputs = makeInputs({ routing_tier: 'A+', opportunity_score: 70 })
    const result = validateDecisionConsistency(inputs, 10, null)
    expect(result.issues.some(i => i.includes('A+'))).toBe(true)
  })

  it('non-skip tier with no recipients → issue flagged', () => {
    const inputs = makeInputs({ routing_tier: 'A', recipient_ids: [] })
    const result = validateDecisionConsistency(inputs, 10, null)
    expect(result.issues.some(i => i.includes('No recipients'))).toBe(true)
  })

  it('multiple issues → risk escalates', () => {
    const inputs = makeInputs({ avm_value: 100_000, asking_price: 600_000, recipient_ids: [] })
    const result = validateDecisionConsistency(inputs, 200, null)
    expect(result.risk_level).toBe('critical')
    expect(result.issues.length).toBeGreaterThan(2)
  })
})

// ---------------------------------------------------------------------------
// checkIdempotency
// ---------------------------------------------------------------------------

describe('checkIdempotency', () => {
  it('no existing → not a duplicate', () => {
    const r = checkIdempotency('abc123', null)
    expect(r.is_duplicate).toBe(false)
    expect(r.existing_status).toBeNull()
  })

  it('existing record → is a duplicate', () => {
    const existing: StoredDecision = {
      decision_id: 'abc123',
      property_id: 'p1',
      status:      'complete',
      created_at:  new Date().toISOString(),
    }
    const r = checkIdempotency('abc123', existing)
    expect(r.is_duplicate).toBe(true)
    expect(r.existing_status).toBe('complete')
  })

  it('preserves decision_id', () => {
    const r = checkIdempotency('my-id-xyz', null)
    expect(r.decision_id).toBe('my-id-xyz')
  })
})

// ---------------------------------------------------------------------------
// assessDecisionRisk
// ---------------------------------------------------------------------------

describe('assessDecisionRisk', () => {
  it('clean state → proceed', () => {
    const consistency = validateDecisionConsistency(makeInputs(), 5, null)
    const risk = assessDecisionRisk(consistency, 5, 0.9)
    expect(risk.recommendation).toBe('proceed')
    expect(risk.score).toBeLessThan(30)
  })

  it('stale AVM → elevated risk', () => {
    const consistency = { is_consistent: true, issues: [], risk_level: 'low' as const }
    const risk = assessDecisionRisk(consistency, 60, 0.8)
    expect(risk.score).toBeGreaterThan(15)
  })

  it('low confidence → elevated risk', () => {
    const consistency = { is_consistent: true, issues: [], risk_level: 'low' as const }
    const risk = assessDecisionRisk(consistency, 10, 0.2)
    expect(risk.score).toBeGreaterThan(20)
  })

  it('critical consistency → block', () => {
    const consistency = {
      is_consistent: false,
      issues:        ['issue1', 'issue2', 'issue3', 'issue4'],
      risk_level:    'critical' as const,
    }
    const risk = assessDecisionRisk(consistency, 100, 0.2)
    expect(risk.recommendation).toBe('block')
  })
})
