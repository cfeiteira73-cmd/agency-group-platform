// =============================================================================
// Agency Group — Market Segment Trends
// lib/intelligence/marketSegments.ts
//
// Phase 1: Proprietary Market Data Moat Completion
//
// Extends marketMicrostructure.ts with:
//   - Multi-period snapshots: 7d / 30d / 90d simultaneously
//   - Price band segmentation (under_200k → over_3m)
//   - Confidence bands (mean ± 1.5σ)
//   - Regime shift detection (statistical anomaly on metric change)
//   - Aggregated views for executive dashboards
//
// PURE FUNCTIONS:
//   classifyPriceBand, computeConfidenceBand, computeTrendDirection,
//   detectRegimeShift, buildSegmentSnapshot
//
// DB FUNCTIONS:
//   persistSegmentSnapshot, refreshSegmentTrends, getSegmentTrends,
//   getRegimeShiftAlerts, batchRefreshAllSegments
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PriceBand = 'under_200k' | '200k_500k' | '500k_1m' | '1m_3m' | 'over_3m' | 'all'
export type PeriodLabel = '7d' | '30d' | '90d'
export type PriceTrend = 'rising' | 'falling' | 'stable' | 'unknown'

export interface ConfidenceBand {
  mean:  number
  low:   number    // mean - 1.5σ
  high:  number    // mean + 1.5σ
  sigma: number
}

export interface RegimeShiftResult {
  detected:         boolean
  metric?:          string
  magnitude?:       number    // absolute % change
  description?:     string
}

export interface SegmentSnapshotInput {
  dealPrices:          number[]       // final sale prices
  pricesPerSqm:        number[]
  negotiationDeltas:   number[]       // % delta from ask
  saleToAskRatios:     number[]
  daysToClose:         number[]
  avmErrors:           number[]       // % AVM overestimate
  investorDealCount:   number
  agentDealCount:      number
}

export interface SegmentSnapshot {
  zone_key:               string
  property_type:          string
  price_band:             PriceBand
  period_label:           PeriodLabel
  avg_price_per_sqm:      number | null
  median_price_per_sqm:   number | null
  price_confidence_low:   number | null
  price_confidence_high:  number | null
  price_trend:            PriceTrend
  avg_negotiation_delta:  number | null
  median_negotiation_delta: number | null
  pct_sold_above_ask:     number | null
  avg_sale_to_ask_ratio:  number | null
  avg_days_to_close:      number | null
  median_days_to_close:   number | null
  deal_count:             number
  avg_avm_error_pct:      number | null
  avm_mae:                number | null
  investor_deal_pct:      number | null
  agent_deal_pct:         number | null
  confidence_score:       number
  sample_size:            number
  regime_shift_detected:  boolean
  regime_shift_metric:    string | null
  regime_shift_magnitude: number | null
}

export interface SegmentTrendRow extends SegmentSnapshot {
  id:          string
  snapshot_date: string
  computed_at:   string
}

// ---------------------------------------------------------------------------
// PURE: Classify a sale price into a band
// ---------------------------------------------------------------------------

export function classifyPriceBand(priceEur: number): PriceBand {
  if (priceEur < 200_000)   return 'under_200k'
  if (priceEur < 500_000)   return '200k_500k'
  if (priceEur < 1_000_000) return '500k_1m'
  if (priceEur < 3_000_000) return '1m_3m'
  return 'over_3m'
}

// ---------------------------------------------------------------------------
// PURE: Compute mean and ±1.5σ confidence band
// ---------------------------------------------------------------------------

export function computeConfidenceBand(values: number[]): ConfidenceBand {
  if (values.length === 0) return { mean: 0, low: 0, high: 0, sigma: 0 }
  const mean  = values.reduce((s, v) => s + v, 0) / values.length
  const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length
  const sigma = Math.sqrt(variance)
  return {
    mean:  round2(mean),
    low:   round2(mean - 1.5 * sigma),
    high:  round2(mean + 1.5 * sigma),
    sigma: round2(sigma),
  }
}

// ---------------------------------------------------------------------------
// PURE: Compute median of a numeric array
// ---------------------------------------------------------------------------

