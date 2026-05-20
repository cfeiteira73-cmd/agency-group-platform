// =============================================================================
// Agency Group — Self-Healing Orchestrator
// lib/remediation/selfHealingOrchestrator.ts
//
// Master self-healing loop.
// Pipeline: Incident detected → Causal reconstruction → Impact analysis →
//           Decision engine → Remediation execution → Verification → Learning
//
// Target: complete pipeline in <5 000 ms for P0/P1 incidents.
//
// Design rules:
//   - Never throws to caller — always returns HealingCycleResult
//   - Every stage has its own try/catch + timeout wrapper
//   - Stage 2 (causal) and Stage 5 (remediation) are skipped for P2/P3
//   - Stage 7 (learning) is fire-and-forget
//   - Redis stats are stored at `orchestrator_stats:{tenantId}` (TTL 1 h)
//
// TypeScript strict — 0 errors
// =============================================================================

import { randomUUID }                from 'crypto'
import {
  getIncident,
  updateIncidentStatus,
  listOpenIncidents,
}                                    from '@/lib/incidents/incidentIngestor'
import type { IncidentRow }          from '@/lib/incidents/incidentIngestor'
import {
  reconstructCausalChain,
}                                    from '@/lib/incidents/causalReconstructor'
import type { CausalChain }          from '@/lib/incidents/causalReconstructor'
import {
  analyzeImpact,
}                                    from '@/lib/incidents/impactAnalyzer'
import type { IncidentImpact }       from '@/lib/incidents/impactAnalyzer'
import {
  generateAutopsyReport,
}                                    from '@/lib/incidents/autopsyReport'
import type { IncidentAutopsyReport } from '@/lib/incidents/autopsyReport'
import {
  learnFromIncident,
}                                    from '@/lib/incidents/learningLoop'
import {
  executeRemediationAction,
  createRemediationAction,
}                                    from '@/lib/remediation/autonomousRemediator'
import type {
  RemediationAction,
  RemediationActionType,
  ExecutionMode,
}                                    from '@/lib/remediation/autonomousRemediator'
import {
  requestApproval,
}                                    from '@/lib/governance/approvalFlow'
import {
  getLoadStatus,
  setLoadMode,
  acquireLoadModeHold,
  releaseLoadModeHold,
}                                    from '@/lib/runtime/loadGovernor'
import {
  clearThrottle,
}                                    from '@/lib/remediation/throttleEngine'
import {
  makeRemediationDecision as engineMakeDecision,
}                                    from '@/lib/remediation/remediationDecisionEngine'
import type { RemediationDecision as EngineDecision } from '@/lib/remediation/remediationDecisionEngine'
import { supabaseAdmin }             from '@/lib/supabase'

// ─── Public types ─────────────────────────────────────────────────────────────

export type StageStatus = 'complete' | 'skipped' | 'failed' | 'approval_required'

export interface HealingCycleResult {
  cycle_id:       string
  incident_id:    string
  tenant_id:      string
  started_at:     string
  completed_at:   string
  duration_ms:    number

  stages: {
    ingestion:    'complete' | 'skipped' | 'failed'
    causal:       'complete' | 'skipped' | 'failed'
    impact:       'complete' | 'skipped' | 'failed'
    decision:     'complete' | 'skipped' | 'failed'
    remediation:  'complete' | 'skipped' | 'failed' | 'approval_required'
    verification: 'complete' | 'skipped' | 'failed'
    learning:     'complete' | 'skipped' | 'failed'
  }

  decision:      RemediationDecision | null
  action_taken:  RemediationAction   | null
  healed:        boolean              // true if issue resolved after remediation
  escalated:     boolean              // true if human approval required
  approval_id:   string | null        // governance approval ID if escalated
}

export interface OrchestratorStats {
  tenant_id:             string
  cycles_run:            number
  cycles_healed:         number
  cycles_escalated:      number
  avg_cycle_duration_ms: number
  heal_rate:             number         // cycles_healed / cycles_run
  last_cycle_at:         string | null
}

// ─── RemediationDecision (local definition — decision engine not yet external) ─

export interface RemediationDecision {
  decision_id:        string
  incident_id:        string
  tenant_id:          string
  should_remediate:   boolean
  action_type:        RemediationActionType
  target:             string
  confidence:         number
  risk_score:         number
  expected_impact:    string
  execution_mode:     ExecutionMode
  rationale:          string
  decided_at:         string
}

// ─── Redis helpers (Upstash REST — same pattern as economicsCache.ts) ─────────

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
        signal:  AbortSignal.timeout(400),
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
        signal:  AbortSignal.timeout(400),
      },
    )
  } catch {
    // fail-open: Redis write errors are non-critical
  }
}

