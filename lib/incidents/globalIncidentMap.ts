// =============================================================================
// Agency Group — Global Incident Map
// lib/incidents/globalIncidentMap.ts
//
// Real-time global incident heatmap aggregator.
// Builds a cross-tenant, cross-region, cross-subsystem view of all incidents
// within a rolling time window. Results are cached in Redis for 60 seconds.
//
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin }    from '@/lib/supabase'
import { CURRENT_REGION }   from '@/lib/events/globalOrdering'
import type { IncidentRow } from '@/lib/incidents/incidentIngestor'

// ─── Output types ─────────────────────────────────────────────────────────────

export interface IncidentHeatCell {
  key:              string           // tenant_id | region | subsystem
  incident_count:   number
  open_count:       number
  p0_count:         number           // severity === 'P0'
  p1_count:         number           // severity === 'P1'
  total_cost_eur:   number
  last_incident_at: string | null
}

export interface FailurePropagationEdge {
  from_subsystem:  string
  to_subsystem:    string
  incident_count:  number            // incidents that traversed this edge
  avg_delay_ms:    number            // average propagation time (0 if unknown)
}

export interface GlobalIncidentMap {
  generated_at:              string
  region:                    string
  total_incidents:           number
  open_incidents:            number

  // Heatmaps
  by_tenant:                 IncidentHeatCell[]
  by_region:                 IncidentHeatCell[]
  by_subsystem:              IncidentHeatCell[]

  // Cost exposure
  total_cost_exposure_eur:   number
  highest_cost_tenant:       string | null

  // Propagation graph
  propagation_edges:         FailurePropagationEdge[]

  // Summary stats
  avg_detection_latency_ms:  number
  avg_resolution_latency_ms: number | null
  most_common_failure_type:  string | null
}

// ─── Redis helpers (Upstash REST) ─────────────────────────────────────────────

const CACHE_KEY = 'reality:incident_map'
const CACHE_TTL = 60 // seconds

function getRedisConfig(): { url: string; token: string } | null {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return { url, token }
}

async function cacheGet(key: string): Promise<string | null> {
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
  } catch { return null }
}

async function cacheSet(key: string, value: string, ttl: number): Promise<void> {
  const cfg = getRedisConfig()
  if (!cfg) return
  try {
    await fetch(
      `${cfg.url}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}?ex=${ttl}`,
      {
        method:  'POST',
        headers: { Authorization: `Bearer ${cfg.token}` },
        signal:  AbortSignal.timeout(300),
      },
    )
  } catch { /* fail-open */ }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function emptyMap(): GlobalIncidentMap {
  return {
    generated_at:              new Date().toISOString(),
    region:                    CURRENT_REGION,
    total_incidents:           0,
    open_incidents:            0,
    by_tenant:                 [],
    by_region:                 [],
    by_subsystem:              [],
    total_cost_exposure_eur:   0,
    highest_cost_tenant:       null,
    propagation_edges:         [],
    avg_detection_latency_ms:  0,
    avg_resolution_latency_ms: null,
    most_common_failure_type:  null,
  }
}

/** Safely parse a jsonb field that may already be an object or a raw JSON string. */
function safeJsonb(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'object') return value as Record<string, unknown>
  if (typeof value === 'string') {
    try { return JSON.parse(value) as Record<string, unknown> } catch { return null }
  }
  return null
}

type HeatMap = Map<string, IncidentHeatCell>

function addToHeatMap(map: HeatMap, key: string, row: IncidentRow, costEur: number): void {
  const isOpen = row.status !== 'resolved' && row.status !== 'autopsy_complete'
  const isP0   = row.severity === 'P0'
  const isP1   = row.severity === 'P1'

  const existing = map.get(key)
  if (!existing) {
    map.set(key, {
      key,
      incident_count:   1,
      open_count:       isOpen ? 1 : 0,
      p0_count:         isP0   ? 1 : 0,
      p1_count:         isP1   ? 1 : 0,
      total_cost_eur:   costEur,
      last_incident_at: row.detected_at,
    })
  } else {
    existing.incident_count += 1
    if (isOpen) existing.open_count += 1
    if (isP0)   existing.p0_count   += 1
    if (isP1)   existing.p1_count   += 1
    existing.total_cost_eur += costEur
    if (
      row.detected_at &&
      (!existing.last_incident_at || row.detected_at > existing.last_incident_at)
    ) {
      existing.last_incident_at = row.detected_at
    }
  }
}

