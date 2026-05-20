// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — Rollback Engine
// lib/remediation/rollbackEngine.ts
//
// Deployment state rewind and feature flag reversal.
// RULE: Only activates if causal confidence > 0.85
//
// Rollback targets are derived from the incident subsystem.
// - load_mode targets call setLoadMode() via the load governor.
// - feature_flag targets write/delete Redis keys to enable/disable features.
// - deployment targets are always skipped (irreversible) with a manual-action note.
//
// All Redis operations are fail-open. AbortSignal.timeout(500) on all calls.
// Rollback records are stored in Redis for 24 h (key: rollback:{rollback_id}).
// =============================================================================

import { randomUUID }        from 'crypto'
import { setLoadMode, type LoadMode } from '@/lib/runtime/loadGovernor'
import { type IncidentRow }  from '@/lib/incidents/incidentIngestor'

// ─── Public types ─────────────────────────────────────────────────────────────

export interface RollbackTarget {
  type:       'load_mode' | 'feature_flag' | 'deployment'
  target_id:  string    // tenantId, feature name, or deployment ID
  from_state: string    // current state
  to_state:   string    // target rolled-back state
  reversible: boolean
}

export interface RollbackResult {
  success:               boolean
  targets_rolled:        RollbackTarget[]
  targets_skipped:       Array<{ target: RollbackTarget; reason: string }>
  executed_at:           string
  duration_ms:           number
  verification_required: boolean
  rollback_id:           string  // stored in Redis for tracking
}

// ─── Redis helpers (Upstash REST — same pattern as economicsCache.ts) ─────────

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

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns true only when causal confidence exceeds the 0.85 threshold.
 * This is the ONLY gate for automatic rollback.
 */
export function canAutoRollback(causalConfidence: number): boolean {
  const allowed = causalConfidence > 0.85
  if (!allowed) {
    console.warn(
      `[RollbackEngine] canAutoRollback=false — confidence ${causalConfidence.toFixed(3)} ≤ 0.85. ` +
      'Manual intervention required.',
    )
  }
  return allowed
}

/**
 * Derives the set of rollback targets from the incident subsystem.
 *
 * Rules:
 *   subsystem=ai       → feature_flag  ai_burst_mode
 *   subsystem=graph    → feature_flag  graph_cold_queries
 *   subsystem=queue    → load_mode     STRESSED → NORMAL
 *   subsystem=region   → load_mode     current  → NORMAL
 *   subsystem=database → deployment    (reversible=false, skipped by executor)
 *   any                → load_mode     last-resort NORMAL target (appended)
 */
export function getRollbackTargets(incident: IncidentRow): RollbackTarget[] {
  const targets: RollbackTarget[] = []
  const tenantId = incident.tenant_id
  const currentLoadMode = (incident.metrics_snapshot.load_mode as LoadMode | undefined) ?? 'STRESSED'

  switch (incident.subsystem) {
    case 'ai':
      targets.push({
        type:       'feature_flag',
        target_id:  `${tenantId}:ai_burst_mode`,
        from_state: 'enabled',
        to_state:   'disabled',
        reversible: true,
      })
      break

    case 'graph':
      targets.push({
        type:       'feature_flag',
        target_id:  `${tenantId}:graph_cold_queries`,
        from_state: 'enabled',
        to_state:   'disabled',
        reversible: true,
      })
      break

    case 'queue':
      targets.push({
        type:       'load_mode',
        target_id:  tenantId,
        from_state: 'STRESSED',
        to_state:   'NORMAL',
        reversible: true,
      })
      break

    case 'region':
      targets.push({
        type:       'load_mode',
        target_id:  tenantId,
        from_state: currentLoadMode,
        to_state:   'NORMAL',
        reversible: true,
      })
      break

    case 'database':
      targets.push({
        type:       'deployment',
        target_id:  `deployment:${tenantId}:database`,
        from_state: 'current',
        to_state:   'previous',
        reversible: false,
      })
      break
  }

  // Last-resort: always append a load_mode → NORMAL target for any subsystem
  // unless we already added a load_mode target above
  const hasLoadModeTarget = targets.some(t => t.type === 'load_mode')
  if (!hasLoadModeTarget) {
    targets.push({
      type:       'load_mode',
      target_id:  tenantId,
      from_state: currentLoadMode,
      to_state:   'NORMAL',
      reversible: true,
    })
  }

  return targets
}

