// In-memory rate limiter — no Redis required
// Works per-IP with configurable window and attempt limits.
// Expired entries are pruned on every check to prevent memory leaks.

interface RateLimitEntry {
  attempts: number
  resetAt: number
}

interface RateLimitResult {
  success: boolean
  remaining: number
  reset: number // Unix timestamp (ms) when the window resets
}

interface RateLimiterOptions {
  maxAttempts: number
  windowMs: number
}

const store = new Map<string, RateLimitEntry>()

function pruneExpired(): void {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key)
    }
  }
}

export function rateLimit(ip: string, opts: RateLimiterOptions): RateLimitResult {
  pruneExpired()

  const now = Date.now()
  const { maxAttempts, windowMs } = opts
  const existing = store.get(ip)

  if (!existing || now > existing.resetAt) {
    // First attempt in this window
    const resetAt = now + windowMs
    store.set(ip, { attempts: 1, resetAt })
    return { success: true, remaining: maxAttempts - 1, reset: resetAt }
  }

  if (existing.attempts >= maxAttempts) {
    return { success: false, remaining: 0, reset: existing.resetAt }
  }

  existing.attempts += 1
  return {
    success: true,
    remaining: maxAttempts - existing.attempts,
    reset: existing.resetAt,
  }
}

export function getRetryAfterMinutes(reset: number): number {
  return Math.ceil((reset - Date.now()) / 60_000)
}
