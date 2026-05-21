// Agency Group — Price Discovery Engine
// lib/marketplace/priceDiscoveryEngine.ts
// Price is NOT fixed. It is a function of:
//   1. Active bids (supply of willing capital)
//   2. Capital velocity (how fast capital is entering the market)
//   3. Scarcity (available assets in zone relative to demand)
//   4. Competition intensity (number of competing investors)
// Produces a MARKET PRICE, not a listing price.
// TypeScript strict — 0 errors

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PriceDiscoveryInput {
  asset_id:               string
  tenant_id:              string
  listed_price_eur_cents: number
  zone:                   string
}

export interface PriceDriver {
  factor:           string
  weight:           number
  value:            number
  impact_eur_cents: number
  direction:        'UP' | 'DOWN' | 'NEUTRAL'
}

export interface MarketPrice {
  asset_id:               string
  tenant_id:              string
  listed_price_eur_cents: number
  market_price_eur_cents: number
  price_premium_pct:      number
  confidence:             'HIGH' | 'MEDIUM' | 'LOW'
  drivers:                PriceDriver[]
  computed_at:            string
}

// ─── Internal row shapes ──────────────────────────────────────────────────────

interface BidRow {
  amount_eur_cents: number
}

interface LedgerEntryRow {
  amount_eur_cents: number
}

interface PropertyRow {
  id: string
}

interface PriceDiscoveryRow {
  id:                     string
  tenant_id:              string
  asset_id:               string
  listed_price_eur_cents: number
  market_price_eur_cents: number
  price_premium_pct:      number
  confidence:             string
  drivers:                PriceDriver[]
  computed_at:            string
}

// ─── computeMarketPrice ───────────────────────────────────────────────────────

