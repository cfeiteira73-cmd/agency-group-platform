// =============================================================================
// Agency Group — Market Microstructure Engine
// lib/intelligence/marketMicrostructure.ts
//
// Accumulates proprietary market data: real negotiation deltas, close times,
// sale-to-ask ratios, and AVM calibration signals at the zone × type level.
//
// This is the data moat — each closed deal makes our AVM smarter.
//
// PURE FUNCTIONS:
//   computeStdDev, computePctAboveAsk
//
// DB FUNCTIONS:
//   recordDealOutcome, computePeriodMicrostructure, refreshAllMicrostructure
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DealOutcome {
  property_id:        string
  zone_key:           string
  property_type:      string
  asking_price:       number
  realized_sale_price: number
  avm_value_at_time?: number | null
  days_to_close:      number
  buyer_type?:        string | null
  opportunity_score?: number | null
}

export interface MicrostructureSnapshot {
  zone_key:                   string
  property_type:              string | null
  period_label:               string
  deal_count:                 number
  avg_sale_price:             number | null
  median_sale_price:          number | null
  avg_ask_price:              number | null
  sale_to_ask_ratio:          number | null
  avg_negotiation_delta_pct:  number | null
  negotiation_delta_std_dev:  number | null
  pct_sold_above_ask:         number | null
  median_days_to_close:       number | null
  avg_days_to_close:          number | null
  avm_mean_error_pct:         number | null
  avm_mae_pct:                number | null
  avg_opportunity_score:      number | null
  buyer_type_breakdown:       Record<string, number>
}

interface FeedbackOutcomeRow {
  zone_key:               string | null
  property_type:          string | null
  asking_price:           number | null
  realized_sale_price:    number | null
  avm_value_at_time:      number | null
  realized_dom:           number | null
  negotiation_delta_pct:  number | null
  buyer_type:             string | null
  opportunity_score:      number | null
}

// ---------------------------------------------------------------------------
// PURE: Compute standard deviation
// ---------------------------------------------------------------------------

export function computeStdDev(values: number[]): number | null {
  if (values.length < 2) return null
  const mean = values.reduce((s, v) => s + v, 0) / values.length
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1)
  return parseFloat(Math.sqrt(variance).toFixed(3))
}

// ---------------------------------------------------------------------------
// PURE: Compute median
// ---------------------------------------------------------------------------

export function computeMedian(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? parseFloat(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(2))
    : parseFloat(sorted[mid].toFixed(2))
}

// ---------------------------------------------------------------------------
// PURE: Compute % of deals sold above ask
// ---------------------------------------------------------------------------

export function computePctAboveAsk(negotiationDeltas: number[]): number | null {
  if (negotiationDeltas.length === 0) return null
  const aboveAsk = negotiationDeltas.filter(d => d > 0).length
  return parseFloat(((aboveAsk / negotiationDeltas.length) * 100).toFixed(2))
}

// ---------------------------------------------------------------------------
// PURE: Build microstructure snapshot from raw rows
// ---------------------------------------------------------------------------

