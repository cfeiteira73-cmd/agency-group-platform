// =============================================================================
// Agency Group — Full Liquidity Formation Engine
// lib/market/liquidityFormation.ts
//
// Computes per-property and per-zone liquidity from live bid data.
//
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LiquidityFormationResult {
  property_id: string
  tenant_id: string
  active_investor_count: number
  bid_density: number
  capital_available_eur: number
  time_to_close_days: number
  price_volatility_index: number
  liquidity_score: number
  liquidity_grade: 'S' | 'A' | 'B' | 'C' | 'D'
  capital_velocity_index: number
  market_depth_eur: number
  demand_heat_index: number
  estimated_close_probability_30d: number
  zone: string | null
  zone_active_listings: number
  zone_avg_liquidity: number
  zone_capital_flow_velocity: number
  computed_at: string
}

export interface ZoneLiquidityResult {
  zone: string
  listings_count: number
  total_capital_committed: number
  avg_liquidity_score: number
  top_property_id: string | null
  capital_flow_velocity_eur_per_day: number
}

// ─── Internal row shapes ──────────────────────────────────────────────────────

interface BidRow {
  investor_id: string
  bid_price_eur: number
  urgency_level: string
}

interface PropertyRow {
  preco: number | null
  zona: string | null
}

interface BidBookRow {
  active_bids: number
  capital_committed_eur: number
}

// ─── Private helpers ──────────────────────────────────────────────────────────

const URGENCY_DAYS: Record<string, number> = {
  immediate:  7,
  within_30d: 25,
  within_90d: 60,
  flexible:   120,
}

function gradeFromScore(score: number): LiquidityFormationResult['liquidity_grade'] {
  if (score >= 85) return 'S'
  if (score >= 70) return 'A'
  if (score >= 55) return 'B'
  if (score >= 40) return 'C'
  return 'D'
}

function closeProbFrom(score: number): number {
  if (score >= 80) return 0.85
  if (score >= 60) return 0.65
  if (score >= 40) return 0.40
  return 0.20
}

// ─── computeLiquidityFormation ───────────────────────────────────────────────

