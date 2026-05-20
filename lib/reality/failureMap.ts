// =============================================================================
// Agency Group — Reality Failure Map
// lib/reality/failureMap.ts
//
// REALITY_FAILURE_MAP — master aggregator of all reality layer modules.
// Synthesizes load, latency, stability, infra, and economics into a single
// system health score and classification.
//
// All module calls use Promise.allSettled — one module failure NEVER prevents
// the overall map from being produced.
//
// Transport  : Upstash Redis REST (GET/SET for caching the map)
// Cache key  : reality:failure_map:{tenant_id}   TTL 3600s
// Fail-open  : missing modules contribute score=50 (neutral / unknown)
//
// Weights:
//   load       20%
//   latency    20%
//   stability  20%
//   infra      25%
//   economics  15%
//
// TypeScript strict — 0 errors
// =============================================================================

import { getLoadStatus }                 from '@/lib/runtime/loadGovernor'
import type { LoadMode }                 from '@/lib/runtime/loadGovernor'
import { getLatencyTruthMap }            from '@/lib/reality/globalLatencyProfiler'
import { analyzeDrift }                  from '@/lib/reality/stabilityDriftEngine'
import { computeInfraOwnershipScore }    from '@/lib/reality/infraDependencyGraph'
import { analyzeEconomicDrift }          from '@/lib/reality/economicsDriftEngine'

// ─── Public Types ─────────────────────────────────────────────────────────────

export interface RealityFailureMap {
  generated_at:   string
  tenant_id:      string
  region:         string

  // Per-dimension scores (0–100)
  load_score:      number
  latency_score:   number
  stability_score: number
  infra_score:     number
  economics_score: number

  // Failure points discovered
  load_breakpoints:           string[]   // e.g. "System in STRESSED mode — max 500 req/min"
  region_failure_points:      string[]   // e.g. "Supabase p95 > 500ms"
  economic_collapse_points:   string[]   // e.g. "margin < 0 at cost_per_request > 0.05"
  graph_degradation_points:   string[]   // reserved for future graph profiler
  infra_dependency_risks:     string[]   // e.g. "Supabase is SPOF with no fallback"
  long_term_drift_signature:  string[]   // e.g. "queue_depth growing 15% per 24h"

  // Master score
  system_stability_score: number

  // Classification
  classification:       'STRIPE_AWS_LEVEL' | 'GLOBAL_PRODUCTION_READY' | 'STRONG_BUT_EXPOSED' | 'NOT_SAFE_FOR_GLOBAL_SCALE'
  classification_basis: string[]

  // Confidence
  data_confidence:        'high' | 'medium' | 'low'
  data_confidence_reason: string
}

// ─── Redis helpers ────────────────────────────────────────────────────────────

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
    // fail-open
  }
}

// ─── Score derivations ────────────────────────────────────────────────────────

function loadModeToScore(mode: LoadMode): number {
  const map: Record<LoadMode, number> = {
    NORMAL:    100,
    STRESSED:  70,
    CRITICAL:  40,
    EMERGENCY: 10,
  }
  return map[mode] ?? 50
}

function loadModeBreakpoints(mode: LoadMode, maxRpm: number): string[] {
  const points: string[] = []
  if (mode !== 'NORMAL') {
    points.push(`System in ${mode} mode — max ${maxRpm} req/min per tenant`)
  }
  if (mode === 'CRITICAL' || mode === 'EMERGENCY') {
    points.push('AI calls disabled — degraded feature set active')
  }
  if (mode === 'EMERGENCY') {
    points.push('DB writes suspended — static fallback only')
  }
  return points
}

type Classification = RealityFailureMap['classification']
type DataConfidence  = RealityFailureMap['data_confidence']

function classify(score: number): Classification {
  if (score >= 95) return 'STRIPE_AWS_LEVEL'
  if (score >= 90) return 'GLOBAL_PRODUCTION_READY'
  if (score >= 80) return 'STRONG_BUT_EXPOSED'
  return 'NOT_SAFE_FOR_GLOBAL_SCALE'
}

