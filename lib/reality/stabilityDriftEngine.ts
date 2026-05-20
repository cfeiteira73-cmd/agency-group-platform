// =============================================================================
// Agency Group — Stability Drift Engine
// lib/reality/stabilityDriftEngine.ts
//
// Long-duration stability drift detection.
// Accumulates real system snapshots over time via Redis Streams (XADD/XRANGE)
// and detects gradual degradation by comparing baseline vs current metrics.
//
// Design: cron-based sampling (captureSnapshot every hour) — NOT blocking.
// Stream key : drift_snapshots:{tenantId}   (MAXLEN ~ 2000 per tenant)
// Storage    : Upstash Redis REST API
// Fail-open  : every metric defaults to 0 on error — never throws to caller.
//
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin }      from '@/lib/supabase'
import { getIndexStoreStats } from '@/lib/graph/indexStore'
import { getRollingCostWindow } from '@/lib/economics/costStreamEngine'

// ─── Public types ─────────────────────────────────────────────────────────────

export interface SystemSnapshot {
  snapshot_id:  string
  tenant_id:    string
  captured_at:  string
  region:       string
  metrics: {
    redis_key_count:  number   // DBSIZE proxy
    queue_depth:      number   // pending runtime_events count
    error_rate_1h:    number   // failed / total events in last hour
    p95_graph_ms:     number   // from getIndexStoreStats
    cost_per_hour:    number   // from getRollingCostWindow
    audit_log_growth: number   // new audit_log entries in last hour
  }
}

export interface DriftSignature {
  metric:         string
  baseline_value: number       // first 3-snapshot avg
  current_value:  number       // last 3-snapshot avg
  drift_pct:      number       // (current - baseline) / baseline * 100
  trend:          'stable' | 'growing' | 'shrinking' | 'volatile'
  alarm:          boolean      // true when drift_pct exceeds threshold
  threshold_pct:  number       // configurable per-metric alarm threshold
}

export interface LongTermDriftReport {
  tenant_id:       string
  generated_at:    string
  snapshot_count:  number
  time_span_hours: number      // hours between first and last snapshot
  signatures:      DriftSignature[]
  stability_score: number      // 100 − (alarms / total_metrics * 100)
  verdict:         'stable' | 'drifting' | 'degrading'
  recommendations: string[]
}

// ─── Alarm thresholds (% drift) ───────────────────────────────────────────────

const THRESHOLDS: Record<keyof SystemSnapshot['metrics'], number> = {
  queue_depth:      200,
  error_rate_1h:    100,
  p95_graph_ms:     100,
  cost_per_hour:    150,
  redis_key_count:  500,
  audit_log_growth: 300,
}

// ─── Redis config ─────────────────────────────────────────────────────────────

interface RedisConfig { url: string; token: string }

function getRedisConfig(): RedisConfig | null {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return { url, token }
}

// ─── Redis helpers ────────────────────────────────────────────────────────────

/** XADD with MAXLEN ~ 2000. Fire-and-forget, fail-open. */
async function redisXAdd(
  key:    string,
  fields: Record<string, string>,
): Promise<void> {
  const cfg = getRedisConfig()
  if (!cfg) return

  const fieldPairs: string[] = []
  for (const [k, v] of Object.entries(fields)) {
    fieldPairs.push(k, v)
  }

  const body = JSON.stringify([
    ['XADD', key, 'MAXLEN', '~', '2000', '*', ...fieldPairs],
  ])

  try {
    await fetch(`${cfg.url}/pipeline`, {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${cfg.token}`,
        'Content-Type': 'application/json',
      },
      body,
      signal: AbortSignal.timeout(800),
    })
  } catch {
    // fail-open
  }
}

/** XRANGE - + with optional COUNT. Returns [] on any error. */
async function redisXRange(
  key:   string,
  count: number = 500,
): Promise<Array<[string, string[]]>> {
  const cfg = getRedisConfig()
  if (!cfg) return []

  try {
    const url = `${cfg.url}/xrange/${encodeURIComponent(key)}/-/+/count/${count}`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${cfg.token}` },
      signal:  AbortSignal.timeout(800),
    })
    if (!res.ok) return []
    const body = await res.json() as { result: unknown }
    if (!Array.isArray(body.result)) return []
    return body.result as Array<[string, string[]]>
  } catch {
    return []
  }
}

