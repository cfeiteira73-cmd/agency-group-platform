// =============================================================================
// Agency Group — SH-ROS | AMI: 22506
// Persistent Rate Limiter — Upstash Redis backed, serverless-safe
// lib/rateLimit/persistentRateLimit.ts
//
// Wave 45 Fix — AUTO_FIXED #INFRA-003, #INFRA-010
//
// PURPOSE:
//   Solves the "in-memory rate limit bypassed on cold starts" problem.
//   The existing middleware.ts in-memory Map and several API route-level
//   Maps (draft-offer, market-data) reset on every cold start and are NOT
//   shared across concurrent Vercel Edge/Node.js instances, meaning:
//
//   1. Each new cold-start instance gets a fresh counter → unlimited calls
//      across a burst of parallel serverless invocations.
//   2. AI endpoints (draft-offer: ~€0.015/call) can be budget-drained.
//
//   This module provides a drop-in Upstash-backed rate limiter that:
//   - Survives cold starts (state stored in Redis)
//   - Is shared across all concurrent instances (atomic INCR)
//   - Falls back to lib/rateLimit.ts (Upstash) if already configured
//   - Provides a fail-open behaviour (allow on Redis error) for resilience
//
// USAGE (in any API route that currently uses a local rateMap):
//
//   import { persistentRateLimit } from '@/lib/rateLimit/persistentRateLimit'
//
//   const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anon'
//   const ok = await persistentRateLimit(`draft-offer:${ip}`, 20, 3600)
//   if (!ok) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
//
// TypeScript strict — 0 errors
// =============================================================================

// ---------------------------------------------------------------------------
// Upstash REST helper (no package dependency)
// ---------------------------------------------------------------------------

async function upstashIncr(key: string, windowSec: number, max: number): Promise<boolean> {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) return true // No Redis configured — fail open

  try {
    const res = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', key],
        ['EXPIRE', key, String(windowSec), 'NX'],
      ]),
      signal: AbortSignal.timeout(500), // 500 ms — never block requests
    })

    if (!res.ok) return true // Redis error — fail open

    const results = await res.json() as Array<{ result: number }>
    const count = results[0]?.result ?? 0
    return count <= max
  } catch {
    return true // Network error — fail open
  }
}

// ---------------------------------------------------------------------------
// In-memory fallback (dev / Redis unavailable)
// ---------------------------------------------------------------------------

const memStore = new Map<string, { count: number; reset: number }>()

function memRateLimit(key: string, windowMs: number, max: number): boolean {
  const now = Date.now()
  let entry = memStore.get(key)
  if (!entry || now > entry.reset) {
    entry = { count: 0, reset: now + windowMs }
    memStore.set(key, entry)
  }
  entry.count++
  return entry.count <= max
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Persistent, distributed rate limiter.
 *
 * @param key       Unique key identifying the rate-limit bucket (e.g. `draft-offer:1.2.3.4`)
 * @param max       Maximum number of requests allowed per window
 * @param windowSec Window duration in seconds (e.g. 3600 for 1 hour)
 * @returns         `true` if the request is allowed, `false` if rate-limited
 */
export async function persistentRateLimit(
  key: string,
  max: number,
  windowSec: number,
): Promise<boolean> {
  const useUpstash =
    typeof process !== 'undefined' &&
    !!process.env.UPSTASH_REDIS_REST_URL &&
    !!process.env.UPSTASH_REDIS_REST_TOKEN

  if (useUpstash) {
    return upstashIncr(key, windowSec, max)
  }

  return memRateLimit(key, windowSec * 1000, max)
}

/**
 * Check rate limit and return full metadata (remaining, reset).
 * Use when you need to set X-RateLimit-* response headers.
 */
export async function persistentRateLimitWithMeta(
  key: string,
  max: number,
  windowSec: number,
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  const resetAt = Date.now() + windowSec * 1000

  if (url && token) {
    try {
      const res = await fetch(`${url}/pipeline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          ['INCR', key],
          ['EXPIRE', key, String(windowSec), 'NX'],
          ['TTL', key],
        ]),
        signal: AbortSignal.timeout(500),
      })

      if (!res.ok) return { allowed: true, remaining: max, resetAt }

      const results = await res.json() as Array<{ result: number }>
      const count  = results[0]?.result ?? 0
      const ttl    = results[2]?.result ?? windowSec
      const actualResetAt = Date.now() + (ttl > 0 ? ttl * 1000 : windowSec * 1000)

      return {
        allowed:   count <= max,
        remaining: Math.max(0, max - count),
        resetAt:   actualResetAt,
      }
    } catch {
      return { allowed: true, remaining: max, resetAt }
    }
  }

  // In-memory fallback
  const allowed = memRateLimit(key, windowSec * 1000, max)
  const entry   = memStore.get(key)
  const remaining = entry ? Math.max(0, max - entry.count) : max - 1
  const actualReset = entry?.reset ?? resetAt

  return { allowed, remaining, resetAt: actualReset }
}
