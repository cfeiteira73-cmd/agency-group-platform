// Agency Group — Investor Network Feedback Processor
// lib/investors/networkFeedbackProcessor.ts
// TypeScript strict — 0 errors
//
// Processes engagement events to update investor routing weights and graph edges.
// Called by cron job. Reads from investor_engagement_events and commission_events.
// Updates investor_graph_edges weight field based on outcome history.
// This is the learning loop: network improves with each deal closed or lost.

import { supabaseAdmin } from '@/lib/supabase'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface InvestorNetworkStats {
  investor_id:              string
  total_matches_viewed:     number
  total_offers_made:        number
  total_deals_closed:       number
  total_rejections:         number
  conversion_rate:          number         // deals_closed / matches_viewed
  avg_response_time_hours:  number | null
  last_engagement_at:       string | null
  network_score:            number          // 0-100 composite score
  routing_tier:             'platinum' | 'gold' | 'silver' | 'bronze'
}

export interface FeedbackProcessingResult {
  tenant_id:           string
  investors_processed: number
  edges_updated:       number
  avg_network_score:   number
  top_investors:       string[]    // top 5 investor IDs by network_score
  processed_at:        string
}

// ─── Engagement row shape ──────────────────────────────────────────────────────

interface EngagementEventRow {
  investor_id:          string
  event_type:           string
  response_time_hours:  number | null
  occurred_at:          string
}

// ─── Tier resolution ───────────────────────────────────────────────────────────

function resolveRoutingTier(
  score: number,
): InvestorNetworkStats['routing_tier'] {
  if (score >= 80) return 'platinum'
  if (score >= 60) return 'gold'
  if (score >= 40) return 'silver'
  return 'bronze'
}

// ─── computeInvestorNetworkStats ───────────────────────────────────────────────

/**
 * Compute live network stats for a single investor from engagement history.
 */
export async function computeInvestorNetworkStats(
  investorId:    string,
  tenantId:      string,
  lookbackDays?: number,   // default 90
): Promise<InvestorNetworkStats> {
  const db      = supabaseAdmin as any
  const days    = lookbackDays ?? 90
  const since   = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const blank: InvestorNetworkStats = {
    investor_id:             investorId,
    total_matches_viewed:    0,
    total_offers_made:       0,
    total_deals_closed:      0,
    total_rejections:        0,
    conversion_rate:         0,
    avg_response_time_hours: null,
    last_engagement_at:      null,
    network_score:           50,
    routing_tier:            'bronze',
  }

  try {
    const { data, error } = await db
      .from('investor_engagement_events')
      .select('investor_id, event_type, response_time_hours, occurred_at')
      .eq('investor_id', investorId)
      .eq('tenant_id', tenantId)
      .gte('occurred_at', since)
      .order('occurred_at', { ascending: false })

    if (error) {
      console.error('[NetworkFeedbackProcessor] computeInvestorNetworkStats query error:', error.message, { investorId, tenantId })
      return blank
    }

    const rows = (data ?? []) as EngagementEventRow[]

    if (rows.length === 0) return blank

    // ── Count by event_type ────────────────────────────────────────────────────
    let match_viewed_count  = 0
    let offer_made_count    = 0
    let deal_closed_count   = 0
    let rejection_count     = 0

    const responseTimes: number[] = []

    for (const row of rows) {
      switch (row.event_type) {
        case 'match_viewed':    match_viewed_count++;  break
        case 'offer_made':      offer_made_count++;    break
        case 'deal_closed':     deal_closed_count++;   break
        case 'offer_rejected':  rejection_count++;     break
        default:                                       break
      }
      if (row.response_time_hours !== null) {
        responseTimes.push(row.response_time_hours)
      }
    }

    const conversion_rate = Math.min(
      deal_closed_count / Math.max(match_viewed_count, 1),
      1.0,
    )

    const avg_response_time_hours =
      responseTimes.length > 0
        ? responseTimes.reduce((s, h) => s + h, 0) / responseTimes.length
        : null

    const offer_rate        = offer_made_count / Math.max(match_viewed_count, 1)
    const rejection_rate    = rejection_count  / Math.max(match_viewed_count, 1)

    let response_speed_bonus = 0
    if (avg_response_time_hours !== null) {
      if      (avg_response_time_hours < 4)  response_speed_bonus = 10
      else if (avg_response_time_hours < 24) response_speed_bonus = 5
    }

    const raw_score =
      50 +
      (conversion_rate * 30) +
      (offer_rate      * 10) +
      response_speed_bonus   -
      (rejection_rate  * 10)

    const network_score = Math.round(Math.max(0, Math.min(100, raw_score)))
    const routing_tier  = resolveRoutingTier(network_score)

    return {
      investor_id:             investorId,
      total_matches_viewed:    match_viewed_count,
      total_offers_made:       offer_made_count,
      total_deals_closed:      deal_closed_count,
      total_rejections:        rejection_count,
      conversion_rate,
      avg_response_time_hours,
      last_engagement_at:      rows[0]?.occurred_at ?? null,
      network_score,
      routing_tier,
    }
  } catch (err) {
    console.error('[NetworkFeedbackProcessor] computeInvestorNetworkStats exception:', err, { investorId, tenantId })
    return blank
  }
}

