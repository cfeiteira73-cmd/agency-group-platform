// Agency Group — Discount vs Listing Price Engine
// lib/proprietary-data/discountVsListingEngine.ts
// Real discount vs listing price — the true price discovery dataset.
// TypeScript strict — 0 errors

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DiscountDataPoint {
  data_id: string
  tenant_id: string
  market: string
  city: string
  property_type: string
  asking_price_eur_cents: number
  final_price_eur_cents: number
  discount_pct: number            // can be negative (premium)
  days_on_market: number
  was_distressed: boolean
  bid_count: number
  price_band: string
  source: string
  recorded_at: string
}

export interface DiscountProfile {
  market: string
  property_type: string
  sample_count: number
  avg_discount_pct: number
  median_discount_pct: number
  p75_discount_pct: number        // 75% of deals close at this discount or better
  max_discount_pct: number
  distressed_avg_discount_pct: number | null
  days_on_market_vs_discount_correlation: number | null  // avg discount for >90d vs <30d
  generated_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeMedian(sorted: number[]): number {
  if (sorted.length === 0) return 0
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid]
  return (sorted[mid - 1] + sorted[mid]) / 2
}

function computePercentile(sorted: number[], pct: number): number {
  if (sorted.length === 0) return 0
  const idx = (pct / 100) * (sorted.length - 1)
  const lower = Math.floor(idx)
  const upper = Math.ceil(idx)
  if (lower === upper) return sorted[lower]
  return sorted[lower] * (1 - (idx - lower)) + sorted[upper] * (idx - lower)
}

// ─── recordDiscountDataPoint ──────────────────────────────────────────────────

/**
 * Persists a discount data point to `discount_data_points`.
 * Source tagged per data origin.
 */
export async function recordDiscountDataPoint(
  dataPoint: Omit<DiscountDataPoint, 'data_id'>,
  tenantId: string,
): Promise<void> {
  const data_id = randomUUID()

  const row = {
    data_id,
    tenant_id: tenantId,
    market: dataPoint.market,
    city: dataPoint.city,
    property_type: dataPoint.property_type,
    asking_price_eur_cents: dataPoint.asking_price_eur_cents,
    final_price_eur_cents: dataPoint.final_price_eur_cents,
    discount_pct: dataPoint.discount_pct,
    days_on_market: dataPoint.days_on_market,
    was_distressed: dataPoint.was_distressed,
    bid_count: dataPoint.bid_count,
    price_band: dataPoint.price_band,
    source: dataPoint.source,
    recorded_at: dataPoint.recorded_at,
  }

  const { error } = await (supabaseAdmin as any)
    .from('discount_data_points')
    .insert(row)

  if (error) {
    log.error('[discountVsListingEngine] insert failed', new Error(error.message), { data_id })
    throw new Error(`recordDiscountDataPoint: ${error.message}`)
  }

  log.info('[discountVsListingEngine] recorded', { data_id, market: dataPoint.market, discount_pct: dataPoint.discount_pct })
}

// ─── computeDiscountProfile ───────────────────────────────────────────────────

/**
 * Aggregates discount data by market+property_type, computes profiles.
 * Correlation: avg discount for assets with days_on_market > 90 vs < 30.
 */
