// =============================================================================
// Agency Group — Score Drift Detector
// lib/intelligence/driftDetector.ts
//
// Detects when the scoring model is drifting from reality by comparing
// predicted outcomes (scores, yields, DOM) to realized outcomes from
// scoring_feedback_events.
//
// DRIFT DIMENSIONS:
//   avm_accuracy     — (realized_sale_price − avm_value) / avm_value
//   yield_accuracy   — realized_yield − predicted_yield
//   grade_hit_rate   — deals_won / total_surfaced by grade band
//   score_correlation — correlation between opportunity_score and deal_won
//   dom_accuracy     — realized_dom vs zone dias_mercado
//
// PURE FUNCTIONS (unit-testable, no DB):
//   analyzeFeedbackSamples, detectDrift, classifyDrift
//
// DB FUNCTIONS:
//   fetchFeedbackSamples, computeAndPersistDriftReport
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DriftLevel = 'NONE' | 'MILD' | 'SIGNIFICANT' | 'CRITICAL'

export interface FeedbackSample {
  opportunity_score:    number
  opportunity_grade:    string | null
  predicted_yield:      number | null
  realized_yield:       number | null
  avm_value_at_time:    number | null
  realized_sale_price:  number | null
  realized_dom:         number | null
  close_status:         string | null
  deal_won:             boolean
}

export interface DimensionStats {
  dimension:    string
  samples:      number
  mean_error:   number | null   // positive = over-predicted
  mae:          number | null   // mean absolute error
  std_dev:      number | null
  p90_error:    number | null   // 90th percentile absolute error
  drift_level:  DriftLevel
  note:         string
}

export interface AccuracyStats {
  total_samples:         number
  with_outcome:          number   // samples with realized values
  grade_hit_rates:       Record<string, { surfaced: number; won: number; rate: number | null }>
  avm_accuracy:          DimensionStats
  yield_accuracy:        DimensionStats
  dom_accuracy:          DimensionStats
  score_correlation:     number | null   // Pearson r between score and deal_won (0/1)
  overall_drift_level:   DriftLevel
}

export interface DriftReport {
  generated_at:        string
  period_analyzed:     { start: string; end: string; samples: number }
  overall_drift_level: DriftLevel
  dimensions:          DimensionStats[]
  grade_hit_rates:     AccuracyStats['grade_hit_rates']
  score_correlation:   number | null
  recommendations:     string[]
  has_enough_data:     boolean  // need ≥20 samples for statistical significance
}

// ---------------------------------------------------------------------------
// PURE: Statistical helpers
// ---------------------------------------------------------------------------

function mean(arr: number[]): number | null {
  if (arr.length === 0) return null
  return arr.reduce((s, v) => s + v, 0) / arr.length
}

function stdDev(arr: number[]): number | null {
  if (arr.length < 2) return null
  const m = mean(arr)!
  const variance = arr.reduce((s, v) => s + Math.pow(v - m, 2), 0) / (arr.length - 1)
  return Math.sqrt(variance)
}

function percentile(arr: number[], p: number): number | null {
  if (arr.length === 0) return null
  const sorted = [...arr].sort((a, b) => a - b)
  const idx = Math.floor((p / 100) * sorted.length)
  return sorted[Math.min(idx, sorted.length - 1)]
}

/** Pearson correlation coefficient between two equal-length arrays */
export function pearsonCorrelation(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length || xs.length < 5) return null
  const mx = mean(xs)!
  const my = mean(ys)!
  let num = 0, dx2 = 0, dy2 = 0
  for (let i = 0; i < xs.length; i++) {
    const dx = xs[i] - mx
    const dy = ys[i] - my
    num  += dx * dy
    dx2  += dx * dx
    dy2  += dy * dy
  }
  const denom = Math.sqrt(dx2 * dy2)
  return denom === 0 ? null : parseFloat((num / denom).toFixed(4))
}

// ---------------------------------------------------------------------------
// PURE: Classify drift severity
// ---------------------------------------------------------------------------

