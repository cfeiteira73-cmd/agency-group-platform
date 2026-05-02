// =============================================================================
// Tests — lib/ops/jobQueue.ts  (pure functions only)
// =============================================================================

import { describe, it, expect, vi } from 'vitest'

vi.mock('../../../lib/supabase', () => ({ supabaseAdmin: {}, supabase: {} }))

import {
  computeBackoffSeconds,
  computeNextRetryAt,
  shouldRetry,
  summarizeQueueHealth,
} from '../../../lib/ops/jobQueue'
import type { Job } from '../../../lib/ops/jobQueue'

// ---------------------------------------------------------------------------
// computeBackoffSeconds
// ---------------------------------------------------------------------------

describe('computeBackoffSeconds', () => {
  it('attempt 1 → 120s (2 min)', () => {
    expect(computeBackoffSeconds(1)).toBe(120)
  })

  it('attempt 2 → 480s (8 min)', () => {
    expect(computeBackoffSeconds(2)).toBe(480)
  })

  it('attempt 3 → 1920s (120 × 4²)', () => {
    // base=120, factor=4: 120 * 4^2 = 1920
    expect(computeBackoffSeconds(3)).toBe(1920)
  })

  it('attempt 4 → 7200s (capped at 2h)', () => {
    // base=120, factor=4: 120 * 4^3 = 7680 → capped to 7200
    expect(computeBackoffSeconds(4)).toBe(7200)
  })

  it('attempt 5+ → 7200s (still capped)', () => {
    expect(computeBackoffSeconds(5)).toBe(7200)
    expect(computeBackoffSeconds(10)).toBe(7200)
  })

  it('always returns a positive number', () => {
    for (let i = 1; i <= 6; i++) {
      expect(computeBackoffSeconds(i)).toBeGreaterThan(0)
    }
  })

  it('backoff strictly increases up to cap', () => {
    const b1 = computeBackoffSeconds(1)
    const b2 = computeBackoffSeconds(2)
    const b3 = computeBackoffSeconds(3)
    expect(b2).toBeGreaterThan(b1)
    expect(b3).toBeGreaterThan(b2)
  })
})

// ---------------------------------------------------------------------------
// computeNextRetryAt
// ---------------------------------------------------------------------------

describe('computeNextRetryAt', () => {
  it('returns Date object', () => {
    expect(computeNextRetryAt(1)).toBeInstanceOf(Date)
  })

  it('attempt 1 → fromDate + 120s', () => {
    const from     = new Date('2026-05-02T10:00:00.000Z')
    const expected = new Date('2026-05-02T10:02:00.000Z')
    expect(computeNextRetryAt(1, from).getTime()).toBe(expected.getTime())
  })

  it('attempt 2 → fromDate + 480s', () => {
    const from     = new Date('2026-05-02T10:00:00.000Z')
    const expected = new Date('2026-05-02T10:08:00.000Z')
    expect(computeNextRetryAt(2, from).getTime()).toBe(expected.getTime())
  })

  it('attempt 3 → fromDate + 1920s (32 min)', () => {
    const from     = new Date('2026-05-02T10:00:00.000Z')
    const expected = new Date(from.getTime() + 1920 * 1000)  // 10:32:00 UTC
    expect(computeNextRetryAt(3, from).getTime()).toBe(expected.getTime())
  })

  it('result is always in the future relative to fromDate', () => {
    const from = new Date()
    expect(computeNextRetryAt(1, from).getTime()).toBeGreaterThan(from.getTime())
  })

  it('defaults fromDate to now when not given', () => {
    const before = Date.now()
    const result = computeNextRetryAt(1)
    const after  = Date.now()
    // result should be fromDate+120s, so between before+120000 and after+120000
    expect(result.getTime()).toBeGreaterThanOrEqual(before + 120_000)
    expect(result.getTime()).toBeLessThanOrEqual(after + 120_000 + 100)  // 100ms tolerance
  })
})

// ---------------------------------------------------------------------------
// shouldRetry
// ---------------------------------------------------------------------------

describe('shouldRetry', () => {
  it('attempt 0 of 3 → should retry', () => {
    expect(shouldRetry(0, 3)).toBe(true)
  })

  it('attempt 1 of 3 → should retry', () => {
    expect(shouldRetry(1, 3)).toBe(true)
  })

  it('attempt 2 of 3 → should retry', () => {
    expect(shouldRetry(2, 3)).toBe(true)
  })

  it('attempt 3 of 3 → dead (no retry)', () => {
    expect(shouldRetry(3, 3)).toBe(false)
  })

  it('attempt 4 of 3 → dead', () => {
    expect(shouldRetry(4, 3)).toBe(false)
  })

  it('attempt 0 of 1 → should retry', () => {
    expect(shouldRetry(0, 1)).toBe(true)
  })

  it('attempt 1 of 1 → dead', () => {
    expect(shouldRetry(1, 1)).toBe(false)
  })

  it('returns boolean', () => {
    expect(typeof shouldRetry(1, 3)).toBe('boolean')
  })
})

// ---------------------------------------------------------------------------
// summarizeQueueHealth
// ---------------------------------------------------------------------------

describe('summarizeQueueHealth', () => {
  it('empty queue returns all zeros', () => {
    const summary = summarizeQueueHealth([])
    expect(summary.pending).toBe(0)
    expect(summary.running).toBe(0)
    expect(summary.completed).toBe(0)
    expect(summary.failed).toBe(0)
    expect(summary.dead).toBe(0)
    expect(summary.total).toBe(0)
  })

  it('counts all statuses correctly', () => {
    const jobs: Pick<Job, 'status'>[] = [
      { status: 'pending' },
      { status: 'pending' },
      { status: 'running' },
      { status: 'completed' },
      { status: 'completed' },
      { status: 'completed' },
      { status: 'failed' },
      { status: 'dead' },
    ]
    const summary = summarizeQueueHealth(jobs)
    expect(summary.pending).toBe(2)
    expect(summary.running).toBe(1)
    expect(summary.completed).toBe(3)
    expect(summary.failed).toBe(1)
    expect(summary.dead).toBe(1)
    expect(summary.total).toBe(8)
  })

  it('total = sum of all statuses', () => {
    const jobs: Pick<Job, 'status'>[] = [
      { status: 'pending' },
      { status: 'completed' },
      { status: 'dead' },
    ]
    const summary = summarizeQueueHealth(jobs)
    expect(summary.total).toBe(3)
    expect(summary.pending + summary.running + summary.completed + summary.failed + summary.dead).toBe(3)
  })

  it('all pending', () => {
    const jobs: Pick<Job, 'status'>[] = Array.from({ length: 5 }, () => ({ status: 'pending' as const }))
    const summary = summarizeQueueHealth(jobs)
    expect(summary.pending).toBe(5)
    expect(summary.total).toBe(5)
  })

  it('all dead', () => {
    const jobs: Pick<Job, 'status'>[] = Array.from({ length: 3 }, () => ({ status: 'dead' as const }))
    const summary = summarizeQueueHealth(jobs)
    expect(summary.dead).toBe(3)
    expect(summary.total).toBe(3)
  })
})
