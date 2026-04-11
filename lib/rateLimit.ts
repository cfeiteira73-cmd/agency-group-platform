// Rate limiter — Upstash Redis (distributed) when configured, in-memory fallback for dev.
//
// PRODUCTION (Vercel):
//   Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel env vars.
//   Upstash uses atomic INCR + EXPIRE via REST API — no package needed.
//
// DEVELOPMENT / fallback:
//   If Upstash env vars are absent, falls back to in-memory Map.
//   Memory limiter resets on process restart — sufficient for local dev.

export interface RateLimitResult {
  success: boolean
  remaining: number
  reset: number // Unix timestamp (ms) when the window resets
}

interface RateLimiterOptions {
  maxAttempts: number
  windowMs: number
}

// ─── Upstash REST helper ──────────────────────────────────────────────────────

async function upstashCmd(commands: Array<[string, ...string[]]>): Promise<Array<unknown>> {
  const url   = process.env.UPSTASH_REDIS_REST_URL!
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!
  const res = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  })
  if (!res.ok) throw new Error(`Upstash pipeline failed: ${res.status}`)
  const json = await res.json() as Array<{ result: unknown }>
  return json.map(r => r.result)
}

async function upstashRateLimit(
  key: string,
  opts: RateLimiterOptions,
): Promise<RateLimitResult> {
  const windowSec = Math.ceil(opts.windowMs / 1000)
  const resetMs   = Date.now() + opts.windowMs

  try {
    // Pipeline: INCR key → EXPIRE key windowSec (sets TTL only on first call)
    const results = await upstashCmd([
      ['INCR', key],
      ['EXPIRE', key, String(windowSec), 'NX'], // NX = only set if not already set
    ])

    const count = results[0] as number

    if (count > opts.maxAttempts) {
      // Fetch actual TTL for precise reset time
      const ttlResults = await upstashCmd([['TTL', key]])
      const ttlSec = (ttlResults[0] as number) ?? windowSec
      return { success: false, remaining: 0, reset: Date.now() + ttlSec * 1000 }
    }

    return {
      success: true,
      remaining: Math.max(0, opts.maxAttempts - count),
      reset: resetMs,
    }
  } catch (err) {
    // If Upstash is unreachable, fail open (allow request) to avoid blocking users
    console.warn('[rateLimit] Upstash error — failing open:', err instanceof Error ? err.message : String(err))
    return { success: true, remaining: opts.maxAttempts - 1, reset: resetMs }
  }
}

// ─── In-memory fallback ───────────────────────────────────────────────────────

interface RateLimitEntry {
  attempts: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

function pruneExpired(): void {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key)
  }
}

function memoryRateLimit(ip: string, opts: RateLimiterOptions): RateLimitResult {
  pruneExpired()
  const now = Date.now()
  const { maxAttempts, windowMs } = opts
  const existing = store.get(ip)

  if (!existing || now > existing.resetAt) {
    const resetAt = now + windowMs
    store.set(ip, { attempts: 1, resetAt })
    return { success: true, remaining: maxAttempts - 1, reset: resetAt }
  }

  if (existing.attempts >= maxAttempts) {
    return { success: false, remaining: 0, reset: existing.resetAt }
  }

  existing.attempts += 1
  return { success: true, remaining: maxAttempts - existing.attempts, reset: existing.resetAt }
}

// ─── Public API ───────────────────────────────────────────────────────────────

const UPSTASH_CONFIGURED =
  typeof process !== 'undefined' &&
  !!process.env.UPSTASH_REDIS_REST_URL &&
  !!process.env.UPSTASH_REDIS_REST_TOKEN

/**
 * Rate-limit `ip` within the given window.
 * Automatically uses Upstash (distributed) when configured, in-memory otherwise.
 */
export async function rateLimit(ip: string, opts: RateLimiterOptions): Promise<RateLimitResult> {
  if (UPSTASH_CONFIGURED) {
    return upstashRateLimit(`rl:${ip}`, opts)
  }
  return memoryRateLimit(ip, opts)
}

export function getRetryAfterMinutes(reset: number): number {
  return Math.ceil((reset - Date.now()) / 60_000)
}
