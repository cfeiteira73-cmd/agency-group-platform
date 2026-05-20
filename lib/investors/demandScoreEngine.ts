// Agency Group — Property Demand Score Engine
// lib/investors/demandScoreEngine.ts
// TypeScript strict — 0 errors
//
// Computes demand scores for properties based on actual investor engagement.
// Demand score = f(watchlist_adds, match_views, offer_rate, zone_heat)
// Higher demand = higher priority in routing = reduces days-to-match.

import { supabaseAdmin } from '@/lib/supabase'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface PropertyDemandScore {
  property_id:      string
  tenant_id:        string
  watchlist_count:  number         // investors who saved this property
  match_view_count: number         // investors who viewed this match
  offer_count:      number         // investors who made offers
  zone_heat_index:  number | null  // from liquidity_heatmap
  demand_score:     number         // 0-100 composite
  demand_tier:      'hot' | 'warm' | 'normal' | 'cold'
  computed_at:      string
}

// ─── Tier resolution ───────────────────────────────────────────────────────────

function resolveDemandTier(score: number): PropertyDemandScore['demand_tier'] {
  if (score >= 70) return 'hot'
  if (score >= 40) return 'warm'
  if (score >= 20) return 'normal'
  return 'cold'
}

// ─── computePropertyDemandScore ────────────────────────────────────────────────

/**
 * Compute demand score for a single property.
 */
export async function computePropertyDemandScore(
  propertyId: string,
  tenantId:   string,
): Promise<PropertyDemandScore> {
  const db = supabaseAdmin as any

  const blank: PropertyDemandScore = {
    property_id:      propertyId,
    tenant_id:        tenantId,
    watchlist_count:  0,
    match_view_count: 0,
    offer_count:      0,
    zone_heat_index:  null,
    demand_score:     0,
    demand_tier:      'cold',
    computed_at:      new Date().toISOString(),
  }

  try {
    // ── 1. Watchlist count ─────────────────────────────────────────────────────
    const { count: watchlistCount, error: wErr } = await db
      .from('investor_watchlists')
      .select('*', { count: 'exact', head: true })
      .eq('property_id', propertyId)
      .eq('tenant_id', tenantId)

    if (wErr) {
      console.error('[DemandScoreEngine] watchlist count error:', wErr.message, { propertyId })
    }

    // ── 2. Match view count ────────────────────────────────────────────────────
    const { count: matchViewCount, error: mvErr } = await db
      .from('investor_engagement_events')
      .select('*', { count: 'exact', head: true })
      .eq('property_id', propertyId)
      .eq('event_type', 'match_viewed')
      .eq('tenant_id', tenantId)

    if (mvErr) {
      console.error('[DemandScoreEngine] match_view count error:', mvErr.message, { propertyId })
    }

    // ── 3. Offer count ─────────────────────────────────────────────────────────
    const { count: offerCount, error: oErr } = await db
      .from('investor_engagement_events')
      .select('*', { count: 'exact', head: true })
      .eq('property_id', propertyId)
      .eq('event_type', 'offer_made')
      .eq('tenant_id', tenantId)

    if (oErr) {
      console.error('[DemandScoreEngine] offer count error:', oErr.message, { propertyId })
    }

    // ── 4. Zone heat index ─────────────────────────────────────────────────────
    let zone_heat_index: number | null = null

    try {
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
          zone_heat_index = heatData.heat_index as number
        }
      }
    } catch {
      // Zone heat lookup is best-effort — fallback to null
    }

    // ── 5. Compute demand score ────────────────────────────────────────────────
    const wc = watchlistCount  ?? 0
    const mv = matchViewCount  ?? 0
    const oc = offerCount      ?? 0

    const demand_score = Math.min(
      100,
      Math.round(
        wc * 15 +
        mv * 5  +
        oc * 25 +
        (zone_heat_index ?? 50) * 0.1,
      ),
    )

    const demand_tier = resolveDemandTier(demand_score)

    return {
      property_id:      propertyId,
      tenant_id:        tenantId,
      watchlist_count:  wc,
      match_view_count: mv,
      offer_count:      oc,
      zone_heat_index,
      demand_score,
      demand_tier,
      computed_at:      new Date().toISOString(),
    }
  } catch (err) {
    console.error('[DemandScoreEngine] computePropertyDemandScore exception:', err, { propertyId, tenantId })
    return blank
  }
}

// ─── computeTopDemandProperties ────────────────────────────────────────────────

/**
 * Compute demand scores for all active properties in a tenant.
 * Returns top 50 by demand score.
 */
export async function computeTopDemandProperties(
  tenantId: string,
): Promise<PropertyDemandScore[]> {
  const db = supabaseAdmin as any

  try {
    // Get all active property IDs
    const { data: propData, error: propErr } = await db
      .from('properties')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .limit(500)

    if (propErr) {
      console.error('[DemandScoreEngine] failed to load properties:', propErr.message, { tenantId })
      return []
    }

    const props = (propData ?? []) as { id: string }[]
    if (props.length === 0) return []

    // Compute demand scores in parallel (batch of 50 for safety)
    const BATCH_SIZE = 50
    const allScores: PropertyDemandScore[] = []

    for (let i = 0; i < props.length; i += BATCH_SIZE) {
      const batch = props.slice(i, i + BATCH_SIZE)
      const batchScores = await Promise.all(
        batch.map(p => computePropertyDemandScore(p.id, tenantId))
      )
      allScores.push(...batchScores)
    }

    // Sort descending by demand score, return top 50
    return allScores
      .sort((a, b) => b.demand_score - a.demand_score)
      .slice(0, 50)
  } catch (err) {
    console.error('[DemandScoreEngine] computeTopDemandProperties exception:', err, { tenantId })
    return []
  }
}
