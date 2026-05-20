// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — System Load Governor
// lib/runtime/loadGovernor.ts
//
// 4-mode degradation for global-scale resilience.
// Mode is stored in Redis per-region (key: `load_mode:{region}`) and checked
// on every critical path.  Fail-open: Redis unavailable → NORMAL assumed.
//
// Process-level 5-second TTL cache avoids hammering Redis on every request.
// Each Next.js serverless instance owns its own memory, so this is safe.
// =============================================================================

import { CURRENT_REGION } from '@/lib/events/globalOrdering'

// ─── Public types ─────────────────────────────────────────────────────────────

export type LoadMode = 'NORMAL' | 'STRESSED' | 'CRITICAL' | 'EMERGENCY'

export interface LoadModeConfig {
  mode:                 LoadMode
  ai_calls_enabled:     boolean   // NORMAL+STRESSED=true, CRITICAL+EMERGENCY=false
  db_writes_enabled:    boolean   // NORMAL+STRESSED+CRITICAL=true, EMERGENCY=false
  cache_first:          boolean   // STRESSED+CRITICAL+EMERGENCY=true
  max_concurrent_ai:    number    // NORMAL=10, STRESSED=5, CRITICAL=2, EMERGENCY=0
  max_requests_per_min: number    // per tenant: NORMAL=1000, STRESSED=500, CRITICAL=100, EMERGENCY=10
  description:          string
}

export interface LoadStatus {
  mode:   LoadMode
  region: string
  set_at: string        // ISO
  set_by: string        // 'auto' | 'manual' | 'recovery'
  config: LoadModeConfig
}

export interface TenantAllowance {
  tenant_id:    string
  allowed:      boolean
  mode:         LoadMode
  reason?:      string  // why denied when allowed=false
  retry_after?: number  // seconds, present when rate_limited
}

// ─── Mode configuration table ─────────────────────────────────────────────────

const LOAD_MODE_CONFIGS: Record<LoadMode, Omit<LoadModeConfig, 'mode'>> = {
  NORMAL: {
    ai_calls_enabled:     true,
    db_writes_enabled:    true,
    cache_first:          false,
    max_concurrent_ai:    10,
    max_requests_per_min: 1000,
    description:          'Full system — all features active',
  },
  STRESSED: {
    ai_calls_enabled:     true,
    db_writes_enabled:    true,
    cache_first:          true,
    max_concurrent_ai:    5,
    max_requests_per_min: 500,
    description:          'Cache-heavy — AI rate limited',
  },
  CRITICAL: {
    ai_calls_enabled:     false,
    db_writes_enabled:    true,
    cache_first:          true,
    max_concurrent_ai:    2,
    max_requests_per_min: 100,
    description:          'Read-only AI — writes preserved',
  },
  EMERGENCY: {
    ai_calls_enabled:     false,
    db_writes_enabled:    false,
    cache_first:          true,
    max_concurrent_ai:    0,
    max_requests_per_min: 10,
    description:          'Static fallback — DB writes suspended',
  },
}

function getModeConfig(mode: LoadMode): LoadModeConfig {
  return { mode, ...LOAD_MODE_CONFIGS[mode] }
}

// ─── Redis helpers (Upstash REST, identical pattern to economicsCache.ts) ─────

interface RedisConfig { url: string; token: string }

function getRedisConfig(): RedisConfig | null {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return { url, token }
}

async function redisGet(key: string): Promise<string | null> {
  const cfg = getRedisConfig()
  if (!cfg) return null
  try {
    const res = await fetch(
      `${cfg.url}/get/${encodeURIComponent(key)}`,
      {
        headers: { Authorization: `Bearer ${cfg.token}` },
        signal:  AbortSignal.timeout(300),
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
        method:  'POST',
        headers: { Authorization: `Bearer ${cfg.token}` },
        signal:  AbortSignal.timeout(300),
      },
    )
  } catch {
    // fail-open: ignore Redis write errors
  }
}

/** INCR + EXPIRE atomically via Upstash pipeline */
async function redisIncrWithExpire(key: string, ttlSeconds: number): Promise<number | null> {
  const cfg = getRedisConfig()
  if (!cfg) return null
  try {
    // Upstash pipeline: POST /pipeline with array of commands
    const res = await fetch(
      `${cfg.url}/pipeline`,
      {
        method:  'POST',
        headers: {
          Authorization:  `Bearer ${cfg.token}`,
          'Content-Type': 'application/json',
        },
        body:   JSON.stringify([
          ['INCR', key],
          ['EXPIRE', key, ttlSeconds],
        ]),
        signal: AbortSignal.timeout(300),
      },
    )
    if (!res.ok) return null
    // Response is an array: [{ result: <count> }, { result: 0|1 }]
    const body = await res.json() as [{ result: number }, { result: number }]
    return body[0]?.result ?? null
  } catch {
    return null
  }
}

