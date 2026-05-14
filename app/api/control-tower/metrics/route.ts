// =============================================================================
// AGENCY GROUP — SH-ROS Control Tower: Metrics API
// GET /api/control-tower/metrics — Prometheus-compatible metrics endpoint
// GET /api/control-tower/metrics?format=json — JSON metrics
// AMI: 22506 | Control Tower
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { isPortalAuth } from '@/lib/portalAuth'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'
export const revalidate = 0

// ─── Prometheus text format helpers ──────────────────────────────────────────

function gauge(name: string, value: number | null, labels: Record<string, string> = {}): string {
  if (value == null) return ''
  const labelStr = Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',')
  return `${name}{${labelStr}} ${value}\n`
}

function counter(name: string, value: number, labels: Record<string, string> = {}): string {
  const labelStr = Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',')
  return `${name}_total{${labelStr}} ${value}\n`
}

export async function GET(req: NextRequest) {
  if (!(await isPortalAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const format = searchParams.get('format') ?? 'prometheus'
  const org_id = searchParams.get('org_id') ?? 'default'

  const since1h  = new Date(Date.now() - 3_600_000).toISOString()
  const since24h = new Date(Date.now() - 86_400_000).toISOString()

  try {
    const [eventsRes, dlqRes, processingRes, autoRes] = await Promise.all([
      supabaseAdmin
        .from('runtime_events')
        .select('status, priority, type, latency_ms, economic_score')
        .eq('org_id', org_id)
        .gte('created_at', since1h)
        .limit(500),

      supabaseAdmin
        .from('runtime_events')
        .select('event_id', { count: 'exact', head: true })
        .eq('org_id', org_id)
        .eq('status', 'dlq'),

      supabaseAdmin
        .from('runtime_events')
        .select('event_id', { count: 'exact', head: true })
        .eq('org_id', org_id)
        .eq('status', 'processing'),

      supabaseAdmin
        .from('automations_log')
        .select('status')
        .gte('started_at', since24h)
        .like('workflow_name', 'agent:%')
        .limit(200),
    ])

    const events = eventsRes.data ?? []
    const byStatus: Record<string, number> = {}
    const byType: Record<string, number>   = {}
    let latencies: number[] = []
    let economicScores: number[] = []

    for (const e of events) {
      byStatus[e.status] = (byStatus[e.status] ?? 0) + 1
      byType[e.type]     = (byType[e.type]     ?? 0) + 1
      if (e.latency_ms != null) latencies.push(e.latency_ms)
      if (e.economic_score != null) economicScores.push(e.economic_score)
    }

    latencies.sort((a, b) => a - b)
    economicScores.sort((a, b) => a - b)

    const pct = (arr: number[], p: number) => arr.length > 0
      ? arr[Math.floor(arr.length * p / 100)] ?? null
      : null

    const autos  = autoRes.data ?? []
    const autoSuccess = autos.filter(a => a.status === 'success').length
    const autoTotal   = autos.length

    const metrics = {
      org_id,
      computed_at: new Date().toISOString(),
      events: {
        total_1h:        events.length,
        by_status:       byStatus,
        by_type:         byType,
        dlq_count:       dlqRes.count ?? 0,
        processing_count: processingRes.count ?? 0,
      },
      latency: {
        p50: pct(latencies, 50),
        p95: pct(latencies, 95),
        p99: pct(latencies, 99),
        sample_count: latencies.length,
      },
      economic: {
        avg_score: economicScores.length > 0
          ? parseFloat((economicScores.reduce((a, b) => a + b, 0) / economicScores.length).toFixed(4))
          : null,
        p50: pct(economicScores, 50),
        p95: pct(economicScores, 95),
      },
      agents: {
        executions_24h: autoTotal,
        success_rate:   autoTotal > 0 ? parseFloat((autoSuccess / autoTotal).toFixed(4)) : null,
      },
    }

    if (format === 'json') {
      return NextResponse.json(metrics, { status: 200 })
    }

    // Prometheus text format
    let prom = `# HELP shros_events_total_1h Total events processed in last 1h\n`
    prom += `# TYPE shros_events_total_1h gauge\n`
    prom += gauge('shros_events_total_1h', metrics.events.total_1h, { org_id })

    prom += `# HELP shros_dlq_count Current DLQ count\n`
    prom += `# TYPE shros_dlq_count gauge\n`
    prom += gauge('shros_dlq_count', metrics.events.dlq_count, { org_id })

    prom += `# HELP shros_processing_count Events currently processing\n`
    prom += `# TYPE shros_processing_count gauge\n`
    prom += gauge('shros_processing_count', metrics.events.processing_count, { org_id })

    prom += `# HELP shros_latency_p50_ms Latency p50 in ms\n`
    prom += `# TYPE shros_latency_p50_ms gauge\n`
    prom += gauge('shros_latency_p50_ms', metrics.latency.p50, { org_id })

    prom += `# HELP shros_latency_p95_ms Latency p95 in ms\n`
    prom += `# TYPE shros_latency_p95_ms gauge\n`
    prom += gauge('shros_latency_p95_ms', metrics.latency.p95, { org_id })

    prom += `# HELP shros_latency_p99_ms Latency p99 in ms\n`
    prom += `# TYPE shros_latency_p99_ms gauge\n`
    prom += gauge('shros_latency_p99_ms', metrics.latency.p99, { org_id })

    prom += `# HELP shros_economic_score_avg Average economic score\n`
    prom += `# TYPE shros_economic_score_avg gauge\n`
    prom += gauge('shros_economic_score_avg', metrics.economic.avg_score, { org_id })

    for (const [status, count] of Object.entries(byStatus)) {
      prom += counter('shros_events_by_status', count, { org_id, status })
    }

    prom += `# HELP shros_agent_success_rate Agent execution success rate (0-1)\n`
    prom += `# TYPE shros_agent_success_rate gauge\n`
    prom += gauge('shros_agent_success_rate', metrics.agents.success_rate, { org_id })

    return new NextResponse(prom, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8' },
    })

  } catch (err) {
    console.error('[GET /api/control-tower/metrics]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
