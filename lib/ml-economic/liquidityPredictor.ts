// Agency Group — Liquidity Predictor
// lib/ml-economic/liquidityPredictor.ts
// Predicts future liquidity based on capital flow patterns and historical execution.
// "How long until this asset sells?" + "What price will it achieve?"

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { randomUUID } from 'crypto'
import type { LearnedPattern } from './executionLearner'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LiquidityPrediction {
  prediction_id: string
  tenant_id: string
  asset_id: string
  zone: string
  listed_price_eur_cents: number
  predicted_sale_probability_30d: number
  predicted_sale_probability_90d: number
  predicted_final_price_eur_cents: number
  predicted_days_to_close: number | null
  prediction_confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  key_factors: string[]
  generated_at: string
}

export interface ZoneLiquidityForecast {
  zone: string
  tenant_id: string
  generated_at: string
  active_assets: number
  avg_days_to_close: number
  capital_pressure_score: number
  predicted_transaction_volume_30d: number
  predicted_capital_deployment_eur_cents: number
  trend: 'ACCELERATING' | 'STABLE' | 'DECELERATING' | 'STAGNANT'
}

// ─── Internal row types ───────────────────────────────────────────────────────

interface OutcomeRow {
  days_to_close: number
  final_price_eur_cents: number
  commission_eur_cents: number
  recorded_at: string
}

interface LedgerEntryRow {
  amount_eur_cents: number
  created_at: string
}

interface BidRow {
  asset_id: string
  status: string
}

interface AssetRow {
  id: string
  price_eur_cents: number
  zone?: string
  zona?: string
}

// ─── predictAssetLiquidity ────────────────────────────────────────────────────

/**
 * Predicts sale probability at 30d / 90d, expected final price, and days-to-close
 * for a given asset. Reads active bids, zone execution history, capital velocity,
 * and learned patterns from Supabase.
 */
