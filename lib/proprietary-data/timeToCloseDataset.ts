// Agency Group — Time-to-Close Proprietary Dataset
// lib/proprietary-data/timeToCloseDataset.ts
// Real time-to-close analytics — most valuable proprietary dataset in real estate.
// TypeScript strict — 0 errors

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TimeToCloseRecord {
  record_id: string
  tenant_id: string
  asset_id: string
  opportunity_id: string | null
  market: string
  city: string
  property_type: string
  price_band: 'UNDER_200K' | '200K_500K' | '500K_1M' | '1M_3M' | 'OVER_3M'

  // Times (all in days)
  days_listing_to_first_bid: number | null
  days_first_bid_to_accepted: number | null
  days_accepted_to_cpcv: number | null
  days_cpcv_to_escritura: number | null
  days_total_listing_to_close: number

  // Context
  asking_price_eur_cents: number
  final_price_eur_cents: number
  discount_from_asking_pct: number // (asking - final) / asking * 100
  bid_count: number
  was_distressed: boolean

  source: 'INTERNAL_EXECUTION' | 'EXTERNAL_REGISTRY' | 'BROKER_REPORTED'
  recorded_at: string
}

export interface TimeToCloseStats {
  market: string
  property_type: string
  price_band: string
  sample_count: number
  p25_days: number
  p50_days: number // THE benchmark
  p75_days: number
  mean_days: number
  min_days: number
  max_days: number
  distressed_p50_days: number | null
  generated_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the price band for a given price in EUR cents.
 */
export function getPriceBand(priceEurCents: number): TimeToCloseRecord['price_band'] {
  if (priceEurCents < 20_000_000) return 'UNDER_200K'
  if (priceEurCents < 50_000_000) return '200K_500K'
  if (priceEurCents < 100_000_000) return '500K_1M'
  if (priceEurCents < 300_000_000) return '1M_3M'
  return 'OVER_3M'
}

function computePercentile(sorted: number[], pct: number): number {
  if (sorted.length === 0) return 0
  const idx = (pct / 100) * (sorted.length - 1)
  const lower = Math.floor(idx)
  const upper = Math.ceil(idx)
  if (lower === upper) return sorted[lower]
  const weight = idx - lower
  return sorted[lower] * (1 - weight) + sorted[upper] * weight
}

// ─── recordTimeToClose ────────────────────────────────────────────────────────

/**
 * Persists a time-to-close record to `time_to_close_records`.
 * Validates: days_total >= 0.
 * Source tagged as Observed (INTERNAL_EXECUTION) or Inferred (BROKER_REPORTED).
 */
export async function recordTimeToClose(
  record: Omit<TimeToCloseRecord, 'record_id'>,
  tenantId: string,
): Promise<TimeToCloseRecord> {
  if (record.days_total_listing_to_close < 0) {
    throw new Error('[timeToCloseDataset] days_total_listing_to_close must be >= 0')
  }

  const record_id = randomUUID()

  const row = {
    record_id,
    tenant_id: tenantId,
    asset_id: record.asset_id,
    opportunity_id: record.opportunity_id ?? null,
    market: record.market,
    city: record.city,
    property_type: record.property_type,
    price_band: record.price_band,
    days_listing_to_first_bid: record.days_listing_to_first_bid ?? null,
    days_first_bid_to_accepted: record.days_first_bid_to_accepted ?? null,
    days_accepted_to_cpcv: record.days_accepted_to_cpcv ?? null,
    days_cpcv_to_escritura: record.days_cpcv_to_escritura ?? null,
    days_total_listing_to_close: record.days_total_listing_to_close,
    asking_price_eur_cents: record.asking_price_eur_cents,
    final_price_eur_cents: record.final_price_eur_cents,
    discount_from_asking_pct: record.discount_from_asking_pct,
    bid_count: record.bid_count,
    was_distressed: record.was_distressed,
    source: record.source,
    recorded_at: record.recorded_at,
  }

  const { error } = await (supabaseAdmin as any)
    .from('time_to_close_records')
    .insert(row)

  if (error) {
    log.error('[timeToCloseDataset] insert failed', new Error(error.message), { record_id })
    throw new Error(`recordTimeToClose: ${error.message}`)
  }

  log.info('[timeToCloseDataset] recorded', { record_id, market: record.market, days: record.days_total_listing_to_close })

  return { ...record, record_id }
}

// ─── computeTimeToCloseStats ──────────────────────────────────────────────────

/**
 * Reads from `time_to_close_records`, groups by market+property_type+price_band,
 * computes percentiles using sorted array approach (no SQL percentile functions).
 * Also supplements from `opportunity_outcomes` and `external_closing_records`.
 */
export async function computeTimeToCloseStats(
  market: string,
  propertyType?: string,
  tenantId?: string,
): Promise<TimeToCloseStats[]> {
  // Fetch primary records
  let query = (supabaseAdmin as any)
    .from('time_to_close_records')
    .select('property_type, price_band, days_total_listing_to_close, was_distressed, tenant_id')
    .eq('market', market)

  if (propertyType) query = query.eq('property_type', propertyType)
  if (tenantId) query = query.eq('tenant_id', tenantId)

  const { data: primary, error: primaryErr } = await query
  if (primaryErr) {
    log.warn('[timeToCloseDataset] primary fetch error', { market, error: primaryErr.message })
  }

  // Supplement from opportunity_outcomes (observed data)
  const { data: oppOutcomes } = await (supabaseAdmin as any)
    .from('opportunity_outcomes')
    .select('property_type, price_band, days_total_listing_to_close, was_distressed, tenant_id')
    .eq('market', market)
    .not('days_total_listing_to_close', 'is', null)

  // Supplement from external_closing_records (inferred data)
  const { data: externalRecords } = await (supabaseAdmin as any)
    .from('external_closing_records')
    .select('property_type, price_band, days_total_listing_to_close, was_distressed, tenant_id')
    .eq('market', market)
    .not('days_total_listing_to_close', 'is', null)

  type RawRow = {
    property_type: string
    price_band: string
    days_total_listing_to_close: number
    was_distressed: boolean
    tenant_id: string
  }

  const allRows: RawRow[] = [
    ...(primary ?? []),
    ...(oppOutcomes ?? []),
    ...(externalRecords ?? []),
  ]

  // Filter by tenantId if specified (supplemental tables may not filter server-side)
  const filtered = tenantId ? allRows.filter((r: RawRow) => r.tenant_id === tenantId) : allRows

  if (filtered.length === 0) return []

  // Group by property_type + price_band
  const groups = new Map<string, RawRow[]>()
  for (const row of filtered) {
    const key = `${row.property_type}::${row.price_band}`
    const group = groups.get(key)
    if (group) {
      group.push(row)
    } else {
      groups.set(key, [row])
    }
  }

  const stats: TimeToCloseStats[] = []
  const generatedAt = new Date().toISOString()

  for (const [key, rows] of groups) {
    const [pt, pb] = key.split('::')
    const allDays = rows
      .map((r: RawRow) => r.days_total_listing_to_close)
      .filter((d: number) => d >= 0)
      .sort((a: number, b: number) => a - b)

    if (allDays.length === 0) continue

    const distressedDays = rows
      .filter((r: RawRow) => r.was_distressed)
      .map((r: RawRow) => r.days_total_listing_to_close)
      .sort((a: number, b: number) => a - b)

    const mean = allDays.reduce((s: number, d: number) => s + d, 0) / allDays.length

    stats.push({
      market,
      property_type: pt,
      price_band: pb,
      sample_count: allDays.length,
      p25_days: Math.round(computePercentile(allDays, 25)),
      p50_days: Math.round(computePercentile(allDays, 50)),
      p75_days: Math.round(computePercentile(allDays, 75)),
      mean_days: Math.round(mean),
      min_days: allDays[0],
      max_days: allDays[allDays.length - 1],
      distressed_p50_days: distressedDays.length > 0 ? Math.round(computePercentile(distressedDays, 50)) : null,
      generated_at: generatedAt,
    })
  }

  log.info('[timeToCloseDataset] stats computed', { market, groups: stats.length })
  return stats
}

// ─── ingestFromExecutionOutcomes ──────────────────────────────────────────────

/**
 * Reads `execution_outcomes` with status='COMPLETED', maps to TimeToCloseRecord,
 * bulk inserts. Source: INTERNAL_EXECUTION (observed data).
 */
export async function ingestFromExecutionOutcomes(
  tenantId: string,
): Promise<{ ingested: number }> {
  const { data: outcomes, error } = await (supabaseAdmin as any)
    .from('execution_outcomes')
    .select('*')
    .eq('status', 'COMPLETED')
    .eq('tenant_id', tenantId)

  if (error) {
    log.error('[timeToCloseDataset] ingest fetch error', new Error(error.message), { tenantId })
    throw new Error(`ingestFromExecutionOutcomes: ${error.message}`)
  }

  if (!outcomes || outcomes.length === 0) return { ingested: 0 }

  type ExecutionOutcome = {
    asset_id?: string
    opportunity_id?: string
    market?: string
    city?: string
    property_type?: string
    asking_price_eur_cents?: number
    final_price_eur_cents?: number
    bid_count?: number
    was_distressed?: boolean
    days_listing_to_first_bid?: number
    days_first_bid_to_accepted?: number
    days_accepted_to_cpcv?: number
    days_cpcv_to_escritura?: number
    days_total_listing_to_close?: number
    completed_at?: string
  }

  const rows = (outcomes as ExecutionOutcome[])
    .filter((o: ExecutionOutcome) => typeof o.days_total_listing_to_close === 'number' && o.days_total_listing_to_close >= 0)
    .map((o: ExecutionOutcome) => {
      const asking = o.asking_price_eur_cents ?? 0
      const final_ = o.final_price_eur_cents ?? 0
      const discountPct = asking > 0 ? ((asking - final_) / asking) * 100 : 0
      const price = asking > 0 ? asking : final_
      return {
        record_id: randomUUID(),
        tenant_id: tenantId,
        asset_id: o.asset_id ?? 'unknown',
        opportunity_id: o.opportunity_id ?? null,
        market: o.market ?? 'PT:Unknown',
        city: o.city ?? 'Unknown',
        property_type: o.property_type ?? 'residential',
        price_band: getPriceBand(price),
        days_listing_to_first_bid: o.days_listing_to_first_bid ?? null,
        days_first_bid_to_accepted: o.days_first_bid_to_accepted ?? null,
        days_accepted_to_cpcv: o.days_accepted_to_cpcv ?? null,
        days_cpcv_to_escritura: o.days_cpcv_to_escritura ?? null,
        days_total_listing_to_close: o.days_total_listing_to_close ?? 0,
        asking_price_eur_cents: asking,
        final_price_eur_cents: final_,
        discount_from_asking_pct: discountPct,
        bid_count: o.bid_count ?? 0,
        was_distressed: o.was_distressed ?? false,
        source: 'INTERNAL_EXECUTION' as const,
        recorded_at: o.completed_at ?? new Date().toISOString(),
      }
    })

  if (rows.length === 0) return { ingested: 0 }

  const { error: insertErr } = await (supabaseAdmin as any)
    .from('time_to_close_records')
    .upsert(rows, { onConflict: 'record_id', ignoreDuplicates: true })

  if (insertErr) {
    log.error('[timeToCloseDataset] bulk insert error', new Error(insertErr.message), { tenantId })
    throw new Error(`ingestFromExecutionOutcomes insert: ${insertErr.message}`)
  }

  log.info('[timeToCloseDataset] ingested from execution outcomes', { tenantId, count: rows.length })
  return { ingested: rows.length }
}
