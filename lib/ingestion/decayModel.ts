// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — Freshness Decay Model + Wave-32 Asset Decay
// lib/ingestion/decayModel.ts
//
// ── SECTION 1 (pre-existing): Freshness score for canonical_properties ────────
//    computeFreshnessScore() + runDecayCron() — used by the weekly cron
//    /api/cron/ingestion-decay.
//
// ── SECTION 2 (Wave 32): Asset decay model for the ingestion pipeline ─────────
//    computeDecay() + applyDecay() — used by the hourly asset-ingestion cron.
//    Stages: fresh 0–30d / aging 31–90d / stale 91–180d / critical 181+d
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import type { CanonicalPropertyInput } from '@/lib/ingestion/normalizationPipeline'

// =============================================================================
// SECTION 1 — Freshness score (canonical_properties cron)
// =============================================================================

export type DecayStage = 'fresh' | 'aging' | 'stale' | 'expired'

export interface FreshnessScore {
  canonical_id: string
  freshness_score: number    // 0–100
  days_listed: number
  last_price_change_days: number | null
  last_update_days: number
  decay_stage: DecayStage
  should_delist: boolean
}

/**
 * Computes freshness score for a property from its timestamps.
 * Pure function — no database access.
 */
export function computeFreshnessScore(property: {
  canonical_id?: string
  listed_at: string
  last_updated_at: string
  last_price_change_at: string | null
  listing_status: string
}): FreshnessScore {
  const now = Date.now()
  const listedMs      = new Date(property.listed_at).getTime()
  const lastUpdatedMs = new Date(property.last_updated_at).getTime()

  const daysListed  = Math.max(0, (now - listedMs) / 86_400_000)
  const daysUpdated = Math.max(0, (now - lastUpdatedMs) / 86_400_000)
  const daysPriceChange = property.last_price_change_at != null
    ? Math.max(0, (now - new Date(property.last_price_change_at).getTime()) / 86_400_000)
    : null

  // Base decay from days_listed
  let base: number
  if (daysListed <= 30) {
    // Linear: 100 → 85
    base = 100 - (daysListed / 30) * 15
  } else if (daysListed <= 90) {
    // Linear: 85 → 60
    base = 85 - ((daysListed - 30) / 60) * 25
  } else if (daysListed <= 180) {
    // Logarithmic: 60 → 30
    const t = (daysListed - 90) / 90 // 0→1
    base = 60 - Math.log1p(t * (Math.E - 1)) * 30
  } else {
    // Exponential: 30 → 5
    const t = (daysListed - 180) / 180 // 0→1 per extra 180 days
    base = 30 * Math.exp(-t * 2.1) + 5
    base = Math.max(base, 5)
  }

  // Partial resets
  let resetBonus = 0
  if (daysPriceChange != null && daysPriceChange < daysListed) {
    const recencyFactor = Math.max(0, 1 - daysPriceChange / 90)
    resetBonus += 15 * recencyFactor
  }
  if (daysUpdated < daysListed) {
    const recencyFactor = Math.max(0, 1 - daysUpdated / 30)
    resetBonus += 5 * recencyFactor
  }

  const rawScore = Math.min(100, base + resetBonus)
  const freshnessScore = Math.round(rawScore * 100) / 100

  const decayStage: DecayStage =
    freshnessScore >= 80 ? 'fresh'
    : freshnessScore >= 50 ? 'aging'
    : freshnessScore >= 20 ? 'stale'
    : 'expired'

  return {
    canonical_id:          property.canonical_id ?? '',
    freshness_score:       freshnessScore,
    days_listed:           Math.round(daysListed),
    last_price_change_days: daysPriceChange != null ? Math.round(daysPriceChange) : null,
    last_update_days:      Math.round(daysUpdated),
    decay_stage:           decayStage,
    should_delist:         freshnessScore < 5 || property.listing_status === 'expired',
  }
}

const BATCH_SIZE = 200

/**
 * Runs freshness decay for all active canonical properties of a tenant.
 * Called by the weekly cron /api/cron/ingestion-decay.
 */
