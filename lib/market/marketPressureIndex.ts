// =============================================================================
// Agency Group — Market Pressure Index (MPI)
// lib/market/marketPressureIndex.ts
//
// Real-time supply/demand imbalance score, urgency heat, and capital saturation
// for a single property, a zone, or the entire tenant market. Produces a
// composite MPI score (0-100) and label from 'frozen' to 'overheated'.
//
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { computeUrgencyHeat } from '@/lib/market/bidCompetitionEngine'

// ─── Types ────────────────────────────────────────────────────────────────────

export type MpiLabel = 'frozen' | 'cold' | 'balanced' | 'warm' | 'hot' | 'overheated'
export type MpiTrend = 'rising' | 'stable' | 'falling'

export interface MarketPressureIndex {
  scope: 'property' | 'zone' | 'global'
  scope_id: string
  tenant_id: string
  supply_pressure: number
  demand_pressure: number
  urgency_heat: number
  capital_saturation: number
  mpi_score: number
  mpi_label: MpiLabel
  trend: MpiTrend
  computed_at: string
}

// ─── Internal row shapes ──────────────────────────────────────────────────────

interface BidRow {
  investor_id: string
  bid_amount: number
  urgency: string
  created_at: string
}

interface PropertyRow {
  id: string
  preco: number | null
  created_at: string | null
  zona: string | null
}