export function classifyDrift(
  dimension: string,
  mae: number | null,
): DriftLevel {
  if (mae == null) return 'NONE'

  // Per-dimension thresholds
  switch (dimension) {
    case 'avm_accuracy':
      if (mae >= 20) return 'CRITICAL'
      if (mae >= 10) return 'SIGNIFICANT'
      if (mae >= 5)  return 'MILD'
      return 'NONE'
    case 'yield_accuracy':
      if (mae >= 3)  return 'CRITICAL'
      if (mae >= 2)  return 'SIGNIFICANT'
      if (mae >= 1)  return 'MILD'
      return 'NONE'
    case 'dom_accuracy':
      if (mae >= 60) return 'CRITICAL'
      if (mae >= 30) return 'SIGNIFICANT'
      if (mae >= 15) return 'MILD'
      return 'NONE'
    default:
      return 'NONE'
  }
}

function maxDriftLevel(levels: DriftLevel[]): DriftLevel {
  const order: Record<DriftLevel, number> = { NONE: 0, MILD: 1, SIGNIFICANT: 2, CRITICAL: 3 }
  return levels.reduce(
    (max, l) => (order[l] > order[max] ? l : max),
    'NONE' as DriftLevel,
  )
}

// ---------------------------------------------------------------------------
// PURE: Analyze feedback samples
// ---------------------------------------------------------------------------

export function analyzeFeedbackSamples(samples: FeedbackSample[]): AccuracyStats {
  const total = samples.length
  const withOutcome = samples.filter(s => s.close_status != null).length

  // ── AVM accuracy ──────────────────────────────────────────────────────────
  const avmErrors = samples
    .filter(s => s.avm_value_at_time && s.avm_value_at_time > 0 && s.realized_sale_price)
    .map(s => ((s.realized_sale_price! - s.avm_value_at_time!) / s.avm_value_at_time!) * 100)

  const avmMAE = avmErrors.length > 0
    ? mean(avmErrors.map(Math.abs))
    : null

  const avmStats: DimensionStats = {
    dimension:   'avm_accuracy',
    samples:     avmErrors.length,
    mean_error:  mean(avmErrors) != null ? parseFloat(mean(avmErrors)!.toFixed(3)) : null,
    mae:         avmMAE != null ? parseFloat(avmMAE.toFixed(3)) : null,
    std_dev:     stdDev(avmErrors) != null ? parseFloat(stdDev(avmErrors)!.toFixed(3)) : null,
    p90_error:   percentile(avmErrors.map(Math.abs), 90) != null
                   ? parseFloat(percentile(avmErrors.map(Math.abs), 90)!.toFixed(3)) : null,
    drift_level: classifyDrift('avm_accuracy', avmMAE),
    note:        avmErrors.length < 5 ? 'insufficient data (< 5 AVM comparisons)' : '',
  }

  // ── Yield accuracy ────────────────────────────────────────────────────────
  const yieldErrors = samples
    .filter(s => s.predicted_yield != null && s.realized_yield != null)
    .map(s => s.realized_yield! - s.predicted_yield!)

  const yieldMAE = yieldErrors.length > 0 ? mean(yieldErrors.map(Math.abs)) : null

  const yieldStats: DimensionStats = {
    dimension:   'yield_accuracy',
    samples:     yieldErrors.length,
    mean_error:  mean(yieldErrors) != null ? parseFloat(mean(yieldErrors)!.toFixed(3)) : null,
    mae:         yieldMAE != null ? parseFloat(yieldMAE.toFixed(3)) : null,
    std_dev:     stdDev(yieldErrors) != null ? parseFloat(stdDev(yieldErrors)!.toFixed(3)) : null,
    p90_error:   percentile(yieldErrors.map(Math.abs), 90) != null
                   ? parseFloat(percentile(yieldErrors.map(Math.abs), 90)!.toFixed(3)) : null,
    drift_level: classifyDrift('yield_accuracy', yieldMAE),
    note:        yieldErrors.length < 5 ? 'insufficient data (< 5 yield comparisons)' : '',
  }

  // ── DOM accuracy ──────────────────────────────────────────────────────────
  const domErrors = samples
    .filter(s => s.realized_dom != null && s.realized_dom > 0)
    .map(s => s.realized_dom!)   // absolute days — we compare to zone benchmarks separately

  const domMAE = domErrors.length > 0 ? stdDev(domErrors) : null  // use std dev as MAE proxy

  const domStats: DimensionStats = {
    dimension:   'dom_accuracy',
    samples:     domErrors.length,
    mean_error:  mean(domErrors) != null ? parseFloat(mean(domErrors)!.toFixed(1)) : null,
    mae:         domMAE != null ? parseFloat(domMAE.toFixed(1)) : null,
    std_dev:     stdDev(domErrors) != null ? parseFloat(stdDev(domErrors)!.toFixed(1)) : null,
    p90_error:   percentile(domErrors, 90) != null
                   ? parseFloat(percentile(domErrors, 90)!.toFixed(1)) : null,
    drift_level: classifyDrift('dom_accuracy', domMAE),
    note:        '',
  }

  // ── Grade hit rates ───────────────────────────────────────────────────────
  const gradeHitRates: AccuracyStats['grade_hit_rates'] = {}
  for (const s of samples) {
    const g = s.opportunity_grade ?? 'unknown'
    if (!gradeHitRates[g]) gradeHitRates[g] = { surfaced: 0, won: 0, rate: null }
    gradeHitRates[g].surfaced++
    if (s.deal_won) gradeHitRates[g].won++
  }
  for (const g of Object.keys(gradeHitRates)) {
    const { surfaced, won } = gradeHitRates[g]
    gradeHitRates[g].rate = surfaced >= 5 ? parseFloat((won / surfaced * 100).toFixed(1)) : null
  }

  // ── Score ↔ outcome correlation ───────────────────────────────────────────
  const scoredWithOutcome = samples.filter(s => s.close_status != null)
  const scoreCorrelation = pearsonCorrelation(
    scoredWithOutcome.map(s => s.opportunity_score),
    scoredWithOutcome.map(s => s.deal_won ? 1 : 0),
  )

  const overallDriftLevel = maxDriftLevel([
    avmStats.drift_level,
    yieldStats.drift_level,
    domStats.drift_level,
  ])

  return {
    total_samples:       total,
    with_outcome:        withOutcome,
    grade_hit_rates:     gradeHitRates,
    avm_accuracy:        avmStats,
    yield_accuracy:      yieldStats,
    dom_accuracy:        domStats,
    score_correlation:   scoreCorrelation,
    overall_drift_level: overallDriftLevel,
  }
}

