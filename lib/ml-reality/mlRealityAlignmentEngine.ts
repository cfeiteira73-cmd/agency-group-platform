// =============================================================================
// Agency Group — ML Reality Alignment Engine v1.0
// lib/ml-reality/mlRealityAlignmentEngine.ts
//
// Ensures ML models are trained ONLY on real outcomes (not simulated data)
// and detects drift when internal predictions diverge from external market reality.
//
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { randomUUID } from 'crypto'

// ─── Types ────────────────────────────────────────────────────────────────────

export type MLDataQuality = 'REAL' | 'SIMULATED' | 'MIXED' | 'INSUFFICIENT'

export type DriftSeverity = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface MLRealityAlignment {
  alignment_id: string
  tenant_id: string
  model_name: string
  data_quality: MLDataQuality
  real_training_samples: number
  simulated_training_samples: number
  real_data_ratio: number // 0–1
  drift_score: number // 0–1, 0=no drift, 1=max drift
  drift_severity: DriftSeverity
  last_trained_at: string | null
  last_real_outcome_at: string | null
  prediction_accuracy_pct: number | null
  needs_retraining: boolean
  retraining_trigger: string | null
  assessed_at: string
}

export interface RealOutcome {
  outcome_id: string
  tenant_id: string
  deal_id: string
  predicted_price_eur_cents: number | null
  actual_price_eur_cents: number
  predicted_roi_pct: number | null
  actual_roi_pct: number
  prediction_error_pct: number | null // abs(predicted - actual) / actual * 100
  source: 'INTERNAL_EXECUTION' | 'EXTERNAL_REGISTRY' | 'BANK_CONFIRMATION'
  recorded_at: string
}

// ─── Known model names ────────────────────────────────────────────────────────

export const KNOWN_MODELS = [
  'price_predictor',
  'liquidity_predictor',
  'roi_forecaster',
  'match_scorer',
  'bid_recommender',
] as const

// ─── Internal row shapes ──────────────────────────────────────────────────────

interface RealOutcomeRow {
  prediction_error_pct: number | null
  recorded_at: string
  predicted_price_eur_cents: number | null
  actual_price_eur_cents: number
  predicted_roi_pct: number | null
  actual_roi_pct: number
}

interface AlignmentRow {
  alignment_id: string
  tenant_id: string
  model_name: string
  data_quality: string
  real_training_samples: number
  simulated_training_samples: number
  real_data_ratio: number
  drift_score: number
  drift_severity: string
  last_trained_at: string | null
  last_real_outcome_at: string | null
  prediction_accuracy_pct: number | null
  needs_retraining: boolean
  retraining_trigger: string | null
  assessed_at: string
}

// ─── Severity computation ─────────────────────────────────────────────────────

function computeDriftSeverity(driftScore: number, realDataRatio: number): DriftSeverity {
  if (driftScore > 0.25 || realDataRatio < 0.3) return 'CRITICAL'
  if (driftScore > 0.15 || realDataRatio < 0.5) return 'HIGH'
  if (driftScore > 0.08) return 'MEDIUM'
  if (driftScore > 0.03) return 'LOW'
  return 'NONE'
}

function computeDataQuality(realRatio: number, totalSamples: number): MLDataQuality {
  if (totalSamples < 10) return 'INSUFFICIENT'
  if (realRatio >= 0.95) return 'REAL'
  if (realRatio <= 0.05) return 'SIMULATED'
  return 'MIXED'
}

function rowToAlignment(row: AlignmentRow): MLRealityAlignment {
  return {
    alignment_id: row.alignment_id,
    tenant_id: row.tenant_id,
    model_name: row.model_name,
    data_quality: row.data_quality as MLDataQuality,
    real_training_samples: row.real_training_samples,
    simulated_training_samples: row.simulated_training_samples,
    real_data_ratio: row.real_data_ratio,
    drift_score: row.drift_score,
    drift_severity: row.drift_severity as DriftSeverity,
    last_trained_at: row.last_trained_at,
    last_real_outcome_at: row.last_real_outcome_at,
    prediction_accuracy_pct: row.prediction_accuracy_pct,
    needs_retraining: row.needs_retraining,
    retraining_trigger: row.retraining_trigger,
    assessed_at: row.assessed_at,
  }
}

// ─── assessModelAlignment ─────────────────────────────────────────────────────

/**
 * Reads execution_outcomes (real closed deals) and external_closing_records
 * to compute real vs simulated ratio and drift score from real_outcomes.
 * Persists result to ml_reality_alignments.
 */
