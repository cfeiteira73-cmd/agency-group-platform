// =============================================================================
// Agency Group — Remediation Decision Engine
// lib/remediation/remediationDecisionEngine.ts
//
// 4-signal decision matrix that decides whether/how to remediate an incident.
//
// Signals:
//   1. Severity          (weight 0.40) — P0 1.0, P1 0.75, P2 0.5, P3 0.25
//   2. Revenue impact    (weight 0.25) — tiered: <10€=0, 10-100€=0.3, 100-1000€=0.7, >1000€=1.0
//   3. Cascade risk      (weight 0.20) — 0-1 fraction of subsystems affected
//   4. Root cause conf.  (weight 0.15) — from CausalChain.confidence_score
//
// Safety gates (CRITICAL — checked before any action):
//   • P2 or P3 severity → never auto-remediate
//   • Root cause confidence < 0.3 → escalate, no action
//   • Decision score < 0.4 → too uncertain to act
//
// TypeScript strict — 0 errors
// =============================================================================

import { randomUUID } from 'crypto'
import type { IncidentSeverity, IncidentRow } from '@/lib/incidents/incidentIngestor'
import type { IncidentAutopsyReport }          from '@/lib/incidents/autopsyReport'
import type { CausalChain }                    from '@/lib/incidents/causalReconstructor'
import type { FailureType }                    from '@/lib/incidents/failureClassifier'
import type {
  RemediationAction,
  RemediationActionType,
  ExecutionMode,
} from './autonomousRemediator'

// ─── Public types ─────────────────────────────────────────────────────────────

export interface DecisionSignals {
  severity:             IncidentSeverity  // P0 weight 1.0, P1 0.75, P2 0.5, P3 0.25
  revenue_impact_eur:   number            // raw EUR amount from impact analysis
  cascade_risk:         number            // 0-1: fraction of subsystems affected
  root_cause_confidence: number           // 0-1: from CausalChain.confidence_score
}

export interface RemediationDecision {
  should_remediate:  boolean
  action:            RemediationAction | null
  justification:     string[]
  risk_assessment:   number               // 0-1: overall risk
  decision_score:    number               // 0-1: weighted urgency score
  requires_approval: boolean
}

// ─── Weight constants ─────────────────────────────────────────────────────────

const W_SEVERITY    = 0.40
const W_REVENUE     = 0.25
const W_CASCADE     = 0.20
const W_ROOT_CAUSE  = 0.15

// ─── Signal mappers ───────────────────────────────────────────────────────────

function severityWeight(severity: IncidentSeverity): number {
  switch (severity) {
    case 'P0': return 1.00
    case 'P1': return 0.75
    case 'P2': return 0.50
    case 'P3': return 0.25
  }
}

function revenueWeight(eurAmount: number): number {
  if (eurAmount > 1_000) return 1.0
  if (eurAmount > 100)   return 0.7
  if (eurAmount > 10)    return 0.3
  return 0
}

// ─── computeDecisionScore ─────────────────────────────────────────────────────

/**
 * Computes a weighted urgency score in range [0, 1].
 *
 * score = (severityWeight × 0.40)
 *       + (revenueWeight  × 0.25)
 *       + (cascadeRisk    × 0.20)
 *       + (rootConfidence × 0.15)
 */
export function computeDecisionScore(signals: DecisionSignals): number {
  const score =
    (severityWeight(signals.severity)          * W_SEVERITY) +
    (revenueWeight(signals.revenue_impact_eur)  * W_REVENUE)  +
    (Math.max(0, Math.min(1, signals.cascade_risk))         * W_CASCADE)   +
    (Math.max(0, Math.min(1, signals.root_cause_confidence)) * W_ROOT_CAUSE)

  // Clamp to [0, 1] and round to 4dp
  return Math.round(Math.max(0, Math.min(1, score)) * 10_000) / 10_000
}

// ─── FailureType → action type map ───────────────────────────────────────────

const FAILURE_TO_ACTION: Record<FailureType, RemediationActionType> = {
  LOAD_SPIKE:           'THROTTLE',
  AI_COST_EXPLOSION:    'THROTTLE',
  GRAPH_DEGRADATION:    'DISABLE_FEATURE',
  REGION_PARTITION:     'REROUTE',
  QUEUE_OVERFLOW:       'THROTTLE',
  DATA_INCONSISTENCY:   'ROLLBACK',
  DEPENDENCY_FAILURE:   'ISOLATE_TENANT',
  UNKNOWN:              'THROTTLE',
}

