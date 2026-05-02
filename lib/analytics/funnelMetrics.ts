// =============================================================================
// Agency Group — Funnel Metrics Engine
// lib/analytics/funnelMetrics.ts
//
// Computes conversion rates through the full deal funnel:
//   Ingested → Scored → Distributed → Viewed → Replied → Meeting → Offer → Closed
//
// PURE FUNCTIONS (unit-testable):
//   computeFunnelConversions, computeGradeConversions, computeNetworkPerformance
//
// DB FUNCTIONS:
//   fetchFunnelCounts, fetchNetworkStats
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FunnelCounts {
  ingested:     number
  scored:       number
  distributed:  number
  opened:       number
  replied:      number
  meetings:     number
  offers:       number
  closed:       number
}

export interface FunnelStage {
  stage:          string
  count:          number
  conversion_pct: number | null   // vs previous stage
  drop_pct:       number | null   // drop from previous stage
}

export interface FunnelReport {
  stages:              FunnelStage[]
  overall_close_rate:  number | null   // closed / ingested
  top_drop_stage:      string | null   // stage with biggest drop
}

export interface GradeConversionRow {
  grade:            string
  distributed:      number
  closed:           number
  close_rate_pct:   number | null
  avg_commission:   number | null
}

export interface NetworkStats {
  top_agents:     Array<{
    agent_email:    string
    zone:           string
    close_rate_pct: number
    deals_won:      number
    avg_deal_size:  number | null
    tier:           string
  }>
  top_investors:  Array<{
    investor_id:    string
    engagement_score: number
    conversion_pct: number
    deals_total:    number
    tier:           string
  }>
  underperformers: Array<{
    partner_email: string
    partner_type:  string
    tier:          string
    tier_score:    number
    reason:        string
  }>
}

// ---------------------------------------------------------------------------
// PURE: Compute funnel conversion rates from raw counts
// ---------------------------------------------------------------------------

export function computeFunnelConversions(counts: FunnelCounts): FunnelReport {
  const ordered: Array<{ stage: string; count: number }> = [
    { stage: 'Ingested',     count: counts.ingested    },
    { stage: 'Scored',       count: counts.scored      },
    { stage: 'Distributed',  count: counts.distributed },
    { stage: 'Opened',       count: counts.opened      },
    { stage: 'Replied',      count: counts.replied     },
    { stage: 'Meetings',     count: counts.meetings    },
    { stage: 'Offers',       count: counts.offers      },
    { stage: 'Closed',       count: counts.closed      },
  ]

  const stages: FunnelStage[] = ordered.map((current, idx) => {
    if (idx === 0) {
      return { stage: current.stage, count: current.count, conversion_pct: null, drop_pct: null }
    }

    const prev = ordered[idx - 1]
    const conversion_pct = prev.count > 0
      ? parseFloat((current.count / prev.count * 100).toFixed(1))
      : null
    const drop_pct = conversion_pct != null
      ? parseFloat((100 - conversion_pct).toFixed(1))
      : null

    return { stage: current.stage, count: current.count, conversion_pct, drop_pct }
  })

  const overall_close_rate = counts.ingested > 0
    ? parseFloat((counts.closed / counts.ingested * 100).toFixed(2))
    : null

  // Find stage with biggest drop (excluding first stage)
  const stagesWithDrop = stages.filter(s => s.drop_pct != null)
  const topDropStage   = stagesWithDrop.reduce<FunnelStage | null>(
    (max, s) => (s.drop_pct != null && (max == null || s.drop_pct > (max.drop_pct ?? 0)) ? s : max),
    null,
  )

  return {
    stages,
    overall_close_rate,
    top_drop_stage: topDropStage?.stage ?? null,
  }
}

// ---------------------------------------------------------------------------
// PURE: Compute grade-level conversion rates
// ---------------------------------------------------------------------------

export function computeGradeConversions(
  rows: Array<{ grade: string; distributed: number; closed: number; avg_commission?: number | null }>,
): GradeConversionRow[] {
  return rows.map(r => ({
    grade:          r.grade,
    distributed:    r.distributed,
    closed:         r.closed,
    close_rate_pct: r.distributed > 0
      ? parseFloat((r.closed / r.distributed * 100).toFixed(1))
      : null,
    avg_commission: r.avg_commission ?? null,
  }))
}

// ---------------------------------------------------------------------------
// PURE: Summarize network performance from raw stats
// ---------------------------------------------------------------------------

export function summarizeNetworkHealth(stats: NetworkStats): {
  elite_agent_count:     number
  watchlist_count:       number
  top_agent_close_rate:  number | null
  avg_engagement_score:  number | null
} {
  const eliteAgents     = stats.top_agents.filter(a => a.tier === 'ELITE').length
  const watchlist       = stats.underperformers.length
  const topCloseRate    = stats.top_agents[0]?.close_rate_pct ?? null
  const avgEngagement   = stats.top_investors.length > 0
    ? parseFloat((
        stats.top_investors.reduce((s, i) => s + i.engagement_score, 0) / stats.top_investors.length
      ).toFixed(1))
    : null

  return {
    elite_agent_count:    eliteAgents,
    watchlist_count:      watchlist,
    top_agent_close_rate: topCloseRate,
    avg_engagement_score: avgEngagement,
  }
}

// ---------------------------------------------------------------------------
// DB: Fetch funnel counts from multiple tables
// ---------------------------------------------------------------------------

export async function fetchFunnelCounts(since?: Date): Promise<FunnelCounts> {
  const sinceDate = (since ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = supabaseAdmin as any

  const [ingestRes, scoredRes, distRes, feedbackRes] = await Promise.all([
    admin.from('properties')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', sinceDate),
    admin.from('properties')
      .select('id', { count: 'exact', head: true })
      .not('opportunity_score', 'is', null)
      .gte('created_at', sinceDate),
    admin.from('distribution_events')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', sinceDate),
    admin.from('scoring_feedback_events')
      .select('close_status')
      .gte('surfaced_at', sinceDate),
  ])

  const feedbackRows = (feedbackRes.data ?? []) as Array<{ close_status: string | null }>

  return {
    ingested:    ingestRes.count    ?? 0,
    scored:      scoredRes.count    ?? 0,
    distributed: distRes.count      ?? 0,
    opened:      feedbackRows.filter(r => r.close_status != null).length,
    replied:     0,   // requires email tracking integration
    meetings:    0,   // requires calendar integration
    offers:      feedbackRows.filter(r => r.close_status === 'won' || r.close_status === 'lost').length,
    closed:      feedbackRows.filter(r => r.close_status === 'won').length,
  }
}
