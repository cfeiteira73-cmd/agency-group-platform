// =============================================================================
// Agency Group — Network Effect Engine
// lib/market/networkEffectEngine.ts
//
// Tracks and quantifies the capital market flywheel:
//   more investors → more competition → higher price accuracy → more capital
//
// Produces a daily NetworkEffect snapshot with flywheel_score (0-100) and
// stage classification: seed / growth / acceleration / maturity.
//
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type FlywheelStage = 'seed' | 'growth' | 'acceleration' | 'maturity'

export interface NetworkEffect {
  tenant_id: string
  period: string
  active_investors: number
  active_properties: number
  total_active_bids: number
  competition_index: number
  price_accuracy_score: number
  capital_velocity: number
  network_density: number
  flywheel_score: number
  flywheel_stage: FlywheelStage
  capital_inflow_estimate_eur: number
  computed_at: string
}

// ─── Internal row shapes ──────────────────────────────────────────────────────

interface NetworkEffectRow {
  tenant_id: string
  period: string
  active_investors: number
  active_properties: number
  total_active_bids: number
  competition_index: number
  price_accuracy_score: number
  capital_velocity: number
  network_density: number
  flywheel_score: number
  flywheel_stage: string
  capital_inflow_estimate_eur: number
  computed_at: string
}

interface BidRow {
  investor_id: string
  bid_amount: number
  property_id: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function flywheelStage(score: number): FlywheelStage {
  if (score < 25) return 'seed'
  if (score < 50) return 'growth'
  if (score < 75) return 'acceleration'
  return 'maturity'
}

function computeFlywheelScore(
  competitionIndex: number,
  priceAccuracyScore: number,
  capitalVelocity: number,
  networkDensity: number,
): number {
  const raw = (competitionIndex / 10) * 30
    + (priceAccuracyScore / 100) * 30
    + Math.min(1, capitalVelocity / 1_000_000) * 20
    + networkDensity * 20
  return Math.round(Math.min(100, Math.max(0, raw)) * 100) / 100
}

// ─── persistNetworkEffect ─────────────────────────────────────────────────────

export async function persistNetworkEffect(ne: NetworkEffect): Promise<void> {
  const db = supabaseAdmin as any

  const { error } = await (db
    .from('network_effect_snapshots')
    .upsert(
      {
        tenant_id:                   ne.tenant_id,
        period:                      ne.period,
        active_investors:            ne.active_investors,
        active_properties:           ne.active_properties,
        total_active_bids:           ne.total_active_bids,
        competition_index:           ne.competition_index,
        price_accuracy_score:        ne.price_accuracy_score,
        capital_velocity:            ne.capital_velocity,
        network_density:             ne.network_density,
        flywheel_score:              ne.flywheel_score,
        flywheel_stage:              ne.flywheel_stage,
        capital_inflow_estimate_eur: ne.capital_inflow_estimate_eur,
        computed_at:                 ne.computed_at,
      },
      { onConflict: 'tenant_id,period' },
    ) as Promise<{ error: { message: string } | null }>)

  if (error) {
    log.warn('[networkEffect] persistNetworkEffect failed', {
      tenant_id: ne.tenant_id,
      period:    ne.period,
      error:     error.message,
    })
  }
}

// ─── computeNetworkEffect ─────────────────────────────────────────────────────

export async function computeNetworkEffect(
  tenantId: string,
  date?: string,
): Promise<NetworkEffect> {
  const db        = supabaseAdmin as any
  const now       = new Date()
  const period    = date ?? now.toISOString().slice(0, 10)
  const computedAt = now.toISOString()

  const fallback: NetworkEffect = {
    tenant_id:                   tenantId,
    period,
    active_investors:            0,
    active_properties:           0,
    total_active_bids:           0,
    competition_index:           0,
    price_accuracy_score:        0,
    capital_velocity:            0,
    network_density:             0,
    flywheel_score:              0,
    flywheel_stage:              'seed',
    capital_inflow_estimate_eur: 0,
    computed_at:                 computedAt,
  }

  try {
    // Active investors: distinct investor_ids with active bids
    const { data: bidsRaw, error: bidsErr } = await (db
      .from('investor_bids')
      .select('investor_id, bid_amount, property_id')
      .eq('tenant_id', tenantId)
      .eq('status', 'active') as Promise<{ data: BidRow[] | null; error: { message: string } | null }>)

    if (bidsErr) {
      log.warn('[networkEffect] bids query failed', { error: bidsErr.message })
    }

    const bids = bidsRaw ?? []

    const activeInvestors = new Set(bids.map(b => b.investor_id)).size
    const totalActiveBids = bids.length

    // Active properties
    const { count: propCount, error: propErr } = await (db
      .from('properties')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'active') as Promise<{ count: number | null; error: { message: string } | null }>)

    if (propErr) {
      log.warn('[networkEffect] properties count failed', { error: propErr.message })
    }

    const activeProperties = propCount ?? 0

    // competition_index: avg bids per property
    const competitionIndex = activeProperties > 0
      ? Math.round((totalActiveBids / activeProperties) * 10000) / 10000
      : 0

    // price_accuracy_score: based on spread tightness across the market
    // Proxy: fraction of properties with at least 1 bid → tighter price discovery
    const propsWithBids = new Set(bids.map(b => b.property_id)).size
    const coverageRatio = activeProperties > 0 ? propsWithBids / activeProperties : 0
    // Also factor: if competition_index >= 2, accuracy is higher
    const accuracyFromCompetition = Math.min(1, competitionIndex / 5)
    const priceAccuracyScore = Math.round(
      Math.min(100, (coverageRatio * 60 + accuracyFromCompetition * 40)),
    )

    // capital_velocity: total EUR committed (active bids)
    const capitalVelocity = Math.round(bids.reduce((s, b) => s + b.bid_amount, 0) * 100) / 100

    // network_density: bidders / (properties * max_normalized)
    // Normalized: assume max reasonable bidder/property ratio is 10
    const maxRatio = 10
    const networkDensity = activeProperties > 0
      ? Math.round(Math.min(1, (activeInvestors / activeProperties) / maxRatio) * 10000) / 10000
      : 0

    const flywheelScore = computeFlywheelScore(
      competitionIndex,
      priceAccuracyScore,
      capitalVelocity,
      networkDensity,
    )

    // capital_inflow_estimate: bids submitted today
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)

