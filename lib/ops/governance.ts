// =============================================================================
// Agency Group — Formal Governance & Human Control System
// lib/ops/governance.ts
//
// Phase 7: Governance Engine
//
// Institutionalizes production operating rules: what requires approval,
// who can override what, how conflicts resolve, and full decision traceability.
//
// GOVERNANCE CLASSES:
//   routine           → system executes autonomously
//   requires_approval → needs admin confirmation
//   requires_super_admin → super_admin only gate
//   forbidden         → system cannot execute regardless
//
// CONFLICT RESOLUTION RULE:
//   Human override ALWAYS wins UNLESS the system has a locked safety reason.
//   A locked safety reason requires super_admin to override.
//
// PURE FUNCTIONS:
//   classifyGovernanceAction, resolveConflict,
//   buildDecisionTrace, computeApprovalMatrix,
//   validateOverridePermission, buildGovernanceRecord
//
// DB FUNCTIONS:
//   persistGovernanceDecision, recordOverride, getGovernanceHistory
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GovernanceClass =
  | 'routine'
  | 'requires_approval'
  | 'requires_super_admin'
  | 'forbidden'

export type SystemActionType =
  | 'auto_route_deal'
  | 'score_opportunity'
  | 'promote_model'
  | 'rollback_model'
  | 'modify_threshold'
  | 'suppress_recipient'
  | 'trigger_distribution'
  | 'apply_calibration'
  | 'dismiss_calibration'
  | 'update_feature_flag'
  | 'force_release_cron'
  | 'modify_rls_policy'
  | 'delete_data'
  | 'export_pii'

export type UserRole = 'viewer' | 'agent' | 'admin' | 'super_admin'

export interface SystemAction {
  action_type:   SystemActionType
  triggered_by:  'system' | 'admin' | 'cron' | 'api'
  user_role?:    UserRole
  resource_id?:  string
  metadata?:     Record<string, unknown>
}

export interface OverrideRequest {
  override_id:   string
  user_email:    string
  user_role:     UserRole
  action:        SystemAction
  reason:        string
  requested_at:  string
}

export interface SystemDecision {
  decision_id:   string
  action:        SystemAction
  system_reason: string
  is_locked:     boolean          // locked decisions require super_admin to override
  lock_reason?:  string
}

export type ConflictOutcome = 'human_wins' | 'system_locked' | 'escalated'

export interface ConflictResolution {
  outcome:         ConflictOutcome
  winner:          'human' | 'system'
  requires_role:   UserRole | null
  resolution_note: string
}

export interface DecisionTrace {
  trace_id:         string
  property_id?:     string
  deal_id?:         string
  raw_inputs:       Record<string, unknown>
  model_version:    string
  score_computed:   number
  routing_tier:     string
  routing_reason:   string
  override_applied: boolean
  override_by?:     string
  override_reason?: string
  final_action:     string
  executed_at:      string
}

export interface GovernanceRecord {
  action_type:     SystemActionType
  triggered_by:    string
  governance_class: GovernanceClass
  approved_by?:    string
  approved_at?:    string
  decision:        'approved' | 'blocked' | 'pending'
  audit_reason:    string
  created_at:      string
}

// ---------------------------------------------------------------------------
// GOVERNANCE MATRIX — defines required clearance for each action type
// ---------------------------------------------------------------------------

const GOVERNANCE_MATRIX: Record<SystemActionType, GovernanceClass> = {
  auto_route_deal:       'routine',
  score_opportunity:     'routine',
  trigger_distribution:  'routine',
  apply_calibration:     'requires_approval',
  dismiss_calibration:   'requires_approval',
  promote_model:         'requires_approval',
  suppress_recipient:    'requires_approval',
  update_feature_flag:   'requires_approval',
  rollback_model:        'requires_super_admin',
  modify_threshold:      'requires_super_admin',
  force_release_cron:    'requires_super_admin',
  modify_rls_policy:     'forbidden',
  delete_data:           'forbidden',
  export_pii:            'forbidden',
}

// ---------------------------------------------------------------------------
// PURE: Classify governance action
// ---------------------------------------------------------------------------

export function classifyGovernanceAction(action: SystemAction): GovernanceClass {
  return GOVERNANCE_MATRIX[action.action_type] ?? 'requires_approval'
}

// ---------------------------------------------------------------------------
// PURE: Validate if user role can perform action
// ---------------------------------------------------------------------------

export function validateOverridePermission(
  govClass: GovernanceClass,
  userRole: UserRole,
): { permitted: boolean; reason: string } {
  const roleRank: Record<UserRole, number> = {
    viewer:      0,
    agent:       1,
    admin:       2,
    super_admin: 3,
  }

  if (govClass === 'forbidden') {
    return { permitted: false, reason: 'Action is absolutely forbidden — no role can perform this' }
  }
  if (govClass === 'routine') {
    return { permitted: true, reason: 'Routine action — no approval required' }
  }
  if (govClass === 'requires_approval' && roleRank[userRole] >= roleRank['admin']) {
    return { permitted: true, reason: 'Admin approval sufficient' }
  }
  if (govClass === 'requires_super_admin' && roleRank[userRole] >= roleRank['super_admin']) {
    return { permitted: true, reason: 'Super admin approval' }
  }

  return {
    permitted: false,
    reason: govClass === 'requires_super_admin'
      ? `Super admin required (current role: ${userRole})`
      : `Admin or higher required (current role: ${userRole})`,
  }
}

