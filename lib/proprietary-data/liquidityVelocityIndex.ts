// Agency Group — Liquidity Velocity Index (LVI)
// lib/proprietary-data/liquidityVelocityIndex.ts
// Proprietary measure of how fast capital is moving through markets.
// TypeScript strict — 0 errors

import { createHash, randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LiquidityVelocityRecord {
  lvi_id: string
  tenant_id: string
  market: string
  period: string          // 'YYYY-MM'

  // Velocity metrics
  lvi_score: number               // 0–100 (THE proprietary index)
  capital_turnover_rate: number   // capital deployed this month / total available capital
  deal_velocity: number           // deals closed this month
  bid_velocity: number            // bids placed per asset per week
  price_discovery_speed_days: number  // avg days from listing to first bid

  // Momentum
  lvi_change_pct: number | null   // vs prior period
  velocity_trend: 'ACCELERATING' | 'STABLE' | 'DECELERATING'

  // Context
  active_listings: number
  active_investors: number

  sha256_hash: string
  computed_at: string
}

// ─── Markets ──────────────────────────────────────────────────────────────────

const ALL_MARKETS = [
  'PT:Lisboa',
  'PT:Porto',
  'PT:Algarve',
  'PT:Cascais',
  'PT:Madeira',
  'PT:Acores',
  'ES:Madrid',
]

// ─── getPeriod ────────────────────────────────────────────────────────────────

function getPeriod(date?: Date): string {
  const d = date ?? new Date()
  const year = d.getUTCFullYear()
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function getPriorPeriod(period: string): string {
  const [y, m] = period.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, 1))
  date.setUTCMonth(date.getUTCMonth() - 1)
  return getPeriod(date)
}

// ─── Normalization helpers ─────────────────────────────────────────────────────

/**
 * Normalizes a value to 0–100 scale using soft-cap approach.
 * max_expected defines what maps to score 100.
 */
function normalizeScore(value: number, maxExpected: number): number {
  if (maxExpected <= 0) return 0
  return Math.min(100, (value / maxExpected) * 100)
}

// ─── computeLVI ───────────────────────────────────────────────────────────────

/**
 * Computes the Liquidity Velocity Index for a market in a given period.
 *
 * LVI formula:
 *   (deal_velocity_normalized * 35)
 * + (bid_velocity_normalized * 30)
 * + (capital_turnover_rate * 20)
 * + (price_discovery_speed_score * 15)
 *
 * price_discovery_speed_score = max(0, 100 - price_discovery_speed_days)
 *
 * Persists to `liquidity_velocity_index`. SHA-256 over canonical fields.
 * Source: Observed (feedback_signals, investor_capital_profiles) + Inferred (LVI score).
 */
