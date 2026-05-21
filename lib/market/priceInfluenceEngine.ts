// =============================================================================
// Agency Group — Price Influence Engine
// lib/market/priceInfluenceEngine.ts
//
// Computes a "perceived market value" adjustment for each property by applying
// five multiplicative price influence factors derived from live bid activity:
//   1. bid_density_factor   — number of active bids
//   2. urgency_factor       — urgency heat of bid pool
//   3. competition_factor   — spread tightness
//   4. time_pressure_factor — days on market
//   5. sentiment_factor     — bid trend over last 7 days
//
// Results are persisted to the perceived_value_cache table.
//
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { computeUrgencyHeat } from '@/lib/market/bidCompetitionEngine'
import { computeSpread } from '@/lib/market/orderBook'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PriceInfluenceFactors {
  bid_density_factor: number
  urgency_factor: number
  competition_factor: number
  time_pressure_factor: number
  sentiment_factor: number
}

export interface PerceivedValueAdjustment {
  property_id: string
  tenant_id: string
  base_value: number
  adjusted_value: number
  total_adjustment_pct: number
  factors: PriceInfluenceFactors
  confidence: number
  valid_until: string
  computed_at: string
}

// ─── Internal row shapes ──────────────────────────────────────────────────────

interface BidRow {
  bid_amount: number
  urgency: string
  created_at: string
}

interface PropertyRow {
  preco: number | null
  created_at: string | null
}

// ─── persistPerceivedValue ────────────────────────────────────────────────────

export async function persistPerceivedValue(adj: PerceivedValueAdjustment): Promise<void> {
  const db = supabaseAdmin as any

  const { error } = await (db
    .from('perceived_value_cache')
    .upsert(
      {
        property_id:          adj.property_id,
        tenant_id:            adj.tenant_id,
        base_value:           adj.base_value,
        adjusted_value:       adj.adjusted_value,
        total_adjustment_pct: adj.total_adjustment_pct,
        factors:              adj.factors,
        confidence:           adj.confidence,
        valid_until:          adj.valid_until,
        computed_at:          adj.computed_at,
      },
      { onConflict: 'tenant_id,property_id' },
    ) as Promise<{ error: { message: string } | null }>)

  if (error) {
    log.warn('[priceInfluence] persistPerceivedValue failed', {
      property_id: adj.property_id,
      error: error.message,
    })
  }
}

// ─── computePerceivedValue ────────────────────────────────────────────────────

