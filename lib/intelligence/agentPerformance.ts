// =============================================================================
// Agency Group — Agent Performance Intelligence Engine
// lib/intelligence/agentPerformance.ts
//
// Computes an agent_execution_score (0-100) from realized deal outcomes.
// Uses scoring_feedback_events as the single source of truth.
//
// SCORE DIMENSIONS:
//   close_rate_score    (0-30)  — deals_won / total_assigned
//   speed_score         (0-20)  — avg days to close vs PT market benchmark
//   negotiation_score   (0-25)  — avg (sale − ask) / ask (closer to 0 = better)
//   deal_size_score     (0-15)  — avg deal value
//   specialization_score (0-10) — depth in top-performing property types/zones
//
// PURE FUNCTIONS (unit-testable):
//   computeAgentExecutionScore, rankAgents
//
// DB FUNCTIONS:
//   computeAgentMetricsFromFeedback, computeAndPersistAllAgentMetrics
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentMetrics {
  agent_email:             string
  total_deals_assigned:    number
  total_deals_closed:      number
  total_deals_lost:        number
  avg_days_to_close:       number | null
  avg_negotiation_delta:   number | null   // % (negative = sold below ask — normal in PT)
  avg_deal_size:           number | null
  top_property_types:      string[]
  top_zones:               string[]
}

export interface AgentExecutionScore {
  close_rate_score:        number   // 0-30
  speed_score:             number   // 0-20
  negotiation_score:       number   // 0-25
  deal_size_score:         number   // 0-15
  specialization_score:    number   // 0-10
  total:                   number   // 0-100
}

export interface RankedAgent {
  agent_email:             string
  rank:                    number
  agent_execution_score:   number
  score_breakdown:         AgentExecutionScore
  metrics:                 AgentMetrics
  tier:                    'ELITE' | 'SENIOR' | 'STANDARD' | 'DEVELOPING'
}

// ---------------------------------------------------------------------------
// PURE: Close rate score (0-30)
// ---------------------------------------------------------------------------

function scoreCloseRate(metrics: AgentMetrics): number {
  const { total_deals_assigned, total_deals_closed } = metrics
  if (total_deals_assigned === 0) return 15   // no data → neutral
  const rate = total_deals_closed / total_deals_assigned
  if (rate >= 0.70) return 30
  if (rate >= 0.60) return 25
  if (rate >= 0.50) return 20
  if (rate >= 0.40) return 14
  if (rate >= 0.30) return 8
  return 3
}

// ---------------------------------------------------------------------------
// PURE: Speed score (0-20) — faster close = higher score
// PT market benchmark: ~90 days (national median 210 days but good agents close in 60-90)
// ---------------------------------------------------------------------------

function scoreSpeed(metrics: AgentMetrics): number {
  const days = metrics.avg_days_to_close
  if (days == null) return 10   // no data → neutral
  if (days <= 30)   return 20
  if (days <= 45)   return 17
  if (days <= 60)   return 14
  if (days <= 90)   return 10
  if (days <= 120)  return 6
  if (days <= 180)  return 3
  return 1
}

// ---------------------------------------------------------------------------
// PURE: Negotiation score (0-25)
// In PT market, deals typically close at -5% to -15% below ask.
// Best agents minimize concession (close to 0% delta or even positive).
// ---------------------------------------------------------------------------

function scoreNegotiation(metrics: AgentMetrics): number {
  const delta = metrics.avg_negotiation_delta
  if (delta == null) return 12   // no data → neutral
  // delta is % (sale - ask) / ask — typically negative
  if (delta >= -2)   return 25   // exceptional: near asking price
  if (delta >= -4)   return 22
  if (delta >= -6)   return 18   // strong
  if (delta >= -8)   return 14
  if (delta >= -12)  return 9    // average for PT market
  if (delta >= -15)  return 5
  return 2                        // heavy discounting required
}

// ---------------------------------------------------------------------------
// PURE: Deal size score (0-15) — larger deals = more complex skill
// ---------------------------------------------------------------------------