    const { data: todayBidsRaw } = await (db
      .from('investor_bids')
      .select('bid_amount')
      .eq('tenant_id', tenantId)
      .gte('created_at', todayStart.toISOString()) as Promise<{ data: { bid_amount: number }[] | null; error: unknown }>)

    const capitalInflowEstimateEur = (todayBidsRaw ?? []).reduce((s, b) => s + b.bid_amount, 0)

    const ne: NetworkEffect = {
      tenant_id:                   tenantId,
      period,
      active_investors:            activeInvestors,
      active_properties:           activeProperties,
      total_active_bids:           totalActiveBids,
      competition_index:           Math.round(competitionIndex * 10000) / 10000,
      price_accuracy_score:        priceAccuracyScore,
      capital_velocity:            capitalVelocity,
      network_density:             networkDensity,
      flywheel_score:              flywheelScore,
      flywheel_stage:              flywheelStage(flywheelScore),
      capital_inflow_estimate_eur: Math.round(capitalInflowEstimateEur * 100) / 100,
      computed_at:                 computedAt,
    }

    void persistNetworkEffect(ne).catch(e =>
      log.warn('[networkEffect] fire-and-forget persist failed', {
        error: e instanceof Error ? e.message : String(e),
      }),
    )

    log.info('[networkEffect] computeNetworkEffect', {
      tenant_id:      tenantId,
      period,
      flywheel_score: ne.flywheel_score,
      flywheel_stage: ne.flywheel_stage,
      active_investors: ne.active_investors,
    })

    return ne
  } catch (err) {
    log.error('[networkEffect] computeNetworkEffect exception', err instanceof Error ? err : undefined, {
      tenant_id: tenantId,
    })
    return fallback
  }
}

// ─── getNetworkEffectHistory ──────────────────────────────────────────────────

export async function getNetworkEffectHistory(
  tenantId: string,
  days: number = 30,
): Promise<NetworkEffect[]> {
  const db     = supabaseAdmin as any
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffDate = cutoff.toISOString().slice(0, 10)

  try {
    const { data, error } = await (db
      .from('network_effect_snapshots')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('period', cutoffDate)
      .order('period', { ascending: false }) as Promise<{ data: NetworkEffectRow[] | null; error: { message: string } | null }>)

    if (error) {
      log.warn('[networkEffect] getNetworkEffectHistory failed', { error: error.message })
      return []
    }

    return (data ?? []).map(row => ({
      tenant_id:                   row.tenant_id,
      period:                      row.period,
      active_investors:            row.active_investors,
      active_properties:           row.active_properties,
      total_active_bids:           row.total_active_bids,
      competition_index:           row.competition_index,
      price_accuracy_score:        row.price_accuracy_score,
      capital_velocity:            row.capital_velocity,
      network_density:             row.network_density,
      flywheel_score:              row.flywheel_score,
      flywheel_stage:              row.flywheel_stage as FlywheelStage,
      capital_inflow_estimate_eur: row.capital_inflow_estimate_eur,
      computed_at:                 row.computed_at,
    }))
  } catch (err) {
    log.error('[networkEffect] getNetworkEffectHistory exception', err instanceof Error ? err : undefined, {
      tenant_id: tenantId,
    })
    return []
  }
}
