// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — Global Latency Profiler
// lib/reality/globalLatencyProfiler.ts
//
// Real infrastructure latency profiler.
// Probes ACTUAL live endpoints and records real response times.
// No artificial delays. No mocked responses. Fail-open everywhere.
//
// Probes: Supabase query · Upstash Redis PING · Internal Next.js API routes
// Cache : Redis SET reality:latency_map:{region} ex=300 (5-min TTL)
// =============================================================================

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { CURRENT_REGION } from '@/lib/events/globalOrdering'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LatencyProbe {
  probe_id:   string
  target:     'supabase' | 'redis' | 'vercel_edge' | 'internal_api'
  endpoint:   string    // actual URL or human-readable description
  region:     string
  latency_ms: number
  success:    boolean
  error?:     string
  timestamp:  string
}

export interface GlobalLatencyTruthMap {
  region:      string
  measured_at: string
  probes:      LatencyProbe[]
  summary: {
    supabase_p50_ms: number
    supabase_p95_ms: number
    redis_p50_ms:    number
    redis_p95_ms:    number
    overall_health:  'healthy' | 'degraded' | 'critical'
    slowest_target:  string
  }
  infra_score: number   // 0–100: percentage of probes responding under 100 ms
}

// ─── Upstash helpers (mirroring economicsCache.ts pattern) ───────────────────

function getRedisConfig(): { url: string; token: string } | null {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return { url, token }
}

async function redisGet(key: string): Promise<string | null> {
  const cfg = getRedisConfig()
  if (!cfg) return null
  try {
    const res = await fetch(`${cfg.url}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${cfg.token}` },
      signal:  AbortSignal.timeout(500),
    })
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
        signal:  AbortSignal.timeout(500),
      },
    )
  } catch {
    // fail-open: ignore Redis write errors
  }
}

// ─── Percentile helper ────────────────────────────────────────────────────────

function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0
  const idx = Math.ceil((p / 100) * sortedValues.length) - 1
  return sortedValues[Math.max(0, idx)]
}

// ─── Supabase probes ──────────────────────────────────────────────────────────

/**
 * Runs `sampleCount` (default 5) timed lightweight Supabase queries.
 * Uses `audit_log` SELECT id LIMIT 1 — minimal I/O, always available.
 * Fail-open: returns an error probe if Supabase is unavailable.
 */
export async function probeSupabase(sampleCount = 5): Promise<LatencyProbe[]> {
  const probes: LatencyProbe[] = []

  for (let i = 0; i < sampleCount; i++) {
    const t0 = Date.now()
    try {
      const { error } = await supabaseAdmin
        .from('audit_log')
        .select('id')
        .limit(1)

      const latency_ms = Date.now() - t0

      probes.push({
        probe_id:   randomUUID(),
        target:     'supabase',
        endpoint:   `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'supabase'}/rest/v1/audit_log?select=id&limit=1`,
        region:     CURRENT_REGION,
        latency_ms,
        success:    !error,
        ...(error ? { error: error.message } : {}),
        timestamp:  new Date().toISOString(),
      })
    } catch (err) {
      probes.push({
        probe_id:   randomUUID(),
        target:     'supabase',
        endpoint:   `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'supabase'}/rest/v1/audit_log`,
        region:     CURRENT_REGION,
        latency_ms: Date.now() - t0,
        success:    false,
        error:      err instanceof Error ? err.message : String(err),
        timestamp:  new Date().toISOString(),
      })
    }
  }

  return probes
}

// ─── Redis probes ─────────────────────────────────────────────────────────────

/**
 * Runs `sampleCount` (default 5) timed Redis PING calls via Upstash REST.
 * Expected response: `{ result: "PONG" }`.
 * Fail-open: returns error probes if Redis is unavailable or unconfigured.
 */
export async function probeRedis(sampleCount = 5): Promise<LatencyProbe[]> {
  const cfg = getRedisConfig()
  const probes: LatencyProbe[] = []

  if (!cfg) {
    // Redis not configured — return a single informational error probe
    return [{
      probe_id:   randomUUID(),
      target:     'redis',
      endpoint:   'upstash-redis-rest (not configured)',
      region:     CURRENT_REGION,
      latency_ms: 0,
      success:    false,
      error:      'UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not set',
      timestamp:  new Date().toISOString(),
    }]
  }

  const pingUrl = `${cfg.url}/ping`

  for (let i = 0; i < sampleCount; i++) {
    const t0 = Date.now()
    try {
      const res = await fetch(pingUrl, {
        headers: { Authorization: `Bearer ${cfg.token}` },
        signal:  AbortSignal.timeout(3000),
      })
      const latency_ms = Date.now() - t0

      if (!res.ok) {
        probes.push({
          probe_id:   randomUUID(),
          target:     'redis',
          endpoint:   pingUrl,
          region:     CURRENT_REGION,
          latency_ms,
          success:    false,
          error:      `HTTP ${res.status}`,
          timestamp:  new Date().toISOString(),
        })
        continue
      }

      const body = await res.json() as { result?: string }
      const pong = body.result === 'PONG'

      probes.push({
        probe_id:   randomUUID(),
        target:     'redis',
        endpoint:   pingUrl,
        region:     CURRENT_REGION,
        latency_ms,
        success:    pong,
        ...(pong ? {} : { error: `Expected PONG, got: ${body.result ?? 'null'}` }),
        timestamp:  new Date().toISOString(),
      })
    } catch (err) {
      probes.push({
        probe_id:   randomUUID(),
        target:     'redis',
        endpoint:   pingUrl,
        region:     CURRENT_REGION,
        latency_ms: Date.now() - t0,
        success:    false,
        error:      err instanceof Error ? err.message : String(err),
        timestamp:  new Date().toISOString(),
      })
    }
  }

  return probes
}

