import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { rateLimit, getRetryAfterMinutes } from '@/lib/rateLimit'

// Covers edge cases NOT already in __tests__/lib/rateLimit.test.ts:
//   - Concurrent-request simulation (all requests in same tick)
//   - IP isolation with many IPs
//   - Boundary: exactly at the limit vs one over
//   - Header value computation via getRetryAfterMinutes

describe('RateLimiter — concurrent request handling', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.advanceTimersByTime(2 * 60 * 60 * 1000)
    vi.useRealTimers()
  })

  it('handles burst of requests in the same tick — counts correctly', () => {
    const opts = { maxAttempts: 5, windowMs: 60 * 1000 }
    const ip = `burst-${Date.now()}`

    // Simulate 5 requests arriving "simultaneously" (same tick, no timer advance)
    const results = Array.from({ length: 5 }, () => rateLimit(ip, opts))

    const successes = results.filter(r => r.success)
    const failures  = results.filter(r => !r.success)

    expect(successes).toHaveLength(5)
    expect(failures).toHaveLength(0)

    // 6th request must be blocked
    const blocked = rateLimit(ip, opts)
    expect(blocked.success).toBe(false)
    expect(blocked.remaining).toBe(0)
  })

  it('burst exceeding limit — excess requests blocked, not skipped', () => {
    const opts = { maxAttempts: 3, windowMs: 60 * 1000 }
    const ip = `burst-exceed-${Date.now()}`

    // Fire 6 requests — only first 3 should succeed
    const results = Array.from({ length: 6 }, () => rateLimit(ip, opts))

    const successes = results.filter(r => r.success)
    const failures  = results.filter(r => !r.success)

    expect(successes).toHaveLength(3)
    expect(failures).toHaveLength(3)
  })

  it('remaining counter decrements correctly across burst', () => {
    const opts = { maxAttempts: 4, windowMs: 60 * 1000 }
    const ip = `remaining-${Date.now()}`

    const r1 = rateLimit(ip, opts)
    const r2 = rateLimit(ip, opts)
    const r3 = rateLimit(ip, opts)
    const r4 = rateLimit(ip, opts)

    expect(r1.remaining).toBe(3)
    expect(r2.remaining).toBe(2)
    expect(r3.remaining).toBe(1)
    expect(r4.remaining).toBe(0)
  })

  it('all blocked requests share the same reset timestamp', () => {
    const opts = { maxAttempts: 2, windowMs: 60 * 1000 }
    const ip = `shared-reset-${Date.now()}`

    rateLimit(ip, opts)
    rateLimit(ip, opts)

    const b1 = rateLimit(ip, opts) // blocked
    const b2 = rateLimit(ip, opts) // blocked

    expect(b1.reset).toBe(b2.reset)
    expect(b1.reset).toBeGreaterThan(Date.now())
  })
})

describe('RateLimiter — IP isolation (extended)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.advanceTimersByTime(2 * 60 * 60 * 1000)
    vi.useRealTimers()
  })

  it('10 different IPs are all isolated — exhausting one does not affect others', () => {
    const opts = { maxAttempts: 2, windowMs: 60 * 1000 }
    const ips = Array.from({ length: 10 }, (_, i) => `ip-isolate-${i}-${Date.now()}`)

    // Exhaust the first IP
    rateLimit(ips[0], opts)
    rateLimit(ips[0], opts)
    const blocked = rateLimit(ips[0], opts)
    expect(blocked.success).toBe(false)

    // All other IPs should still be fresh
    for (const ip of ips.slice(1)) {
      const result = rateLimit(ip, opts)
      expect(result.success).toBe(true)
      expect(result.remaining).toBe(1)
    }
  })

  it('IPv6 and IPv4 addresses are treated as different keys', () => {
    const opts = { maxAttempts: 1, windowMs: 60 * 1000 }
    const ipv4 = `192.168.1.1-${Date.now()}`
    const ipv6 = `2001:db8::1-${Date.now()}`

    const a = rateLimit(ipv4, opts)
    const b = rateLimit(ipv6, opts)

    expect(a.success).toBe(true)
    expect(b.success).toBe(true)

    // Both should now be blocked independently
    expect(rateLimit(ipv4, opts).success).toBe(false)
    expect(rateLimit(ipv6, opts).success).toBe(false)
  })

  it('forwarded IP via custom key format is tracked independently', () => {
    const opts = { maxAttempts: 3, windowMs: 60 * 1000 }
    // Simulating x-forwarded-for header patterns used by middleware
    const directIp  = `10.0.0.1-direct-${Date.now()}`
    const proxyIp   = `10.0.0.1-proxy-${Date.now()}`

    rateLimit(directIp, opts)
    rateLimit(directIp, opts)
    rateLimit(directIp, opts)
    expect(rateLimit(directIp, opts).success).toBe(false)

    // Proxy key is a completely different bucket — still fresh
    expect(rateLimit(proxyIp, opts).success).toBe(true)
  })
})

