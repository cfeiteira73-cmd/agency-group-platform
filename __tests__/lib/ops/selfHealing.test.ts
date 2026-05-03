// =============================================================================
// Tests — lib/ops/selfHealing.ts  (pure functions only)
// =============================================================================

import { describe, it, expect } from 'vitest'

import {
  classifyFailure,
  computeRetryStrategy,
  classifyCircuitState,
  shouldCircuitBreak,
  computeStabilityScore,
  buildRecoveryPlan,
  assessSystemStability,
} from '../../../lib/ops/selfHealing'
import type {
  SystemFailure,
  CircuitBreakerConfig,
} from '../../../lib/ops/selfHealing'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFailure(msg: string, code?: string | number, component = 'supabase'): SystemFailure {
  return { error_message: msg, error_code: code, component, occurred_at: new Date().toISOString() }
}

const defaultConfig: CircuitBreakerConfig = {
  failure_threshold:    5,
  success_threshold:    2,
  half_open_timeout_ms: 30_000,
  error_rate_threshold: 0.5,
}

// ---------------------------------------------------------------------------
// classifyFailure
// ---------------------------------------------------------------------------

describe('classifyFailure', () => {
  it('401 → auth_failure, not retriable', () => {
    const r = classifyFailure(makeFailure('unauthorized', '401'))
    expect(r.failure_type).toBe('auth_failure')
    expect(r.is_retriable).toBe(false)
    expect(r.requires_human).toBe(true)
    expect(r.severity).toBe('critical')
  })

  it('429 → rate_limit, retriable', () => {
    const r = classifyFailure(makeFailure('rate limit exceeded', '429'))
    expect(r.failure_type).toBe('rate_limit')
    expect(r.is_retriable).toBe(true)
  })

  it('503 → infra_failure, retriable', () => {
    const r = classifyFailure(makeFailure('service unavailable', '503'))
    expect(r.failure_type).toBe('infra_failure')
    expect(r.is_retriable).toBe(true)
  })

  it('timeout → infra_failure', () => {
    const r = classifyFailure(makeFailure('connection timeout'))
    expect(r.failure_type).toBe('infra_failure')
  })

  it('constraint violation → data_failure', () => {
    const r = classifyFailure(makeFailure('null value violates not-null constraint'))
    expect(r.failure_type).toBe('data_failure')
    expect(r.is_retriable).toBe(false)
  })

  it('schema validation → data_failure', () => {
    const r = classifyFailure(makeFailure('schema validation failed'))
    expect(r.failure_type).toBe('data_failure')
  })

  it('model accuracy drop → model_degradation, requires human', () => {
    const r = classifyFailure(makeFailure('model accuracy degradation detected'))
    expect(r.failure_type).toBe('model_degradation')
    expect(r.requires_human).toBe(true)
  })

  it('market anomaly → market_anomaly', () => {
    const r = classifyFailure(makeFailure('market anomaly detected in zone'))
    expect(r.failure_type).toBe('market_anomaly')
  })

  it('unknown error → unknown type, retriable', () => {
    const r = classifyFailure(makeFailure('some weird random error'))
    expect(r.failure_type).toBe('unknown')
    expect(r.is_retriable).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// computeRetryStrategy
// ---------------------------------------------------------------------------

describe('computeRetryStrategy', () => {
  it('non-retriable → 0 attempts', () => {
    const classification = classifyFailure(makeFailure('unauthorized', '401'))
    const strategy       = computeRetryStrategy(classification)
    expect(strategy.max_attempts).toBe(0)
  })

  it('rate_limit → 5 attempts with backoff', () => {
    const classification = classifyFailure(makeFailure('rate limit', '429'))
    const strategy       = computeRetryStrategy(classification)
    expect(strategy.max_attempts).toBe(5)
    expect(strategy.backoff_factor).toBeGreaterThan(1)
    expect(strategy.jitter).toBe(true)
  })

  it('infra_failure → 3 attempts', () => {
    const classification = classifyFailure(makeFailure('connection refused', '503'))
    const strategy       = computeRetryStrategy(classification)
    expect(strategy.max_attempts).toBe(3)
  })

  it('data_failure → not retriable (0 attempts) — bad data never fixes itself', () => {
    // data_failure has is_retriable=false → strategy returns max_attempts=0
    const classification = classifyFailure(makeFailure('constraint violation'))
    expect(classification.is_retriable).toBe(false)
    const strategy       = computeRetryStrategy(classification)
    expect(strategy.max_attempts).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// classifyCircuitState
// ---------------------------------------------------------------------------

describe('classifyCircuitState', () => {
  it('closed + below threshold → stays closed', () => {
    expect(classifyCircuitState('closed', 3, 0, 0, defaultConfig)).toBe('closed')
  })

  it('closed + exceeds threshold → opens', () => {
    expect(classifyCircuitState('closed', 5, 0, 0, defaultConfig)).toBe('open')
  })

  it('open + before timeout → stays open', () => {
    expect(classifyCircuitState('open', 5, 0, 10_000, defaultConfig)).toBe('open')
  })

  it('open + after timeout → half_open', () => {
    expect(classifyCircuitState('open', 5, 0, 60_000, defaultConfig)).toBe('half_open')
  })

  it('half_open + success threshold → closed', () => {
    expect(classifyCircuitState('half_open', 0, 2, 0, defaultConfig)).toBe('closed')
  })

  it('half_open + failure → re-opens', () => {
    expect(classifyCircuitState('half_open', 1, 0, 0, defaultConfig)).toBe('open')
  })
})

// ---------------------------------------------------------------------------
// shouldCircuitBreak
// ---------------------------------------------------------------------------

describe('shouldCircuitBreak', () => {
  it('low failures + low rate → no break', () => {
    expect(shouldCircuitBreak(2, 0.1)).toBe(false)
  })

  it('consecutive failures ≥ 5 → break', () => {
    expect(shouldCircuitBreak(5, 0.1)).toBe(true)
  })

  it('error rate ≥ 0.5 → break', () => {
    expect(shouldCircuitBreak(1, 0.5)).toBe(true)
  })

  it('custom threshold respected', () => {
    expect(shouldCircuitBreak(3, 0.3, { max_consecutive_failures: 3 })).toBe(true)
    expect(shouldCircuitBreak(3, 0.3, { max_consecutive_failures: 10 })).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// computeStabilityScore
// ---------------------------------------------------------------------------

describe('computeStabilityScore', () => {
  it('perfect conditions → 100', () => {
    expect(computeStabilityScore(0, 100, 0)).toBe(100)
  })

  it('50%+ error rate → ≤50', () => {
    const score = computeStabilityScore(0.5, 100, 0)
    expect(score).toBeLessThanOrEqual(50)
  })

  it('high latency → penalty', () => {
    const low  = computeStabilityScore(0, 200, 0)
    const high = computeStabilityScore(0, 10_000, 0)
    expect(low).toBeGreaterThan(high)
  })

  it('degraded components → penalty per component', () => {
    const zero = computeStabilityScore(0, 100, 0)
    const two  = computeStabilityScore(0, 100, 2)
    expect(zero - two).toBe(20)
  })

  it('result is 0-100', () => {
    const score = computeStabilityScore(1.0, 50_000, 10)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })
})

// ---------------------------------------------------------------------------
// buildRecoveryPlan
// ---------------------------------------------------------------------------

describe('buildRecoveryPlan', () => {
  it('auth_failure → no retry, requires intervention', () => {
    const classification = classifyFailure(makeFailure('jwt invalid', '401'))
    const plan           = buildRecoveryPlan(classification, 'auth_service')
    expect(plan.requires_intervention).toBe(true)
    expect(plan.estimated_recovery_ms).toBe(0)
  })

  it('rate_limit → fallback available', () => {
    const classification = classifyFailure(makeFailure('too many requests', '429'))
    const plan           = buildRecoveryPlan(classification, 'openai')
    expect(plan.fallback_available).toBe(true)
    expect(plan.steps.length).toBeGreaterThan(0)
  })

  it('infra_failure → retry steps included', () => {
    const classification = classifyFailure(makeFailure('connection refused', '503'))
    const plan           = buildRecoveryPlan(classification, 'supabase')
    expect(plan.steps.some(s => s.toLowerCase().includes('retry'))).toBe(true)
  })

  it('component name appears in first step', () => {
    const classification = classifyFailure(makeFailure('error'))
    const plan           = buildRecoveryPlan(classification, 'my_component')
    expect(plan.steps[0]).toContain('my_component')
  })
})

// ---------------------------------------------------------------------------
// assessSystemStability
// ---------------------------------------------------------------------------

describe('assessSystemStability', () => {
  it('healthy state', () => {
    const r = assessSystemStability(0.01, 300, [])
    expect(r.status).toBe('healthy')
    expect(r.score).toBeGreaterThan(80)
  })

  it('critical state with many degraded components', () => {
    const r = assessSystemStability(0.6, 15_000, ['db', 'api', 'queue', 'cache', 'ai'])
    expect(r.status).toBe('critical')
  })

  it('degraded components listed', () => {
    const r = assessSystemStability(0.05, 500, ['supabase', 'redis'])
    expect(r.degraded_components).toContain('supabase')
    expect(r.degraded_components).toContain('redis')
  })

  it('recommendations included when issues present', () => {
    const r = assessSystemStability(0.15, 3_000, ['db'])
    expect(r.recommendations.length).toBeGreaterThan(0)
  })
})
