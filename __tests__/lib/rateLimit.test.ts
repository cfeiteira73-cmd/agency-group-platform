import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { rateLimit, getRetryAfterMinutes } from '@/lib/rateLimit'

// Access the internal store via module re-import to reset between tests.
// We use vi.useFakeTimers to control window expiry.

describe('rateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    // Advance past any active windows before restoring real timers
    vi.advanceTimersByTime(2 * 60 * 60 * 1000)
    vi.useRealTimers()
  })

  it('allows requests within the limit', () => {
    const opts = { maxAttempts: 5, windowMs: 15 * 60 * 1000 }
    const ip = `test-allow-${Date.now()}`

    const first = rateLimit(ip, opts)
    expect(first.success).toBe(true)
    expect(first.remaining).toBe(4)

    const second = rateLimit(ip, opts)
    expect(second.success).toBe(true)
    expect(second.remaining).toBe(3)

    const third = rateLimit(ip, opts)
    expect(third.success).toBe(true)
    expect(third.remaining).toBe(2)
  })

  it('blocks requests when limit is exceeded', () => {
    const opts = { maxAttempts: 3, windowMs: 15 * 60 * 1000 }
    const ip = `test-block-${Date.now()}`

    rateLimit(ip, opts) // 1
    rateLimit(ip, opts) // 2
    rateLimit(ip, opts) // 3 — last allowed

    const blocked = rateLimit(ip, opts) // 4 — should be blocked
    expect(blocked.success).toBe(false)
    expect(blocked.remaining).toBe(0)
    expect(blocked.reset).toBeGreaterThan(Date.now())
  })

  it('resets after the window expires', () => {
    const windowMs = 15 * 60 * 1000
    const opts = { maxAttempts: 2, windowMs }
    const ip = `test-reset-${Date.now()}`

    rateLimit(ip, opts) // 1
    rateLimit(ip, opts) // 2
    const blocked = rateLimit(ip, opts) // blocked
    expect(blocked.success).toBe(false)

    // Advance time past the window
    vi.advanceTimersByTime(windowMs + 1000)

    const afterReset = rateLimit(ip, opts)
    expect(afterReset.success).toBe(true)
    expect(afterReset.remaining).toBe(1)
  })

  it('tracks different IPs independently', () => {
    const opts = { maxAttempts: 1, windowMs: 15 * 60 * 1000 }
    const ipA = `test-ip-a-${Date.now()}`
    const ipB = `test-ip-b-${Date.now()}`

    const a1 = rateLimit(ipA, opts) // 1st for A — allowed
    expect(a1.success).toBe(true)

    const b1 = rateLimit(ipB, opts) // 1st for B — allowed (independent)
    expect(b1.success).toBe(true)

    const a2 = rateLimit(ipA, opts) // 2nd for A — blocked
    expect(a2.success).toBe(false)

    const b2 = rateLimit(ipB, opts) // 2nd for B — blocked
    expect(b2.success).toBe(false)
  })

  it('returns a reset timestamp in the future', () => {
    const opts = { maxAttempts: 5, windowMs: 60 * 1000 }
    const ip = `test-reset-ts-${Date.now()}`

    const result = rateLimit(ip, opts)
    expect(result.reset).toBeGreaterThan(Date.now())
    expect(result.reset).toBeLessThanOrEqual(Date.now() + 60 * 1000 + 100)
  })
})

describe('getRetryAfterMinutes', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.advanceTimersByTime(0)
    vi.useRealTimers()
  })

  it('returns ceiling of minutes until reset', () => {
    // Set a fixed "now" via fake timers so Date.now() is stable
    const now = Date.now()
    const reset = now + 10 * 60 * 1000 + 30 * 1000 // 10m 30s from now
    const minutes = getRetryAfterMinutes(reset)
    expect(minutes).toBe(11) // ceiled
  })

  it('returns 1 for resets less than 1 minute away', () => {
    const reset = Date.now() + 30 * 1000
    expect(getRetryAfterMinutes(reset)).toBe(1)
  })

  it('returns 0 or negative for already-expired resets', () => {
    const reset = Date.now() - 1000
    expect(getRetryAfterMinutes(reset)).toBeLessThanOrEqual(0)
  })
})