// ---------------------------------------------------------------------------
// PURE: Resolve conflict between human override and system decision
// Human ALWAYS wins unless system decision is locked
// ---------------------------------------------------------------------------

export function resolveConflict(
  override: OverrideRequest,
  system:   SystemDecision,
): ConflictResolution {
  const govClass = classifyGovernanceAction(override.action)
  const permission = validateOverridePermission(govClass, override.user_role)

  // Forbidden actions — no override possible
  if (govClass === 'forbidden') {
    return {
      outcome:         'system_locked',
      winner:          'system',
      requires_role:   null,
      resolution_note: 'Action is forbidden — override blocked regardless of role',
    }
  }

  // Locked system decision — requires super_admin
  if (system.is_locked && override.user_role !== 'super_admin') {
    return {
      outcome:         'escalated',
      winner:          'system',
      requires_role:   'super_admin',
      resolution_note: `System decision is locked (${system.lock_reason ?? 'safety'}). Escalate to super_admin.`,
    }
  }

  // Human wins if they have permission
  if (permission.permitted) {
    return {
      outcome:         'human_wins',
      winner:          'human',
      requires_role:   null,
      resolution_note: `Override approved for ${override.user_role} — ${override.reason}`,
    }
  }

  // Escalate
  return {
    outcome:         'escalated',
    winner:          'system',
    requires_role:   govClass === 'requires_super_admin' ? 'super_admin' : 'admin',
    resolution_note: permission.reason,
  }
}

// ---------------------------------------------------------------------------
// PURE: Build full decision trace (auditability)
// ---------------------------------------------------------------------------

export function buildDecisionTrace(
  traceId:       string,
  inputs:        Record<string, unknown>,
  modelVersion:  string,
  score:         number,
  routingTier:   string,
  routingReason: string,
  override?:     { applied: boolean; by?: string; reason?: string },
  finalAction?:  string,
): DecisionTrace {
  return {
    trace_id:         traceId,
    raw_inputs:       inputs,
    model_version:    modelVersion,
    score_computed:   score,
    routing_tier:     routingTier,
    routing_reason:   routingReason,
    override_applied: override?.applied ?? false,
    override_by:      override?.by,
    override_reason:  override?.reason,
    final_action:     finalAction ?? 'distribute',
    executed_at:      new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// PURE: Build governance record for persistence
// ---------------------------------------------------------------------------

export function buildGovernanceRecord(
  action:        SystemAction,
  govClass:      GovernanceClass,
  decision:      'approved' | 'blocked' | 'pending',
  approvedBy?:   string,
  auditReason?:  string,
): GovernanceRecord {
  return {
    action_type:      action.action_type,
    triggered_by:     action.user_role ?? action.triggered_by,
    governance_class: govClass,
    approved_by:      approvedBy,
    approved_at:      approvedBy ? new Date().toISOString() : undefined,
    decision,
    audit_reason:     auditReason ?? `${action.action_type} — ${govClass}`,
    created_at:       new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// PURE: Compute approval matrix (summary of what each role can do)
// ---------------------------------------------------------------------------

export function computeApprovalMatrix(): Record<UserRole, SystemActionType[]> {
  const result: Record<UserRole, SystemActionType[]> = {
    viewer:      [],
    agent:       [],
    admin:       [],
    super_admin: [],
  }
  const roles: UserRole[] = ['viewer', 'agent', 'admin', 'super_admin']
  for (const [actionType, govClass] of Object.entries(GOVERNANCE_MATRIX) as [SystemActionType, GovernanceClass][]) {
    for (const role of roles) {
      const { permitted } = validateOverridePermission(govClass, role)
      if (permitted) result[role].push(actionType)
    }
  }
  return result
}

// ---------------------------------------------------------------------------
// DB: Persist governance decision
// ---------------------------------------------------------------------------

export async function persistGovernanceDecision(record: GovernanceRecord): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabaseAdmin as any)
    .from('governance_decisions')
    .insert({
      action_type:      record.action_type,
      triggered_by:     record.triggered_by,
      governance_class: record.governance_class,
      approved_by:      record.approved_by ?? null,
      approved_at:      record.approved_at ?? null,
      decision:         record.decision,
      audit_reason:     record.audit_reason,
      created_at:       record.created_at,
    })
  if (error) throw new Error(`persistGovernanceDecision: ${error.message}`)
}

// ---------------------------------------------------------------------------
// DB: Record human override event
// ---------------------------------------------------------------------------

export async function recordOverride(
  override:    OverrideRequest,
  resolution:  ConflictResolution,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabaseAdmin as any)
    .from('override_events')
    .insert({
      override_id:   override.override_id,
      user_email:    override.user_email,
      user_role:     override.user_role,
      action_type:   override.action.action_type,
      resource_id:   override.action.resource_id ?? null,
      reason:        override.reason,
      outcome:       resolution.outcome,
      winner:        resolution.winner,
      created_at:    override.requested_at,
    })
  if (error) throw new Error(`recordOverride: ${error.message}`)
}

// ---------------------------------------------------------------------------
// DB: Get governance history
// ---------------------------------------------------------------------------

export async function getGovernanceHistory(
  actionType?: SystemActionType,
  limit = 50,
): Promise<GovernanceRecord[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabaseAdmin as any)
    .from('governance_decisions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (actionType) {
    query = query.eq('action_type', actionType)
  }

  const { data, error } = await query
  if (error) throw new Error(`getGovernanceHistory: ${error.message}`)
  return data ?? []
}
