// =============================================================================
// Agency Group — Market Benchmark Engine
// lib/intelligence/benchmarkEngine.ts
//
// Phase 8: Market Validation & Benchmark Engine
//
// Proves platform superiority over:
//   - Naive baseline (always predict mean)
//   - Historical human decisions (pre-system period)
//   - Control cohort (random routing)
//
// UPLIFT METRICS:
//   - Revenue uplift (system vs baseline commission capture)
//   - Conversion uplift (system vs random routing)
//   - AVM improvement (MAE vs comparable market tools)
//   - Speed improvement (time-to-close vs market average)
//   - Routing superiority (precision vs broadcast)
//
// PURE FUNCTIONS:
//   computeBaselineAccuracy, computeSystemAccuracy, computeUplift,
//   computeConversionUplift, computeSpeedUplift, computeRoutingUplift,
//   buildBenchmarkReport, computeStatisticalSignificance
// =============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UpliftResult {
  baseline_value:       number
  system_value:         number
  absolute_improvement: number
  relative_uplift_pct:  number
  is_significant:       boolean
}

export interface BenchmarkComparison {
  dimension:        string
  baseline:         string       // name of baseline
  baseline_value:   number
  system_value:     number
  uplift_pct:       number
  is_significant:   boolean
  sample_size:      number
}

export interface BenchmarkReport {
  generated_at:         string
  period_label:         string
  sample_size:          number
  comparisons:          BenchmarkComparison[]
  overall_uplift_score: number    // 0-100 composite
  verdict:              'superior' | 'competitive' | 'at_parity' | 'underperforming'
  headline:             string
}

export interface StatisticalSignificance {
  is_significant:  boolean
  effect_size:     number         // Cohen's d approximation
  confidence_pct:  number         // e.g. 95
  interpretation:  'large' | 'medium' | 'small' | 'negligible'
}

// ---------------------------------------------------------------------------
// PURE: Compute naive baseline accuracy (mean predictor)
// MAE of always predicting the mean
// ---------------------------------------------------------------------------

export function computeBaselineAccuracy(outcomes: number[]): {
  mean:          number
  mae:           number
  accuracy_pct:  number        // % predictions within ±10% of outcome
} {
  if (outcomes.length === 0) return { mean: 0, mae: 0, accuracy_pct: 0 }

  const mean    = outcomes.reduce((a, b) => a + b, 0) / outcomes.length
  const mae     = outcomes.reduce((a, b) => a + Math.abs(b - mean), 0) / outcomes.length

  // % within ±10% of outcome (baseline: mean predictor almost always fails this)
  const within10 = outcomes.filter(o => Math.abs(o - mean) / (mean || 1) <= 0.10).length
  const accuracyPct = within10 / outcomes.length * 100

  return {
    mean:         Math.round(mean * 100) / 100,
    mae:          Math.round(mae * 100) / 100,
    accuracy_pct: Math.round(accuracyPct * 100) / 100,
  }
}

// ---------------------------------------------------------------------------
// PURE: Compute system accuracy from predictions vs outcomes
// ---------------------------------------------------------------------------

export function computeSystemAccuracy(
  predictions: number[],
  outcomes:    number[],
): {
  mae:           number
  rmse:          number
  accuracy_pct:  number        // % within ±10%
  within_5pct:   number        // % within ±5%
} {
  if (predictions.length === 0 || predictions.length !== outcomes.length) {
    return { mae: 0, rmse: 0, accuracy_pct: 0, within_5pct: 0 }
  }

  const n      = predictions.length
  const errors = predictions.map((p, i) => p - outcomes[i])
  const mae    = errors.reduce((a, e) => a + Math.abs(e), 0) / n
  const rmse   = Math.sqrt(errors.reduce((a, e) => a + e ** 2, 0) / n)

  const within10 = predictions.filter((p, i) => {
    const o = outcomes[i]
    return o > 0 ? Math.abs(p - o) / o <= 0.10 : false
  }).length
  const within5 = predictions.filter((p, i) => {
    const o = outcomes[i]
    return o > 0 ? Math.abs(p - o) / o <= 0.05 : false
  }).length

  return {
    mae:          Math.round(mae * 100) / 100,
    rmse:         Math.round(rmse * 100) / 100,
    accuracy_pct: Math.round(within10 / n * 100 * 100) / 100,
    within_5pct:  Math.round(within5  / n * 100 * 100) / 100,
  }
}

// ---------------------------------------------------------------------------
// PURE: Compute uplift (any metric — higher is better by default)
// ---------------------------------------------------------------------------