// Actions that are safe enough for P1 AUTO
const LOW_RISK_ACTIONS = new Set<RemediationActionType>(['THROTTLE', 'REROUTE'])

// ─── selectAction ─────────────────────────────────────────────────────────────

/**
 * Maps a FailureType to the best RemediationAction for the given incident.
 *
 * ExecutionMode rules:
 *   • P0 + score > 0.5  → AUTO
 *   • P1 + score > 0.8 + low-risk action (THROTTLE | REROUTE) → AUTO
 *   • Otherwise → MANUAL_APPROVAL
 */
export function selectAction(
  incident:  IncidentRow,
  chain:     CausalChain | null,
  score:     number,
): RemediationAction {
  const failureType = (incident.classification ?? 'UNKNOWN') as FailureType
  const actionType  = FAILURE_TO_ACTION[failureType] ?? 'THROTTLE'

  const confidence  = chain?.confidence_score ?? 0.5
  const riskScore   = Math.round((1 - confidence) * 10_000) / 10_000

  // Target: for DISABLE_FEATURE, target = affected subsystem; otherwise tenant_id
  const target = actionType === 'DISABLE_FEATURE'
    ? (incident.subsystem === 'graph' ? 'graph_cold_queries' : incident.subsystem)
    : incident.tenant_id

  // Determine execution mode
  let executionMode: ExecutionMode = 'MANUAL_APPROVAL'
  if (incident.severity === 'P0' && score > 0.5) {
    executionMode = 'AUTO'
  } else if (
    incident.severity === 'P1' &&
    score > 0.8 &&
    LOW_RISK_ACTIONS.has(actionType)
  ) {
    executionMode = 'AUTO'
  }

  // Human-readable impact statement
  const expectedImpact = buildExpectedImpact(actionType, target, failureType)

  return {
    action_id:       `rem_${randomUUID()}`,
    incident_id:     incident.incident_id,
    action_type:     actionType,
    target,
    confidence,
    risk_score:      riskScore,
    expected_impact: expectedImpact,
    execution_mode:  executionMode,
    created_at:      new Date().toISOString(),
    executed_at:     null,
    result:          null,
  }
}

function buildExpectedImpact(
  actionType:  RemediationActionType,
  target:      string,
  failureType: FailureType,
): string {
  switch (actionType) {
    case 'ROLLBACK':
      return `Revert system to last stable state; mitigates ${failureType} by restoring known-good configuration`
    case 'THROTTLE':
      return `Halve request rate and AI token budget for ${target}; reduces load pressure from ${failureType}`
    case 'REROUTE':
      return `Shift traffic to fallback region for ${target}; bypasses ${failureType} in primary region`
    case 'SCALE_UP':
      return `Request additional compute capacity for ${target}; addresses capacity-related ${failureType}`
    case 'ISOLATE_TENANT':
      return `Move ${target} to EMERGENCY mode; prevents ${failureType} from cascading to other tenants`
    case 'DISABLE_FEATURE':
      return `Disable feature '${target}'; stops triggering the ${failureType} code path`
  }
}

// ─── makeRemediationDecision ──────────────────────────────────────────────────

/**
 * Core decision engine — evaluates 4 signals and returns a GO/NO-GO + action.
 *
 * Safety gates (evaluated in order, short-circuit on first match):
 *   1. P2 or P3 severity → never remediate, always requires human approval
 *   2. Root cause confidence < 0.3 → escalate, do not act
 *   3. Decision score < 0.4 → insufficient urgency
 *
 * GO paths:
 *   • P0 + score > 0.5 → AUTO remediation
 *   • P1 + score > 0.7 + low-risk action → AUTO remediation
 *   • Otherwise → MANUAL_APPROVAL
 */