export async function computeMarketPrice(
  input: PriceDiscoveryInput,
): Promise<MarketPrice> {
  const db  = supabaseAdmin as any
  const now = new Date().toISOString()
  const listedPrice = input.listed_price_eur_cents

  const drivers: PriceDriver[] = []

  // ── Factor 1: Bid pressure ─────────────────────────────────────────────────
  const { data: bidRows } = await (db
    .from('asset_bids')
    .select('amount_eur_cents')
    .eq('tenant_id', input.tenant_id)
    .eq('asset_id', input.asset_id)
    .in('bid_status', ['PENDING', 'ACTIVE']) as Promise<{
      data: BidRow[] | null
      error: unknown
    }>)

  const bids = bidRows ?? []
  const activeBidCount = bids.length
  const topBid = activeBidCount > 0 ? Math.max(...bids.map(b => b.amount_eur_cents)) : 0

  let bidPressureFactor = 0
  if (topBid > listedPrice && listedPrice > 0) {
    // integer-safe: (topBid - listedPrice) * 10000 / listedPrice → basis points
    bidPressureFactor = (topBid - listedPrice) / listedPrice
  }

  const bidPressureImpact = Math.round(listedPrice * bidPressureFactor)
  drivers.push({
    factor:           'bid_pressure',
    weight:           1.0,
    value:            bidPressureFactor,
    impact_eur_cents: bidPressureImpact,
    direction:        bidPressureFactor > 0 ? 'UP' : 'NEUTRAL',
  })

  // ── Factor 2: Capital velocity ─────────────────────────────────────────────
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString()

  const { data: ledgerRows } = await (db
    .from('investor_ledger_entries')
    .select('amount_eur_cents')
    .eq('tenant_id', input.tenant_id)
    .eq('entry_type', 'DEPOSIT')
    .gte('created_at', sevenDaysAgo) as Promise<{
      data: LedgerEntryRow[] | null
      error: unknown
    }>)

  // Total deposits in EUR cents (integer arithmetic)
  const totalDeposits = (ledgerRows ?? []).reduce(
    (sum, r) => sum + r.amount_eur_cents,
    0,
  )

  // Baseline: €1M = 100_000_00 cents (1_000_000 * 100)
  const baselineCents = 100_000_00
  // capital_velocity_factor = min(1.0, totalDeposits / baselineCents * 0.1)
  // Keep integer: factor × 10000 for basis points
  const capitalVelocityFactor = Math.min(1.0, (totalDeposits / baselineCents) * 0.1)

  // Impact = listedPrice × capitalVelocityFactor × 0.02 (integer math)
  // = listedPrice × factor × 2 / 100
  const capitalVelocityImpact = Math.round(listedPrice * capitalVelocityFactor * 2 / 100)
  drivers.push({
    factor:           'capital_velocity',
    weight:           0.02,
    value:            capitalVelocityFactor,
    impact_eur_cents: capitalVelocityImpact,
    direction:        capitalVelocityFactor > 0 ? 'UP' : 'NEUTRAL',
  })

  // ── Factor 3: Scarcity ─────────────────────────────────────────────────────
  const { data: propRows } = await (db
    .from('properties')
    .select('id')
    .eq('tenant_id', input.tenant_id)
    .eq('zone', input.zone) as Promise<{
      data: PropertyRow[] | null
      error: unknown
    }>)

  const availableCount = (propRows ?? []).length
  // scarcity = max(0, (10 - available_count) / 10) → premium 0–5%
  const scarcityFactor = Math.max(0, (10 - availableCount) / 10)

  // Impact = listedPrice × scarcityFactor × 0.05
  const scarcityImpact = Math.round(listedPrice * scarcityFactor * 5 / 100)
  drivers.push({
    factor:           'scarcity',
    weight:           0.05,
    value:            scarcityFactor,
    impact_eur_cents: scarcityImpact,
    direction:        scarcityFactor > 0 ? 'UP' : 'NEUTRAL',
  })

  // ── Factor 4: Competition ──────────────────────────────────────────────────
  // Each bid above 1 adds 1% premium, capped at 10%
  const competitionExtra = Math.min(10, Math.max(0, activeBidCount - 1))
  const competitionFactor = competitionExtra / 100

  // Impact = listedPrice × competitionFactor
  const competitionImpact = Math.round(listedPrice * competitionFactor)
  drivers.push({
    factor:           'competition',
    weight:           0.01,
    value:            competitionFactor,
    impact_eur_cents: competitionImpact,
    direction:        competitionFactor > 0 ? 'UP' : 'NEUTRAL',
  })

  // ── Final market price ─────────────────────────────────────────────────────
  // market_price = listed_price × (1 + bid_pressure + capital_velocity×0.02 + scarcity×0.05 + competition×0.01)
  // Integer arithmetic: compute total multiplier in basis points
  const totalMultiplierBps = Math.round(
    bidPressureFactor * 10000
    + capitalVelocityFactor * 0.02 * 10000
    + scarcityFactor * 0.05 * 10000
    + competitionFactor * 10000,
  )

  const marketPrice = Math.round(listedPrice * (10000 + totalMultiplierBps) / 10000)

  // price_premium_pct in basis points → percentage
  const premiumPct = listedPrice > 0
    ? Math.round(((marketPrice - listedPrice) * 10000) / listedPrice) / 100
    : 0

  const confidence: 'HIGH' | 'MEDIUM' | 'LOW' =
    activeBidCount > 5 ? 'HIGH' : activeBidCount > 1 ? 'MEDIUM' : 'LOW'

  const result: MarketPrice = {
    asset_id:               input.asset_id,
    tenant_id:              input.tenant_id,
    listed_price_eur_cents: listedPrice,
    market_price_eur_cents: marketPrice,
    price_premium_pct:      premiumPct,
    confidence,
    drivers,
    computed_at:            now,
  }

  // Persist to price_discovery_records (fire-and-forget)
  void (db
    .from('price_discovery_records')
    .insert({
      tenant_id:              input.tenant_id,
      asset_id:               input.asset_id,
      listed_price_eur_cents: listedPrice,
      market_price_eur_cents: marketPrice,
      price_premium_pct:      premiumPct,
      confidence,
      drivers:                drivers,
      computed_at:            now,
    }) as Promise<{ error: { message: string } | null }>)
    .then(({ error }: { error: { message: string } | null }) => {
      if (error) {
        log.warn('[priceDiscoveryEngine] persist failed', { asset_id: input.asset_id, error: error.message })
      }
    })
    .catch((e: unknown) => console.warn('[priceDiscoveryEngine]', e))

  log.info('[priceDiscoveryEngine] computeMarketPrice', {
    asset_id:     input.asset_id,
    market_price: marketPrice,
    confidence,
  })

  return result
}

// ─── getPriceHistory ──────────────────────────────────────────────────────────