/** GET /dbsize — returns total key count. Returns 0 on error. */
async function redisDbSize(): Promise<number> {
  const cfg = getRedisConfig()
  if (!cfg) return 0

  try {
    const res = await fetch(`${cfg.url}/dbsize`, {
      headers: { Authorization: `Bearer ${cfg.token}` },
      signal:  AbortSignal.timeout(500),
    })
    if (!res.ok) return 0
    const body = await res.json() as { result: number }
    return typeof body.result === 'number' ? body.result : 0
  } catch {
    return 0
  }
}

/** Parse flat [field, val, ...] array into a plain object. */
function parseStreamFields(flat: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (let i = 0; i + 1 < flat.length; i += 2) {
    out[flat[i]] = flat[i + 1]
  }
  return out
}

// ─── Metric collectors ────────────────────────────────────────────────────────

/** Count runtime_events with given status for a tenant. Returns 0 on error. */
async function countRuntimeEvents(
  tenantId: string,
  status:   'pending' | 'processing' | 'completed' | 'failed' | 'dlq',
  sinceIso?: string,
): Promise<number> {
  try {
    let q = supabaseAdmin
      .from('runtime_events')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', tenantId)
      .eq('status', status)

    if (sinceIso) {
      q = q.gte('created_at', sinceIso)
    }

    const { count } = await q
    return count ?? 0
  } catch {
    return 0
  }
}

/** Count audit_log rows created after sinceIso. Returns 0 on error. */
async function countAuditLogGrowth(
  tenantId: string,
  sinceIso: string,
): Promise<number> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count } = await (supabaseAdmin as any)
      .from('audit_log')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('created_at', sinceIso)

    return typeof count === 'number' ? count : 0
  } catch {
    return 0
  }
}

// ─── captureSnapshot ──────────────────────────────────────────────────────────

/**
 * Captures a point-in-time snapshot of all system metrics for a tenant.
 * Stores it in the Redis Stream `drift_snapshots:{tenantId}`.
 * Returns the snapshot. Never throws — all metrics default to 0 on error.
 */
export async function captureSnapshot(tenantId: string): Promise<SystemSnapshot> {
  const capturedAt = new Date().toISOString()
  const oneHourAgoIso = new Date(Date.now() - 3600 * 1000).toISOString()

  // Capture all metrics in parallel — fail-open per metric
  const [
    redisKeysResult,
    queueDepthResult,
    failedEventsResult,
    totalEventsResult,
    graphStatsResult,
    costWindowResult,
    auditGrowthResult,
  ] = await Promise.allSettled([
    redisDbSize(),
    countRuntimeEvents(tenantId, 'pending'),
    countRuntimeEvents(tenantId, 'failed', oneHourAgoIso),
    // total events in last hour (any status)
    (async () => {
      try {
        const { count } = await supabaseAdmin
          .from('runtime_events')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', tenantId)
          .gte('created_at', oneHourAgoIso)
        return count ?? 0
      } catch {
        return 0
      }
    })(),
    getIndexStoreStats(tenantId, 3600),
    getRollingCostWindow(tenantId, 3600),
    countAuditLogGrowth(tenantId, oneHourAgoIso),
  ])

  const redisKeyCount  = redisKeysResult.status  === 'fulfilled' ? redisKeysResult.value  : 0
  const queueDepth     = queueDepthResult.status === 'fulfilled' ? queueDepthResult.value : 0
  const failedEvents   = failedEventsResult.status === 'fulfilled' ? failedEventsResult.value : 0
  const totalEvents    = totalEventsResult.status  === 'fulfilled' ? totalEventsResult.value  : 0
  const graphStats     = graphStatsResult.status   === 'fulfilled' ? graphStatsResult.value   : null
  const costWindow     = costWindowResult.status   === 'fulfilled' ? costWindowResult.value   : null
  const auditGrowth    = auditGrowthResult.status  === 'fulfilled' ? auditGrowthResult.value  : 0

  const errorRate1h = totalEvents > 0
    ? Math.round((failedEvents / totalEvents) * 10_000) / 10_000
    : 0

  const p95GraphMs  = graphStats?.p95_latency_ms ?? 0
  const costPerHour = costWindow?.burn_rate_per_hour ?? 0

  const snapshotId = `snap_${tenantId}_${Date.now()}`
  const region     = process.env.VERCEL_REGION ?? process.env.AWS_REGION ?? 'unknown'

  const snapshot: SystemSnapshot = {
    snapshot_id:  snapshotId,
    tenant_id:    tenantId,
    captured_at:  capturedAt,
    region,
    metrics: {
      redis_key_count:  redisKeyCount,
      queue_depth:      queueDepth,
      error_rate_1h:    errorRate1h,
      p95_graph_ms:     p95GraphMs,
      cost_per_hour:    costPerHour,
      audit_log_growth: auditGrowth,
    },
  }

  // Persist to Redis Stream — fire-and-forget
  const streamKey = `drift_snapshots:${tenantId}`
  void redisXAdd(streamKey, {
    snapshot_id:      snapshot.snapshot_id,
    tenant_id:        snapshot.tenant_id,
    captured_at:      snapshot.captured_at,
    region:           snapshot.region,
    redis_key_count:  String(snapshot.metrics.redis_key_count),
    queue_depth:      String(snapshot.metrics.queue_depth),
    error_rate_1h:    String(snapshot.metrics.error_rate_1h),
    p95_graph_ms:     String(snapshot.metrics.p95_graph_ms),
    cost_per_hour:    String(snapshot.metrics.cost_per_hour),
    audit_log_growth: String(snapshot.metrics.audit_log_growth),
  })

  return snapshot
}

