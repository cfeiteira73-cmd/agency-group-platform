// =============================================================================
// Tests — lib/ops/governance.ts  (pure functions only)
// =============================================================================

import { describe, it, expect, vi } from 'vitest'

vi.mock('../../../lib/supabase', () => ({ supabaseAdmin: {}, supabase: {} }))

import {
  classifyGovernanceAction,
  validateOverridePermission,
  resolveConflict,
  buildDecisionTrace,
  buildGovernanceRecord,
  computeApprovalMatrix,
} from '../../../lib/ops/governance'
import type {
  SystemAction,
  OverrideRequest,
  SystemDecision,
  UserRole,
} from '../../../lib/ops/governance'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAction(actionType: SystemAction['action_type'], role?: UserRole): SystemAction {
  return { action_type: actionType, triggered_by: 'admin', user_role: role }
}

function makeOverride(email: string, role: UserRole, action: SystemAction): OverrideRequest {
  return {
    override_id:  `ov-${Date.now()}`,
    user_email:   email,
    user_role:    role,
    action,
    reason:       'operator decision',
    requested_at: new Date().toISOString(),
  }
}

function makeSystemDecision(actionType: SystemAction['action_type'], locked = false): SystemDecision {
  return {
    decision_id:   'sys-001',
    action:        makeAction(actionType),
    system_reason: 'automated decision',
    is_locked:     locked,
    lock_reason:   locked ? 'safety gate active' : undefined,
  }
}

// ---------------------------------------------------------------------------
// classifyGovernanceAction
// ---------------------------------------------------------------------------

describe('classifyGovernanceAction', () => {
  it('auto_route_deal → routine',          () => expect(classifyGovernanceAction(makeAction('auto_route_deal'))).toBe('routine'))
  it('promote_model → requires_approval',  () => expect(classifyGovernanceAction(makeAction('promote_model'))).toBe('requires_approval'))
  it('rollback_model → requires_super_admin', () => expect(classifyGovernanceAction(makeAction('rollback_model'))).toBe('requires_super_admin'))
  it('delete_data → forbidden',            () => expect(classifyGovernanceAction(makeAction('delete_data'))).toBe('forbidden'))
  it('modify_rls_policy → forbidden',      () => expect(classifyGovernanceAction(makeAction('modify_rls_policy'))).toBe('forbidden'))
  it('export_pii → forbidden',             () => expect(classifyGovernanceAction(makeAction('export_pii'))).toBe('forbidden'))
  it('update_feature_flag → requires_approval', () => expect(classifyGovernanceAction(makeAction('update_feature_flag'))).toBe('requires_approval'))
})

// ---------------------------------------------------------------------------
// validateOverridePermission
// ---------------------------------------------------------------------------

