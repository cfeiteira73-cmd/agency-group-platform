// GET /api/ops/health
// System health dashboard — ingestion, scoring, distribution, alerts, jobs.

import { NextRequest, NextResponse } from 'next/server'
import { getToken }                  from 'next-auth/jwt'
import { supabaseAdmin }             from '@/lib/supabase'
import { getAdminRole, hasPermission } from '@/lib/auth/adminAuth'
import { getActiveAlerts }           from '@/lib/ops/alertEngine'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const internalToken = req.headers.get('x-internal-token')
  const isInternal    = internalToken === process.env.CRON_SECRET

  if (!isInternal) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
    if (!token?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const admin = await getAdminRole(token.email as string)
    if (!admin || !hasPermission(admin.role, 'system:read_alerts')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = supabaseAdmin as any
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const [
      systemHealth,
      recentCrons,
      alerts,
      jobStats,
      qualityFlags,
      driftReport,
    ] = await Promise.all([
      // System health view
      admin.from('v_system_health').select('*').single(),

      // Recent cron executions (last 24h)
      admin.from('automations_log')
        .select('automation_type, outcome, ran_at')
        .gte('ran_at', since24h)
        .order('ran_at', { ascending: false })
        .limit(50),

      // Active alerts
      getActiveAlerts(),

      // Job queue stats
      admin.from('job_queue')
        .select('status')
        .gte('created_at', since30d),

      // Open quality flags
      admin.from('data_quality_flags')
        .select('severity')
        .eq('status', 'open'),

      // Latest drift report
      admin.from('calibration_recommendations')
        .select('generated_at, drift_signals, status')
        .order('generated_at', { ascending: false })
        .limit(1)
        .single(),
    ])

    // Compute job stats summary
    const jobRows = (jobStats.data ?? []) as Array<{ status: string }>
    const jobSummary = { pending: 0, running: 0, completed: 0, failed: 0, dead: 0 }
    for (const j of jobRows) {
      if (j.status in jobSummary) jobSummary[j.status as keyof typeof jobSummary]++
    }

    // Quality flags by severity
    const qFlags = (qualityFlags.data ?? []) as Array<{ severity: string }>
    const flagSummary = { critical: 0, warning: 0, info: 0 }
    for (const f of qFlags) {
      if (f.severity in flagSummary) flagSummary[f.severity as keyof typeof flagSummary]++
    }

    return NextResponse.json({
      system:        systemHealth.data ?? {},
      alerts: {
        active:    alerts.length,
        critical:  alerts.filter(a => a.severity === 'critical').length,
        warning:   alerts.filter(a => a.severity === 'warning').length,
        items:     alerts.slice(0, 10),
      },
      jobs:          jobSummary,
      quality_flags: flagSummary,
      crons: {
        recent_executions: (recentCrons.data ?? []).slice(0, 20),
      },
      drift: driftReport.data
        ? {
            generated_at: driftReport.data.generated_at,
            signals:      driftReport.data.drift_signals,
            status:       driftReport.data.status,
          }
        : null,
      generated_at: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[ops/health] error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
  }
}