export async function runDecayCron(tenantId: string): Promise<{
  properties_updated: number
  properties_delisted: number
  avg_freshness_before: number
  avg_freshness_after: number
}> {
  let offset = 0
  let totalUpdated  = 0
  let totalDelisted = 0
  const freshnessBeforeAll: number[] = []
  const freshnessAfterAll:  number[] = []

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data: rows, error } = await (supabaseAdmin as any)
      .from('canonical_properties')
      .select(
        'canonical_id, listed_at, computed_at, freshness_score, listing_status',
      )
      .eq('tenant_id', tenantId)
      .eq('listing_status', 'active')
      .order('listed_at', { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1)

    if (error) {
      console.error('[DecayModel] runDecayCron fetch error:', error.message)
      break
    }
    if (!rows || rows.length === 0) break

    const updates: {
      canonical_id: string
      freshness_score: number
      listing_status: string
      computed_at: string
    }[] = []

    for (const row of rows as {
      canonical_id: string
      listed_at: string
      computed_at: string
      freshness_score: number
      listing_status: string
    }[]) {
      const prevScore = Number(row.freshness_score)
      freshnessBeforeAll.push(prevScore)

      const result = computeFreshnessScore({
        canonical_id:        row.canonical_id,
        listed_at:           row.listed_at,
        last_updated_at:     row.computed_at,
        last_price_change_at: null,
        listing_status:      row.listing_status,
      })

      freshnessAfterAll.push(result.freshness_score)

      updates.push({
        canonical_id:    row.canonical_id,
        freshness_score: result.freshness_score,
        listing_status:  result.should_delist ? 'expired' : row.listing_status,
        computed_at:     new Date().toISOString(),
      })

      if (result.should_delist) totalDelisted++
    }

    for (let i = 0; i < updates.length; i += 50) {
      const chunk = updates.slice(i, i + 50)
      for (const upd of chunk) {
        const { error: upsertErr } = await (supabaseAdmin as any)
          .from('canonical_properties')
          .update({
            freshness_score: upd.freshness_score,
            listing_status:  upd.listing_status,
            computed_at:     upd.computed_at,
          })
          .eq('canonical_id', upd.canonical_id)
          .eq('tenant_id', tenantId)

        if (upsertErr) {
          console.warn('[DecayModel] update error for', upd.canonical_id, upsertErr.message)
        } else {
          totalUpdated++
        }
      }
    }

    if (rows.length < BATCH_SIZE) break
    offset += BATCH_SIZE
  }

  const avg = (arr: number[]) =>
    arr.length === 0 ? 0 : Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 100) / 100

  return {
    properties_updated:   totalUpdated,
    properties_delisted:  totalDelisted,
    avg_freshness_before: avg(freshnessBeforeAll),
    avg_freshness_after:  avg(freshnessAfterAll),
  }
}

// =============================================================================
// SECTION 2 — Wave-32 Asset Decay (canonical_assets ingestion pipeline)
// =============================================================================

export interface AssetDecayResult {
  original_price: number
  adjusted_price: number
  decay_factor: number      // 0.0–1.0 (1.0 = no decay)
  days_on_market: number
  decay_stage: 'fresh' | 'aging' | 'stale' | 'critical'
}

/**
 * Computes the financial decay factor for a canonical asset.
 * Pure function — no DB access.
 *
 *   fresh    0–30 days   factor = 1.00
 *   aging   31–90 days   factor = 0.97
 *   stale   91–180 days  factor = 0.93
 *   critical 181+ days   factor = 0.85
 */
export function computeDecay(
  item: CanonicalPropertyInput,
  referenceDate?: Date,
): AssetDecayResult {
  const ref    = referenceDate ?? new Date()
  const listed = new Date(item.listed_at).getTime()
  const days   = Math.max(0, (ref.getTime() - listed) / 86_400_000)

  let decay_factor: number
  let decay_stage: AssetDecayResult['decay_stage']

  if (days <= 30) {
    decay_stage  = 'fresh'
    decay_factor = 1.00
  } else if (days <= 90) {
    decay_stage  = 'aging'
    decay_factor = 0.97
  } else if (days <= 180) {
    decay_stage  = 'stale'
    decay_factor = 0.93
  } else {
    decay_stage  = 'critical'
    decay_factor = 0.85
  }

  return {
    original_price: item.price_eur,
    adjusted_price: Math.round(item.price_eur * decay_factor * 100) / 100,
    decay_factor,
    days_on_market: Math.round(days),
    decay_stage,
  }
}

export function applyDecay(
  items: CanonicalPropertyInput[],
  referenceDate?: Date,
): Array<CanonicalPropertyInput & { decay: AssetDecayResult }> {
  return items.map((item) => ({
    ...item,
    decay: computeDecay(item, referenceDate),
  }))
}

// Re-export AssetDecayResult as DecayResult for convenience
export type { AssetDecayResult as DecayResult }