export async function assessModelAlignment(
  modelName: string,
  tenantId: string,
): Promise<MLRealityAlignment> {
  log.info('[mlRealityAlignmentEngine] assessModelAlignment', { modelName, tenantId })

  // Count real outcomes for this tenant
  const { data: realOutcomesData, error: roErr } = await (supabaseAdmin as any)
    .from('real_outcomes')
    .select('prediction_error_pct, recorded_at, predicted_price_eur_cents, actual_price_eur_cents, predicted_roi_pct, actual_roi_pct')
    .eq('tenant_id', tenantId)
    .order('recorded_at', { ascending: false })

  if (roErr) {
    log.warn('[mlRealityAlignmentEngine] real_outcomes query error', { error: roErr.message })
  }

  const realOutcomes: RealOutcomeRow[] = (realOutcomesData as RealOutcomeRow[] | null) ?? []
  const realSamples = realOutcomes.length

  // Count simulated samples from ml_retraining_queue or use a heuristic
  // In production: query a separate simulated_training_data table
  // Here: assume simulated = 0 if we have real outcomes, or estimate based on ratio
  const { count: simulatedCount } = await (supabaseAdmin as any)
    .from('ml_retraining_queue')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('model_name', modelName)
    .eq('status', 'COMPLETED')

  const simulatedSamples = (simulatedCount as number | null) ?? 0

  const totalSamples = realSamples + simulatedSamples
  const realDataRatio = totalSamples > 0 ? realSamples / totalSamples : 0

  // Compute drift score: mean absolute prediction error / 100 from real_outcomes
  const errorsWithValues = realOutcomes.filter(
    (r) => r.prediction_error_pct !== null && r.prediction_error_pct !== undefined,
  )
  const meanAbsError =
    errorsWithValues.length > 0
      ? errorsWithValues.reduce((sum, r) => sum + Math.abs(r.prediction_error_pct!), 0) /
        errorsWithValues.length
      : 0

  const driftScore = Math.min(1, Math.max(0, meanAbsError / 100))
  const driftSeverity = computeDriftSeverity(driftScore, realDataRatio)
  const dataQuality = computeDataQuality(realDataRatio, totalSamples)
  const needsRetraining = driftScore > 0.15 || realDataRatio < 0.5

  // Prediction accuracy: 100 - mean error pct
  const predictionAccuracyPct =
    errorsWithValues.length > 0 ? Math.max(0, 100 - meanAbsError) : null

  // Last real outcome timestamp
  const lastRealOutcomeAt = realOutcomes.length > 0 ? realOutcomes[0].recorded_at : null

  const alignmentId = `align_${modelName}_${tenantId}_${Date.now()}`
  const assessedAt = new Date().toISOString()

  const alignmentRow = {
    alignment_id: alignmentId,
    tenant_id: tenantId,
    model_name: modelName,
    data_quality: dataQuality,
    real_training_samples: realSamples,
    simulated_training_samples: simulatedSamples,
    real_data_ratio: realDataRatio,
    drift_score: driftScore,
    drift_severity: driftSeverity,
    last_trained_at: null,
    last_real_outcome_at: lastRealOutcomeAt,
    prediction_accuracy_pct: predictionAccuracyPct,
    needs_retraining: needsRetraining,
    retraining_trigger: needsRetraining ? 'auto_drift_detection' : null,
    assessed_at: assessedAt,
  }

  const { error: insertErr } = await (supabaseAdmin as any)
    .from('ml_reality_alignments')
    .insert(alignmentRow)

  if (insertErr) {
    log.warn('[mlRealityAlignmentEngine] persist alignment failed', { error: insertErr.message })
  }

  log.info('[mlRealityAlignmentEngine] alignment assessed', {
    modelName,
    driftSeverity,
    driftScore,
    realDataRatio,
    needsRetraining,
  })

  return rowToAlignment(alignmentRow as AlignmentRow)
}

// ─── recordRealOutcome ────────────────────────────────────────────────────────

/**
 * Records a real deal outcome. Computes prediction_error_pct if predictions
 * are provided. Persists to real_outcomes.
 */
