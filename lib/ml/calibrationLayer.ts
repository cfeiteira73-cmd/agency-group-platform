// =============================================================================
// Agency Group — Calibration Layer
// lib/ml/calibrationLayer.ts
//
// Converts raw model scores to calibrated probabilities via Platt scaling.
// Gradient descent is pure TypeScript — no external math libraries.
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CalibrationModel {
  model_id: string
  entity_type: string
  objective: string   // 'conversion', 'yield', 'time_to_close'

  // Platt scaling parameters (learned from labeled data)
  platt_a: number     // sigmoid parameter A
  platt_b: number     // sigmoid parameter B

  // Reliability diagram data (for visualization)
  reliability_bins: Array<{
    bin_lower: number
    bin_upper: number
    predicted_probability: number
    actual_frequency: number
    count: number
  }>

  calibration_error: number  // ECE (Expected Calibration Error)
  trained_on_n: number
  trained_at: string
}

export interface CalibratedScore {
  calibrated_probability: number              // 0-1 true probability
  confidence_interval: [number, number]       // 95% CI
  calibration_quality: 'high' | 'medium' | 'low'  // based on ECE
}

// ---------------------------------------------------------------------------
// Platt Scaling
//   P = 1 / (1 + exp(A * raw_score + B))
// ---------------------------------------------------------------------------

function plattSigmoid(rawScore: number, a: number, b: number): number {
  const exponent = a * rawScore + b
  // Clamp to avoid overflow
  const clampedExp = Math.max(-500, Math.min(500, exponent))
  return 1 / (1 + Math.exp(clampedExp))
}

// ---------------------------------------------------------------------------
// calibrateScore
// ---------------------------------------------------------------------------

export function calibrateScore(
  rawScore: number,
  model: CalibrationModel,
): CalibratedScore {
  const prob = plattSigmoid(rawScore, model.platt_a, model.platt_b)

  // 95% CI: use a simplified Wilson interval on the calibrated probability
  // Width grows with ECE — high ECE = wider CI
  const eceUncertainty = Math.min(0.3, model.calibration_error * 2)
  const halfWidth = Math.max(0.02, eceUncertainty * Math.sqrt(prob * (1 - prob) + 1e-8))
  const lower = Math.max(0, prob - halfWidth * 1.96)
  const upper = Math.min(1, prob + halfWidth * 1.96)

  const quality: CalibratedScore['calibration_quality'] =
    model.calibration_error < 0.05
      ? 'high'
      : model.calibration_error < 0.10
      ? 'medium'
      : 'low'

  return {
    calibrated_probability: Math.round(prob * 10000) / 10000,
    confidence_interval:    [
      Math.round(lower * 10000) / 10000,
      Math.round(upper * 10000) / 10000,
    ],
    calibration_quality: quality,
  }
}

// ---------------------------------------------------------------------------
// Pure TypeScript logistic regression gradient descent
// Fits Platt scaling: A, B for P = sigmoid(A*s + B)
// ---------------------------------------------------------------------------

interface PlattFitResult {
  a: number
  b: number
  final_loss: number
  iterations: number
}

function fitPlattScaling(
  rawScores: number[],
  labels: number[],    // 0 or 1
  learningRate = 0.01,
  maxIterations = 2000,
  tolerance = 1e-7,
): PlattFitResult {
  let a = 1.0
  let b = 0.0
  let prevLoss = Infinity
  const n = rawScores.length

  for (let iter = 0; iter < maxIterations; iter++) {
    let gradA = 0
    let gradB = 0
    let loss = 0

    for (let i = 0; i < n; i++) {
      const s = rawScores[i]!
      const y = labels[i]!
      const p = plattSigmoid(s, a, b)

      // Clamp probability for log stability
      const pClamped = Math.max(1e-9, Math.min(1 - 1e-9, p))

      // Binary cross-entropy loss
      loss += -(y * Math.log(pClamped) + (1 - y) * Math.log(1 - pClamped))

      // Gradient: dL/dA = (p - y) * s, dL/dB = (p - y)
      const err = p - y
      gradA += err * s
      gradB += err
    }

    loss /= n
    gradA /= n
    gradB /= n

    // Gradient clipping to prevent runaway
    const gradNorm = Math.sqrt(gradA * gradA + gradB * gradB)
    if (gradNorm > 10) {
      gradA = (gradA / gradNorm) * 10
      gradB = (gradB / gradNorm) * 10
    }

    a -= learningRate * gradA
    b -= learningRate * gradB

    // Early stopping
    if (Math.abs(prevLoss - loss) < tolerance) {
      return { a, b, final_loss: loss, iterations: iter + 1 }
    }

    prevLoss = loss
  }

  return { a, b, final_loss: prevLoss, iterations: maxIterations }
}

