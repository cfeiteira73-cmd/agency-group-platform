// =============================================================================
// Agency Group — Economic Truth Engine V2
// lib/intelligence/economicTruth.ts
//
// Phase 1: Universal Economic Truth & Normalization Core
//
// Computes the "realized economic outcome score" for every closed deal —
// a single 0-100 number that reflects how close the system's prediction
// matched reality and how efficiently the deal was executed.
//
// TRUTH MODEL (weighted sum):
//   avm_accuracy        0.25  — how well the AVM predicted final price
//   negotiation_quality 0.30  — outcome vs asking; sellers lose less, buyers gain less
//   time_to_close       0.20  — speed (faster = better)
//   routing_efficiency  0.15  — precision (how many contacts → one conversion)
//   spread_vs_predicted 0.10  — final price vs system-predicted price at routing time
//
// NORMALIZATION:
//   GlobalTruthScore = raw_score / zone_mean × 100 (capped 0-150)
//   Enables cross-region/class comparison
//
// PURE FUNCTIONS:
//   computeAvmAccuracyScore, computeNegotiationScore, computeTimeToCloseScore,
//   computeRoutingEfficiencyScore, computeSpreadVsPredictedScore,
//   computeEconomicTruthScore, normalizeEconomicScore, computeAlignmentDivergence
//
// DB FUNCTIONS:
//   persistEconomicTruth, getZoneMeanTruthScore, batchNormalizeTruth
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EconomicTruthInputs {
  property_id:             string
  deal_id?:                string
  distribution_event_id?:  string
  zone_key:                string
  asset_class:             string
  price_band:              string           // e.g. "500k-1m"

  asking_price:            number
  final_sale_price:        number
  avm_predicted_price:     number           // AVM at time of scoring
  system_predicted_price:  number           // model-predicted routing price

  negotiation_days:        number
  recipients_contacted:    number
  recipients_converted:    number           // number that accepted/responded positively
}

export interface EconomicTruthResult {
  property_id:             string
  zone_key:                string
  asset_class:             string
  price_band:              string

  // Component scores (0-100 each)
  avm_accuracy_score:      number
  negotiation_score:       number
  time_to_close_score:     number
  routing_efficiency_score: number
  spread_vs_predicted_score: number

  // Final
  raw_truth_score:         number           // weighted sum 0-100
  normalized_truth_score?: number           // normalized vs zone mean

  // Metadata
  avm_error_pct:           number           // |avm - final| / final × 100
  negotiation_delta_pct:   number           // (asking - final) / asking × 100
  routing_precision_pct:   number           // converted / contacted × 100
  spread_error_pct:        number           // |sys_predicted - final| / final × 100
}

export interface AlignmentDivergence {
  property_id:     string
  predicted_score: number
  realized_score:  number
  divergence:      number          // realized - predicted
  divergence_pct:  number          // (realized - predicted) / predicted × 100
  pattern:         'over_estimated' | 'under_estimated' | 'aligned'
}

export interface NormalizedTruthRecord {
  property_id:            string
  zone_key:               string
  asset_class:            string
  price_band:             string
  raw_truth_score:        number
  zone_mean_score:        number
  normalized_score:       number
  computed_at:            string
}

// ---------------------------------------------------------------------------
// PURE: AVM accuracy score (0-100)
// Lower AVM error → higher score
// ---------------------------------------------------------------------------

export function computeAvmAccuracyScore(avmErrorPct: number): number {
  const e = Math.abs(avmErrorPct)
  if (e <= 2)  return 100
  if (e <= 5)  return 90
  if (e <= 8)  return 78
  if (e <= 12) return 62
  if (e <= 18) return 46
  if (e <= 25) return 30
  return 10
}

// ---------------------------------------------------------------------------
// PURE: Negotiation quality score (0-100)
// delta = (asking - final) / asking × 100
// Positive delta = buyer got price reduction (good for buyer, normal market)
// Negative delta = final > asking (competitive bidding = excellent signal)
// ---------------------------------------------------------------------------

export function computeNegotiationScore(negotiationDeltaPct: number): number {
  const d = negotiationDeltaPct
  if (d < -5) return 100          // final > asking (overbid) — exceptional
  if (d < 0)  return 95           // tiny overbid or exact asking
  if (d <= 3) return 88           // 0-3% reduction — strong execution
  if (d <= 6) return 78           // 3-6% — normal
  if (d <= 10) return 65          // 6-10% — soft
  if (d <= 15) return 48          // 10-15% — weak
  if (d <= 25) return 30          // 15-25% — distressed
  return 15                        // > 25% — very distressed
}

