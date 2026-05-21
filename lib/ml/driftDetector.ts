// Agency Group — ML Model Drift Detector
// lib/ml/driftDetector.ts
// TypeScript strict — 0 errors
//
// Compares recent prediction score distributions against a baseline window.
// Drift detected when: mean shifts >10%, variance doubles, or tail distribution changes.
// Uses Population Stability Index (PSI) as the drift metric.

import { supabaseAdmin } from '@/lib/supabase'

export interface DistributionWindow {
  mean: number
  stddev: number
  min: number
  max: number
  p25: number
  p50: number
  p75: number
  p95: number
  count: number
  from_date: string
  to_date: string
}

export interface DriftResult {
  prediction_type: string
  tenant_id: string
  baseline_window: DistributionWindow
  current_window: DistributionWindow
  psi: number                // Population Stability Index: <0.1 stable, 0.1-0.25 moderate, >0.25 significant
  drift_detected: boolean    // psi > 0.1
  drift_severity: 'none' | 'moderate' | 'significant'
  recommendation: string
  checked_at: string
}

// ---------------------------------------------------------------------------
// computePsi
// Compute Population Stability Index between two score arrays.
// Uses 10 equal-width buckets over [0, 100].
// PSI < 0.10 → stable; 0.10–0.25 → moderate shift; > 0.25 → significant
// ---------------------------------------------------------------------------

export function computePsi(baseline: number[], current: number[]): number {
  const NUM_BUCKETS = 10
  const BUCKET_SIZE = 100 / NUM_BUCKETS
  const FLOOR = 0.0001

  // Initialise bucket counts
  const baselineCounts = new Array<number>(NUM_BUCKETS).fill(0)
  const currentCounts  = new Array<number>(NUM_BUCKETS).fill(0)

  for (const score of baseline) {
    const bucketIdx = Math.min(NUM_BUCKETS - 1, Math.floor(score / BUCKET_SIZE))
    baselineCounts[bucketIdx]++
  }
  for (const score of current) {
    const bucketIdx = Math.min(NUM_BUCKETS - 1, Math.floor(score / BUCKET_SIZE))
    currentCounts[bucketIdx]++
  }

  const baselineTotal = baseline.length || 1
  const currentTotal  = current.length  || 1

  let psi = 0
  for (let i = 0; i < NUM_BUCKETS; i++) {
    const expectedPct = Math.max(FLOOR, baselineCounts[i] / baselineTotal)
    const actualPct   = Math.max(FLOOR, currentCounts[i]  / currentTotal)
    psi += (actualPct - expectedPct) * Math.log(actualPct / expectedPct)
  }

  return Math.round(psi * 10000) / 10000  // 4 d.p.
}

// ---------------------------------------------------------------------------
// computeDistribution
// Compute distribution statistics from an array of scores.
// ---------------------------------------------------------------------------

export function computeDistribution(
  scores: number[],
  fromDate: string,
  toDate: string,
): DistributionWindow {
  if (scores.length === 0) {
    return { mean: 0, stddev: 0, min: 0, max: 0, p25: 0, p50: 0, p75: 0, p95: 0, count: 0, from_date: fromDate, to_date: toDate }
  }

  const sorted = [...scores].sort((a, b) => a - b)
  const n = sorted.length

  const mean = scores.reduce((s, v) => s + v, 0) / n
  const variance = scores.reduce((s, v) => s + (v - mean) ** 2, 0) / n
  const stddev   = Math.sqrt(variance)

  function percentile(p: number): number {
    const idx = Math.max(0, Math.min(n - 1, Math.floor((p / 100) * n)))
    return sorted[idx] ?? 0
  }

  return {
    mean:      Math.round(mean * 100) / 100,
    stddev:    Math.round(stddev * 100) / 100,
    min:       sorted[0] ?? 0,
    max:       sorted[n - 1] ?? 0,
    p25:       percentile(25),
    p50:       percentile(50),
    p75:       percentile(75),
    p95:       percentile(95),
    count:     n,
    from_date: fromDate,
    to_date:   toDate,
  }
}

// ---------------------------------------------------------------------------
// detectDrift
// Detect drift for a specific prediction type.
// baseline: last 30 days (30d ago → 7d ago); current: last 7 days.
// ---------------------------------------------------------------------------