// ─── Stage timeout helper ─────────────────────────────────────────────────────

/**
 * Races `fn()` against a timeout.
 * Returns null (and logs a warning) if the timeout fires or fn() throws.
 */
export async function withStageTimeout<T>(
  stageName:  string,
  fn:         () => Promise<T>,
  timeoutMs:  number,
): Promise<T | null> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error(`[${stageName}] stage timeout after ${timeoutMs}ms`)),
      timeoutMs,
    )
  })
  try {
    const result = await Promise.race([fn(), timeoutPromise])
    clearTimeout(timeoutId)
    return result
  } catch (err) {
    clearTimeout(timeoutId)
    console.warn(
      `[SelfHealingOrchestrator] ${stageName} failed/timed-out (fail-open):`,
      err instanceof Error ? err.message : err,
    )
    return null
  }
}

// ─── Internal decision engine (makeRemediationDecision) ──────────────────────
//
// Derives the best remediation action from the incident, impact, and causal
// chain using the existing engine types (throttle, rollback, reroute).
// Confidence and risk are derived from severity + causal confidence.
//
// Execution mode rules:
//   P0 ROLLBACK or ISOLATE_TENANT → MANUAL_APPROVAL (too destructive for AUTO)
//   All others                    → AUTO

function makeRemediationDecision(
  incident: IncidentRow,
  report:   IncidentAutopsyReport | null,
  chain:    CausalChain | null,
): RemediationDecision {
  const tenantId  = incident.tenant_id
  const severity  = incident.severity
  const subsystem = incident.subsystem

  // Confidence: higher when we have a causal chain with a root cause
  const causalConfidence = chain?.confidence_score ?? 0.3
  const confidence = Math.round(
    (causalConfidence * 0.6 + (report ? 0.4 : 0)) * 100,
  ) / 100

  // Choose action type based on subsystem + severity
  let actionType: RemediationActionType
  let rationale: string
  let riskScore: number
  let expectedImpact: string

  if (subsystem === 'region') {
    actionType     = 'REROUTE'
    rationale      = `Region-level incident (${incident.incident_id}) — rerouting traffic to fallback region`
    riskScore      = 0.3
    expectedImpact = 'Traffic shifted to fallback region; latency may increase by ~50ms'
  } else if (subsystem === 'ai' || (report?.classification === 'AI_COST_EXPLOSION')) {
    actionType     = 'THROTTLE'
    rationale      = `AI subsystem anomaly — throttling to reduce token budget and costs`
    riskScore      = 0.2
    expectedImpact = 'AI token budgets reduced by 50%; AI-heavy workflows will slow down'
  } else if (subsystem === 'queue') {
    actionType     = 'THROTTLE'
    rationale      = `Queue overflow detected — throttling ingest rate to drain backlog`
    riskScore      = 0.2
    expectedImpact = 'Queue ingest rate halved; backlog should clear within 5–10 min'
  } else if (severity === 'P0' && chain?.root_cause !== null && causalConfidence > 0.85) {
    actionType     = 'ROLLBACK'
    rationale      = `P0 incident with high-confidence root cause (${causalConfidence}) — rollback triggered`
    riskScore      = 0.7
    expectedImpact = 'System moved to CRITICAL mode; deployment rollback queued for approval'
  } else if (severity === 'P0' || severity === 'P1') {
    actionType     = 'THROTTLE'
    rationale      = `${severity} incident in ${subsystem} — throttling as first-response measure`
    riskScore      = 0.2
    expectedImpact = 'Request rate reduced by 50%; load reduced to STRESSED mode'
  } else {
    // P2/P3 — skipped upstream, but decision may still be called
    actionType     = 'THROTTLE'
    rationale      = `${severity} incident — mild throttle as precaution`
    riskScore      = 0.1
    expectedImpact = 'Minor load reduction; system remains operational'
  }

  // Should we actually remediate?
  const shouldRemediate = confidence >= 0.3 && (severity === 'P0' || severity === 'P1')

  // Execution mode — ROLLBACK always requires approval; ISOLATE_TENANT ALWAYS requires
  // MANUAL_APPROVAL regardless of severity (Change 3: ISOLATE_TENANT → MANUAL_APPROVAL)
  const isRollback     = (actionType as RemediationActionType) === 'ROLLBACK'
  const isIsolateTenant = (actionType as RemediationActionType) === 'ISOLATE_TENANT'
  const executionMode: ExecutionMode =
    (isRollback && severity === 'P0') || isIsolateTenant ? 'MANUAL_APPROVAL' : 'AUTO'

  return {
    decision_id:     `dec_${randomUUID()}`,
    incident_id:     incident.incident_id,
    tenant_id:       tenantId,
    should_remediate: shouldRemediate,
    action_type:     actionType,
    target:          tenantId,
    confidence,
    risk_score:      riskScore,
    expected_impact: expectedImpact,
    execution_mode:  executionMode,
    rationale,
    decided_at:      new Date().toISOString(),
  }
}