export async function getPriceHistory(
  assetId: string,
  tenantId: string,
): Promise<MarketPrice[]> {
  const db = supabaseAdmin as any

  const { data: rows, error } = await (db
    .from('price_discovery_records')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('asset_id', assetId)
    .order('computed_at', { ascending: false }) as Promise<{
      data: PriceDiscoveryRow[] | null
      error: { message: string } | null
    }>)

  if (error) {
    log.warn('[priceDiscoveryEngine] getPriceHistory failed', {
      asset_id: assetId,
      error: error.message,
    })
    return []
  }

  return (rows ?? []).map(row => ({
    asset_id:               row.asset_id,
    tenant_id:              row.tenant_id,
    listed_price_eur_cents: row.listed_price_eur_cents,
    market_price_eur_cents: row.market_price_eur_cents,
    price_premium_pct:      row.price_premium_pct,
    confidence:             row.confidence as 'HIGH' | 'MEDIUM' | 'LOW',
    drivers:                (row.drivers as PriceDriver[]) ?? [],
    computed_at:            row.computed_at,
  }))
}

// ─── getZoneMarketPressure ────────────────────────────────────────────────────

export async function getZoneMarketPressure(
  zone: string,
  tenantId: string,
): Promise<{
  zone:                        string
  avg_premium_pct:             number
  active_bids:                 number
  capital_velocity_eur_cents:  number
  market_status:               'HOT' | 'WARM' | 'COOL' | 'COLD'
}> {
  const db = supabaseAdmin as any

  // Get all assets in zone
  const { data: propRows } = await (db
    .from('properties')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('zone', zone) as Promise<{
      data: Array<{ id: string }> | null
      error: unknown
    }>)

  const assetIds = (propRows ?? []).map(p => p.id)

  let activeBids = 0
  let totalPremiumPct = 0
  let premiumCount = 0

  if (assetIds.length > 0) {
    // Count active bids across all zone assets
    const { data: bidRows } = await (db
      .from('asset_bids')
      .select('asset_id')
      .eq('tenant_id', tenantId)
      .in('asset_id', assetIds)
      .in('bid_status', ['PENDING', 'ACTIVE']) as Promise<{
        data: Array<{ asset_id: string }> | null
        error: unknown
      }>)

    activeBids = (bidRows ?? []).length

    // Average premium from recent price discovery records
    const { data: priceRows } = await (db
      .from('price_discovery_records')
      .select('price_premium_pct')
      .eq('tenant_id', tenantId)
      .in('asset_id', assetIds)
      .order('computed_at', { ascending: false })
      .limit(50) as Promise<{
        data: Array<{ price_premium_pct: number }> | null
        error: unknown
      }>)

    const priceRecords = priceRows ?? []
    premiumCount = priceRecords.length
    totalPremiumPct = priceRecords.reduce((s, r) => s + r.price_premium_pct, 0)
  }

  const avgPremiumPct = premiumCount > 0 ? Math.round((totalPremiumPct / premiumCount) * 100) / 100 : 0

  // Capital velocity: last 7 days deposits
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString()
  const { data: ledgerRows } = await (db
    .from('investor_ledger_entries')
    .select('amount_eur_cents')
    .eq('tenant_id', tenantId)
    .eq('entry_type', 'DEPOSIT')
    .gte('created_at', sevenDaysAgo) as Promise<{
      data: Array<{ amount_eur_cents: number }> | null
      error: unknown
    }>)

  const capitalVelocityEurCents = (ledgerRows ?? []).reduce(
    (sum, r) => sum + r.amount_eur_cents,
    0,
  )

  // market_status based on active bids and premium
  let marketStatus: 'HOT' | 'WARM' | 'COOL' | 'COLD'
  if (activeBids >= 10 || avgPremiumPct >= 5) {
    marketStatus = 'HOT'
  } else if (activeBids >= 5 || avgPremiumPct >= 2) {
    marketStatus = 'WARM'
  } else if (activeBids >= 2 || avgPremiumPct >= 0) {
    marketStatus = 'COOL'
  } else {
    marketStatus = 'COLD'
  }

  return {
    zone,
    avg_premium_pct:            avgPremiumPct,
    active_bids:                activeBids,
    capital_velocity_eur_cents: capitalVelocityEurCents,
    market_status:              marketStatus,
  }
}