function buildClassificationBasis(
  score:          number,
  loadScore:      number,
  latencyScore:   number,
  stabilityScore: number,
  infraScore:     number,
  economicsScore: number,
): string[] {
  const basis: string[] = [`Composite score: ${score}/100`]

  if (loadScore < 60)      basis.push(`Load governor in degraded mode (load_score=${loadScore})`)
  if (latencyScore < 60)   basis.push(`Latency issues detected across regions (latency_score=${latencyScore})`)
  if (stabilityScore < 60) basis.push(`Significant drift detected in stability layer (stability_score=${stabilityScore})`)
  if (infraScore < 60)     basis.push(`Infrastructure dependency risks identified (infra_score=${infraScore})`)
  if (economicsScore < 60) basis.push(`Economics at risk — margin compression or collapse (economics_score=${economicsScore})`)

  if (basis.length === 1) {
    basis.push('All dimensions within acceptable ranges')
  }

  return basis
}

function computeDataConfidence(realModules: number): { confidence: DataConfidence; reason: string } {
  if (realModules >= 4) {
    return { confidence: 'high',   reason: `${realModules}/5 modules returned real data` }
  }
  if (realModules >= 2) {
    return { confidence: 'medium', reason: `${realModules}/5 modules returned real data — some falling back to neutral scores` }
  }
  return { confidence: 'low', reason: `Only ${realModules}/5 modules returned real data — most scores are estimated` }
}

// ─── Economics score helper ───────────────────────────────────────────────────

type CollapseRisk = 'low' | 'medium' | 'high' | 'critical'

function economicsScoreFromProfile(
  stabilityScore: number,
  collapseRisk:   CollapseRisk,
  driftEvents:    Array<{ description: string; type: string }>,
): { score: number; collapsePoints: string[] } {
  const riskPenalty: Record<CollapseRisk, number> = {
    low:      0,
    medium:  10,
    high:    25,
    critical: 40,
  }
  const score = Math.max(0, Math.min(100, stabilityScore - riskPenalty[collapseRisk]))
  const collapsePoints = driftEvents
    .filter(e => e.type === 'margin_compression' || e.type === 'revenue_gap')
    .slice(0, 3)
    .map(e => e.description)
  return { score, collapsePoints }
}

// ─── buildRealityFailureMap ────────────────────────────────────────────────────

/**
 * Calls all five reality modules with Promise.allSettled and synthesizes
 * results into a single RealityFailureMap.
 *
 * Any module that rejects contributes a neutral score of 50.
 */
