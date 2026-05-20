// =============================================================================
// Agency Group — Incident Cache
// lib/resilience/incidentCache.ts
//
// Redis-backed incident snapshot cache.
// Provides degraded-mode operation when Supabase is unavailable.
// TTL: 5 minutes (300 s).
//
// All operations are fail-silent: errors are console.warn'd but never thrown.
// Follows the exact Upstash REST fetch pattern used in autonomousRemediator.ts.
//
// TypeScript strict — 0 errors
// =============================================================================

// ─── Redis helpers (Upstash REST — same pattern as autonomousRemediator.ts) ───

interface RedisConfig { url: string; token: string }

function getRedisConfig(): RedisConfig | null {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return { url, token }
}

async function redisSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  const cfg = getRedisConfig()
  if (!cfg) return
  try {
    await fetch(
      `${cfg.url}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}?ex=${ttlSeconds}`,
      {
        method:  'POST',
        headers: { Authorization: `Bearer ${cfg.token}` },
        signal:  AbortSignal.timeout(500),
      },
    )
  } catch {
    // fail-open: ignore Redis write errors
  }
}

async function redisGet(key: string): Promise<string | null> {
  const cfg = getRedisConfig()
  if (!cfg) return null
  try {
    const res = await fetch(
      `${cfg.url}/get/${encodeURIComponent(key)}`,
      {
        headers: { Authorization: `Bearer ${cfg.token}` },
        signal:  AbortSignal.timeout(500),
      },
    )
    if (!res.ok) return null
    const body = await res.json() as { result: string | null }
    return body.result
  } catch {
    return null
  }
}

async function redisDel(key: string): Promise<void> {
  const cfg = getRedisConfig()
  if (!cfg) return
  try {
    await fetch(
      `${cfg.url}/del/${encodeURIComponent(key)}`,
      {
        method:  'POST',
        headers: { Authorization: `Bearer ${cfg.token}` },
        signal:  AbortSignal.timeout(500),
      },
    )
  } catch {
    // fail-open: ignore Redis delete errors
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const INCIDENT_CACHE_TTL = 300 // 5 minutes

const CACHE_KEY      = (tenantId: string) => `incident_cache:${tenantId}:open`
const SNAPSHOT_KEY   = (tenantId: string) => `incident_snapshot:${tenantId}`

// ─── Incident snapshot type ───────────────────────────────────────────────────

export interface IncidentCacheSnapshot {
  open:          number
  critical:      number
  investigating: number
  last_updated:  string
}

// ─── Open incidents list ──────────────────────────────────────────────────────

/**
 * Stores the list of open incidents in Redis with a 300 s TTL.
 *
 * Key: `incident_cache:{tenantId}:open`
 *
 * Fail-silently: catches all errors and console.warn's them.
 */
export async function cacheOpenIncidents(
  tenantId:  string,
  incidents: unknown[],
): Promise<void> {
  try {
    const serialised = JSON.stringify(incidents)
    await redisSet(CACHE_KEY(tenantId), serialised, INCIDENT_CACHE_TTL)
  } catch (err) {
    console.warn(
      '[incidentCache] cacheOpenIncidents failed:',
      err instanceof Error ? err.message : err,
    )
  }
}

/**
 * Reads the open-incident list from Redis.
 *
 * Returns `null` when the key is missing or when JSON parsing fails.
 * Fail-open: catches all errors and returns `null`.
 */
export async function getCachedOpenIncidents(
  tenantId: string,
): Promise<unknown[] | null> {
  try {
    const raw = await redisGet(CACHE_KEY(tenantId))
    if (raw === null) return null
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return null
    return parsed
  } catch {
    return null
  }
}

/**
 * Deletes the open-incident list cache for a tenant.
 *
 * Key: `incident_cache:{tenantId}:open`
 *
 * Fail-silently: catches all errors without throwing.
 */
export async function invalidateIncidentCache(tenantId: string): Promise<void> {
  try {
    await redisDel(CACHE_KEY(tenantId))
  } catch (err) {
    console.warn(
      '[incidentCache] invalidateIncidentCache failed:',
      err instanceof Error ? err.message : err,
    )
  }
}

// ─── Incident snapshot ────────────────────────────────────────────────────────

/**
 * Stores a summary snapshot of incident counts in Redis with a 300 s TTL.
 *
 * Key: `incident_snapshot:{tenantId}`
 *
 * Fail-silently: catches all errors and console.warn's them.
 */
export async function cacheIncidentSnapshot(
  tenantId: string,
  snapshot: IncidentCacheSnapshot,
): Promise<void> {
  try {
    const serialised = JSON.stringify(snapshot)
    await redisSet(SNAPSHOT_KEY(tenantId), serialised, INCIDENT_CACHE_TTL)
  } catch (err) {
    console.warn(
      '[incidentCache] cacheIncidentSnapshot failed:',
      err instanceof Error ? err.message : err,
    )
  }
}

/**
 * Reads the incident snapshot from Redis.
 *
 * Returns `null` on cache miss or any parse/Redis error.
 * Fail-open: always returns `null` rather than throwing.
 */
export async function getCachedIncidentSnapshot(
  tenantId: string,
): Promise<IncidentCacheSnapshot | null> {
  try {
    const raw = await redisGet(SNAPSHOT_KEY(tenantId))
    if (raw === null) return null
    const parsed = JSON.parse(raw) as unknown
    if (
      typeof parsed !== 'object' || parsed === null ||
      typeof (parsed as Record<string, unknown>)['open']          !== 'number' ||
      typeof (parsed as Record<string, unknown>)['critical']      !== 'number' ||
      typeof (parsed as Record<string, unknown>)['investigating']  !== 'number' ||
      typeof (parsed as Record<string, unknown>)['last_updated']   !== 'string'
    ) {
      return null
    }
    return parsed as IncidentCacheSnapshot
  } catch {
    return null
  }
}
