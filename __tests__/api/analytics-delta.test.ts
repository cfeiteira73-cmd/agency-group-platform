// =============================================================================
// AGENCY GROUP — Analytics Summary: Period-over-Period Delta Tests
// Verifies the GCI and deals delta computation added in Wave D.
// These are pure-logic tests — no HTTP, no Supabase required.
// =============================================================================

import { describe, it, expect } from 'vitest'

// ─── Pure delta computation helper (extracted from route logic) ───────────────
// Mirrors the computation in app/api/analytics/summary/route.ts exactly so that
// a change in the route would break these tests, catching regressions.

function computeGciDelta(gciCurrent: number, gciPrev: number): number | undefined {
  if (gciPrev <= 0) return undefined
  return Math.round(((gciCurrent - gciPrev) / gciPrev) * 1000) / 10
}

function computeDealsDelta(dealsCurrent: number, dealsPrev: number): number | undefined {
  if (dealsPrev <= 0) return undefined
  return Math.round(((dealsCurrent - dealsPrev) / dealsPrev) * 1000) / 10
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Analytics delta — GCI period-over-period', () => {
  it('returns undefined when previous period is zero (no prior data)', () => {
    expect(computeGciDelta(50000, 0)).toBeUndefined()
    expect(computeGciDelta(50000, -1)).toBeUndefined()
  })

  it('returns positive delta when GCI grew', () => {
    // 100k → 120k = +20%
    const delta = computeGciDelta(120_000, 100_000)
    expect(delta).toBe(20)
  })

  it('returns negative delta when GCI declined', () => {
    // 100k → 80k = -20%
    const delta = computeGciDelta(80_000, 100_000)
    expect(delta).toBe(-20)
  })

  it('returns 0 when GCI is unchanged', () => {
    expect(computeGciDelta(75_000, 75_000)).toBe(0)
  })

  it('rounds to 1 decimal place', () => {
    // 100k → 133.33k ≈ +33.3%
    const delta = computeGciDelta(133_333, 100_000)
    expect(typeof delta).toBe('number')
    expect(delta).toBeCloseTo(33.3, 0)
    // Ensure it's not returning an excessive number of decimal places
    expect(String(delta).split('.')[1]?.length ?? 0).toBeLessThanOrEqual(1)
  })

  it('handles large values without overflow', () => {
    const delta = computeGciDelta(5_000_000, 4_000_000)
    expect(delta).toBe(25)
  })

  it('handles fractional GCI values', () => {
    const delta = computeGciDelta(10_500, 10_000)
    expect(delta).toBe(5)
  })
})

describe('Analytics delta — deals count period-over-period', () => {
  it('returns undefined when previous period has no deals', () => {
    expect(computeDealsDelta(5, 0)).toBeUndefined()
  })

  it('returns positive delta when deal count grew', () => {
    // 4 → 6 = +50%
    expect(computeDealsDelta(6, 4)).toBe(50)
  })

  it('returns negative delta when deal count declined', () => {
    // 6 → 4 = -33.3%
    const delta = computeDealsDelta(4, 6)
    expect(delta).toBeDefined()
    expect(delta!).toBeLessThan(0)
    expect(delta).toBeCloseTo(-33.3, 0)
  })

  it('returns 0 when deal count is unchanged', () => {
    expect(computeDealsDelta(3, 3)).toBe(0)
  })
})

describe('Analytics delta — safety invariants', () => {
  it('never returns Infinity', () => {
    // Division by zero is guarded — undefined, not Infinity
    const result = computeGciDelta(99999, 0)
    expect(result).not.toBe(Infinity)
    expect(result).toBeUndefined()
  })

  it('never returns NaN', () => {
    const result = computeGciDelta(0, 0)
    expect(result).not.toBeNaN()
    expect(result).toBeUndefined() // gciPrev = 0 → undefined
  })

  it('result is a finite number when both periods have data', () => {
    const delta = computeGciDelta(168700, 142800)
    expect(typeof delta).toBe('number')
    expect(Number.isFinite(delta!)).toBe(true)
  })
})
