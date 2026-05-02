// =============================================================================
// Tests — lib/intelligence/engagementDecay.ts  (pure functions only)
// =============================================================================

import { describe, it, expect, vi } from 'vitest'

vi.mock('../../../lib/supabase', () => ({ supabaseAdmin: {}, supabase: {} }))

import {
  computeDecayFactor,
  applyDecayToScore,
  classifyEngagementStatus,
  computeDaysSinceEngagement,
  computeReengagementPriority,
  buildDecayAdjustedProfile,
} from '../../../lib/intelligence/engagementDecay'

// ---------------------------------------------------------------------------
// computeDecayFactor
// ---------------------------------------------------------------------------

describe('computeDecayFactor', () => {
  it('returns 1.0 for 0 days', () => {
    expect(computeDecayFactor(0)).toBe(1.0)
  })

  it('returns exactly 0.5 at half-life (45 days)', () => {
    const f = computeDecayFactor(45)
    expect(f).toBeCloseTo(0.5, 2)
  })

  it('returns 0 for 2+ years', () => {
    expect(computeDecayFactor(730)).toBe(0.0)
    expect(computeDecayFactor(1000)).toBe(0.0)
  })

  it('monotonically decreasing', () => {
    const f0  = computeDecayFactor(0)
    const f7  = computeDecayFactor(7)
    const f30 = computeDecayFactor(30)
    const f90 = computeDecayFactor(90)
    expect(f0).toBeGreaterThan(f7)
    expect(f7).toBeGreaterThan(f30)
    expect(f30).toBeGreaterThan(f90)
  })

  it('custom half-life changes decay rate', () => {
    // 30d half-life: decay faster
    const fast = computeDecayFactor(30, { halfLifeDays: 30 })
    // 90d half-life: decay slower
    const slow = computeDecayFactor(30, { halfLifeDays: 90 })
    expect(fast).toBeLessThan(slow)
  })

  it('value between 0 and 1 for typical ranges', () => {
    for (const d of [1, 7, 14, 30, 60, 90, 180]) {
      const f = computeDecayFactor(d)
      expect(f).toBeGreaterThanOrEqual(0)
      expect(f).toBeLessThanOrEqual(1)
    }
  })
})

// ---------------------------------------------------------------------------
// applyDecayToScore
// ---------------------------------------------------------------------------

describe('applyDecayToScore', () => {
  it('score unchanged at 0 days', () => {
    expect(applyDecayToScore(80, 0)).toBe(80)
  })

  it('score halved at half-life', () => {
    const s = applyDecayToScore(100, 45)
    expect(s).toBeCloseTo(50, 0)
  })

  it('returns 0 for 730+ days regardless of score', () => {
    expect(applyDecayToScore(100, 730)).toBe(0)
  })

  it('result is never negative', () => {
    expect(applyDecayToScore(50, 365)).toBeGreaterThanOrEqual(0)
  })
})

// ---------------------------------------------------------------------------
// classifyEngagementStatus
// ---------------------------------------------------------------------------

describe('classifyEngagementStatus', () => {
  it('active at factor > 0.75',   () => expect(classifyEngagementStatus(0.9)).toBe('active'))
  it('warming at 0.5-0.75',       () => expect(classifyEngagementStatus(0.6)).toBe('warming'))
  it('cooling at 0.25-0.5',       () => expect(classifyEngagementStatus(0.35)).toBe('cooling'))
  it('dormant at 0.1-0.25',       () => expect(classifyEngagementStatus(0.15)).toBe('dormant'))
  it('inactive below 0.1',        () => expect(classifyEngagementStatus(0.05)).toBe('inactive'))

  it('boundary: 0.75 is NOT active (>0.75 required)', () => {
    expect(classifyEngagementStatus(0.75)).toBe('warming')
  })

  it('boundary: 0.1 is NOT dormant (>0.1 required)', () => {
    expect(classifyEngagementStatus(0.1)).toBe('inactive')
  })
})

// ---------------------------------------------------------------------------
// computeDaysSinceEngagement
// ---------------------------------------------------------------------------

describe('computeDaysSinceEngagement', () => {
  it('returns 9999 for null', () => {
    expect(computeDaysSinceEngagement(null)).toBe(9999)
    expect(computeDaysSinceEngagement(undefined)).toBe(9999)
  })

  it('returns ~0 for today', () => {
    const now = new Date().toISOString()
    expect(computeDaysSinceEngagement(now)).toBe(0)
  })

  it('returns 7 for 7 days ago', () => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000).toISOString()
    expect(computeDaysSinceEngagement(sevenDaysAgo)).toBe(7)
  })

  it('uses custom asOf date', () => {
    const base  = new Date('2026-05-01T00:00:00Z')
    const prior = new Date('2026-04-21T00:00:00Z').toISOString()   // 10 days before
    expect(computeDaysSinceEngagement(prior, base)).toBe(10)
  })
})

// ---------------------------------------------------------------------------
// computeReengagementPriority
// ---------------------------------------------------------------------------

describe('computeReengagementPriority', () => {
  it('returns 0 for active recipient (no need)', () => {
    expect(computeReengagementPriority(80, 0.9)).toBe(0)    // already active
  })

  it('returns 0 for fully decayed recipient (too cold)', () => {
    expect(computeReengagementPriority(80, 0.02)).toBe(0)
  })

  it('returns positive score for cooling recipient with good ROI', () => {
    const p = computeReengagementPriority(80, 0.35)   // cooling + good ROI
    expect(p).toBeGreaterThan(0)
  })

  it('higher ROI → higher priority at same decay', () => {
    const highROI = computeReengagementPriority(90, 0.35)
    const lowROI  = computeReengagementPriority(30, 0.35)
    expect(highROI).toBeGreaterThan(lowROI)
  })

  it('result is 0-100', () => {
    for (const decay of [0.1, 0.2, 0.3, 0.5, 0.7]) {
      const p = computeReengagementPriority(100, decay)
      expect(p).toBeGreaterThanOrEqual(0)
      expect(p).toBeLessThanOrEqual(100)
    }
  })
})

// ---------------------------------------------------------------------------
// buildDecayAdjustedProfile
// ---------------------------------------------------------------------------

describe('buildDecayAdjustedProfile', () => {
  it('builds profile with all fields', () => {
    const p = buildDecayAdjustedProfile('user@test.com', 80, null)
    expect(p.recipient_email).toBe('user@test.com')
    expect(p.raw_roi_score).toBe(80)
    expect(p.decay_factor).toBeDefined()
    expect(p.adjusted_roi_score).toBeDefined()
    expect(p.engagement_status).toBeDefined()
    expect(p.days_since_engagement).toBe(9999)
  })

  it('null lastEngagedAt → inactive status', () => {
    const p = buildDecayAdjustedProfile('u@t.com', 80, null)
    expect(p.engagement_status).toBe('inactive')
    expect(p.adjusted_roi_score).toBe(0)
  })

  it('recent engagement → active status', () => {
    const recent = new Date(Date.now() - 3 * 86400_000).toISOString()
    const p      = buildDecayAdjustedProfile('u@t.com', 80, recent)
    expect(p.engagement_status).toBe('active')
    expect(p.adjusted_roi_score).toBeGreaterThan(60)
  })

  it('adjusted_roi_score ≤ raw_roi_score', () => {
    const p = buildDecayAdjustedProfile('u@t.com', 80, new Date(Date.now() - 30 * 86400_000).toISOString())
    expect(p.adjusted_roi_score).toBeLessThanOrEqual(p.raw_roi_score)
  })
})
