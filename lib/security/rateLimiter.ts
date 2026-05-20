// =============================================================================
// Agency Group — Redis Sliding-Window Rate Limiter
// lib/security/rateLimiter.ts
//
// Provides a sliding-window rate limiter backed by Upstash Redis.
// Uses the same Upstash REST pipeline pattern as the rest of the codebase.
//
// Fail-open: if Redis is unavailable, requests are allowed through.
// TypeScript strict — 0 errors
// =============================================================================

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RateLimitResult {
  allowed:   boolean
  remaining: number
  reset_at:  number // unix timestamp ms when the oldest entry expires
}

// ─── Redis config ─────────────────────────────────────────────────────────────

interface RedisConfig { url: string; token: string }

function getRedisConfig(): RedisConfig | null {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return { url, token }
}

// ─── Pipeline helper ──────────────────────────────────────────────────────────

/**
 * Executes a Redis pipeline via Upstash REST.
 * Returns the array of per-command results, or null on failure.
 */
async function redisPipeline(
  commands: (string | number)[][],
): Promise<Array<{ result: unknown }> | null> {
  const cfg = getRedisConfig()
  if (!cfg) return null
  try {
    const res = await fetch(`${cfg.url}/pipeline`, {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${cfg.token}`,
        'Content-Type': 'application/json',
      },
      body:   JSON.stringify(commands),
      signal: AbortSignal.timeout(300),
    })
    if (!res.ok) return null
    return await res.json() as Array<{ result: unknown }>
  } catch {
    return null
  }
}

// ─── Core rate limiter ────────────────────────────────────────────────────────

/**
 * Sliding-window rate limiter using a Redis sorted set.
 *
 * Algorithm:
 *  1. ZREMRANGEBYSCORE key -inf (now - windowMs)  — evict expired entries
 *  2. ZCARD key                                    — count active requests
 *  3a. If count < limit:
 *       ZADD key NX now now                        — register this request
 *       EXPIRE key ceil(windowMs/1000) + 1         — keep key alive
 *       return { allowed: true, remaining: limit - count - 1 }
 *  3b. If count >= limit:
 *       return { allowed: false, remaining: 0, reset_at: oldest_entry + windowMs }
 *
 * The member name equals the score (timestamp in ms as a string) so each
 * request is unique even when multiple arrive in the same millisecond by
 * appending a random suffix.
 *
 * Fail-open: any Redis failure returns { allowed: true }.
 *
 * @param key       Redis key, e.g. 'ratelimit:remediation:trigger:abcd1234'
 * @param limit     Maximum requests allowed in the window
 * @param windowMs  Window size in milliseconds
 */
export async function checkRateLimit(
  key:      string,
  limit:    number,
  windowMs: number,
): Promise<RateLimitResult> {
  const now         = Date.now()
  const windowStart = now - windowMs
  const ttlSeconds  = Math.ceil(windowMs / 1000) + 1

  // Unique member: timestamp + random suffix to handle concurrent requests
  const member = `${now}-${Math.random().toString(36).slice(2, 8)}`

  // Phase 1: evict + count (read state before deciding)
  const phase1 = await redisPipeline([
    ['ZREMRANGEBYSCORE', key, '-inf', windowStart],
    ['ZCARD', key],
  ])

  if (phase1 === null) {
    // Redis unavailable — fail-open
    return { allowed: true, remaining: limit, reset_at: 0 }
  }

  const countResult = phase1[1]
  const count = typeof countResult?.result === 'number' ? countResult.result : 0

  if (count >= limit) {
    // Over limit — find when the oldest entry will expire to compute reset_at
    // We fetch the lowest-score member (oldest request) via ZRANGE with REV=false
    const rangeResult = await redisPipeline([
      ['ZRANGE', key, '0', '0', 'WITHSCORES'],
    ])

    let resetAt = now + windowMs // default: full window from now
    if (rangeResult !== null) {
      const raw = rangeResult[0]?.result
      // ZRANGE WITHSCORES returns [member, score, member, score, ...]
      if (Array.isArray(raw) && raw.length >= 2) {
        const oldestScore = parseFloat(String(raw[1]))
        if (!isNaN(oldestScore)) {
          resetAt = Math.round(oldestScore + windowMs)
        }
      }
    }

    return { allowed: false, remaining: 0, reset_at: resetAt }
  }

  // Under limit — register this request
  const phase2 = await redisPipeline([
    ['ZADD', key, 'NX', now, member],
    ['EXPIRE', key, ttlSeconds],
  ])

  if (phase2 === null) {
    // Fail-open: could not register, but allow the request
    return { allowed: true, remaining: Math.max(0, limit - count - 1), reset_at: 0 }
  }

  return {
    allowed:   true,
    remaining: Math.max(0, limit - count - 1),
    reset_at:  now + windowMs,
  }
}
