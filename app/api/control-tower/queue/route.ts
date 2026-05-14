// =============================================================================
// AGENCY GROUP — SH-ROS Control Tower: Queue API
// GET /api/control-tower/queue — queue health and statistics
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

  try {
    const [statsRes, dlqRes, throughputRes] = await Promise.all([
      // Status distribution
      supabaseAdmin
        .from('runtime_events')
        .select('status, priority')
        .eq('org_id', org_id)
        .limit(1000),

      // DLQ detail
      supabaseAdmin
        .from('runtime_events')
        .select('event_id, type, correlation_id, retry_count, result, updated_at')
        .eq('org_id', org_id)
        .eq('status', 'dlq')
        .order('updated_at', { ascending: false })
        .limit(50),

      // Throughput last 24h (hourly buckets)
      supabaseAdmin
        .from('runtime_events')
        .select('status, created_at')
        .eq('org_id', org_id)
        .gte('created_at', since24h)
        .limit(1000),
    ])

    const allEvents = statsRes.data ?? []
    const byStatus: Record<string, number> = {}
    const byPriority: Record<string, number> = {}

    for (const e of allEvents) {
      byStatus[e.status]     = (byStatus[e.status]     ?? 0) + 1
      byPriority[e.priority] = (byPriority[e.priority] ?? 0) + 1
    }

    // Hourly throughput sparkline (last 24h)
    const hourlyThroughput: number[] = new Array(24).fill(0)
    const now = Date.now()
    for (const e of (throughputRes.data ?? [])) {
      const hoursAgo = Math.floor((now - new Date(e.created_at).getTime()) / 3_600_000)
      if (hoursAgo >= 0 && hoursAgo < 24) hourlyThroughput[23 - hoursAgo]++
    }

    // Provider detection
    const provider = process.env.REDIS_URL
      ? 'redis'
      : process.env.KAFKA_BROKERS
      ? 'kafka'
      : 'db_fallback'

    // Queue health assessment
    const pendingCount    = byStatus['pending']    ?? 0
    const processingCount = byStatus['processing'] ?? 0
    const dlqCount        = byStatus['dlq']        ?? 0

    const health = dlqCount > 10 ? 'degraded'
      : processingCount > 50    ? 'degraded'
      : pendingCount > 200      ? 'degraded'
      : 'healthy'

    return NextResponse.json({
      org_id,
      computed_at: new Date().toISOString(),
      provider,
      health,
      stats: {
        pending:    pendingCount,
        processing: processingCount,
        completed:  byStatus['completed']  ?? 0,
        failed:     byStatus['failed']     ?? 0,
        dlq:        dlqCount,
        total:      allEvents.length,
      },
      by_priority: byPriority,
      throughput_24h: hourlyThroughput,
      dlq_events: (dlqRes.data ?? []).map(e => ({
        event_id:       e.event_id,
        type:           e.type,
        correlation_id: e.correlation_id,
        retry_count:    e.retry_count,
        failed_at:      e.updated_at,
        error:          (e.result as Record<string, unknown> | null)?.error ?? null,
      })),
    }, { status: 200 })

  } catch (err) {
    console.error('[GET /api/control-tower/queue]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