describe('RateLimiter — rate limit header value computation', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.advanceTimersByTime(2 * 60 * 60 * 1000)
    vi.useRealTimers()
  })

  it('Retry-After header value is ceiling of minutes to reset', () => {
    const windowMs = 15 * 60 * 1000 // 15 min window
    const opts = { maxAttempts: 1, windowMs }
    const ip = `header-val-${Date.now()}`

    rateLimit(ip, opts) // consume the only allowed request
    const blocked = rateLimit(ip, opts)

    const retryAfter = getRetryAfterMinutes(blocked.reset)

    // Should be 15 minutes (ceiled), within ±1 minute tolerance for rounding
    expect(retryAfter).toBeGreaterThanOrEqual(14)
    expect(retryAfter).toBeLessThanOrEqual(16)
  })

  it('Retry-After is 1 (minimum) even with sub-minute windows', () => {
    const opts = { maxAttempts: 1, windowMs: 30 * 1000 } // 30 second window
    const ip = `short-window-${Date.now()}`

    rateLimit(ip, opts)
    const blocked = rateLimit(ip, opts)

    const retryAfter = getRetryAfterMinutes(blocked.reset)
    expect(retryAfter).toBeGreaterThanOrEqual(1)
  })

  it('reset timestamp is always in the future after first request', () => {
    const opts = { maxAttempts: 10, windowMs: 5 * 60 * 1000 }
    const ip = `future-ts-${Date.now()}`

    const result = rateLimit(ip, opts)
    expect(result.reset).toBeGreaterThan(Date.now())
    // And it matches the window duration within a tight margin
    expect(result.reset).toBeLessThanOrEqual(Date.now() + 5 * 60 * 1000 + 50)
  })

  it('X-RateLimit-Remaining goes to 0 at exactly the limit', () => {
    const opts = { maxAttempts: 3, windowMs: 60 * 1000 }
    const ip = `remaining-zero-${Date.now()}`

    rateLimit(ip, opts) // remaining: 2
    rateLimit(ip, opts) // remaining: 1
    const last = rateLimit(ip, opts) // remaining: 0

    expect(last.success).toBe(true)
    expect(last.remaining).toBe(0)

    // Next call must fail
    const overLimit = rateLimit(ip, opts)
    expect(overLimit.success).toBe(false)
    expect(overLimit.remaining).toBe(0)
  })
})

describe('RateLimiter — window reset behaviour', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.advanceTimersByTime(2 * 60 * 60 * 1000)
    vi.useRealTimers()
  })

  it('counter fully resets after window — remaining back to maxAttempts - 1', () => {
    const windowMs = 10 * 1000 // 10 second window for speed
    const opts = { maxAttempts: 3, windowMs }
    const ip = `full-reset-${Date.now()}`

    // Exhaust
    rateLimit(ip, opts)
    rateLimit(ip, opts)
    rateLimit(ip, opts)
    expect(rateLimit(ip, opts).success).toBe(false)

    // Advance past window
    vi.advanceTimersByTime(windowMs + 100)

    const fresh = rateLimit(ip, opts)
    expect(fresh.success).toBe(true)
    expect(fresh.remaining).toBe(2) // maxAttempts(3) - 1 used = 2 remaining
  })

  it('partial use then window reset — counter does not carry over', () => {
    const windowMs = 10 * 1000
    const opts = { maxAttempts: 5, windowMs }
    const ip = `partial-reset-${Date.now()}`

    rateLimit(ip, opts) // 1st
    rateLimit(ip, opts) // 2nd — used 2 of 5

    vi.advanceTimersByTime(windowMs + 100)

    // Window reset — should be back to full quota
    const fresh = rateLimit(ip, opts)
    expect(fresh.success).toBe(true)
    expect(fresh.remaining).toBe(4) // fresh window: 5 - 1 = 4
  })
})
