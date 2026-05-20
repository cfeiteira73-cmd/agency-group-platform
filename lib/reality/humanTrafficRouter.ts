// =============================================================================
// Agency Group — Human Traffic Router
// lib/reality/humanTrafficRouter.ts
//
// Real-traffic instrumentation layer.
// Records ACTUAL API request latency, tenant identity, and usage patterns
// from live production traffic.
//
// NOT simulation — wraps real handlers, measures real wall-clock latency.
// TypeScript strict — 0 errors
// =============================================================================

import { randomUUID } from 'crypto'
import { CURRENT_REGION } from '@/lib/events/globalOrdering'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TrafficRecord {
  request_id:      string        // randomUUID
  tenant_id:       string
  route:           string        // e.g. '/api/graph/query'
  method:          string        // GET/POST/etc
  latency_ms:      number        // wall-clock response time
  status_code:     number
  region:          string
  timestamp:       string        // ISO
  cost_eur?:       number        // optional, if known
  ai_tokens?:      number        // optional, if known
  user_agent?:     string        // for churn analysis
  correlation_id?: string
}

export interface RealWorldLoadProfile {
  tenant_id:       string
  window_seconds:  number
  sample_count:    number
  p50_latency_ms:  number
  p95_latency_ms:  number
  p99_latency_ms:  number
  error_rate:      number        // 4xx+5xx / total
  throughput_rps:  number        // requests per second in window
  ai_cost_total:   number        // sum of cost_eur where ai_tokens > 0
  top_routes:      Array<{ route: string; count: number; avg_latency_ms: number }>
  generated_at:    string
}

// ─── Redis config ─────────────────────────────────────────────────────────────

interface RedisConfig {
  url:   string
  token: string
}

function getRedisConfig(): RedisConfig | null {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return { url, token }
}

// ─── Percentile computation ───────────────────────────────────────────────────

/**
 * Percentile computation over a pre-sorted number array.
 * p: 0–100 inclusive.
 */
function percentile(sortedArr: number[], p: number): number {
  if (sortedArr.length === 0) return 0
  const idx = Math.ceil((p / 100) * sortedArr.length) - 1
  return sortedArr[Math.max(0, idx)] ?? 0
}

// ─── Stream key helper ────────────────────────────────────────────────────────

function trafficStreamKey(tenantId: string): string {
  return `traffic_stream:${tenantId}`
}

// ─── Empty load profile factory ───────────────────────────────────────────────

function emptyProfile(tenantId: string, windowSeconds: number): RealWorldLoadProfile {
  return {
    tenant_id:      tenantId,
    window_seconds: windowSeconds,
    sample_count:   0,
    p50_latency_ms: 0,
    p95_latency_ms: 0,
    p99_latency_ms: 0,
    error_rate:     0,
    throughput_rps: 0,
    ai_cost_total:  0,
    top_routes:     [],
    generated_at:   new Date().toISOString(),
  }
}

// ─── recordTraffic ────────────────────────────────────────────────────────────

/**
 * Appends a TrafficRecord to the tenant's Redis Stream.
 * Uses XADD with MAXLEN ~5000. Fire-and-forget — never throws.
 */