export async function predictAssetLiquidity(
  assetId: string,
  zone: string,
  listedPriceEurCents: number,
  tenantId: string,
): Promise<LiquidityPrediction> {
  const prediction_id = `lp_${randomUUID()}`
  const generated_at = new Date().toISOString()
  const key_factors: string[] = []

  // ── Active bids for asset ────────────────────────────────────────────────────
  const { data: bidsData } = await (supabaseAdmin as any)
    .from('bids')
    .select('asset_id, status')
    .eq('asset_id', assetId)
    .eq('status', 'active')

  const activeBids = ((bidsData ?? []) as BidRow[]).length
  key_factors.push(`${activeBids} active bid(s) on asset`)

  // ── Zone close rate over last 30d ────────────────────────────────────────────
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: zoneOutcomes30d } = await (supabaseAdmin as any)
    .from('execution_outcomes')
    .select('days_to_close, final_price_eur_cents, commission_eur_cents, recorded_at')
    .eq('tenant_id', tenantId)
    .eq('zone', zone)
    .gte('recorded_at', since30d)

  const zoneRows = (zoneOutcomes30d ?? []) as OutcomeRow[]

  // Total zone outcomes for confidence
  const { data: allZoneOutcomes } = await (supabaseAdmin as any)
    .from('execution_outcomes')
    .select('days_to_close, final_price_eur_cents, recorded_at')
    .eq('tenant_id', tenantId)
    .eq('zone', zone)

  const allZoneRows = (allZoneOutcomes ?? []) as OutcomeRow[]

  // ── Global avg close rate (all zones) ────────────────────────────────────────
  const { data: globalOutcomes30d } = await (supabaseAdmin as any)
    .from('execution_outcomes')
    .select('days_to_close')
    .eq('tenant_id', tenantId)
    .gte('recorded_at', since30d)

  const globalRows = (globalOutcomes30d ?? []) as OutcomeRow[]
  const globalCount30d = globalRows.length

  // ── Capital velocity: deposits last 30d ─────────────────────────────────────
  const { data: ledgerData } = await (supabaseAdmin as any)
    .from('investor_ledger_entries')
    .select('amount_eur_cents, created_at')
    .eq('tenant_id', tenantId)
    .eq('entry_type', 'deposit')
    .gte('created_at', since30d)

  const ledgerRows = (ledgerData ?? []) as LedgerEntryRow[]
  const capitalVelocity30d = ledgerRows.reduce((s, r) => s + r.amount_eur_cents, 0)
  if (capitalVelocity30d > 0) {
    key_factors.push(`€${Math.round(capitalVelocity30d / 100).toLocaleString()} capital deployed in last 30d`)
  }

  // ── Learned patterns for zone ─────────────────────────────────────────────
  const { data: patternData } = await (supabaseAdmin as any)
    .from('learned_patterns')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('pattern_type', 'HIGH_LIQUIDITY')

  const patterns = (patternData ?? []) as LearnedPattern[]
  const zonePatterns = patterns.filter(
    p => (p.conditions as Record<string, unknown>)['zone'] === zone,
  )
  if (zonePatterns.length > 0) {
    key_factors.push(`${zonePatterns.length} HIGH_LIQUIDITY pattern(s) active for zone`)
  }

  // ── Algorithm ────────────────────────────────────────────────────────────────

  // base close rate: zoneRows.length deals closed in 30d
  // normalised against global: if zone is above avg, good signal
  const zone_close_rate_30d = zoneRows.length
  const avg_close_rate = globalCount30d > 0 ? globalCount30d / 1 : 1 // both per 30d period

  // base_30d_probability = (activeBids / 3) × 0.4 + (zone_close_rate / avg_close_rate) × 0.6
  const bidFactor = Math.min(1.0, activeBids / 3) * 0.4
  const rateFactor = Math.min(1.0, zone_close_rate_30d / Math.max(1, avg_close_rate)) * 0.6
  const base_30d = Math.min(0.95, bidFactor + rateFactor)

  // 90d probability
  const prob_90d = Math.min(0.98, 1 - Math.pow(1 - base_30d, 3))

  // predicted final price = listed × (1 + avg premium from zone patterns)
  let avgPremiumPct = 0
  if (zonePatterns.length > 0) {
    const premiums = zonePatterns
      .map(p => (p.conditions as Record<string, unknown>)['avg_price_premium_pct'] as number | undefined)
      .filter((v): v is number => typeof v === 'number')
    if (premiums.length > 0) {
      avgPremiumPct = premiums.reduce((s, v) => s + v, 0) / premiums.length
    }
  }
  const predicted_final_price_eur_cents = Math.round(
    listedPriceEurCents * (1 + avgPremiumPct / 100),
  )

  // predicted_days_to_close from zone history (null if < 3 samples)
  let predicted_days_to_close: number | null = null
  if (allZoneRows.length >= 3) {
    predicted_days_to_close =
      Math.round(
        allZoneRows.reduce((s, r) => s + (r.days_to_close ?? 90), 0) / allZoneRows.length,
      )
    key_factors.push(`Avg close time in "${zone}": ${predicted_days_to_close} days`)
  } else {
    key_factors.push(`Insufficient zone history for close-time prediction (${allZoneRows.length} samples)`)
  }

  // confidence
  const prediction_confidence: 'HIGH' | 'MEDIUM' | 'LOW' =
    allZoneRows.length > 5 ? 'HIGH' : allZoneRows.length > 2 ? 'MEDIUM' : 'LOW'

  // ── Persist ──────────────────────────────────────────────────────────────────
  const row = {
    prediction_id,
    tenant_id: tenantId,
    asset_id: assetId,
    zone,
    listed_price_eur_cents: listedPriceEurCents,
    predicted_sale_probability_30d: Math.round(base_30d * 10000) / 10000,
    predicted_sale_probability_90d: Math.round(prob_90d * 10000) / 10000,
    predicted_final_price_eur_cents,
    predicted_days_to_close,
    prediction_confidence,
    key_factors,
    generated_at,
  }

  void (supabaseAdmin as any)
    .from('liquidity_predictions')
    .insert(row)
    .then(({ error }: { error: { message: string } | null }) => {
      if (error) log.info('[liquidityPredictor] persist error', { error: error.message, prediction_id })
    })
    .catch((e: unknown) => console.warn('[liquidityPredictor] persist catch', e))

  log.info('[liquidityPredictor] prediction generated', {
    prediction_id,
    asset_id: assetId,
    zone,
    confidence: prediction_confidence,
    prob_30d: row.predicted_sale_probability_30d,
  })

  return row
}