// ---------------------------------------------------------------------------
// PURE: Time to close score (0-100)
// Shorter time = higher score (faster = better for all parties)
// ---------------------------------------------------------------------------

export function computeTimeToCloseScore(days: number): number {
  if (days <= 30)  return 100
  if (days <= 60)  return 90
  if (days <= 90)  return 78
  if (days <= 120) return 65
  if (days <= 150) return 52
  if (days <= 210) return 38
  return 20
}

// ---------------------------------------------------------------------------
// PURE: Routing efficiency score (0-100)
// precision = converted / contacted (higher = better targeting)
// ---------------------------------------------------------------------------

export function computeRoutingEfficiencyScore(
  recipientsContacted: number,
  recipientsConverted: number,
): number {
  if (recipientsContacted === 0) return 50          // neutral: no data
  const precision = recipientsConverted / recipientsContacted
  if (precision >= 0.5)  return 100
  if (precision >= 0.3)  return 88
  if (precision >= 0.2)  return 76
  if (precision >= 0.1)  return 62
  if (precision >= 0.05) return 46
  return 25
}

// ---------------------------------------------------------------------------
// PURE: Spread vs system-predicted score (0-100)
// How close was the routing-time system prediction to actual final price?
// ---------------------------------------------------------------------------

export function computeSpreadVsPredictedScore(spreadErrorPct: number): number {
  const e = Math.abs(spreadErrorPct)
  if (e <= 3)  return 100
  if (e <= 6)  return 88
  if (e <= 10) return 74
  if (e <= 15) return 58
  if (e <= 22) return 42
  return 22
}

// ---------------------------------------------------------------------------
// PURE: Compute full economic truth score (0-100)
// ---------------------------------------------------------------------------

export function computeEconomicTruthScore(
  inputs: EconomicTruthInputs,
): EconomicTruthResult {
  const avmErrorPct = Math.abs(
    (inputs.avm_predicted_price - inputs.final_sale_price) / inputs.final_sale_price * 100,
  )
  const negotiationDeltaPct =
    (inputs.asking_price - inputs.final_sale_price) / inputs.asking_price * 100
  const routingPrecisionPct =
    inputs.recipients_contacted > 0
      ? inputs.recipients_converted / inputs.recipients_contacted * 100
      : 50
  const spreadErrorPct = Math.abs(
    (inputs.system_predicted_price - inputs.final_sale_price) / inputs.final_sale_price * 100,
  )

  const avmScore      = computeAvmAccuracyScore(avmErrorPct)
  const negScore      = computeNegotiationScore(negotiationDeltaPct)
  const timeScore     = computeTimeToCloseScore(inputs.negotiation_days)
  const routingScore  = computeRoutingEfficiencyScore(inputs.recipients_contacted, inputs.recipients_converted)
  const spreadScore   = computeSpreadVsPredictedScore(spreadErrorPct)

  const raw = Math.round(
    avmScore      * 0.25 +
    negScore      * 0.30 +
    timeScore     * 0.20 +
    routingScore  * 0.15 +
    spreadScore   * 0.10,
  )

  return {
    property_id:               inputs.property_id,
    zone_key:                  inputs.zone_key,
    asset_class:               inputs.asset_class,
    price_band:                inputs.price_band,
    avm_accuracy_score:        avmScore,
    negotiation_score:         negScore,
    time_to_close_score:       timeScore,
    routing_efficiency_score:  routingScore,
    spread_vs_predicted_score: spreadScore,
    raw_truth_score:           Math.max(0, Math.min(100, raw)),
    avm_error_pct:             avmErrorPct,
    negotiation_delta_pct:     negotiationDeltaPct,
    routing_precision_pct:     routingPrecisionPct,
    spread_error_pct:          spreadErrorPct,
  }
}

// ---------------------------------------------------------------------------
// PURE: Normalize score vs zone mean (0-150)
// A score of 100 means exactly at zone mean.
// Scores above 100 = outperforming zone; below 100 = underperforming.
// ---------------------------------------------------------------------------

export function normalizeEconomicScore(
  rawScore: number,
  zoneMeanScore: number,
): number {
  if (zoneMeanScore === 0) return 100           // no data yet — neutral
  const normalized = (rawScore / zoneMeanScore) * 100
  return Math.round(Math.max(0, Math.min(150, normalized)))
}

// ---------------------------------------------------------------------------
// PURE: Compute alignment divergence (predicted vs realized)
// propertyId is optional — pass it when persisting; omit in pure-test contexts.
// ---------------------------------------------------------------------------