export async function computeDiscountProfile(
  market: string,
  propertyType?: string,
  tenantId?: string,
): Promise<DiscountProfile[]> {
  let query = (supabaseAdmin as any)
    .from('discount_data_points')
    .select('property_type, discount_pct, days_on_market, was_distressed, tenant_id')
    .eq('market', market)

  if (propertyType) query = query.eq('property_type', propertyType)
  if (tenantId) query = query.eq('tenant_id', tenantId)

  const { data, error } = await query
  if (error) {
    log.error('[discountVsListingEngine] fetch error', new Error(error.message), { market })
    throw new Error(`computeDiscountProfile: ${error.message}`)
  }

  type RawRow = {
    property_type: string
    discount_pct: number
    days_on_market: number
    was_distressed: boolean
    tenant_id: string
  }

  const rows: RawRow[] = data ?? []
  if (rows.length === 0) return []

  // Group by property_type
  const groups = new Map<string, RawRow[]>()
  for (const row of rows) {
    const group = groups.get(row.property_type)
    if (group) {
      group.push(row)
    } else {
      groups.set(row.property_type, [row])
    }
  }

  const profiles: DiscountProfile[] = []
  const generatedAt = new Date().toISOString()

  for (const [pt, ptRows] of groups) {
    const discounts = ptRows.map((r: RawRow) => r.discount_pct).sort((a: number, b: number) => a - b)

    const avg = discounts.reduce((s: number, d: number) => s + d, 0) / discounts.length
    const median = computeMedian(discounts)
    const p75 = computePercentile(discounts, 75)
    const max = discounts[discounts.length - 1]

    // Distressed average (observed subset)
    const distressedDiscounts = ptRows
      .filter((r: RawRow) => r.was_distressed)
      .map((r: RawRow) => r.discount_pct)

    const distressedAvg = distressedDiscounts.length > 0
      ? distressedDiscounts.reduce((s: number, d: number) => s + d, 0) / distressedDiscounts.length
      : null

    // Correlation proxy: avg discount for >90 days vs <30 days
    const over90 = ptRows.filter((r: RawRow) => r.days_on_market > 90).map((r: RawRow) => r.discount_pct)
    const under30 = ptRows.filter((r: RawRow) => r.days_on_market < 30).map((r: RawRow) => r.discount_pct)

    let correlation: number | null = null
    if (over90.length > 0 && under30.length > 0) {
      const avgOver = over90.reduce((s: number, d: number) => s + d, 0) / over90.length
      const avgUnder = under30.reduce((s: number, d: number) => s + d, 0) / under30.length
      correlation = avgOver - avgUnder
    }

    profiles.push({
      market,
      property_type: pt,
      sample_count: discounts.length,
      avg_discount_pct: avg,
      median_discount_pct: median,
      p75_discount_pct: p75,
      max_discount_pct: max,
      distressed_avg_discount_pct: distressedAvg,
      days_on_market_vs_discount_correlation: correlation,
      generated_at: generatedAt,
    })
  }

  log.info('[discountVsListingEngine] profiles computed', { market, profiles: profiles.length })
  return profiles
}

// ─── getExpectedDiscount ──────────────────────────────────────────────────────

/**
 * Returns expected discount % and confidence for a given asset context.
 * Adjusts for days_on_market and distressed status.
 * Source: inferred from profile dataset.
 */
export async function getExpectedDiscount(
  market: string,
  propertyType: string,
  daysOnMarket: number,
  isDistressed: boolean,
  tenantId: string,
): Promise<{ expected_discount_pct: number; confidence: number }> {
  const profiles = await computeDiscountProfile(market, propertyType, tenantId)

  if (profiles.length === 0) {
    // Fallback market-wide profile
    const marketProfiles = await computeDiscountProfile(market, undefined, tenantId)
    if (marketProfiles.length === 0) {
      return { expected_discount_pct: 5.0, confidence: 0.1 }
    }
    const avg = marketProfiles.reduce((s: number, p: DiscountProfile) => s + p.avg_discount_pct, 0) / marketProfiles.length
    return { expected_discount_pct: avg, confidence: 0.2 }
  }

  const profile = profiles[0]
  let expected = profile.avg_discount_pct

  // Adjust for time on market: more days → higher expected discount
  if (daysOnMarket > 90) {
    const correlation = profile.days_on_market_vs_discount_correlation ?? 0
    // Add proportional adjustment (inferred)
    expected += Math.max(0, correlation * 0.5)
  } else if (daysOnMarket < 14) {
    expected = Math.max(0, expected - 1.5) // fresh listings command premium
  }

  // Distressed premium
  if (isDistressed && profile.distressed_avg_discount_pct !== null) {
    expected = profile.distressed_avg_discount_pct + 2.0 // conservative distress buffer
  }

  // Confidence based on sample size
  const confidence = Math.min(0.95, profile.sample_count / 100)

  return { expected_discount_pct: expected, confidence }
}

// ─── ingestFromRealOutcomes ───────────────────────────────────────────────────