// ─── forecastZoneLiquidity ────────────────────────────────────────────────────

/**
 * Aggregates zone-level liquidity forecast: active assets, capital pressure,
 * transaction volume prediction, and trend direction.
 */
export async function forecastZoneLiquidity(
  zone: string,
  tenantId: string,
): Promise<ZoneLiquidityForecast> {
  const generated_at = new Date().toISOString()
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const since60d = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()

  // Active assets in zone
  const { data: assetsData } = await (supabaseAdmin as any)
    .from('imoveis')
    .select('id, price_eur_cents, zone, zona')
    .or(`zone.eq.${zone},zona.eq.${zone}`)

  const assets = (assetsData ?? []) as AssetRow[]
  const active_assets = assets.length

  // Active bids in zone (via assets)
  const assetIds = assets.map(a => a.id)
  let totalBids = 0
  if (assetIds.length > 0) {
    const { data: bidsData } = await (supabaseAdmin as any)
      .from('bids')
      .select('asset_id, status')
      .in('asset_id', assetIds)
      .eq('status', 'active')

    totalBids = ((bidsData ?? []) as BidRow[]).length
  }

  // Capital pressure = bids / max(assets, 1)
  const capital_pressure_score = active_assets > 0
    ? Math.round((totalBids / active_assets) * 100) / 100
    : 0

  // Last 30d zone outcomes
  const { data: outcomes30d } = await (supabaseAdmin as any)
    .from('execution_outcomes')
    .select('days_to_close, final_price_eur_cents, recorded_at')
    .eq('tenant_id', tenantId)
    .eq('zone', zone)
    .gte('recorded_at', since30d)

  const rows30d = (outcomes30d ?? []) as OutcomeRow[]

  // Prior 30d (days 30–60)
  const { data: outcomesPrior30d } = await (supabaseAdmin as any)
    .from('execution_outcomes')
    .select('days_to_close, final_price_eur_cents, recorded_at')
    .eq('tenant_id', tenantId)
    .eq('zone', zone)
    .gte('recorded_at', since60d)
    .lt('recorded_at', since30d)

  const rowsPrior30d = (outcomesPrior30d ?? []) as OutcomeRow[]

  const avg_days_to_close =
    rows30d.length > 0
      ? Math.round(rows30d.reduce((s, r) => s + (r.days_to_close ?? 90), 0) / rows30d.length)
      : 0

  const predicted_transaction_volume_30d = Math.round(
    (rows30d.length * 1.05) // project slight growth
  )

  const predicted_capital_deployment_eur_cents = assets
    .reduce((s, a) => s + (a.price_eur_cents ?? 0), 0)

  // Trend: compare current 30d volume vs prior 30d
  let trend: 'ACCELERATING' | 'STABLE' | 'DECELERATING' | 'STAGNANT'
  if (rows30d.length === 0 && rowsPrior30d.length === 0) {
    trend = 'STAGNANT'
  } else if (rowsPrior30d.length === 0) {
    trend = 'ACCELERATING'
  } else {
    const ratio = rows30d.length / rowsPrior30d.length
    if (ratio >= 1.2) trend = 'ACCELERATING'
    else if (ratio >= 0.8) trend = 'STABLE'
    else if (ratio > 0) trend = 'DECELERATING'
    else trend = 'STAGNANT'
  }

  log.info('[liquidityPredictor] zone forecast', {
    zone,
    tenantId,
    active_assets,
    capital_pressure_score,
    trend,
  })

  return {
    zone,
    tenant_id: tenantId,
    generated_at,
    active_assets,
    avg_days_to_close,
    capital_pressure_score,
    predicted_transaction_volume_30d,
    predicted_capital_deployment_eur_cents,
    trend,
  }
}
