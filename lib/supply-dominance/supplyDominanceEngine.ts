// Agency Group — Supply Dominance Engine
// lib/supply-dominance/supplyDominanceEngine.ts
//
// Tracks and grows the system's supply dominance — the percentage of total
// market supply flowing through the system.
//
// TypeScript strict — 0 errors

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type DominanceLevel =
  | 'DOMINANT'
  | 'MAJOR_PLAYER'
  | 'SIGNIFICANT'
  | 'EMERGING'
  | 'MARGINAL'

export interface SupplyDominanceSnapshot {
  snapshot_id: string
  tenant_id: string
  market: string
  period: string // 'YYYY-MM'

  // Coverage metrics
  system_listing_count: number
  estimated_total_market_listings: number
  market_coverage_pct: number

  // Source dominance
  sources_active: number
  exclusive_listings_count: number
  first_point_listing_count: number

  // Broker dependency
  dependent_brokers: number
  broker_repeat_rate: number

  dominance_level: DominanceLevel
  dominance_score: number // 0–100

  computed_at: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_MARKETS = ['PT', 'ES', 'FR', 'IT', 'DE', 'UK', 'CH']

function getPeriod(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function toDominanceLevel(coveragePct: number): DominanceLevel {
  if (coveragePct > 30) return 'DOMINANT'
  if (coveragePct > 15) return 'MAJOR_PLAYER'
  if (coveragePct > 8)  return 'SIGNIFICANT'
  if (coveragePct > 3)  return 'EMERGING'
  return 'MARGINAL'
}

// ─── computeSupplyDominance ───────────────────────────────────────────────────

export async function computeSupplyDominance(
  market: string,
  tenantId: string,
): Promise<SupplyDominanceSnapshot> {
  const period = getPeriod()
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  // 1. System listing count for this market this month
  const { count: systemListingCount } = await (supabaseAdmin as any)
    .from('raw_opportunity_stream')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('market', market)
    .gte('ingested_at', startOfMonth.toISOString())

  const systemCount = systemListingCount ?? 0

  // 2. Estimated total market listings from external benchmarks
  //    Proxy: transaction_volume * 12 ≈ active listing stock
  const { data: benchmarkRows } = await (supabaseAdmin as any)
    .from('external_price_benchmarks')
    .select('transaction_volume')
    .eq('tenant_id', tenantId)
    .eq('country', market)
    .order('fetched_at', { ascending: false })
    .limit(5)

  const rows = (benchmarkRows ?? []) as Array<{ transaction_volume: number }>
  const avgVolume =
    rows.length > 0
      ? rows.reduce((s: number, r: { transaction_volume: number }) => s + (r.transaction_volume ?? 0), 0) / rows.length
      : 0
  const estimatedTotal = Math.max(systemCount, Math.round(avgVolume * 12))

  const marketCoveragePct =
    estimatedTotal > 0 ? (systemCount / estimatedTotal) * 100 : 0

  // 3. Sources active (distinct source values)
  const { data: sourceRows } = await (supabaseAdmin as any)
    .from('raw_opportunity_stream')
    .select('source')
    .eq('tenant_id', tenantId)
    .eq('market', market)
    .gte('ingested_at', thirtyDaysAgo.toISOString())

  const sourcesSet = new Set<string>(
    ((sourceRows ?? []) as Array<{ source: string }>).map((r) => r.source),
  )
  const sourcesActive = sourcesSet.size

  // 4. Exclusive listings (BROKER_CRM + is_exclusive)
  const { count: exclusiveCount } = await (supabaseAdmin as any)
    .from('raw_opportunity_stream')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('market', market)
    .eq('source', 'BROKER_CRM')
    .eq('is_exclusive', true)
    .gte('ingested_at', startOfMonth.toISOString())

  const exclusiveListings = exclusiveCount ?? 0

  // 5. First-point listings (days_on_market < 3 at ingestion)
  const { count: firstPointCount } = await (supabaseAdmin as any)
    .from('raw_opportunity_stream')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('market', market)
    .lt('days_on_market', 3)
    .gte('ingested_at', startOfMonth.toISOString())

  const firstPointListings = firstPointCount ?? 0

  // 6. Broker dependency
  const { data: brokerRows } = await (supabaseAdmin as any)
    .from('raw_opportunity_stream')
    .select('broker_id')
    .eq('tenant_id', tenantId)
    .eq('market', market)
    .eq('source', 'BROKER_CRM')
    .gte('ingested_at', thirtyDaysAgo.toISOString())
    .not('broker_id', 'is', null)

  const brokerCounts: Record<string, number> = {}
  for (const row of ((brokerRows ?? []) as Array<{ broker_id: string | null }>)) {
    if (!row.broker_id) continue
    brokerCounts[row.broker_id] = (brokerCounts[row.broker_id] ?? 0) + 1
  }
  const dependentBrokers = Object.values(brokerCounts).filter((c) => c > 3).length

  // 7. Broker repeat rate (brokers with submissions in 2+ consecutive months)
  //    Approximation: brokers who appeared in both last 30d and 30–60d windows
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
  const { data: prevBrokerRows } = await (supabaseAdmin as any)
    .from('raw_opportunity_stream')
    .select('broker_id')
    .eq('tenant_id', tenantId)
    .eq('market', market)
    .eq('source', 'BROKER_CRM')
    .gte('ingested_at', sixtyDaysAgo.toISOString())
    .lt('ingested_at', thirtyDaysAgo.toISOString())
    .not('broker_id', 'is', null)

  const prevBrokerSet = new Set<string>(
    ((prevBrokerRows ?? []) as Array<{ broker_id: string | null }>)
      .map((r) => r.broker_id)
      .filter((id): id is string => id !== null),
  )
  const currentBrokerSet = new Set<string>(Object.keys(brokerCounts))
  const repeatBrokers = [...currentBrokerSet].filter((id) => prevBrokerSet.has(id)).length
  const brokerRepeatRate =
    currentBrokerSet.size > 0 ? repeatBrokers / currentBrokerSet.size : 0

  // 8. Dominance score
  const exclusivePct = systemCount > 0 ? (exclusiveListings / systemCount) * 100 : 0
  const firstMoverPct = systemCount > 0 ? (firstPointListings / systemCount) * 100 : 0
  const dominanceScore =
    Math.min(100, marketCoveragePct) * 0.4 +
    Math.min(100, exclusivePct) * 0.3 +
    Math.min(100, firstMoverPct) * 0.3

  const dominanceLevel = toDominanceLevel(marketCoveragePct)

  const snapshot: SupplyDominanceSnapshot = {
    snapshot_id: randomUUID(),
    tenant_id: tenantId,
    market,
    period,
    system_listing_count: systemCount,
    estimated_total_market_listings: estimatedTotal,
    market_coverage_pct: Math.round(marketCoveragePct * 1000) / 1000,
    sources_active: sourcesActive,
    exclusive_listings_count: exclusiveListings,
    first_point_listing_count: firstPointListings,
    dependent_brokers: dependentBrokers,
    broker_repeat_rate: Math.round(brokerRepeatRate * 1000) / 1000,
    dominance_level: dominanceLevel,
    dominance_score: Math.round(dominanceScore * 100) / 100,
    computed_at: new Date().toISOString(),
  }

  // Persist
  void (supabaseAdmin as any)
    .from('supply_dominance_snapshots')
    .upsert(
      {
        snapshot_id: snapshot.snapshot_id,
        tenant_id: snapshot.tenant_id,
        market: snapshot.market,
        period: snapshot.period,
        system_listing_count: snapshot.system_listing_count,
        estimated_total_market_listings: snapshot.estimated_total_market_listings,
        market_coverage_pct: snapshot.market_coverage_pct,
        sources_active: snapshot.sources_active,
        exclusive_listings_count: snapshot.exclusive_listings_count,
        first_point_listing_count: snapshot.first_point_listing_count,
        dependent_brokers: snapshot.dependent_brokers,
        broker_repeat_rate: snapshot.broker_repeat_rate,
        dominance_level: snapshot.dominance_level,
        dominance_score: snapshot.dominance_score,
        computed_at: snapshot.computed_at,
      },
      { onConflict: 'market,period,tenant_id' },
    )
    .catch((e: unknown) => log.warn('[supplyDominanceEngine] persist error', { e }))

  log.info('[supplyDominanceEngine] computed', {
    market,
    tenantId,
    dominance_score: snapshot.dominance_score,
    dominance_level: snapshot.dominance_level,
  })

  return snapshot
}

// ─── runDominanceSweep ────────────────────────────────────────────────────────

export async function runDominanceSweep(
  tenantId: string,
): Promise<SupplyDominanceSnapshot[]> {
  const results: SupplyDominanceSnapshot[] = []
  for (const market of ALL_MARKETS) {
    try {
      const snap = await computeSupplyDominance(market, tenantId)
      results.push(snap)
    } catch (err) {
      log.warn('[supplyDominanceEngine] sweep error', { market, err })
    }
  }
  return results
}

// ─── getDominanceHistory ──────────────────────────────────────────────────────

export async function getDominanceHistory(
  market: string,
  tenantId: string,
  periods = 12,
): Promise<SupplyDominanceSnapshot[]> {
  const { data, error } = await (supabaseAdmin as any)
    .from('supply_dominance_snapshots')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('market', market)
    .order('period', { ascending: false })
    .limit(periods)

  if (error) {
    log.warn('[supplyDominanceEngine] getDominanceHistory error', { error })
    return []
  }

  return (data ?? []) as SupplyDominanceSnapshot[]
}

// ─── trackBrokerDependency ────────────────────────────────────────────────────

export async function trackBrokerDependency(tenantId: string): Promise<{
  dependent_brokers: number
  at_risk_brokers: number
  new_brokers_30d: number
}> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)

