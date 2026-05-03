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
    const actionMeta = body.action_meta as string

    if (actionMeta === 'classify') {
      const sysAction  = body.system_action as SystemAction
      const govClass   = classifyGovernanceAction(sysAction)
      const permission = validateOverridePermission(govClass, (user.role ?? 'viewer') as UserRole)
      return NextResponse.json({ governance_class: govClass, permission })
    }

    if (actionMeta === 'override') {
      const override: OverrideRequest = {
        override_id:  `ov-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        user_email:   user.user_email,
        user_role:    (user.role ?? 'viewer') as UserRole,
        action:       body.system_action as SystemAction,
        reason:       (body.reason as string) ?? 'Manual override',
        requested_at: new Date().toISOString(),
      }
      const systemDecision: SystemDecision = {
        decision_id:   (body.decision_id as string) ?? 'sys-auto',
        action:        body.system_action as SystemAction,
        system_reason: (body.system_reason as string) ?? 'automated',
        is_locked:     (body.is_locked as boolean) ?? false,
        lock_reason:   body.lock_reason as string | undefined,
      }
      const resolution = resolveConflict(override, systemDecision)
      if (resolution.outcome !== 'system_locked') {
        await recordOverride(override, resolution)
      }
      return NextResponse.json({ resolution, override_id: override.override_id })
    }

    if (actionMeta === 'trace') {
      const trace = buildDecisionTrace(
        (body.trace_id as string) ?? `tr-${Date.now()}`,
        (body.raw_inputs as Record<string, unknown>) ?? {},
        (body.model_version as string) ?? 'unknown',
        (body.score as number) ?? 0,
        (body.routing_tier as string) ?? 'skip',
        (body.routing_reason as string) ?? '',
        body.override as { applied: boolean; by?: string; reason?: string } | undefined,
        body.final_action as string | undefined,
      )
      return NextResponse.json({ trace })
    }

    if (actionMeta === 'record') {
      if (!hasPermission(user.role, 'commercial:write')) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
      }
      const sysAction  = body.system_action as SystemAction
      const govClass   = classifyGovernanceAction(sysAction)
      const record     = buildGovernanceRecord(sysAction, govClass, (body.decision as 'approved' | 'blocked' | 'pending') ?? 'approved', user.user_email, body.audit_reason as string | undefined)
      await persistGovernanceDecision(record)
      return NextResponse.json({ ok: true, record })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
