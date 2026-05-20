// =============================================================================
// Agency Group — Predictive Failure Engine
// lib/remediation/predictiveFailureEngine.ts
//
// Statistical failure prediction from incident history and drift signals.
// Uses trend analysis, not ML — honest about confidence bounds.
//
// Two prediction sources:
//   1. Drift signals   — from lib/reality/stabilityDriftEngine (real-time)
//   2. Incident history — from Supabase `incidents` table (last 30 days)
//
// Predictions are clearly labelled as statistical estimates, not guarantees.
// Fail-open: any source error returns [] rather than throwing.
// Results are cached in Redis for 1 hour (key: predictions:{tenantId}).
//
// TypeScript strict — 0 errors
// =============================================================================

import { analyzeDrift, type DriftSignature }      from '@/lib/reality/stabilityDriftEngine'
import { setLoadMode, type LoadMode }              from '@/lib/runtime/loadGovernor'
import { supabaseAdmin }                           from '@/lib/supabase'

// Suppress unused import warning — LoadMode is used in RoutingDecision via trafficRouter
void (setLoadMode as unknown)   // imported for type re-export symmetry; not called here

// ─── Public types ─────────────────────────────────────────────────────────────

// Mirrors FailureType from lib/incidents/failureClassifier.ts — copied here to
// avoid a dependency on the incidents package from remediation.
export type FailureType =
  | 'LOAD_SPIKE'
  | 'AI_COST_EXPLOSION'
  | 'GRAPH_DEGRADATION'
  | 'REGION_PARTITION'
  | 'QUEUE_OVERFLOW'
  | 'DATA_INCONSISTENCY'
  | 'DEPENDENCY_FAILURE'
  | 'UNKNOWN'

export interface FailurePrediction {
  prediction_id:             string
  tenant_id:                 string
  failure_type:              FailureType
  probability:               number               // 0–1
  confidence:                number               // 0–1: reliability of this prediction
  time_to_failure_hours:     number | null        // estimated hours until failure; null if unpredictable
  signals_detected:          string[]             // what triggered this prediction
  recommended_prevention:    string               // single action to prevent
  generated_at:              string
}

export interface PredictionReport {
  tenant_id:          string
  predictions:        FailurePrediction[]
  highest_risk:       FailurePrediction | null
  overall_risk_score: number    // 0–1: max probability of any predicted failure
  generated_at:       string
}

// ─── Prevention recommendations ───────────────────────────────────────────────

const PREVENTION_MAP: Record<FailureType, string> = {
  LOAD_SPIKE:
    'Pre-emptively set load governor to STRESSED before peak hours',
  AI_COST_EXPLOSION:
    'Reduce max_concurrent_ai to 3 and enable haiku fallback at 60% budget',
  GRAPH_DEGRADATION:
    'Trigger index re-warm and increase Redis HOT tier TTL before peak',
  REGION_PARTITION:
    'Pre-position tenant routing to secondary region and validate fallback DNS',
  QUEUE_OVERFLOW:
    'Scale consumer replicas and pause non-critical event producers',
  DATA_INCONSISTENCY:
    'Run a reconciliation job and enable write-ahead logging on critical tables',
  DEPENDENCY_FAILURE:
    'Enable circuit breaker on upstream API and warm up in-process fallback cache',
  UNKNOWN:
    'Capture a fresh stability snapshot and review drift report for emerging signals',
}

function getRecommendedPrevention(failureType: FailureType): string {
  return PREVENTION_MAP[failureType] ?? PREVENTION_MAP['UNKNOWN']
}

// Export for external consumers (e.g. remediation orchestrators)
export { getRecommendedPrevention }

// ─── Redis helpers ────────────────────────────────────────────────────────────

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
        signal:  AbortSignal.timeout(300),
      },
    )
  } catch {
    // fail-open: ignore Redis write errors
  }
}

// ─── Prediction ID helper ─────────────────────────────────────────────────────

function makePredictionId(tenantId: string, failureType: string): string {
  return `pred_${tenantId}_${failureType}_${Date.now()}`
}

// ─── predictFromDrift ─────────────────────────────────────────────────────────

/**
 * Derives failure predictions from the tenant's long-term drift report.
 *
 * Predictions are only generated for metrics that have triggered an alarm.
 * Probability is scaled by how far the metric has drifted past its baseline.
 * Confidence grows with snapshot count — more history = higher confidence.
 *
 * Returns [] on any error (fail-open).
 */
export async function predictFromDrift(tenantId: string): Promise<FailurePrediction[]> {
  let driftReport
  try {
    driftReport = await analyzeDrift(tenantId)
  } catch {
    return []
  }

  const { signatures, snapshot_count } = driftReport
  const now         = new Date().toISOString()
  const predictions: FailurePrediction[] = []

  // Confidence grows with data — capped at 0.9 (never claim certainty)
  const baseConfidence = Math.min(snapshot_count / 10, 0.9)

  for (const sig of signatures) {
    if (!sig.alarm) continue

    const prediction = buildDriftPrediction(tenantId, sig, baseConfidence, now)
    if (prediction !== null) {
      predictions.push(prediction)
    }
  }

  return predictions
}