export function computeMedian(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid    = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : round2((sorted[mid - 1] + sorted[mid]) / 2)
}

// ---------------------------------------------------------------------------
// PURE: Detect regime shift — price move > threshold vs prior period
//
// threshold: fractional absolute change (default 0.08 = 8%)
// ---------------------------------------------------------------------------

export function detectRegimeShift(
  currentValue:  number,
  priorValue:    number,
  metricName:    string,
  threshold      = 0.08,
): RegimeShiftResult {
  if (priorValue === 0) return { detected: false }
  const magnitude = Math.abs((currentValue - priorValue) / priorValue)
  if (magnitude >= threshold) {
    return {
      detected:    true,
      metric:      metricName,
      magnitude:   round2(magnitude * 100),
      description: `${metricName} shifted ${magnitude > 0 ? '+' : ''}${round2((currentValue - priorValue) / priorValue * 100)}% vs prior period`,
    }
  }
  return { detected: false }
}

// ---------------------------------------------------------------------------
// PURE: Determine price trend direction
// ---------------------------------------------------------------------------

export function computeTrendDirection(
  shortTermAvg: number | null,
  longTermAvg:  number | null,
): PriceTrend {
  if (!shortTermAvg || !longTermAvg || longTermAvg === 0) return 'unknown'
  const delta = (shortTermAvg - longTermAvg) / longTermAvg
  if (delta >  0.03) return 'rising'
  if (delta < -0.03) return 'falling'
  return 'stable'
}

// ---------------------------------------------------------------------------
// PURE: Compute confidence score (0-100) based on sample size + data completeness
// ---------------------------------------------------------------------------

export function computeSegmentConfidence(
  sampleSize:        number,
  hasNegotiationData: boolean,
  hasAvmData:        boolean,
): number {
  // Base: sample size component (full confidence at 30+ deals)
  const sampleScore = Math.min(60, sampleSize * 2)
  const negScore    = hasNegotiationData ? 25 : 0
  const avmScore    = hasAvmData ? 15 : 0
  return Math.min(100, sampleScore + negScore + avmScore)
}

// ---------------------------------------------------------------------------
// PURE: Build a full segment snapshot from raw deal arrays
// ---------------------------------------------------------------------------

export function buildSegmentSnapshot(
  zone_key:      string,
  property_type: string,
  price_band:    PriceBand,
  period_label:  PeriodLabel,
  input:         SegmentSnapshotInput,
  priorAvgPrice?: number,   // for regime shift detection
): SegmentSnapshot {
  const { pricesPerSqm, negotiationDeltas, saleToAskRatios, daysToClose, avmErrors } = input
  const totalDeals = input.investorDealCount + input.agentDealCount

  const priceBand     = computeConfidenceBand(pricesPerSqm)
  const negBand       = computeConfidenceBand(negotiationDeltas)
  const pctAboveAsk   = negotiationDeltas.length > 0
    ? round2(negotiationDeltas.filter(d => d > 0).length / negotiationDeltas.length * 100)
    : null
  const avgSaleToAsk  = saleToAskRatios.length > 0
    ? round2(saleToAskRatios.reduce((s, v) => s + v, 0) / saleToAskRatios.length)
    : null
  const avgDaysClose  = daysToClose.length > 0
    ? round2(daysToClose.reduce((s, v) => s + v, 0) / daysToClose.length)
    : null
  const avgAvmError   = avmErrors.length > 0
    ? round2(avmErrors.reduce((s, v) => s + v, 0) / avmErrors.length)
    : null
  const avmMae        = avmErrors.length > 0
    ? round2(avmErrors.reduce((s, v) => s + Math.abs(v), 0) / avmErrors.length)
    : null

  // Regime shift: compare current avg price vs prior period
  let regimeShift: RegimeShiftResult = { detected: false }
  if (priorAvgPrice != null && priceBand.mean > 0) {
    regimeShift = detectRegimeShift(priceBand.mean, priorAvgPrice, 'avg_price_per_sqm')
  }

  const confidence = computeSegmentConfidence(
    pricesPerSqm.length,
    negotiationDeltas.length > 0,
    avmErrors.length > 0,
  )

  return {
    zone_key,
    property_type,
    price_band,
    period_label,
    avg_price_per_sqm:       pricesPerSqm.length > 0 ? priceBand.mean : null,
    median_price_per_sqm:    computeMedian(pricesPerSqm),
    price_confidence_low:    pricesPerSqm.length >= 3 ? priceBand.low  : null,
    price_confidence_high:   pricesPerSqm.length >= 3 ? priceBand.high : null,
    price_trend:             computeTrendDirection(priceBand.mean || null, priorAvgPrice ?? null),
    avg_negotiation_delta:   negotiationDeltas.length > 0 ? negBand.mean : null,
    median_negotiation_delta: computeMedian(negotiationDeltas),
    pct_sold_above_ask:      pctAboveAsk,
    avg_sale_to_ask_ratio:   avgSaleToAsk,
    avg_days_to_close:       avgDaysClose,
    median_days_to_close:    computeMedian(daysToClose),
    deal_count:              totalDeals,
    avg_avm_error_pct:       avgAvmError,
    avm_mae:                 avmMae,
    investor_deal_pct:       totalDeals > 0 ? round2(input.investorDealCount / totalDeals * 100) : null,
    agent_deal_pct:          totalDeals > 0 ? round2(input.agentDealCount    / totalDeals * 100) : null,
    confidence_score:        confidence,
    sample_size:             pricesPerSqm.length,
    regime_shift_detected:   regimeShift.detected,
    regime_shift_metric:     regimeShift.metric    ?? null,
    regime_shift_magnitude:  regimeShift.magnitude ?? null,
  }
}

