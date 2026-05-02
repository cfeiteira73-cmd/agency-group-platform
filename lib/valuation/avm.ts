// =============================================================================
// Agency Group — Advanced Automated Valuation Model (AVM)
// lib/valuation/avm.ts
//
// Produces a 3-point valuation (low/base/high) with confidence score for any
// Portugal residential property, combining:
//
//   1. Weighted comparable analysis (properties in same zone, similar metrics)
//   2. Zone benchmark anchoring (zones.ts pm2_trans × area_m2)
//   3. Condition & bedroom premium/discount
//   4. IQR outlier rejection (filters statistical noise from comps)
//   5. Confidence scoring (based on number and quality of comps)
//
// PURE FUNCTIONS (unit-testable, no DB):
//   computeZoneBenchmarkValue, applyConditionMultiplier, rejectOutliers,
//   weightedAverage, computeAVM
//
// DB FUNCTIONS (need Supabase, not unit-tested):
//   fetchComparables, computeAndPersistAVM
//
// OUTPUT COLUMNS (persisted to properties table):
//   avm_value_low      — lower bound (15th percentile of comps distribution)
//   avm_value_base     — best estimate (weighted average)
//   avm_value_high     — upper bound (85th percentile)
//   avm_confidence     — 0-1 confidence score
//   avm_comps_used     — number of comparables used
//   avm_computed_at    — ISO timestamp
// =============================================================================

import { getZone, resolvePropertyZone, type ZoneMarket } from '@/lib/market/zones'
import { supabaseAdmin } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Input / Output types
// ---------------------------------------------------------------------------

export interface AVMInput {
  price?:      number | null    // current asking price (informational only — NOT used in calc)
  area_m2?:    number | null
  bedrooms?:   number | null
  type?:       string | null
  condition?:  string | null
  zone?:       string | null
  zona?:       string | null
  city?:       string | null
  address?:    string | null
}

export interface AVMResult {
  value_low:       number         // lower bound €
  value_base:      number         // best estimate €
  value_high:      number         // upper bound €
  confidence:      number         // 0-1 (higher = more reliable)
  comps_used:      number         // how many comparables influenced the estimate
  method:          AVMMethod      // which method was primary
  zone_key:        string
  zone_data:       ZoneMarket
  breakdown:       AVMBreakdown   // for debugging and display
}

export type AVMMethod =
  | 'comps_weighted'     // 3+ high-quality comparables
  | 'comps_limited'      // 1-2 comparables (less reliable)
  | 'zone_benchmark'     // no comps — zone pm2_trans × area
  | 'zone_only'          // no area data — zone yield inversion

export interface AVMBreakdown {
  zone_benchmark_value:  number
  comps_values:          number[]
  comps_weights:         number[]
  outliers_rejected:     number
  condition_multiplier:  number
  bedroom_adjustment:    number
}

// ---------------------------------------------------------------------------
// Condition multipliers (same scale as scoring engine for consistency)
// ---------------------------------------------------------------------------

const CONDITION_AVM_MULT: Record<string, number> = {
  new:               1.10,   // new build premium +10%
  excellent:         1.04,
  good:              1.00,   // baseline
  needs_renovation:  0.80,   // -20% for renovation needed
  ruin:              0.55,   // -45% for ruin
}

// ---------------------------------------------------------------------------
// Bedroom adjustments relative to T2/T3 baseline (most liquid)
// ---------------------------------------------------------------------------

const BEDROOM_AVM_MULT: Record<number, number> = {
  0:  0.85,   // studio — less liquid, lower pm2
  1:  0.92,
  2:  1.00,   // baseline
  3:  1.00,
  4:  1.02,   // slight premium for 4BR
  5:  1.01,
}

// ---------------------------------------------------------------------------
// PURE: Compute zone benchmark value (no comps needed)
// ---------------------------------------------------------------------------

export function computeZoneBenchmarkValue(
  zone:    ZoneMarket,
  area_m2: number | null | undefined,
): { value: number; has_area: boolean } {
  if (area_m2 && area_m2 > 0) {
    return { value: Math.round(zone.pm2_trans * area_m2), has_area: true }
  }
  // No area: use zone median price (crude but non-zero)
  // This is just a fallback — confidence will be very low
  // Assume median 80m² apartment in the zone
  const ASSUMED_AREA = 80
  return { value: Math.round(zone.pm2_trans * ASSUMED_AREA), has_area: false }
}

// ---------------------------------------------------------------------------
// PURE: Apply condition and bedroom adjustments to a price
// ---------------------------------------------------------------------------

export function applyPropertyAdjustments(
  baseValue:  number,
  condition?: string | null,
  bedrooms?:  number | null,
): { adjusted: number; condition_mult: number; bedroom_mult: number } {
  const condition_mult = CONDITION_AVM_MULT[condition ?? 'good'] ?? 1.0
  const bedroom_mult   = BEDROOM_AVM_MULT[bedrooms ?? 2] ?? 1.0

  return {
    adjusted:      Math.round(baseValue * condition_mult * bedroom_mult),
    condition_mult,
    bedroom_mult,
  }
}