// ─── Internal API probes ──────────────────────────────────────────────────────

/**
 * Probes internal Next.js API routes.
 * Only runs in server context (no `window`). Skipped if NEXT_PUBLIC_APP_URL is unset.
 * Uses AbortSignal.timeout(3000) on each fetch.
 * Fail-open: returns skip probe if app URL is not configured.
 */
export async function probeInternalAPI(
  routes:      string[] = ['/api/health', '/api/schema/drift-report'],
  sampleCount  = 3,
): Promise<LatencyProbe[]> {
  // Server-context guard
  if (typeof window !== 'undefined') return []

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) {
    return [{
      probe_id:   randomUUID(),
      target:     'internal_api',
      endpoint:   'internal (not configured)',
      region:     CURRENT_REGION,
      latency_ms: 0,
      success:    false,
      error:      'NEXT_PUBLIC_APP_URL not set — internal API probes skipped',
      timestamp:  new Date().toISOString(),
    }]
  }

  const probes: LatencyProbe[] = []

  for (const route of routes) {
    for (let i = 0; i < sampleCount; i++) {
      const url = `${appUrl}${route}`
      const t0  = Date.now()
      try {
        const res = await fetch(url, {
          // HEAD avoids body parsing — pure latency measurement
          method: 'HEAD',
          signal: AbortSignal.timeout(3000),
        })
        const latency_ms = Date.now() - t0

        probes.push({
          probe_id:   randomUUID(),
          target:     'internal_api',
          endpoint:   url,
          region:     CURRENT_REGION,
          latency_ms,
          success:    res.ok,
          ...(res.ok ? {} : { error: `HTTP ${res.status}` }),
          timestamp:  new Date().toISOString(),
        })
      } catch (err) {
        probes.push({
          probe_id:   randomUUID(),
          target:     'internal_api',
          endpoint:   url,
          region:     CURRENT_REGION,
          latency_ms: Date.now() - t0,
          success:    false,
          error:      err instanceof Error ? err.message : String(err),
          timestamp:  new Date().toISOString(),
        })
      }
    }
  }

  return probes
}

// ─── Cross-region latency estimates ──────────────────────────────────────────

/**
 * Returns honest static estimates of cross-region latency based on known
 * CDN/fiber topology. These are NOT measurements — they are labeled clearly
 * with basis='static_estimate' so callers know they are approximations.
 *
 * We cannot directly probe foreign regions from a single serverless function.
 */
export function estimateCrossRegionLatency(): Record<string, { estimated_ms: number; basis: string }> {
  return {
    'eu-west→us-east':     { estimated_ms: 85,  basis: 'static_estimate: Atlantic fiber typical RTT' },
    'eu-west→ap-southeast':{ estimated_ms: 180, basis: 'static_estimate: Europe-Asia typical RTT' },
    'us-east→ap-southeast':{ estimated_ms: 150, basis: 'static_estimate: Pacific fiber typical RTT' },
    'eu-west→eu-north':    { estimated_ms: 25,  basis: 'static_estimate: Intra-Europe typical RTT' },
    'us-east→eu-west':     { estimated_ms: 85,  basis: 'static_estimate: Atlantic fiber typical RTT' },
    'ap-southeast→eu-west':{ estimated_ms: 180, basis: 'static_estimate: Asia-Europe typical RTT' },
    'ap-southeast→us-east':{ estimated_ms: 150, basis: 'static_estimate: Pacific fiber typical RTT' },
  }
}

// ─── Aggregate builder ────────────────────────────────────────────────────────

/**
 * Runs all probes concurrently via Promise.allSettled.
 * Aggregates into GlobalLatencyTruthMap and stores to Redis (5-min TTL).
 */
