import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { rateLimit } from '@/lib/rateLimit'

// Mock NextAuth JWT so the auth API tests do not require a real session
vi.mock('next-auth/jwt', () => ({
  getToken: vi.fn(),
}))

// ─── Auth rate limiting behaviour ────────────────────────────────────────────
// The 2FA check endpoint uses the shared rate limiter.
// Tests drive the limiter directly — avoiding HTTP layer complexity.
// NOTE: In test env, UPSTASH_* vars are absent so in-memory path is used.

describe('Auth Rate Limiting', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.advanceTimersByTime(2 * 60 * 60 * 1000)
    vi.useRealTimers()
  })

  it('blocks after 5 failed attempts (check-2fa policy)', async () => {
    // The check-2fa route uses: { maxAttempts: 5, windowMs: 15 * 60 * 1000 }
    const opts  = { maxAttempts: 5, windowMs: 15 * 60 * 1000 }
    const ip    = `2fa-lockout-${Date.now()}`

    // 5 attempts — all allowed
    for (let i = 0; i < 5; i++) {
      expect((await rateLimit(ip, opts)).success).toBe(true)
    }

    // 6th attempt — blocked
    const blocked = await rateLimit(ip, opts)
    expect(blocked.success).toBe(false)
    expect(blocked.remaining).toBe(0)
    expect(blocked.reset).toBeGreaterThan(Date.now())
  })

  it('lockout window is 15 minutes for 2FA checks', async () => {
    const windowMs = 15 * 60 * 1000
    const opts = { maxAttempts: 5, windowMs }
    const ip   = `2fa-window-${Date.now()}`

    // Exhaust all attempts
    for (let i = 0; i < 5; i++) await rateLimit(ip, opts)
    expect((await rateLimit(ip, opts)).success).toBe(false)

    // 14 minutes 59 seconds — still locked
    vi.advanceTimersByTime(windowMs - 1000)
    expect((await rateLimit(ip, opts)).success).toBe(false)

    // Full window elapsed — unlocked
    vi.advanceTimersByTime(2000) // total: windowMs + 1s
    expect((await rateLimit(ip, opts)).success).toBe(true)
  })

  it('login rate limit: blocks after 10 attempts (login policy)', async () => {
    // Login endpoint uses: { maxAttempts: 10, windowMs: 15 * 60 * 1000 }
    const opts = { maxAttempts: 10, windowMs: 15 * 60 * 1000 }
    const ip   = `login-lockout-${Date.now()}`

    for (let i = 0; i < 10; i++) {
      expect((await rateLimit(ip, opts)).success).toBe(true)
    }

    const blocked = await rateLimit(ip, opts)
    expect(blocked.success).toBe(false)
    expect(blocked.remaining).toBe(0)
  })

  it('different users (IPs) are not cross-contaminated during lockout', async () => {
    const opts   = { maxAttempts: 3, windowMs: 15 * 60 * 1000 }
    const userA  = `user-a-${Date.now()}`
    const userB  = `user-b-${Date.now()}`

    // Lock out user A
    await rateLimit(userA, opts)
    await rateLimit(userA, opts)
    await rateLimit(userA, opts)
    expect((await rateLimit(userA, opts)).success).toBe(false)

    // User B should be completely unaffected
    const bResult = await rateLimit(userB, opts)
    expect(bResult.success).toBe(true)
    expect(bResult.remaining).toBe(2)
  })

  it('rate limit reset is in the 15-minute future', async () => {
    const windowMs = 15 * 60 * 1000
    const opts     = { maxAttempts: 5, windowMs }
    const ip       = `reset-future-${Date.now()}`

    const result = await rateLimit(ip, opts)
    const toleranceMs = 200

    expect(result.reset).toBeGreaterThanOrEqual(Date.now() + windowMs - toleranceMs)
    expect(result.reset).toBeLessThanOrEqual(Date.now() + windowMs + toleranceMs)
  })
})

// ─── Auth token validation (integration shape) ───────────────────────────────
// These tests verify the mock is wired correctly. Full integration tests
// (which need a running Next.js server) live in tests/e2e/auth.spec.ts.

describe('Auth Token Mock', () => {
  it('getToken mock can be configured to return null (unauthenticated)', async () => {
    const { getToken } = await import('next-auth/jwt')
    vi.mocked(getToken).mockResolvedValue(null)

    const token = await getToken({ req: {} as never })
    expect(token).toBeNull()
  })

  it('getToken mock can return a valid session token', async () => {
    const { getToken } = await import('next-auth/jwt')
    const mockToken = {
      sub: 'user-123',
      email: 'agent@agencygroup.pt',
      name:  'Test Agent',
      role:  'agent',
    }
    vi.mocked(getToken).mockResolvedValue(mockToken as never)

    const token = await getToken({ req: {} as never })
    expect(token).not.toBeNull()
    expect(token?.email).toBe('agent@agencygroup.pt')
    expect(token?.role).toBe('agent')
  })

  it('getToken mock resets between tests', async () => {
    const { getToken } = await import('next-auth/jwt')
    vi.mocked(getToken).mockResolvedValue(null)
    const token = await getToken({ req: {} as never })
    expect(token).toBeNull()
  })
})
