// GET /api/analytics/agent-performance
// Returns ranked agent performance with execution scores and tier breakdowns.
// Used by admin dashboard and deal distribution engine.

import { NextRequest, NextResponse } from 'next/server'
import { safeCompare }               from '@/lib/safeCompare'
import { getToken }                  from 'next-auth/jwt'
import { supabaseAdmin }             from '@/lib/supabase'
import { rankAgents }                from '@/lib/intelligence/agentPerformance'
import type { AgentMetrics }         from '@/lib/intelligence/agentPerformance'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  // Auth: session or cron token
  const internalToken = req.headers.get('x-internal-token')
  const bearer        = req.headers.get('authorization')?.replace('Bearer ', '')
  const isInternal    = safeCompare(internalToken ?? '', process.env.CRON_SECRET ?? '')
                     || safeCompare(bearer ?? '', process.env.CRON_SECRET ?? '')

  if (!isInternal) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Pull latest period per agent from the view
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseAdmin as any)
      .from('v_agent_performance_latest')
      .select('*')
      .order('agent_execution_score', { ascending: false })

    if (error) throw new Error(error.message)

    const rows = (data ?? []) as Array<{
      agent_email:               string
      total_deals_assigned:      number
      total_deals_closed:        number
      total_deals_lost:          number
      avg_days_to_close:         number | null
      avg_negotiation_delta_pct: number | null
      avg_deal_size:             number | null
      top_property_types:        string[]
      top_zones:                 string[]
      agent_execution_score:     number
      period_label:              string
      computed_at:               string
    }>

    // Build AgentMetrics array for live re-ranking
    const metricsArray: AgentMetrics[] = rows.map(r => ({
      agent_email:             r.agent_email,
      total_deals_assigned:    r.total_deals_assigned,
      total_deals_closed:      r.total_deals_closed,
      total_deals_lost:        r.total_deals_lost,
      avg_days_to_close:       r.avg_days_to_close,
      avg_negotiation_delta:   r.avg_negotiation_delta_pct,
      avg_deal_size:           r.avg_deal_size,
      top_property_types:      r.top_property_types ?? [],
      top_zones:               r.top_zones          ?? [],
    }))

    const ranked = rankAgents(metricsArray)

    return NextResponse.json({
      total_agents:    ranked.length,
      tiers: {
        elite:     ranked.filter(a => a.tier === 'ELITE').length,
        senior:    ranked.filter(a => a.tier === 'SENIOR').length,
        standard:  ranked.filter(a => a.tier === 'STANDARD').length,
        developing: ranked.filter(a => a.tier === 'DEVELOPING').length,
      },
      agents:       ranked,
      generated_at: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[agent-performance] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    )
  }
}
