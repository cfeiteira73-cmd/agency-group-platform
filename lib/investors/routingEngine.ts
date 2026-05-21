// =============================================================================
// Agency Group — Investor Routing Engine
// lib/investors/routingEngine.ts
//
// Computes final routing scores for investors by layering engagement history
// on top of base match scores. Higher engagement → higher routing priority.
//
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import type { InvestorProfile, InvestorMatchResult } from './types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RoutingScore {
  investor_id:            string
  investor:               InvestorProfile
  base_match_score:       number
  engagement_multiplier:  number   // 0.8–1.5
  response_speed_score:   number   // 0–1
  conversion_rate_score:  number   // 0–1
  network_effect_weight:  number   // 0–1
  final_routing_score:    number   // 0–100
  routing_tier:           'immediate' | 'priority' | 'standard' | 'low'
}

export interface RoutingResult {
  property_id:                string
  tenant_id:                  string
  routes:                     RoutingScore[]
  total_investors_considered: number
  routed_at:                  string
}

// ─── Engagement row shape ─────────────────────────────────────────────────────

interface EngagementRow {
  investor_id:          string
  event_type:           string
  response_time_hours:  number | null
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function getRoutingTier(score: number): RoutingScore['routing_tier'] {
  if (score >= 85) return 'immediate'
  if (score >= 70) return 'priority'
  if (score >= 50) return 'standard'
  return 'low'
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Route a property to investors sorted by engagement-weighted score.
 * baseMatches must already be computed by the match engine.
 */
export async function routeProperty(
  propertyId: string,
  tenantId:   string,
  baseMatches: InvestorMatchResult[],
): Promise<RoutingResult> {
  const db = supabaseAdmin as any

  const investorIds = baseMatches.map(m => m.investor_id)

  // ── 1. Load recent engagement history ─────────────────────────────────────
  let engagementRows: EngagementRow[] = []

  if (investorIds.length > 0) {
    const { data, error } = await db
      .from('investor_engagement_events')
      .select('investor_id, event_type, response_time_hours')
      .eq('tenant_id', tenantId)
      .in('investor_id', investorIds)
      .order('occurred_at', { ascending: false })
      .limit(500)

    if (error) {
      log.error('[RoutingEngine] failed to load engagement events', undefined, { error: error.message, property_id: propertyId })
    } else {
      engagementRows = (data ?? []) as EngagementRow[]
    }
  }

  // ── 2. Group engagement by investor ───────────────────────────────────────
  const byInvestor = new Map<string, EngagementRow[]>()
  for (const row of engagementRows) {
    const list = byInvestor.get(row.investor_id) ?? []
    list.push(row)
    byInvestor.set(row.investor_id, list)
  }

  // ── 3. Compute routing score per investor ─────────────────────────────────
  const routes: RoutingScore[] = baseMatches.map(match => {
    const events = byInvestor.get(match.investor_id) ?? []

    // engagement_multiplier — use most impactful recent event
    let engagement_multiplier = 1.0
    const MULTIPLIERS: Record<string, number> = {
      deal_closed:      1.5,
      call_booked:      1.3,
      offer_made:       1.2,
      match_viewed:     1.1,
      offer_rejected:   0.9,
      unsubscribed:     0.8,
    }
    for (const ev of events) {
      const m = MULTIPLIERS[ev.event_type]
      if (m !== undefined) {
        // Apply the first (most recent) impactful event
        engagement_multiplier = m
        break
      }
    }

    // response_speed_score — average response time from all events that have it
    const responseTimes = events
      .map(e => e.response_time_hours)
      .filter((h): h is number => h !== null)

    let response_speed_score = 0.5
    if (responseTimes.length > 0) {
      const avg = responseTimes.reduce((s, h) => s + h, 0) / responseTimes.length
      if (avg < 4)   response_speed_score = 1.0
      else if (avg < 24)  response_speed_score = 0.8
      else if (avg < 72)  response_speed_score = 0.6
      else                response_speed_score = 0.3
    }

    // conversion_rate_score — deal_closed / match_viewed (capped 0–1)
    const match_viewed_count = events.filter(e => e.event_type === 'match_viewed').length
    const deal_closed_count  = events.filter(e => e.event_type === 'deal_closed').length
    const conversion_rate_score = Math.min(
      deal_closed_count / Math.max(match_viewed_count, 1),
      1.0,
    )

    // network_effect_weight — default 0.5 (improves as graph edges accumulate)
    const network_effect_weight = 0.5

    // final_routing_score
    const final_routing_score = Math.min(
      100,
      Math.round(
        match.match_score *
        engagement_multiplier *
        (1 + conversion_rate_score * 0.2 + network_effect_weight * 0.1),
      ),
    )

    const routing_tier = getRoutingTier(final_routing_score)

    return {
      investor_id:           match.investor_id,
      investor:              match.investor,
      base_match_score:      match.match_score,
      engagement_multiplier,
      response_speed_score,
      conversion_rate_score,
      network_effect_weight,
      final_routing_score,
      routing_tier,
    }
  })

  // ── 4. Sort by final score DESC ────────────────────────────────────────────
  routes.sort((a, b) => b.final_routing_score - a.final_routing_score)

  return {
    property_id:                propertyId,
    tenant_id:                  tenantId,
    routes,
    total_investors_considered: baseMatches.length,
    routed_at:                  new Date().toISOString(),
  }
}