/**
 * Generic Redis command via Upstash pipeline (single-command wrapper).
 * Returns the result of the first (and only) command, or null on failure.
 * Fail-open: catch → null.
 */
async function redisCommand(command: string, args: (string | number)[], signal?: AbortSignal): Promise<unknown> {
  const cfg = getRedisConfig()
  if (!cfg) return null
  try {
    const res = await fetch(
      `${cfg.url}/pipeline`,
      {
        method:  'POST',
        headers: {
          Authorization:  `Bearer ${cfg.token}`,
          'Content-Type': 'application/json',
        },
        body:   JSON.stringify([[command, ...args]]),
        signal: signal ?? AbortSignal.timeout(300),
      },
    )
    if (!res.ok) return null
    const body = await res.json() as [{ result: unknown }]
    return body[0]?.result ?? null
  } catch {
    return null
  }
}

// ─── Process-level 5-second TTL cache ─────────────────────────────────────────
// Acceptable in Next.js serverless: each instance owns its own memory.
// Keyed by tenantId so each tenant has an independent cache entry.

interface ModeCache {
  value:   LoadMode
  expires: number   // Date.now() + 5000
}

const _modeCache: Map<string, ModeCache> = new Map()
const MODE_CACHE_TTL_MS = 5_000

// ─── Redis persistence schema ─────────────────────────────────────────────────

interface StoredModeEntry {
  mode:   LoadMode
  set_at: string
  set_by: string
}

const VALID_MODES = new Set<LoadMode>(['NORMAL', 'STRESSED', 'CRITICAL', 'EMERGENCY'])

function isValidMode(v: unknown): v is LoadMode {
  return typeof v === 'string' && VALID_MODES.has(v as LoadMode)
}

