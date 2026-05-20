// =============================================================================
// Agency Group — Market Liquidity Snapshot Engine
// lib/market/liquiditySnapshot.ts
//
// Computes and persists daily market-level liquidity metrics.
// Used by Control Tower, institutional API, and market intelligence dashboard.
// Provides the proprietary data moat: investor density × property flow = liquidity.
//
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LiquidityMetrics {
  snapshot_id: string
  tenant_id: string
  active_properties: number
  total_investors: number
  matches_pending: number
  deals_in_pipeline: number
  avg_match_score: number
  liquidity_ratio: number        // matches / active_properties
  top_zones: string[]
  avg_days_to_match: number | null
  avg_days_to_close: number | null
  country: string
  snapshot_date: string          // ISO date YYYY-MM-DD
  computed_at: string
}

// ─── Compute ──────────────────────────────────────────────────────────────────

export async function computeLiquiditySnapshot(
  tenantId: string,
  country = 'PT',
): Promise<LiquidityMetrics> {
  const db         = supabaseAdmin as any
  const snapshotId = crypto.randomUUID()
  const today      = new Date().toISOString().slice(0, 10)

  // 1. Active properties
  const { count: activeProps } = await db
    .from('properties')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('status', 'active')

  // 2. Total active investors
  const { count: totalInvestors } = await db
    .from('investors')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('status', 'active')

  // 3. Pending matches
  const { count: matchesPending } = await db
    .from('investor_matches')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('status', 'pending')

  // 4. Deals in pipeline (not terminal)
  const { count: dealsInPipeline } = await db
    .from('deals')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .not('fase', 'in', '("Escritura Concluída","fechado","post_sale","Perdido","Rejeitado","lost","rejected")')

  // 5. Average match score
  const { data: matchScoreData } = await db
    .from('investor_matches')
    .select('match_score')
    .eq('tenant_id', tenantId)
    .limit(500)

  const scores = (matchScoreData ?? []) as { match_score: number }[]
  const avgMatchScore = scores.length > 0
    ? Math.round((scores.reduce((s, r) => s + r.match_score, 0) / scores.length) * 100) / 100
    : 0

  // 6. Top zones (from properties)
  const { data: zoneData } = await db
    .from('properties')
    .select('zona')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .not('zona', 'is', null)
    .limit(1000)

  const zoneCounts: Record<string, number> = {}
  for (const row of ((zoneData ?? []) as { zona: string | null }[])) {
    if (row.zona) zoneCounts[row.zona] = (zoneCounts[row.zona] ?? 0) + 1
  }
  const topZones = Object.entries(zoneCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([zone]) => zone)

  const ap  = activeProps ?? 0
  const mp  = matchesPending ?? 0

  const metrics: LiquidityMetrics = {
    snapshot_id:        snapshotId,
    tenant_id:          tenantId,
    active_properties:  ap,
    total_investors:    totalInvestors ?? 0,
    matches_pending:    mp,
    deals_in_pipeline:  dealsInPipeline ?? 0,
    avg_match_score:    avgMatchScore,
    liquidity_ratio:    ap > 0 ? Math.round((mp / ap) * 1000) / 1000 : 0,
    top_zones:          topZones,
    avg_days_to_match:  null,
    avg_days_to_close:  null,
    country,
    snapshot_date:      today,
    computed_at:        new Date().toISOString(),
  }

  return metrics
}

// ─── Persist ──────────────────────────────────────────────────────────────────

export async function persistLiquiditySnapshot(
  metrics: LiquidityMetrics,
): Promise<void> {
  const db = supabaseAdmin as any

  const { error } = await db
    .from('market_liquidity_snapshot')
    .upsert({
      tenant_id:         metrics.tenant_id,
      active_properties: metrics.active_properties,
      total_investors:   metrics.total_investors,
      matches_pending:   metrics.matches_pending,
      deals_in_pipeline: metrics.deals_in_pipeline,
      avg_match_score:   metrics.avg_match_score,
      liquidity_ratio:   metrics.liquidity_ratio,
      top_zones:         metrics.top_zones,
      country:           metrics.country,
      snapshot_date:     metrics.snapshot_date,
      computed_at:       metrics.computed_at,
    }, {
      onConflict: 'tenant_id,country,snapshot_date',
    })

  if (error) {
    console.error('[LiquiditySnapshot] persist failed:', error.message)
  }
}

// ─── Convenience: compute + persist ──────────────────────────────────────────

export async function generateLiquiditySnapshot(
  tenantId: string,
  country = 'PT',
): Promise<LiquidityMetrics> {
  const metrics = await computeLiquiditySnapshot(tenantId, country)
  await persistLiquiditySnapshot(metrics)
  return metrics
}