export async function buildRealityFailureMap(tenantId: string): Promise<RealityFailureMap> {
  const now    = new Date().toISOString()
  const region = process.env.CURRENT_REGION ?? process.env.VERCEL_REGION ?? 'iad1'

  // ─── Fan out ───────────────────────────────────────────────────────────────
  const [
    loadResult,
    latencyResult,
    driftResult,
    infraResult,
    economicsResult,
  ] = await Promise.allSettled([
    getLoadStatus(region),
    getLatencyTruthMap(true),
    analyzeDrift(tenantId),
    computeInfraOwnershipScore(false),
    analyzeEconomicDrift(tenantId),
  ])

  let realModules = 0

  // ─── Load ─────────────────────────────────────────────────────────────────
  let loadScore      = 50
  let loadBreakpoints: string[] = []
  if (loadResult.status === 'fulfilled') {
    realModules++
    const ls   = loadResult.value
    loadScore  = loadModeToScore(ls.mode)
    loadBreakpoints = loadModeBreakpoints(ls.mode, ls.config.max_requests_per_min)
  }

  // ─── Latency ──────────────────────────────────────────────────────────────
  let latencyScore        = 50
  let regionFailurePoints: string[] = []
  if (latencyResult.status === 'fulfilled') {
    realModules++
    const lt        = latencyResult.value
    latencyScore    = lt.infra_score
    // Derive failure points from the summary
    if (lt.summary.overall_health !== 'healthy') {
      regionFailurePoints.push(
        `Infra health: ${lt.summary.overall_health} — slowest target: ${lt.summary.slowest_target}`,
      )
    }
    if (lt.summary.supabase_p95_ms > 500) {
      regionFailurePoints.push(`Supabase p95 = ${lt.summary.supabase_p95_ms}ms (threshold 500ms)`)
    }
    if (lt.summary.redis_p95_ms > 100) {
      regionFailurePoints.push(`Redis p95 = ${lt.summary.redis_p95_ms}ms (threshold 100ms)`)
    }
  }

  // ─── Stability Drift ──────────────────────────────────────────────────────
  let stabilityScore         = 50
  let longTermDriftSignature: string[] = []
  if (driftResult.status === 'fulfilled') {
    realModules++
    const dr           = driftResult.value
    stabilityScore     = dr.stability_score
    // Use alarmed signatures as drift indicators
    longTermDriftSignature = dr.signatures
      .filter(s => s.alarm)
      .slice(0, 5)
      .map(s => `${s.metric} drifting ${s.drift_pct.toFixed(1)}% (trend: ${s.trend})`)
    if (dr.recommendations.length > 0 && longTermDriftSignature.length === 0) {
      longTermDriftSignature = dr.recommendations.slice(0, 3)
    }
  }

  // ─── Infra Dependency Graph ────────────────────────────────────────────────
  let infraScore            = 50
  let infraDependencyRisks: string[] = []
  const graphDegradationPoints: string[] = []   // reserved for a future graph profiler
  if (infraResult.status === 'fulfilled') {
    realModules++
    const ig         = infraResult.value
    infraScore       = ig.score
    infraDependencyRisks = ig.risk_factors.slice(0, 5)
  }

  // ─── Economics ────────────────────────────────────────────────────────────
  let economicsScore          = 50
  let economicCollapsePoints: string[] = []
  if (economicsResult.status === 'fulfilled') {
    realModules++
    const ep = economicsResult.value
    const { score, collapsePoints } = economicsScoreFromProfile(
      ep.stability_score,
      ep.collapse_risk,
      ep.drift_events,
    )
    economicsScore         = score
    economicCollapsePoints = collapsePoints
  }

  // ─── Weighted composite ────────────────────────────────────────────────────
  // load 20%, latency 20%, stability 20%, infra 25%, economics 15%
  const systemScore = Math.round(
    loadScore      * 0.20 +
    latencyScore   * 0.20 +
    stabilityScore * 0.20 +
    infraScore     * 0.25 +
    economicsScore * 0.15,
  )

  const classification      = classify(systemScore)
  const classificationBasis = buildClassificationBasis(
    systemScore,
    loadScore,
    latencyScore,
    stabilityScore,
    infraScore,
    economicsScore,
  )

  const { confidence, reason } = computeDataConfidence(realModules)

  return {
    generated_at:              now,
    tenant_id:                 tenantId,
    region,
    load_score:                loadScore,
    latency_score:             latencyScore,
    stability_score:           stabilityScore,
    infra_score:               infraScore,
    economics_score:           economicsScore,
    load_breakpoints:          loadBreakpoints,
    region_failure_points:     regionFailurePoints,
    economic_collapse_points:  economicCollapsePoints,
    graph_degradation_points:  graphDegradationPoints,
    infra_dependency_risks:    infraDependencyRisks,
    long_term_drift_signature: longTermDriftSignature,
    system_stability_score:    systemScore,
    classification,
    classification_basis:      classificationBasis,
    data_confidence:           confidence,
    data_confidence_reason:    reason,
  }
}

// ─── getStoredFailureMap ──────────────────────────────────────────────────────

/**
 * Retrieves a previously stored RealityFailureMap from Redis.
 * Returns null if not found or parse fails.
 */
export async function getStoredFailureMap(tenantId: string): Promise<RealityFailureMap | null> {
  const key = `reality:failure_map:${tenantId}`
  const raw = await redisGet(key)
  if (raw === null) return null
  try {
    return JSON.parse(raw) as RealityFailureMap
  } catch {
    return null
  }
}

// ─── storeFailureMap ──────────────────────────────────────────────────────────

/**
 * Persists a RealityFailureMap to Redis with TTL=3600s.
 * Fire-and-forget — no caller should await this for correctness.
 */
export async function storeFailureMap(map: RealityFailureMap): Promise<void> {
  const key = `reality:failure_map:${map.tenant_id}`
  await redisSet(key, JSON.stringify(map), 3600)
}