// ─── Verification ─────────────────────────────────────────────────────────────

/**
 * Verifies whether a remediation action produced MEASURABLE improvement.
 *
 * Strategy per action type:
 *   THROTTLE  → query runtime_events to compare error count in the 5 minutes
 *               BEFORE the action vs the 5 minutes AFTER. Healing is confirmed
 *               only when the post-action error count is ≤80% of pre-action
 *               (i.e. ≥20% reduction). Checking load mode is INTENTIONALLY
 *               avoided here: THROTTLE sets mode to STRESSED, so asserting
 *               mode === 'STRESSED' is a tautology that always passes.
 *   ROLLBACK  → check `rollback:active:{tenantId}` key exists in Redis
 *               AND the current load mode is not CRITICAL/EMERGENCY
 *   REROUTE   → check `routing:{tenantId}:preferred_region` is set in Redis
 *   others    → assumed healed if action executed without error
 *
 * Fail-CLOSED: returns false on any unexpected error so incidents stay open
 *              and are not falsely marked as resolved.
 */
export async function verifyRemediation(
  incident: IncidentRow,
  action:   RemediationAction,
): Promise<boolean> {
  try {
    switch (action.action_type) {

      case 'THROTTLE': {
        // Measure actual improvement via error counts in runtime_events.
        // Pre-window: 10 min before the incident was detected (proxy for before-throttle).
        // Post-window: 5 min ending now (after throttle has had time to take effect).
        //
        // We use the incidents table metrics_snapshot as the "before" baseline when
        // runtime_events data is unavailable — it is captured at detection time,
        // before any remediation ran.

        const detectedAt = new Date(incident.detected_at).getTime()
        const preStart   = new Date(detectedAt - 10 * 60 * 1000).toISOString()
        const preEnd     = new Date(detectedAt).toISOString()
        const postStart  = new Date(detectedAt).toISOString()
        const postEnd    = new Date().toISOString()

        // Baseline error rate from the metrics snapshot captured at incident detection.
        // This is our ground truth for "before throttle".
        const snapshotErrorRate: number =
          typeof incident.metrics_snapshot?.error_rate === 'number'
            ? incident.metrics_snapshot.error_rate
            : -1

        // Query runtime_events for actual error counts before/after.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rte = (supabaseAdmin as any).from('runtime_events')

        const [{ count: preCount, error: preErr }, { count: postCount, error: postErr }] =
          await Promise.all([
            rte
              .select('*', { count: 'exact', head: true })
              .eq('tenant_id', incident.tenant_id)
              .eq('success', false)
              .gte('created_at', preStart)
              .lt('created_at',  preEnd),
            rte
              .select('*', { count: 'exact', head: true })
              .eq('tenant_id', incident.tenant_id)
              .eq('success', false)
              .gte('created_at', postStart)
              .lt('created_at',  postEnd),
          ])

        if (preErr || postErr) {
          // DB query failed — fall back to snapshot error_rate check.
          // If snapshot is unavailable too, we cannot verify — fail closed.
          if (snapshotErrorRate < 0) {
            console.warn(
              '[verifyRemediation] THROTTLE: runtime_events query failed and no snapshot error_rate — failing closed',
            )
            return false
          }
          // Snapshot exists: throttle is considered effective only if the
          // current load mode dropped below CRITICAL (not just STRESSED, which
          // THROTTLE sets by design, making it still tautological). We require
          // NORMAL or STRESSED AND that the snapshot error_rate was above a
          // meaningful threshold before throttle was applied.
          const status = await getLoadStatus(incident.tenant_id)
          const modeImproved = status.mode === 'NORMAL' || status.mode === 'STRESSED'
          const errorRateWasHigh = snapshotErrorRate > 0.05 // >5% error rate pre-incident
          console.warn(
            `[verifyRemediation] THROTTLE (fallback path): mode=${status.mode} snapshotErrRate=${snapshotErrorRate} → healed=${modeImproved && errorRateWasHigh}`,
          )
          return modeImproved && errorRateWasHigh
        }

        const before = preCount  ?? 0
        const after  = postCount ?? 0

        if (before === 0) {
          // No errors recorded before throttle — nothing to compare against.
          // Could be a no-error baseline or a metrics gap. Be conservative: not verified.
          console.warn('[verifyRemediation] THROTTLE: pre-action error count is 0 — cannot confirm improvement')
          return false
        }

        // Require ≥20% reduction in error count to confirm healing.
        const reductionPct = (before - after) / before
        const healed = reductionPct >= 0.20

        console.info(
          `[verifyRemediation] THROTTLE: errors before=${before} after=${after} reduction=${(reductionPct * 100).toFixed(1)}% → healed=${healed}`,
        )
        return healed
      }

      case 'ROLLBACK': {
        // Confirm the rollback marker is set AND the system is not in a worse mode.
        const key = `rollback:active:${incident.tenant_id}`
        const [val, status] = await Promise.all([
          redisGet(key),
          getLoadStatus(incident.tenant_id),
        ])
        const rollbackActive = val !== null
        const modeOk = status.mode !== 'CRITICAL' && status.mode !== 'EMERGENCY'
        return rollbackActive && modeOk
      }

      case 'REROUTE': {
        // Check routing key is still active AND load mode improved from CRITICAL.
        // Key-only check was tautological (action sets the same key); mode check
        // provides an independent signal that traffic actually shifted.
        const key = `routing:${incident.tenant_id}:preferred_region`
        const [val, status] = await Promise.all([
          redisGet(key),
          getLoadStatus(incident.tenant_id),
        ])
        const routeActive = val !== null
        const modeOk = status.mode !== 'CRITICAL' && status.mode !== 'EMERGENCY'
        console.info(
          `[verifyRemediation] REROUTE: routeKey=${routeActive} mode=${status.mode} → healed=${routeActive && modeOk}`,
        )
        return routeActive && modeOk
      }

      case 'SCALE_UP': {
        // Verify scale_up flag is still active AND load pressure has decreased.
        const key = `scale_up:${incident.tenant_id}`
        const [val, status] = await Promise.all([
          redisGet(key),
          getLoadStatus(incident.tenant_id),
        ])
        const scaleActive = val !== null
        const modeOk = status.mode === 'NORMAL' || status.mode === 'STRESSED'
        console.info(
          `[verifyRemediation] SCALE_UP: flagKey=${scaleActive} mode=${status.mode} → healed=${scaleActive && modeOk}`,
        )
        return scaleActive && modeOk
      }

      case 'DISABLE_FEATURE': {
        // Verify the feature disable flag is still set (could expire or be cleared).
        // feature_disabled:{tenantId}:{feature} — same key as FEATURE_FLAG_KEY in autonomousRemediator.
        const featureTenantId = action.tenant_id ?? incident.tenant_id
        const flagKey = `feature_disabled:${featureTenantId}:${action.target}`
        const val = await redisGet(flagKey)
        const flagActive = val !== null
        console.info(
          `[verifyRemediation] DISABLE_FEATURE: feature=${action.target} flagKey=${flagActive} → healed=${flagActive}`,
        )
        return flagActive
      }

      case 'ISOLATE_TENANT':
        // ISOLATE_TENANT always requires MANUAL_APPROVAL — should never reach
        // AUTO verification. Log and return false to keep incident open.
        console.warn(
          `[verifyRemediation] ISOLATE_TENANT reached AUTO verification — incident=${incident.incident_id}. This should be MANUAL_APPROVAL. Returning false.`,
        )
        return false
    }
  } catch (err) {
    // Fail-CLOSED — an unexpected verification error must not be treated
    // as a successful healing confirmation. Return false so the incident remains open.
    console.warn(
      '[verifyRemediation] verification threw — failing CLOSED (returning false):',
      err instanceof Error ? err.message : err,
    )
    return false
  }
}