/**
 * Executes a rollback for the given incident.
 *
 * Gate: throws if causal confidence ≤ 0.85.
 *
 * For each target:
 *   - load_mode:    calls setLoadMode(to_state, 'auto:rollback')
 *   - feature_flag: DEL the feature_disabled:{tenantId}:{feature} key
 *                   (empty key = feature disabled; DEL = re-enable / rollback)
 *   - deployment:   always skipped — requires manual Vercel action
 *
 * Stores the full RollbackResult in Redis for 24 h (key: rollback:{rollback_id}).
 */
export async function executeRollback(
  incident:          IncidentRow,
  causalConfidence:  number,
): Promise<RollbackResult> {
  if (!canAutoRollback(causalConfidence)) {
    throw new Error(
      `[RollbackEngine] Confidence too low for auto-rollback: ${causalConfidence.toFixed(3)} ≤ 0.85`,
    )
  }

  const rollbackId  = randomUUID()
  const executedAt  = new Date().toISOString()
  const startMs     = Date.now()
  const targets     = getRollbackTargets(incident)
  const rolled:   RollbackTarget[]                           = []
  const skipped: Array<{ target: RollbackTarget; reason: string }> = []

  for (const target of targets) {
    try {
      if (target.type === 'load_mode') {
        // target_id for load_mode targets is the tenantId (set by getRollbackTargets)
        await setLoadMode(target.target_id, target.to_state as LoadMode, 'auto:rollback')
        rolled.push(target)

      } else if (target.type === 'feature_flag') {
        // target_id format: "{tenantId}:{featureName}"
        const [tenantId, ...featureParts] = target.target_id.split(':')
        const featureName = featureParts.join(':')
        // Rolling back = removing the "disabled" flag key → feature re-enabled
        const flagKey = `feature_disabled:${tenantId}:${featureName}`
        await redisDel(flagKey)
        rolled.push(target)

      } else if (target.type === 'deployment') {
        // Deployment rollbacks are never automatic
        skipped.push({
          target,
          reason: 'Deployment rollback requires manual action via Vercel dashboard',
        })
      }
    } catch (err) {
      // Fail-open per target: skip on unexpected error
      skipped.push({
        target,
        reason: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const durationMs = Date.now() - startMs

  // Non-deployment targets that failed = partial failure
  // (deployment targets are always skipped intentionally and do not count as failures)
  const nonDeployFailed = skipped.filter(s => s.target.type !== 'deployment').length
  if (nonDeployFailed > 0) {
    console.error('[rollback] PARTIAL ROLLBACK: some targets failed', skipped)
  }

  const result: RollbackResult = {
    success:               nonDeployFailed === 0 && rolled.length > 0,
    targets_rolled:        rolled,
    targets_skipped:       skipped,
    executed_at:           executedAt,
    duration_ms:           durationMs,
    verification_required: skipped.length > 0,
    rollback_id:           rollbackId,
  }

  // Persist rollback record for 24 h
  await redisSet(`rollback:${rollbackId}`, JSON.stringify(result), 86_400)

  return result
}

/**
 * Retrieves a previously stored rollback result by ID.
 * Returns null if not found or if Redis is unavailable.
 */
export async function getRollbackStatus(rollbackId: string): Promise<RollbackResult | null> {
  const raw = await redisGet(`rollback:${rollbackId}`)
  if (raw === null) return null
  try {
    return JSON.parse(raw) as RollbackResult
  } catch {
    return null
  }
}
