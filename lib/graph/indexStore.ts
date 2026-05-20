// =============================================================================
// Agency Group — Tiered Graph Index Store
// lib/graph/indexStore.ts
//
// Routes graph queries through three tiers to maintain <50ms on hot paths:
//   HOT  → Redis adjacency cache (getCachedGraphResult)         <10ms on hit
//   WARM → Postgres materialized views (getAgentRevenueMV, …)  20-100ms
//   COLD → Full CTE traversal (executeGraphQuery)              100-500ms
//
// Fail-open on every tier: error in HOT or WARM always falls to next tier.
// Never throws to caller — always returns a TieredGraphResult.
//
// TypeScript strict — 0 errors
// =============================================================================

import {
  buildGraphCacheKey,
  getCachedGraphResult,
  setCachedGraphResult,
  HOT_TTL_SECONDS,
  COLD_TTL_SECONDS,
} from './adjacencyCache'
import {
  executeGraphQuery,
  type GraphQueryRequest,
  type GraphQueryType,
} from './graphQueryInterface'
import {
  getAgentRevenueMV,
  getTopDealPatterns,
  getGraphIntelligenceReport,
} from './materializedViews'
import { getRevenueAttribution } from './recursiveCTE'

// ─── Public types ─────────────────────────────────────────────────────────────

export type QueryTier = 'HOT' | 'WARM' | 'COLD'

export interface TieredGraphResult<T = unknown> {
  data:        T
  tier:        QueryTier
  latency_ms:  number
  cache_key?:  string    // present when served from HOT
  tenant_id:   string
  query_type:  string
  served_at:   string
}

export interface IndexStoreStats {
  hot_hit_rate:   number   // fraction 0-1
  warm_hit_rate:  number
  cold_hit_rate:  number
  avg_latency_ms: number
  p95_latency_ms: number
  total_queries:  number
  window_seconds: number
}

// ─── Redis REST helpers (mirrors adjacencyCache pattern) ──────────────────────

const STATS_KEY_PREFIX   = 'graph_stats:'
const LATENCY_STREAM_KEY = 'graph_latency:'

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
      signal:  AbortSignal.timeout(400),
    })
    if (!res.ok) return null
    const body = (await res.json()) as { result: string | null }
    return body.result
  } catch {
    return null
  }
}

async function redisIncr(key: string): Promise<void> {
  const cfg = getRedisConfig()
  if (!cfg) return
  try {
    await fetch(`${cfg.url}/incr/${encodeURIComponent(key)}`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${cfg.token}` },
      signal:  AbortSignal.timeout(400),
    })
    // Set 24-hour TTL on stat counters to prevent unbounded key growth
    await fetch(
      `${cfg.url}/expire/${encodeURIComponent(key)}/86400`,
      {
        method:  'POST',
        headers: { Authorization: `Bearer ${cfg.token}` },
        signal:  AbortSignal.timeout(400),
      },
    ).catch(() => undefined)
  } catch {
    // fire-and-forget, fail-open
  }
}

/**
 * XADD to a latency stream for percentile computation.
 * Field: latency_ms = value in milliseconds (stored as string).
 * MAXLEN ~ 1000 caps the stream at ~1000 entries to prevent unbounded growth.
 */
async function redisXAdd(stream: string, latencyMs: number): Promise<void> {
  const cfg = getRedisConfig()
  if (!cfg) return
  try {
    // Use Upstash pipeline endpoint to pass MAXLEN option with XADD.
    // Command: XADD {stream} MAXLEN ~ 1000 * latency_ms {value}
    const body = JSON.stringify([
      ['XADD', stream, 'MAXLEN', '~', '1000', '*', 'latency_ms', String(latencyMs)],
    ])
    await fetch(`${cfg.url}/pipeline`, {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${cfg.token}`,
        'Content-Type': 'application/json',
      },
      body,
      signal: AbortSignal.timeout(400),
    })
  } catch {
    // fire-and-forget, fail-open
  }
}

// ─── HOT cache read-only probe ────────────────────────────────────────────────

/**
 * Attempts a read-only GET from the Redis adjacency cache.
 * Returns the cached value if present, null on miss or any error (fail-open).
 * Does NOT write or recompute — pure probe.
 *
 * Unwraps WARM-tier payloads (`_warm_data`) and COLD-tier payloads (`_cold_data`)
 * so callers always receive the original result object at the top level.
 */