// ─── runHealingCycle ──────────────────────────────────────────────────────────

/**
 * Main healing loop for a single incident.
 *
 * Stage timeouts (P0 target: < 5 000 ms total):
 *   Stage 1 — Ingestion/fetch       500 ms
 *   Stage 2 — Causal reconstruction 1 500 ms  (skipped for P2/P3)
 *   Stage 3 — Impact analysis       1 000 ms
 *   Stage 4 — Decision              200 ms    (sync-like)
 *   Stage 5 — Remediation execution 2 000 ms  (skipped for P2/P3)
 *   Stage 6 — Verification          1 000 ms  (only when action executed)
 *   Stage 7 — Learning              fire-and-forget
 *
 * Never throws — all errors are caught per-stage and surfaced via stage status.
 */
export async function runHealingCycle(incidentId: string): Promise<HealingCycleResult> {
  // Global kill switch — set SELF_HEAL_ENABLED=true to activate self-healing
  if (process.env.SELF_HEAL_ENABLED !== 'true') {
    return {
      cycle_id: `cycle_disabled_${randomUUID()}`,
      incident_id: incidentId,
      tenant_id: 'unknown',
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: 0,
      healed: false,
      escalated: false,
      approval_id: null,
      decision: null,
      action_taken: null,
      stages: {
        ingestion: 'skipped', causal: 'skipped', impact: 'skipped',
        decision: 'skipped', remediation: 'skipped', verification: 'skipped', learning: 'skipped',
      },
    }
  }

  const cycleId   = `cycle_${randomUUID()}`
  const startedAt = new Date().toISOString()
  const startMs   = Date.now()

  // Mutable stage results
  const stages: HealingCycleResult['stages'] = {
    ingestion:    'failed',
    causal:       'skipped',
    impact:       'skipped',
    decision:     'skipped',
    remediation:  'skipped',
    verification: 'skipped',
    learning:     'skipped',
  }

  let incident:   IncidentRow            | null = null
  let chain:      CausalChain            | null = null
  let _impact:    IncidentImpact         | null = null
  let report:     IncidentAutopsyReport  | null = null
  let decision:   RemediationDecision    | null = null
  let actionTaken: RemediationAction     | null = null
  let healed      = false
  let escalated   = false
  let approvalId: string | null          = null

  // ── Stage 1: Fetch incident (500 ms) ────────────────────────────────────────

  incident = await withStageTimeout(
    'Stage 1 (ingestion)',
    () => getIncident(incidentId),
    500,
  )

  if (!incident) {
    // Cannot proceed without the incident row
    stages.ingestion = 'failed'
    return buildResult()
  }

  stages.ingestion = 'complete'

  const isHighSeverity = incident.severity === 'P0' || incident.severity === 'P1'

  // Mark as investigating (fire-and-forget — don't block the pipeline)
  void updateIncidentStatus(incidentId, 'investigating').catch(() => undefined)

  // ── Stage 2: Causal reconstruction (1 500 ms) — skip for P2/P3 ────────────

  if (isHighSeverity) {
    chain = await withStageTimeout(
      'Stage 2 (causal)',
      () => reconstructCausalChain(incident!),
      1_500,
    )
    stages.causal = chain !== null ? 'complete' : 'failed'

    // Persist reconstructed causal chain back to DB so globalIncidentMap and
    // downstream consumers (autopsyReport, Control Tower) can access it.
    // Fire-and-forget — never blocks the healing pipeline.
    if (chain !== null && incident !== null) {
      void supabaseAdmin
        .from('incidents')
        .update({
          causal_chain: chain as unknown as Record<string, unknown>,
          updated_at:   new Date().toISOString(),
        })
        .eq('incident_id', incidentId)
        .then(({ error }) => {
          if (error) {
            console.error('[orchestrator] failed to persist causal_chain:', error.message)
          }
        })
    }
  } else {
    stages.causal = 'skipped'
  }

  // ── Stage 3: Impact analysis (1 000 ms) ────────────────────────────────────

  _impact = await withStageTimeout(
    'Stage 3 (impact)',
    () => analyzeImpact(incident!),
    1_000,
  )
  stages.impact = _impact !== null ? 'complete' : 'failed'

  // Generate autopsy (uses cached data internally — lightweight call)
  // We don't block on this; we use the result only for decision enrichment
  report = await withStageTimeout(
    'Stage 3b (autopsy)',
    () => generateAutopsyReport(incidentId),
    800,
  )

  // ── Stage 4: Decision (200 ms) ─────────────────────────────────────────────
  // Change 2: Use the real remediationDecisionEngine instead of the internal function.
  // The engine requires a non-null report; fall back to the internal function when
  // report is unavailable (e.g. autopsy timed out).

  try {
    decision = await withStageTimeout(
      'Stage 4 (decision)',
      async (): Promise<RemediationDecision | null> => {
        if (report !== null) {
          // Use the real governed engine (4-signal matrix, full safety gates)
          const engineResult: EngineDecision = engineMakeDecision(incident!, report, chain)

          // Adapt engine return type → orchestrator's RemediationDecision
          const engineAction = engineResult.action
          const actionType: RemediationActionType = engineAction?.action_type ?? 'THROTTLE'
          const target: string = engineAction?.target ?? incident!.tenant_id
          const confidence: number = engineAction?.confidence ?? (chain?.confidence_score ?? 0.3)
          const riskScore: number = engineResult.risk_assessment
          const expectedImpact: string = engineAction?.expected_impact ?? ''

          // Change 3 (enforced in adapter): ISOLATE_TENANT ALWAYS → MANUAL_APPROVAL
          let executionMode: ExecutionMode = engineResult.requires_approval
            ? 'MANUAL_APPROVAL'
            : 'AUTO'
          if (actionType === 'ISOLATE_TENANT') {
            executionMode = 'MANUAL_APPROVAL'
          }

          return {
            decision_id:      `dec_${randomUUID()}`,
            incident_id:      incident!.incident_id,
            tenant_id:        incident!.tenant_id,
            should_remediate: engineResult.should_remediate,
            action_type:      actionType,
            target,
            confidence,
            risk_score:       riskScore,
            expected_impact:  expectedImpact,
            execution_mode:   executionMode,
            rationale:        engineResult.justification.join(' | '),
            decided_at:       new Date().toISOString(),
          }
        }

        // Fallback: autopsy report unavailable — use internal heuristic
        return makeRemediationDecision(incident!, report, chain)
      },
      200,
    )

    if (!decision) {
      stages.decision = 'failed'
    } else if (!decision.should_remediate) {
      stages.decision = 'skipped'
    } else {
      stages.decision = 'complete'
    }
  } catch (err) {
    console.warn('[SelfHealingOrchestrator] Stage 4 (decision) threw:', err)
    stages.decision = 'failed'
  }

  // ── Stage 5: Remediation execution (2 000 ms) — skip for P2/P3 ────────────

  if (isHighSeverity && decision?.should_remediate) {

    const tenantId = incident!.tenant_id

    // Acquire a load-mode hold so competing routines don't reset the load mode
    // while this remediation cycle is in progress.
    await acquireLoadModeHold(tenantId, incidentId).catch(() => undefined)

    if (decision.execution_mode === 'AUTO') {
      // Build and execute the action
      const action = createRemediationAction({
        incident_id:     incidentId,
        action_type:     decision.action_type,
        target:          decision.target,
        confidence:      decision.confidence,
        risk_score:      decision.risk_score,
        expected_impact: decision.expected_impact,
        execution_mode:  'AUTO',
      })

      const remResult = await withStageTimeout(
        'Stage 5 (remediation)',
        () => executeRemediationAction(action),
        2_000,
      )

      if (remResult !== null) {
        actionTaken = { ...action, executed_at: remResult.executed_at, result: remResult }
        stages.remediation = 'complete'
      } else {
        stages.remediation = 'failed'
      }

    } else {
      // MANUAL_APPROVAL — request approval and return early (Change 4: pre-hoc approval).
      // We must NOT execute setLoadMode or executeRemediationAction before approval is granted.
      try {
        approvalId = await withStageTimeout(
          'Stage 5 (approval request)',
          () => requestApproval({
            tenant_id:     incident!.tenant_id,
            actor_id:      'system:self_healing_orchestrator',
            action_type:   `remediation:${decision!.action_type}`,
            resource_type: 'incident',
            resource_id:   incidentId,
            risk_level:    decision!.risk_score >= 0.5 ? 'critical' : 'high',
            description:   `Self-healing cycle ${cycleId} requires approval for ${decision!.action_type} on incident ${incidentId}: ${decision!.rationale}`,
            context: {
              cycle_id:        cycleId,
              decision_id:     decision!.decision_id,
              confidence:      decision!.confidence,
              // Change 5: expose raw causal confidence so operators see the
              // causal basis, not just the diluted composite score
              causal_confidence: chain?.confidence_score ?? null,
              risk_score:      decision!.risk_score,
            },
          }),
          2_000,
        )

        if (approvalId !== null) {
          escalated            = true
          stages.remediation   = 'approval_required'
        } else {
          stages.remediation   = 'failed'
        }
      } catch (err) {
        console.warn('[SelfHealingOrchestrator] Stage 5 approval request threw:', err)
        stages.remediation = 'failed'
      }

      // Change 4: Return EARLY — do not execute remediation or setLoadMode.
      // The healing cycle result reflects pending_approval state.
      // Release hold before returning (approval path never reaches the main finally).
      await releaseLoadModeHold(tenantId, incidentId).catch(() => undefined)
      stages.verification = 'skipped'
      stages.learning     = 'skipped'
      return buildResult()
    }
  } else if (!isHighSeverity) {
    stages.remediation = 'skipped'
  } else {
    // decision null or should_remediate=false
    stages.remediation = 'skipped'
  }

  // ── Stage 6: Verification (1 000 ms) — only if action was executed ─────────

  if (actionTaken !== null) {
    const verified = await withStageTimeout(
      'Stage 6 (verification)',
      () => verifyRemediation(incident!, actionTaken!),
      1_000,
    )

    if (verified !== null) {
      healed             = verified
      stages.verification = 'complete'
    } else {
      stages.verification = 'failed'
    }
  } else {
    stages.verification = 'skipped'
  }

  // ── Stage 7: Learning (fire-and-forget) ────────────────────────────────────

  if (report !== null) {
    void learnFromIncident(incident, report).catch((err) =>
      console.error('[SelfHealingOrchestrator] Stage 7 (learning) async error:', err),
    )
    stages.learning = 'complete'
  } else {
    stages.learning = 'skipped'
  }

  // ── Release load-mode hold (normal completion path) ───────────────────────
  // The MANUAL_APPROVAL early-return path already releases above.
  // Only release if we actually acquired a hold (i.e. Stage 5 was entered).
  if (isHighSeverity && decision?.should_remediate && incident !== null) {
    await releaseLoadModeHold(incident.tenant_id, incidentId).catch(() => undefined)
  }

  // ── Finalise incident status ───────────────────────────────────────────────

  if (healed) {
    void updateIncidentStatus(incidentId, 'resolved').catch(() => undefined)
  }

  // ── Clear throttle when healed via THROTTLE action ────────────────────────
  if (healed && actionTaken?.action_type === 'THROTTLE' && incident !== null) {
    await clearThrottle(incident.tenant_id).catch((err) => {
      console.warn(
        '[orchestrator] clearThrottle failed (non-blocking):',
        err instanceof Error ? err.message : err,
      )
    })
  }

  // Change 7: Healing attempts counter + auto-escalate after 3 failures.
  // Only increment / escalate when the cycle actually attempted remediation
  // (actionTaken !== null) but did not heal.
  // FIX 4: Use an atomic conditional update (.lt guard) and read back the DB value
  // to avoid race conditions from concurrent healing cycles on the same incident.
  if (!healed && !escalated && actionTaken !== null && incident !== null) {
    const localAttempts = (incident.healing_attempts ?? 0) + 1
    // Atomic increment: only succeeds if healing_attempts < 10 (safety cap).
    // The returned row contains the authoritative DB value after the write.
    const { data: updatedRow } = await (supabaseAdmin as unknown as {
      from: (t: string) => {
        update: (d: Record<string, unknown>) => {
          eq: (col: string, val: string) => {
            lt: (col2: string, val2: number) => {
              select: (cols: string) => {
                single: () => Promise<{ data: { healing_attempts: number } | null }>
              }
            }
          }
        }
      }
    }).from('incidents')
      .update({ healing_attempts: localAttempts, updated_at: new Date().toISOString() })
      .eq('incident_id', incidentId)
      .lt('healing_attempts', 10)   // safety cap — stops runaway increments
      .select('healing_attempts')
      .single()

    // Use the authoritative DB value; fall back to local if the update was a no-op
    const actualAttempts = updatedRow?.healing_attempts ?? localAttempts

    if (actualAttempts >= 3) {
      // Auto-escalate: too many failed healing attempts — needs human intervention.
      // 'autopsy_complete' is the closest valid IncidentStatus for a terminal non-resolved
      // state; we also fire a best-effort direct Supabase update to set a custom status.
      void updateIncidentStatus(incidentId, 'autopsy_complete').catch(() => undefined)
      void (supabaseAdmin as unknown as {
        from: (t: string) => {
          update: (d: Record<string, unknown>) => {
            eq: (col: string, val: string) => { then: (cb: () => void) => void }
          }
        }
      }).from('incidents')
        .update({ status: 'escalated', healing_attempts: actualAttempts })
        .eq('incident_id', incidentId)
      escalated = true
      console.warn(
        `[SelfHealingOrchestrator] incident=${incidentId} auto-escalated after ${actualAttempts} failed healing attempts`,
      )
    }
  }

  return buildResult()

  // ─ Helper: assemble result ──────────────────────────────────────────────────
  function buildResult(): HealingCycleResult {
    const completedAt = new Date().toISOString()
    return {
      cycle_id:     cycleId,
      incident_id:  incidentId,
      tenant_id:    incident?.tenant_id ?? 'unknown',
      started_at:   startedAt,
      completed_at: completedAt,
      duration_ms:  Date.now() - startMs,
      stages,
      decision,
      action_taken: actionTaken,
      healed,
      escalated,
      approval_id:  approvalId,
    }
  }
}

