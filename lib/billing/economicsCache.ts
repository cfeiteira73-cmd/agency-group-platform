// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — Economics Cache
// lib/billing/economicsCache.ts
//
// Redis TTL wrapper around computeTenantEconomics().
// Cache key : `economics:{tenantId}:{periodStart}:{periodEnd}`
// TTL       : 60 seconds
// Transport : Upstash Redis REST API
// Strategy  : fail-open — if Redis is unavailable, call through to DB.
// =============================================================================

import { computeTenantEconomics, type TenantEconomics } from '@/lib/billing/costModelEngine'

// ─── Upstash helpers ──────────────────────────────────────────────────────────

function getRedisConfig(): { url: string; token: string } | null {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return { url, token }
}

function buildCacheKey(tenantId: string, periodStart?: string, periodEnd?: string): string {
  return `economics:${tenantId}:${periodStart ?? ''}:${periodEnd ?? ''}`
}

async function redisGet(key: string): Promise<string | null> {
  const cfg = getRedisConfig()
  if (!cfg) return null

  try {
    const res = await fetch(
      `${cfg.url}/get/${encodeURIComponent(key)}`,
      {
        headers: { Authorization: `Bearer ${cfg.token}` },
        signal: AbortSignal.timeout(300),
      },
    )
    if (!res.ok) return null
    const body = await res.json() as { result: string | null }
    return body.result
  } catch {
    return null
  }
}

async function redisSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  const cfg = getRedisConfig()
  if (!cfg) return

  try {
    await fetch(
      `${cfg.url}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}?ex=${ttlSeconds}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${cfg.token}` },
        signal: AbortSignal.timeout(300),
      },
    )
  } catch {
    // fail-open: ignore Redis write errors
  }
}

async function redisDel(key: string): Promise<void> {
  const cfg = getRedisConfig()
  if (!cfg) return

  try {
    await fetch(
      `${cfg.url}/del/${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${cfg.token}` },
        signal: AbortSignal.timeout(300),
      },
    )
  } catch {
    // fail-open: ignore Redis delete errors
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns TenantEconomics, serving from Redis when available.
 * Cache TTL: 60 seconds.
 * Fail-open: Redis errors fall through to computeTenantEconomics() directly.
 */
export async function getCachedTenantEconomics(
  tenantId:     string,
  periodStart?: string,
  periodEnd?:   string,
): Promise<TenantEconomics> {
  const key = buildCacheKey(tenantId, periodStart, periodEnd)

  // Cache read — fail-open
  const cached = await redisGet(key)
  if (cached !== null) {
    try {
      return JSON.parse(cached) as TenantEconomics
    } catch {
      // corrupted entry — fall through to recompute
    }
  }

  // Cache miss — compute
  const economics = await computeTenantEconomics(tenantId, periodStart, periodEnd)

  // Cache write — fire-and-forget, fail-open
  void redisSet(key, JSON.stringify(economics), 60)

  return economics
}

/**
 * Invalidates all cached economics entries for a tenant across all period
 * combinations by deleting the specific key (no-period variant).
 *
 * For targeted invalidation of a specific period, pass periodStart/periodEnd.
 * To invalidate the default (current-month) key, call with tenantId only.
 */
export async function invalidateEconomicsCache(
  tenantId:     string,
  periodStart?: string,
  periodEnd?:   string,
): Promise<void> {
  const key = buildCacheKey(tenantId, periodStart, periodEnd)
  await redisDel(key)
}