export function makeRemediationDecision(
  incident: IncidentRow,
  report:   IncidentAutopsyReport,
  chain:    CausalChain | null,
): RemediationDecision {
  const justification: string[] = []

  // ── Build signals ──────────────────────────────────────────────────────────

  const severityW    = severityWeight(incident.severity)
  const revenueEur   = report.total_economic_impact
  const revenueW     = revenueWeight(revenueEur)
  const cascadeRisk  = chain
    ? Math.min(1, chain.system_layers_affected.length / 7)  // 7 max layers
    : 0
  const rootConf     = chain?.confidence_score ?? 0

  const signals: DecisionSignals = {
    severity:              incident.severity,
    revenue_impact_eur:    revenueEur,
    cascade_risk:          cascadeRisk,
    root_cause_confidence: rootConf,
  }

  const score = computeDecisionScore(signals)

  // ── Justification: explain each signal ────────────────────────────────────

  justification.push(
    `[Severity] ${incident.severity} → weight ${severityW.toFixed(2)} × 0.40 = ${(severityW * W_SEVERITY).toFixed(3)}`,
  )
  justification.push(
    `[Revenue] €${revenueEur.toFixed(2)} → weight ${revenueW.toFixed(2)} × 0.25 = ${(revenueW * W_REVENUE).toFixed(3)}`,
  )
  justification.push(
    `[Cascade] ${chain?.system_layers_affected?.length ?? 0} layers affected → risk ${cascadeRisk.toFixed(2)} × 0.20 = ${(cascadeRisk * W_CASCADE).toFixed(3)}`,
  )
  justification.push(
    `[Root Cause Confidence] ${rootConf.toFixed(2)} × 0.15 = ${(rootConf * W_ROOT_CAUSE).toFixed(3)}`,
  )
  justification.push(`[Decision Score] ${score.toFixed(4)}`)

  // ── Safety gate 1: P2 / P3 — never auto-remediate ─────────────────────────

  if (incident.severity === 'P2' || incident.severity === 'P3') {
    justification.push(
      `[Gate 1 BLOCKED] Severity ${incident.severity} — autonomous remediation disabled; escalating to on-call`,
    )
    return {
      should_remediate:  false,
      action:            null,
      justification,
      risk_assessment:   1 - rootConf,
      decision_score:    score,
      requires_approval: true,
    }
  }

  // ── Safety gate 2: low root cause confidence ──────────────────────────────

  if (rootConf < 0.3) {
    justification.push(
      `[Gate 2 BLOCKED] Root cause confidence ${rootConf.toFixed(2)} < 0.30 — Root cause confidence too low — escalating`,
    )
    return {
      should_remediate:  false,
      action:            null,
      justification,
      risk_assessment:   1 - rootConf,
      decision_score:    score,
      requires_approval: true,
    }
  }

  // ── Safety gate 3: insufficient urgency ──────────────────────────────────

  if (score < 0.4) {
    justification.push(
      `[Gate 3 BLOCKED] Decision score ${score.toFixed(4)} < 0.40 — urgency too low to justify automated action`,
    )
    return {
      should_remediate:  false,
      action:            null,
      justification,
      risk_assessment:   1 - rootConf,
      decision_score:    score,
      requires_approval: false,
    }
  }

  // ── GO: select action ─────────────────────────────────────────────────────

  const action = selectAction(incident, chain, score)
  const riskAssessment = Math.round((action.risk_score) * 10_000) / 10_000

  // ── Determine requires_approval ───────────────────────────────────────────

  let requiresApproval: boolean

  if (incident.severity === 'P0' && score > 0.5) {
    requiresApproval = false
    justification.push(
      `[GO] P0 + score ${score.toFixed(4)} > 0.50 → AUTO remediation approved`,
    )
  } else if (
    incident.severity === 'P1' &&
    score > 0.7 &&
    LOW_RISK_ACTIONS.has(action.action_type)
  ) {
    requiresApproval = false
    justification.push(
      `[GO] P1 + score ${score.toFixed(4)} > 0.70 + low-risk action (${action.action_type}) → AUTO remediation approved`,
    )
  } else {
    requiresApproval = true
    justification.push(
      `[GO w/ Approval] score ${score.toFixed(4)}, action ${action.action_type} → MANUAL_APPROVAL required before execution`,
    )
  }

  justification.push(
    `[Action Selected] ${action.action_type} targeting '${action.target}' — ${action.expected_impact}`,
  )

  return {
    should_remediate:  true,
    action,
    justification,
    risk_assessment:   riskAssessment,
    decision_score:    score,
    requires_approval: requiresApproval,
  }
}