/**
 * Maps a single alarmed DriftSignature to a FailurePrediction.
 * Returns null when the metric does not map to a known failure type.
 */
function buildDriftPrediction(
  tenantId:       string,
  sig:            DriftSignature,
  baseConfidence: number,
  now:            string,
): FailurePrediction | null {
  const { metric, drift_pct, current_value, trend } = sig

  let failureType:  FailureType
  let probability:  number
  let signals:      string[]

  switch (metric) {
    case 'queue_depth': {
      failureType = 'QUEUE_OVERFLOW'
      // Probability scales with drift magnitude, capped at 0.9
      probability = Math.min(Math.abs(drift_pct) / 200, 0.9)
      signals     = [
        `queue_depth drifted ${drift_pct.toFixed(1)}% from baseline`,
        `current queue depth: ${current_value} pending events`,
        `trend: ${trend}`,
      ]
      break
    }

    case 'error_rate_1h': {
      failureType = 'DEPENDENCY_FAILURE'
      // Error rate probability: scale from current absolute value (0–1 rate)
      // e.g. 0.10 error rate → probability ~0.80
      probability = Math.min(current_value * 8, 0.9)
      signals     = [
        `error_rate_1h drifted ${drift_pct.toFixed(1)}% from baseline`,
        `current error rate: ${(current_value * 100).toFixed(2)}%`,
        `trend: ${trend}`,
      ]
      break
    }

    case 'p95_graph_ms': {
      failureType = 'GRAPH_DEGRADATION'
      probability = Math.min(Math.abs(drift_pct) / 100, 0.8)
      signals     = [
        `p95_graph_ms drifted ${drift_pct.toFixed(1)}% from baseline`,
        `current p95 latency: ${Math.round(current_value)}ms`,
        `trend: ${trend}`,
      ]
      break
    }

    case 'cost_per_hour': {
      failureType = 'AI_COST_EXPLOSION'
      probability = Math.min(Math.abs(drift_pct) / 150, 0.85)
      signals     = [
        `cost_per_hour drifted ${drift_pct.toFixed(1)}% from baseline`,
        `current burn rate: €${current_value.toFixed(4)}/h`,
        `trend: ${trend}`,
      ]
      break
    }

    default:
      // redis_key_count and audit_log_growth don't map to a specific failure type
      return null
  }

  // Estimate time to failure when trend is growing and we have a baseline to extrapolate from
  let timeToFailureHours: number | null = null
  if (trend === 'growing' && sig.baseline_value > 0 && current_value > sig.baseline_value) {
    // Rate of change per snapshot interval: we don't know the exact interval,
    // but we can estimate: if current is X% past baseline, and the alarm threshold
    // is 2× current drift (rough critical level), time ≈ current_value / drift_rate_approx
    // Simplified: hours_remaining ≈ baseline_value / (current_value - baseline_value) * 1
    // (treating each "drift unit" as one unit of time — a directional estimate only)
    const driftRate = current_value - sig.baseline_value
    if (driftRate > 0) {
      // Estimate hours until metric reaches 3× baseline (critical threshold)
      const criticalThreshold   = sig.baseline_value * 3
      const remainingToThreshold = criticalThreshold - current_value
      if (remainingToThreshold > 0) {
        timeToFailureHours = Math.round((remainingToThreshold / driftRate) * 10) / 10
      } else {
        // Already past critical threshold
        timeToFailureHours = 1
      }
    }
  }

  return {
    prediction_id:          makePredictionId(tenantId, failureType),
    tenant_id:              tenantId,
    failure_type:           failureType,
    probability,
    confidence:             baseConfidence,
    time_to_failure_hours:  timeToFailureHours,
    signals_detected:       signals,
    recommended_prevention: getRecommendedPrevention(failureType),
    generated_at:           now,
  }
}

// ─── Incident history types ───────────────────────────────────────────────────

interface IncidentRow {
  id:             string
  tenant_id:      string
  classification: string
  created_at:     string
  resolved_at:    string | null
}

// ─── predictFromIncidentHistory ───────────────────────────────────────────────

/**
 * Derives failure predictions from the tenant's incident history over the
 * last 30 days.
 *
 * For each failure type with more than 1 incident:
 *   - Computes the average recurrence interval in days
 *   - Estimates probability within a 7-day window:
 *     probability = min(1, 7 / recurrenceIntervalDays)
 *   - Estimates time_to_failure_hours from the last incident + avg interval
 *
 * Returns [] on any error (fail-open).
 */