// ---------------------------------------------------------------------------
// PURE: Generate drift recommendations
// ---------------------------------------------------------------------------

export function generateDriftRecommendations(stats: AccuracyStats): string[] {
  const recs: string[] = []

  if (stats.avm_accuracy.drift_level !== 'NONE') {
    const err = stats.avm_accuracy.mean_error
    const dir = err != null && err > 0 ? 'undervaluing' : 'overvaluing'
    recs.push(
      `AVM ${stats.avm_accuracy.drift_level}: model is ${dir} properties ` +
      `(MAE=${stats.avm_accuracy.mae?.toFixed(1)}%). ` +
      `Review zone pm2_trans data and comp selection radius.`,
    )
  }

  if (stats.yield_accuracy.drift_level !== 'NONE') {
    const err = stats.yield_accuracy.mean_error
    const dir = err != null && err > 0 ? 'under-predicting' : 'over-predicting'
    recs.push(
      `Yield model ${stats.yield_accuracy.drift_level}: ${dir} by ` +
      `${stats.yield_accuracy.mae?.toFixed(2)}%. ` +
      `Review renda_m2 zone data and vacancy assumption (currently 3-4 weeks).`,
    )
  }

  // Grade separation check
  const aPlus = stats.grade_hit_rates['A+']
  const b     = stats.grade_hit_rates['B']
  if (aPlus?.rate != null && b?.rate != null && aPlus.rate - b.rate < 15) {
    recs.push(
      `Grade separation weak: A+ win rate (${aPlus.rate}%) is only ` +
      `${(aPlus.rate - b.rate).toFixed(1)}pp above B (${b.rate}%). ` +
      `Consider raising A+ threshold from 85 to 88-90.`,
    )
  }

  if (stats.score_correlation !== null && stats.score_correlation < 0.15) {
    recs.push(
      `Low score-outcome correlation (r=${stats.score_correlation.toFixed(3)}). ` +
      `Opportunity score has weak predictive power — review dimension weights.`,
    )
  }

  if (stats.total_samples < 20) {
    recs.push(
      `Only ${stats.total_samples} feedback events. ` +
      `Recommendations require ≥20 events for statistical validity.`,
    )
  }

  return recs
}