export function buildMicrostructureSnapshot(
  rows:          FeedbackOutcomeRow[],
  zoneKey:       string,
  propertyType:  string | null,
  periodLabel:   string,
): MicrostructureSnapshot {
  const salePrices   = rows.map(r => r.realized_sale_price).filter((v): v is number => v != null)
  const askPrices    = rows.map(r => r.asking_price).filter((v): v is number => v != null)
  const deltas       = rows.map(r => r.negotiation_delta_pct).filter((v): v is number => v != null)
  const domValues    = rows.map(r => r.realized_dom).filter((v): v is number => v != null)
  const avmErrors    = rows
    .filter(r => r.avm_value_at_time != null && r.realized_sale_price != null && r.avm_value_at_time > 0)
    .map(r => ((r.realized_sale_price! - r.avm_value_at_time!) / r.avm_value_at_time!) * 100)
  const oppScores    = rows.map(r => r.opportunity_score).filter((v): v is number => v != null)

  // Sale-to-ask ratio
  const saleToAskValues = rows
    .filter(r => r.asking_price != null && r.realized_sale_price != null && r.asking_price > 0)
    .map(r => r.realized_sale_price! / r.asking_price!)
  const saleToAskRatio = saleToAskValues.length > 0
    ? parseFloat((saleToAskValues.reduce((s, v) => s + v, 0) / saleToAskValues.length).toFixed(4))
    : null

  // AVM error stats
  const avmMeanError = avmErrors.length > 0
    ? parseFloat((avmErrors.reduce((s, v) => s + v, 0) / avmErrors.length).toFixed(3))
    : null
  const avmMaeValues = avmErrors.map(v => Math.abs(v))
  const avmMae = avmMaeValues.length > 0
    ? parseFloat((avmMaeValues.reduce((s, v) => s + v, 0) / avmMaeValues.length).toFixed(3))
    : null

  // Buyer type breakdown
  const buyerTypeBreakdown: Record<string, number> = {}
  for (const r of rows) {
    if (r.buyer_type) buyerTypeBreakdown[r.buyer_type] = (buyerTypeBreakdown[r.buyer_type] ?? 0) + 1
  }

  return {
    zone_key:                   zoneKey,
    property_type:              propertyType,
    period_label:               periodLabel,
    deal_count:                 rows.length,
    avg_sale_price:             salePrices.length > 0
      ? parseFloat((salePrices.reduce((s, v) => s + v, 0) / salePrices.length).toFixed(2))
      : null,
    median_sale_price:          computeMedian(salePrices),
    avg_ask_price:              askPrices.length > 0
      ? parseFloat((askPrices.reduce((s, v) => s + v, 0) / askPrices.length).toFixed(2))
      : null,
    sale_to_ask_ratio:          saleToAskRatio,
    avg_negotiation_delta_pct:  deltas.length > 0
      ? parseFloat((deltas.reduce((s, v) => s + v, 0) / deltas.length).toFixed(3))
      : null,
    negotiation_delta_std_dev:  computeStdDev(deltas),
    pct_sold_above_ask:         computePctAboveAsk(deltas),
    median_days_to_close:       computeMedian(domValues),
    avg_days_to_close:          domValues.length > 0
      ? parseFloat((domValues.reduce((s, v) => s + v, 0) / domValues.length).toFixed(1))
      : null,
    avm_mean_error_pct:         avmMeanError,
    avm_mae_pct:                avmMae,
    avg_opportunity_score:      oppScores.length > 0
      ? parseFloat((oppScores.reduce((s, v) => s + v, 0) / oppScores.length).toFixed(2))
      : null,
    buyer_type_breakdown:       buyerTypeBreakdown,
  }
}

// ---------------------------------------------------------------------------
// DB: Record a single deal outcome (call on every close event)
// ---------------------------------------------------------------------------

export async function recordDealOutcome(outcome: DealOutcome): Promise<void> {
  const negDelta = outcome.asking_price > 0
    ? ((outcome.realized_sale_price - outcome.asking_price) / outcome.asking_price) * 100
    : null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabaseAdmin as any)
    .from('scoring_feedback_events')
    .update({
      close_status:           'won',
      asking_price:           outcome.asking_price,
      realized_sale_price:    outcome.realized_sale_price,
      avm_value_at_time:      outcome.avm_value_at_time ?? null,
      realized_dom:           outcome.days_to_close,
      negotiation_delta_pct:  negDelta != null ? parseFloat(negDelta.toFixed(3)) : null,
      buyer_type:             outcome.buyer_type ?? null,
      deal_won:               true,
    })
    .eq('property_id', outcome.property_id)
    .is('close_status', null)   // only update un-closed records

  if (error) throw new Error(`recordDealOutcome: ${error.message}`)
}

