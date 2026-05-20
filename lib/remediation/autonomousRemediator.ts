// =============================================================================
// Agency Group — Autonomous Remediator
// lib/remediation/autonomousRemediator.ts
//
// Defines all RemediationAction types and the action executor.
// All actions are logged, fail-open, and reversible where possible.
//
// TypeScript strict — 0 errors
// =============================================================================

import { randomUUID }       from 'crypto'
import { setLoadMode }      from '@/lib/runtime/loadGovernor'
import { requestApproval }  from '@/lib/governance/approvalFlow'
import { logAuditSync }     from '@/lib/audit/auditLogger'

// ─── Public types ─────────────────────────────────────────────────────────────

export type RemediationActionType =
  | 'ROLLBACK'        // revert to previous stable state via LoadMode + governance
  | 'THROTTLE'        // reduce request rate / AI token budget for tenant
  | 'REROUTE'         // shift traffic to fallback region/mode
  | 'SCALE_UP'        // increase concurrency limits (in LoadGovernor config)
  | 'ISOLATE_TENANT'  // set EMERGENCY mode for specific tenant
  | 'DISABLE_FEATURE' // disable a specific subsystem feature via Redis flag

export type ExecutionMode = 'AUTO' | 'MANUAL_APPROVAL'

export interface RemediationAction {
  action_id:       string              // `rem_${randomUUID()}`
  incident_id:     string
  action_type:     RemediationActionType
  target:          string              // tenant_id, region, or feature name (for DISABLE_FEATURE)
  tenant_id?:      string              // explicit tenant when target is NOT the tenant (e.g. DISABLE_FEATURE)
  confidence:      number              // 0-1: confidence this will fix the issue
  risk_score:      number              // 0-1: risk of making things worse
  expected_impact: string              // human-readable expected outcome
  execution_mode:  ExecutionMode
  created_at:      string
  executed_at:     string | null
  result:          RemediationResult | null
}

export interface RemediationResult {
  success:               boolean
  executed_at:           string
  duration_ms:           number
  outcome:               string        // what actually happened
  side_effects:          string[]      // unexpected but logged side effects
  requires_verification: boolean
}

// ─── Redis helpers (Upstash REST — same pattern as economicsCache / loadGovernor) ──

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

/**
 * XADD to a Redis Stream with MAXLEN trim.
 * Upstash REST: POST /xadd/<stream>/<id> with body fields array.
 */
async function redisXAdd(
  stream: string,
  fields: Record<string, string>,
): Promise<void> {
  const cfg = getRedisConfig()
  if (!cfg) return
  try {
    // Upstash pipeline — XADD with MAXLEN
    const args: (string | number)[] = [
      'XADD', stream,
      'MAXLEN', '~', 200,
      '*',
      ...Object.entries(fields).flat(),
    ]
    await fetch(
      `${cfg.url}/pipeline`,
      {
        method:  'POST',
        headers: {
          Authorization:  `Bearer ${cfg.token}`,
          'Content-Type': 'application/json',
        },
        body:   JSON.stringify([args]),
        signal: AbortSignal.timeout(500),
      },
    )
  } catch {
    // fail-open: stream write errors are non-critical
  }
}

/**
 * XRANGE from a Redis Stream.
 * Returns raw field entries in [{id, message}] format.
 */
