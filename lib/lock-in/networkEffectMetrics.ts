// Agency Group — Network Effect Metrics Engine
// lib/lock-in/networkEffectMetrics.ts
// TypeScript strict — 0 errors
//
// Measures real network effects: each new investor/listing makes the system
// more valuable for all participants.

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type NetworkStage =
  | 'SPARK'
  | 'IGNITION'
  | 'MOMENTUM'
  | 'FLYWHEEL'
  | 'COMPOUNDING'

export interface NetworkEffectSnapshot {
  snapshot_id: string
  tenant_id: string

  // Metcalfe-inspired metrics
  investor_count: number
  active_listing_count: number
  connection_density: number

  // Network value proxies
  value_score: number
  investor_count_score: number
  liquidity_depth_score: number
  match_quality_score: number
  geographic_spread_score: number

  // Stage
  network_stage: NetworkStage

  // Virtuous cycle detection
  cycle_velocity: number
  positive_cycle: boolean

  computed_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stageFromCount(count: number): NetworkStage {
  if (count < 10) return 'SPARK'
  if (count < 25) return 'IGNITION'
  if (count < 50) return 'MOMENTUM'
  if (count < 100) return 'FLYWHEEL'
  return 'COMPOUNDING'
}

// ─── computeNetworkEffectSnapshot ─────────────────────────────────────────────

/**
 * Computes a full network effect snapshot for a tenant and persists to
 * network_effect_snapshots_v2 (avoids collision with wave40 table).
 */
export async function computeNetworkEffectSnapshot(
  tenantId: string,
): Promise<NetworkEffectSnapshot> {
  // 1. Investor count
  const { count: investorCount } = await (supabaseAdmin as any)
    .from('investor_capital_profiles')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)

  const investors = investorCount ?? 0

  // 2. Active listing count from opportunity_investor_matches or canonical_assets
  const { count: listingCount } = await (supabaseAdmin as any)
    .from('opportunity_investor_matches')
    .select('opportunity_id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)

  const listings = listingCount ?? 0

  // 3. Connection density = matches made / (investors * listings)
  const { count: matchCount } = await (supabaseAdmin as any)
    .from('opportunity_investor_matches')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)

  const matches = matchCount ?? 0
  const connectionDensity =
    investors > 0 && listings > 0
      ? parseFloat((matches / (investors * listings)).toFixed(6))
      : 0

  // 4. Investor count score: log(investors) / log(100) * 100
  const investorCountScore =
    investors > 0
      ? parseFloat(Math.min(100, (Math.log(investors) / Math.log(100)) * 100).toFixed(2))
      : 0

  // 5. Liquidity depth: total available capital / €10M * 100
  const { data: capRows } = await (supabaseAdmin as any)
    .from('investor_capital_profiles')
    .select('available_capital_eur_cents')
    .eq('tenant_id', tenantId)

  const totalCapEurCents = ((capRows ?? []) as Array<{ available_capital_eur_cents: number }>)
    .reduce((sum, r) => sum + (r.available_capital_eur_cents ?? 0), 0)
  const TEN_MILLION_EUR_CENTS = 10_000_000 * 100
  const liquidityDepthScore = parseFloat(
    Math.min(100, (totalCapEurCents / TEN_MILLION_EUR_CENTS) * 100).toFixed(2),
  )

  // 6. Match quality score: avg match_score from opportunity_investor_matches
  const { data: matchScoreRows } = await (supabaseAdmin as any)
    .from('opportunity_investor_matches')
    .select('match_score')
    .eq('tenant_id', tenantId)
    .limit(500)

  const matchScores = ((matchScoreRows ?? []) as Array<{ match_score: number | null }>)
    .map((r) => r.match_score ?? 0)
  const matchQualityScore =
    matchScores.length > 0
      ? parseFloat(
          (matchScores.reduce((s, v) => s + v, 0) / matchScores.length).toFixed(2),
        )
      : 0

  // 7. Geographic spread: unique markets / 7 * 100
  const { data: marketRows } = await (supabaseAdmin as any)
    .from('investor_capital_profiles')
    .select('preferred_markets')
    .eq('tenant_id', tenantId)
    .limit(200)

  const uniqueMarkets = new Set<string>()
  for (const r of (marketRows ?? []) as Array<{ preferred_markets: string[] | null }>) {
    for (const m of r.preferred_markets ?? []) uniqueMarkets.add(m)
  }
  const geographicSpreadScore = parseFloat(
    Math.min(100, (uniqueMarkets.size / 7) * 100).toFixed(2),
  )