export async function buildGlobalLatencyTruthMap(): Promise<GlobalLatencyTruthMap> {
  const measured_at = new Date().toISOString()

  // Run all probe groups concurrently — failures are isolated per group
  const [supabaseResult, redisResult, internalResult] = await Promise.allSettled([
    probeSupabase(5),
    probeRedis(5),
    probeInternalAPI(['/api/health', '/api/schema/drift-report'], 2),
  ])

  const supabaseProbes: LatencyProbe[] = supabaseResult.status === 'fulfilled'
    ? supabaseResult.value
    : [{
        probe_id:   randomUUID(),
        target:     'supabase',
        endpoint:   'supabase (probe group failed)',
        region:     CURRENT_REGION,
        latency_ms: 0,
        success:    false,
        error:      supabaseResult.reason instanceof Error ? supabaseResult.reason.message : String(supabaseResult.reason),
        timestamp:  measured_at,
      }]

  const redisProbes: LatencyProbe[] = redisResult.status === 'fulfilled'
    ? redisResult.value
    : [{
        probe_id:   randomUUID(),
        target:     'redis',
        endpoint:   'redis (probe group failed)',
        region:     CURRENT_REGION,
        latency_ms: 0,
        success:    false,
        error:      redisResult.reason instanceof Error ? redisResult.reason.message : String(redisResult.reason),
        timestamp:  measured_at,
      }]

  const internalProbes: LatencyProbe[] = internalResult.status === 'fulfilled'
    ? internalResult.value
    : [{
        probe_id:   randomUUID(),
        target:     'internal_api',
        endpoint:   'internal_api (probe group failed)',
        region:     CURRENT_REGION,
        latency_ms: 0,
        success:    false,
        error:      internalResult.reason instanceof Error ? internalResult.reason.message : String(internalResult.reason),
        timestamp:  measured_at,
      }]

  const allProbes = [...supabaseProbes, ...redisProbes, ...internalProbes]

  // ── Summary ────────────────────────────────────────────────────────────────

  // Only include successful probes in percentile calculations
  const successfulSupabase = supabaseProbes
    .filter(p => p.success)
    .map(p => p.latency_ms)
    .sort((a, b) => a - b)

  const successfulRedis = redisProbes
    .filter(p => p.success)
    .map(p => p.latency_ms)
    .sort((a, b) => a - b)

  const supabase_p50_ms = percentile(successfulSupabase, 50)
  const supabase_p95_ms = percentile(successfulSupabase, 95)
  const redis_p50_ms    = percentile(successfulRedis, 50)
  const redis_p95_ms    = percentile(successfulRedis, 95)

  // infra_score = % of all probes that responded under 100ms (success only)
  const successfulProbes = allProbes.filter(p => p.success)
  const fastProbes       = successfulProbes.filter(p => p.latency_ms < 100)
  const infra_score      = allProbes.length > 0
    ? Math.round((fastProbes.length / allProbes.length) * 100)
    : 0

  const overall_health: 'healthy' | 'degraded' | 'critical' =
    infra_score > 80 ? 'healthy' :
    infra_score >= 50 ? 'degraded' :
    'critical'

  // Slowest target by average latency across all probes in that group
  const targetAvg = (['supabase', 'redis', 'internal_api', 'vercel_edge'] as const).map(t => {
    const tProbes = allProbes.filter(p => p.target === t)
    if (tProbes.length === 0) return { target: t, avg: 0 }
    const avg = tProbes.reduce((s, p) => s + p.latency_ms, 0) / tProbes.length
    return { target: t, avg }
  })
  const slowest = targetAvg.reduce((a, b) => b.avg > a.avg ? b : a)
  const slowest_target = slowest.target

  const result: GlobalLatencyTruthMap = {
    region:      CURRENT_REGION,
    measured_at,
    probes:      allProbes,
    summary: {
      supabase_p50_ms,
      supabase_p95_ms,
      redis_p50_ms,
      redis_p95_ms,
      overall_health,
      slowest_target,
    },
    infra_score,
  }

  // Store to Redis (5-min TTL) — fire-and-forget, fail-open
  const cacheKey = `reality:latency_map:${CURRENT_REGION}`
  void redisSet(cacheKey, JSON.stringify(result), 300)

  return result
}

// ─── Public read entry point ──────────────────────────────────────────────────

/**
 * Returns the GlobalLatencyTruthMap.
 * `useCache=true` (default): serves from Redis if a fresh result is cached.
 * `useCache=false`: always runs a fresh probe round.
 */
export async function getLatencyTruthMap(useCache = true): Promise<GlobalLatencyTruthMap> {
  if (useCache) {
    const cacheKey = `reality:latency_map:${CURRENT_REGION}`
    const cached   = await redisGet(cacheKey)
    if (cached !== null) {
      try {
        return JSON.parse(cached) as GlobalLatencyTruthMap
      } catch {
        // corrupted — fall through to fresh probe
      }
    }
  }

  return buildGlobalLatencyTruthMap()
}