async function redisXRange(
  stream: string,
  start: string,
  end: string,
  count?: number,
): Promise<Array<{ id: string; fields: Record<string, string> }>> {
  const cfg = getRedisConfig()
  if (!cfg) return []
  try {
    const countParam = count ? `/${count}` : ''
    const url = `${cfg.url}/xrange/${encodeURIComponent(stream)}/${encodeURIComponent(start)}/${encodeURIComponent(end)}${countParam}`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${cfg.token}` },
      signal:  AbortSignal.timeout(500),
    })
    if (!res.ok) return []
    const body = await res.json() as {
      result: Array<[string, string[]]> | null
    }
    if (!body.result) return []
    return body.result.map(([id, rawFields]) => {
      const fields: Record<string, string> = {}
      for (let i = 0; i < rawFields.length - 1; i += 2) {
        const k = rawFields[i]
        const v = rawFields[i + 1]
        if (k !== undefined && v !== undefined) fields[k] = v
      }
      return { id, fields }
    })
  } catch {
    return []
  }
}

// ─── Feature flag key ─────────────────────────────────────────────────────────

const FEATURE_FLAG_KEY = (feature: string, tenantId: string): string =>
  `feature_disabled:${tenantId}:${feature}`

// ─── Risk level helper ────────────────────────────────────────────────────────

type AuditRiskLevel = 'low' | 'medium' | 'high' | 'critical'

function actionRiskLevel(actionType: RemediationActionType): AuditRiskLevel {
  if (actionType === 'ISOLATE_TENANT' || actionType === 'ROLLBACK') return 'critical'
  if (actionType === 'THROTTLE'       || actionType === 'REROUTE')  return 'high'
  return 'medium'
}

// ─── Core executor ────────────────────────────────────────────────────────────

/**
 * Executes a RemediationAction and returns its RemediationResult.
 *
 * Each action type:
 *   - modifies system state (LoadMode, Redis flags)
 *   - logs to the SOC2 audit trail
 *   - appends to per-tenant remediation_log stream
 *
 * Fail-open: any unhandled exception returns { success: false }.
 */
export async function executeRemediationAction(
  action: RemediationAction,
): Promise<RemediationResult> {
  const startMs    = Date.now()
  const executedAt = new Date().toISOString()
  const tenantId   = action.target

  try {
    let result: RemediationResult

    // ── Per-action logic ───────────────────────────────────────────────────────
    switch (action.action_type) {

      case 'ROLLBACK': {
        await setLoadMode(tenantId, 'CRITICAL', 'auto:rollback')
        await redisSet(`rollback:active:${tenantId}`, action.incident_id, 3_600)
        await requestApproval({
          tenant_id:     tenantId,
          actor_id:      'system:remediator',
          action_type:   'deployment_rollback',
          resource_type: 'deployment',
          resource_id:   action.incident_id,
          risk_level:    'critical',
          description:   `Autonomous rollback triggered for incident ${action.incident_id}. System is in CRITICAL mode. Human approval required to execute deployment rollback.`,
          context: {
            action_id:   action.action_id,
            incident_id: action.incident_id,
            confidence:  action.confidence,
          },
        })
        result = {
          success:               true,
          executed_at:           executedAt,
          duration_ms:           Date.now() - startMs,
          outcome:               'System set to CRITICAL mode; deployment rollback queued for approval',
          side_effects:          [],
          requires_verification: true,
        }
        break
      }

      case 'THROTTLE': {
        await setLoadMode(tenantId, 'STRESSED', 'auto:throttle')
        const throttleFactor = '0.5'
        await redisSet(`throttle:${tenantId}`, throttleFactor, 1_800)
        result = {
          success:               true,
          executed_at:           executedAt,
          duration_ms:           Date.now() - startMs,
          outcome:               'Load mode set to STRESSED; rate limits halved',
          side_effects:          [],
          requires_verification: false,
        }
        break
      }

      case 'REROUTE': {
        await redisSet(`routing:${tenantId}:preferred_region`, 'fallback', 3_600)
        await setLoadMode(tenantId, 'STRESSED', 'auto:reroute')
        result = {
          success:               true,
          executed_at:           executedAt,
          duration_ms:           Date.now() - startMs,
          outcome:               'Traffic routing preference set to fallback region',
          side_effects:          [],
          requires_verification: false,
        }
        break
      }

      case 'SCALE_UP': {
        await redisSet(`scale_up:${tenantId}`, 'true', 1_800)
        result = {
          success:               true,
          executed_at:           executedAt,
          duration_ms:           Date.now() - startMs,
          outcome:               'Scale-up advisory stored; infrastructure scale-up requires manual action',
          side_effects:          [],
          requires_verification: true,
        }
        break
      }

      case 'ISOLATE_TENANT': {
        await setLoadMode(tenantId, 'EMERGENCY', 'auto:isolate')
        await redisSet(`tenant_isolated:${tenantId}`, 'true', 3_600)
        result = {
          success:               true,
          executed_at:           executedAt,
          duration_ms:           Date.now() - startMs,
          outcome:               'Tenant moved to EMERGENCY mode; all non-critical operations suspended',
          side_effects:          [],
          requires_verification: true,
        }
        break
      }

      case 'DISABLE_FEATURE': {
        // action.target is the FEATURE name to disable.
        // action.tenant_id is the tenant to disable it for; falls back to tenantId
        // only when tenant_id is explicitly set on the action (callers must provide it).
        const featureTenantId = action.tenant_id ?? tenantId
        const flagKey = FEATURE_FLAG_KEY(action.target, featureTenantId)
        await redisSet(flagKey, 'true', 7_200)
        result = {
          success:               true,
          executed_at:           executedAt,
          duration_ms:           Date.now() - startMs,
          outcome:               `Feature ${action.target} disabled for tenant ${featureTenantId}`,
          side_effects:          [],
          requires_verification: false,
        }
        break
      }

      default: {
        // Exhaustiveness guard
        const _exhaustive: never = action.action_type
        result = {
          success:               false,
          executed_at:           executedAt,
          duration_ms:           Date.now() - startMs,
          outcome:               `Unknown action type: ${String(_exhaustive)}`,
          side_effects:          [],
          requires_verification: false,
        }
      }
    }

    // ── Audit log ──────────────────────────────────────────────────────────────
    await logAuditSync({
      tenant_id:     tenantId,
      actor_id:      'system:remediator',
      actor_type:    'system',
      action:        'system:execute',
      resource_type: 'remediation_action',
      resource_id:   action.action_id,
      result:        result.success ? 'success' : 'error',
      risk_level:    actionRiskLevel(action.action_type),
      correlation_id: action.incident_id,
      metadata: {
        action_type:     action.action_type,
        target:          action.target,
        confidence:      action.confidence,
        risk_score:      action.risk_score,
        execution_mode:  action.execution_mode,
        outcome:         result.outcome,
        requires_verification: result.requires_verification,
      },
    }).catch((err: unknown) => {
      console.error('[autonomousRemediator] logAudit failed:', err instanceof Error ? err.message : err)
    })

    // ── Remediation stream ─────────────────────────────────────────────────────
    await redisXAdd(`remediation_log:${tenantId}`, {
      action_id:    action.action_id,
      incident_id:  action.incident_id,
      action_type:  action.action_type,
      target:       action.target,
      confidence:   String(action.confidence),
      risk_score:   String(action.risk_score),
      outcome:      result.outcome,
      executed_at:  executedAt,
      success:      String(result.success),
    })

    return result

  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.warn('[AutonomousRemediator] executeRemediationAction threw — fail-open:', errMsg)

    // Best-effort audit on failure
    await logAuditSync({
      tenant_id:     tenantId,
      actor_id:      'system:remediator',
      actor_type:    'system',
      action:        'system:execute',
      resource_type: 'remediation_action',
      resource_id:   action.action_id,
      result:        'error',
      risk_level:    actionRiskLevel(action.action_type),
      correlation_id: action.incident_id,
      metadata: { error: errMsg },
    }).catch((err: unknown) => {
      console.error('[autonomousRemediator] logAudit failed:', err instanceof Error ? err.message : err)
    })

    return {
      success:               false,
      executed_at:           new Date().toISOString(),
      duration_ms:           Date.now() - startMs,
      outcome:               errMsg,
      side_effects:          [],
      requires_verification: false,
    }
  }
}

// ─── History ──────────────────────────────────────────────────────────────────

/**
 * Returns past remediation actions for a tenant from the Redis stream.
 * Fail-open: returns [] on any error.
 *
 * @param tenantId  Tenant identifier
 * @param limit     Maximum entries to return (default 50)
 */
export async function getRemediationHistory(
  tenantId: string,
  limit = 50,
): Promise<RemediationAction[]> {
  try {
    const entries = await redisXRange(
      `remediation_log:${tenantId}`,
      '-',
      '+',
      limit,
    )

    return entries.map(({ id, fields }) => ({
      action_id:       fields['action_id']   ?? id,
      incident_id:     fields['incident_id'] ?? '',
      action_type:     (fields['action_type'] ?? 'THROTTLE') as RemediationActionType,
      target:          fields['target']       ?? '',
      confidence:      parseFloat(fields['confidence'] ?? '0'),
      risk_score:      parseFloat(fields['risk_score']  ?? '0'),
      expected_impact: fields['expected_impact'] ?? '',
      execution_mode:  (fields['execution_mode'] ?? 'MANUAL_APPROVAL') as ExecutionMode,
      created_at:      fields['created_at']  ?? new Date().toISOString(),
      executed_at:     fields['executed_at'] ?? null,
      result: fields['outcome'] !== undefined
        ? {
            success:               fields['success'] === 'true',
            executed_at:           fields['executed_at'] ?? new Date().toISOString(),
            duration_ms:           0,
            outcome:               fields['outcome'] ?? '',
            side_effects:          [],
            requires_verification: false,
          }
        : null,
    }))
  } catch {
    return []
  }
}

// ─── Feature flag check ───────────────────────────────────────────────────────

/**
 * Returns true when the Redis feature-disable flag is set for the given
 * feature + tenant combination.
 * Fail-open: returns false on any Redis error (feature assumed enabled).
 */
export async function isFeatureDisabled(
  feature:  string,
  tenantId: string,
): Promise<boolean> {
  try {
    const val = await redisGet(FEATURE_FLAG_KEY(feature, tenantId))
    return val !== null
  } catch {
    return false
  }
}

// ─── Factory helper ───────────────────────────────────────────────────────────

/**
 * Creates a new RemediationAction object with a generated action_id and
 * current timestamp. Does NOT execute it — call executeRemediationAction()
 * to run it.
 */
export function createRemediationAction(
  opts: Omit<RemediationAction, 'action_id' | 'created_at' | 'executed_at' | 'result'>,
): RemediationAction {
  return {
    ...opts,
    action_id:   `rem_${randomUUID()}`,
    created_at:  new Date().toISOString(),
    executed_at: null,
    result:      null,
  }
}