// ---------------------------------------------------------------------------
// computeReliabilityDiagram
// Divides predictions into 10 bins and computes calibration per bin.
// ---------------------------------------------------------------------------

function computeReliabilityBins(
  rawScores: number[],
  labels: number[],
  a: number,
  b: number,
  numBins = 10,
): CalibrationModel['reliability_bins'] {
  const bins: CalibrationModel['reliability_bins'] = []
  const binWidth = 1 / numBins

  for (let i = 0; i < numBins; i++) {
    const lower = i * binWidth
    const upper = (i + 1) * binWidth
    const binItems: Array<{ prob: number; label: number }> = []

    for (let j = 0; j < rawScores.length; j++) {
      const prob = plattSigmoid(rawScores[j]!, a, b)
      if (prob >= lower && (prob < upper || i === numBins - 1)) {
        binItems.push({ prob, label: labels[j]! })
      }
    }

    if (binItems.length === 0) continue

    const avgPredicted = binItems.reduce((s, x) => s + x.prob, 0) / binItems.length
    const actualFreq   = binItems.reduce((s, x) => s + x.label, 0) / binItems.length

    bins.push({
      bin_lower:            Math.round(lower * 1000) / 1000,
      bin_upper:            Math.round(upper * 1000) / 1000,
      predicted_probability: Math.round(avgPredicted * 10000) / 10000,
      actual_frequency:     Math.round(actualFreq * 10000) / 10000,
      count:                binItems.length,
    })
  }

  return bins
}

// ---------------------------------------------------------------------------
// computeECE (Expected Calibration Error)
// ---------------------------------------------------------------------------

function computeECE(bins: CalibrationModel['reliability_bins'], totalN: number): number {
  if (totalN === 0 || bins.length === 0) return 1
  let ece = 0
  for (const bin of bins) {
    ece += (bin.count / totalN) * Math.abs(bin.predicted_probability - bin.actual_frequency)
  }
  return Math.round(ece * 10000) / 10000
}

// ---------------------------------------------------------------------------
// fitCalibrationModel
// ---------------------------------------------------------------------------

export async function fitCalibrationModel(
  tenantId: string,
  entityType: string,
  objective: string,
): Promise<CalibrationModel> {
  const trainedAt = new Date().toISOString()
  const MIN_RECORDS = 50

  const fallback: CalibrationModel = {
    model_id:          `${tenantId}:${entityType}:${objective}:default`,
    entity_type:       entityType,
    objective,
    platt_a:           1.0,
    platt_b:           0.0,
    reliability_bins:  [],
    calibration_error: 1.0,
    trained_on_n:      0,
    trained_at:        trainedAt,
  }

  try {
    const db = supabaseAdmin as any

    // Fetch labeled feature snapshots for this entity type
    const { data, error } = await db
      .from('ml_feature_snapshots')
      .select('features, label_value')
      .eq('tenant_id', tenantId)
      .eq('entity_type', entityType)
      .not('label_value', 'is', null)
      .order('computed_at', { ascending: false })
      .limit(10000)

    if (error) {
      log.error('[calibrationLayer] fitCalibrationModel — data fetch failed', undefined, {
        error: error.message,
        tenant_id: tenantId,
        entity_type: entityType,
      })
      return fallback
    }

    const rows: Array<{
      features: Record<string, unknown>
      label_value: number
    }> = data ?? []

    if (rows.length < MIN_RECORDS) {
      log.error('[calibrationLayer] fitCalibrationModel — insufficient data', undefined, {
        rows: rows.length,
        min_required: MIN_RECORDS,
        tenant_id: tenantId,
        entity_type: entityType,
      })
      return { ...fallback, trained_on_n: rows.length }
    }

    // Extract the most informative feature as raw score proxy
    // Use 'match_score', 'opportunity_score', or fallback to first numeric feature
    const scoreFeatures = ['match_score', 'opportunity_score', 'score', 'estimated_yield_pct']

    const rawScores: number[] = []
    const labels: number[] = []

    for (const row of rows) {
      let rawScore: number | null = null

      for (const sf of scoreFeatures) {
        const val = row.features?.[sf]
        if (typeof val === 'number' && isFinite(val)) {
          // Normalise to 0-1 range if the feature is on a 0-100 scale
          rawScore = val > 1 ? val / 100 : val
          break
        }
      }

      // If no explicit score feature, try to extract any numeric feature
      if (rawScore === null) {
        const numericVals = Object.values(row.features ?? {})
          .filter((v): v is number => typeof v === 'number' && isFinite(v) && v >= 0 && v <= 100)
        if (numericVals.length > 0) {
          const avg = numericVals.reduce((s, v) => s + v, 0) / numericVals.length
          rawScore = avg / 100
        }
      }

      if (rawScore !== null) {
        rawScores.push(rawScore)
        labels.push(row.label_value >= 0.5 ? 1 : 0)
      }
    }

    if (rawScores.length < MIN_RECORDS) {
      return { ...fallback, trained_on_n: rawScores.length }
    }

    // Fit Platt scaling via gradient descent
    const fitResult = fitPlattScaling(rawScores, labels)

    // Compute reliability bins
    const reliabilityBins = computeReliabilityBins(rawScores, labels, fitResult.a, fitResult.b)

    // Compute ECE
    const calibrationError = computeECE(reliabilityBins, rawScores.length)

    const model: CalibrationModel = {
      model_id:          `${tenantId}:${entityType}:${objective}:${Date.now()}`,
      entity_type:       entityType,
      objective,
      platt_a:           Math.round(fitResult.a * 100000) / 100000,
      platt_b:           Math.round(fitResult.b * 100000) / 100000,
      reliability_bins:  reliabilityBins,
      calibration_error: calibrationError,
      trained_on_n:      rawScores.length,
      trained_at:        trainedAt,
    }

    // Persist to calibration_models table
    try {
      const { error: upsertErr } = await db
        .from('calibration_models')
        .upsert(
          {
            tenant_id:         tenantId,
            entity_type:       entityType,
            objective,
            platt_a:           model.platt_a,
            platt_b:           model.platt_b,
            reliability_bins:  JSON.stringify(reliabilityBins),
            calibration_error: calibrationError,
            trained_on_n:      rawScores.length,
            trained_at:        trainedAt,
          },
          { onConflict: 'tenant_id,entity_type,objective' },
        )

      if (upsertErr) {
        log.error('[calibrationLayer] fitCalibrationModel — upsert failed (non-critical)', undefined, {
          error: upsertErr.message,
          tenant_id: tenantId,
        })
      }
    } catch (upsertErr) {
      log.error('[calibrationLayer] fitCalibrationModel — upsert exception (non-critical)', upsertErr instanceof Error ? upsertErr : undefined, {
        error: upsertErr instanceof Error ? upsertErr.message : String(upsertErr),
        tenant_id: tenantId,
      })
    }

    return model
  } catch (err) {
    log.error('[calibrationLayer] fitCalibrationModel — unexpected error', err instanceof Error ? err : undefined, {
      error: err instanceof Error ? err.message : String(err),
      tenant_id: tenantId,
      entity_type: entityType,
    })
    return fallback
  }
}

