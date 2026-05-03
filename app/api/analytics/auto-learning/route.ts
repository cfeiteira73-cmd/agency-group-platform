// GET  /api/analytics/auto-learning — view auto updates + rollback history
// POST /api/analytics/auto-learning — evaluate trigger / record update

import { NextRequest, NextResponse }   from 'next/server'
import { getAdminRole, hasPermission } from '@/lib/auth/adminAuth'
import { supabaseAdmin }               from '@/lib/supabase'
import {
  shouldTriggerAutoUpdate,
  shouldTriggerRollback,
  computePromotionReadiness,
  buildAutoUpdateRecord,
  recordAutoUpdate,
  triggerRollback,
} from '@/lib/intelligence/autoLearning'
import type { LearningMetrics } from '@/lib/intelligence/autoLearning'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const user = await getAdminRole(req.headers.get('authorization')?.replace('Bearer ', '') ?? '')
  if (!user || !hasPermission(user.role, 'analytics:read')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const view = searchParams.get('view') ?? 'updates'

  try {
    if (view === 'updates') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabaseAdmin as any)
        .from('auto_model_updates')
        .select('*')
        .order('initiated_at', { ascending: false })
        .limit(50)
      if (error) throw new Error(error.message)
      return NextResponse.json({ updates: data ?? [] })
    }

    if (view === 'rollbacks') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabaseAdmin as any)
        .from('rollback_events')
        .select('*')
        .order('triggered_at', { ascending: false })
        .limit(50)
      if (error) throw new Error(error.message)
      return NextResponse.json({ rollbacks: data ?? [] })
    }

    if (view === 'health') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabaseAdmin as any)
        .from('v_learning_system_health')
        .select('*')
        .maybeSingle()
      if (error) throw new Error(error.message)
      return NextResponse.json({ health: data })
    }

    return NextResponse.json({ error: 'Unknown view' }, { status: 400 })
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
    const body   = await req.json()
    const action = body.action as string

    if (action === 'evaluate_trigger') {
      const metrics  = body.metrics as LearningMetrics
      const decision = shouldTriggerAutoUpdate(metrics, body.config)
      return NextResponse.json({ decision })
    }

    if (action === 'evaluate_rollback') {
      const decision = shouldTriggerRollback(body.baseline_accuracy, body.post_accuracy, body.config)
      return NextResponse.json({ decision })
    }

    if (action === 'evaluate_promotion') {
      const readiness = computePromotionReadiness(body.current_stage, body.metrics, body.shadow_run_hours)
      return NextResponse.json({ readiness })
    }

    if (action === 'record_update') {
      if (!hasPermission(user.role, 'commercial:write')) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
      }
      const record = buildAutoUpdateRecord(body.model_name, body.from_version, body.to_version, body.metrics, body.reason)
      const id     = await recordAutoUpdate(record)
      return NextResponse.json({ ok: true, id })
    }

    if (action === 'trigger_rollback') {
      if (!hasPermission(user.role, 'commercial:write')) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
      }
      const decision = shouldTriggerRollback(body.baseline_accuracy, body.post_accuracy)
      await triggerRollback(body.model_name, body.from_version, body.to_version, decision)
      return NextResponse.json({ ok: true, decision })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
