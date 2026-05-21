// Agency Group — Adaptive Investor Re-ranker
// lib/investors/adaptiveReranker.ts
// TypeScript strict — 0 errors
//
// Applies real-time feedback signals to re-rank investor routing.
// Called after initial routeProperty() to add adaptive layer.
// Key insight: an investor who closed 3 deals this quarter should rank higher
// than one who has never responded, even if their raw match scores are equal.

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import type { RoutingScore } from './routingEngine'
import { computePropertyDemandScore } from './demandScoreEngine'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface AdaptiveSignals {
  investor_network_stats: Map<string, { network_score: number; routing_tier: string }>
  property_demand_score:  number     // 0-100 for the target property
  market_heat:            number     // 0-100 liquidity heat for the zone
}

// ─── applyAdaptiveReranking ────────────────────────────────────────────────────

/**
 * Apply adaptive re-ranking signals to existing routing scores.
 * Returns a new array — does not mutate input.
 */
export function applyAdaptiveReranking(
  routes:  RoutingScore[],
  signals: AdaptiveSignals,
): RoutingScore[] {
  const isHotProperty = signals.property_demand_score >= 70

  const adjusted: RoutingScore[] = routes.map(route => {
    const stats = signals.investor_network_stats.get(route.investor_id)

    let bonus = 0

    // ── Network score bonus ────────────────────────────────────────────────────
    if (stats) {
      bonus += (stats.network_score / 100) * 5

      // ── Tier bonus ───────────────────────────────────────────────────────────
      if (stats.routing_tier === 'platinum') {
        bonus += 3
      } else if (stats.routing_tier === 'gold') {
        bonus += 1
      }
    }

    // ── Hot property bonus — everyone benefits ─────────────────────────────────
    if (isHotProperty) {
      bonus += 2
    }

    const updated_score = Math.max(
      0,
      Math.min(100, Math.round(route.final_routing_score + bonus)),
    )

    // Re-compute routing_tier after adjustment
    const routing_tier = getAdjustedRoutingTier(updated_score)

    return {
      ...route,
      final_routing_score: updated_score,
      routing_tier,
    }
  })

  // Re-sort by updated score DESC
  adjusted.sort((a, b) => b.final_routing_score - a.final_routing_score)

  return adjusted
}

// ─── getAdjustedRoutingTier ────────────────────────────────────────────────────

function getAdjustedRoutingTier(score: number): RoutingScore['routing_tier'] {
  if (score >= 85) return 'immediate'
  if (score >= 70) return 'priority'
  if (score >= 50) return 'standard'
  return 'low'
}

// ─── loadAdaptiveSignals ───────────────────────────────────────────────────────

/**
 * Load adaptive signals for a set of investor IDs and a property.
 */
export async function loadAdaptiveSignals(
  investorIds: string[],
  propertyId:  string,
  tenantId:    string,
): Promise<AdaptiveSignals> {
  const db = supabaseAdmin as any

  const SENTINEL = '00000000-0000-0000-0000-000000000000'

  // ── 1. Load network weights from investor_graph_edges ─────────────────────────
  const network_stats = new Map<string, { network_score: number; routing_tier: string }>()

  try {
    if (investorIds.length > 0) {
      const { data: edgeData, error: edgeErr } = await db
        .from('investor_graph_edges')
        .select('from_id, weight, metadata')
        .eq('tenant_id', tenantId)
        .eq('from_type', 'investor')
        .eq('edge_type', 'match')
        .eq('to_id', SENTINEL)
        .in('from_id', investorIds)

      if (edgeErr) {
        log.error('[AdaptiveReranker] failed to load graph edges', undefined, { error: edgeErr.message })
      } else {
        const rows = (edgeData ?? []) as {
          from_id:  string
          weight:   number
          metadata: { network_score?: number; routing_tier?: string } | null
        }[]

        for (const row of rows) {
          const score = row.metadata?.network_score ?? Math.round(row.weight * 100)
          const tier  = row.metadata?.routing_tier  ?? resolveTierFromScore(score)
          network_stats.set(row.from_id, { network_score: score, routing_tier: tier })
        }
      }
    }
  } catch (err) {
    log.error('[AdaptiveReranker] loadAdaptiveSignals edge query exception', err instanceof Error ? err : undefined, { error: err instanceof Error ? err.message : String(err) })
  }

  // ── 2. Get property demand score ───────────────────────────────────────────────
  let property_demand_score = 0
  let market_heat           = 50

  try {
    const demandScore = await computePropertyDemandScore(propertyId, tenantId)
    property_demand_score = demandScore.demand_score

    // ── 3. Zone heat from liquidity_heatmap via property's zona ─────────────────
    const { data: propData, error: propErr } = await db
      .from('properties')
      .select('zona')
      .eq('id', propertyId)
      .eq('tenant_id', tenantId)
      .single()

    if (!propErr && propData?.zona) {
      const zona = propData.zona as string

      const { data: heatData, error: heatErr } = await db
        .from('liquidity_heatmap')
        .select('heat_index')
        .eq('tenant_id', tenantId)
        .eq('zona', zona)
        .order('snapshot_date', { ascending: false })
        .limit(1)
        .single()

      if (!heatErr && heatData?.heat_index !== undefined) {
        market_heat = heatData.heat_index as number
      }
    }
  } catch (err) {
    log.error('[AdaptiveReranker] loadAdaptiveSignals demand/heat exception', err instanceof Error ? err : undefined, { error: err instanceof Error ? err.message : String(err), property_id: propertyId })
  }

  return {
    investor_network_stats: network_stats,
    property_demand_score,
    market_heat,
  }
}

// ─── Private helper ────────────────────────────────────────────────────────────

function resolveTierFromScore(score: number): string {
  if (score >= 80) return 'platinum'
  if (score >= 60) return 'gold'
  if (score >= 40) return 'silver'
  return 'bronze'
}
