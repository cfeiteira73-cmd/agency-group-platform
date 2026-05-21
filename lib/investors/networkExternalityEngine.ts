// =============================================================================
// Agency Group — Network Externality Engine
// lib/investors/networkExternalityEngine.ts
//
// Computes network externality metrics for investors.
// Investors who generate liquidity (close deals, refer others, introduce
// co-investors) are promoted to anchor/amplifier tiers and their zones
// receive elevated routing priority.
//
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NetworkExternalityMetrics {
  investor_id:    string
  tenant_id:      string

  // Direct contribution
  deals_closed_90d:           number
  referrals_generated:        number
  co_investor_introductions:  number

  // Network multiplier
  network_multiplier: number   // 1.0 baseline, > 1.0 positive externality

  // Zone contribution
  high_activity_zones: string[]

  // Liquidity generation
  liquidity_contribution_score: number   // 0–100

  // Promotion tier
  externality_tier: 'anchor' | 'amplifier' | 'standard' | 'dormant'

  computed_at: string
}

export interface NetworkExternalityResult {
  metrics:                   NetworkExternalityMetrics[]
  promoted:                  number
  demoted:                   number
  total_network_effect_score: number
}

// ─── Internal DB row shapes ────────────────────────────────────────────────────

interface EngagementRow {
  investor_id:  string
  event_type:   string
  occurred_at:  string
  metadata:     Record<string, unknown> | null
}