// ---------------------------------------------------------------------------
// DB: Persist a segment snapshot (upsert)
// ---------------------------------------------------------------------------

export async function persistSegmentSnapshot(snapshot: SegmentSnapshot): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabaseAdmin as any)
    .from('market_segment_trends')
    .upsert({
      ...snapshot,
      snapshot_date: new Date().toISOString().split('T')[0],
      computed_at:   new Date().toISOString(),
    }, { onConflict: 'zone_key,property_type,price_band,period_label,snapshot_date' })

  if (error) throw new Error(`persistSegmentSnapshot: ${error.message}`)
}

// ---------------------------------------------------------------------------
// DB: Compute and persist multi-period snapshots for one segment
//
// Reads from transaction_outcomes + scoring_feedback_events
// Runs all three periods (7d / 30d / 90d) in parallel
// ---------------------------------------------------------------------------

export async function refreshSegmentTrends(
  zone_key:      string,
  property_type: string,
): Promise<void> {
  const periods: PeriodLabel[] = ['7d', '30d', '90d']
  const periodDays = { '7d': 7, '30d': 30, '90d': 90 }

  await Promise.all(periods.map(async (period) => {
    const days = periodDays[period]
    const since = new Date(Date.now() - days * 86400_000).toISOString()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: outcomes } = await (supabaseAdmin as any)
      .from('transaction_outcomes')
      .select(`
        final_sale_price, asking_price,
        negotiation_delta_pct, avm_error_pct,
        agent_email, distribution_event_id
      `)
      .eq('outcome_type', 'won')
      .gte('closed_at', since)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: feedback } = await (supabaseAdmin as any)
      .from('scoring_feedback_events')
      .select('price_per_sqm, days_on_market, zone_key, property_type, buyer_type')
      .eq('zone_key', zone_key)
      .eq('property_type', property_type)
      .gte('created_at', since)

    if (!feedback?.length && !outcomes?.length) return

    const rows         = feedback ?? []
    const pricesPerSqm = rows.map((r: { price_per_sqm: number }) => r.price_per_sqm).filter(Boolean)
    const daysToClose  = rows.map((r: { days_on_market: number }) => r.days_on_market).filter(Boolean)

    const outcomeRows        = outcomes ?? []
    const negotiationDeltas  = outcomeRows.map((r: { negotiation_delta_pct: number | null }) => r.negotiation_delta_pct).filter((v: number | null) => v != null) as number[]
    const saleToAskRatios    = outcomeRows
      .filter((r: { asking_price: number | null; final_sale_price: number | null }) => r.asking_price && r.asking_price > 0)
      .map((r: { final_sale_price: number; asking_price: number }) => r.final_sale_price / r.asking_price)
    const avmErrors          = outcomeRows.map((r: { avm_error_pct: number | null }) => r.avm_error_pct).filter((v: number | null) => v != null) as number[]

    // Investor vs agent from buyer_type field
    const investorCount = rows.filter((r: { buyer_type: string }) => r.buyer_type === 'investor').length
    const agentCount    = rows.filter((r: { buyer_type: string }) => r.buyer_type !== 'investor').length

    // Get prior period avg for regime shift comparison
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: prior } = await (supabaseAdmin as any)
      .from('market_segment_trends')
      .select('avg_price_per_sqm')
      .eq('zone_key', zone_key)
      .eq('property_type', property_type)
      .eq('price_band', 'all')
      .eq('period_label', period)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .single()

    const priorAvg = prior?.avg_price_per_sqm ?? undefined

    const snapshot = buildSegmentSnapshot(
      zone_key, property_type, 'all', period,
      { dealPrices: [], pricesPerSqm, negotiationDeltas, saleToAskRatios, daysToClose, avmErrors, investorDealCount: investorCount, agentDealCount: agentCount },
      priorAvg,
    )

    await persistSegmentSnapshot(snapshot)
  }))
}

