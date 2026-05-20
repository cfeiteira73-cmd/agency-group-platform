// =============================================================================
// Agency Group — Redis-Backed Adjacency Cache
// lib/graph/adjacencyCache.ts
//
// Hot-path cache for graph traversal results using Upstash Redis REST API.
// Cache key: `graph:adj:{tenant_id}:{query_type}:{hash_of_params}`
// TTL: 30 seconds for hot paths, 5 minutes (300s) for cold paths
// Fail-open: cache miss → execute real query
//
// TypeScript strict — 0 errors
// =============================================================================

import { createHash } from 'crypto'
import type { FormalGraphResult } from './graphQueryInterface'

// ─── Redis REST helpers ───────────────────────────────────────────────────────

const KEY_PREFIX = 'graph:adj:'

function getRedisConfig(): { url: string; token: string } | null {
  const url   = process.env.UPSTASH_REDIS_REST_URL
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

// ─── TTL constants ────────────────────────────────────────────────────────────

export const HOT_TTL_SECONDS  = 30
export const COLD_TTL_SECONDS = 300

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Build a canonical cache key from tenant, query type, and params.
 * Returns `{tenantId}:{queryType}:{first-16-chars-of-SHA256(JSON(params))}`.
 */
export function buildGraphCacheKey(
  tenantId: string,
  queryType: string,
  params: Record<string, unknown>,
): string {
  const hash = createHash('sha256')
    .update(JSON.stringify(params))
    .digest('hex')
    .slice(0, 16)
  return `${tenantId}:${queryType}:${hash}`
}

/**
 * GET a cached FormalGraphResult.
 * Returns null on cache miss, parse failure, or any Redis error (fail-open).
 */
export async function getCachedGraphResult(
  cacheKey: string,
): Promise<FormalGraphResult | null> {
  const redisKey = `${KEY_PREFIX}${cacheKey}`

  try {
    const raw = await redisGet(redisKey)
    if (!raw) return null
    return JSON.parse(raw) as FormalGraphResult
  } catch (err) {
    console.warn('[adjacencyCache] getCachedGraphResult error (fail-open):', err)
    return null
  }
}

/**
 * SET a FormalGraphResult in cache with the given TTL (default: HOT_TTL_SECONDS).
 * Never throws — all errors are swallowed (fail-open).
 */
export async function setCachedGraphResult(
  cacheKey: string,
  result: FormalGraphResult,
  ttlSeconds: number = HOT_TTL_SECONDS,
): Promise<void> {
  const redisKey = `${KEY_PREFIX}${cacheKey}`

  try {
    await redisSetEx(redisKey, JSON.stringify(result), ttlSeconds)
  } catch (err) {
    console.warn('[adjacencyCache] setCachedGraphResult error (fail-open):', err)
  }
}

/**
 * Cache-aside wrapper for graph queries.
 *
 * 1. Check cache → if hit, return immediately with latency_ms set to 0
 *    (signals a cache hit to the caller; perf_class will be 'hot').
 * 2. On miss: execute fn(), cache the result, return it.
 * 3. On any cache error: fall through to fn() transparently (fail-open).
 *
 * TTL defaults to HOT_TTL_SECONDS (30s). Pass COLD_TTL_SECONDS (300s)
 * for infrequently-accessed query types.
 */
export async function withGraphCache<T extends { latency_ms: number }>(
  cacheKey: string,
  fn: () => Promise<T>,
  ttlSeconds: number = HOT_TTL_SECONDS,
): Promise<T> {
  // 1. Try cache
  try {
    const cached = await getCachedGraphResult(cacheKey)
    if (cached !== null) {
      // Signal cache hit by zeroing latency; caller can inspect perf_class
      return { ...(cached as unknown as T), latency_ms: 0 }
    }
  } catch (err) {
    // Defensive: getCachedGraphResult already swallows, but guard here too
    console.warn('[adjacencyCache] withGraphCache read error (fail-open):', err)
  }

  // 2. Cache miss — execute the real query
  const result = await fn()

  // 3. Store result (fire-and-forget, fail-open)
  try {
    await setCachedGraphResult(cacheKey, result as unknown as FormalGraphResult, ttlSeconds)
  } catch (err) {
    console.warn('[adjacencyCache] withGraphCache write error (fail-open):', err)
  }

  return result
}