// ---------------------------------------------------------------------------
// PURE: IQR outlier rejection
// Removes values outside [Q1 - 1.5×IQR, Q3 + 1.5×IQR]
// Returns { kept, rejected }
// ---------------------------------------------------------------------------

export function rejectOutliers(values: number[]): {
  kept:     number[]
  rejected: number[]
} {
  if (values.length < 4) {
    return { kept: values, rejected: [] }
  }

  const sorted = [...values].sort((a, b) => a - b)
  const n      = sorted.length
  const q1     = sorted[Math.floor(n * 0.25)]
  const q3     = sorted[Math.floor(n * 0.75)]
  const iqr    = q3 - q1

  const lowerFence = q1 - 1.5 * iqr
  const upperFence = q3 + 1.5 * iqr

  const kept:     number[] = []
  const rejected: number[] = []

  for (const v of values) {
    if (v >= lowerFence && v <= upperFence) kept.push(v)
    else rejected.push(v)
  }

  return { kept, rejected }
}

// ---------------------------------------------------------------------------
// PURE: Weighted average with optional distance/recency weights
// ---------------------------------------------------------------------------

export function weightedAverage(values: number[], weights: number[]): number {
  if (values.length === 0) return 0
  if (values.length !== weights.length) {
    // Fallback: equal weights
    return Math.round(values.reduce((s, v) => s + v, 0) / values.length)
  }

  const totalWeight = weights.reduce((s, w) => s + w, 0)
  if (totalWeight === 0) return Math.round(values.reduce((s, v) => s + v, 0) / values.length)

  const weightedSum = values.reduce((s, v, i) => s + v * weights[i], 0)
  return Math.round(weightedSum / totalWeight)
}

// ---------------------------------------------------------------------------
// PURE: Confidence score based on comp quality and count
// ---------------------------------------------------------------------------

export function computeConfidence(
  compsUsed:    number,
  hasAreaData:  boolean,
  method:       AVMMethod,
): number {
  if (method === 'zone_only')     return 0.20  // very weak
  if (method === 'zone_benchmark' && !hasAreaData) return 0.25
  if (method === 'zone_benchmark' && hasAreaData)  return 0.40

  // Comp-based confidence
  const baseConf = method === 'comps_weighted' ? 0.60 : 0.45
  const compBonus = Math.min(0.30, compsUsed * 0.06)  // +6% per comp, max 30%
  return Math.min(0.95, baseConf + compBonus)
}

// ---------------------------------------------------------------------------
// PURE: Main AVM computation (no DB)
// Combines zone benchmark + provided comps into 3-point estimate
// ---------------------------------------------------------------------------

export function computeAVM(
  input:    AVMInput,
  zone:     ZoneMarket,
  zone_key: string,
  comps:    number[],  // comparable values in EUR (already adjusted for condition)
): AVMResult {
  const { value: zoneBenchmark, has_area: hasArea } = computeZoneBenchmarkValue(zone, input.area_m2)
  const { adjusted: adjustedBenchmark, condition_mult, bedroom_mult } = applyPropertyAdjustments(
    zoneBenchmark, input.condition, input.bedrooms,
  )

  // Reject outlier comps
  const { kept: cleanComps, rejected } = rejectOutliers(comps)

  let method:      AVMMethod
  let compsUsed:   number
  let baseValue:   number
  let compWeights: number[] = []
  let compValues:  number[] = cleanComps

  if (cleanComps.length >= 3) {
    // Primary: weighted average of comps (equal weight — could add distance/recency later)
    compWeights = cleanComps.map(() => 1)
    const compAvg = weightedAverage(cleanComps, compWeights)
    // Blend 70% comps + 30% zone benchmark
    baseValue  = Math.round(compAvg * 0.70 + adjustedBenchmark * 0.30)
    method     = 'comps_weighted'
    compsUsed  = cleanComps.length
  } else if (cleanComps.length >= 1) {
    const compAvg = weightedAverage(cleanComps, cleanComps.map(() => 1))
    baseValue  = Math.round(compAvg * 0.50 + adjustedBenchmark * 0.50)
    method     = 'comps_limited'
    compsUsed  = cleanComps.length
    compWeights = cleanComps.map(() => 1)
  } else {
    // No comps — zone benchmark only
    baseValue  = adjustedBenchmark
    method     = hasArea ? 'zone_benchmark' : 'zone_only'
    compsUsed  = 0
  }

  // 3-point range: ±10% for comps-based, ±20% for zone-only
  const spread = method === 'comps_weighted' ? 0.10
               : method === 'comps_limited'   ? 0.15
               : method === 'zone_benchmark'  ? 0.20
               : 0.30

  const confidence = computeConfidence(compsUsed, hasArea, method)

  return {
    value_low:  Math.round(baseValue * (1 - spread)),
    value_base: baseValue,
    value_high: Math.round(baseValue * (1 + spread)),
    confidence,
    comps_used: compsUsed,
    method,
    zone_key,
    zone_data:  zone,
    breakdown: {
      zone_benchmark_value: adjustedBenchmark,
      comps_values:         compValues,
      comps_weights:        compWeights,
      outliers_rejected:    rejected.length,
      condition_multiplier: condition_mult,
      bedroom_adjustment:   bedroom_mult,
    },
  }
}

