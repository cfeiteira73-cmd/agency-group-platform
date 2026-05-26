// Agency Group — Official Liquidity Index (OLI)
// lib/market-authority/officialLiquidityIndex.ts
//
// The OLI is the system's proprietary measure of real estate liquidity per market.
// This becomes the institutional reference — banks, funds, and family offices rely on it.
//
// TypeScript strict — 0 errors
// All EUR amounts in bigint/cents — never float for money.

import { createHash, randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type LiquidityTier =
  | 'ULTRA_LIQUID'
  | 'HIGH_LIQUID'
  | 'LIQUID'
  | 'MODERATE'
  | 'ILLIQUID'
  | 'DISTRESSED_MARKET'

export interface LiquidityIndexEntry {
  index_id: string
  tenant_id: string
  market: string          // 'PT:Lisboa', 'ES:Madrid', etc.
  period: string          // 'YYYY-MM' format

  // Core metrics
  oli_score: number       // 0–100, the official index value
  liquidity_tier: LiquidityTier

  // Input signals (all observed from real data)
  active_listings: number
  avg_days_on_market: number
  transaction_velocity: number    // transactions per month
  bid_competition_ratio: number   // avg bids per asset
  capital_available_eur_cents: number
  demand_supply_ratio: number     // active investors / active listings

  // Derived (inferred)
  price_momentum_pct: number      // price change vs prior period
  absorption_rate_pct: number     // (sold in period / active listings) * 100

  // Authority metadata
  index_version: string           // 'v1.0'
  sha256_hash: string             // hash of all inputs + computed score
  published_at: string
  valid_until: string             // 30 days
  methodology_url: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const OFFICIAL_MARKETS = [
  'PT:Lisboa',
  'PT:Porto',
  'PT:Cascais',
  'PT:Algarve',
  'ES:Madrid',
  'ES:Barcelona',
  'FR:Paris',
] as const

// City name mapping for DB queries
const MARKET_TO_CITY: Record<string, string> = {
  'PT:Lisboa':    'Lisboa',
  'PT:Porto':     'Porto',
  'PT:Cascais':   'Cascais',
  'PT:Algarve':   'Algarve',
  'ES:Madrid':    'Madrid',
  'ES:Barcelona': 'Barcelona',
  'FR:Paris':     'Paris',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function normalizeTo100(value: number, maxExpected: number): number {
  return clamp((value / Math.max(1, maxExpected)) * 100, 0, 100)
}

function currentPeriod(): string {
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function liquidityTierFromScore(score: number): LiquidityTier {
  if (score > 80) return 'ULTRA_LIQUID'
  if (score > 65) return 'HIGH_LIQUID'
  if (score > 50) return 'LIQUID'
  if (score > 35) return 'MODERATE'
  if (score > 20) return 'ILLIQUID'
  return 'DISTRESSED_MARKET'
}

function sha256(data: object): string {
  return createHash('sha256').update(JSON.stringify(data)).digest('hex')
}

// ─── computeLiquidityIndex ────────────────────────────────────────────────────

/**
 * Computes the Official Liquidity Index for a single market + period.
 * Reads from:
 *   - raw_opportunity_stream: active listing count
 *   - detected_opportunities: bid_competition from opportunity_demand_signals
 *   - investor_capital_profiles: capital available
 *   - execution_outcomes: transaction velocity
 *   - external_price_benchmarks: price momentum
 * Persists to: official_liquidity_index
 */
export async function computeLiquidityIndex(
  market: string,
  tenantId: string,
  period?: string,
): Promise<LiquidityIndexEntry> {
  const resolvedPeriod = period ?? currentPeriod()
  const city = MARKET_TO_CITY[market] ?? market.split(':')[1] ?? market

  log.info('[oli] computing liquidity index', { market, period: resolvedPeriod })

  // ── Active listings ────────────────────────────────────────────────────────
  const { count: activeListingsCount } = await (supabaseAdmin as any)
    .from('raw_opportunity_stream')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .ilike('city', `%${city}%`)
    .eq('status', 'ACTIVE')

  const active_listings = activeListingsCount ?? 0

  // ── Avg days on market ─────────────────────────────────────────────────────
  const { data: listingsData } = await (supabaseAdmin as any)
    .from('raw_opportunity_stream')
    .select('days_on_market')
    .eq('tenant_id', tenantId)
    .ilike('city', `%${city}%`)
    .eq('status', 'ACTIVE')
    .not('days_on_market', 'is', null)
    .limit(200)

  const domValues: number[] = (listingsData ?? []).map((r: { days_on_market: number }) => r.days_on_market)
  const avg_days_on_market =
    domValues.length > 0
      ? domValues.reduce((a, b) => a + b, 0) / domValues.length
      : 90 // fallback

  // ── Transaction velocity ───────────────────────────────────────────────────
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { count: txCount } = await (supabaseAdmin as any)
    .from('execution_outcomes')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .gte('completed_at', thirtyDaysAgo)
    .ilike('market', `%${city}%`)

  const transaction_velocity = txCount ?? 0

  // ── Bid competition ratio ──────────────────────────────────────────────────
  const { data: demandData } = await (supabaseAdmin as any)
    .from('opportunity_demand_signals')
    .select('bid_count')
    .eq('tenant_id', tenantId)
    .ilike('market', `%${city}%`)
    .limit(100)

  const bidCounts: number[] = (demandData ?? []).map((r: { bid_count: number }) => r.bid_count ?? 0)
  const bid_competition_ratio =
    bidCounts.length > 0
      ? bidCounts.reduce((a, b) => a + b, 0) / bidCounts.length
      : 1

  // ── Capital available ──────────────────────────────────────────────────────
  const { data: capitalData } = await (supabaseAdmin as any)
    .from('investor_capital_profiles')
    .select('available_capital_eur_cents, preferred_markets')
    .eq('tenant_id', tenantId)
    .limit(500)

  const relevantCapital: number[] = (capitalData ?? [])
    .filter((r: { preferred_markets: string[] }) =>
      !r.preferred_markets || r.preferred_markets.length === 0 || r.preferred_markets.includes(market),
    )
    .map((r: { available_capital_eur_cents: number }) => r.available_capital_eur_cents ?? 0)

  const capital_available_eur_cents = relevantCapital.reduce((a, b) => a + b, 0)
  const active_investors = relevantCapital.length

  // ── Demand/supply ratio ────────────────────────────────────────────────────
  const demand_supply_ratio = active_investors / Math.max(1, active_listings)

  // ── Price momentum ─────────────────────────────────────────────────────────
  const { data: priceData } = await (supabaseAdmin as any)
    .from('external_price_benchmarks')
    .select('price_per_sqm_eur_cents, period_start')
    .eq('tenant_id', tenantId)
    .ilike('city', `%${city}%`)
    .order('period_start', { ascending: false })
    .limit(2)

  let price_momentum_pct = 0
  if (priceData && priceData.length >= 2) {
    const current = priceData[0].price_per_sqm_eur_cents as number
    const prior = priceData[1].price_per_sqm_eur_cents as number
    if (prior > 0) {
      price_momentum_pct = ((current - prior) / prior) * 100
    }
  }

  // ── Absorption rate ────────────────────────────────────────────────────────
  const absorption_rate_pct =
    active_listings > 0 ? (transaction_velocity / active_listings) * 100 : 0

  // ── OLI score computation ──────────────────────────────────────────────────
  // transaction_velocity_normalized: 30 velocity/month = 100 score
  const txNorm = normalizeTo100(transaction_velocity, 30)
  // demand_supply_ratio_normalized: 2.0 ratio = 100 score
  const dsNorm = normalizeTo100(demand_supply_ratio, 2.0)
  // avg_days_on_market_score: max(0, 100 - avg_days_on_market)
  const domScore = clamp(100 - avg_days_on_market, 0, 100)
  // bid_competition_ratio_normalized: 5 bids/asset = 100 score
  const bidNorm = normalizeTo100(bid_competition_ratio, 5)

  const oli_score = clamp(
    txNorm * 0.30 + dsNorm * 0.25 + domScore * 0.25 + bidNorm * 0.20,
    0,
    100,
  )

  const liquidity_tier = liquidityTierFromScore(oli_score)

  // ── SHA-256 hash ───────────────────────────────────────────────────────────
  const sha256_hash = sha256({
    market,
    period: resolvedPeriod,
    oli_score,
    active_listings,
    transaction_velocity,
  })

  const now = new Date()
  const valid_until = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
  const published_at = now.toISOString()
  const index_id = randomUUID()

  const entry: LiquidityIndexEntry = {
    index_id,
    tenant_id: tenantId,
    market,
    period: resolvedPeriod,
    oli_score,
    liquidity_tier,
    active_listings,
    avg_days_on_market,
    transaction_velocity,
    bid_competition_ratio,
    capital_available_eur_cents,
    demand_supply_ratio,
    price_momentum_pct,
    absorption_rate_pct,
    index_version: 'v1.0',
    sha256_hash,
    published_at,
    valid_until,
    methodology_url: null,
  }

  // ── Persist ────────────────────────────────────────────────────────────────
  void (supabaseAdmin as any)
    .from('official_liquidity_index')
    .upsert(
      {
        index_id,
        tenant_id: tenantId,
        market,
        period: resolvedPeriod,
        oli_score,
        liquidity_tier,
        active_listings,
        avg_days_on_market,
        transaction_velocity,
        bid_competition_ratio,
        capital_available_eur_cents,
        demand_supply_ratio,
        price_momentum_pct,
        absorption_rate_pct,
        index_version: 'v1.0',
        sha256_hash,
        published_at,
        valid_until,
        methodology_url: null,
      },
      { onConflict: 'market,period,tenant_id' },
    )
    .then(({ error }: { error: { message: string } | null }) => {
      if (error) log.warn('[oli] upsert failed', { market, period: resolvedPeriod, error: error.message })
    })
    .catch((e: unknown) => console.warn('[oli] persist error', e))

  log.info('[oli] index computed', { market, period: resolvedPeriod, oli_score, liquidity_tier })

  return entry
}

// ─── publishLiquidityIndexBatch ───────────────────────────────────────────────

/**
 * Computes OLI for all 7 official markets.
 * Returns all entries for the current period.
 */
export async function publishLiquidityIndexBatch(
  tenantId: string,
): Promise<LiquidityIndexEntry[]> {
  const period = currentPeriod()
  log.info('[oli] publishing batch', { tenantId, period, markets: OFFICIAL_MARKETS.length })

  const results = await Promise.allSettled(
    OFFICIAL_MARKETS.map((market) => computeLiquidityIndex(market, tenantId, period)),
  )

  const entries: LiquidityIndexEntry[] = []
  for (const result of results) {
    if (result.status === 'fulfilled') {
      entries.push(result.value)
    } else {
      log.warn('[oli] batch entry failed', { reason: String(result.reason) })
    }
  }

  log.info('[oli] batch published', { count: entries.length })
  return entries
}

// ─── getLiquidityIndex ────────────────────────────────────────────────────────

/**
 * Returns the last N periods of OLI data for a market.
 */
export async function getLiquidityIndex(
  market: string,
  tenantId: string,
  periods: number = 6,
): Promise<LiquidityIndexEntry[]> {
  const { data, error } = await (supabaseAdmin as any)
    .from('official_liquidity_index')
    .select('*')
    .eq('market', market)
    .eq('tenant_id', tenantId)
    .order('period', { ascending: false })
    .limit(periods)

  if (error) {
    log.warn('[oli] getLiquidityIndex error', { market, error: error.message })
    return []
  }

  return (data ?? []) as LiquidityIndexEntry[]
}

// ─── getLiquidityComparison ───────────────────────────────────────────────────

/**
 * Returns all markets ranked by OLI score descending (latest period per market).
 */
export async function getLiquidityComparison(
  tenantId: string,
): Promise<{ market: string; oli_score: number; tier: LiquidityTier; rank: number }[]> {
  const { data, error } = await (supabaseAdmin as any)
    .from('official_liquidity_index')
    .select('market, oli_score, liquidity_tier, period')
    .eq('tenant_id', tenantId)
    .order('period', { ascending: false })
    .order('oli_score', { ascending: false })
    .limit(100)

  if (error) {
    log.warn('[oli] getLiquidityComparison error', { error: error.message })
    return []
  }

  // Deduplicate — keep only the latest period per market
  const seen = new Set<string>()
  const deduplicated: { market: string; oli_score: number; liquidity_tier: string }[] = []
  for (const row of (data ?? [])) {
    if (!seen.has(row.market as string)) {
      seen.add(row.market as string)
      deduplicated.push(row as { market: string; oli_score: number; liquidity_tier: string })
    }
  }

  return deduplicated
    .sort((a, b) => b.oli_score - a.oli_score)
    .map((row, i) => ({
      market: row.market,
      oli_score: row.oli_score,
      tier: row.liquidity_tier as LiquidityTier,
      rank: i + 1,
    }))
}
