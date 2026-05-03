// =============================================================================
// Tests — lib/intelligence/autoLearning.ts  (pure functions only)
// =============================================================================

import { describe, it, expect, vi } from 'vitest'

vi.mock('../../../lib/supabase', () => ({ supabaseAdmin: {}, supabase: {} }))

import {
  computeDriftSignificance,
  shouldTriggerAutoUpdate,
  shouldTriggerRollback,
  computePromotionReadiness,
  buildAutoUpdateRecord,
} from '../../../lib/intelligence/autoLearning'
import type { LearningMetrics } from '../../../lib/intelligence/autoLearning'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMetrics(overrides: Partial<LearningMetrics> = {}): LearningMetrics {
  return {
    drift_pct:             8,
    sample_size:           75,
    sigma_from_baseline:   2.5,
    backtest_accuracy_pct: 78,
    backtest_mae:          3.2,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// computeDriftSignificance
// ---------------------------------------------------------------------------

describe('computeDriftSignificance', () => {
  it('insufficient data → sigma=0, not significant', () => {
    const r = computeDriftSignificance([50], [60])
    expect(r.sigma).toBe(0)
    expect(r.is_significant).toBe(false)
  })

  it('same distribution → sigma≈0', () => {
    const base = [50, 50, 50, 50, 50]
    const r    = computeDriftSignificance(base, base)
    expect(r.sigma).toBeCloseTo(0, 1)
    expect(r.is_significant).toBe(false)
  })

  it('large shift → significant (σ ≥ 2)', () => {
    const base    = [50, 50, 52, 48, 50]
    const current = [75, 77, 73, 76, 74]   // very different
    const r       = computeDriftSignificance(base, current)
    expect(r.is_significant).toBe(true)
    expect(r.sigma).toBeGreaterThanOrEqual(2)
  })

  it('drift_pct is always non-negative', () => {
    const r = computeDriftSignificance([70, 70, 70], [60, 60, 60])
    expect(r.drift_pct).toBeGreaterThanOrEqual(0)
  })
})

// ---------------------------------------------------------------------------
// shouldTriggerAutoUpdate
// ---------------------------------------------------------------------------

describe('shouldTriggerAutoUpdate', () => {
  it('all gates pass → should_trigger=true', () => {
    const r = shouldTriggerAutoUpdate(makeMetrics())
    expect(r.should_trigger).toBe(true)
    expect(r.blocking_gates).toHaveLength(0)
    expect(r.passed_gates).toHaveLength(4)
  })

  it('low drift → blocked', () => {
    const r = shouldTriggerAutoUpdate(makeMetrics({ drift_pct: 2 }))
    expect(r.should_trigger).toBe(false)
    expect(r.blocking_gates.some(g => g.includes('drift'))).toBe(true)
  })

  it('small sample → blocked', () => {
    const r = shouldTriggerAutoUpdate(makeMetrics({ sample_size: 10 }))
    expect(r.should_trigger).toBe(false)
    expect(r.blocking_gates.some(g => g.includes('sample'))).toBe(true)
  })

  it('low sigma → blocked', () => {
    const r = shouldTriggerAutoUpdate(makeMetrics({ sigma_from_baseline: 1.0 }))
    expect(r.should_trigger).toBe(false)
    expect(r.blocking_gates.some(g => g.includes('σ'))).toBe(true)
  })

  it('low backtest accuracy → blocked', () => {
    const r = shouldTriggerAutoUpdate(makeMetrics({ backtest_accuracy_pct: 50 }))
    expect(r.should_trigger).toBe(false)
    expect(r.blocking_gates.some(g => g.includes('backtest'))).toBe(true)
  })

  it('custom config thresholds respected', () => {
    // Raise requirements — should block
    const r = shouldTriggerAutoUpdate(makeMetrics(), { min_drift_pct: 20, min_sample_size: 200 })
    expect(r.should_trigger).toBe(false)
  })

  it('all blocking gates listed when multiple fail', () => {
    const r = shouldTriggerAutoUpdate(makeMetrics({ drift_pct: 1, sample_size: 5, sigma_from_baseline: 0.5, backtest_accuracy_pct: 40 }))
    expect(r.blocking_gates).toHaveLength(4)
  })
})

// ---------------------------------------------------------------------------
// shouldTriggerRollback
// ---------------------------------------------------------------------------

describe('shouldTriggerRollback', () => {
  it('no degradation → no rollback', () => {
    const r = shouldTriggerRollback(75, 80)    // improvement
    expect(r.should_rollback).toBe(false)
    expect(r.severity).toBe('none')
  })

  it('minor drop → warning, no rollback', () => {
    const r = shouldTriggerRollback(80, 77)    // ~3.75% drop
    expect(r.should_rollback).toBe(false)
    expect(r.severity).toBe('warning')
  })

  it('large drop ≥ 8% → rollback required', () => {
    const r = shouldTriggerRollback(80, 68)    // 15% drop
    expect(r.should_rollback).toBe(true)
    expect(r.severity).toBe('critical')
  })

  it('accuracy_drop_pct is computed', () => {
    const r = shouldTriggerRollback(80, 68)
    expect(r.accuracy_drop_pct).toBeGreaterThan(0)
  })

  it('custom max_drop_pct respected', () => {
    const r = shouldTriggerRollback(80, 75, { max_drop_pct: 3 })
    expect(r.should_rollback).toBe(true)   // 6.25% drop > 3% threshold
  })
})

// ---------------------------------------------------------------------------
// computePromotionReadiness
// ---------------------------------------------------------------------------

describe('computePromotionReadiness', () => {
  it('draft → can promote to shadow (with 24h shadow run)', () => {
    const r = computePromotionReadiness('draft', makeMetrics(), 30)
    expect(r.can_promote_to).toBe('shadow')
    expect(r.blockers).toHaveLength(0)
  })

  it('draft → blocked without enough shadow run hours', () => {
    const r = computePromotionReadiness('draft', makeMetrics(), 5)
    expect(r.can_promote_to).toBeNull()
    expect(r.blockers.some(b => b.includes('Shadow run'))).toBe(true)
  })

  it('shadow → can promote to staged with good metrics', () => {
    const r = computePromotionReadiness('shadow', makeMetrics())
    expect(r.can_promote_to).toBe('staged')
  })

  it('shadow → blocked if backtest too low', () => {
    const r = computePromotionReadiness('shadow', makeMetrics({ backtest_accuracy_pct: 50 }))
    expect(r.can_promote_to).toBeNull()
  })

  it('staged → can promote to production when all gates pass', () => {
    const r = computePromotionReadiness('staged', makeMetrics())
    expect(r.can_promote_to).toBe('production')
  })

  it('production → cannot promote further', () => {
    const r = computePromotionReadiness('production', makeMetrics())
    expect(r.can_promote_to).toBeNull()
  })

  it('archived → cannot promote', () => {
    const r = computePromotionReadiness('archived', makeMetrics())
    expect(r.can_promote_to).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// buildAutoUpdateRecord
// ---------------------------------------------------------------------------

describe('buildAutoUpdateRecord', () => {
  it('builds record with correct fields', () => {
    const r = buildAutoUpdateRecord('OpportunityScoreV2', 'v2.0', 'v2.1', makeMetrics(), 'drift exceeded')
    expect(r.model_name).toBe('OpportunityScoreV2')
    expect(r.from_version).toBe('v2.0')
    expect(r.to_version).toBe('v2.1')
    expect(r.trigger_reason).toBe('drift exceeded')
    expect(r.status).toBe('initiated')
  })

  it('includes metrics snapshot', () => {
    const metrics = makeMetrics()
    const r       = buildAutoUpdateRecord('M', 'v1', 'v2', metrics, 'test')
    expect(r.metrics_snapshot.drift_pct).toBe(metrics.drift_pct)
  })

  it('initiated_at is a valid ISO date', () => {
    const r = buildAutoUpdateRecord('M', 'v1', 'v2', makeMetrics(), 'test')
    expect(() => new Date(r.initiated_at)).not.toThrow()
  })
})