// ─── readSnapshots ────────────────────────────────────────────────────────────

/**
 * Reads accumulated snapshots from `drift_snapshots:{tenantId}`.
 * Returns up to `maxCount` most recent snapshots (default 500).
 * Returns [] when Redis is unavailable.
 */
export async function readSnapshots(
  tenantId: string,
  maxCount: number = 500,
): Promise<SystemSnapshot[]> {
  const streamKey = `drift_snapshots:${tenantId}`
  const entries   = await redisXRange(streamKey, maxCount)

  const snapshots: SystemSnapshot[] = []

  for (const [, flatFields] of entries) {
    const f = parseStreamFields(flatFields)

    snapshots.push({
      snapshot_id:  f['snapshot_id'] ?? '',
      tenant_id:    f['tenant_id']   ?? tenantId,
      captured_at:  f['captured_at'] ?? '',
      region:       f['region']      ?? 'unknown',
      metrics: {
        redis_key_count:  parseFloat(f['redis_key_count']  ?? '0') || 0,
        queue_depth:      parseFloat(f['queue_depth']      ?? '0') || 0,
        error_rate_1h:    parseFloat(f['error_rate_1h']    ?? '0') || 0,
        p95_graph_ms:     parseFloat(f['p95_graph_ms']     ?? '0') || 0,
        cost_per_hour:    parseFloat(f['cost_per_hour']    ?? '0') || 0,
        audit_log_growth: parseFloat(f['audit_log_growth'] ?? '0') || 0,
      },
    })
  }

  return snapshots
}

// ─── getDriftCycleName ────────────────────────────────────────────────────────

/**
 * Maps an elapsed time in hours to a human-readable drift cycle label.
 *   1–24  → '24h'
 *   25–72 → '72h'
 *   73–168 → '7-day'
 *   169–720 → '30-day'
 *   >720   → 'extended'
 */
export function getDriftCycleName(hours: number): string {
  if (hours <= 24)  return '24h'
  if (hours <= 72)  return '72h'
  if (hours <= 168) return '7-day'
  if (hours <= 720) return '30-day'
  return 'extended'
}

// ─── analyzeDrift ─────────────────────────────────────────────────────────────

/** Average an array of numbers. Returns 0 for empty arrays. */
function avg(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((s, v) => s + v, 0) / values.length
}

/**
 * Determine trend from a series of metric values.
 * Uses a simple linear regression sign to classify direction,
 * and coefficient of variation to detect volatility.
 */
function classifyTrend(
  values: number[],
): 'stable' | 'growing' | 'shrinking' | 'volatile' {
  if (values.length < 2) return 'stable'

  const mean = avg(values)
  if (mean === 0) return 'stable'

  // Coefficient of variation — high spread = volatile
  const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length
  const cv = Math.sqrt(variance) / Math.abs(mean)
  if (cv > 0.5) return 'volatile'

  // Direction from first half vs second half avg
  const mid   = Math.floor(values.length / 2)
  const first = avg(values.slice(0, mid))
  const last  = avg(values.slice(mid))

  if (last > first * 1.05) return 'growing'
  if (last < first * 0.95) return 'shrinking'
  return 'stable'
}

