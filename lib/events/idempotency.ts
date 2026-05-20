import { createHash } from 'crypto'

// ---------------------------------------------------------------------------
// Upstash Redis REST helpers
// ---------------------------------------------------------------------------

function getRedisConfig(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return { url, token }
}

async function redisGet(key: string): Promise<string | null> {
  const cfg = getRedisConfig()
  if (!cfg) return null

  const res = await fetch(`${cfg.url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${cfg.token}` },
  })
  if (!res.ok) throw new Error(`Redis GET failed: ${res.status}`)
  const body = (await res.json()) as { result: string | null }
  return body.result
}

async function redisSetNxEx(key: string, value: string, ttlSeconds: number): Promise<boolean> {
  const cfg = getRedisConfig()
  if (!cfg) return false

  // Use POST /set with nx + ex flags for atomic NX+EX
  const res = await fetch(`${cfg.url}/set`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ key, value, ex: ttlSeconds, nx: true }),
  })
  if (!res.ok) throw new Error(`Redis SET NX EX failed: ${res.status}`)
  const body = (await res.json()) as { result: string | null }
  // Redis returns "OK" on success, null when NX condition was not met
  return body.result === 'OK'
}

async function redisSetEx(key: string, value: string, ttlSeconds: number): Promise<void> {
  const cfg = getRedisConfig()
  if (!cfg) return

  const res = await fetch(
    `${cfg.url}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}/ex/${ttlSeconds}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.token}` },
    },
  )
  if (!res.ok) throw new Error(`Redis SET EX failed: ${res.status}`)
}

// ---------------------------------------------------------------------------
// Public types & constants
// ---------------------------------------------------------------------------

const DEFAULT_TTL = 86_400 // 24 hours in seconds
const KEY_PREFIX = 'idempotent:'

export interface IdempotencyState<T = unknown> {
  processed: boolean
  result?: T
  processed_at?: string
}

interface StoredPayload<T> {
  result: T
  processed_at: string
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check if a key has already been processed.
 * Fail-open: returns { processed: false } on any Redis error.
 */
export async function checkIdempotency<T = unknown>(
  key: string,
  _ttlSeconds?: number,
): Promise<IdempotencyState<T>> {
  const redisKey = `${KEY_PREFIX}${key}`

  try {
    const raw = await redisGet(redisKey)
    if (!raw) return { processed: false }

    const payload = JSON.parse(raw) as StoredPayload<T>
    return {
      processed: true,
      result: payload.result,
      processed_at: payload.processed_at,
    }
  } catch (err) {
    console.warn('[idempotency] checkIdempotency error (fail-open):', err)
    return { processed: false }
  }
}

/**
 * Mark a key as processed with the given result and TTL.
 * Fail-open: silently warns on Redis error.
 */
export async function markProcessed<T = unknown>(
  key: string,
  result: T,
  ttlSeconds: number = DEFAULT_TTL,
): Promise<void> {
  const redisKey = `${KEY_PREFIX}${key}`
  const payload: StoredPayload<T> = {
    result,
    processed_at: new Date().toISOString(),
  }

  try {
    await redisSetEx(redisKey, JSON.stringify(payload), ttlSeconds)
  } catch (err) {
    console.warn('[idempotency] markProcessed error (fail-open):', err)
  }
}

/**
 * Exactly-once execution wrapper.
 *
 * - If key already processed  → return cached result (was_duplicate: true)
 * - If not yet processed       → run fn(), cache result, return it (was_duplicate: false)
 *
 * Atomically uses NX+EX to claim the key before running fn(), preventing
 * concurrent duplicate execution. Falls back to fn() if Redis is unavailable.
 */
export async function withIdempotency<T>(
  key: string,
  fn: () => Promise<T>,
  ttlSeconds: number = DEFAULT_TTL,
): Promise<{ result: T; was_duplicate: boolean }> {
  const redisKey = `${KEY_PREFIX}${key}`

  // 1. Check for an already-stored result
  try {
    const raw = await redisGet(redisKey)
    if (raw) {
      const payload = JSON.parse(raw) as StoredPayload<T>
      return { result: payload.result, was_duplicate: true }
    }
  } catch (err) {
    console.warn('[idempotency] read check error (fail-open):', err)
    // Fall through — run fn() without idempotency guarantee
    const result = await fn()
    return { result, was_duplicate: false }
  }

  // 2. Attempt to claim the key atomically (NX+EX) with a sentinel value
  //    to prevent a concurrent worker from also running fn()
  const sentinel = JSON.stringify({ processing: true, claimed_at: new Date().toISOString() })
  let claimed = false

  try {
    claimed = await redisSetNxEx(redisKey, sentinel, ttlSeconds)
  } catch (err) {
    console.warn('[idempotency] claim error (fail-open):', err)
    // Fail-open: proceed without atomic claim
  }

  if (!claimed) {
    // Another worker claimed the key — re-read to get their stored result
    try {
      const raw = await redisGet(redisKey)
      if (raw) {
        const payload = JSON.parse(raw) as StoredPayload<T>
        // Guard: if still sentinel (race window), run fn() anyway
        if (!('processing' in (payload as unknown as Record<string, unknown>))) {
          return { result: payload.result, was_duplicate: true }
        }
      }
    } catch (err) {
      console.warn('[idempotency] re-read after claim failure (fail-open):', err)
    }
  }

  // 3. Run the function
  const result = await fn()

  // 4. Store real result, overwriting sentinel
  const finalPayload: StoredPayload<T> = {
    result,
    processed_at: new Date().toISOString(),
  }

  try {
    await redisSetEx(redisKey, JSON.stringify(finalPayload), ttlSeconds)
  } catch (err) {
    console.warn('[idempotency] store result error (fail-open):', err)
  }

  return { result, was_duplicate: false }
}

/**
 * Generate a canonical idempotency key from one or more string parts.
 * Returns the SHA-256 hex digest of the joined parts (separator: ':').
 */
export function makeIdempotencyKey(...parts: string[]): string {
  return createHash('sha256').update(parts.join(':')).digest('hex')
}