export function computeAlignmentDivergence(
  predictedScore: number,
  realizedScore:  number,
  propertyId = '',
): AlignmentDivergence {
  const divergence    = realizedScore - predictedScore
  const divergencePct = predictedScore > 0
    ? (divergence / predictedScore) * 100
    : 0
  const pattern: AlignmentDivergence['pattern'] =
    Math.abs(divergencePct) <= 10 ? 'aligned'
    : divergencePct < 0 ? 'over_estimated'
    : 'under_estimated'

  return {
    property_id:     propertyId,
    predicted_score: predictedScore,
    realized_score:  realizedScore,
    divergence:      Math.round(divergence * 100) / 100,
    divergence_pct:  Math.round(divergencePct * 100) / 100,
    pattern,
  }
}

// ---------------------------------------------------------------------------
// DB: Persist economic truth event
// ---------------------------------------------------------------------------

export async function persistEconomicTruth(
  result: EconomicTruthResult,
  dealId?: string,
  distributionEventId?: string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabaseAdmin as any)
    .from('economic_truth_events')
    .insert({
      property_id:               result.property_id,
      deal_id:                   dealId ?? null,
      distribution_event_id:     distributionEventId ?? null,
      zone_key:                  result.zone_key,
      asset_class:               result.asset_class,
      price_band:                result.price_band,
      avm_accuracy_score:        result.avm_accuracy_score,
      negotiation_score:         result.negotiation_score,
      time_to_close_score:       result.time_to_close_score,
      routing_efficiency_score:  result.routing_efficiency_score,
      spread_vs_predicted_score: result.spread_vs_predicted_score,
      raw_truth_score:           result.raw_truth_score,
      normalized_truth_score:    result.normalized_truth_score ?? null,
      avm_error_pct:             result.avm_error_pct,
      negotiation_delta_pct:     result.negotiation_delta_pct,
      routing_precision_pct:     result.routing_precision_pct,
      spread_error_pct:          result.spread_error_pct,
    })
  if (error) throw new Error(`persistEconomicTruth: ${error.message}`)
}

// ---------------------------------------------------------------------------
// DB: Get zone mean truth score (for normalization)
// ---------------------------------------------------------------------------

export async function getZoneMeanTruthScore(
  zoneKey:    string,
  assetClass: string,
): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from('economic_truth_events')
    .select('raw_truth_score')
    .eq('zone_key', zoneKey)
    .eq('asset_class', assetClass)
    .limit(200)

  if (error) return 70       // default fallback
  if (!data || data.length === 0) return 70

  const sum = data.reduce((acc: number, row: { raw_truth_score: number }) => acc + (row.raw_truth_score ?? 70), 0)
  return Math.round(sum / data.length)
}

// ---------------------------------------------------------------------------
// DB: Batch normalize truth scores for recent events
// Batches zone-mean queries (one per zone+class group) to avoid N+1 pattern.
// ---------------------------------------------------------------------------

export async function batchNormalizeTruth(limit = 100): Promise<{ normalized: number }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: events, error } = await (supabaseAdmin as any)
    .from('economic_truth_events')
    .select('id, property_id, zone_key, asset_class, raw_truth_score')
    .is('normalized_truth_score', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(`batchNormalizeTruth: ${error.message}`)
  if (!events || events.length === 0) return { normalized: 0 }

  // ── Batch zone-mean fetches: one query per unique (zone_key, asset_class) ──
  const zoneGroups = new Map<string, string[]>()
  for (const event of events) {
    const key = `${event.zone_key}::${event.asset_class}`
    if (!zoneGroups.has(key)) zoneGroups.set(key, [event.zone_key, event.asset_class])
  }

  const zoneMeanCache = new Map<string, number>()
  await Promise.all(
    Array.from(zoneGroups.values()).map(async ([zoneKey, assetClass]) => {
      const mean = await getZoneMeanTruthScore(zoneKey, assetClass)
      zoneMeanCache.set(`${zoneKey}::${assetClass}`, mean)
    }),
  )

  // ── Apply normalization and persist in one pass ──
  let normalized = 0
  for (const event of events) {
    const cacheKey = `${event.zone_key}::${event.asset_class}`
    const zoneMean = zoneMeanCache.get(cacheKey) ?? 70
    const score    = normalizeEconomicScore(event.raw_truth_score, zoneMean)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin as any)
      .from('economic_truth_events')
      .update({ normalized_truth_score: score })
      .eq('id', event.id)
    normalized++
  }
  return { normalized }
}
