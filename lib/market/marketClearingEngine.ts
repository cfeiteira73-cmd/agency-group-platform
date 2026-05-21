// =============================================================================
// Agency Group — Market Clearing Engine
// lib/market/marketClearingEngine.ts
//
// Formal market clearing — price discovery through supply/demand equilibrium.
// Computes clearing prices, equilibrium signals, and absorption rates per
// property and per zone. Results are persisted to market_clearing_snapshots
// and zone_clearing_snapshots tables.
//
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MarketClearingResult {
  property_id: string
  tenant_id: string

  // Price discovery
  ask_price_eur: number
  clearing_price_eur: number        // the market-clearing price (demand/supply intersection)
  price_discovery_confidence: number // 0-100: how confident is the clearing price

  // Supply / demand signals
  active_bid_count: number
  total_capital_committed_eur: number
  bids_above_ask: number            // # bids at or above ask_price
  bids_below_ask: number

  // Equilibrium analysis
  supply_pressure: number           // 0-100: how eager sellers are to close (days_on_market driven)
  demand_pressure: number           // 0-100: how many competing buyers above ask
  market_equilibrium: 'undersupply' | 'balanced' | 'oversupply'

  // Price movement forecast
  price_direction: 'rising' | 'stable' | 'declining'
  estimated_price_change_30d_pct: number   // e.g. +3.5 or -1.2

  // Absorption rate
  absorption_rate_days: number      // estimated days to clear at current demand

  computed_at: string
}

export interface ZoneClearingSnapshot {
  zone: string
  tenant_id: string
  active_listings: number
  total_bids: number
  avg_clearing_price_eur: number
  avg_price_deviation_pct: number   // avg (clearing_price - ask_price) / ask_price * 100
  zone_supply_pressure: number
  zone_demand_pressure: number
  zone_equilibrium: 'undersupply' | 'balanced' | 'oversupply'
  capital_velocity_eur_per_day: number
  snapshot_date: string
}

// ─── Internal row shapes ──────────────────────────────────────────────────────

interface BidRow {
  bid_price_eur: number
  status: string
}

