// GET  /api/ops/cron-health  — cron execution health + lock status
// POST /api/ops/cron-health  — force-release a stuck lock (super_admin only)

import { NextRequest, NextResponse }   from 'next/server'
import { getAdminRole, hasPermission } from '@/lib/auth/adminAuth'
import { getActiveLocks, forceReleaseLock, getLockStatus } from '@/lib/ops/cronLock'
import { supabaseAdmin }               from '@/lib/supabase'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')?.replace('Bearer ', '')
  const user       = await getAdminRole(authHeader ?? '')
  if (!user || !hasPermission(user.role, 'system:read_alerts')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url      = new URL(req.url)
  const cronName = url.searchParams.get('cron')

  try {
    if (cronName) {
      // Single cron detail
      const [lockStatus, recentRuns] = await Promise.all([
        getLockStatus(cronName),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabaseAdmin as any)
          .from('automations_log')
          .select('id, status, result, created_at')
          .eq('workflow_name', cronName)
          .order('created_at', { ascending: false })
          .limit(20),
      ])

      return NextResponse.json({
        cron_name:   cronName,
        lock_status: lockStatus,
        recent_runs: recentRuns.data ?? [],
        run_count:   (recentRuns.data ?? []).length,
      })
    }

    // All crons health view
    const [cronHealthView, activeLocks, recentErrors] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabaseAdmin as any)
        .from('v_cron_health')
        .select('*')
        .limit(50),
      getActiveLocks(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabaseAdmin as any)
        .from('automations_log')
        .select('workflow_name, status, result, created_at')
        .eq('status', 'error')
        .gte('created_at', new Date(Date.now() - 24 * 3600_000).toISOString())
        .order('created_at', { ascending: false })
        .limit(20),
    ])

    const health = cronHealthView.data ?? []
    const errors = recentErrors.data  ?? []

    return NextResponse.json({
      cron_health:      health,
      active_locks:     activeLocks,
      recent_errors:    errors,
      summary: {
        total_crons:    health.length,
        currently_locked: activeLocks.length,
        errors_24h:     errors.length,
        healthy_crons:  health.filter((c: { success_rate_pct: number }) => (c.success_rate_pct ?? 100) >= 90).length,
        degraded_crons: health.filter((c: { success_rate_pct: number }) => (c.success_rate_pct ?? 100) < 90).length,
      },
    })
  } catch (err) {
    console.error('[cron-health GET]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')?.replace('Bearer ', '')
  const user       = await getAdminRole(authHeader ?? '')
  // Force-releasing a lock is a super_admin operation
  if (!user || !hasPermission(user.role, 'roles:grant')) {
    return NextResponse.json({ error: 'Forbidden — requires super_admin' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { cron_name } = body
  if (!cron_name || typeof cron_name !== 'string') {
    return NextResponse.json({ error: 'cron_name required' }, { status: 400 })
  }

  try {
    await forceReleaseLock(cron_name)
    return NextResponse.json({
      success:   true,
      cron_name,
      message:   `Lock on '${cron_name}' force-released by ${user.user_email}`,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    )
  }
}
