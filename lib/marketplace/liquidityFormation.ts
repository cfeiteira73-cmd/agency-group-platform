// Agency Group — Liquidity Formation Engine
// lib/marketplace/liquidityFormation.ts
// Capital pressure → price movement → execution.
// Demand aggregation, liquidity score per asset, time-to-execution prediction.
// TypeScript strict — 0 errors

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LiquidityScore {
  asset_id:                      string
  tenant_id:                     string
  score:                         number
  tier:                          'ILLIQUID' | 'LOW_LIQUIDITY' | 'LIQUID' | 'HIGH_LIQUIDITY' | 'ULTRA_LIQUID'
  active_bids:                   number
  total_bid_capital_eur_cents:   number
  coverage_ratio:                number
  time_to_execution_days_p50:    number | null
  time_to_execution_days_p90:    number | null
  computed_at:                   string
}

export interface MarketLiquidityReport {
  tenant_id:                   string
  generated_at:                string
  assets_analyzed:             number
  liquid_assets:               number
  illiquid_assets:             number
  total_bid_capital_eur_cents: number
  avg_liquidity_score:         number
  hot_assets:                  string[]
  starved_assets:              string[]
}

// ─── Internal row shapes ──────────────────────────────────────────────────────

interface BidRow {
  asset_id:         string
  amount_eur_cents: number
}

interface SettlementRow {
  created_at:  string
  updated_at:  string
}

interface PropertyRow {
  id:    string
  preco: number | null
}

// ─── scoreTier ────────────────────────────────────────────────────────────────

function scoreTier(score: number): LiquidityScore['tier'] {
  if (score >= 80) return 'ULTRA_LIQUID'
  if (score >= 60) return 'HIGH_LIQUIDITY'
  if (score >= 40) return 'LIQUID'
  if (score >= 20) return 'LOW_LIQUIDITY'
  return 'ILLIQUID'
}

// ─── computeAssetLiquidity ────────────────────────────────────────────────────

export async function computeAssetLiquidity(
  assetId: string,
  tenantId: string,
  listedPriceEurCents: number,
): Promise<LiquidityScore> {
  const db  = supabaseAdmin as any
  const now = new Date().toISOString()

  // Fetch active bids for this asset
  const { data: bidRows, error: bidsErr } = await (db
    .from('asset_bids')
    .select('asset_id, amount_eur_cents')
    .eq('tenant_id', tenantId)
    .eq('asset_id', assetId)
    .in('bid_status', ['PENDING', 'ACTIVE']) as Promise<{
      data: BidRow[] | null
      error: { message: string } | null
    }>)

  if (bidsErr) {
    log.warn('[liquidityFormation] computeAssetLiquidity bids query failed', {
      asset_id: assetId,
      error:    bidsErr.message,
    })
  }

  const bids = bidRows ?? []
  const activeBids = bids.length

  // Integer arithmetic only — no floating point on money
  const totalBidCapital = bids.reduce((sum, b) => sum + b.amount_eur_cents, 0)

  // coverage_ratio = total_bid_capital / listedPrice (scaled ×10000 for precision, stored as decimal)
  const coverageRatio = listedPriceEurCents > 0
    ? Math.round((totalBidCapital * 10000) / listedPriceEurCents) / 10000
    : 0

  // score = min(100, active_bids × 15 + (coverage_ratio - 1) × 20)
  // coverage excess: (coverageRatio - 1) could be negative → floor at 0 for negative coverage
  const coverageExcess = coverageRatio - 1
  const rawScore = activeBids * 15 + coverageExcess * 20
  const score = Math.min(100, Math.max(0, Math.round(rawScore * 100) / 100))

  const tier = scoreTier(score)

  // P50 / P90 from settlements historical data
  let p50: number | null = null
  let p90: number | null = null

  const { data: settlementRows } = await (db
    .from('settlements')
    .select('created_at, updated_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(50) as Promise<{
      data: SettlementRow[] | null
      error: unknown
    }>)

  if (settlementRows && settlementRows.length >= 3) {
    const durationsDays = settlementRows
      .map(s => {
        const start = new Date(s.created_at).getTime()
        const end   = new Date(s.updated_at).getTime()
        return (end - start) / 86400000 // days
      })
      .filter(d => d > 0)
      .sort((a, b) => a - b)

    if (durationsDays.length >= 3) {
      const p50Idx = Math.floor(durationsDays.length * 0.5)
      const p90Idx = Math.floor(durationsDays.length * 0.9)
      p50 = Math.round((durationsDays[p50Idx] ?? 0) * 100) / 100
      p90 = Math.round((durationsDays[p90Idx] ?? 0) * 100) / 100
    }
  }

  const liquidityScore: LiquidityScore = {
    asset_id:                    assetId,
    tenant_id:                   tenantId,
    score,
    tier,
    active_bids:                 activeBids,
    total_bid_capital_eur_cents: totalBidCapital,
    coverage_ratio:              coverageRatio,
    time_to_execution_days_p50:  p50,
    time_to_execution_days_p90:  p90,
    computed_at:                 now,
  }

  // Persist to asset_liquidity_scores (fire-and-forget)
  void (db
    .from('asset_liquidity_scores')
    .insert({
      tenant_id:                   tenantId,
      asset_id:                    assetId,
      score,
      tier,
      active_bids:                 activeBids,
      total_bid_capital_eur_cents: totalBidCapital,
      coverage_ratio:              coverageRatio,
      time_to_execution_days_p50:  p50,
      time_to_execution_days_p90:  p90,
      computed_at:                 now,
    }) as Promise<{ error: { message: string } | null }>)
    .then(({ error }: { error: { message: string } | null }) => {
      if (error) {
        log.warn('[liquidityFormation] persist asset_liquidity_scores failed', {
          asset_id: assetId,
          error:    error.message,
        })
      }
    })
    .catch((e: unknown) => console.warn('[liquidityFormation]', e))

  log.info('[liquidityFormation] computeAssetLiquidity', {
    asset_id: assetId,
    score,
    tier,
  })

  return liquidityScore
}