// ─── updateEdgeWeights ─────────────────────────────────────────────────────────

/**
 * Update graph edge weights based on engagement outcomes.
 * Uses sentinel UUID as to_id for the aggregate investor routing weight edge.
 */
async function updateEdgeWeights(
  tenantId:      string,
  investorStats: InvestorNetworkStats[],
): Promise<number> {
  const db      = supabaseAdmin as any
  const SENTINEL = '00000000-0000-0000-0000-000000000000'
  let   updated  = 0

  for (const stats of investorStats) {
    try {
      // ── Aggregate routing weight edge ──────────────────────────────────────
      const matchWeight = stats.network_score / 100

      const { error: matchErr } = await db
        .from('investor_graph_edges')
        .upsert(
          {
            tenant_id: tenantId,
            from_type: 'investor',
            from_id:   stats.investor_id,
            to_type:   'property',
            to_id:     SENTINEL,
            edge_type: 'match',
            weight:    matchWeight,
            metadata:  {
              network_score:  stats.network_score,
              routing_tier:   stats.routing_tier,
              computed_at:    new Date().toISOString(),
            },
          },
          {
            onConflict: 'tenant_id,from_type,from_id,to_type,to_id,edge_type',
          },
        )

      if (matchErr) {
        console.error('[NetworkFeedbackProcessor] upsert match edge failed:', matchErr.message, { investorId: stats.investor_id })
      } else {
        updated++
      }

      // ── Deal conversion edge (weight 1.0 = confirmed conversion) ──────────
      if (stats.total_deals_closed > 0) {
        const { error: dealErr } = await db
          .from('investor_graph_edges')
          .upsert(
            {
              tenant_id: tenantId,
              from_type: 'investor',
              from_id:   stats.investor_id,
              to_type:   'property',
              to_id:     SENTINEL,
              edge_type: 'deal',
              weight:    1.0,
              metadata:  {
                total_deals_closed: stats.total_deals_closed,
                conversion_rate:    stats.conversion_rate,
                computed_at:        new Date().toISOString(),
              },
            },
            {
              onConflict: 'tenant_id,from_type,from_id,to_type,to_id,edge_type',
            },
          )

        if (dealErr) {
          console.error('[NetworkFeedbackProcessor] upsert deal edge failed:', dealErr.message, { investorId: stats.investor_id })
        } else {
          updated++
        }
      }
    } catch (err) {
      console.error('[NetworkFeedbackProcessor] updateEdgeWeights exception for investor:', stats.investor_id, err)
    }
  }

  return updated
}

// ─── processNetworkFeedback ────────────────────────────────────────────────────

/**
 * Process all investors in a tenant — update graph edge weights.
 */
export async function processNetworkFeedback(
  tenantId: string,
): Promise<FeedbackProcessingResult> {
  const db = supabaseAdmin as any
  const BATCH_SIZE = 20

  const empty: FeedbackProcessingResult = {
    tenant_id:           tenantId,
    investors_processed: 0,
    edges_updated:       0,
    avg_network_score:   0,
    top_investors:       [],
    processed_at:        new Date().toISOString(),
  }

  try {
    // ── 1. Load all active investors for tenant ────────────────────────────────
    const { data: investorData, error: investorErr } = await db
      .from('investors')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')

    if (investorErr) {
      console.error('[NetworkFeedbackProcessor] failed to load investors:', investorErr.message, { tenantId })
      return empty
    }

    const investorRows = (investorData ?? []) as { id: string }[]
    if (investorRows.length === 0) {
      console.log('[NetworkFeedbackProcessor] no active investors for tenant:', tenantId)
      return empty
    }

    const investorIds = investorRows.map(r => r.id)

    // ── 2. Compute network stats in batches of 20 ──────────────────────────────
    const allStats: InvestorNetworkStats[] = []

    for (let i = 0; i < investorIds.length; i += BATCH_SIZE) {
      const batch     = investorIds.slice(i, i + BATCH_SIZE)
      const batchStats = await Promise.all(
        batch.map(id => computeInvestorNetworkStats(id, tenantId))
      )
      allStats.push(...batchStats)
    }

    // ── 3. Update graph edge weights ───────────────────────────────────────────
    const edges_updated = await updateEdgeWeights(tenantId, allStats)

    // ── 4. Compute aggregate metrics ──────────────────────────────────────────
    const scoreSum = allStats.reduce((s, st) => s + st.network_score, 0)
    const avg_network_score =
      allStats.length > 0
        ? Math.round(scoreSum / allStats.length)
        : 0

    const top_investors = [...allStats]
      .sort((a, b) => b.network_score - a.network_score)
      .slice(0, 5)
      .map(st => st.investor_id)

    return {
      tenant_id:           tenantId,
      investors_processed: allStats.length,
      edges_updated,
      avg_network_score,
      top_investors,
      processed_at:        new Date().toISOString(),
    }
  } catch (err) {
    console.error('[NetworkFeedbackProcessor] processNetworkFeedback exception:', err, { tenantId })
    return empty
  }
}