interface PropertyRow {
  id: string
  preco: number | null
  created_at: string | null
  zona: string | null
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = (p / 100) * (sorted.length - 1)
  const lo  = Math.floor(idx)
  const hi  = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

function weightedAvg(bids: number[], askPrice: number): number {
  const bidSum = bids.reduce((s, b) => s + b, 0)
  const bidAvg = bidSum / bids.length
  return bidAvg * 0.7 + askPrice * 0.3
}

function computeDaysOnMarket(listingDate: string | null): number {
  if (!listingDate) return 60 // default: assume moderate
  const listed  = new Date(listingDate).getTime()
  const now     = Date.now()
  const diff    = (now - listed) / (1000 * 60 * 60 * 24)
  return Math.max(0, Math.round(diff))
}

function computeSupplyPressure(daysOnMarket: number): number {
  if (daysOnMarket < 30)  return 20
  if (daysOnMarket < 90)  return 50
  if (daysOnMarket < 180) return 75
  return 90
}

function computeEquilibrium(
  demandPressure: number,
  supplyPressure: number,
): 'undersupply' | 'balanced' | 'oversupply' {
  if (demandPressure > supplyPressure + 20) return 'undersupply'
  if (supplyPressure > demandPressure + 20) return 'oversupply'
  return 'balanced'
}

function computeAbsorptionDays(activeBidCount: number): number {
  if (activeBidCount === 0) return 180
  if (activeBidCount === 1) return 75
  if (activeBidCount === 2) return 45
  // 3+ bids
  const raw = 14 + (30 - activeBidCount * 2)
  return Math.min(90, Math.max(7, raw))
}

// ─── computeMarketClearing ────────────────────────────────────────────────────

export async function computeMarketClearing(
  tenantId: string,
  propertyId: string,
): Promise<MarketClearingResult> {
  const db = supabaseAdmin as any

  // Fetch property — ask price + listing date
  const { data: propRaw, error: propErr } = await (db
    .from('properties')
    .select('id, preco, created_at, zona')
    .eq('id', propertyId)
    .eq('tenant_id', tenantId)
    .single() as Promise<{ data: PropertyRow | null; error: { message: string } | null }>)

  if (propErr || !propRaw) {
    log.warn('[MarketClearing] property not found', { property_id: propertyId, error: propErr?.message })
    throw new Error(`Property ${propertyId} not found for tenant ${tenantId}`)
  }

  const askPriceEur: number = propRaw.preco ?? 0
  const daysOnMarket        = computeDaysOnMarket(propRaw.created_at)

  // Fetch active bids sorted DESC
  const { data: bidsRaw, error: bidsErr } = await (db
    .from('investor_bids')
    .select('bid_price_eur, status')
    .eq('tenant_id', tenantId)
    .eq('property_id', propertyId)
    .eq('status', 'active')
    .order('bid_price_eur', { ascending: false }) as Promise<{ data: BidRow[] | null; error: { message: string } | null }>)

  if (bidsErr) {
    log.warn('[MarketClearing] bids query failed', { property_id: propertyId, error: bidsErr.message })
  }

  const bids: BidRow[] = bidsRaw ?? []
  const activeBidCount   = bids.length
  const bidPrices        = bids.map(b => b.bid_price_eur)

  const totalCapitalCommitted = bidPrices.reduce((s, p) => s + p, 0)
  const bidsAboveAsk          = bidPrices.filter(p => p >= askPriceEur).length
  const bidsBelowAsk          = bidPrices.filter(p => p < askPriceEur).length

  // ── clearing_price_eur ──────────────────────────────────────────────────────
  let clearingPriceEur: number
  if (activeBidCount === 0) {
    clearingPriceEur = askPriceEur
  } else if (activeBidCount <= 2) {
    clearingPriceEur = weightedAvg(bidPrices, askPriceEur)
  } else {
    const sorted = [...bidPrices].sort((a, b) => a - b)
    clearingPriceEur = percentile(sorted, 75)
  }
  // Clamp: never clear more than 10% below ask
  const minClearing = askPriceEur * 0.90
  clearingPriceEur  = Math.max(minClearing, clearingPriceEur)

  // ── price_discovery_confidence ──────────────────────────────────────────────
  let confidence = Math.min(100, activeBidCount * 20)
  const aboveAskRatio = bidsAboveAsk / Math.max(1, activeBidCount)
  if (aboveAskRatio > 0.6) confidence += 20
  confidence = Math.min(100, Math.max(0, confidence))

  // ── pressures ───────────────────────────────────────────────────────────────
  const supplyPressure = computeSupplyPressure(daysOnMarket)
  const demandPressure = Math.min(
    100,
    (aboveAskRatio * 80) + (activeBidCount / 5) * 20,
  )

  // ── equilibrium ─────────────────────────────────────────────────────────────
  const marketEquilibrium = computeEquilibrium(demandPressure, supplyPressure)

  // ── price direction ──────────────────────────────────────────────────────────
  const priceRatio = askPriceEur > 0 ? clearingPriceEur / askPriceEur : 1
  let priceDirection: 'rising' | 'stable' | 'declining'
  if (priceRatio > 1.02)      priceDirection = 'rising'
  else if (priceRatio < 0.98) priceDirection = 'declining'
  else                        priceDirection = 'stable'

  // ── estimated_price_change_30d_pct ───────────────────────────────────────────
  let estimatedPriceChange30dPct: number
  if (priceDirection === 'rising') {
    estimatedPriceChange30dPct = +Math.min(8, (priceRatio - 1) * 100 * 3)
  } else if (priceDirection === 'declining') {
    estimatedPriceChange30dPct = -Math.min(5, (1 - priceRatio) * 100 * 2)
  } else {
    estimatedPriceChange30dPct = 0
  }

  // ── absorption rate ──────────────────────────────────────────────────────────
  const absorptionRateDays = computeAbsorptionDays(activeBidCount)

  const computedAt = new Date().toISOString()

  const result: MarketClearingResult = {
    property_id:                 propertyId,
    tenant_id:                   tenantId,
    ask_price_eur:               askPriceEur,
    clearing_price_eur:          Math.round(clearingPriceEur * 100) / 100,
    price_discovery_confidence:  Math.round(confidence * 100) / 100,
    active_bid_count:            activeBidCount,
    total_capital_committed_eur: totalCapitalCommitted,
    bids_above_ask:              bidsAboveAsk,
    bids_below_ask:              bidsBelowAsk,
    supply_pressure:             Math.round(supplyPressure * 100) / 100,
    demand_pressure:             Math.round(demandPressure * 100) / 100,
    market_equilibrium:          marketEquilibrium,
    price_direction:             priceDirection,
    estimated_price_change_30d_pct: Math.round(estimatedPriceChange30dPct * 100) / 100,
    absorption_rate_days:        absorptionRateDays,
    computed_at:                 computedAt,
  }

  // Persist to market_clearing_snapshots
  void (db
    .from('market_clearing_snapshots')
    .insert({
      tenant_id:                   tenantId,
      property_id:                 propertyId,
      ask_price_eur:               result.ask_price_eur,
      clearing_price_eur:          result.clearing_price_eur,
      price_discovery_confidence:  result.price_discovery_confidence,
      active_bid_count:            result.active_bid_count,
      total_capital_committed_eur: result.total_capital_committed_eur,
      bids_above_ask:              result.bids_above_ask,
      bids_below_ask:              result.bids_below_ask,
      supply_pressure:             result.supply_pressure,
      demand_pressure:             result.demand_pressure,
      market_equilibrium:          result.market_equilibrium,
      price_direction:             result.price_direction,
      estimated_price_change_30d_pct: result.estimated_price_change_30d_pct,
      absorption_rate_days:        result.absorption_rate_days,
      computed_at:                 computedAt,
    })
    .then(({ error }: { error: { message: string } | null }) => {
      if (error) {
        log.warn('[MarketClearing] snapshot persist failed', {
          property_id: propertyId,
          error: error.message,
        })
      }
    }) as Promise<unknown>)

  log.info('[MarketClearing] computed property clearing', {
    property_id:        propertyId,
    clearing_price_eur: result.clearing_price_eur,
    equilibrium:        result.market_equilibrium,
    bids:               result.active_bid_count,
  })

  return result
}

// ─── computeZoneClearing ──────────────────────────────────────────────────────

export async function computeZoneClearing(
  tenantId: string,
  zone: string,
): Promise<ZoneClearingSnapshot> {
  const db = supabaseAdmin as any

  // Fetch all active listings in zone
  const { data: propsRaw, error: propsErr } = await (db
    .from('properties')
    .select('id, preco, created_at')
    .eq('tenant_id', tenantId)
    .eq('zona', zone)
    .eq('status', 'active') as Promise<{ data: PropertyRow[] | null; error: { message: string } | null }>)

  if (propsErr) {
    log.warn('[MarketClearing] zone props query failed', { zone, error: propsErr.message })
  }

  const props = propsRaw ?? []
  const activeListings = props.length
  const snapshotDate   = new Date().toISOString().slice(0, 10)

  if (activeListings === 0) {
    const empty: ZoneClearingSnapshot = {
      zone,
      tenant_id:                tenantId,
      active_listings:          0,
      total_bids:               0,
      avg_clearing_price_eur:   0,
      avg_price_deviation_pct:  0,
      zone_supply_pressure:     0,
      zone_demand_pressure:     0,
      zone_equilibrium:         'balanced',
      capital_velocity_eur_per_day: 0,
      snapshot_date:            snapshotDate,
    }

    await _persistZoneSnapshot(tenantId, zone, empty, snapshotDate)
    return empty
  }

  // Compute clearing for each property in parallel (cap at 20 for perf)
  const sample = props.slice(0, 20)
  const results = await Promise.allSettled(
    sample.map(p => computeMarketClearing(tenantId, p.id)),
  )

  const succeeded: MarketClearingResult[] = []
  for (const r of results) {
    if (r.status === 'fulfilled') succeeded.push(r.value)
  }

  if (succeeded.length === 0) {
    log.warn('[MarketClearing] all zone property clearings failed', { zone })
    const fallback: ZoneClearingSnapshot = {
      zone,
      tenant_id:                tenantId,
      active_listings:          activeListings,
      total_bids:               0,
      avg_clearing_price_eur:   0,
      avg_price_deviation_pct:  0,
      zone_supply_pressure:     0,
      zone_demand_pressure:     0,
      zone_equilibrium:         'balanced',
      capital_velocity_eur_per_day: 0,
      snapshot_date:            snapshotDate,
    }
    await _persistZoneSnapshot(tenantId, zone, fallback, snapshotDate)
    return fallback
  }

  const totalBids = succeeded.reduce((s, r) => s + r.active_bid_count, 0)
  const avgClearingPrice = succeeded.reduce((s, r) => s + r.clearing_price_eur, 0) / succeeded.length

  const deviations = succeeded
    .filter(r => r.ask_price_eur > 0)
    .map(r => (r.clearing_price_eur - r.ask_price_eur) / r.ask_price_eur * 100)
  const avgPriceDeviationPct = deviations.length > 0
    ? deviations.reduce((s, d) => s + d, 0) / deviations.length
    : 0

  const avgSupplyPressure = succeeded.reduce((s, r) => s + r.supply_pressure, 0) / succeeded.length
  const avgDemandPressure = succeeded.reduce((s, r) => s + r.demand_pressure, 0) / succeeded.length
  const zoneEquilibrium   = computeEquilibrium(avgDemandPressure, avgSupplyPressure)

  const totalCapital = succeeded.reduce((s, r) => s + r.total_capital_committed_eur, 0)
  // Velocity: capital committed / avg absorption days
  const avgAbsorption = succeeded.reduce((s, r) => s + r.absorption_rate_days, 0) / succeeded.length
  const capitalVelocityEurPerDay = avgAbsorption > 0
    ? Math.round(totalCapital / avgAbsorption * 100) / 100
    : 0

  const snapshot: ZoneClearingSnapshot = {
    zone,
    tenant_id:                tenantId,
    active_listings:          activeListings,
    total_bids:               totalBids,
    avg_clearing_price_eur:   Math.round(avgClearingPrice * 100) / 100,
    avg_price_deviation_pct:  Math.round(avgPriceDeviationPct * 100) / 100,
    zone_supply_pressure:     Math.round(avgSupplyPressure * 100) / 100,
    zone_demand_pressure:     Math.round(avgDemandPressure * 100) / 100,
    zone_equilibrium:         zoneEquilibrium,
    capital_velocity_eur_per_day: capitalVelocityEurPerDay,
    snapshot_date:            snapshotDate,
  }

  await _persistZoneSnapshot(tenantId, zone, snapshot, snapshotDate)

  log.info('[MarketClearing] zone clearing computed', {
    zone,
    active_listings:    snapshot.active_listings,
    total_bids:         snapshot.total_bids,
    zone_equilibrium:   snapshot.zone_equilibrium,
  })

  return snapshot
}

// ─── _persistZoneSnapshot ─────────────────────────────────────────────────────

async function _persistZoneSnapshot(
  tenantId: string,
  zone: string,
  snapshot: ZoneClearingSnapshot,
  snapshotDate: string,
): Promise<void> {
  const db = supabaseAdmin as any

  const { error } = await (db
    .from('zone_clearing_snapshots')
    .upsert(
      {
        tenant_id:                 tenantId,
        zone,
        active_listings:           snapshot.active_listings,
        total_bids:                snapshot.total_bids,
        avg_clearing_price_eur:    snapshot.avg_clearing_price_eur,
        avg_price_deviation_pct:   snapshot.avg_price_deviation_pct,
        zone_supply_pressure:      snapshot.zone_supply_pressure,
        zone_demand_pressure:      snapshot.zone_demand_pressure,
        zone_equilibrium:          snapshot.zone_equilibrium,
        capital_velocity_eur_per_day: snapshot.capital_velocity_eur_per_day,
        snapshot_date:             snapshotDate,
        computed_at:               new Date().toISOString(),
      },
      { onConflict: 'tenant_id,zone,snapshot_date' },
    ) as Promise<{ error: { message: string } | null }>)

  if (error) {
    log.warn('[MarketClearing] zone snapshot persist failed', { zone, error: error.message })
  }
}

// ─── runDailyZoneClearing ─────────────────────────────────────────────────────

export async function runDailyZoneClearing(tenantId: string): Promise<{
  zones_processed: number
  snapshots_saved: number
}> {
  const db = supabaseAdmin as any

  // Discover all distinct zones with active listings
  const { data: zonesRaw, error: zonesErr } = await (db
    .from('properties')
    .select('zona')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .not('zona', 'is', null) as Promise<{ data: { zona: string }[] | null; error: { message: string } | null }>)

  if (zonesErr || !zonesRaw) {
    log.warn('[MarketClearing] runDailyZoneClearing: failed to fetch zones', {
      error: zonesErr?.message,
    })
    return { zones_processed: 0, snapshots_saved: 0 }
  }

  // Deduplicate zones
  const zones = [...new Set(zonesRaw.map(r => r.zona).filter(Boolean))]

  let snapshotsSaved = 0
  const results = await Promise.allSettled(
    zones.map(zone => computeZoneClearing(tenantId, zone)),
  )

  for (const r of results) {
    if (r.status === 'fulfilled') snapshotsSaved++
    else {
      log.warn('[MarketClearing] runDailyZoneClearing: zone failed', {
        error: r.reason instanceof Error ? r.reason.message : String(r.reason),
      })
    }
  }

  log.info('[MarketClearing] daily zone clearing complete', {
    zones_processed:  zones.length,
    snapshots_saved:  snapshotsSaved,
  })

  return { zones_processed: zones.length, snapshots_saved: snapshotsSaved }
}