// ---------------------------------------------------------------------------
// DB: Fetch comparable properties from properties table
// ---------------------------------------------------------------------------

interface CompRow {
  id:          string
  price:       number
  area_m2:     number | null
  bedrooms:    number | null
  condition:   string | null
  created_at:  string
}

async function fetchComparables(
  zone_key: string,
  area_m2:  number | null | undefined,
  bedrooms: number | null | undefined,
  exclude_id?: string,
): Promise<CompRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabaseAdmin as any)
    .from('properties')
    .select('id, price, area_m2, bedrooms, condition, created_at')
    .eq('zone_key', zone_key)
    .in('status', ['active', 'sold'])
    .order('created_at', { ascending: false })
    .limit(30)

  // Area range filter if available
  if (area_m2 && area_m2 > 0) {
    const aMin = Math.round(area_m2 * 0.70)
    const aMax = Math.round(area_m2 * 1.30)
    query = query.gte('area_m2', aMin).lte('area_m2', aMax)
  }

  // Bedroom tolerance: ±1
  if (bedrooms != null) {
    query = query
      .gte('bedrooms', Math.max(0, bedrooms - 1))
      .lte('bedrooms', bedrooms + 1)
  }

  if (exclude_id) {
    query = query.neq('id', exclude_id)
  }

  const { data } = await query
  return (data ?? []) as CompRow[]
}

// ---------------------------------------------------------------------------
// DB: Convert comp rows to EUR values (normalize area-based)
// ---------------------------------------------------------------------------

function compToValue(
  comp:     CompRow,
  input:    AVMInput,
): number | null {
  if (!comp.price || comp.price <= 0) return null

  // If we have area for both, use pm2 normalization
  if (input.area_m2 && input.area_m2 > 0 && comp.area_m2 && comp.area_m2 > 0) {
    const pm2 = comp.price / comp.area_m2
    const { adjusted } = applyPropertyAdjustments(
      pm2 * input.area_m2,
      comp.condition,
      comp.bedrooms,
    )
    // Reverse-adjust for input property's own condition to get "neutral" comp
    const inputCondMult = CONDITION_AVM_MULT[input.condition ?? 'good'] ?? 1.0
    return Math.round(adjusted / inputCondMult * inputCondMult)
  }

  // Fallback: use raw price as comp (less reliable)
  return comp.price
}

// ---------------------------------------------------------------------------
// Public: Compute AVM for a property and optionally persist to DB
// ---------------------------------------------------------------------------

export async function computePropertyAVM(
  input:      AVMInput,
  propertyId?: string,  // if provided, also upserts result to properties table
): Promise<AVMResult> {
  const zone_key = resolvePropertyZone(input)
  const zone     = getZone(zone_key)

  // Fetch comparables from DB
  const compRows = await fetchComparables(
    zone_key,
    input.area_m2,
    input.bedrooms,
    propertyId,
  )

  // Convert to EUR values
  const compValues = compRows
    .map(r => compToValue(r, input))
    .filter((v): v is number => v !== null && v > 10_000)

  // Compute AVM
  const result = computeAVM(input, zone, zone_key, compValues)

  // Persist to DB if propertyId provided
  if (propertyId) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabaseAdmin as any)
        .from('properties')
        .update({
          avm_value_low:      result.value_low,
          avm_value_base:     result.value_base,
          avm_value_high:     result.value_high,
          avm_confidence:     result.confidence,
          avm_comps_used:     result.comps_used,
          avm_computed_at:    new Date().toISOString(),
          // Also update the legacy avm_estimate column for backward compat
          avm_estimate:       result.value_base,
          updated_at:         new Date().toISOString(),
        })
        .eq('id', propertyId)
    } catch { /* non-critical — caller can retry */ }
  }

  return result
}

// ---------------------------------------------------------------------------
// Batch AVM: compute for up to N unvalued properties
// ---------------------------------------------------------------------------

export async function batchComputeAVM(
  limit = 50,
): Promise<{ computed: number; errors: string[] }> {
  // Fetch properties that need AVM (no avm_value_base OR last computed >7 days ago)
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: properties, error } = await (supabaseAdmin as any)
    .from('properties')
    .select('id, price, area_m2, bedrooms, type, condition, zone, zone_key, city, address')
    .eq('status', 'active')
    .or(`avm_value_base.is.null,avm_computed_at.lt.${since}`)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !properties) return { computed: 0, errors: [error?.message ?? 'fetch failed'] }

  let computed = 0
  const errors: string[] = []

  for (const p of properties) {
    try {
      await computePropertyAVM(
        {
          area_m2:   p.area_m2,
          bedrooms:  p.bedrooms,
          type:      p.type,
          condition: p.condition,
          zone:      p.zone,
          city:      p.city,
          address:   p.address,
        },
        p.id,
      )
      computed++
    } catch (err) {
      errors.push(`${p.id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return { computed, errors }
}