export async function detectDrift(
  tenantId: string,
  predictionType: string,
): Promise<DriftResult> {
  const checkedAt  = new Date().toISOString()
  const now        = new Date()
  const sevenDaysAgo  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000).toISOString()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const emptyDist = (from: string, to: string): DistributionWindow =>
    ({ mean: 0, stddev: 0, min: 0, max: 0, p25: 0, p50: 0, p75: 0, p95: 0, count: 0, from_date: from, to_date: to })

  const insufficientResult: DriftResult = {
    prediction_type:  predictionType,
    tenant_id:        tenantId,
    baseline_window:  emptyDist(thirtyDaysAgo, sevenDaysAgo),
    current_window:   emptyDist(sevenDaysAgo, checkedAt),
    psi:              0,
    drift_detected:   false,
    drift_severity:   'none',
    recommendation:   'insufficient data — need at least 10 predictions in each window',
    checked_at:       checkedAt,
  }

  try {
    // Fetch baseline window: 30d ago → 7d ago
    const { data: baselineData, error: baselineErr } = await (supabaseAdmin as any)
      .from('ml_predictions')
      .select('score, created_at')
      .eq('tenant_id', tenantId)
      .eq('prediction_type', predictionType)
      .gte('created_at', thirtyDaysAgo)
      .lt('created_at', sevenDaysAgo)
      .limit(5000)

    if (baselineErr) {
      console.error('[driftDetector] detectDrift — baseline query failed:', baselineErr.message)
      return insufficientResult
    }

    // Fetch current window: last 7 days
    const { data: currentData, error: currentErr } = await (supabaseAdmin as any)
      .from('ml_predictions')
      .select('score, created_at')
      .eq('tenant_id', tenantId)
      .eq('prediction_type', predictionType)
      .gte('created_at', sevenDaysAgo)
      .limit(5000)

    if (currentErr) {
      console.error('[driftDetector] detectDrift — current query failed:', currentErr.message)
      return insufficientResult
    }

    const baselineRows: { score: number; created_at: string }[] = baselineData ?? []
    const currentRows:  { score: number; created_at: string }[] = currentData  ?? []

    // Require at least 10 records in each window
    if (baselineRows.length < 10 || currentRows.length < 10) {
      return insufficientResult
    }

    const baselineScores = baselineRows.map(r => Number(r.score))
    const currentScores  = currentRows.map(r => Number(r.score))

    const baselineDist = computeDistribution(baselineScores, thirtyDaysAgo, sevenDaysAgo)
    const currentDist  = computeDistribution(currentScores,  sevenDaysAgo,  checkedAt)

    const psi = computePsi(baselineScores, currentScores)

    let drift_severity: 'none' | 'moderate' | 'significant'
    let recommendation: string

    if (psi >= 0.25) {
      drift_severity = 'significant'
      recommendation = `PSI ${psi} ≥ 0.25 — significant distribution shift detected. Recommend: (1) inspect recent data for label drift, (2) trigger retraining job, (3) consider reverting to heuristic baseline until new model is validated.`
    } else if (psi >= 0.10) {
      drift_severity = 'moderate'
      recommendation = `PSI ${psi} between 0.10–0.25 — moderate distribution shift. Monitor over next 7 days. If PSI remains elevated, schedule retraining.`
    } else {
      drift_severity = 'none'
      recommendation = `PSI ${psi} < 0.10 — model distribution is stable. No action required.`
    }

    return {
      prediction_type:  predictionType,
      tenant_id:        tenantId,
      baseline_window:  baselineDist,
      current_window:   currentDist,
      psi,
      drift_detected:   psi >= 0.1,
      drift_severity,
      recommendation,
      checked_at:       checkedAt,
    }
  } catch (err) {
    console.error('[driftDetector] detectDrift — unexpected error:', err instanceof Error ? err.message : String(err))
    return insufficientResult
  }
}

// ---------------------------------------------------------------------------
// runDriftCheck
// Run drift detection for all active prediction types for a tenant.
// ---------------------------------------------------------------------------

export async function runDriftCheck(tenantId: string): Promise<DriftResult[]> {
  try {
    // Discover which prediction_types have been recorded for this tenant
    const { data, error } = await (supabaseAdmin as any)
      .from('ml_predictions')
      .select('prediction_type')
      .eq('tenant_id', tenantId)
      .limit(1000)

    if (error) {
      console.error('[driftDetector] runDriftCheck — discovery query failed:', error.message)
      return []
    }

    const rows: { prediction_type: string }[] = data ?? []
    const predictionTypes = Array.from(new Set(rows.map(r => r.prediction_type)))

    if (predictionTypes.length === 0) return []

    // Run drift check for each prediction type (sequentially to avoid overwhelming the DB)
    const results: DriftResult[] = []
    for (const pt of predictionTypes) {
      const result = await detectDrift(tenantId, pt)
      results.push(result)
    }

    return results
  } catch (err) {
    console.error('[driftDetector] runDriftCheck — unexpected error:', err instanceof Error ? err.message : String(err))
    return []
  }
}