function average(arr: number[]): number {
  if (arr.length === 0) return 0
  return Math.round(arr.reduce((s, v) => s + v, 0) / arr.length)
}

// ─── Core builder ─────────────────────────────────────────────────────────────

/**
 * Builds a GlobalIncidentMap from all incidents in the last `windowHours` hours.
 * Results are cached in Redis for 60 seconds.
 *
 * @param windowHours  Rolling window (default 24)
 * @param skipCache    Pass true to bypass the Redis cache
 */
export async function buildGlobalIncidentMap(
  windowHours = 24,
  skipCache   = false,
): Promise<GlobalIncidentMap> {
  // ── Cache read ──────────────────────────────────────────────────────────────
  if (!skipCache) {
    const cached = await cacheGet(CACHE_KEY)
    if (cached !== null) {
      try { return JSON.parse(cached) as GlobalIncidentMap } catch { /* fall through */ }
    }
  }

  // ── Query DB ────────────────────────────────────────────────────────────────
  const cutoff = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString()

  let rows: IncidentRow[] = []
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('incidents')
      .select('*')
      .gte('detected_at', cutoff)
      .order('detected_at', { ascending: false })

    if (error) {
      console.error('[GlobalIncidentMap] DB query error:', error)
      return emptyMap()
    }
    rows = (data ?? []) as IncidentRow[]
  } catch (err) {
    console.error('[GlobalIncidentMap] DB unavailable:', err)
    return emptyMap()
  }

  if (rows.length === 0) {
    const result = emptyMap()
    void cacheSet(CACHE_KEY, JSON.stringify(result), CACHE_TTL)
    return result
  }

  // ── Aggregate ───────────────────────────────────────────────────────────────
  const tenantMap:    HeatMap = new Map()
  const regionMap:    HeatMap = new Map()
  const subsystemMap: HeatMap = new Map()

  let totalCostEur = 0
  let openCount    = 0

  const classificationFreq: Map<string, number> = new Map()
  const detectionLatencies:  number[]            = []
  const resolutionLatencies: number[]            = []

  // Propagation edge counters: edgeKey -> { count, totalDelayMs }
  const edgeMap = new Map<string, { count: number; totalDelayMs: number }>()

  for (const row of rows) {
    // ── Cost from impact jsonb ────────────────────────────────────────────────
    const impact  = safeJsonb(row.impact)
    const costEur = typeof impact?.total_economic_impact_eur === 'number'
      ? impact.total_economic_impact_eur
      : 0
    totalCostEur += costEur

    // ── Open count ────────────────────────────────────────────────────────────
    if (row.status !== 'resolved' && row.status !== 'autopsy_complete') openCount++

    // ── Heatmaps ──────────────────────────────────────────────────────────────
    addToHeatMap(tenantMap,    row.tenant_id,            row, costEur)
    addToHeatMap(regionMap,    row.region   ?? 'unknown', row, costEur)
    addToHeatMap(subsystemMap, row.subsystem ?? 'unknown', row, costEur)

    // ── Classification frequency ──────────────────────────────────────────────
    if (row.classification) {
      classificationFreq.set(
        row.classification,
        (classificationFreq.get(row.classification) ?? 0) + 1,
      )
    }

    // ── Detection latency ─────────────────────────────────────────────────────
    // Auto-detected (has correlation via metrics_snapshot) → ~0 ms.
    // Manually reported (no metrics data) → estimate 300 000 ms (5 min).
    const hasMetrics = Object.keys(row.metrics_snapshot ?? {}).length > 0
    detectionLatencies.push(hasMetrics ? 0 : 300_000)

    // ── Resolution latency ────────────────────────────────────────────────────
    if (row.resolved_at) {
      const latency = new Date(row.resolved_at).getTime() - new Date(row.detected_at).getTime()
      if (latency >= 0) resolutionLatencies.push(latency)
    }

    // ── Propagation edges from causal_chain ───────────────────────────────────
    const causalChain = safeJsonb(row.causal_chain)
    if (causalChain) {
      let path: unknown
      try { path = causalChain.propagation_path } catch { path = undefined }

      if (Array.isArray(path)) {
        for (let i = 0; i < path.length - 1; i++) {
          const from = typeof path[i]     === 'string' ? (path[i] as string)     : null
          const to   = typeof path[i + 1] === 'string' ? (path[i + 1] as string) : null
          if (!from || !to) continue

          const edgeKey  = `${from}→${to}`
          const delayMs  = typeof causalChain.delay_ms === 'number' ? causalChain.delay_ms : 0
          const existing = edgeMap.get(edgeKey)
          if (!existing) {
            edgeMap.set(edgeKey, { count: 1, totalDelayMs: delayMs })
          } else {
            existing.count        += 1
            existing.totalDelayMs += delayMs
          }
        }
      }
    }
  }

  // ── Build propagation edges array ───────────────────────────────────────────
  const propagationEdges: FailurePropagationEdge[] = []
  for (const [edgeKey, { count, totalDelayMs }] of edgeMap.entries()) {
    const sep  = edgeKey.indexOf('→')
    const from = sep >= 0 ? edgeKey.slice(0, sep)    : edgeKey
    const to   = sep >= 0 ? edgeKey.slice(sep + '→'.length) : ''
    propagationEdges.push({
      from_subsystem: from,
      to_subsystem:   to,
      incident_count: count,
      avg_delay_ms:   count > 0 ? Math.round(totalDelayMs / count) : 0,
    })
  }
  propagationEdges.sort((a, b) => b.incident_count - a.incident_count)

  // ── Sort heatmap cells by incident_count desc ────────────────────────────────
  const sortCells = (cells: IncidentHeatCell[]): IncidentHeatCell[] =>
    cells.sort((a, b) => b.incident_count - a.incident_count)

  // ── Most common failure type ─────────────────────────────────────────────────
  let mostCommonFailureType: string | null = null
  let maxFreq = 0
  for (const [type, freq] of classificationFreq.entries()) {
    if (freq > maxFreq) { maxFreq = freq; mostCommonFailureType = type }
  }

  // ── Highest cost tenant ──────────────────────────────────────────────────────
  let highestCostTenant: string | null = null
  let highestCost = 0
  for (const cell of tenantMap.values()) {
    if (cell.total_cost_eur > highestCost) {
      highestCost       = cell.total_cost_eur
      highestCostTenant = cell.key
    }
  }

  // ── Assemble result ──────────────────────────────────────────────────────────
  const result: GlobalIncidentMap = {
    generated_at:              new Date().toISOString(),
    region:                    CURRENT_REGION,
    total_incidents:           rows.length,
    open_incidents:            openCount,
    by_tenant:                 sortCells([...tenantMap.values()]),
    by_region:                 sortCells([...regionMap.values()]),
    by_subsystem:              sortCells([...subsystemMap.values()]),
    total_cost_exposure_eur:   totalCostEur,
    highest_cost_tenant:       highestCostTenant,
    propagation_edges:         propagationEdges,
    avg_detection_latency_ms:  average(detectionLatencies),
    avg_resolution_latency_ms: resolutionLatencies.length > 0 ? average(resolutionLatencies) : null,
    most_common_failure_type:  mostCommonFailureType,
  }

  // ── Cache write (fire-and-forget) ────────────────────────────────────────────
  void cacheSet(CACHE_KEY, JSON.stringify(result), CACHE_TTL)

  return result
}
