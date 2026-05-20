// =============================================================================
// AGENCY GROUP — SH-ROS Control Tower: Agents API
// GET /api/control-tower/agents — all agent health + execution stats
// AMI: 22506 | Control Tower
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { isPortalAuth } from '@/lib/portalAuth'
import { supabaseAdmin } from '@/lib/supabase'
import { agentRegistry } from '@/lib/agents/registry'
import { getRequestCorrelationId } from '@/lib/observability/correlation'

export const runtime = 'nodejs'
export const revalidate = 0

export async function GET(req: NextRequest) {
  const corrId = getRequestCorrelationId(req)
  if (!(await isPortalAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const since24h = new Date(Date.now() - 86_400_000).toISOString()
  const since1h  = new Date(Date.now() -  3_600_000).toISOString()

  try {
    // Last 500 automation log entries for agent executions
    const { data: logs } = await supabaseAdmin
      .from('automations_log')
      .select('workflow_name, status, duration_ms, started_at, outcome, error_message')
      .like('workflow_name', 'agent:%')
      .gte('started_at', since24h)
      .order('started_at', { ascending: false })
      .limit(500)

    // Build per-agent stats
    const registrations = agentRegistry.list()
    const agentStats = registrations.map(reg => {
      const agentLogs = (logs ?? []).filter(l => l.workflow_name === `agent:${reg.id}`)
      const successLogs = agentLogs.filter(l => l.status === 'success')
      const failedLogs  = agentLogs.filter(l => l.status === 'error')
      const last24hCount = agentLogs.length
      const last1hCount  = agentLogs.filter(l => l.started_at >= since1h).length

      const avgDuration = agentLogs.length > 0
        ? Math.round(agentLogs.reduce((s, l) => s + (l.duration_ms ?? 0), 0) / agentLogs.length)
        : null

      const lastRun = agentLogs[0] ?? null
      const lastStatus: 'success' | 'error' | 'idle' = lastRun
        ? (lastRun.status === 'success' ? 'success' : 'error')
        : 'idle'

      // EV score from outcome.ev_score
      const evScores = agentLogs
        .map(l => (l.outcome as Record<string, unknown> | null)?.ev_score as number | undefined)
        .filter((s): s is number => typeof s === 'number')
      const avgEV = evScores.length > 0
        ? parseFloat((evScores.reduce((a, b) => a + b, 0) / evScores.length).toFixed(2))
        : null

      const successRate = last24hCount > 0
        ? Math.round((successLogs.length / last24hCount) * 100)
        : null

      return {
        id:           reg.id,
        name:         reg.name,
        description:  reg.description,
        layer:        reg.config.layer ?? 'unknown',
        config: {
          rate_limit_per_hour:    reg.config.rate_limit_per_hour,
          timeout_ms:             reg.config.timeout_ms,
          require_human_approval: reg.config.require_human_approval,
          can_send_comms:         reg.config.can_send_comms,
        },
        health: {
          status:         lastStatus,
          last_run_at:    lastRun?.started_at ?? null,
          last_duration_ms: lastRun?.duration_ms ?? null,
          last_error:     lastStatus === 'error' ? (lastRun?.error_message ?? null) : null,
        },
        stats_24h: {
          runs:         last24hCount,
          runs_1h:      last1hCount,
          successes:    successLogs.length,
          failures:     failedLogs.length,
          success_rate: successRate,
          avg_duration_ms: avgDuration,
          avg_ev_score: avgEV,
        },
      }
    })

    // Layer groupings
    const byLayer: Record<string, typeof agentStats> = {}
    for (const a of agentStats) {
      const layer = a.layer as string
      if (!byLayer[layer]) byLayer[layer] = []
      byLayer[layer].push(a)
    }

    const summary = {
      total:    agentStats.length,
      healthy:  agentStats.filter(a => a.health.status === 'success').length,
      degraded: agentStats.filter(a => a.health.status === 'error').length,
      idle:     agentStats.filter(a => a.health.status === 'idle').length,
    }

    return NextResponse.json({
      computed_at: new Date().toISOString(),
      summary,
      agents: agentStats,
      by_layer: byLayer,
    }, { status: 200 })

  } catch (err) {
    console.error('[GET /api/control-tower/agents]', err, { corrId })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