async function tryHotCache(cacheKey: string): Promise<unknown | null> {
  try {
    const cached = await getCachedGraphResult(cacheKey)
    if (cached === null || cached === undefined) return null

    // Unwrap WARM tier: data was stored under _warm_data
    const cachedObj = cached as unknown as Record<string, unknown>
    if (
      typeof cached === 'object' &&
      cached !== null &&
      '_warm_data' in cachedObj
    ) {
      return cachedObj['_warm_data'] ?? null
    }

    // Unwrap COLD tier: data was stored under _cold_data
    if (
      typeof cached === 'object' &&
      cached !== null &&
      '_cold_data' in cachedObj
    ) {
      return cachedObj['_cold_data'] ?? null
    }

    // FormalGraphResult stored directly (future-proof path)
    return cached
  } catch {
    return null
  }
}

// ─── WARM tier: map query type → materialized view function ──────────────────

/** Query types that have a materialized view fast path. */
const WARM_QUERY_TYPES = new Set<GraphQueryType>([
  'AGENT_CONTRIBUTION',
  'CONVERSION_PATTERNS',
  'FULL_TENANT_PATH',
  'REVENUE_LEAK',
])

/**
 * Runs the WARM path for a request.
 * Returns the pre-aggregated result or null if this query type has no MV
 * (WHY_DID_DEAL_CLOSE, ENTITY_ONTOLOGY, BUYER_CLUSTER — entity-specific, no MV).
 */
async function tryWarmPath(req: GraphQueryRequest): Promise<unknown | null> {
  if (!WARM_QUERY_TYPES.has(req.type)) return null

  switch (req.type) {
    case 'AGENT_CONTRIBUTION':
      return getAgentRevenueMV(req.tenant_id, req.limit ?? 20)

    case 'CONVERSION_PATTERNS':
      return getTopDealPatterns(req.tenant_id, req.limit ?? 5)

    case 'FULL_TENANT_PATH':
      return getGraphIntelligenceReport(req.tenant_id)

    case 'REVENUE_LEAK': {
      const attribution = await getRevenueAttribution(req.tenant_id, req.from_date, req.to_date)
      const leakers = attribution.filter(a => a.total_revenue < 0)
      return { leakers, all_agents: attribution }
    }

    default:
      return null
  }
}

// ─── Stats recording ──────────────────────────────────────────────────────────

/**
 * Records a tier hit and latency to Redis counters + stream.
 * Fire-and-forget — never throws.
 */
export async function recordTierHit(
  tenantId: string,
  tier: QueryTier,
  latencyMs: number,
): Promise<void> {
  const tierKey = `${STATS_KEY_PREFIX}${tenantId}:${tier.toLowerCase()}_hits`
  const totalKey = `${STATS_KEY_PREFIX}${tenantId}:total_queries`
  const latencyKey = `${STATS_KEY_PREFIX}${tenantId}:latency_sum`
  const stream = `${LATENCY_STREAM_KEY}${tenantId}`

  // Run all fire-and-forget in parallel; ignore errors individually
  await Promise.allSettled([
    redisIncr(tierKey),
    redisIncr(totalKey),
    // Accumulate latency sum for avg computation
    (async () => {
      const cfg = getRedisConfig()
      if (!cfg) return
      try {
        await fetch(
          `${cfg.url}/incrby/${encodeURIComponent(latencyKey)}/${latencyMs}`,
          {
            method:  'POST',
            headers: { Authorization: `Bearer ${cfg.token}` },
            signal:  AbortSignal.timeout(400),
          },
        )
        // Set 24-hour TTL on latency accumulator key
        await fetch(
          `${cfg.url}/expire/${encodeURIComponent(latencyKey)}/86400`,
          {
            method:  'POST',
            headers: { Authorization: `Bearer ${cfg.token}` },
            signal:  AbortSignal.timeout(400),
          },
        ).catch(() => undefined)
      } catch { /* fail-open */ }
    })(),
    redisXAdd(stream, latencyMs),
  ])
}

// ─── Stats retrieval ──────────────────────────────────────────────────────────

/** Returns zero-stats when Redis is unavailable or no data exists. */
function zeroStats(windowSeconds: number): IndexStoreStats {
  return {
    hot_hit_rate:   0,
    warm_hit_rate:  0,
    cold_hit_rate:  0,
    avg_latency_ms: 0,
    p95_latency_ms: 0,
    total_queries:  0,
    window_seconds: windowSeconds,
  }
}

/**
 * Reads tier hit counters and latency stream from Redis and computes stats.
 * Returns zero-stats if Redis is unavailable or the tenant has no data.
 */
