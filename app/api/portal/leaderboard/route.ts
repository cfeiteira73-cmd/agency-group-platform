// =============================================================================
// Agency Group — Agent Leaderboard & Performance Scorecards API
// GET /api/portal/leaderboard — agent rankings and performance metrics
// Auth: portal auth required
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { requirePortalAuth } from '@/lib/requirePortalAuth'
import { supabaseAdmin } from '@/lib/supabase'
import { getRequestCorrelationId } from '@/lib/observability/correlation'
import log from '@/lib/logger'
import { WON_STAGES } from '@/lib/constants/pipeline'

export const runtime = 'nodejs'

interface DealRow {
  assigned_consultant: string | null
  gci_net: number | null
  deal_value: number | null
  stage: string | null
  created_at: string
}

interface WinLossRow {
  agent_id: string
  outcome: string
  deal_value: number | null
  commission_lost: number | null
}

interface RankingEntry {
  agent_email: string
  gci_generated: number
  deals_won: number
  pipeline_value: number
  rank_this_period: number
  composite_score: number | null
  period_type: string
  period_start: string
  win_rate: number | null
  commission_lost_period: number
}

export async function GET(req: NextRequest) {
  const check = await requirePortalAuth(req)
  if (!check.ok) return check.response

  const corrId = getRequestCorrelationId(req)
  const { searchParams } = new URL(req.url)
  const period = searchParams.get('period') || 'monthly'
  const month  = searchParams.get('month')  || new Date().toISOString().slice(0, 7)

  try {
    // Attempt to load pre-computed scorecards
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: scorecards = [], error: scErr } = await supabaseAdmin
      .from('performance_scorecards')
      .select('*')
      .eq('period_type', period as 'weekly' | 'monthly' | 'quarterly')
      .gte('period_start', `${month}-01`)
      .order('composite_score', { ascending: false }) as unknown as { data: RankingEntry[]; error: { message: string } | null }

    if (scErr) {
      log.warn('[leaderboard] scorecards query error', { route: 'api/portal/leaderboard', error: scErr.message })
    }

    let rankings: RankingEntry[] = scorecards

    // If no pre-computed scorecards exist, derive from live deals data
    if (!scorecards.length) {
      const startDate = `${month}-01`
      const endDate = new Date(
        new Date(startDate).getFullYear(),
        new Date(startDate).getMonth() + 1,
        0,
      ).toISOString().slice(0, 10)

      const { data: deals } = await supabaseAdmin
        .from('deals')
        .select('assigned_consultant,gci_net,deal_value,stage,created_at')
        .gte('created_at', startDate)
        .lte('created_at', endDate)

      if (deals) {
        // WON_STAGES normalised to lowercase for `stage` column (EN lowercase schema)
        const CLOSED_STAGES = new Set<string>([
          ...(WON_STAGES as readonly string[]),
          ...WON_STAGES.map(s => s.toLowerCase()),
        ])
        const agentMap: Record<string, { gci: number; deals: number; pipeline: number }> = {}

        for (const d of (deals as unknown as DealRow[])) {
          const agent = d.assigned_consultant ?? 'unassigned'
          if (!agentMap[agent]) agentMap[agent] = { gci: 0, deals: 0, pipeline: 0 }
          if (CLOSED_STAGES.has(d.stage ?? '')) {
            agentMap[agent].gci    += d.gci_net    ?? 0
            agentMap[agent].deals  += 1
          } else {
            agentMap[agent].pipeline += d.deal_value ?? 0
          }
        }

        rankings = Object.entries(agentMap)
          .map(([email, stats]) => ({
            agent_email:        email,
            gci_generated:      stats.gci,
            deals_won:          stats.deals,
            pipeline_value:     stats.pipeline,
            rank_this_period:   0, // set after sort
            composite_score:    null,
            period_type:        period,
            period_start:       startDate,
            win_rate:           null,
            commission_lost_period: 0,
          }))
          .sort((a, b) => b.gci_generated - a.gci_generated)
          .map((r, idx) => ({ ...r, rank_this_period: idx + 1 }))
      }
    }

    // Enrich with win/loss data for the period
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: wlData = [] } = await supabaseAdmin
      .from('win_loss_events')
      .select('agent_id,outcome,deal_value,commission_lost')
      .gte('recorded_at', `${month}-01`) as { data: WinLossRow[] }

    const enriched: RankingEntry[] = rankings.map(r => {
      const agentWL = wlData.filter(w => w.agent_id === r.agent_email)
      const wins    = agentWL.filter(w => w.outcome === 'won').length
      const losses  = agentWL.filter(w => w.outcome === 'lost').length
      const total_wl = wins + losses
      return {
        ...r,
        win_rate: total_wl ? Math.round((wins / total_wl) * 100) : null,
        commission_lost_period: agentWL
          .filter(w => w.outcome === 'lost')
          .reduce((s, w) => s + (w.commission_lost ?? 0), 0),
      }
    })

    return NextResponse.json({
      period,
      month,
      rankings: enriched,
      total_agents: enriched.length,
      top_performer: enriched[0] ?? null,
      team_gci: enriched.reduce((s, r) => s + (r.gci_generated ?? 0), 0),
    }, {
      headers: { 'x-correlation-id': corrId, 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    log.error('[leaderboard] GET error', err instanceof Error ? err : new Error(String(err)), { route: 'api/portal/leaderboard' })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