  // All BROKER_CRM submissions in last 30d
  const { data: recent } = await (supabaseAdmin as any)
    .from('raw_opportunity_stream')
    .select('broker_id')
    .eq('tenant_id', tenantId)
    .eq('source', 'BROKER_CRM')
    .gte('ingested_at', thirtyDaysAgo.toISOString())
    .not('broker_id', 'is', null)

  const recentCounts: Record<string, number> = {}
  for (const row of ((recent ?? []) as Array<{ broker_id: string | null }>)) {
    if (!row.broker_id) continue
    recentCounts[row.broker_id] = (recentCounts[row.broker_id] ?? 0) + 1
  }

  const dependentBrokers = Object.values(recentCounts).filter((c) => c > 3).length

  // At-risk: brokers with >10 listings (high dependency, single-point-of-failure)
  const atRiskBrokers = Object.values(recentCounts).filter((c) => c > 10).length

  // Previous 30d window for "new broker" detection
  const { data: prev } = await (supabaseAdmin as any)
    .from('raw_opportunity_stream')
    .select('broker_id')
    .eq('tenant_id', tenantId)
    .eq('source', 'BROKER_CRM')
    .gte('ingested_at', sixtyDaysAgo.toISOString())
    .lt('ingested_at', thirtyDaysAgo.toISOString())
    .not('broker_id', 'is', null)

  const prevBrokerSet = new Set<string>(
    ((prev ?? []) as Array<{ broker_id: string | null }>)
      .map((r) => r.broker_id)
      .filter((id): id is string => id !== null),
  )

  const newBrokers30d = Object.keys(recentCounts).filter(
    (id) => !prevBrokerSet.has(id),
  ).length

  return {
    dependent_brokers: dependentBrokers,
    at_risk_brokers: atRiskBrokers,
    new_brokers_30d: newBrokers30d,
  }
}
