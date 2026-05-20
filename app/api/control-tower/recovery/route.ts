// =============================================================================
// AGENCY GROUP — SH-ROS Control Tower: Recovery API
// POST /api/control-tower/recovery — trigger recovery operations
// GET  /api/control-tower/recovery — recovery status + history
// AMI: 22506 | Control Tower
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { isPortalAuth } from '@/lib/portalAuth'
import { getAdminRole } from '@/lib/auth/adminAuth'
import { supabaseAdmin } from '@/lib/supabase'
import { safeCompare } from '@/lib/safeCompare'
import { getRequestCorrelationId } from '@/lib/observability/correlation'

export const runtime = 'nodejs'

type RecoveryAction = 'recover_orphans' | 'replay_dlq' | 'reconcile' | 'full_recovery'

// ─── GET — current recovery status ───────────────────────────────────────────

export async function GET(req: NextRequest) {
  const corrId = getRequestCorrelationId(req)
  if (!(await isPortalAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const org_id = searchParams.get('org_id') ?? 'default'
  const stuckThresholdMs = 5 * 60 * 1000 // 5 minutes
  const stuckSince = new Date(Date.now() - stuckThresholdMs).toISOString()

  try {
    const [orphansRes, dlqRes, historyRes] = await Promise.all([
      // Orphaned events (processing > 5min)
      supabaseAdmin
        .from('runtime_events')
        .select('event_id, type, correlation_id, updated_at')
        .eq('org_id', org_id)
        .eq('status', 'processing')
        .lt('updated_at', stuckSince)
        .limit(50),

      // DLQ events
      supabaseAdmin
        .from('runtime_events')
        .select('event_id, type, correlation_id, retry_count, updated_at')
        .eq('org_id', org_id)
        .eq('status', 'dlq')
        .order('updated_at', { ascending: false })
        .limit(20),

      // Recovery history from learning_events
      supabaseAdmin
        .from('learning_events')
        .select('id, metadata, created_at')
        .eq('event_type', 'recovery_run')
        .order('created_at', { ascending: false })
        .limit(10),
    ])

    return NextResponse.json({
      org_id,
      computed_at: new Date().toISOString(),
      status: {
        orphaned_count: orphansRes.data?.length ?? 0,
        dlq_count:      dlqRes.data?.length ?? 0,
        health:         (orphansRes.data?.length ?? 0) > 0 || (dlqRes.data?.length ?? 0) > 0
          ? 'degraded' : 'healthy',
      },
      orphaned_events: orphansRes.data ?? [],
      dlq_events:      dlqRes.data ?? [],
      recovery_history: (historyRes.data ?? []).map(r => ({
        run_id:   r.id,
        ...((r.metadata as Record<string, unknown>) ?? {}),
        executed_at: r.created_at,
      })),
    }, { status: 200 })

  } catch (err) {
    console.error('[GET /api/control-tower/recovery]', err, { corrId })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// ─── POST — trigger recovery action ──────────────────────────────────────────

export async function POST(req: NextRequest) {
  const corrId = getRequestCorrelationId(req)
  if (!(await isPortalAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // RBAC — only super_admin and ops_manager may trigger recovery
  const authHeader = req.headers.get('authorization')?.replace('Bearer ', '') ?? ''
  const isServiceCall =
    (process.env.CRON_SECRET      && safeCompare(authHeader, process.env.CRON_SECRET)) ||
    (process.env.INTERNAL_API_TOKEN && safeCompare(authHeader, process.env.INTERNAL_API_TOKEN))

  if (!isServiceCall) {
    let cookieEmail: string | null = null
    try {
      const cookieHeader = req.headers.get('cookie') ?? ''
      const match = cookieHeader.match(/(?:^|;\s*)ag-auth-token=([^;]+)/)
      if (match) {
        const token  = decodeURIComponent(match[1])
        const dotIdx = token.lastIndexOf('.')
        if (dotIdx !== -1) {
          const data = JSON.parse(Buffer.from(token.slice(0, dotIdx), 'base64url').toString())
          if (typeof data.email === 'string') cookieEmail = data.email
        }
      }
    } catch { /* ignore */ }

    if (cookieEmail) {
      const adminUser = await getAdminRole(cookieEmail)
      if (adminUser?.role !== 'super_admin' && adminUser?.role !== 'ops_manager') {
        return NextResponse.json({ error: 'Forbidden: insufficient role' }, { status: 403 })
      }
    }
  }

  let body: { action: RecoveryAction; org_id?: string; dry_run?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { action, org_id = 'default', dry_run = false } = body

  const validActions: RecoveryAction[] = ['recover_orphans', 'replay_dlq', 'reconcile', 'full_recovery']
  if (!validActions.includes(action)) {
    return NextResponse.json({ error: `Invalid action. Must be one of: ${validActions.join(', ')}` }, { status: 400 })
  }

  const runId   = crypto.randomUUID()
  const startMs = Date.now()

  try {
    let result: Record<string, unknown> = { action, org_id, dry_run, run_id: runId }

    if (action === 'recover_orphans' || action === 'full_recovery') {
      const stuckSince = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      const { data: orphans } = await supabaseAdmin
        .from('runtime_events')
        .select('event_id')
        .eq('org_id', org_id)
        .eq('status', 'processing')
        .lt('updated_at', stuckSince)

      if (!dry_run && orphans && orphans.length > 0) {
        await supabaseAdmin
          .from('runtime_events')
          .update({ status: 'failed', updated_at: new Date().toISOString(),
                    result: { error: 'Recovered from orphaned processing state', recovered_by: 'control-tower' } })
          .in('event_id', orphans.map(o => o.event_id))
      }

      result = { ...result, orphans_recovered: orphans?.length ?? 0 }
    }

    if (action === 'replay_dlq' || action === 'full_recovery') {
      const { data: dlqEvents } = await supabaseAdmin
        .from('runtime_events')
        .select('event_id, retry_count')
        .eq('org_id', org_id)
        .eq('status', 'dlq')
        .lt('retry_count', 3)

      if (!dry_run && dlqEvents && dlqEvents.length > 0) {
        await supabaseAdmin
          .from('runtime_events')
          .update({ status: 'pending', updated_at: new Date().toISOString() })
          .in('event_id', dlqEvents.map(e => e.event_id))
      }

      result = { ...result, dlq_replayed: dlqEvents?.length ?? 0 }
    }

    if (action === 'reconcile' || action === 'full_recovery') {
      // Reconcile: find processing events that should be completed
      const { data: stuck } = await supabaseAdmin
        .from('runtime_events')
        .select('event_id')
        .eq('org_id', org_id)
        .eq('status', 'processing')
        .limit(100)

      result = { ...result, stuck_found: stuck?.length ?? 0 }
    }

    const duration_ms = Date.now() - startMs
    result = { ...result, duration_ms, completed_at: new Date().toISOString() }

    // Log recovery run
    if (!dry_run) {
      void supabaseAdmin.from('learning_events').insert({
        event_type:    'recovery_run',
        source_system: 'agent',
        metadata:      result,
      })
    }

    return NextResponse.json(result, { status: 200 })

  } catch (err) {
    console.error('[POST /api/control-tower/recovery]', { action, org_id, error: err, corrId })
    return NextResponse.json({ error: 'Recovery failed', run_id: runId }, { status: 500 })
  }
}