interface PropertyZoneRow {
  id:   string
  zona: string | null
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function resolveTier(
  dealsClosedIn90d: number,
  referrals:        number,
  lastActivityDaysAgo: number,
): NetworkExternalityMetrics['externality_tier'] {
  if (lastActivityDaysAgo > 90) return 'dormant'
  if (dealsClosedIn90d >= 3 || referrals >= 2) return 'anchor'
  if (dealsClosedIn90d >= 1 || referrals >= 1) return 'amplifier'
  return 'standard'
}

function multiplierForTier(tier: NetworkExternalityMetrics['externality_tier']): number {
  switch (tier) {
    case 'anchor':    return 1.5
    case 'amplifier': return 1.2
    case 'standard':  return 1.0
    case 'dormant':   return 0.7
  }
}

// ─── computeNetworkExternalities ─────────────────────────────────────────────

/**
 * Compute network externality metrics for all active investors in a tenant.
 * Persists results to network_externality_metrics table.
 */
export async function computeNetworkExternalities(tenantId: string): Promise<NetworkExternalityResult> {
  const db       = supabaseAdmin as any
  const since90d = new Date(Date.now() - 90 * 86_400_000).toISOString()

  const empty: NetworkExternalityResult = {
    metrics:                    [],
    promoted:                   0,
    demoted:                    0,
    total_network_effect_score: 0,
  }

  try {
    // ── 1. Load active investors ──────────────────────────────────────────────
    const { data: invRaw, error: invErr } = await db
      .from('investors')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')

    if (invErr) {
      log.error('[NetworkExternalityEngine] failed to load investors', undefined, { error: invErr.message })
      return empty
    }

    const investorIds = ((invRaw ?? []) as { id: string }[]).map(r => r.id)
    if (investorIds.length === 0) return empty

    // ── 2. Load engagement events (90 days) ───────────────────────────────────
    const { data: engRaw, error: engErr } = await db
      .from('investor_engagement_events')
      .select('investor_id, event_type, occurred_at, metadata')
      .eq('tenant_id', tenantId)
      .in('investor_id', investorIds)
      .gte('occurred_at', since90d)
      .order('occurred_at', { ascending: false })

    if (engErr) {
      log.error('[NetworkExternalityEngine] failed to load events', undefined, { error: engErr.message })
    }

    const engRows = (engRaw ?? []) as EngagementRow[]

    // ── 3. Load closed deals (property_id for zone extraction) ────────────────
    const closedRows = engRows.filter(r => r.event_type === 'deal_closed')

    const closedPropertyIds = [
      ...new Set(
        closedRows
          .map(r => r.metadata?.property_id as string | undefined)
          .filter((id): id is string => !!id),
      ),
    ]

    // Load zones for closed deal properties
    const zoneMap = new Map<string, string>()
    if (closedPropertyIds.length > 0) {
      const { data: zoneRaw } = await db
        .from('properties')
        .select('id, zona')
        .in('id', closedPropertyIds)
        .eq('tenant_id', tenantId)

      for (const row of (zoneRaw ?? []) as PropertyZoneRow[]) {
        if (row.zona) zoneMap.set(row.id, row.zona)
      }
    }

    // ── 4. Load existing metrics to detect promotions/demotions ──────────────
    const { data: existingRaw } = await db
      .from('network_externality_metrics')
      .select('investor_id, externality_tier')
      .eq('tenant_id', tenantId)
      .in('investor_id', investorIds)

    const existingTierMap = new Map<string, string>(
      ((existingRaw ?? []) as { investor_id: string; externality_tier: string }[])
        .map(r => [r.investor_id, r.externality_tier]),
    )

    // ── 5. Group events by investor ───────────────────────────────────────────
    const byInvestor = new Map<string, EngagementRow[]>()
    for (const row of engRows) {
      const list = byInvestor.get(row.investor_id) ?? []
      list.push(row)
      byInvestor.set(row.investor_id, list)
    }

    // ── 6. Compute metrics per investor ───────────────────────────────────────
    const BATCH = 20
    const allMetrics: NetworkExternalityMetrics[] = []
    let promoted = 0
    let demoted  = 0

    const TIER_RANK: Record<string, number> = {
      dormant: 0, standard: 1, amplifier: 2, anchor: 3,
    }

    for (const investorId of investorIds) {
      const events = byInvestor.get(investorId) ?? []

      const deals_closed_90d = events.filter(e => e.event_type === 'deal_closed').length

      // Referrals: events tagged with referral in metadata
      const referrals_generated = events.filter(
        e => e.event_type === 'match_viewed' && (e.metadata?.is_referral === true),
      ).length

      // Co-investor introductions: events tagged with co_investor in metadata
      const co_investor_introductions = events.filter(
        e => e.metadata?.co_investor_intro === true,
      ).length

      // Last activity date (days ago)
      const lastEventAt = events.length > 0
        ? new Date(events[0].occurred_at)
        : null
      const lastActivityDaysAgo = lastEventAt
        ? Math.floor((Date.now() - lastEventAt.getTime()) / 86_400_000)
        : 999

      const tier             = resolveTier(deals_closed_90d, referrals_generated, lastActivityDaysAgo)
      const network_multiplier = multiplierForTier(tier)

      // High activity zones: zones of this investor's closed deals
      const closedByInvestor = closedRows
        .filter(r => r.investor_id === investorId)
        .map(r => r.metadata?.property_id as string | undefined)
        .filter((id): id is string => !!id)

      const highActivityZones = [
        ...new Set(
          closedByInvestor
            .map(pid => zoneMap.get(pid))
            .filter((z): z is string => !!z),
        ),
      ]

      // Liquidity contribution score
      const liquidity_contribution_score = Math.min(
        100,
        Math.round(
          deals_closed_90d          * 25 +
          referrals_generated        * 15 +
          co_investor_introductions  * 10,
        ),
      )

      const metrics: NetworkExternalityMetrics = {
        investor_id:                  investorId,
        tenant_id:                    tenantId,
        deals_closed_90d,
        referrals_generated,
        co_investor_introductions,
        network_multiplier,
        high_activity_zones:          highActivityZones,
        liquidity_contribution_score,
        externality_tier:             tier,
        computed_at:                  new Date().toISOString(),
      }

      allMetrics.push(metrics)

      // Detect promotions / demotions
      const prevTier = existingTierMap.get(investorId)
      if (prevTier && prevTier !== tier) {
        const prevRank = TIER_RANK[prevTier] ?? 1
        const newRank  = TIER_RANK[tier]    ?? 1
        if (newRank > prevRank) promoted++
        else                    demoted++
      }
    }

    // ── 7. Persist in batches ──────────────────────────────────────────────────
    for (let i = 0; i < allMetrics.length; i += BATCH) {
      const batch = allMetrics.slice(i, i + BATCH)

      const rows = batch.map(m => ({
        tenant_id:                    m.tenant_id,
        investor_id:                  m.investor_id,
        metrics:                      {
          deals_closed_90d:           m.deals_closed_90d,
          referrals_generated:        m.referrals_generated,
          co_investor_introductions:  m.co_investor_introductions,
          high_activity_zones:        m.high_activity_zones,
          liquidity_contribution_score: m.liquidity_contribution_score,
        },
        externality_tier:             m.externality_tier,
        network_multiplier:           m.network_multiplier,
        liquidity_contribution_score: m.liquidity_contribution_score,
        computed_at:                  m.computed_at,
      }))

      const { error: upsertErr } = await db
        .from('network_externality_metrics')
        .upsert(rows, { onConflict: 'tenant_id,investor_id' })

      if (upsertErr) {
        log.error('[NetworkExternalityEngine] upsert failed', undefined, { error: upsertErr.message })
      }
    }

    // ── 8. Total network effect score ─────────────────────────────────────────
    const multiplierSum = allMetrics.reduce((s, m) => s + m.network_multiplier, 0)
    const total_network_effect_score = allMetrics.length > 0
      ? Math.round((multiplierSum / allMetrics.length) * 100) / 100
      : 0

    return { metrics: allMetrics, promoted, demoted, total_network_effect_score }
  } catch (err) {
    log.error(
      '[NetworkExternalityEngine] computeNetworkExternalities exception',
      err instanceof Error ? err : undefined,
      { error: err instanceof Error ? err.message : String(err) },
    )
    return empty
  }
}

// ─── getHighLiquidityZones ────────────────────────────────────────────────────

/**
 * Return zones with anchor investor presence, sorted by liquidity score DESC.
 */
export async function getHighLiquidityZones(tenantId: string): Promise<Array<{
  zone:                  string
  liquidity_score:       number
  anchor_investors:      number
  rotation_speed_days:   number
}>> {
  const db = supabaseAdmin as any

  try {
    // ── 1. Load anchor/amplifier investors and their active zones ─────────────
    const { data: anchorRaw, error: anchorErr } = await db
      .from('network_externality_metrics')
      .select('investor_id, externality_tier, metrics')
      .eq('tenant_id', tenantId)
      .in('externality_tier', ['anchor', 'amplifier'])

    if (anchorErr) {
      log.error('[NetworkExternalityEngine] getHighLiquidityZones load error', undefined, { error: anchorErr.message })
      return []
    }

    const anchorRows = (anchorRaw ?? []) as {
      investor_id:      string
      externality_tier: string
      metrics:          { high_activity_zones?: string[] } | null
    }[]

    // Aggregate zone data
    const zoneAnchorCount  = new Map<string, number>()

    for (const row of anchorRows) {
      const zones = row.metrics?.high_activity_zones ?? []
      for (const zone of zones) {
        if (row.externality_tier === 'anchor') {
          zoneAnchorCount.set(zone, (zoneAnchorCount.get(zone) ?? 0) + 1)
        }
      }
    }

    // ── 2. Load heatmap for liquidity scores and rotation speed ───────────────
    const { data: heatRaw } = await db
      .from('liquidity_heatmap')
      .select('zone, heat_index, demand_score')
      .eq('tenant_id', tenantId)
      .order('snapshot_date', { ascending: false })
      .limit(200)

    // Latest snapshot per zone
    const heatByZone = new Map<string, { heat_index: number }>()
    for (const row of (heatRaw ?? []) as { zone: string; heat_index: number }[]) {
      if (!heatByZone.has(row.zone)) {
        heatByZone.set(row.zone, { heat_index: row.heat_index ?? 50 })
      }
    }

    // ── 3. Combine and build result ───────────────────────────────────────────
    const allZones = new Set([
      ...zoneAnchorCount.keys(),
      ...heatByZone.keys(),
    ])

    const result = [...allZones].map(zone => {
      const anchorCount    = zoneAnchorCount.get(zone)   ?? 0
      const heat           = heatByZone.get(zone)?.heat_index ?? 50
      const liquidity      = Math.min(100, Math.round(heat * 0.6 + anchorCount * 20))

      // Estimate rotation speed: anchor presence reduces days to close
      const baseRotation   = heat >= 70 ? 30 : heat >= 50 ? 60 : 90
      const rotationBonus  = anchorCount >= 2 ? 15 : anchorCount === 1 ? 8 : 0
      const rotation_speed_days = Math.max(14, baseRotation - rotationBonus)

      return {
        zone,
        liquidity_score:     liquidity,
        anchor_investors:    anchorCount,
        rotation_speed_days,
      }
    })

    return result
      .filter(z => z.liquidity_score > 0)
      .sort((a, b) => b.liquidity_score - a.liquidity_score)
  } catch (err) {
    log.error(
      '[NetworkExternalityEngine] getHighLiquidityZones exception',
      err instanceof Error ? err : undefined,
      { error: err instanceof Error ? err.message : String(err) },
    )
    return []
  }
}