interface MpiSnapshot {
  mpi_score: number
  computed_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mpiLabel(score: number): MpiLabel {
  if (score < 20) return 'frozen'
  if (score < 40) return 'cold'
  if (score < 60) return 'balanced'
  if (score < 75) return 'warm'
  if (score < 90) return 'hot'
  return 'overheated'
}

function composeMpiScore(
  demandPressure: number,
  urgencyHeat100: number,
  supplyPressure: number,
  capitalSaturation: number,
): number {
  // Invert supply for composite: high supply → low pressure on buyers
  const supplyInv = Math.max(0, 100 - supplyPressure)
  const raw = demandPressure * 0.35
    + urgencyHeat100 * 0.30
    + supplyInv * 0.20
    + capitalSaturation * 0.15
  return Math.round(Math.min(100, Math.max(0, raw)) * 100) / 100
}

async function getPreviousMpiScore(
  tenantId: string,
  scope: string,
  scopeId: string,
): Promise<number | null> {
  const db = supabaseAdmin as any
  const cutoff = new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString() // 26h ago

  const { data, error } = await (db
    .from('market_pressure_snapshots')
    .select('mpi_score, computed_at')
    .eq('tenant_id', tenantId)
    .eq('scope', scope)
    .eq('scope_id', scopeId)
    .gte('computed_at', cutoff)
    .order('computed_at', { ascending: false })
    .limit(1) as Promise<{ data: MpiSnapshot[] | null; error: { message: string } | null }>)

  if (error || !data || data.length === 0) return null
  return data[0].mpi_score
}

function computeTrend(current: number, previous: number | null): MpiTrend {
  if (previous === null) return 'stable'
  const delta = current - previous
  if (delta >= 5)  return 'rising'
  if (delta <= -5) return 'falling'
  return 'stable'
}

// ─── persistMPI ───────────────────────────────────────────────────────────────

export async function persistMPI(mpi: MarketPressureIndex): Promise<void> {
  const db = supabaseAdmin as any

  const { error } = await (db
    .from('market_pressure_snapshots')
    .insert({
      scope:              mpi.scope,
      scope_id:           mpi.scope_id,
      tenant_id:          mpi.tenant_id,
      supply_pressure:    mpi.supply_pressure,
      demand_pressure:    mpi.demand_pressure,
      urgency_heat:       mpi.urgency_heat,
      capital_saturation: mpi.capital_saturation,
      mpi_score:          mpi.mpi_score,
      mpi_label:          mpi.mpi_label,
      trend:              mpi.trend,
      computed_at:        mpi.computed_at,
    }) as Promise<{ error: { message: string } | null }>)

  if (error) {
    log.warn('[marketPressure] persistMPI failed', {
      scope:    mpi.scope,
      scope_id: mpi.scope_id,
      error:    error.message,
    })
  }
}

// ─── computePropertyMPI ───────────────────────────────────────────────────────

export async function computePropertyMPI(
  tenantId: string,
  propertyId: string,
): Promise<MarketPressureIndex> {
  const db  = supabaseAdmin as any
  const now = new Date().toISOString()

  const fallback: MarketPressureIndex = {
    scope:              'property',
    scope_id:           propertyId,
    tenant_id:          tenantId,
    supply_pressure:    50,
    demand_pressure:    0,
    urgency_heat:       0,
    capital_saturation: 0,
    mpi_score:          10,
    mpi_label:          'frozen',
    trend:              'stable',
    computed_at:        now,
  }

  try {
    // Fetch property
    const { data: propRaw, error: propErr } = await (db
      .from('properties')
      .select('id, preco, created_at')
      .eq('id', propertyId)
      .eq('tenant_id', tenantId)
      .single() as Promise<{ data: PropertyRow | null; error: { message: string } | null }>)

    if (propErr || !propRaw) {
      log.warn('[marketPressure] computePropertyMPI: property not found', { property_id: propertyId })
      return fallback
    }

    const askPrice     = propRaw.preco ?? 0
    const listingDate  = propRaw.created_at ? new Date(propRaw.created_at) : new Date()
    const daysOnMarket = Math.max(0, (Date.now() - listingDate.getTime()) / (1000 * 60 * 60 * 24))

    // Fetch active bids
    const { data: bidsRaw, error: bidsErr } = await (db
      .from('investor_bids')
      .select('investor_id, bid_amount, urgency, created_at')
      .eq('tenant_id', tenantId)
      .eq('property_id', propertyId)
      .eq('status', 'active') as Promise<{ data: BidRow[] | null; error: { message: string } | null }>)

    if (bidsErr) {
      log.warn('[marketPressure] computePropertyMPI bids failed', { error: bidsErr.message })
    }

    const bids     = bidsRaw ?? []
    const bidCount = bids.length
    const totalCapitalCommitted = bids.reduce((s, b) => s + b.bid_amount, 0)

    // supply_pressure: based on days on market (0-100)
    let supply_pressure: number
    if (daysOnMarket < 30)       supply_pressure = 15
    else if (daysOnMarket < 90)  supply_pressure = 40
    else if (daysOnMarket < 180) supply_pressure = 65
    else                         supply_pressure = 85

    // demand_pressure: active bids scaled 0-100
    const demand_pressure = Math.min(100, bidCount * 15)

    // urgency_heat: scaled to 0-100
    const urgencyHeat01  = computeUrgencyHeat(bids.map(b => ({ urgency: b.urgency, created_at: b.created_at })))
    const urgency_heat   = Math.round(urgencyHeat01 * 100 * 100) / 100

    // capital_saturation: committed / ask * 100 capped at 100
    const capital_saturation = askPrice > 0
      ? Math.min(100, Math.round((totalCapitalCommitted / askPrice) * 100 * 100) / 100)
      : 0

    const mpi_score = composeMpiScore(demand_pressure, urgency_heat, supply_pressure, capital_saturation)

    const previousScore = await getPreviousMpiScore(tenantId, 'property', propertyId)
    const trend         = computeTrend(mpi_score, previousScore)

    const mpi: MarketPressureIndex = {
      scope:              'property',
      scope_id:           propertyId,
      tenant_id:          tenantId,
      supply_pressure:    Math.round(supply_pressure * 100) / 100,
      demand_pressure:    Math.round(demand_pressure * 100) / 100,
      urgency_heat:       Math.round(urgency_heat * 100) / 100,
      capital_saturation: Math.round(capital_saturation * 100) / 100,
      mpi_score,
      mpi_label:          mpiLabel(mpi_score),
      trend,
      computed_at:        now,
    }

    void persistMPI(mpi).catch(e =>
      log.warn('[marketPressure] fire-and-forget persistMPI failed', {
        error: e instanceof Error ? e.message : String(e),
      }),
    )

    log.info('[marketPressure] computePropertyMPI', {
      property_id: propertyId,
      mpi_score,
      mpi_label:   mpi.mpi_label,
      trend,
    })

    return mpi
  } catch (err) {
    log.error('[marketPressure] computePropertyMPI exception', err instanceof Error ? err : undefined, {
      property_id: propertyId,
    })
    return fallback
  }
}

// ─── computeZoneMPI ───────────────────────────────────────────────────────────

export async function computeZoneMPI(
  tenantId: string,
  zone: string,
): Promise<MarketPressureIndex> {
  const db  = supabaseAdmin as any
  const now = new Date().toISOString()

  const fallback: MarketPressureIndex = {
    scope:              'zone',
    scope_id:           zone,
    tenant_id:          tenantId,
    supply_pressure:    50,
    demand_pressure:    0,
    urgency_heat:       0,
    capital_saturation: 0,
    mpi_score:          10,
    mpi_label:          'frozen',
    trend:              'stable',
    computed_at:        now,
  }

  try {
    // Fetch all active listings in zone
    const { data: propsRaw, error: propsErr } = await (db
      .from('properties')
      .select('id, preco, created_at')
      .eq('tenant_id', tenantId)
      .eq('zona', zone)
      .eq('status', 'active') as Promise<{ data: PropertyRow[] | null; error: { message: string } | null }>)

    if (propsErr) {
      log.warn('[marketPressure] computeZoneMPI props failed', { zone, error: propsErr.message })
    }

    const props = propsRaw ?? []
    if (props.length === 0) return fallback

    const propIds = props.map(p => p.id)

    // Fetch all active bids for these properties
    const { data: bidsRaw, error: bidsErr } = await (db
      .from('investor_bids')
      .select('investor_id, bid_amount, urgency, created_at, property_id')
      .eq('tenant_id', tenantId)
      .in('property_id', propIds)
      .eq('status', 'active') as Promise<{ data: (BidRow & { property_id: string })[] | null; error: { message: string } | null }>)

    if (bidsErr) {
      log.warn('[marketPressure] computeZoneMPI bids failed', { zone, error: bidsErr.message })
    }

    const bids       = bidsRaw ?? []
    const totalBids  = bids.length
    const totalCapital = bids.reduce((s, b) => s + b.bid_amount, 0)
    const totalAsk   = props.reduce((s, p) => s + (p.preco ?? 0), 0)

    // Average days on market
    const now_ = Date.now()
    const avgDom = props.reduce((s, p) => {
      const d = p.created_at ? new Date(p.created_at).getTime() : now_
      return s + Math.max(0, (now_ - d) / (1000 * 60 * 60 * 24))
    }, 0) / props.length

    let supply_pressure: number
    if (avgDom < 30)       supply_pressure = 15
    else if (avgDom < 90)  supply_pressure = 40
    else if (avgDom < 180) supply_pressure = 65
    else                   supply_pressure = 85

    const demand_pressure = Math.min(100, (totalBids / Math.max(1, props.length)) * 15)

    const urgencyHeat01  = computeUrgencyHeat(bids.map(b => ({ urgency: b.urgency, created_at: b.created_at })))
    const urgency_heat   = Math.round(urgencyHeat01 * 100 * 100) / 100

    const capital_saturation = totalAsk > 0
      ? Math.min(100, Math.round((totalCapital / totalAsk) * 100 * 100) / 100)
      : 0

    const mpi_score = composeMpiScore(demand_pressure, urgency_heat, supply_pressure, capital_saturation)

    const previousScore = await getPreviousMpiScore(tenantId, 'zone', zone)
    const trend         = computeTrend(mpi_score, previousScore)

    const mpi: MarketPressureIndex = {
      scope:              'zone',
      scope_id:           zone,
      tenant_id:          tenantId,
      supply_pressure:    Math.round(supply_pressure * 100) / 100,
      demand_pressure:    Math.round(demand_pressure * 100) / 100,
      urgency_heat:       Math.round(urgency_heat * 100) / 100,
      capital_saturation: Math.round(capital_saturation * 100) / 100,
      mpi_score,
      mpi_label:          mpiLabel(mpi_score),
      trend,
      computed_at:        now,
    }

    void persistMPI(mpi).catch(e =>
      log.warn('[marketPressure] fire-and-forget zone persistMPI failed', {
        error: e instanceof Error ? e.message : String(e),
      }),
    )

    log.info('[marketPressure] computeZoneMPI', {
      zone,
      mpi_score,
      mpi_label: mpi.mpi_label,
      trend,
    })

    return mpi
  } catch (err) {
    log.error('[marketPressure] computeZoneMPI exception', err instanceof Error ? err : undefined, { zone })
    return fallback
  }
}

// ─── computeGlobalMPI ─────────────────────────────────────────────────────────

export async function computeGlobalMPI(tenantId: string): Promise<MarketPressureIndex> {
  const db  = supabaseAdmin as any
  const now = new Date().toISOString()

  const fallback: MarketPressureIndex = {
    scope:              'global',
    scope_id:           'global',
    tenant_id:          tenantId,
    supply_pressure:    50,
    demand_pressure:    0,
    urgency_heat:       0,
    capital_saturation: 0,
    mpi_score:          10,
    mpi_label:          'frozen',
    trend:              'stable',
    computed_at:        now,
  }

  try {
    // Total active listings
    const { count: listingCount, error: listingErr } = await (db
      .from('properties')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'active') as Promise<{ count: number | null; error: { message: string } | null }>)

    if (listingErr) {
      log.warn('[marketPressure] computeGlobalMPI listing count failed', { error: listingErr.message })
    }

    const totalListings = listingCount ?? 0

    // Total active bids + capital
    const { data: bidsRaw, error: bidsErr } = await (db
      .from('investor_bids')
      .select('investor_id, bid_amount, urgency, created_at')
      .eq('tenant_id', tenantId)
      .eq('status', 'active') as Promise<{ data: BidRow[] | null; error: { message: string } | null }>)

    if (bidsErr) {
      log.warn('[marketPressure] computeGlobalMPI bids failed', { error: bidsErr.message })
    }

    const bids         = bidsRaw ?? []
    const totalBids    = bids.length
    const totalCapital = bids.reduce((s, b) => s + b.bid_amount, 0)

    // Total ask capital
    const { data: priceRaw } = await (db
      .from('properties')
      .select('preco')
      .eq('tenant_id', tenantId)
      .eq('status', 'active') as Promise<{ data: { preco: number | null }[] | null; error: unknown }>)

    const totalAsk = (priceRaw ?? []).reduce((s, p) => s + (p.preco ?? 0), 0)

    // supply_pressure: listing volume (normalized against a 200-listing market)
    const supply_pressure = Math.min(100, (totalListings / 200) * 60 + 20)

    // demand_pressure: bids per listing
    const bidsPerListing  = totalListings > 0 ? totalBids / totalListings : 0
    const demand_pressure = Math.min(100, bidsPerListing * 20)

    const urgencyHeat01  = computeUrgencyHeat(bids.map(b => ({ urgency: b.urgency, created_at: b.created_at })))
    const urgency_heat   = Math.round(urgencyHeat01 * 100 * 100) / 100

    const capital_saturation = totalAsk > 0
      ? Math.min(100, Math.round((totalCapital / totalAsk) * 100 * 100) / 100)
      : 0

    const mpi_score = composeMpiScore(demand_pressure, urgency_heat, supply_pressure, capital_saturation)

    const previousScore = await getPreviousMpiScore(tenantId, 'global', 'global')
    const trend         = computeTrend(mpi_score, previousScore)

    const mpi: MarketPressureIndex = {
      scope:              'global',
      scope_id:           'global',
      tenant_id:          tenantId,
      supply_pressure:    Math.round(supply_pressure * 100) / 100,
      demand_pressure:    Math.round(demand_pressure * 100) / 100,
      urgency_heat:       Math.round(urgency_heat * 100) / 100,
      capital_saturation: Math.round(capital_saturation * 100) / 100,
      mpi_score,
      mpi_label:          mpiLabel(mpi_score),
      trend,
      computed_at:        now,
    }

    void persistMPI(mpi).catch(e =>
      log.warn('[marketPressure] fire-and-forget global persistMPI failed', {
        error: e instanceof Error ? e.message : String(e),
      }),
    )

    log.info('[marketPressure] computeGlobalMPI', {
      tenant_id:      tenantId,
      mpi_score,
      mpi_label:      mpi.mpi_label,
      trend,
      total_listings: totalListings,
      total_bids:     totalBids,
    })

    return mpi
  } catch (err) {
    log.error('[marketPressure] computeGlobalMPI exception', err instanceof Error ? err : undefined, {
      tenant_id: tenantId,
    })
    return fallback
  }
}