describe('validateOverridePermission', () => {
  it('forbidden action → no role can override', () => {
    const r = validateOverridePermission('forbidden', 'super_admin')
    expect(r.permitted).toBe(false)
  })

  it('routine → any role permitted', () => {
    expect(validateOverridePermission('routine', 'viewer').permitted).toBe(true)
    expect(validateOverridePermission('routine', 'agent').permitted).toBe(true)
  })

  it('requires_approval → admin permitted, agent not', () => {
    expect(validateOverridePermission('requires_approval', 'admin').permitted).toBe(true)
    expect(validateOverridePermission('requires_approval', 'agent').permitted).toBe(false)
  })

  it('requires_super_admin → super_admin only', () => {
    expect(validateOverridePermission('requires_super_admin', 'super_admin').permitted).toBe(true)
    expect(validateOverridePermission('requires_super_admin', 'admin').permitted).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// resolveConflict
// ---------------------------------------------------------------------------

describe('resolveConflict', () => {
  it('human admin overrides routine action → human wins', () => {
    const override = makeOverride('admin@ag.com', 'admin', makeAction('auto_route_deal'))
    const system   = makeSystemDecision('auto_route_deal', false)
    const r        = resolveConflict(override, system)
    expect(r.outcome).toBe('human_wins')
    expect(r.winner).toBe('human')
  })

  it('human admin tries to override forbidden → system locked', () => {
    const override = makeOverride('admin@ag.com', 'admin', makeAction('delete_data'))
    const system   = makeSystemDecision('delete_data', false)
    const r        = resolveConflict(override, system)
    expect(r.outcome).toBe('system_locked')
    expect(r.winner).toBe('system')
  })

  it('locked system decision + non-super_admin → escalated', () => {
    const override = makeOverride('admin@ag.com', 'admin', makeAction('rollback_model'))
    const system   = makeSystemDecision('rollback_model', true)
    const r        = resolveConflict(override, system)
    expect(r.outcome).toBe('escalated')
    expect(r.requires_role).toBe('super_admin')
  })

  it('super_admin can override locked decision', () => {
    const override = makeOverride('sa@ag.com', 'super_admin', makeAction('rollback_model'))
    const system   = makeSystemDecision('rollback_model', true)
    const r        = resolveConflict(override, system)
    expect(r.outcome).toBe('human_wins')
  })

  it('insufficient role → escalated with required role', () => {
    const override = makeOverride('agent@ag.com', 'agent', makeAction('promote_model'))
    const system   = makeSystemDecision('promote_model', false)
    const r        = resolveConflict(override, system)
    expect(r.outcome).toBe('escalated')
    expect(r.requires_role).toBe('admin')
  })
})

// ---------------------------------------------------------------------------
// buildDecisionTrace
// ---------------------------------------------------------------------------

describe('buildDecisionTrace', () => {
  it('builds trace with all fields', () => {
    const trace = buildDecisionTrace(
      'trace-001',
      { score: 88, zone: 'lisboa' },
      'v2.0',
      88,
      'A+',
      'score ≥ 85',
      { applied: false },
      'distribute',
    )
    expect(trace.trace_id).toBe('trace-001')
    expect(trace.model_version).toBe('v2.0')
    expect(trace.score_computed).toBe(88)
    expect(trace.routing_tier).toBe('A+')
    expect(trace.override_applied).toBe(false)
    expect(trace.final_action).toBe('distribute')
  })

  it('override fields populated when applied', () => {
    const trace = buildDecisionTrace(
      't-002',
      {},
      'v2.0',
      70,
      'A',
      'score 70-84',
      { applied: true, by: 'admin@ag.com', reason: 'manual boost' },
    )
    expect(trace.override_applied).toBe(true)
    expect(trace.override_by).toBe('admin@ag.com')
    expect(trace.override_reason).toBe('manual boost')
  })

  it('executed_at is ISO timestamp', () => {
    const trace = buildDecisionTrace('t', {}, 'v1', 80, 'A', 'test')
    expect(new Date(trace.executed_at).getTime()).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// buildGovernanceRecord
// ---------------------------------------------------------------------------

describe('buildGovernanceRecord', () => {
  it('builds record correctly', () => {
    const action = makeAction('promote_model', 'admin')
    const r      = buildGovernanceRecord(action, 'requires_approval', 'approved', 'admin@ag.com')
    expect(r.action_type).toBe('promote_model')
    expect(r.governance_class).toBe('requires_approval')
    expect(r.decision).toBe('approved')
    expect(r.approved_by).toBe('admin@ag.com')
    expect(r.approved_at).toBeDefined()
  })

  it('no approver → no approved_at', () => {
    const r = buildGovernanceRecord(makeAction('auto_route_deal'), 'routine', 'approved')
    expect(r.approved_by).toBeUndefined()
    expect(r.approved_at).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// computeApprovalMatrix
// ---------------------------------------------------------------------------

describe('computeApprovalMatrix', () => {
  it('super_admin can do everything non-forbidden', () => {
    const matrix = computeApprovalMatrix()
    expect(matrix.super_admin).toContain('auto_route_deal')
    expect(matrix.super_admin).toContain('promote_model')
    expect(matrix.super_admin).toContain('rollback_model')
    // forbidden actions excluded
    expect(matrix.super_admin).not.toContain('delete_data')
    expect(matrix.super_admin).not.toContain('modify_rls_policy')
  })

  it('viewer can only do routine actions', () => {
    const matrix = computeApprovalMatrix()
    expect(matrix.viewer).toContain('auto_route_deal')
    expect(matrix.viewer).not.toContain('promote_model')
    expect(matrix.viewer).not.toContain('rollback_model')
  })

  it('admin can do routine + requires_approval but not super_admin actions', () => {
    const matrix = computeApprovalMatrix()
    expect(matrix.admin).toContain('auto_route_deal')
    expect(matrix.admin).toContain('promote_model')
    expect(matrix.admin).not.toContain('rollback_model')
  })

  it('no role can do forbidden actions', () => {
    const matrix = computeApprovalMatrix()
    for (const role of ['viewer', 'agent', 'admin', 'super_admin'] as const) {
      expect(matrix[role]).not.toContain('delete_data')
      expect(matrix[role]).not.toContain('export_pii')
    }
  })
})