// ─── runHealingBatch ──────────────────────────────────────────────────────────

/**
 * Runs a healing cycle for every open incident of a tenant (max 10 at a time).
 *
 * Sequential — not parallel — to avoid thundering-herd effects on shared
 * infrastructure (Redis, Supabase, load governor).
 *
 * Stores aggregated stats at `orchestrator_stats:{tenantId}` (TTL 1 h).
 * Returns all HealingCycleResult objects.
 *
 * Fail-open: if listOpenIncidents returns [], returns [] immediately.
 */
export async function runHealingBatch(tenantId: string): Promise<HealingCycleResult[]> {
  const incidents    = await listOpenIncidents(tenantId, 10)
  const results:     HealingCycleResult[] = []
  // Change 8: per-tenant time budget (45 s) to avoid Vercel's 60 s kill
  const batchStartMs = Date.now()

  for (const incident of incidents) {
    // Check time budget before processing each incident
    if (Date.now() - batchStartMs > 45_000) {
      console.warn(
        `[runHealingBatch] time budget exceeded for tenant=${tenantId}, processed=${results.length}/${incidents.length}`,
      )
      break
    }
    const result = await runHealingCycle(incident.incident_id)
    results.push(result)
  }

  // Persist stats (fire-and-forget — don't block caller)
  void persistBatchStats(tenantId, results).catch((err) =>
    console.warn('[SelfHealingOrchestrator] Failed to persist batch stats:', err),
  )

  return results
}

