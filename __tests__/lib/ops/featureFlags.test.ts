// =============================================================================
// Tests — lib/ops/featureFlags.ts  (pure functions only)
// =============================================================================

import { describe, it, expect, vi } from 'vitest'

vi.mock('../../../lib/supabase', () => ({ supabaseAdmin: {}, supabase: {} }))

import {
  hashForRollout,
  evaluateFlag,
  isFlagEnabled,
  buildFlagPayload,
} from '../../../lib/ops/featureFlags'
import type { FeatureFlag } from '../../../lib/ops/featureFlags'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFlag(overrides: Partial<FeatureFlag> = {}): FeatureFlag {
  return {
    id:             'flag-001',
    flag_key:       'test_flag',
    flag_name:      'Test Flag',
    description:    null,
    flag_scope:     'global',
    subsystem:      null,
    is_enabled:     true,
    rollout_pct:    100,
    config:         {},
    is_kill_switch: false,
    is_canary:      false,
    enabled_by:     null,
    enabled_at:     null,
    disabled_by:    null,
    disabled_at:    null,
    expires_at:     null,
    created_at:     new Date().toISOString(),
    updated_at:     new Date().toISOString(),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// hashForRollout
// ---------------------------------------------------------------------------

describe('hashForRollout', () => {
  it('returns number between 0 and 99', () => {
    const h = hashForRollout('my_flag', 'user@test.com')
    expect(h).toBeGreaterThanOrEqual(0)
    expect(h).toBeLessThan(100)
  })

  it('is deterministic — same inputs produce same output', () => {
    const h1 = hashForRollout('flag_a', 'user@test.com')
    const h2 = hashForRollout('flag_a', 'user@test.com')
    expect(h1).toBe(h2)
  })

  it('different contexts produce different buckets (usually)', () => {
    const results = new Set<number>()
    for (let i = 0; i < 20; i++) {
      results.add(hashForRollout('test_flag', `user${i}@test.com`))
    }
    expect(results.size).toBeGreaterThan(5)  // should have variety
  })

  it('different flag keys for same context produce different buckets', () => {
    const h1 = hashForRollout('flag_a', 'user@test.com')
    const h2 = hashForRollout('flag_b', 'user@test.com')
    expect(h1).not.toBe(h2)
  })
})

// ---------------------------------------------------------------------------
// evaluateFlag
// ---------------------------------------------------------------------------

describe('evaluateFlag', () => {
  it('returns true for enabled flag with 100% rollout', () => {
    expect(evaluateFlag(makeFlag())).toBe(true)
  })

  it('returns false for disabled flag', () => {
    expect(evaluateFlag(makeFlag({ is_enabled: false }))).toBe(false)
  })

  it('returns false for expired flag', () => {
    const past = new Date(Date.now() - 3600_000).toISOString()
    expect(evaluateFlag(makeFlag({ expires_at: past }))).toBe(false)
  })

  it('returns true for flag expiring in the future', () => {
    const future = new Date(Date.now() + 3600_000).toISOString()
    expect(evaluateFlag(makeFlag({ expires_at: future }))).toBe(true)
  })

  it('returns false for 0% rollout', () => {
    expect(evaluateFlag(makeFlag({ rollout_pct: 0 }))).toBe(false)
  })

  it('uses deterministic bucketing for partial rollout', () => {
    const flag    = makeFlag({ rollout_pct: 50 })
    const results = new Set<boolean>()
    for (let i = 0; i < 20; i++) {
      results.add(evaluateFlag(flag, { recipient_email: `user${i}@test.com` }))
    }
    // With 50% rollout and 20 users, should see both true and false
    expect(results.has(true)).toBe(true)
    expect(results.has(false)).toBe(true)
  })

  it('same context always gets same result for partial rollout', () => {
    const flag = makeFlag({ rollout_pct: 50 })
    const r1   = evaluateFlag(flag, { recipient_email: 'fixed@test.com' })
    const r2   = evaluateFlag(flag, { recipient_email: 'fixed@test.com' })
    expect(r1).toBe(r2)
  })

  it('kill switch false when disabled', () => {
    expect(evaluateFlag(makeFlag({ is_kill_switch: true, is_enabled: false }))).toBe(false)
  })

  it('kill switch true when enabled', () => {
    expect(evaluateFlag(makeFlag({ is_kill_switch: true, is_enabled: true }))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// isFlagEnabled
// ---------------------------------------------------------------------------

describe('isFlagEnabled', () => {
  it('returns true when flag is in list and enabled', () => {
    const flags = [makeFlag({ flag_key: 'feature_x', is_enabled: true })]
    expect(isFlagEnabled(flags, 'feature_x')).toBe(true)
  })

  it('returns false when flag is not in list', () => {
    expect(isFlagEnabled([], 'feature_x')).toBe(false)
  })

  it('returns false when flag is disabled', () => {
    const flags = [makeFlag({ flag_key: 'feature_x', is_enabled: false })]
    expect(isFlagEnabled(flags, 'feature_x')).toBe(false)
  })

  it('correctly evaluates kill_distribution flag (disabled = distribution runs)', () => {
    const flags = [makeFlag({ flag_key: 'kill_distribution', is_enabled: false, is_kill_switch: true })]
    expect(isFlagEnabled(flags, 'kill_distribution')).toBe(false)
  })

  it('kill_distribution enabled = distribution halted', () => {
    const flags = [makeFlag({ flag_key: 'kill_distribution', is_enabled: true, is_kill_switch: true })]
    expect(isFlagEnabled(flags, 'kill_distribution')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// buildFlagPayload
// ---------------------------------------------------------------------------

describe('buildFlagPayload', () => {
  it('builds minimal payload with defaults', () => {
    const p = buildFlagPayload('my_flag', 'My Flag')
    expect(p.flag_key).toBe('my_flag')
    expect(p.flag_name).toBe('My Flag')
    expect(p.is_enabled).toBe(false)
    expect(p.rollout_pct).toBe(100)
    expect(p.config).toEqual({})
    expect(p.is_kill_switch).toBe(false)
    expect(p.is_canary).toBe(false)
    expect(p.flag_scope).toBe('global')
  })

  it('builds kill switch', () => {
    const p = buildFlagPayload('kill_scoring', 'Kill Scoring', {
      isKillSwitch: true,
      subsystem:    'scoring',
    })
    expect(p.is_kill_switch).toBe(true)
    expect(p.subsystem).toBe('scoring')
  })

  it('builds canary with rollout percentage', () => {
    const p = buildFlagPayload('canary_v2', 'V2 Canary', {
      isCanary:   true,
      rolloutPct: 10,
    })
    expect(p.is_canary).toBe(true)
    expect(p.rollout_pct).toBe(10)
  })

  it('passes through config object', () => {
    const config = { threshold: 0.85, algorithm: 'v2' }
    const p      = buildFlagPayload('flag', 'Flag', { config })
    expect(p.config).toEqual(config)
  })

  it('sets expires_at when provided', () => {
    const exp = '2026-12-31T00:00:00.000Z'
    const p   = buildFlagPayload('temp_flag', 'Temp', { expiresAt: exp })
    expect(p.expires_at).toBe(exp)
  })
})