// ---------------------------------------------------------------------------
// DB: Compute and persist microstructure for a zone/type/period
// ---------------------------------------------------------------------------

export async function computePeriodMicrostructure(
  zoneKey:      string,
  periodDays:   number,
  propertyType: string | null = null,
): Promise<MicrostructureSnapshot> {
  const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000)
  const periodLabel = `rolling-${periodDays}d`

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabaseAdmin as any)
    .from('scoring_feedback_events')
    .select([
      'zone_key', 'property_type', 'asking_price', 'realized_sale_price',
      'avm_value_at_time', 'realized_dom', 'negotiation_delta_pct',
      'buyer_type', 'opportunity_score',
    ].join(','))
    .eq('close_status', 'won')
    .eq('zone_key', zoneKey)
    .gte('surfaced_at', since.toISOString())

  if (propertyType) query = query.eq('property_type', propertyType)

  const { data, error } = await query
  if (error) throw new Error(`computePeriodMicrostructure: ${error.message}`)

  const rows: FeedbackOutcomeRow[] = data ?? []
  const snapshot = buildMicrostructureSnapshot(rows, zoneKey, propertyType, periodLabel)

  // Persist
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: upsertError } = await (supabaseAdmin as any)
    .from('market_microstructure')
    .upsert({
      zone_key:                   snapshot.zone_key,
      property_type:              snapshot.property_type,
      period_label:               snapshot.period_label,
      deal_count:                 snapshot.deal_count,
      avg_sale_price:             snapshot.avg_sale_price,
      median_sale_price:          snapshot.median_sale_price,
      avg_ask_price:              snapshot.avg_ask_price,
      sale_to_ask_ratio:          snapshot.sale_to_ask_ratio,
      avg_negotiation_delta_pct:  snapshot.avg_negotiation_delta_pct,
      negotiation_delta_std_dev:  snapshot.negotiation_delta_std_dev,
      pct_sold_above_ask:         snapshot.pct_sold_above_ask,
      median_days_to_close:       snapshot.median_days_to_close,
      avg_days_to_close:          snapshot.avg_days_to_close,
      avm_mean_error_pct:         snapshot.avm_mean_error_pct,
      avm_mae_pct:                snapshot.avm_mae_pct,
      avg_opportunity_score:      snapshot.avg_opportunity_score,
      buyer_type_breakdown:       snapshot.buyer_type_breakdown,
      computed_at:                new Date().toISOString(),
    }, { onConflict: 'zone_key, property_type, period_label' })

  if (upsertError) throw new Error(`persistMicrostructure: ${upsertError.message}`)

  return snapshot
}

// ---------------------------------------------------------------------------
// DB: Refresh all zone × type × period combinations
// ---------------------------------------------------------------------------

export async function refreshAllMicrostructure(
  periodDays = 90,
): Promise<{ computed: number; errors: string[] }> {
  // Get all distinct zone_key × property_type combos from closed deals
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from('scoring_feedback_events')
    .select('zone_key, property_type')
    .eq('close_status', 'won')
    .not('zone_key', 'is', null)

  if (error) return { computed: 0, errors: [error.message] }

  // Collect unique combos
  const combos = new Map<string, { zone: string; type: string | null }>()
  for (const row of (data ?? [])) {
    const zoneOnly = `${row.zone_key}:null`
    const withType = `${row.zone_key}:${row.property_type}`

    if (!combos.has(zoneOnly))  combos.set(zoneOnly,  { zone: row.zone_key, type: null })
    if (row.property_type && !combos.has(withType)) {
      combos.set(withType, { zone: row.zone_key, type: row.property_type })
    }
  }

  let computed = 0
  const errors: string[] = []

  for (const { zone, type } of combos.values()) {
    try {
      await computePeriodMicrostructure(zone, periodDays, type)
      computed++
    } catch (err) {
      errors.push(`${zone}/${type ?? 'all'}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return { computed, errors }
}