export async function computeLVI(
  market: string,
  tenantId: string,
  period?: string,
): Promise<LiquidityVelocityRecord> {
  const currentPeriod = period ?? getPeriod()
  const [periodYear, periodMonth] = currentPeriod.split('-').map(Number)
  const periodStart = new Date(Date.UTC(periodYear, periodMonth - 1, 1)).toISOString()
  const periodEnd = new Date(Date.UTC(periodYear, periodMonth, 1)).toISOString()

  // 1. Deal velocity — DEAL_CLOSED count from feedback_signals (observed)
  const { data: dealSignals } = await (supabaseAdmin as any)
    .from('feedback_signals')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('market', market)
    .eq('signal_type', 'DEAL_CLOSED')
    .gte('created_at', periodStart)
    .lt('created_at', periodEnd)

  const dealVelocity: number = (dealSignals ?? []).length

  // 2. Bid velocity — BID_SUBMITTED count / (active_listings * 4 weeks) (observed)
  const { data: bidSignals } = await (supabaseAdmin as any)
    .from('feedback_signals')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('market', market)
    .eq('signal_type', 'BID_SUBMITTED')
    .gte('created_at', periodStart)
    .lt('created_at', periodEnd)

  const totalBids: number = (bidSignals ?? []).length

  // 3. Active listings from raw_opportunity_stream (observed)
  const { data: listings } = await (supabaseAdmin as any)
    .from('raw_opportunity_stream')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('market', market)
    .eq('status', 'ACTIVE')

  const activeListings: number = (listings ?? []).length
  const bidVelocity: number = activeListings > 0 ? totalBids / (activeListings * 4) : 0

  // 4. Capital turnover rate from investor_capital_profiles (observed)
  const { data: capitalProfiles } = await (supabaseAdmin as any)
    .from('investor_capital_profiles')
    .select('available_capital_eur_cents, deployed_this_period_eur_cents')
    .eq('tenant_id', tenantId)
    .eq('market', market)

  type CapitalProfile = {
    available_capital_eur_cents?: number
    deployed_this_period_eur_cents?: number
  }

  const totalAvailable = ((capitalProfiles ?? []) as CapitalProfile[])
    .reduce((s: number, p: CapitalProfile) => s + (p.available_capital_eur_cents ?? 0), 0)
  const totalDeployed = ((capitalProfiles ?? []) as CapitalProfile[])
    .reduce((s: number, p: CapitalProfile) => s + (p.deployed_this_period_eur_cents ?? 0), 0)
  const capitalTurnoverRate: number = totalAvailable > 0 ? totalDeployed / totalAvailable : 0
  const activeInvestors: number = (capitalProfiles ?? []).length

  // 5. Price discovery speed from time_to_close_records (observed + inferred)
  const { data: ttcRecords } = await (supabaseAdmin as any)
    .from('time_to_close_records')
    .select('days_listing_to_first_bid')
    .eq('tenant_id', tenantId)
    .eq('market', market)
    .gte('recorded_at', periodStart)
    .lt('recorded_at', periodEnd)
    .not('days_listing_to_first_bid', 'is', null)

  type TtcRow = { days_listing_to_first_bid?: number }
  const speedDays: number[] = ((ttcRecords ?? []) as TtcRow[])
    .map((r: TtcRow) => r.days_listing_to_first_bid ?? 0)
    .filter((d: number) => d >= 0)

  const priceDiscoverySpeedDays: number = speedDays.length > 0
    ? speedDays.reduce((s: number, d: number) => s + d, 0) / speedDays.length
    : 30 // fallback: 30 days (inferred baseline)

  // ── LVI Score computation ─────────────────────────────────────────────────
  // Normalization baselines (what represents 100% velocity in this market):
  // deal_velocity: 20 deals/month = excellent
  // bid_velocity: 2.0 bids/asset/week = excellent
  // capital_turnover_rate: already 0–1, multiply by 100
  // price_discovery_speed_score: max(0, 100 - days)

  const dealVelocityNorm = normalizeScore(dealVelocity, 20)
  const bidVelocityNorm = normalizeScore(bidVelocity, 2.0)
  const capitalTurnoverScore = Math.min(100, capitalTurnoverRate * 100)
  const priceDiscoverySpeedScore = Math.max(0, 100 - priceDiscoverySpeedDays)

  const lviScore =
    (dealVelocityNorm * 0.35) +
    (bidVelocityNorm * 0.30) +
    (capitalTurnoverScore * 0.20) +
    (priceDiscoverySpeedScore * 0.15)

  // ── Prior period comparison (trend) ──────────────────────────────────────
  const priorPeriod = getPriorPeriod(currentPeriod)
  const { data: priorRecord } = await (supabaseAdmin as any)
    .from('liquidity_velocity_index')
    .select('lvi_score')
    .eq('tenant_id', tenantId)
    .eq('market', market)
    .eq('period', priorPeriod)
    .maybeSingle()

  let lviChangePct: number | null = null
  let velocityTrend: LiquidityVelocityRecord['velocity_trend'] = 'STABLE'

  if (priorRecord?.lvi_score != null && priorRecord.lvi_score > 0) {
    lviChangePct = ((lviScore - priorRecord.lvi_score) / priorRecord.lvi_score) * 100
    if (lviChangePct > 5) velocityTrend = 'ACCELERATING'
    else if (lviChangePct < -5) velocityTrend = 'DECELERATING'
    else velocityTrend = 'STABLE'
  }

  // ── SHA-256 hash ──────────────────────────────────────────────────────────
  const canonical = JSON.stringify({
    market,
    period: currentPeriod,
    lvi_score: lviScore,
    deal_velocity: dealVelocity,
    bid_velocity: bidVelocity,
    capital_turnover_rate: capitalTurnoverRate,
    price_discovery_speed_days: priceDiscoverySpeedDays,
  })
  const sha256Hash = createHash('sha256').update(canonical).digest('hex')

  const lvi_id = randomUUID()
  const computedAt = new Date().toISOString()

  const record: LiquidityVelocityRecord = {
    lvi_id,
    tenant_id: tenantId,
    market,
    period: currentPeriod,
    lvi_score: Math.round(lviScore * 100) / 100,
    capital_turnover_rate: capitalTurnoverRate,
    deal_velocity: dealVelocity,
    bid_velocity: Math.round(bidVelocity * 1000) / 1000,
    price_discovery_speed_days: Math.round(priceDiscoverySpeedDays * 100) / 100,
    lvi_change_pct: lviChangePct != null ? Math.round(lviChangePct * 10000) / 10000 : null,
    velocity_trend: velocityTrend,
    active_listings: activeListings,
    active_investors: activeInvestors,
    sha256_hash: sha256Hash,
    computed_at: computedAt,
  }

  // Upsert by (market, period, tenant_id)
  const { error: upsertErr } = await (supabaseAdmin as any)
    .from('liquidity_velocity_index')
    .upsert(
      {
        lvi_id,
        tenant_id: tenantId,
        market,
        period: currentPeriod,
        lvi_score: record.lvi_score,
        capital_turnover_rate: record.capital_turnover_rate,
        deal_velocity: record.deal_velocity,
        bid_velocity: record.bid_velocity,
        price_discovery_speed_days: record.price_discovery_speed_days,
        lvi_change_pct: record.lvi_change_pct,
        velocity_trend: record.velocity_trend,
        active_listings: record.active_listings,
        active_investors: record.active_investors,
        sha256_hash: record.sha256_hash,
        computed_at: record.computed_at,
      },
      { onConflict: 'market,period,tenant_id' },
    )

  if (upsertErr) {
    log.error('[liquidityVelocityIndex] upsert error', new Error(upsertErr.message), { market, period: currentPeriod })
    throw new Error(`computeLVI: ${upsertErr.message}`)
  }

  log.info('[liquidityVelocityIndex] LVI computed', { market, period: currentPeriod, lvi_score: record.lvi_score, velocity_trend: velocityTrend })
  return record
}