function scoreDealSize(metrics: AgentMetrics): number {
  const size = metrics.avg_deal_size
  if (size == null)     return 7    // no data → neutral
  if (size >= 1_000_000) return 15
  if (size >= 750_000)   return 13
  if (size >= 500_000)   return 10
  if (size >= 300_000)   return 7
  if (size >= 150_000)   return 4
  return 2
}

// ---------------------------------------------------------------------------
// PURE: Specialization score (0-10) — depth in a segment beats breadth
// ---------------------------------------------------------------------------

function scoreSpecialization(metrics: AgentMetrics): number {
  const typeDepth = metrics.top_property_types.length
  const zoneDepth = metrics.top_zones.length

  // More deals in fewer types = deeper specialization
  if (typeDepth >= 1 && metrics.total_deals_closed >= 5)  return 10
  if (typeDepth >= 1 && metrics.total_deals_closed >= 3)  return 7
  if (typeDepth >= 1 && metrics.total_deals_closed >= 2)  return 5
  if (zoneDepth >= 1 && metrics.total_deals_closed >= 1)  return 3
  return 2   // generalist / few deals
}

// ---------------------------------------------------------------------------
// PURE: Compute agent execution score
// ---------------------------------------------------------------------------

export function computeAgentExecutionScore(metrics: AgentMetrics): AgentExecutionScore {
  const close_rate_score    = scoreCloseRate(metrics)
  const speed_score         = scoreSpeed(metrics)
  const negotiation_score   = scoreNegotiation(metrics)
  const deal_size_score     = scoreDealSize(metrics)
  const specialization_score = scoreSpecialization(metrics)

  return {
    close_rate_score,
    speed_score,
    negotiation_score,
    deal_size_score,
    specialization_score,
    total: Math.min(100, Math.round(
      close_rate_score + speed_score + negotiation_score + deal_size_score + specialization_score,
    )),
  }
}

// ---------------------------------------------------------------------------
// PURE: Assign agent tier from execution score
// ---------------------------------------------------------------------------

export function assignAgentTier(score: number): RankedAgent['tier'] {
  if (score >= 80) return 'ELITE'
  if (score >= 65) return 'SENIOR'
  if (score >= 45) return 'STANDARD'
  return 'DEVELOPING'
}

// ---------------------------------------------------------------------------
// PURE: Rank array of agents by execution score (descending)
// ---------------------------------------------------------------------------

export function rankAgents(metricsArray: AgentMetrics[]): RankedAgent[] {
  return metricsArray
    .map(m => {
      const breakdown = computeAgentExecutionScore(m)
      return {
        agent_email:           m.agent_email,
        rank:                  0,   // set after sort
        agent_execution_score: breakdown.total,
        score_breakdown:       breakdown,
        metrics:               m,
        tier:                  assignAgentTier(breakdown.total),
      }
    })
    .sort((a, b) => b.agent_execution_score - a.agent_execution_score)
    .map((r, idx) => ({ ...r, rank: idx + 1 }))
}

// ---------------------------------------------------------------------------
// DB: Compute agent metrics from scoring_feedback_events
// ---------------------------------------------------------------------------

interface FeedbackRow {
  agent_email:             string | null
  deal_won:                boolean | null
  close_status:            string | null
  realized_sale_price:     number | null
  realized_dom:            number | null
  negotiation_delta_pct:   number | null
  asking_price:            number | null
  opportunity_grade:       string | null
}