// ─── generateMarketLiquidityReport ───────────────────────────────────────────

export async function generateMarketLiquidityReport(
  tenantId: string,
): Promise<MarketLiquidityReport> {
  const db          = supabaseAdmin as any
  const generatedAt = new Date().toISOString()

  // Fetch all active properties
  const { data: propRows, error: propErr } = await (db
    .from('properties')
    .select('id, preco')
    .eq('tenant_id', tenantId) as Promise<{
      data: PropertyRow[] | null
      error: { message: string } | null
    }>)

  if (propErr) {
    log.warn('[liquidityFormation] generateMarketLiquidityReport: properties query failed', {
      error: propErr.message,
    })
  }

  const properties = propRows ?? []
  const assetsAnalyzed = properties.length

  if (assetsAnalyzed === 0) {
    const emptyReport: MarketLiquidityReport = {
      tenant_id:                   tenantId,
      generated_at:                generatedAt,
      assets_analyzed:             0,
      liquid_assets:               0,
      illiquid_assets:             0,
      total_bid_capital_eur_cents: 0,
      avg_liquidity_score:         0,
      hot_assets:                  [],
      starved_assets:              [],
    }
    return emptyReport
  }

  // Compute liquidity for each property in parallel
  const results = await Promise.allSettled(
    properties.map(p =>
      computeAssetLiquidity(p.id, tenantId, p.preco ?? 0),
    ),
  )

  const scores: LiquidityScore[] = results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value
    log.warn('[liquidityFormation] generateMarketLiquidityReport: one asset failed', {
      asset_id: properties[i]?.id,
      error:    r.reason instanceof Error ? r.reason.message : String(r.reason),
    })
    return {
      asset_id:                    properties[i]?.id ?? '',
      tenant_id:                   tenantId,
      score:                       0,
      tier:                        'ILLIQUID' as const,
      active_bids:                 0,
      total_bid_capital_eur_cents: 0,
      coverage_ratio:              0,
      time_to_execution_days_p50:  null,
      time_to_execution_days_p90:  null,
      computed_at:                 generatedAt,
    }
  })

  const liquidAssets   = scores.filter(s => s.score >= 40).length
  const illiquidAssets = scores.filter(s => s.score < 20).length

  const totalBidCapital = scores.reduce((sum, s) => sum + s.total_bid_capital_eur_cents, 0)
  const avgScore = assetsAnalyzed > 0
    ? Math.round((scores.reduce((sum, s) => sum + s.score, 0) / assetsAnalyzed) * 100) / 100
    : 0

  // hot_assets: top 5 by score
  const sortedDesc = [...scores].sort((a, b) => b.score - a.score)
  const hotAssets     = sortedDesc.slice(0, 5).map(s => s.asset_id)

  // starved_assets: bottom 5 with score < 20
  const sortedAsc    = [...scores].sort((a, b) => a.score - b.score)
  const starvedAssets = sortedAsc.filter(s => s.score < 20).slice(0, 5).map(s => s.asset_id)

  const report: MarketLiquidityReport = {
    tenant_id:                   tenantId,
    generated_at:                generatedAt,
    assets_analyzed:             assetsAnalyzed,
    liquid_assets:               liquidAssets,
    illiquid_assets:             illiquidAssets,
    total_bid_capital_eur_cents: totalBidCapital,
    avg_liquidity_score:         avgScore,
    hot_assets:                  hotAssets,
    starved_assets:              starvedAssets,
  }

  // Persist to liquidity_reports (fire-and-forget)
  void (db
    .from('liquidity_reports')
    .insert({
      tenant_id:                   tenantId,
      generated_at:                generatedAt,
      assets_analyzed:             assetsAnalyzed,
      liquid_assets:               liquidAssets,
      illiquid_assets:             illiquidAssets,
      total_bid_capital_eur_cents: totalBidCapital,
      avg_liquidity_score:         avgScore,
      hot_assets:                  hotAssets,
      starved_assets:              starvedAssets,
    }) as Promise<{ error: { message: string } | null }>)
    .then(({ error }: { error: { message: string } | null }) => {
      if (error) {
        log.warn('[liquidityFormation] persist liquidity_reports failed', { error: error.message })
      }
    })
    .catch((e: unknown) => console.warn('[liquidityFormation]', e))

  log.info('[liquidityFormation] generateMarketLiquidityReport', {
    assets_analyzed: assetsAnalyzed,
    avg_score:       avgScore,
  })

  return report
}

