// GET  /api/ops/governance — governance history + approval matrix
// POST /api/ops/governance — classify action / record override / resolve conflict

import { NextRequest, NextResponse }   from 'next/server'
import { getAdminRole, hasPermission } from '@/lib/auth/adminAuth'
import {
  classifyGovernanceAction,
  validateOverridePermission,
  resolveConflict,
  buildDecisionTrace,
  buildGovernanceRecord,
  computeApprovalMatrix,
  persistGovernanceDecision,
  recordOverride,
  getGovernanceHistory,
} from '@/lib/ops/governance'
import type {
  SystemAction,
  OverrideRequest,
  SystemDecision,
  UserRole,
} from '@/lib/ops/governance'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const user = await getAdminRole(req.headers.get('authorization')?.replace('Bearer ', '') ?? '')
  if (!user || !hasPermission(user.role, 'analytics:read')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const view       = searchParams.get('view') ?? 'history'
  const actionType = searchParams.get('action_type') as SystemAction['action_type'] | null
  const limit      = Number(searchParams.get('limit') ?? '50')

  try {
    if (view === 'matrix') {
      const matrix = computeApprovalMatrix()
      return NextResponse.json({ matrix })
    }

    const history      = await getGovernanceHistory(actionType ?? undefined, limit)
    const pending      = history.filter(h => h.decision === 'pending')

    if (view === 'pending') {
      return NextResponse.json({ pending, count: pending.length })
    }

    return NextResponse.json({ history, pending_count: pending.length })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const user = await getAdminRole(req.headers.get('authorization')?.replace('Bearer ', '') ?? '')
  if (!user || !hasPermission(user.role, 'analytics:read')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body       = await req.json()
    const actionMeta = typeof body?.action_meta === 'string' ? body.action_meta : null
    if (!actionMeta) {
      return NextResponse.json({ error: 'action_meta required' }, { status: 400 })
    }

    if (actionMeta === 'classify') {
      if (!body.system_action?.action_type) {
        return NextResponse.json({ error: 'system_action.action_type required' }, { status: 400 })
      }
      const sysAction  = body.system_action as SystemAction
      const govClass   = classifyGovernanceAction(sysAction)
      const permission = validateOverridePermission(govClass, (user.role ?? 'viewer') as UserRole)
      return NextResponse.json({ governance_class: govClass, permission })
    }

    if (actionMeta === 'override') {
      if (!body.system_action?.action_type) {
        return NextResponse.json({ error: 'system_action.action_type required' }, { status: 400 })
      }
      const override: OverrideRequest = {
        override_id:  `ov-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        user_email:   user.user_email,
        user_role:    (user.role ?? 'viewer') as UserRole,
        action:       body.system_action as SystemAction,
        reason:       typeof body.reason === 'string' ? body.reason : 'Manual override',
        requested_at: new Date().toISOString(),
      }
      const systemDecision: SystemDecision = {
        decision_id:   typeof body.decision_id === 'string' ? body.decision_id : 'sys-auto',
        action:        body.system_action as SystemAction,
        system_reason: typeof body.system_reason === 'string' ? body.system_reason : 'automated',
        is_locked:     body.is_locked === true,
        lock_reason:   typeof body.lock_reason === 'string' ? body.lock_reason : undefined,
      }
      const resolution = resolveConflict(override, systemDecision)
      if (resolution.outcome !== 'system_locked') {
        await recordOverride(override, resolution)
      }
      return NextResponse.json({ resolution, override_id: override.override_id })
    }

    if (actionMeta === 'trace') {
      const trace = buildDecisionTrace(
        typeof body.trace_id === 'string' ? body.trace_id : `tr-${Date.now()}`,
        (body.raw_inputs as Record<string, unknown>) ?? {},
        typeof body.model_version === 'string' ? body.model_version : 'unknown',
        typeof body.score === 'number' ? body.score : 0,
        typeof body.routing_tier === 'string' ? body.routing_tier : 'skip',
        typeof body.routing_reason === 'string' ? body.routing_reason : '',
        body.override as { applied: boolean; by?: string; reason?: string } | undefined,
        typeof body.final_action === 'string' ? body.final_action : undefined,
      )
      return NextResponse.json({ trace })
    }

    if (actionMeta === 'record') {
      if (!hasPermission(user.role, 'commercial:write')) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
      }
      if (!body.system_action?.action_type) {
        return NextResponse.json({ error: 'system_action.action_type required' }, { status: 400 })
      }
      const sysAction  = body.system_action as SystemAction
      const govClass   = classifyGovernanceAction(sysAction)
      const validDecisions = ['approved', 'blocked', 'pending'] as const
      const decision   = validDecisions.includes(body.decision) ? body.decision : 'approved'
      const record     = buildGovernanceRecord(sysAction, govClass, decision, user.user_email, typeof body.audit_reason === 'string' ? body.audit_reason : undefined)
      await persistGovernanceDecision(record)
      return NextResponse.json({ ok: true, record })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