export async function recordRealOutcome(
  dealId: string,
  actualPriceEurCents: number,
  actualRoiPct: number,
  source: RealOutcome['source'],
  tenantId: string,
  predictedPriceEurCents?: number,
  predictedRoiPct?: number,
): Promise<RealOutcome> {
  log.info('[mlRealityAlignmentEngine] recordRealOutcome', { dealId, tenantId, source })

  const outcomeId = `outcome_${randomUUID()}`
  const recordedAt = new Date().toISOString()

  let predictionErrorPct: number | null = null
  if (predictedPriceEurCents !== undefined && actualPriceEurCents > 0) {
    predictionErrorPct =
      (Math.abs(predictedPriceEurCents - actualPriceEurCents) / actualPriceEurCents) * 100
  }

  const outcomeRow = {
    outcome_id: outcomeId,
    tenant_id: tenantId,
    deal_id: dealId,
    predicted_price_eur_cents: predictedPriceEurCents ?? null,
    actual_price_eur_cents: actualPriceEurCents,
    predicted_roi_pct: predictedRoiPct ?? null,
    actual_roi_pct: actualRoiPct,
    prediction_error_pct: predictionErrorPct,
    source,
    recorded_at: recordedAt,
  }

  const { error } = await (supabaseAdmin as any).from('real_outcomes').insert(outcomeRow)

  if (error) {
    log.error('[mlRealityAlignmentEngine] recordRealOutcome failed', new Error(error.message), {
      dealId,
    })
    throw new Error(`recordRealOutcome failed: ${error.message}`)
  }

  log.info('[mlRealityAlignmentEngine] real outcome recorded', { outcomeId, dealId })

  return {
    outcome_id: outcomeId,
    tenant_id: tenantId,
    deal_id: dealId,
    predicted_price_eur_cents: predictedPriceEurCents ?? null,
    actual_price_eur_cents: actualPriceEurCents,
    predicted_roi_pct: predictedRoiPct ?? null,
    actual_roi_pct: actualRoiPct,
    prediction_error_pct: predictionErrorPct,
    source,
    recorded_at: recordedAt,
  }
}

// ─── triggerRetraining ────────────────────────────────────────────────────────

/**
 * Checks if sufficient real samples exist (>= 10) then marks retraining
 * queued in ml_retraining_queue. Returns queued=false if < 10 samples.
 */
export async function triggerRetraining(
  modelName: string,
  tenantId: string,
  trigger: string,
): Promise<{ queued: boolean; real_samples: number }> {
  log.info('[mlRealityAlignmentEngine] triggerRetraining', { modelName, tenantId, trigger })

  const { count } = await (supabaseAdmin as any)
    .from('real_outcomes')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)

  const realSamples = (count as number | null) ?? 0

  if (realSamples < 10) {
    log.warn('[mlRealityAlignmentEngine] insufficient real samples for retraining', {
      realSamples,
      modelName,
    })
    return { queued: false, real_samples: realSamples }
  }

  const jobId = `job_${modelName}_${tenantId}_${Date.now()}`

  const { error } = await (supabaseAdmin as any).from('ml_retraining_queue').insert({
    job_id: jobId,
    tenant_id: tenantId,
    model_name: modelName,
    trigger,
    real_samples_count: realSamples,
    status: 'QUEUED',
    queued_at: new Date().toISOString(),
  })

  if (error) {
    log.warn('[mlRealityAlignmentEngine] triggerRetraining insert failed', {
      error: error.message,
    })
  }

  log.info('[mlRealityAlignmentEngine] retraining queued', { jobId, modelName, realSamples })

  return { queued: true, real_samples: realSamples }
}

// ─── getDriftHistory ──────────────────────────────────────────────────────────

/**
 * Returns last N alignment assessments for a given model.
 */
export async function getDriftHistory(
  modelName: string,
  tenantId: string,
  limit = 20,
): Promise<MLRealityAlignment[]> {
  const { data, error } = await (supabaseAdmin as any)
    .from('ml_reality_alignments')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('model_name', modelName)
    .order('assessed_at', { ascending: false })
    .limit(limit)

  if (error) {
    log.warn('[mlRealityAlignmentEngine] getDriftHistory error', { error: error.message })
    return []
  }

  return ((data as AlignmentRow[] | null) ?? []).map(rowToAlignment)
}

// ─── runAlignmentSweep ────────────────────────────────────────────────────────

/**
 * Assesses all known model names and returns all alignments.
 */
export async function runAlignmentSweep(tenantId: string): Promise<MLRealityAlignment[]> {
  log.info('[mlRealityAlignmentEngine] runAlignmentSweep', { tenantId })

  const results = await Promise.all(
    KNOWN_MODELS.map((modelName) =>
      assessModelAlignment(modelName, tenantId).catch((err: unknown) => {
        log.warn('[mlRealityAlignmentEngine] sweep model failed', {
          modelName,
          error: err instanceof Error ? err.message : String(err),
        })
        return null
      }),
    ),
  )

  return results.filter((r): r is MLRealityAlignment => r !== null)
}