export async function computeLiquidityFormation(
  tenantId: string,
  propertyId: string,
): Promise<LiquidityFormationResult> {
  const db = supabaseAdmin as any

  const blank: LiquidityFormationResult = {
    property_id:                     propertyId,
    tenant_id:                       tenantId,
    active_investor_count:           0,
    bid_density:                     0,
    capital_available_eur:           0,
    time_to_close_days:              120,
    price_volatility_index:          0,
    liquidity_score:                 0,
    liquidity_grade:                 'D',
    capital_velocity_index:          0,
    market_depth_eur:                0,
    demand_heat_index:               0,
    estimated_close_probability_30d: 0.20,
    zone:                            null,
    zone_active_listings:            0,
    zone_avg_liquidity:              0,
    zone_capital_flow_velocity:      0,
    computed_at:                     new Date().toISOString(),
  }

  try {
    // ── 1. Load property ──────────────────────────────────────────────────────
    const { data: propRaw, error: propErr } = await db
      .from('properties')
      .select('preco, zona')
      .eq('id', propertyId)
      .eq('tenant_id', tenantId)
      .single()

    if (propErr || !propRaw) {
      log.warn('[LiquidityFormation] property not found', { property_id: propertyId })
      return blank
    }

    const prop     = propRaw as PropertyRow
    const askPrice = prop.preco ?? 0
    const zone     = prop.zona ?? null

    // ── 2. Load active bids ───────────────────────────────────────────────────
    const { data: bidsRaw, error: bidsErr } = await db
      .from('investor_bids')
      .select('investor_id, bid_price_eur, urgency_level')
      .eq('tenant_id', tenantId)
      .eq('property_id', propertyId)
      .eq('status', 'active')

    if (bidsErr) {
      log.warn('[LiquidityFormation] bids load failed', { error: bidsErr.message })
      return blank
    }

    const bids   = (bidsRaw ?? []) as BidRow[]
    const N      = bids.length

    // Unique investor count
    const uniqueInvestors = new Set(bids.map(b => b.investor_id)).size

    // ── 3. bid_density = active_bids / (ask_price / 1_000_000) ───────────────
    const bidDensity = N > 0 && askPrice > 0
      ? N / Math.max(1, askPrice / 1_000_000)
      : 0

    // ── 4. Capital available ──────────────────────────────────────────────────
    const capitalAvailable = bids.reduce((s, b) => s + b.bid_price_eur, 0)

    // ── 5. Time to close (weighted average) ──────────────────────────────────
    let weightedDays = 0
    for (const b of bids) {
      weightedDays += URGENCY_DAYS[b.urgency_level] ?? 90
    }
    const timeToClose = N > 0 ? Math.round(weightedDays / N) : 120

    // ── 6. Price volatility index (spread / ask) ──────────────────────────────
    const prices  = bids.map(b => b.bid_price_eur)
    const highest = prices.length > 0 ? Math.max(...prices) : 0
    const lowest  = prices.length > 0 ? Math.min(...prices) : 0
    const priceVolatilityIndex = askPrice > 0 && prices.length > 1
      ? Math.round(((highest - lowest) / askPrice) * 100 * 100) / 100
      : 0

    // ── 7. Liquidity score formula ────────────────────────────────────────────
    const investor_pts  = Math.min(25, (uniqueInvestors / 10) * 25)
    const bid_pts       = Math.min(20, bidDensity * 4)
    const capital_pts   = Math.min(20, (capitalAvailable / Math.max(1, askPrice)) * 20)
    const urgency_pts   = Math.max(0, (1 - timeToClose / 120) * 20)
    const stability_pts = Math.max(0, (1 - priceVolatilityIndex / 50) * 15)
    const rawScore      = investor_pts + bid_pts + capital_pts + urgency_pts + stability_pts
    const liquidity_score = Math.min(100, Math.max(0, Math.round(rawScore * 100) / 100))

    const liquidity_grade = gradeFromScore(liquidity_score)

    // ── 8. Derived metrics ────────────────────────────────────────────────────
    const capital_velocity_index = capitalAvailable / Math.max(1, timeToClose)
    const market_depth_eur       = bids
      .filter(b => b.bid_price_eur >= askPrice)
      .reduce((s, b) => s + b.bid_price_eur, 0)
    const demand_heat_index      = Math.min(100, N * 15)
    const estimated_close_probability_30d = closeProbFrom(liquidity_score)

    // ── 9. Zone aggregates ────────────────────────────────────────────────────
    let zoneActiveListings     = 0
    let zoneAvgLiquidity       = 0
    let zoneCapitalFlowVelocity = 0

    if (zone) {
      try {
        const { count: zoneCount } = await db
          .from('properties')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('zona', zone)
          .eq('status', 'active')

        zoneActiveListings = zoneCount ?? 0

        // Zone avg liquidity from bid_books
        const { data: propIds } = await db
          .from('properties')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('zona', zone)
          .eq('status', 'active')
          .limit(50)

        const ids = ((propIds ?? []) as { id: string }[]).map(r => r.id)
        if (ids.length > 0) {
          const { data: bbRaw } = await db
            .from('bid_books')
            .select('active_bids, capital_committed_eur')
            .eq('tenant_id', tenantId)
            .in('property_id', ids)

          const bbRows = (bbRaw ?? []) as BidBookRow[]
          if (bbRows.length > 0) {
            const totalCapital = bbRows.reduce((s, r) => s + (r.capital_committed_eur ?? 0), 0)
            const avgBids      = bbRows.reduce((s, r) => s + (r.active_bids ?? 0), 0) / bbRows.length
            zoneAvgLiquidity       = Math.min(100, avgBids * 15)
            zoneCapitalFlowVelocity = totalCapital / Math.max(1, timeToClose)
          }
        }
      } catch (zoneErr) {
        log.warn('[LiquidityFormation] zone aggregation failed', {
          error: zoneErr instanceof Error ? zoneErr.message : String(zoneErr),
        })
      }
    }

    return {
      property_id:                     propertyId,
      tenant_id:                       tenantId,
      active_investor_count:           uniqueInvestors,
      bid_density:                     Math.round(bidDensity * 100) / 100,
      capital_available_eur:           capitalAvailable,
      time_to_close_days:              timeToClose,
      price_volatility_index:          priceVolatilityIndex,
      liquidity_score,
      liquidity_grade,
      capital_velocity_index:          Math.round(capital_velocity_index * 100) / 100,
      market_depth_eur,
      demand_heat_index,
      estimated_close_probability_30d,
      zone,
      zone_active_listings:            zoneActiveListings,
      zone_avg_liquidity:              Math.round(zoneAvgLiquidity * 100) / 100,
      zone_capital_flow_velocity:      Math.round(zoneCapitalFlowVelocity * 100) / 100,
      computed_at:                     new Date().toISOString(),
    }
  } catch (err) {
    log.warn('[LiquidityFormation] computeLiquidityFormation exception', {
      error: err instanceof Error ? err.message : String(err),
    })
    return blank
  }
}