function modeKey(region: string, tenantId: string): string {
  return `load_mode:${region}:${tenantId}`
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the current load mode for the given tenant in the region.
 * Checks a 5-second in-process cache (keyed by tenantId) before hitting Redis.
 * Fail-open: Redis unavailable → returns 'NORMAL'.
 */
export async function getLoadMode(tenantId: string, region?: string): Promise<LoadMode> {
  // In-process cache hit (per-tenant)
  const cached = _modeCache.get(tenantId)
  if (cached !== undefined && Date.now() < cached.expires) {
    return cached.value
  }

  const resolvedRegion = region ?? CURRENT_REGION
  const raw = await redisGet(modeKey(resolvedRegion, tenantId))

  let mode: LoadMode = 'NORMAL'
  if (raw !== null) {
    try {
      const parsed = JSON.parse(raw) as StoredModeEntry
      if (isValidMode(parsed.mode)) {
        mode = parsed.mode
      }
    } catch {
      // corrupted — default to NORMAL
    }
  }

  // Update in-process cache for this tenant
  _modeCache.set(tenantId, { value: mode, expires: Date.now() + MODE_CACHE_TTL_MS })
  return mode
}

/**
 * Persists the load mode to Redis for the given tenant in the region.
 * TTL: 1 hour — auto-expires so system recovers if governor is forgotten.
 * Also invalidates the in-process cache for this tenant immediately.
 */
export async function setLoadMode(tenantId: string, mode: LoadMode, setBy: string = 'manual'): Promise<void> {
  const entry: StoredModeEntry = {
    mode,
    set_at: new Date().toISOString(),
    set_by: setBy,
  }
  const key = modeKey(CURRENT_REGION, tenantId)
  await redisSet(key, JSON.stringify(entry), 3_600)

  // Bust in-process cache for this tenant so next call reflects the new mode
  _modeCache.delete(tenantId)
}

/**
 * Returns the full LoadStatus object including mode config for the given tenant.
 */
export async function getLoadStatus(tenantId: string, region?: string): Promise<LoadStatus> {
  const resolvedRegion = region ?? CURRENT_REGION
  const raw = await redisGet(modeKey(resolvedRegion, tenantId))

  let mode:   LoadMode = 'NORMAL'
  let set_at: string   = new Date().toISOString()
  let set_by: string   = 'auto'

  if (raw !== null) {
    try {
      const parsed = JSON.parse(raw) as StoredModeEntry
      if (isValidMode(parsed.mode)) {
        mode   = parsed.mode
        set_at = parsed.set_at ?? set_at
        set_by = parsed.set_by ?? set_by
      }
    } catch {
      // corrupted — use defaults
    }
  }

  return {
    mode,
    region:  resolvedRegion,
    set_at,
    set_by,
    config:  getModeConfig(mode),
  }
}

// ─── Load-mode hold (remediation coordination) ────────────────────────────────
// Holds prevent competing remediations from resetting the load mode while
// another remediation is still in progress for the same tenant.

/**
 * Adds remediationId to the per-tenant hold set.
 * While the set is non-empty, automated routines must not lower the load mode.
 * A 1-hour TTL is set on the hold key so a crashed process cannot lock a tenant forever.
 */
export async function acquireLoadModeHold(tenantId: string, remediationId: string): Promise<void> {
  const holdKey = `load_mode_hold:${tenantId}`
  await redisCommand('SADD', [holdKey, remediationId], AbortSignal.timeout(300))
  // Best-effort: ensure the set expires in 1 hour max if the process crashes
  try {
    await redisCommand('EXPIRE', [holdKey, 3600], AbortSignal.timeout(300))
  } catch {
    // fail-open: TTL is safety-net only; SADD already succeeded
  }
}

/**
 * Removes remediationId from the per-tenant hold set.
 * Once the set is empty, DELs the key explicitly rather than waiting for expiry.
 */
export async function releaseLoadModeHold(tenantId: string, remediationId: string): Promise<void> {
  const holdKey = `load_mode_hold:${tenantId}`
  await redisCommand('SREM', [holdKey, remediationId], AbortSignal.timeout(300))
  // If the set is now empty, delete the key so it doesn't linger until TTL
  try {
    const remaining = await redisCommand('SCARD', [holdKey], AbortSignal.timeout(300))
    if (typeof remaining === 'number' && remaining === 0) {
      await redisCommand('DEL', [holdKey], AbortSignal.timeout(300))
    }
  } catch {
    // fail-open: DEL is a best-effort cleanup; the 1-hour TTL is the safety net
  }
}

/**
 * Returns true when at least one hold is active for the tenant.
 * Fail-open: Redis unavailable → returns false (allow mode changes).
 */
export async function hasLoadModeHold(tenantId: string): Promise<boolean> {
  try {
    const count = await redisCommand('SCARD', [`load_mode_hold:${tenantId}`], AbortSignal.timeout(300))
    return typeof count === 'number' && count > 0
  } catch {
    return false
  }
}

/**
 * Checks whether a tenant is allowed to proceed under the current load mode.
 * Enforces per-tenant per-minute rate limits using a Redis INCR bucket.
 * Fail-open: Redis unavailable → allows the request through.
 */
export async function checkTenantAllowance(
  tenantId: string,
  region?:  string,
): Promise<TenantAllowance> {
  const mode   = await getLoadMode(tenantId, region)
  const config = getModeConfig(mode)

  // EMERGENCY mode blocks all tenants unconditionally
  if (mode === 'EMERGENCY') {
    return { tenant_id: tenantId, allowed: false, mode, reason: 'emergency_mode' }
  }

  // Per-tenant per-minute rate limiting
  // Bucket key rolls over every 60-second wall-clock minute
  const minuteWindow  = Math.floor(Date.now() / 60_000)
  const rateLimitKey  = `ratelimit:${tenantId}:${minuteWindow}`
  const count         = await redisIncrWithExpire(rateLimitKey, 60)

  // fail-open: if Redis unavailable (count === null), allow through
  if (count !== null && count > config.max_requests_per_min) {
    return {
      tenant_id:   tenantId,
      allowed:     false,
      mode,
      reason:      'rate_limited',
      retry_after: 60,
    }
  }

  return { tenant_id: tenantId, allowed: true, mode }
}

// ─── withLoadGovernor ─────────────────────────────────────────────────────────

export interface LoadGovernorResult<T> {
  result?:  T
  blocked:  boolean
  mode:     LoadMode
  reason?:  string
}

/**
 * Wraps a function call with load governor checks.
 * - Checks tenant allowance (rate limit + emergency mode)
 * - If opts.requireAI and AI calls are disabled, blocks with reason
 * - Fail-open: if the governor check itself throws, fn() is executed anyway
 */
export async function withLoadGovernor<T>(
  tenantId: string,
  fn:       () => Promise<T>,
  opts?:    { requireAI?: boolean },
): Promise<LoadGovernorResult<T>> {
  let allowance: TenantAllowance
  let config:    LoadModeConfig

  try {
    allowance = await checkTenantAllowance(tenantId)
    config    = getModeConfig(allowance.mode)
  } catch {
    // Fail-open: governor is down — execute fn() unconditionally
    const result = await fn()
    return { result, blocked: false, mode: 'NORMAL', reason: 'governor_unavailable' }
  }

  // Blocked by mode or rate limit
  if (!allowance.allowed) {
    return {
      blocked: true,
      mode:    allowance.mode,
      reason:  allowance.reason,
    }
  }

  // AI gate
  if (opts?.requireAI && !config.ai_calls_enabled) {
    return {
      blocked: true,
      mode:    allowance.mode,
      reason:  'ai_disabled_in_mode',
    }
  }

  // Execute
  const result = await fn()
  return { result, blocked: false, mode: allowance.mode }
}