/**
 * Reads `real_outcomes` + `feedback_signals` (DEAL_CLOSED) and maps to DiscountDataPoint.
 * Source: INTERNAL_EXECUTION (observed data).
 */
export async function ingestFromRealOutcomes(
  tenantId: string,
): Promise<{ ingested: number }> {
  // Read real_outcomes
  const { data: realOutcomes, error: roErr } = await (supabaseAdmin as any)
    .from('real_outcomes')
    .select('*')
    .eq('tenant_id', tenantId)

  if (roErr) {
    log.warn('[discountVsListingEngine] real_outcomes fetch error', { error: roErr.message })
  }

  // Read feedback_signals with DEAL_CLOSED type
  const { data: feedbackSignals, error: fsErr } = await (supabaseAdmin as any)
    .from('feedback_signals')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('signal_type', 'DEAL_CLOSED')

  if (fsErr) {
    log.warn('[discountVsListingEngine] feedback_signals fetch error', { error: fsErr.message })
  }

  type RealOutcome = {
    asset_id?: string
    market?: string
    city?: string
    property_type?: string
    asking_price_eur_cents?: number
    final_price_eur_cents?: number
    days_on_market?: number
    was_distressed?: boolean
    bid_count?: number
    price_band?: string
    source?: string
    closed_at?: string
    recorded_at?: string
  }

  type FeedbackSignal = {
    asset_id?: string
    market?: string
    city?: string
    property_type?: string
    asking_price?: number
    final_price?: number
    days_on_market?: number
    is_distressed?: boolean
    bid_count?: number
    price_band?: string
    recorded_at?: string
  }

  const rows: Array<Omit<DiscountDataPoint, 'data_id'> & { data_id: string }> = []

  for (const o of ((realOutcomes ?? []) as RealOutcome[])) {
    const asking = o.asking_price_eur_cents ?? 0
    const final_ = o.final_price_eur_cents ?? 0
    if (asking <= 0) continue
    const discount_pct = ((asking - final_) / asking) * 100

    rows.push({
      data_id: randomUUID(),
      tenant_id: tenantId,
      market: o.market ?? 'PT:Unknown',
      city: o.city ?? 'Unknown',
      property_type: o.property_type ?? 'residential',
      asking_price_eur_cents: asking,
      final_price_eur_cents: final_,
      discount_pct,
      days_on_market: o.days_on_market ?? 0,
      was_distressed: o.was_distressed ?? false,
      bid_count: o.bid_count ?? 0,
      price_band: o.price_band ?? 'UNKNOWN',
      source: o.source ?? 'INTERNAL_EXECUTION',
      recorded_at: o.closed_at ?? o.recorded_at ?? new Date().toISOString(),
    })
  }

  for (const s of ((feedbackSignals ?? []) as FeedbackSignal[])) {
    const asking = s.asking_price ?? 0
    const final_ = s.final_price ?? 0
    if (asking <= 0) continue
    const discount_pct = ((asking - final_) / asking) * 100

    rows.push({
      data_id: randomUUID(),
      tenant_id: tenantId,
      market: s.market ?? 'PT:Unknown',
      city: s.city ?? 'Unknown',
      property_type: s.property_type ?? 'residential',
      asking_price_eur_cents: asking,
      final_price_eur_cents: final_,
      discount_pct,
      days_on_market: s.days_on_market ?? 0,
      was_distressed: s.is_distressed ?? false,
      bid_count: s.bid_count ?? 0,
      price_band: s.price_band ?? 'UNKNOWN',
      source: 'DEAL_CLOSED_SIGNAL',
      recorded_at: s.recorded_at ?? new Date().toISOString(),
    })
  }

  if (rows.length === 0) return { ingested: 0 }

  const { error: insertErr } = await (supabaseAdmin as any)
    .from('discount_data_points')
    .upsert(rows, { onConflict: 'data_id', ignoreDuplicates: true })

  if (insertErr) {
    log.error('[discountVsListingEngine] bulk insert error', new Error(insertErr.message), { tenantId })
    throw new Error(`ingestFromRealOutcomes insert: ${insertErr.message}`)
  }

  log.info('[discountVsListingEngine] ingested', { tenantId, count: rows.length })
  return { ingested: rows.length }
}
