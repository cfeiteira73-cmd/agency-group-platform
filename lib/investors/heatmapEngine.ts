// =============================================================================
// Agency Group — Liquidity Heatmap Engine
// lib/investors/heatmapEngine.ts
//
// Computes zone-level demand/supply/heat indices by analysing active listings
// vs active investors vs pending matches. Persists daily snapshots for trend
// analysis and real-time portal display.
//
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ZoneHeatData {
  zone:             string
  country:          string
  active_listings:  number
  active_investors: number
  pending_matches:  number
  avg_match_score:  number
  demand_score:     number  // 0–100
  supply_score:     number  // 0–100
  heat_index:       number  // 0–100
}

// ─── Internal row shapes ──────────────────────────────────────────────────────

interface PropertyRow {
  zona: string | null
}

interface InvestorRow {
  geography_preference: string[] | null
}

interface MatchRow {
  match_score: number
  properties:  { zona: string | null } | null
}

interface HeatmapRow {
  zone:             string
  country:          string
  active_listings:  number
  active_investors: number
  pending_matches:  number
  avg_match_score:  number | null
  demand_score:     number | null
  supply_score:     number | null
  heat_index:       number | null
}

// ─── computeHeatmap ───────────────────────────────────────────────────────────

/**
 * Compute the liquidity heatmap from live data.
 * Returns [] on any error.
 */
export async function computeHeatmap(
  tenantId: string,
  country = 'PT',
): Promise<ZoneHeatData[]> {
  const db = supabaseAdmin as any

  try {
    // 1. Active properties grouped by zone
    const { data: propData, error: propErr } = await db
      .from('properties')
      .select('zona')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .not('zona', 'is', null)

    if (propErr) throw propErr

    const properties = (propData ?? []) as PropertyRow[]

    // Count listings per zone
    const listingsByZone = new Map<string, number>()
    for (const p of properties) {
      if (!p.zona) continue
      listingsByZone.set(p.zona, (listingsByZone.get(p.zona) ?? 0) + 1)
    }

    // 2. All active investors — explode geography_preference in TypeScript
    const { data: invData, error: invErr } = await db
      .from('investors')
      .select('geography_preference')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')

    if (invErr) throw invErr

    const investors = (invData ?? []) as InvestorRow[]

    const investorsByZone = new Map<string, number>()
    for (const inv of investors) {
      const zones = inv.geography_preference ?? []
      for (const z of zones) {
        if (z) investorsByZone.set(z, (investorsByZone.get(z) ?? 0) + 1)
      }
    }

    // 3. Pending investor_matches — join via properties for zone
    const { data: matchData, error: matchErr } = await db
      .from('investor_matches')
      .select('match_score, properties(zona)')
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')

    if (matchErr) throw matchErr

    const matches = (matchData ?? []) as MatchRow[]

    const pendingByZone    = new Map<string, number>()
    const scoreSumByZone   = new Map<string, number>()
    const scoreCountByZone = new Map<string, number>()

    for (const m of matches) {
      const zona = m.properties?.zona
      if (!zona) continue
      pendingByZone.set(zona,    (pendingByZone.get(zona)    ?? 0) + 1)
      scoreSumByZone.set(zona,   (scoreSumByZone.get(zona)   ?? 0) + m.match_score)
      scoreCountByZone.set(zona, (scoreCountByZone.get(zona) ?? 0) + 1)
    }

    // 4. Build all known zones from union of all three sources
    const allZones = new Set<string>([
      ...listingsByZone.keys(),
      ...investorsByZone.keys(),
      ...pendingByZone.keys(),
    ])

    const result: ZoneHeatData[] = []

    for (const zone of allZones) {
      const active_listings  = listingsByZone.get(zone)  ?? 0
      const active_investors = investorsByZone.get(zone) ?? 0
      const pending_matches  = pendingByZone.get(zone)   ?? 0

      const scoreCount  = scoreCountByZone.get(zone) ?? 0
      const scoreSum    = scoreSumByZone.get(zone)   ?? 0
      const avg_match_score = scoreCount > 0
        ? Math.round(scoreSum / scoreCount)
        : 0

      const demand_score = Math.min(
        100,
        Math.round((active_investors / Math.max(active_listings, 1)) * 50),
      )

      const supply_score = Math.min(100, Math.round(active_listings * 5))

      const heat_index = Math.round((demand_score + supply_score) / 2)

      result.push({
        zone,
        country,
        active_listings,
        active_investors,
        pending_matches,
        avg_match_score,
        demand_score,
        supply_score,
        heat_index,
      })
    }

    return result
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[HeatmapEngine] computeHeatmap failed:', msg, { tenantId })
    return []
  }
}

// ─── persistHeatmap ───────────────────────────────────────────────────────────

/**
 * Upsert today's heatmap snapshot to the liquidity_heatmap table.
 * Logs errors, never throws.
 */
export async function persistHeatmap(
  tenantId: string,
  data:     ZoneHeatData[],
): Promise<void> {
  if (data.length === 0) return

  const db = supabaseAdmin as any
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

  const rows = data.map(z => ({
    tenant_id:       tenantId,
    zone:            z.zone,
    country:         z.country,
    active_listings: z.active_listings,
    active_investors:z.active_investors,
    pending_matches: z.pending_matches,
    avg_match_score: z.avg_match_score,
    demand_score:    z.demand_score,
    supply_score:    z.supply_score,
    heat_index:      z.heat_index,
    snapshot_date:   today,
    computed_at:     new Date().toISOString(),
  }))

  const { error } = await db
    .from('liquidity_heatmap')
    .upsert(rows, { onConflict: 'tenant_id,zone,snapshot_date' })

  if (error) {
    console.error('[HeatmapEngine] persistHeatmap failed:', error.message, {
      tenantId,
      zoneCount: data.length,
    })
  }
}

// ─── getHeatmap ───────────────────────────────────────────────────────────────

/**
 * Retrieve today's heatmap snapshot from the DB.
 * Returns [] if no snapshot exists for today (caller should compute on demand).
 */
export async function getHeatmap(
  tenantId: string,
  country?: string,
): Promise<ZoneHeatData[]> {
  const db = supabaseAdmin as any
  const today = new Date().toISOString().slice(0, 10)

  let query = db
    .from('liquidity_heatmap')
    .select('zone, country, active_listings, active_investors, pending_matches, avg_match_score, demand_score, supply_score, heat_index')
    .eq('tenant_id',    tenantId)
    .eq('snapshot_date', today)

  if (country) {
    query = query.eq('country', country)
  }

  const { data, error } = await query.order('heat_index', { ascending: false })

  if (error) {
    console.error('[HeatmapEngine] getHeatmap failed:', error.message, { tenantId })
    return []
  }

  const rows = (data ?? []) as HeatmapRow[]

  return rows.map(r => ({
    zone:             r.zone,
    country:          r.country,
    active_listings:  r.active_listings,
    active_investors: r.active_investors,
    pending_matches:  r.pending_matches,
    avg_match_score:  r.avg_match_score  ?? 0,
    demand_score:     r.demand_score     ?? 0,
    supply_score:     r.supply_score     ?? 0,
    heat_index:       r.heat_index       ?? 0,
  }))
}