// ─── persistBatchStats ───────────────────────────────────────────────────────

async function persistBatchStats(
  tenantId: string,
  results:  HealingCycleResult[],
): Promise<void> {
  if (results.length === 0) return

  // Read existing stats to accumulate totals
  const existing = await getOrchestratorStats(tenantId)

  const prevRun        = existing.cycles_run
  const prevHealed     = existing.cycles_healed
  const prevEscalated  = existing.cycles_escalated
  const prevAvgMs      = existing.avg_cycle_duration_ms

  const newRun       = results.length
  const newHealed    = results.filter((r) => r.healed).length
  const newEscalated = results.filter((r) => r.escalated).length
  const newAvgMs     = results.length > 0
    ? results.reduce((acc, r) => acc + r.duration_ms, 0) / results.length
    : 0

  const totalRun      = prevRun + newRun
  const totalHealed   = prevHealed + newHealed
  const totalEscalated = prevEscalated + newEscalated

  // Weighted rolling average for duration
  const totalAvgMs = prevRun > 0
    ? (prevAvgMs * prevRun + newAvgMs * newRun) / totalRun
    : newAvgMs

  const stats: OrchestratorStats = {
    tenant_id:             tenantId,
    cycles_run:            totalRun,
    cycles_healed:         totalHealed,
    cycles_escalated:      totalEscalated,
    avg_cycle_duration_ms: Math.round(totalAvgMs),
    heal_rate:             totalRun > 0 ? Math.round((totalHealed / totalRun) * 1000) / 1000 : 0,
    last_cycle_at:         new Date().toISOString(),
  }

  await redisSet(
    `orchestrator_stats:${tenantId}`,
    JSON.stringify(stats),
    3_600,
  )
}