// ─── computeZoneLiquidity ────────────────────────────────────────────────────

export async function computeZoneLiquidity(
  tenantId: string,
  zone: string,
): Promise<ZoneLiquidityResult> {
  const db = supabaseAdmin as any

  const empty: ZoneLiquidityResult = {
    zone,
    listings_count:                    0,
    total_capital_committed:           0,
    avg_liquidity_score:               0,
    top_property_id:                   null,
    capital_flow_velocity_eur_per_day: 0,
  }

  try {
    // ── 1. Properties in zone ─────────────────────────────────────────────────
    const { data: propsRaw, error: propsErr } = await db
      .from('properties')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('zona', zone)
      .eq('status', 'active')
      .limit(200)

    if (propsErr) {
      log.warn('[LiquidityFormation] computeZoneLiquidity props failed', { error: propsErr.message })
      return empty
    }

    const props  = (propsRaw ?? []) as { id: string }[]
    const propIds = props.map(p => p.id)

    if (propIds.length === 0) return empty

    // ── 2. Bid books for those properties ─────────────────────────────────────
    const { data: bbRaw, error: bbErr } = await db
      .from('bid_books')
      .select('property_id, active_bids, capital_committed_eur')
      .eq('tenant_id', tenantId)
      .in('property_id', propIds)

    if (bbErr) {
      log.warn('[LiquidityFormation] computeZoneLiquidity bid_books failed', { error: bbErr.message })
      return empty
    }

    const bbRows    = (bbRaw ?? []) as (BidBookRow & { property_id: string })[]
    const totalCap  = bbRows.reduce((s, r) => s + (r.capital_committed_eur ?? 0), 0)
    const avgBids   = bbRows.length > 0
      ? bbRows.reduce((s, r) => s + (r.active_bids ?? 0), 0) / bbRows.length
      : 0

    const avgLiquidity = Math.min(100, avgBids * 15)

    // ── 3. Top property by bid count ──────────────────────────────────────────
    let topPropertyId: string | null = null
    if (bbRows.length > 0) {
      const sorted     = [...bbRows].sort((a, b) => b.active_bids - a.active_bids)
      topPropertyId    = sorted[0]!.property_id
    }

    // ── 4. Capital flow velocity = total capital / 30 days window ─────────────
    const velocityPerDay = totalCap / 30

    return {
      zone,
      listings_count:                    props.length,
      total_capital_committed:           totalCap,
      avg_liquidity_score:               Math.round(avgLiquidity * 100) / 100,
      top_property_id:                   topPropertyId,
      capital_flow_velocity_eur_per_day: Math.round(velocityPerDay * 100) / 100,
    }
  } catch (err) {
    log.warn('[LiquidityFormation] computeZoneLiquidity exception', {
      error: err instanceof Error ? err.message : String(err),
    })
    return empty
  }
}