/** Build a human-readable recommendation for an alarmed metric. */
function buildRecommendation(
  metric:   string,
  driftPct: number,
  current:  number,
): string {
  const pct = Math.round(driftPct)
  switch (metric) {
    case 'queue_depth':
      return `Queue depth has grown ${pct}% from baseline (current: ${current} pending). Investigate consumer lag or blocked workers.`
    case 'error_rate_1h':
      return `Error rate drifted ${pct}% from baseline (current: ${(current * 100).toFixed(1)}%). Review recent deployments and upstream API health.`
    case 'p95_graph_ms':
      return `Graph p95 latency increased ${pct}% from baseline (current: ${Math.round(current)}ms). Check index freshness and Redis HOT hit rate.`
    case 'cost_per_hour':
      return `Hourly burn rate grew ${pct}% from baseline (current: €${current.toFixed(4)}/h). Audit recent AI call volume and model selection.`
    case 'redis_key_count':
      return `Redis key count grew ${pct}% from baseline (current: ${current} keys). Look for unbounded caches or orphaned stream entries.`
    case 'audit_log_growth':
      return `Audit log write rate increased ${pct}% from baseline (current: ${current} entries/h). Verify no runaway automation or retry storm.`
    default:
      return `Metric "${metric}" drifted ${pct}% from baseline (current: ${current}).`
  }
}

/**
 * Reads all accumulated snapshots and produces a LongTermDriftReport.
 * Baseline = avg of first 3 snapshots. Current = avg of last 3 snapshots.
 * Requires at least 2 snapshots; returns a zero-drift report with 0 snapshots
 * when no data is available.
 */
export async function analyzeDrift(tenantId: string): Promise<LongTermDriftReport> {
  const now          = new Date().toISOString()
  const snapshots    = await readSnapshots(tenantId, 500)
  const count        = snapshots.length

  // Degenerate case — not enough data
  if (count < 2) {
    return {
      tenant_id:       tenantId,
      generated_at:    now,
      snapshot_count:  count,
      time_span_hours: 0,
      signatures:      [],
      stability_score: 100,
      verdict:         'stable',
      recommendations: count === 0
        ? ['No snapshots recorded yet. Deploy the capture-drift-snapshot cron to begin accumulation.']
        : ['Only 1 snapshot available. Drift analysis requires at least 2 snapshots.'],
    }
  }

  // Time span in hours between first and last snapshot
  const firstTs = new Date(snapshots[0].captured_at).getTime()
  const lastTs  = new Date(snapshots[count - 1].captured_at).getTime()
  const timeSpanHours = Math.round((lastTs - firstTs) / (3600 * 1000) * 10) / 10

  // Extract per-metric value series
  type MetricKey = keyof SystemSnapshot['metrics']
  const metricKeys: MetricKey[] = [
    'redis_key_count',
    'queue_depth',
    'error_rate_1h',
    'p95_graph_ms',
    'cost_per_hour',
    'audit_log_growth',
  ]

  const signatures: DriftSignature[] = []
  const recommendations: string[]    = []

  for (const metric of metricKeys) {
    const series = snapshots.map(s => s.metrics[metric])

    const baselineSlice = series.slice(0, Math.min(3, Math.floor(count / 2)))
    const currentSlice  = series.slice(Math.max(0, count - 3))

    const baselineValue = avg(baselineSlice)
    const currentValue  = avg(currentSlice)

    // Drift % — guard division-by-zero: if baseline is 0, any growth = 100%
    let driftPct: number
    if (baselineValue === 0) {
      driftPct = currentValue > 0 ? 100 : 0
    } else {
      driftPct = ((currentValue - baselineValue) / baselineValue) * 100
    }

    const threshold = THRESHOLDS[metric]
    const trend     = classifyTrend(series)

    // Special case for error_rate_1h: also alarm if current > 0.05 (5%)
    const alarmByThreshold = Math.abs(driftPct) > threshold
    const alarmAbsolute    = metric === 'error_rate_1h' && currentValue > 0.05
    const alarm            = alarmByThreshold || alarmAbsolute

    const sig: DriftSignature = {
      metric,
      baseline_value: Math.round(baselineValue * 1_000_000) / 1_000_000,
      current_value:  Math.round(currentValue  * 1_000_000) / 1_000_000,
      drift_pct:      Math.round(driftPct * 100) / 100,
      trend,
      alarm,
      threshold_pct:  threshold,
    }

    signatures.push(sig)

    if (alarm) {
      recommendations.push(buildRecommendation(metric, Math.abs(driftPct), currentValue))
    }
  }

  const alarmCount     = signatures.filter(s => s.alarm).length
  const totalMetrics   = signatures.length
  const stabilityScore = Math.round(100 - (alarmCount / totalMetrics) * 100)

  const verdict: LongTermDriftReport['verdict'] =
    stabilityScore > 80 ? 'stable' :
    stabilityScore > 50 ? 'drifting' :
    'degrading'

  return {
    tenant_id:       tenantId,
    generated_at:    now,
    snapshot_count:  count,
    time_span_hours: timeSpanHours,
    signatures,
    stability_score: stabilityScore,
    verdict,
    recommendations,
  }
}