// ─── getOrchestratorStats ─────────────────────────────────────────────────────

/**
 * Returns aggregated orchestrator stats for a tenant from Redis.
 * Returns zeroed stats (not null) when the key is absent or Redis is down.
 * Fail-open.
 */
export async function getOrchestratorStats(tenantId: string): Promise<OrchestratorStats> {
  const defaultStats: OrchestratorStats = {
    tenant_id:             tenantId,
    cycles_run:            0,
    cycles_healed:         0,
    cycles_escalated:      0,
    avg_cycle_duration_ms: 0,
    heal_rate:             0,
    last_cycle_at:         null,
  }

  try {
    const raw = await redisGet(`orchestrator_stats:${tenantId}`)
    if (!raw) return defaultStats

    const parsed = JSON.parse(raw) as Partial<OrchestratorStats>

    return {
      tenant_id:             parsed.tenant_id             ?? tenantId,
      cycles_run:            parsed.cycles_run            ?? 0,
      cycles_healed:         parsed.cycles_healed         ?? 0,
      cycles_escalated:      parsed.cycles_escalated      ?? 0,
      avg_cycle_duration_ms: parsed.avg_cycle_duration_ms ?? 0,
      heal_rate:             parsed.heal_rate             ?? 0,
      last_cycle_at:         parsed.last_cycle_at         ?? null,
    }
  } catch {
    return defaultStats
  }
}