export async function computeAgentMetricsFromFeedback(
  agentEmail: string,
  since: Date,
): Promise<AgentMetrics> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from('scoring_feedback_events')
    .select([
      'agent_email', 'deal_won', 'close_status',
      'realized_sale_price', 'realized_dom', 'negotiation_delta_pct', 'asking_price',
    ].join(','))
    .eq('agent_email', agentEmail)
    .gte('surfaced_at', since.toISOString())

  if (error) throw new Error(`computeAgentMetrics: ${error.message}`)

  const rows: FeedbackRow[] = data ?? []
  const closed  = rows.filter(r => r.close_status === 'won')
  const lost    = rows.filter(r => r.close_status === 'lost')

  const domValues  = closed.filter(r => r.realized_dom   != null).map(r => r.realized_dom!)
  const negDeltas  = closed.filter(r => r.negotiation_delta_pct != null).map(r => r.negotiation_delta_pct!)
  const dealSizes  = closed.filter(r => r.realized_sale_price != null).map(r => r.realized_sale_price!)

  const avgDom   = domValues.length  > 0 ? domValues.reduce((s, v) => s + v, 0) / domValues.length  : null
  const avgDelta = negDeltas.length  > 0 ? negDeltas.reduce((s, v) => s + v, 0) / negDeltas.length  : null
  const avgSize  = dealSizes.length  > 0 ? dealSizes.reduce((s, v) => s + v, 0) / dealSizes.length  : null

  return {
    agent_email:           agentEmail,
    total_deals_assigned:  rows.length,
    total_deals_closed:    closed.length,
    total_deals_lost:      lost.length,
    avg_days_to_close:     avgDom   != null ? parseFloat(avgDom.toFixed(1))   : null,
    avg_negotiation_delta: avgDelta != null ? parseFloat(avgDelta.toFixed(3)) : null,
    avg_deal_size:         avgSize  != null ? parseFloat(avgSize.toFixed(2))  : null,
    top_property_types:    [],   // would need property type join — simplified for now
    top_zones:             [],
  }
}

// ---------------------------------------------------------------------------
// DB: Compute and persist metrics for all active agents
// ---------------------------------------------------------------------------

export async function computeAndPersistAllAgentMetrics(
  since?: Date,
  periodLabel = '90d',
): Promise<{ computed: number; errors: string[] }> {
  const sinceDate   = since ?? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  const periodStart = sinceDate.toISOString().split('T')[0]
  const periodEnd   = new Date().toISOString().split('T')[0]

  // Get distinct agent emails from feedback events
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: agentRows, error: agentError } = await (supabaseAdmin as any)
    .from('scoring_feedback_events')
    .select('agent_email')
    .gte('surfaced_at', sinceDate.toISOString())
    .not('agent_email', 'is', null)

  if (agentError) return { computed: 0, errors: [agentError.message] }

  const uniqueEmails: string[] = [...new Set<string>((agentRows ?? []).map((r: {agent_email: string}) => r.agent_email as string))]

  let computed = 0
  const errors: string[] = []

  for (const email of uniqueEmails) {
    try {
      const metrics   = await computeAgentMetricsFromFeedback(email, sinceDate)
      const scoreData = computeAgentExecutionScore(metrics)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabaseAdmin as any)
        .from('agent_performance_metrics')
        .upsert({
          agent_email:               email,
          period_start:              periodStart,
          period_end:                periodEnd,
          period_label:              periodLabel,
          total_deals_assigned:      metrics.total_deals_assigned,
          total_deals_closed:        metrics.total_deals_closed,
          total_deals_lost:          metrics.total_deals_lost,
          total_deals_stale:         0,
          close_rate:                metrics.total_deals_assigned > 0
            ? parseFloat((metrics.total_deals_closed / metrics.total_deals_assigned).toFixed(4))
            : null,
          avg_days_to_close:         metrics.avg_days_to_close,
          avg_negotiation_delta_pct: metrics.avg_negotiation_delta,
          avg_deal_size:             metrics.avg_deal_size,
          close_rate_score:          scoreData.close_rate_score,
          speed_score:               scoreData.speed_score,
          negotiation_score:         scoreData.negotiation_score,
          deal_size_score:           scoreData.deal_size_score,
          specialization_score:      scoreData.specialization_score,
          agent_execution_score:     scoreData.total,
          top_property_types:        metrics.top_property_types,
          top_zones:                 metrics.top_zones,
          computed_at:               new Date().toISOString(),
        }, { onConflict: 'agent_email, period_start, period_end' })

      if (error) errors.push(`${email}: ${error.message}`)
      else computed++
    } catch (err) {
      errors.push(`${email}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return { computed, errors }
}