export async function computePerceivedValue(
  tenantId: string,
  propertyId: string,
): Promise<PerceivedValueAdjustment | null> {
  const db  = supabaseAdmin as any
  const now = new Date()

  try {
    // Fetch property
    const { data: propRaw, error: propErr } = await (db
      .from('properties')
      .select('preco, created_at')
      .eq('id', propertyId)
      .eq('tenant_id', tenantId)
      .single() as Promise<{ data: PropertyRow | null; error: { message: string } | null }>)

    if (propErr || !propRaw) {
      log.warn('[priceInfluence] property not found', { property_id: propertyId })
      return null
    }

    const baseValue = propRaw.preco ?? 0
    if (baseValue <= 0) {
      log.warn('[priceInfluence] zero base price, skipping', { property_id: propertyId })
      return null
    }

    const listingDate  = propRaw.created_at ? new Date(propRaw.created_at) : now
    const daysOnMarket = Math.max(0, (now.getTime() - listingDate.getTime()) / (1000 * 60 * 60 * 24))

    // Fetch all active bids
    const { data: bidsRaw, error: bidsErr } = await (db
      .from('investor_bids')
      .select('bid_amount, urgency, created_at')
      .eq('tenant_id', tenantId)
      .eq('property_id', propertyId)
      .eq('status', 'active') as Promise<{ data: BidRow[] | null; error: { message: string } | null }>)

    if (bidsErr) {
      log.warn('[priceInfluence] bids query failed', { property_id: propertyId, error: bidsErr.message })
    }

    const activeBids    = bidsRaw ?? []
    const activeBidCount = activeBids.length

    // --- Factor 1: bid_density_factor ---
    const bid_density_factor = 1 + Math.min(0.15, (activeBidCount - 1) * 0.03)

    // --- Factor 2: urgency_factor ---
    const urgencyHeat    = computeUrgencyHeat(activeBids.map(b => ({ urgency: b.urgency, created_at: b.created_at })))
    const urgency_factor = 1 + urgencyHeat * 0.10

    // --- Factor 3: competition_factor ---
    const bestBid  = activeBids.length > 0 ? Math.max(...activeBids.map(b => b.bid_amount)) : null
    const { spread_pct } = computeSpread(bestBid, baseValue)
    let competition_factor: number
    if (spread_pct !== null && spread_pct < 10) {
      competition_factor = 1 + Math.max(0, (1 - spread_pct / 10)) * 0.08
    } else {
      competition_factor = 1.0
    }

    // --- Factor 4: time_pressure_factor ---
    const time_pressure_factor = 1 + Math.min(0.12, daysOnMarket / 750)

    // --- Factor 5: sentiment_factor ---
    // Fetch bids created in last 7 days vs. previous 7 days for trend
    const sevenDaysAgo    = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()

    const { data: recentBidsRaw } = await (db
      .from('investor_bids')
      .select('created_at', { count: 'exact', head: false })
      .eq('tenant_id', tenantId)
      .eq('property_id', propertyId)
      .gte('created_at', sevenDaysAgo) as Promise<{ data: unknown[] | null; error: unknown }>)

    const { data: prevBidsRaw } = await (db
      .from('investor_bids')
      .select('created_at', { count: 'exact', head: false })
      .eq('tenant_id', tenantId)
      .eq('property_id', propertyId)
      .gte('created_at', fourteenDaysAgo)
      .lt('created_at', sevenDaysAgo) as Promise<{ data: unknown[] | null; error: unknown }>)

    const recentCount = (recentBidsRaw ?? []).length
    const prevCount   = (prevBidsRaw ?? []).length

    let sentiment_factor: number
    if (prevCount === 0 && recentCount === 0) {
      sentiment_factor = 1.0
    } else if (prevCount === 0) {
      sentiment_factor = 1.05 // new activity where there was none
    } else {
      const trend = (recentCount - prevCount) / prevCount
      // range: [-0.05, +0.08] => [0.95, 1.08]
      const rawFactor = 1 + Math.max(-0.05, Math.min(0.08, trend * 0.08))
      sentiment_factor = Math.round(rawFactor * 10000) / 10000
    }

    // --- Multiplicative combination ---
    const adjustedValue = baseValue
      * bid_density_factor
      * urgency_factor
      * competition_factor
      * time_pressure_factor
      * sentiment_factor

    const roundedAdjusted = Math.round(adjustedValue * 100) / 100
    const totalAdjPct     = ((roundedAdjusted - baseValue) / baseValue) * 100

    // Confidence: higher with more bids, penalized when no data
    const confidence = Math.min(1, 0.3 + activeBidCount * 0.1)

    const computedAt = now.toISOString()
    const validUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()

    const factors: PriceInfluenceFactors = {
      bid_density_factor:  Math.round(bid_density_factor * 10000) / 10000,
      urgency_factor:      Math.round(urgency_factor * 10000) / 10000,
      competition_factor:  Math.round(competition_factor * 10000) / 10000,
      time_pressure_factor: Math.round(time_pressure_factor * 10000) / 10000,
      sentiment_factor:    Math.round(sentiment_factor * 10000) / 10000,
    }

    const adj: PerceivedValueAdjustment = {
      property_id:          propertyId,
      tenant_id:            tenantId,
      base_value:           baseValue,
      adjusted_value:       roundedAdjusted,
      total_adjustment_pct: Math.round(totalAdjPct * 10000) / 10000,
      factors,
      confidence:           Math.round(confidence * 10000) / 10000,
      valid_until:          validUntil,
      computed_at:          computedAt,
    }

    void persistPerceivedValue(adj).catch(e =>
      log.warn('[priceInfluence] fire-and-forget persist failed', {
        error: e instanceof Error ? e.message : String(e),
      }),
    )

    log.info('[priceInfluence] computed perceived value', {
      property_id:          propertyId,
      adjusted_value:       roundedAdjusted,
      total_adjustment_pct: adj.total_adjustment_pct,
    })

    return adj
  } catch (err) {
    log.error('[priceInfluence] computePerceivedValue failed', err instanceof Error ? err : undefined, {
      property_id: propertyId,
    })
    return null
  }
}

// ─── batchComputePerceivedValues ──────────────────────────────────────────────

export async function batchComputePerceivedValues(
  tenantId: string,
  propertyIds: string[],
): Promise<PerceivedValueAdjustment[]> {
  if (propertyIds.length === 0) return []

  const results = await Promise.allSettled(
    propertyIds.map(id => computePerceivedValue(tenantId, id)),
  )

  const succeeded: PerceivedValueAdjustment[] = []
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value !== null) {
      succeeded.push(r.value)
    } else if (r.status === 'rejected') {
      log.warn('[priceInfluence] batchCompute: one property failed', {
        error: r.reason instanceof Error ? r.reason.message : String(r.reason),
      })
    }
  }

  log.info('[priceInfluence] batchComputePerceivedValues complete', {
    requested: propertyIds.length,
    succeeded: succeeded.length,
  })

  return succeeded
}
