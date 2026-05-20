// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — Incident Learning Loop
// lib/incidents/learningLoop.ts
//
// Learns from recurring incidents to improve system thresholds by:
//   1. Tracking incident recurrence counts per tenant + failure type in Redis
//   2. Storing human-readable threshold recommendations when recurrence > 3
//   3. Flagging P0 (critical) incidents for human review via approvalFlow
//
// IMPORTANT: This module NEVER modifies production config directly.
// Automated threshold changes require human approval.
// All Redis writes are recommendations only.
//
// TypeScript strict — 0 errors
// =============================================================================

import { requestApproval }  from '@/lib/governance/approvalFlow'
import type { IncidentRow } from './incidentIngestor'
import type { FailureType } from './failureClassifier'
import type { IncidentAutopsyReport } from './autopsyReport'

// ─── Public types ─────────────────────────────────────────────────────────────

export interface LearningUpdate {
  updated_at:          string
  failure_type:        FailureType
  adjustments_made:    string[]              // descriptions of what was updated
  thresholds_updated:  Record<string, { before: number; after: number }>
}

// ─── Redis helpers (Upstash REST — same pattern as loadGovernor.ts) ───────────

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

/**
 * INCR + EXPIRE atomically via Upstash pipeline.
 * Returns the new counter value, or null on failure.
 */
async function redisIncrWithExpire(
  key:        string,
  ttlSeconds: number,
): Promise<number | null> {
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
        body:   JSON.stringify([
          ['INCR', key],
          ['EXPIRE', key, ttlSeconds],
        ]),
        signal: AbortSignal.timeout(300),
      },
    )
    if (!res.ok) return null
    const body = await res.json() as [{ result: number }, { result: number }]
    return body[0]?.result ?? null
  } catch {
    return null
  }
}

// ─── Redis key builders ───────────────────────────────────────────────────────

/** Counter key — how many times this failure type has occurred for this tenant */
function counterKey(tenantId: string, failureType: FailureType): string {
  return `learning:${tenantId}:${failureType.toLowerCase()}:count`
}

/** Recommendation key — the stored threshold recommendation for this failure type */
function recommendationKey(tenantId: string, failureType: FailureType): string {
  return `learning:${tenantId}:${failureType.toLowerCase()}:recommendation`
}

// ─── Recommendation lookup — failure type → message ──────────────────────────

const RECURRENCE_RECOMMENDATIONS: Record<FailureType, string> = {
  LOAD_SPIKE:
    'Consider lowering STRESSED threshold to 400 rps',
  AI_COST_EXPLOSION:
    'Consider reducing max_concurrent_ai to 3 in STRESSED mode',
  QUEUE_OVERFLOW:
    'Consider enabling DLQ after 2 retries instead of 3',
  GRAPH_DEGRADATION:
    'Consider increasing HOT cache TTL from 30s to 60s and pre-warming adjacency cache',
  REGION_PARTITION:
    'Consider configuring automatic multi-region failover for primary region',
  DATA_INCONSISTENCY:
    'Consider reducing schema drift detection interval from 24h to 6h',
  DEPENDENCY_FAILURE:
    'Consider adding circuit breaker with 3-failure threshold and 30s half-open window',
  UNKNOWN:
    'Consider adding structured observability signals to improve automatic classification',
}

// ─── learnFromIncident ────────────────────────────────────────────────────────

/**
 * Processes a completed autopsy report to update the learning state.
 *
 * Steps:
 *  1. Increment the recurrence counter for (tenant, failure_type) in Redis.
 *     Counter TTL: 90 days (7_776_000 seconds).
 *  2. If recurrence count > 3: store a threshold recommendation in Redis.
 *     Recommendation TTL: 7 days (604_800 seconds).
 *  3. If P0 (severity = critical): call requestApproval() for human review.
 *
 * Returns a LearningUpdate describing what was stored.
 * Fail-open: never throws. Returns a minimal LearningUpdate on total failure.
 *
 * IMPORTANT: This function NEVER modifies production thresholds or config.
 *            It ONLY writes human-readable recommendations to Redis.
 */