// ---------------------------------------------------------------------------
// getActiveCalibrationModel
// ---------------------------------------------------------------------------

export async function getActiveCalibrationModel(
  tenantId: string,
  entityType: string,
  objective: string,
): Promise<CalibrationModel | null> {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('calibration_models')
      .select('id, entity_type, objective, platt_a, platt_b, reliability_bins, calibration_error, trained_on_n, trained_at')
      .eq('tenant_id', tenantId)
      .eq('entity_type', entityType)
      .eq('objective', objective)
      .order('trained_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      log.error('[calibrationLayer] getActiveCalibrationModel — query failed', undefined, {
        error: error.message,
        tenant_id: tenantId,
        entity_type: entityType,
        objective,
      })
      return null
    }

    if (!data) return null

    let reliabilityBins: CalibrationModel['reliability_bins'] = []
    try {
      reliabilityBins = typeof data.reliability_bins === 'string'
        ? JSON.parse(data.reliability_bins)
        : (data.reliability_bins as CalibrationModel['reliability_bins']) ?? []
    } catch {
      reliabilityBins = []
    }

    return {
      model_id:          data.id,
      entity_type:       data.entity_type,
      objective:         data.objective,
      platt_a:           Number(data.platt_a ?? 1),
      platt_b:           Number(data.platt_b ?? 0),
      reliability_bins:  reliabilityBins,
      calibration_error: Number(data.calibration_error ?? 1),
      trained_on_n:      Number(data.trained_on_n ?? 0),
      trained_at:        data.trained_at,
    }
  } catch (err) {
    log.error('[calibrationLayer] getActiveCalibrationModel — unexpected error', err instanceof Error ? err : undefined, {
      error: err instanceof Error ? err.message : String(err),
      tenant_id: tenantId,
      entity_type: entityType,
      objective,
    })
    return null
  }
}

// ---------------------------------------------------------------------------
// scoreToExpectedYield
// Converts a calibrated probability to an expected yield estimate.
// Expected yield = P(conversion) * market_yield + (1 - P) * 0
// ---------------------------------------------------------------------------

export function scoreToExpectedYield(
  score: number,
  calibrationModel: CalibrationModel,
  marketYieldPct: number,
): number {
  const { calibrated_probability } = calibrateScore(score, calibrationModel)
  const expectedYield = calibrated_probability * marketYieldPct
  return Math.round(expectedYield * 100) / 100
}