// ─── recalculateLiquidityAfterExecution ──────────────────────────────────────

export async function recalculateLiquidityAfterExecution(
  assetId: string,
  tenantId: string,
): Promise<void> {
  const db = supabaseAdmin as any

  // Mark all asset bids as EXPIRED after settlement is ACCEPTED
  void (db
    .from('asset_bids')
    .update({ bid_status: 'EXPIRED' })
    .eq('tenant_id', tenantId)
    .eq('asset_id', assetId)
    .in('bid_status', ['PENDING', 'ACTIVE']) as Promise<{ error: { message: string } | null }>)
    .then(({ error }: { error: { message: string } | null }) => {
      if (error) {
        log.warn('[liquidityFormation] recalculateLiquidityAfterExecution bids expiry failed', {
          asset_id: assetId,
          error:    error.message,
        })
      }
    })
    .catch((e: unknown) => console.warn('[liquidityFormation]', e))

  // Persist zero-score liquidity snapshot
  void (db
    .from('asset_liquidity_scores')
    .insert({
      tenant_id:                   tenantId,
      asset_id:                    assetId,
      score:                       0,
      tier:                        'ILLIQUID',
      active_bids:                 0,
      total_bid_capital_eur_cents: 0,
      coverage_ratio:              0,
      time_to_execution_days_p50:  null,
      time_to_execution_days_p90:  null,
      computed_at:                 new Date().toISOString(),
    }) as Promise<{ error: { message: string } | null }>)
    .then(({ error }: { error: { message: string } | null }) => {
      if (error) {
        log.warn('[liquidityFormation] recalculateLiquidityAfterExecution persist failed', {
          asset_id: assetId,
          error:    error.message,
        })
      }
    })
    .catch((e: unknown) => console.warn('[liquidityFormation]', e))

  log.info('[liquidityFormation] recalculateLiquidityAfterExecution', { asset_id: assetId })
}