// ─── publishLVIMatrix ─────────────────────────────────────────────────────────

/**
 * Computes and publishes LVI for all 7 markets.
 */
export async function publishLVIMatrix(
  tenantId: string,
): Promise<LiquidityVelocityRecord[]> {
  const results: LiquidityVelocityRecord[] = []

  for (const market of ALL_MARKETS) {
    try {
      const record = await computeLVI(market, tenantId)
      results.push(record)
    } catch (e) {
      log.warn('[liquidityVelocityIndex] market LVI failed', { market, error: String(e) })
    }
  }

  log.info('[liquidityVelocityIndex] matrix published', { tenantId, markets: results.length })
  return results
}

// ─── getLVIHistory ────────────────────────────────────────────────────────────

/**
 * Returns LVI history for a market, most recent first.
 * Default: last 12 periods.
 */
export async function getLVIHistory(
  market: string,
  tenantId: string,
  periods: number = 12,
): Promise<LiquidityVelocityRecord[]> {
  const { data, error } = await (supabaseAdmin as any)
    .from('liquidity_velocity_index')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('market', market)
    .order('period', { ascending: false })
    .limit(periods)

  if (error) {
    log.error('[liquidityVelocityIndex] history fetch error', new Error(error.message), { market })
    throw new Error(`getLVIHistory: ${error.message}`)
  }

  return (data ?? []) as LiquidityVelocityRecord[]
}
