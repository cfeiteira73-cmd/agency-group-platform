// AGENCY GROUP — SH-ROS Learning: confidenceCalibration | AMI: 22506
// Calibrate agent confidence scores using Platt scaling approximation.
// In-process: calibration data stored in Map — no DB writes per calibration call.
// CalibrationResult exposes reliability, sharpness, and over/under-confidence flags.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CalibrationResult {
  agent_id: string
  mean_calibration_error: number
  reliability_score: number
  sharpness_score: number
  over_confident: boolean
  under_confident: boolean
}

export interface CalibrationPoint {
  predicted_probability: number
  actual_frequency: number
  count: number
}

// ─── Internal data structures ─────────────────────────────────────────────────

interface CalibrationSample {
  predicted: number
  actual: boolean
}

interface PlattParams {
  a: number  // scaling parameter
  b: number  // bias parameter
}

// Bucket boundaries for reliability diagram (10 bins)
const BINS = 10

// ─── ConfidenceCalibrator ─────────────────────────────────────────────────────

export class ConfidenceCalibrator {
  // Map key: `${agent_id}:${org_id}`
  private readonly _samples = new Map<string, CalibrationSample[]>()
  // Fitted Platt params per agent+org
  private readonly _plattParams = new Map<string, PlattParams>()

  /**
   * Record a new calibration data point.
   * predicted: raw confidence [0,1]
   * actual_success: whether the prediction came true
   */
  calibrate(
    agent_id: string,
    org_id: string,
    predicted: number,
    actual_success: boolean
  ): void {
    const key = `${agent_id}:${org_id}`
    if (!this._samples.has(key)) this._samples.set(key, [])
    this._samples.get(key)!.push({
      predicted: Math.max(0, Math.min(1, predicted)),
      actual: actual_success,
    })

    // Re-fit Platt params when enough data (>= 10 samples)
    const samples = this._samples.get(key)!
    if (samples.length >= 10) {
      this._fitPlatt(key, samples)
    }
  }

  /**
   * Compute calibration quality metrics for an agent.
   */
  getCalibration(agent_id: string, org_id: string): CalibrationResult {
    const key = `${agent_id}:${org_id}`
    const samples = this._samples.get(key) ?? []

    if (samples.length === 0) {
      return {
        agent_id,
        mean_calibration_error: 0,
        reliability_score: 1,
        sharpness_score: 0,
        over_confident: false,
        under_confident: false,
      }
    }

    const curve = this._buildCalibrationCurve(samples)

    // Mean Calibration Error (weighted)
    let totalError = 0
    let totalCount = 0
    for (const pt of curve) {
      totalError += Math.abs(pt.predicted_probability - pt.actual_frequency) * pt.count
      totalCount += pt.count
    }
    const mean_calibration_error = totalCount > 0 ? totalError / totalCount : 0

    // Reliability = 1 - MCE
    const reliability_score = Math.max(0, 1 - mean_calibration_error)

    // Sharpness = variance of predicted probabilities (higher = more decisive)
    const mean_pred = samples.reduce((s, x) => s + x.predicted, 0) / samples.length
    const variance = samples.reduce((s, x) => s + (x.predicted - mean_pred) ** 2, 0) / samples.length
    const sharpness_score = Math.sqrt(variance)

    // Bias detection
    const avg_predicted = mean_pred
    const avg_actual = samples.filter((s) => s.actual).length / samples.length
    const bias = avg_predicted - avg_actual
    const over_confident = bias > 0.05   // predicts higher prob than reality
    const under_confident = bias < -0.05 // predicts lower prob than reality

    return {
      agent_id,
      mean_calibration_error,
      reliability_score,
      sharpness_score,
      over_confident,
      under_confident,
    }
  }

  /**
   * Apply Platt scaling calibration to a raw confidence score.
   * If no Platt params fitted yet, returns the raw confidence unchanged.
   */
  applyCalibration(agent_id: string, org_id: string, raw_confidence: number): number {
    const key = `${agent_id}:${org_id}`
    const params = this._plattParams.get(key)

    if (!params) return Math.max(0, Math.min(1, raw_confidence))

    // Platt scaling: 1 / (1 + exp(a * x + b))
    const z = params.a * raw_confidence + params.b
    const calibrated = 1.0 / (1.0 + Math.exp(-z))
    return Math.max(0, Math.min(1, calibrated))
  }

  /**
   * Return the calibration curve (reliability diagram data) for an agent.
   */
  getCalibrationCurve(agent_id: string, org_id: string): CalibrationPoint[] {
    const key = `${agent_id}:${org_id}`
    const samples = this._samples.get(key) ?? []
    return this._buildCalibrationCurve(samples)
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  /**
   * Build a reliability diagram: group samples into BINS bins,
   * compute mean predicted and actual frequency per bin.
   */
  private _buildCalibrationCurve(samples: CalibrationSample[]): CalibrationPoint[] {
    const bins: Array<{ sum_pred: number; sum_actual: number; count: number }> = Array.from(
      { length: BINS },
      () => ({ sum_pred: 0, sum_actual: 0, count: 0 })
    )

    for (const s of samples) {
      const bin = Math.min(BINS - 1, Math.floor(s.predicted * BINS))
      bins[bin].sum_pred += s.predicted
      bins[bin].sum_actual += s.actual ? 1 : 0
      bins[bin].count++
    }

    return bins
      .map((b, i) => ({
        predicted_probability: b.count > 0 ? b.sum_pred / b.count : (i + 0.5) / BINS,
        actual_frequency: b.count > 0 ? b.sum_actual / b.count : 0,
        count: b.count,
      }))
      .filter((pt) => pt.count > 0)
  }

  /**
   * Fit Platt scaling parameters via gradient descent on binary cross-entropy.
   * Simple 100-step Newton approximation — sufficient for in-process calibration.
   */
  private _fitPlatt(key: string, samples: CalibrationSample[]): void {
    let a = 1.0
    let b = 0.0
    const lr = 0.01
    const steps = 100

    for (let step = 0; step < steps; step++) {
      let grad_a = 0
      let grad_b = 0

      for (const s of samples) {
        const z = a * s.predicted + b
        const p = 1.0 / (1.0 + Math.exp(-z))
        const t = s.actual ? 1.0 : 0.0
        const err = p - t
        grad_a += err * s.predicted
        grad_b += err
      }

      a -= lr * grad_a / samples.length
      b -= lr * grad_b / samples.length
    }

    this._plattParams.set(key, { a, b })
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const confidenceCalibrator = new ConfidenceCalibrator()