export async function recordTraffic(record: TrafficRecord): Promise<void> {
  const cfg = getRedisConfig()
  if (!cfg) return

  const key = trafficStreamKey(record.tenant_id)

  // Build flat field-value pairs as strings for XADD
  const fields: string[] = [
    'request_id',  record.request_id,
    'tenant_id',   record.tenant_id,
    'route',       record.route,
    'method',      record.method,
    'latency_ms',  String(record.latency_ms),
    'status_code', String(record.status_code),
    'region',      record.region,
    'timestamp',   record.timestamp,
  ]

  if (record.cost_eur !== undefined) {
    fields.push('cost_eur', String(record.cost_eur))
  }
  if (record.ai_tokens !== undefined) {
    fields.push('ai_tokens', String(record.ai_tokens))
  }
  if (record.user_agent !== undefined) {
    fields.push('user_agent', record.user_agent)
  }
  if (record.correlation_id !== undefined) {
    fields.push('correlation_id', record.correlation_id)
  }

  // Pipeline: [["XADD", key, "MAXLEN", "~", "5000", "*", ...fields]]
  const pipeline = [['XADD', key, 'MAXLEN', '~', '5000', '*', ...fields]]

  try {
    await fetch(`${cfg.url}/pipeline`, {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${cfg.token}`,
        'Content-Type': 'application/json',
      },
      body:   JSON.stringify(pipeline),
      signal: AbortSignal.timeout(500),
    })
  } catch {
    // fail-open: never block the caller
  }
}

// ─── withTrafficTracking ──────────────────────────────────────────────────────

/**
 * Wraps a real request handler to measure wall-clock latency and record the
 * result to the traffic stream. Non-blocking — recording is fire-and-forget.
 *
 * On handler error: records status 500 then re-throws the original error.
 */
export async function withTrafficTracking<T>(
  tenantId:   string,
  route:      string,
  method:     string,
  handler:    () => Promise<{
    result:          T
    status:          number
    cost_eur?:       number
    ai_tokens?:      number
    correlation_id?: string
  }>,
  opts?: { user_agent?: string },
): Promise<T> {
  const start      = Date.now()
  const request_id = randomUUID()

  try {
    const { result, status, cost_eur, ai_tokens, correlation_id } = await handler()

    const latency_ms = Date.now() - start

    const record: TrafficRecord = {
      request_id,
      tenant_id:  tenantId,
      route,
      method:     method.toUpperCase(),
      latency_ms,
      status_code: status,
      region:      CURRENT_REGION,
      timestamp:   new Date().toISOString(),
      ...(cost_eur       !== undefined && { cost_eur }),
      ...(ai_tokens      !== undefined && { ai_tokens }),
      ...(correlation_id !== undefined && { correlation_id }),
      ...(opts?.user_agent               && { user_agent: opts.user_agent }),
    }

    // Fire-and-forget — do not await
    void recordTraffic(record)

    return result
  } catch (err) {
    const latency_ms = Date.now() - start

    const record: TrafficRecord = {
      request_id,
      tenant_id:   tenantId,
      route,
      method:      method.toUpperCase(),
      latency_ms,
      status_code: 500,
      region:      CURRENT_REGION,
      timestamp:   new Date().toISOString(),
      ...(opts?.user_agent && { user_agent: opts.user_agent }),
    }

    void recordTraffic(record)

    throw err
  }
}

// ─── Stream entry parsing ─────────────────────────────────────────────────────

/** Raw Upstash XRANGE entry: [id, [field, value, field, value, ...]] */
type XRangeEntry = [string, string[]]

function parseXRangeEntry(entry: XRangeEntry): Partial<TrafficRecord> | null {
  try {
    const [, fields] = entry
    const map: Record<string, string> = {}
    for (let i = 0; i < fields.length - 1; i += 2) {
      const k = fields[i]
      const v = fields[i + 1]
      if (k !== undefined && v !== undefined) map[k] = v
    }

    const latency_ms  = Number(map['latency_ms']  ?? 0)
    const status_code = Number(map['status_code'] ?? 0)

    return {
      request_id:     map['request_id']     ?? '',
      tenant_id:      map['tenant_id']      ?? '',
      route:          map['route']          ?? '',
      method:         map['method']         ?? '',
      latency_ms,
      status_code,
      region:         map['region']         ?? '',
      timestamp:      map['timestamp']      ?? '',
      cost_eur:       map['cost_eur']   !== undefined ? Number(map['cost_eur'])   : undefined,
      ai_tokens:      map['ai_tokens']  !== undefined ? Number(map['ai_tokens'])  : undefined,
      user_agent:     map['user_agent'],
      correlation_id: map['correlation_id'],
    }
  } catch {
    return null
  }
}

// ─── getRealWorldLoadProfile ──────────────────────────────────────────────────

/**
 * Reads the Redis Stream for a tenant and computes a RealWorldLoadProfile
 * over the given time window (default: last 3600 seconds / 1 hour).
 *
 * Fail-open: returns an empty profile if Redis is unavailable.
 */
export async function getRealWorldLoadProfile(
  tenantId:       string,
  windowSeconds = 3600,
): Promise<RealWorldLoadProfile> {
  const cfg = getRedisConfig()
  if (!cfg) return emptyProfile(tenantId, windowSeconds)

  const key = trafficStreamKey(tenantId)

  let entries: XRangeEntry[] = []
  try {
    const res = await fetch(
      `${cfg.url}/xrange/${encodeURIComponent(key)}/-/+`,
      {
        headers: { Authorization: `Bearer ${cfg.token}` },
        signal:  AbortSignal.timeout(500),
      },
    )
    if (!res.ok) return emptyProfile(tenantId, windowSeconds)
    const body = await res.json() as { result: XRangeEntry[] | null }
    entries = body.result ?? []
  } catch {
    return emptyProfile(tenantId, windowSeconds)
  }

  const cutoffMs = Date.now() - windowSeconds * 1000
  const records: Partial<TrafficRecord>[] = entries
    .map(parseXRangeEntry)
    .filter((r): r is Partial<TrafficRecord> => r !== null)
    .filter(r => {
      if (!r.timestamp) return false
      return new Date(r.timestamp).getTime() >= cutoffMs
    })

  if (records.length === 0) return emptyProfile(tenantId, windowSeconds)

  // Latency percentiles
  const latencies = records
    .map(r => r.latency_ms ?? 0)
    .sort((a, b) => a - b)

  const p50 = percentile(latencies, 50)
  const p95 = percentile(latencies, 95)
  const p99 = percentile(latencies, 99)

  // Error rate
  const errorCount = records.filter(r => (r.status_code ?? 0) >= 400).length
  const error_rate = records.length > 0 ? errorCount / records.length : 0

  // Throughput
  const throughput_rps = records.length / windowSeconds

  // AI cost total
  const ai_cost_total = records.reduce((sum, r) => {
    if (r.ai_tokens !== undefined && r.ai_tokens > 0) {
      return sum + (r.cost_eur ?? 0)
    }
    return sum
  }, 0)

  // Top routes
  const routeMap = new Map<string, { count: number; total_latency: number }>()
  for (const r of records) {
    const route = r.route ?? 'unknown'
    const existing = routeMap.get(route) ?? { count: 0, total_latency: 0 }
    routeMap.set(route, {
      count:          existing.count + 1,
      total_latency:  existing.total_latency + (r.latency_ms ?? 0),
    })
  }

  const top_routes = Array.from(routeMap.entries())
    .map(([route, { count, total_latency }]) => ({
      route,
      count,
      avg_latency_ms: count > 0 ? Math.round(total_latency / count) : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  return {
    tenant_id:      tenantId,
    window_seconds: windowSeconds,
    sample_count:   records.length,
    p50_latency_ms: p50,
    p95_latency_ms: p95,
    p99_latency_ms: p99,
    error_rate,
    throughput_rps,
    ai_cost_total,
    top_routes,
    generated_at:   new Date().toISOString(),
  }
}

// ─── getSystemLoadProfile ─────────────────────────────────────────────────────

/**
 * Enumerates all traffic streams across the system using KEYS pattern matching,
 * then computes a RealWorldLoadProfile per tenant.
 *
 * Fail-open: returns [] if Redis is unavailable.
 */
export async function getSystemLoadProfile(
  windowSeconds = 3600,
): Promise<RealWorldLoadProfile[]> {
  const cfg = getRedisConfig()
  if (!cfg) return []

  let streamKeys: string[] = []
  try {
    const res = await fetch(
      `${cfg.url}/keys/${encodeURIComponent('traffic_stream:*')}`,
      {
        headers: { Authorization: `Bearer ${cfg.token}` },
        signal:  AbortSignal.timeout(500),
      },
    )
    if (!res.ok) return []
    const body = await res.json() as { result: string[] | null }
    streamKeys = body.result ?? []
  } catch {
    return []
  }

  if (streamKeys.length === 0) return []

  // Extract tenant IDs from key names: "traffic_stream:{tenant_id}"
  const tenantIds = streamKeys
    .map(k => k.replace(/^traffic_stream:/, ''))
    .filter(id => id.length > 0)

  // Fetch all profiles in parallel
  const profiles = await Promise.all(
    tenantIds.map(id => getRealWorldLoadProfile(id, windowSeconds)),
  )

  // Only return profiles that have data
  return profiles.filter(p => p.sample_count > 0)
}