// ---------------------------------------------------------------------------
// PURE: Build drift report from samples
// ---------------------------------------------------------------------------

export function buildDriftReport(
  samples: FeedbackSample[],
  sinceDate: Date,
): DriftReport {
  const stats = analyzeFeedbackSamples(samples)

  return {
    generated_at:        new Date().toISOString(),
    period_analyzed:     {
      start:   sinceDate.toISOString(),
      end:     new Date().toISOString(),
      samples: samples.length,
    },
    overall_drift_level: stats.overall_drift_level,
    dimensions:          [stats.avm_accuracy, stats.yield_accuracy, stats.dom_accuracy],
    grade_hit_rates:     stats.grade_hit_rates,
    score_correlation:   stats.score_correlation,
    recommendations:     generateDriftRecommendations(stats),
    has_enough_data:     samples.length >= 20,
  }
}

// ---------------------------------------------------------------------------
// DB: Fetch feedback samples from scoring_feedback_events
// ---------------------------------------------------------------------------

export async function fetchFeedbackSamples(since: Date): Promise<FeedbackSample[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from('scoring_feedback_events')
    .select([
      'opportunity_score', 'opportunity_grade', 'predicted_yield', 'realized_yield',
      'avm_value_at_time', 'realized_sale_price', 'realized_dom',
      'close_status', 'deal_won',
    ].join(','))
    .gte('surfaced_at', since.toISOString())
    .order('surfaced_at', { ascending: false })
    .limit(500)

  if (error) throw new Error(`fetchFeedbackSamples: ${error.message}`)

  return (data ?? []).map((r: Record<string, unknown>) => ({
    opportunity_score:   Number(r.opportunity_score ?? 0),
    opportunity_grade:   (r.opportunity_grade as string | null) ?? null,
    predicted_yield:     r.predicted_yield != null ? Number(r.predicted_yield) : null,
    realized_yield:      r.realized_yield  != null ? Number(r.realized_yield)  : null,
    avm_value_at_time:   r.avm_value_at_time != null ? Number(r.avm_value_at_time) : null,
    realized_sale_price: r.realized_sale_price != null ? Number(r.realized_sale_price) : null,
    realized_dom:        r.realized_dom != null ? Number(r.realized_dom) : null,
    close_status:        (r.close_status as string | null) ?? null,
    deal_won:            Boolean(r.deal_won),
  }))
}

// ---------------------------------------------------------------------------
// DB: Compute drift report and optionally persist calibration recommendation
// ---------------------------------------------------------------------------

export async function computeAndPersistDriftReport(
  since?: Date,
  persist = true,
): Promise<DriftReport> {
  const sinceDate = since ?? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)  // 90 days default
  const samples   = await fetchFeedbackSamples(sinceDate)
  const report    = buildDriftReport(samples, sinceDate)

  if (persist && report.has_enough_data) {
    try {
      const stats = analyzeFeedbackSamples(samples)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabaseAdmin as any)
        .from('calibration_recommendations')
        .insert({
          period_analyzed_start:  sinceDate.toISOString(),
          period_analyzed_end:    new Date().toISOString(),
          total_events_analyzed:  samples.length,
          drift_signals:          report.dimensions.map(d => ({
            dimension: d.dimension,
            level:     d.drift_level,
            mae:       d.mae,
            note:      d.note,
          })),
          recommendations: report.recommendations.map(r => ({ text: r })),
          grade_performance: stats.grade_hit_rates,
          data_quality: { has_enough_data: report.has_enough_data, total_samples: samples.length },
          status: 'pending',
        })
    } catch { /* non-critical — report still returned */ }
  }

  return report
}
