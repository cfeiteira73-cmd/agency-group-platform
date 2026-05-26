// =============================================================================
// Agency Group — Drift Detector v1.0
// lib/ml-reality/driftDetector.ts
//
// Detects statistical drift between ML predictions and real outcomes.
// Reads real_outcomes table, computes MAE and MAPE, classifies drift direction.
//
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { randomUUID } from 'crypto'
import { KNOWN_MODELS } from './mlRealityAlignmentEngine'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DriftReport {
  report_id: string
  tenant_id: string
  model_name: string
  window_days: number
  samples_analyzed: number
  mean_absolute_error: number
  mean_percentage_error: number
  max_percentage_error: number
  drift_score: number
  drift_detected: boolean
  drift_direction: 'OVERESTIMATING' | 'UNDERESTIMATING' | 'RANDOM' | 'STABLE'
  p_value: number | null // statistical significance (simplified)
  generated_at: string
}

// ─── Internal row shapes ──────────────────────────────────────────────────────

interface RealOutcomeRow {
  prediction_error_pct: number | null
  predicted_price_eur_cents: number | null
  actual_price_eur_cents: number
  recorded_at: string
}

interface DriftReportRow {
  report_id: string
  tenant_id: string
  model_name: string
  window_days: number
  samples_analyzed: number
  mean_absolute_error: number
  mean_percentage_error: number
  max_percentage_error: number
  drift_score: number
  drift_detected: boolean
  drift_direction: string
  p_value: number | null
  generated_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rowToDriftReport(row: DriftReportRow): DriftReport {
  return {
    report_id: row.report_id,
    tenant_id: row.tenant_id,
    model_name: row.model_name,
    window_days: row.window_days,
    samples_analyzed: row.samples_analyzed,
    mean_absolute_error: row.mean_absolute_error,
    mean_percentage_error: row.mean_percentage_error,
    max_percentage_error: row.max_percentage_error,
    drift_score: row.drift_score,
    drift_detected: row.drift_detected,
    drift_direction: row.drift_direction as DriftReport['drift_direction'],
    p_value: row.p_value,
    generated_at: row.generated_at,
  }
}

/**
 * Simplified p-value approximation using sample size heuristic.
 * In production this would use a proper t-test or Mann-Whitney U.
 */
function estimatePValue(n: number, mape: number): number | null {
  if (n < 3) return null
  // Heuristic: larger samples + higher error = more significant
  // p decreases with sample size and drift magnitude
  const significance = Math.min(1, mape / 100) * Math.log(n + 1)
  return Math.max(0.001, Math.min(1, 1 / (1 + significance)))
}

// ─── detectDrift ─────────────────────────────────────────────────────────────

/**
 * Reads real_outcomes for the given time window, computes MAE and MAPE,
 * determines drift direction. Persists to drift_reports.
 */
export async function detectDrift(
  modelName: string,
  tenantId: string,
  windowDays = 30,
): Promise<DriftReport> {
  log.info('[driftDetector] detectDrift', { modelName, tenantId, windowDays })

  const windowStart = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await (supabaseAdmin as any)
    .from('real_outcomes')
    .select('prediction_error_pct, predicted_price_eur_cents, actual_price_eur_cents, recorded_at')
    .eq('tenant_id', tenantId)
    .gte('recorded_at', windowStart)

  if (error) {
    log.warn('[driftDetector] real_outcomes query error', { error: error.message })
  }

  const outcomes: RealOutcomeRow[] = (data as RealOutcomeRow[] | null) ?? []

  // Only consider outcomes that have predictions for error analysis
  const withPredictions = outcomes.filter(
    (o) =>
      o.prediction_error_pct !== null &&
      o.predicted_price_eur_cents !== null &&
      o.actual_price_eur_cents > 0,
  )

  const samplesAnalyzed = withPredictions.length

  let meanAbsoluteError = 0
  let meanPercentageError = 0
  let maxPercentageError = 0
  let signedErrors: number[] = []

  if (samplesAnalyzed > 0) {
    const absErrors = withPredictions.map((o) => Math.abs(o.prediction_error_pct!))
    const signedPctErrors = withPredictions.map((o) => {
      const predicted = o.predicted_price_eur_cents!
      const actual = o.actual_price_eur_cents
      // positive = overestimating, negative = underestimating
      return ((predicted - actual) / actual) * 100
    })

    meanAbsoluteError = absErrors.reduce((s, v) => s + v, 0) / samplesAnalyzed
    meanPercentageError = signedPctErrors.reduce((s, v) => s + v, 0) / samplesAnalyzed
    maxPercentageError = Math.max(...absErrors)
    signedErrors = signedPctErrors
  }

  const driftScore = Math.min(1, Math.max(0, meanAbsoluteError / 100))
  const driftDetected = driftScore > 0.03

  // Drift direction from mean signed error
  let driftDirection: DriftReport['drift_direction'] = 'STABLE'
  if (samplesAnalyzed > 0 && driftDetected) {
    const positiveCount = signedErrors.filter((e) => e > 0).length
    const negativeCount = signedErrors.filter((e) => e < 0).length
    const dominance = Math.abs(positiveCount - negativeCount) / samplesAnalyzed

    if (dominance < 0.2) {
      driftDirection = 'RANDOM'
    } else if (meanPercentageError > 0) {
      driftDirection = 'OVERESTIMATING'
    } else {
      driftDirection = 'UNDERESTIMATING'
    }
  }

  const pValue = estimatePValue(samplesAnalyzed, meanAbsoluteError)
  const reportId = `drift_${randomUUID()}`
  const generatedAt = new Date().toISOString()

  const reportRow: DriftReportRow = {
    report_id: reportId,
    tenant_id: tenantId,
    model_name: modelName,
    window_days: windowDays,
    samples_analyzed: samplesAnalyzed,
    mean_absolute_error: meanAbsoluteError,
    mean_percentage_error: meanPercentageError,
    max_percentage_error: maxPercentageError,
    drift_score: driftScore,
    drift_detected: driftDetected,
    drift_direction: driftDirection,
    p_value: pValue,
    generated_at: generatedAt,
  }

  void (supabaseAdmin as any)
    .from('drift_reports')
    .insert(reportRow)
    .then(({ error: e }: { error: { message: string } | null }) => {
      if (e) log.warn('[driftDetector] persist drift_report failed', { error: e.message })
    })

  log.info('[driftDetector] drift detected', {
    modelName,
    driftScore,
    driftDirection,
    samplesAnalyzed,
  })

  return rowToDriftReport(reportRow)
}

// ─── getLatestDriftReport ─────────────────────────────────────────────────────

export async function getLatestDriftReport(
  modelName: string,
  tenantId: string,
): Promise<DriftReport | null> {
  const { data, error } = await (supabaseAdmin as any)
    .from('drift_reports')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('model_name', modelName)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    log.warn('[driftDetector] getLatestDriftReport error', { error: error.message })
    return null
  }

  if (!data) return null
  return rowToDriftReport(data as DriftReportRow)
}

// ─── comparePredictionVsReality ───────────────────────────────────────────────

/**
 * Runs detectDrift for all 5 known models and returns a summary.
 */
export async function comparePredictionVsReality(
  tenantId: string,
): Promise<{ model: string; drift_score: number; needs_action: boolean }[]> {
  log.info('[driftDetector] comparePredictionVsReality', { tenantId })

  const results = await Promise.all(
    KNOWN_MODELS.map((modelName) =>
      detectDrift(modelName, tenantId).catch((err: unknown) => {
        log.warn('[driftDetector] detectDrift failed for model', {
          modelName,
          error: err instanceof Error ? err.message : String(err),
        })
        return null
      }),
    ),
  )

  return results
    .filter((r): r is DriftReport => r !== null)
    .map((r) => ({
      model: r.model_name,
      drift_score: r.drift_score,
      needs_action: r.drift_detected && r.drift_score > 0.08,
    }))
}