export async function learnFromIncident(
  incident: IncidentRow,
  report:   IncidentAutopsyReport,
): Promise<LearningUpdate> {
  const failureType = report.classification
  const tenantId    = incident.tenant_id
  const adjustments: string[] = []

  // Redis TTLs
  const COUNTER_TTL_SECONDS      = 7_776_000  // 90 days
  const RECOMMENDATION_TTL_SECS  = 604_800    // 7 days

  // ── Step 1: Increment recurrence counter ──────────────────────────────────

  const cKey = counterKey(tenantId, failureType)
  const newCount = await redisIncrWithExpire(cKey, COUNTER_TTL_SECONDS)

  // Fallback: read current value if pipeline failed
  let effectiveCount = newCount
  if (effectiveCount === null) {
    const raw = await redisGet(cKey)
    effectiveCount = raw !== null ? parseInt(raw, 10) : null
    if (isNaN(effectiveCount as number)) effectiveCount = null
  }

  // ── Step 2: Store recommendation if recurrence > 3 ────────────────────────

  if (effectiveCount !== null && effectiveCount > 3) {
    const recommendation = RECURRENCE_RECOMMENDATIONS[failureType]
      ?? RECURRENCE_RECOMMENDATIONS.UNKNOWN

    const rKey = recommendationKey(tenantId, failureType)
    await redisSet(rKey, recommendation, RECOMMENDATION_TTL_SECS)

    adjustments.push(
      `Stored recommendation for ${failureType} after ${effectiveCount} occurrences: "${recommendation}"`,
    )
  } else if (effectiveCount !== null) {
    adjustments.push(
      `Incremented ${failureType} counter to ${effectiveCount} (threshold 3 not yet reached)`,
    )
  } else {
    adjustments.push(`Counted ${failureType} occurrence (Redis unavailable — count not persisted)`)
  }

  // ── Step 3: P0 approval request ───────────────────────────────────────────

  if (incident.severity === 'P0') {
    try {
      const approvalId = await requestApproval({
        tenant_id:     tenantId,
        actor_id:      'system:learning_loop',
        action_type:   `incident:${failureType}`,
        resource_type: 'incident',
        resource_id:   incident.incident_id,
        risk_level:    'high',
        description:   `P0 incident ${incident.incident_id} requires human review: ${report.root_cause}`,
        context:       { report: report as unknown as Record<string, unknown> },
      })
      adjustments.push(`P0 incident flagged for human review — approval request: ${approvalId}`)
    } catch (err) {
      console.warn('[learningLoop] requestApproval threw (fail-open):', err)
      adjustments.push('P0 incident approval request failed — incident still logged')
    }
  }

  // ── Assemble LearningUpdate ────────────────────────────────────────────────
  //
  // thresholds_updated is intentionally empty because this module never changes
  // production thresholds.  The field is present for consumers to inspect after
  // a human has approved and applied changes through the governance flow.

  return {
    updated_at:         new Date().toISOString(),
    failure_type:       failureType,
    adjustments_made:   adjustments,
    thresholds_updated: {},
  }
}

// ─── getLearningRecommendations ───────────────────────────────────────────────

/**
 * Reads all stored learning recommendations for a tenant.
 *
 * Uses the Upstash KEYS endpoint to scan for `learning:{tenantId}:*:recommendation`
 * then fetches each key's value individually.
 *
 * Returns a map of failure_type_lowercase → recommendation string.
 * Fail-open: returns {} on any error.
 *
 * NOTE: KEYS scans should only be used in non-hot-path contexts.
 *       This is an admin/diagnostic endpoint — not called per-request.
 */
export async function getLearningRecommendations(
  tenantId: string,
): Promise<Record<string, string>> {
  const cfg = getRedisConfig()
  if (!cfg) return {}

  try {
    // Upstash REST: GET /keys/{pattern}
    const pattern    = `learning:${tenantId}:*:recommendation`
    const keysRes    = await fetch(
      `${cfg.url}/keys/${encodeURIComponent(pattern)}`,
      {
        headers: { Authorization: `Bearer ${cfg.token}` },
        signal:  AbortSignal.timeout(500),
      },
    )

    if (!keysRes.ok) return {}

    const keysBody   = await keysRes.json() as { result: string[] | null }
    const keys       = keysBody.result ?? []

    if (keys.length === 0) return {}

    // Fetch all recommendation values in parallel (pipeline would be ideal for
    // large sets, but recommendation keys are bounded by FailureType count ≤ 8)
    const entries = await Promise.allSettled(
      keys.map(async (key) => {
        const val = await redisGet(key)
        // Extract failure type from key: learning:{tenant}:{type}:recommendation
        const parts = key.split(':')
        const typeSegment = parts[2] ?? 'unknown'
        return [typeSegment, val] as [string, string | null]
      }),
    )

    const result: Record<string, string> = {}
    for (const entry of entries) {
      if (entry.status === 'fulfilled') {
        const [typeSegment, val] = entry.value
        if (val !== null) {
          result[typeSegment] = val
        }
      }
    }

    return result
  } catch (err) {
    console.warn('[learningLoop] getLearningRecommendations error (fail-open):', err)
    return {}
  }
}
