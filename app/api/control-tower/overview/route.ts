// =============================================================================
// AGENCY GROUP — SH-ROS Control Tower: Overview API
// GET /api/control-tower/overview — aggregated system health snapshot
// AMI: 22506 | Control Tower
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { isPortalAuth } from '@/lib/portalAuth'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'
export const revalidate = 0

export async function GET(req: NextRequest) {
  if (!(await isPortalAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const org_id = searchParams.get('org_id') ?? 'default'

  const since24h = new Date(Date.now() - 86_400_000).toISOString()
  const since1h  = new Date(Date.now() -  3_600_000).toISOString()

  try {
    const [eventsRes, dlqRes, alertsRes, automationsRes] = await Promise.all([
      // Events last 24h by status
      supabaseAdmin
        .from('runtime_events')
        .select('status, priority, latency_ms, economic_score, created_at')
        .eq('org_id', org_id)
        .gte('created_at', since24h)
        .limit(500),

      // DLQ count
      supabaseAdmin
        .from('runtime_events')
        .select('event_id', { count: 'exact', head: true })
        .eq('org_id', org_id)
        .eq('status', 'dlq'),

      // Active critical alerts
      supabaseAdmin
        .from('system_alerts')
        .select('id, alert_type, severity, message, created_at')
        .eq('status', 'open')
        .in('severity', ['P0', 'P1'])
        .gte('created_at', since24h)
        .order('created_at', { ascending: false })
        .limit(10),

      // Automation success rate (24h)
      supabaseAdmin
        .from('automations_log')
        .select('status, duration_ms')
        .gte('started_at', since24h)
        .limit(200),
    ])

    const events = eventsRes.data ?? []
    const byStatus: Record<string, number> = {}
    const byPriority: Record<string, number> = {}
    let totalLatency = 0
    let latencyCount = 0
    let totalEconomicScore = 0
    let economicCount = 0

    for (const e of events) {
      byStatus[e.status]     = (byStatus[e.status]     ?? 0) + 1
      byPriority[e.priority] = (byPriority[e.priority] ?? 0) + 1
      if (e.latency_ms != null) { totalLatency += e.latency_ms; latencyCount++ }
      if (e.economic_score != null) { totalEconomicScore += e.economic_score; economicCount++ }
    }

    const automations = automationsRes.data ?? []
    const autoTotal   = automations.length
    const autoSuccess = automations.filter(a => a.status === 'success').length

    // Throughput sparkline: events per hour for last 24h
    const sparkline: number[] = new Array(24).fill(0)
    const now = Date.now()
    for (const e of events) {
      const hoursAgo = Math.floor((now - new Date(e.created_at).getTime()) / 3_600_000)
      if (hoursAgo >= 0 && hoursAgo < 24) sparkline[23 - hoursAgo]++
    }

    return NextResponse.json({
      org_id,
      computed_at: new Date().toISOString(),
      kpis: {
        events_total_24h:      events.length,
        events_last_1h:        events.filter(e => e.created_at >= since1h).length,
        dlq_count:             dlqRes.count ?? 0,
        avg_latency_ms:        latencyCount > 0 ? Math.round(totalLatency / latencyCount) : null,
        avg_economic_score:    economicCount > 0 ? parseFloat((totalEconomicScore / economicCount).toFixed(4)) : null,
        critical_alerts:       alertsRes.data?.length ?? 0,
        automation_success_pct: autoTotal > 0 ? Math.round((autoSuccess / autoTotal) * 100) : null,
      },
      by_status:   byStatus,
      by_priority: byPriority,
      sparkline_24h: sparkline,
      active_alerts: alertsRes.data ?? [],
    }, { status: 200 })

  } catch (err) {
    console.error('[GET /api/control-tower/overview]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