export function computeUplift(
  baselineValue: number,
  systemValue:   number,
  lowerIsBetter = false,
): UpliftResult {
  const better = lowerIsBetter ? baselineValue - systemValue : systemValue - baselineValue
  const relativePct = baselineValue !== 0 ? (better / Math.abs(baselineValue)) * 100 : 0
  return {
    baseline_value:       Math.round(baselineValue * 100) / 100,
    system_value:         Math.round(systemValue * 100) / 100,
    absolute_improvement: Math.round(better * 100) / 100,
    relative_uplift_pct:  Math.round(relativePct * 100) / 100,
    is_significant:       Math.abs(relativePct) >= 5,    // ≥5% = practically significant
  }
}

// ---------------------------------------------------------------------------
// PURE: Compute conversion uplift
// systemConvRate vs baselineConvRate (both 0-100)
// ---------------------------------------------------------------------------

export function computeConversionUplift(
  baselineConvRate: number,
  systemConvRate:   number,
): UpliftResult {
  return computeUplift(baselineConvRate, systemConvRate)
}

// ---------------------------------------------------------------------------
// PURE: Compute speed uplift (lower days = better)
// ---------------------------------------------------------------------------

export function computeSpeedUplift(
  baselineAvgDays: number,
  systemAvgDays:   number,
): UpliftResult {
  return computeUplift(baselineAvgDays, systemAvgDays, true)
}

// ---------------------------------------------------------------------------
// PURE: Compute routing precision uplift
// Routing precision = converted / contacted (system vs broadcast)
// ---------------------------------------------------------------------------

export function computeRoutingUplift(
  baselinePrecision: number,    // 0-1 (broadcast = ~1/total_contacts)
  systemPrecision:   number,    // 0-1 (targeted = converted/routed)
): UpliftResult {
  return computeUplift(baselinePrecision * 100, systemPrecision * 100)
}

// ---------------------------------------------------------------------------
// PURE: Compute statistical significance (Cohen's d approximation)
// ---------------------------------------------------------------------------

export function computeStatisticalSignificance(
  baselineValues: number[],
  systemValues:   number[],
): StatisticalSignificance {
  if (baselineValues.length < 2 || systemValues.length < 2) {
    return { is_significant: false, effect_size: 0, confidence_pct: 0, interpretation: 'negligible' }
  }

  const mean  = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length
  const variance = (arr: number[], m: number) =>
    arr.reduce((a, b) => a + (b - m) ** 2, 0) / (arr.length - 1)

  const bMean = mean(baselineValues)
  const sMean = mean(systemValues)
  const bVar  = variance(baselineValues, bMean)
  const sVar  = variance(systemValues, sMean)
  const pooledSD = Math.sqrt((bVar + sVar) / 2)

  const cohensD = pooledSD > 0 ? Math.abs(sMean - bMean) / pooledSD : 0

  const interpretation: StatisticalSignificance['interpretation'] =
    cohensD >= 0.8 ? 'large'
    : cohensD >= 0.5 ? 'medium'
    : cohensD >= 0.2 ? 'small'
    : 'negligible'

  // Approximate confidence based on effect size and sample size
  const minN = Math.min(baselineValues.length, systemValues.length)
  const confidencePct = Math.min(99, Math.round(50 + cohensD * 20 + Math.sqrt(minN) * 2))

  return {
    is_significant: cohensD >= 0.2 && confidencePct >= 80,
    effect_size:    Math.round(cohensD * 1000) / 1000,
    confidence_pct: confidencePct,
    interpretation,
  }
}

// ---------------------------------------------------------------------------
// PURE: Build full benchmark report
// ---------------------------------------------------------------------------

export function buildBenchmarkReport(
  periodLabel:  string,
  sampleSize:   number,
  comparisons:  BenchmarkComparison[],
): BenchmarkReport {
  const upliftScores = comparisons.map(c => Math.max(-50, Math.min(50, c.uplift_pct)))
  const avgUplift    = upliftScores.length > 0
    ? upliftScores.reduce((a, b) => a + b, 0) / upliftScores.length
    : 0
  const overallScore = Math.round(Math.max(0, Math.min(100, 50 + avgUplift)))

  const verdict: BenchmarkReport['verdict'] =
    overallScore >= 70  ? 'superior'
    : overallScore >= 55 ? 'competitive'
    : overallScore >= 45 ? 'at_parity'
    : 'underperforming'

  const significantCount = comparisons.filter(c => c.is_significant).length
  const headline = `${verdict.replace('_', ' ').toUpperCase()}: ${significantCount}/${comparisons.length} metrics show statistically significant uplift. Overall score ${overallScore}/100.`

  return {
    generated_at:         new Date().toISOString(),
    period_label:         periodLabel,
    sample_size:          sampleSize,
    comparisons,
    overall_uplift_score: overallScore,
    verdict,
    headline,
  }
}