export async function getIndexStoreStats(
  tenantId: string,
  windowSeconds = 3600,
): Promise<IndexStoreStats> {
  const cfg = getRedisConfig()
  if (!cfg) return zeroStats(windowSeconds)

  try {
    const [hotRaw, warmRaw, coldRaw, totalRaw, latencySumRaw] = await Promise.all([
      redisGet(`${STATS_KEY_PREFIX}${tenantId}:hot_hits`),
      redisGet(`${STATS_KEY_PREFIX}${tenantId}:warm_hits`),
      redisGet(`${STATS_KEY_PREFIX}${tenantId}:cold_hits`),
      redisGet(`${STATS_KEY_PREFIX}${tenantId}:total_queries`),
      redisGet(`${STATS_KEY_PREFIX}${tenantId}:latency_sum`),
    ])

    const hot   = parseInt(hotRaw  ?? '0', 10)  || 0
    const warm  = parseInt(warmRaw ?? '0', 10)  || 0
    const cold  = parseInt(coldRaw ?? '0', 10)  || 0
    const total = parseInt(totalRaw ?? '0', 10) || 0
    const latencySum = parseInt(latencySumRaw ?? '0', 10) || 0

    if (total === 0) return zeroStats(windowSeconds)

    const avgLatencyMs = Math.round(latencySum / total)

    // Compute p95 from the latency stream via XRANGE
    let p95LatencyMs = avgLatencyMs
    try {
      const streamKey = `${LATENCY_STREAM_KEY}${tenantId}`
      // XRANGE: read up to last 1000 entries for percentile calculation
      const xrangeRes = await fetch(
        `${cfg.url}/xrange/${encodeURIComponent(streamKey)}/-/+/count/1000`,
        {
          headers: { Authorization: `Bearer ${cfg.token}` },
          signal:  AbortSignal.timeout(400),
        },
      )
      if (xrangeRes.ok) {
        const xrangeBody = (await xrangeRes.json()) as {
          result: Array<[string, string[]]> | null
        }
        const entries = xrangeBody.result ?? []
        const latencies: number[] = []
        for (const [, fields] of entries) {
          // fields: ['latency_ms', '<value>', ...]
          for (let i = 0; i < fields.length - 1; i += 2) {
            if (fields[i] === 'latency_ms') {
              const v = parseInt(fields[i + 1], 10)
              if (!isNaN(v)) latencies.push(v)
            }
          }
        }
        if (latencies.length > 0) {
          latencies.sort((a, b) => a - b)
          const p95Idx = Math.floor(latencies.length * 0.95)
          p95LatencyMs = latencies[p95Idx] ?? latencies[latencies.length - 1] ?? avgLatencyMs
        }
      }
    } catch {
      // p95 falls back to avg — fail-open
    }

    return {
      hot_hit_rate:   total > 0 ? hot  / total : 0,
      warm_hit_rate:  total > 0 ? warm / total : 0,
      cold_hit_rate:  total > 0 ? cold / total : 0,
      avg_latency_ms: avgLatencyMs,
      p95_latency_ms: p95LatencyMs,
      total_queries:  total,
      window_seconds: windowSeconds,
    }
  } catch {
    return zeroStats(windowSeconds)
  }
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Tiered graph query engine.
 *
 * Tier routing:
 *   1. HOT  — Redis GET (read-only probe). Returns immediately if hit.
 *   2. WARM — Postgres materialized view (for MV-eligible query types).
 *             Writes result to HOT cache as a side-effect.
 *   3. COLD — Full executeGraphQuery() CTE traversal.
 *             Writes result to HOT cache as a side-effect.
 *
 * Always returns a TieredGraphResult — never throws to caller.
 * tier: 'COLD' is the ultimate fallback even on WARM failure.
 */
export async function queryWithTiers<T = unknown>(
  request: GraphQueryRequest,
): Promise<TieredGraphResult<T>> {
  const t0 = Date.now()
  const served_at = new Date().toISOString()
  const { tenant_id, type: query_type } = request

  const cacheKey = buildGraphCacheKey(
    tenant_id,
    query_type,
    request as unknown as Record<string, unknown>,
  )

  // ── Tier 1: HOT — Redis read-only probe ──────────────────────────────────
  try {
    const hotResult = await tryHotCache(cacheKey)
    if (hotResult !== null) {
      const latency_ms = Date.now() - t0
      void recordTierHit(tenant_id, 'HOT', latency_ms)
      return {
        data:      hotResult as T,
        tier:      'HOT',
        latency_ms,
        cache_key: cacheKey,
        tenant_id,
        query_type,
        served_at,
      }
    }
  } catch {
    // HOT error → fall through to WARM (fail-open)
  }

  // ── Tier 2: WARM — Materialized view fast path ───────────────────────────
  try {
    const warmStart = Date.now()
    const warmResult = await tryWarmPath(request)

    if (warmResult !== null) {
      const warmLatency = Date.now() - warmStart

      // Only accept WARM result if it arrived in <100ms
      if (warmLatency < 100) {
        const latency_ms = Date.now() - t0

        // Build a minimal FormalGraphResult-compatible wrapper to store in HOT cache
        const cachePayload = {
          nodes:            [],
          edges:            [],
          causal_chain:     [],
          revenue_delta:    0,
          confidence:       1,
          explanation_path: [],
          query_type,
          tenant_id,
          executed_at:      served_at,
          latency_ms,
          perf_class:       'warm' as const,
          // Store actual data under a known property for retrieval
          _warm_data:       warmResult,
        }

        // Fire-and-forget cache write — fail-open
        void setCachedGraphResult(cacheKey, cachePayload, HOT_TTL_SECONDS)
        void recordTierHit(tenant_id, 'WARM', latency_ms)

        return {
          data:      warmResult as T,
          tier:      'WARM',
          latency_ms,
          tenant_id,
          query_type,
          served_at,
        }
      }
      // WARM too slow — fall through to COLD
    }
  } catch {
    // WARM error → fall through to COLD (fail-open)
  }

  // ── Tier 3: COLD — Full CTE traversal ────────────────────────────────────
  try {
    const coldResult = await executeGraphQuery(request)
    const latency_ms = Date.now() - t0

    // Build a storeable FormalGraphResult from the response
    const cachePayload = {
      nodes:            [],
      edges:            [],
      causal_chain:     [],
      revenue_delta:    0,
      confidence:       1,
      explanation_path: coldResult.insights ?? [],
      query_type:       coldResult.query_type,
      tenant_id:        coldResult.tenant_id,
      executed_at:      coldResult.executed_at,
      latency_ms:       coldResult.latency_ms,
      perf_class:       'cold' as const,
      _cold_data:       coldResult.data,
    }

    // Fire-and-forget cache write — fail-open
    void setCachedGraphResult(cacheKey, cachePayload, COLD_TTL_SECONDS)
    void recordTierHit(tenant_id, 'COLD', latency_ms)

    return {
      data:      coldResult as unknown as T,
      tier:      'COLD',
      latency_ms,
      tenant_id,
      query_type,
      served_at,
    }
  } catch (err) {
    // Ultimate fallback — return COLD with error data, never throw
    const latency_ms = Date.now() - t0
    void recordTierHit(tenant_id, 'COLD', latency_ms)

    return {
      data: {
        error:     String(err),
        query_type,
        tenant_id,
      } as unknown as T,
      tier:      'COLD',
      latency_ms,
      tenant_id,
      query_type,
      served_at,
    }
  }
}

// ─── Cache pre-warmer ─────────────────────────────────────────────────────────

/** All WARM-eligible query types — pre-warm these on tenant activation / daily cron. */
const WARM_ELIGIBLE_REQUESTS = (tenantId: string): GraphQueryRequest[] => [
  { type: 'AGENT_CONTRIBUTION', tenant_id: tenantId, limit: 20 },
  { type: 'CONVERSION_PATTERNS', tenant_id: tenantId, limit: 5 },
  { type: 'FULL_TENANT_PATH',    tenant_id: tenantId },
  { type: 'REVENUE_LEAK',        tenant_id: tenantId },
]

/**
 * Pre-warms the Redis HOT cache for all WARM-eligible query types for a tenant.
 * Each call goes through queryWithTiers(), which stores the WARM result in HOT cache
 * as a side-effect. Subsequent requests will be served from HOT tier (<10ms).
 *
 * Safe to call from daily cron or on tenant activation. Never throws.
 */
export async function precomputeAdjacency(tenantId: string): Promise<void> {
  const requests = WARM_ELIGIBLE_REQUESTS(tenantId)

  await Promise.allSettled(
    requests.map(req =>
      queryWithTiers(req).catch(err =>
        console.warn(`[indexStore] precomputeAdjacency failed for ${req.type}:`, err),
      ),
    ),
  )
}