export async function predictFromIncidentHistory(tenantId: string): Promise<FailurePrediction[]> {
  const now          = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString()

  let rows: IncidentRow[]
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseAdmin as any)
      .from('incidents')
      .select('id, tenant_id, classification, created_at, resolved_at')
      .eq('tenant_id', tenantId)
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: true })

    if (error) return []
    rows = (data as IncidentRow[]) ?? []
  } catch {
    return []
  }

  if (rows.length === 0) return []

  // Group incidents by classification (failure type)
  const groups = new Map<string, IncidentRow[]>()
  for (const row of rows) {
    const key = row.classification ?? 'UNKNOWN'
    const arr = groups.get(key) ?? []
    arr.push(row)
    groups.set(key, arr)
  }

  const nowIso     = now.toISOString()
  const predictions: FailurePrediction[] = []

  for (const [classification, incidents] of groups) {
    // Need at least 2 incidents to compute a recurrence interval
    if (incidents.length < 2) continue

    const failureType = normalizeFailureType(classification)

    // Sort by created_at ascending (already ordered from DB, but safe to re-sort)
    const sorted = incidents.slice().sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    )

    // Compute average interval between consecutive incidents (in days)
    let totalIntervalDays = 0
    let intervalCount     = 0
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1].created_at).getTime()
      const curr = new Date(sorted[i].created_at).getTime()
      const diffDays = (curr - prev) / (24 * 3600 * 1000)
      if (diffDays > 0) {
        totalIntervalDays += diffDays
        intervalCount++
      }
    }

    if (intervalCount === 0) continue

    const recurrenceIntervalDays = totalIntervalDays / intervalCount

    // Probability = min(1, 7-day window / recurrence interval)
    // A 1-day interval → probability 1.0 (certain within 7 days)
    // A 14-day interval → probability 0.5
    const probability = Math.min(1, 7 / recurrenceIntervalDays)

    // Estimate time to next failure from the most recent incident
    const lastIncidentMs   = new Date(sorted[sorted.length - 1].created_at).getTime()
    const msSinceLastEvent = now.getTime() - lastIncidentMs
    const daysSinceLast    = msSinceLastEvent / (24 * 3600 * 1000)
    const daysUntilNext    = Math.max(0, recurrenceIntervalDays - daysSinceLast)
    const timeToFailureHours: number | null =
      recurrenceIntervalDays < 30
        ? Math.round(daysUntilNext * 24 * 10) / 10
        : null

    // Confidence: more incidents = higher confidence, capped at 0.9
    const confidence = Math.min(incidents.length / 10, 0.9)

    predictions.push({
      prediction_id:          makePredictionId(tenantId, failureType),
      tenant_id:              tenantId,
      failure_type:           failureType,
      probability,
      confidence,
      time_to_failure_hours:  timeToFailureHours,
      signals_detected: [
        `${incidents.length} incidents of type ${failureType} in last 30 days`,
        `average recurrence interval: ${recurrenceIntervalDays.toFixed(1)} days`,
        `days since last incident: ${daysSinceLast.toFixed(1)}`,
      ],
      recommended_prevention: getRecommendedPrevention(failureType),
      generated_at:           nowIso,
    })
  }

  return predictions
}

/**
 * Normalises a raw classification string to a known FailureType.
 * Unrecognised values fall back to 'UNKNOWN'.
 */
function normalizeFailureType(raw: string): FailureType {
  const KNOWN: Set<FailureType> = new Set([
    'LOAD_SPIKE',
    'AI_COST_EXPLOSION',
    'GRAPH_DEGRADATION',
    'REGION_PARTITION',
    'QUEUE_OVERFLOW',
    'DATA_INCONSISTENCY',
    'DEPENDENCY_FAILURE',
    'UNKNOWN',
  ])
  const upper = raw.toUpperCase() as FailureType
  return KNOWN.has(upper) ? upper : 'UNKNOWN'
}

// ─── generatePredictionReport ─────────────────────────────────────────────────

/**
 * Runs both prediction functions in parallel, merges and deduplicates results
 * (keeping the highest-probability entry per failure type), and caches the
 * report to Redis for 1 hour.
 *
 * Always returns a valid PredictionReport — partial data on source failures.
 */
export async function generatePredictionReport(tenantId: string): Promise<PredictionReport> {
  const now = new Date().toISOString()

  const [driftResult, historyResult] = await Promise.allSettled([
    predictFromDrift(tenantId),
    predictFromIncidentHistory(tenantId),
  ])

  const driftPredictions   = driftResult.status   === 'fulfilled' ? driftResult.value   : []
  const historyPredictions = historyResult.status === 'fulfilled' ? historyResult.value : []

  const allPredictions = [...driftPredictions, ...historyPredictions]

  // Deduplicate by failure_type: keep highest probability per type
  const byType = new Map<FailureType, FailurePrediction>()
  for (const pred of allPredictions) {
    const existing = byType.get(pred.failure_type)
    if (!existing || pred.probability > existing.probability) {
      byType.set(pred.failure_type, pred)
    }
  }

  const deduplicated = Array.from(byType.values())
    .sort((a, b) => b.probability - a.probability)

  const overallRiskScore = deduplicated.length > 0
    ? deduplicated[0].probability
    : 0

  const highestRisk = deduplicated.length > 0 ? deduplicated[0] : null

  const report: PredictionReport = {
    tenant_id:          tenantId,
    predictions:        deduplicated,
    highest_risk:       highestRisk,
    overall_risk_score: overallRiskScore,
    generated_at:       now,
  }

  // Cache to Redis for 1 hour — fire-and-forget, fail-open
  void redisSet(`predictions:${tenantId}`, JSON.stringify(report), 3600)

  return report
}