// ---------------------------------------------------------------------------
// DB: Batch refresh all zone × type combinations
// ---------------------------------------------------------------------------

export async function batchRefreshAllSegments(): Promise<{
  refreshed: number
  errors:    number
}> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: segments } = await (supabaseAdmin as any)
    .from('scoring_feedback_events')
    .select('zone_key, property_type')
    .not('zone_key', 'is', null)
    .not('property_type', 'is', null)

  if (!segments?.length) return { refreshed: 0, errors: 0 }

  const unique = Array.from(
    new Set(segments.map((r: { zone_key: string; property_type: string }) => `${r.zone_key}|${r.property_type}`))
  ).map((key: unknown) => {
    const [zone_key, property_type] = (key as string).split('|')
    return { zone_key, property_type }
  })

  let refreshed = 0
  let errors    = 0
  for (const seg of unique) {
    try {
      await refreshSegmentTrends(seg.zone_key, seg.property_type)
      refreshed++
    } catch {
      errors++
    }
  }
  return { refreshed, errors }
}

// ---------------------------------------------------------------------------
// DB: Query segment trends
// ---------------------------------------------------------------------------

export async function getSegmentTrends(opts: {
  zoneKey?:      string
  propertyType?: string
  priceBand?:    PriceBand
  periodLabel?:  PeriodLabel
  limit?:        number
} = {}): Promise<SegmentTrendRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabaseAdmin as any)
    .from('market_segment_trends')
    .select('*')
    .order('snapshot_date', { ascending: false })
    .order('computed_at', { ascending: false })
    .limit(opts.limit ?? 100)

  if (opts.zoneKey)      query = query.eq('zone_key', opts.zoneKey)
  if (opts.propertyType) query = query.eq('property_type', opts.propertyType)
  if (opts.priceBand)    query = query.eq('price_band', opts.priceBand)
  if (opts.periodLabel)  query = query.eq('period_label', opts.periodLabel)

  const { data, error } = await query
  if (error) throw new Error(`getSegmentTrends: ${error.message}`)
  return (data ?? []) as SegmentTrendRow[]
}

// ---------------------------------------------------------------------------
// DB: Get current regime shift alerts
// ---------------------------------------------------------------------------

export async function getRegimeShiftAlerts(): Promise<SegmentTrendRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from('market_segment_trends')
    .select('*')
    .eq('regime_shift_detected', true)
    .gte('snapshot_date', new Date(Date.now() - 7 * 86400_000).toISOString().split('T')[0])
    .order('regime_shift_magnitude', { ascending: false })
    .limit(50)

  if (error) throw new Error(`getRegimeShiftAlerts: ${error.message}`)
  return (data ?? []) as SegmentTrendRow[]
}

// ---------------------------------------------------------------------------
// Internal utility
// ---------------------------------------------------------------------------

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
