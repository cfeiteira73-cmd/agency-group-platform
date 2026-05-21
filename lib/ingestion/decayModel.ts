// =============================================================================
// Agency Group — Freshness Decay Model
// lib/ingestion/decayModel.ts
//
// Computes a 0–100 freshness score for each active property listing.
// Score decays over time; price changes and listing updates partially reset it.
//
// Decay curve:
//   days  0–30:   100 → 85   (linear, -0.5/day)
//   days 30–90:   85  → 60   (linear, -0.417/day)
//   days 90–180:  60  → 30   (logarithmic)
//   days 180+:    30  → 5    (exponential)
//
// Resets:
//   Price change  → +15 pts  (capped at 100)
//   Any update    → +5 pts   (capped at 100)
//
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Pure Decay Computation ───────────────────────────────────────────────────

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
    // Price change happened after listing — apply bonus scaled by recency
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

// ─── Batch Cron Runner ────────────────────────────────────────────────────────

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
    const { data: rows, error } = await supabaseAdmin
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
        last_updated_at:     row.computed_at, // use computed_at as proxy for last update
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

    // Batch upsert in chunks to avoid payload limits
    for (let i = 0; i < updates.length; i += 50) {
      const chunk = updates.slice(i, i + 50)
      for (const upd of chunk) {
        const { error: upsertErr } = await supabaseAdmin
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