  // 8. Composite value score
  const valueScore = parseFloat(
    (
      investorCountScore * 0.25 +
      liquidityDepthScore * 0.30 +
      matchQualityScore * 0.25 +
      geographicSpreadScore * 0.20
    ).toFixed(2),
  )

  const networkStage = stageFromCount(investors)

  // 9. Cycle velocity: compare new investors in last 30d vs 60-30d ago
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000).toISOString()

  const { count: newInvestors30d } = await (supabaseAdmin as any)
    .from('investor_capital_profiles')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .gte('updated_at', thirtyDaysAgo)

  // Simple churn proxy from lock_in_scores
  const { count: churnedCount } = await (supabaseAdmin as any)
    .from('investor_lock_in_scores')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('lock_in_tier', 'CHURNING')

  const growthRate = investors > 0 ? (newInvestors30d ?? 0) / investors : 0
  const churnRate = investors > 0 ? (churnedCount ?? 0) / investors : 0
  const cycleVelocity = parseFloat((growthRate - churnRate).toFixed(4))

  const snapshot: NetworkEffectSnapshot = {
    snapshot_id: randomUUID(),
    tenant_id: tenantId,
    investor_count: investors,
    active_listing_count: listings,
    connection_density: connectionDensity,
    value_score: valueScore,
    investor_count_score: investorCountScore,
    liquidity_depth_score: liquidityDepthScore,
    match_quality_score: matchQualityScore,
    geographic_spread_score: geographicSpreadScore,
    network_stage: networkStage,
    cycle_velocity: cycleVelocity,
    positive_cycle: cycleVelocity > 0,
    computed_at: new Date().toISOString(),
  }

  void (supabaseAdmin as any)
    .from('network_effect_snapshots_v2')
    .insert(snapshot)
    .then(({ error }: { error: { message: string } | null }) => {
      if (error) log.warn('[networkEffectMetrics] insert error', { error: error.message })
    })

  log.info('[networkEffectMetrics] snapshot computed', {
    tenantId,
    investors,
    stage: networkStage,
    valueScore,
  })

  return snapshot
}

// ─── getNetworkStageHistory ───────────────────────────────────────────────────

/**
 * Returns the last N network effect snapshots for a tenant, newest first.
 */
export async function getNetworkStageHistory(
  tenantId: string,
  limit = 20,
): Promise<NetworkEffectSnapshot[]> {
  const { data: rows } = await (supabaseAdmin as any)
    .from('network_effect_snapshots_v2')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('computed_at', { ascending: false })
    .limit(limit)

  return (rows ?? []) as NetworkEffectSnapshot[]
}

// ─── detectNetworkAcceleration ────────────────────────────────────────────────

/**
 * Compares last 2 snapshots to detect acceleration or bottlenecks.
 * Bottleneck: if investors grow fast but listings don't = 'SUPPLY_BOTTLENECK'.
 *             if listings grow but capital doesn't = 'CAPITAL_BOTTLENECK'.
 */
export async function detectNetworkAcceleration(tenantId: string): Promise<{
  accelerating: boolean
  acceleration_rate: number
  bottleneck: string | null
}> {
  const snapshots = await getNetworkStageHistory(tenantId, 2)

  if (snapshots.length < 2) {
    return { accelerating: false, acceleration_rate: 0, bottleneck: null }
  }

  const [latest, previous] = snapshots

  const accelerationRate = parseFloat(
    (latest.value_score - previous.value_score).toFixed(4),
  )
  const accelerating = accelerationRate > 0

  // Bottleneck detection
  const investorGrowth = latest.investor_count - previous.investor_count
  const listingGrowth = latest.active_listing_count - previous.active_listing_count
  const capitalGrowth = latest.liquidity_depth_score - previous.liquidity_depth_score

  let bottleneck: string | null = null
  if (investorGrowth > 0 && listingGrowth <= 0) {
    bottleneck = 'SUPPLY_BOTTLENECK'
  } else if (listingGrowth > 0 && capitalGrowth <= 0) {
    bottleneck = 'CAPITAL_BOTTLENECK'
  }

  return {
    accelerating,
    acceleration_rate: accelerationRate,
    bottleneck,
  }
}
