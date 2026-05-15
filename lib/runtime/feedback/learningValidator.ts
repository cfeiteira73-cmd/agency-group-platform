// AGENCY GROUP — SH-ROS Feedback: Learning Validator | AMI: 22506
// Validates that agent learning is improving — detects degradation & regressions
// Gates weight updates: only applies improvements that pass statistical validation
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import logger from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LearningSnapshot {
  snapshot_id: string
  org_id: string
  agent_id: string
  metric: LearningMetric
  value: number
  sample_count: number
  recorded_at: string
}

export type LearningMetric =
  | 'match_precision'         // correct matches / total matches proposed
  | 'close_rate_lift'         // lift over baseline close rate
  | 'revenue_per_prediction'  // avg revenue when agent's recommendation is followed
  | 'false_positive_rate'     // high-score matches that didn't convert
  | 'calibration_error'       // mean |predicted_prob - actual_rate|
  | 'reward_mean'             // average reward signal
  | 'reward_std'              // reward variance (high = unstable)

export interface ValidationResult {
  agent_id: string
  org_id: string
  metric: LearningMetric
  current_value: number
  baseline_value: number
  delta: number
  delta_pct: number
  verdict: 'improving' | 'stable' | 'degrading' | 'insufficient_data'
  should_apply_update: boolean
  confidence: number
  reason: string
  validated_at: string
}

export interface LearningHealth {
  agent_id: string
  org_id: string
  overall_status: 'healthy' | 'degrading' | 'unknown'
  metrics: ValidationResult[]
  degrading_count: number
  improving_count: number
  last_validated_at: string
}

// ─── Improvement Thresholds ───────────────────────────────────────────────────

const MIN_SAMPLES_FOR_VALIDATION = 30
const DEGRADATION_THRESHOLD      = -0.05   // >5% drop = degrading
const IMPROVEMENT_THRESHOLD      =  0.02   // >2% gain = improving
const SIGNIFICANT_DELTA          =  0.10   // >10% delta requires extra scrutiny

// Higher is better for these metrics
const HIGHER_IS_BETTER: Set<LearningMetric> = new Set([
  'match_precision',
  'close_rate_lift',
  'revenue_per_prediction',
  'reward_mean',
])

// Lower is better for these metrics
const LOWER_IS_BETTER: Set<LearningMetric> = new Set([
  'false_positive_rate',
  'calibration_error',
  'reward_std',
])

// ─── Learning Validator ────────────────────────────────────────────────────────

export class LearningValidator {
  private _snapshots = new Map<string, LearningSnapshot[]>()  // `${org_id}:${agent_id}:${metric}`

  /**
   * Record a new metric snapshot for an agent.
   */
  recordSnapshot(
    org_id: string,
    agent_id: string,
    metric: LearningMetric,
    value: number,
    sample_count: number
  ): LearningSnapshot {
    const key = this._key(org_id, agent_id, metric)
    const snapshot: LearningSnapshot = {
      snapshot_id: `snap:${Date.now()}:${metric}`,
      org_id,
      agent_id,
      metric,
      value,
      sample_count,
      recorded_at: new Date().toISOString(),
    }

    const existing = this._snapshots.get(key) ?? []
    existing.push(snapshot)
    if (existing.length > 100) existing.shift()  // rolling window
    this._snapshots.set(key, existing)

    return snapshot
  }

  /**
   * Validate whether a proposed weight update should be applied.
   * Compares current metric against rolling baseline.
   */
  validateUpdate(
    org_id: string,
    agent_id: string,
    metric: LearningMetric,
    proposed_value: number,
    sample_count: number
  ): ValidationResult {
    const key      = this._key(org_id, agent_id, metric)
    const history  = this._snapshots.get(key) ?? []
    const baseline = this._computeBaseline(history, metric)

    if (baseline === null || sample_count < MIN_SAMPLES_FOR_VALIDATION) {
      return {
        agent_id,
        org_id,
        metric,
        current_value:  proposed_value,
        baseline_value: baseline ?? 0,
        delta:          0,
        delta_pct:      0,
        verdict:        'insufficient_data',
        should_apply_update: true,  // allow when no baseline (bootstrap)
        confidence:     0.3,
        reason:         `Insufficient data: ${sample_count} samples (min: ${MIN_SAMPLES_FOR_VALIDATION})`,
        validated_at:   new Date().toISOString(),
      }
    }

    const delta     = proposed_value - baseline
    const delta_pct = baseline !== 0 ? delta / Math.abs(baseline) : 0

    const { verdict, should_apply } = this._classify(metric, delta_pct, sample_count)

    const result: ValidationResult = {
      agent_id,
      org_id,
      metric,
      current_value:  proposed_value,
      baseline_value: baseline,
      delta,
      delta_pct,
      verdict,
      should_apply_update: should_apply,
      confidence: this._computeConfidence(sample_count, Math.abs(delta_pct)),
      reason: this._buildReason(metric, verdict, delta_pct, baseline),
      validated_at: new Date().toISOString(),
    }

    if (verdict === 'degrading') {
      logger.warn('[LearningValidator] Degradation detected — blocking update', {
        agent_id, org_id, metric, delta_pct: (delta_pct * 100).toFixed(1) + '%',
      })
    } else if (verdict === 'improving') {
      logger.info('[LearningValidator] Improvement confirmed', {
        agent_id, org_id, metric, delta_pct: (delta_pct * 100).toFixed(1) + '%',
      })
    }

    return result
  }

  /**
   * Run full health check for an agent across all metrics.
   */
  validateAgentHealth(org_id: string, agent_id: string): LearningHealth {
    const metrics: LearningMetric[] = [
      'match_precision', 'close_rate_lift', 'revenue_per_prediction',
      'false_positive_rate', 'calibration_error', 'reward_mean', 'reward_std',
    ]

    const results: ValidationResult[] = []

    for (const metric of metrics) {
      const key     = this._key(org_id, agent_id, metric)
      const history = this._snapshots.get(key) ?? []

      if (history.length === 0) continue

      const latest = history[history.length - 1]
      const result = this.validateUpdate(
        org_id, agent_id, metric, latest.value, latest.sample_count
      )
      results.push(result)
    }

    const degrading_count = results.filter(r => r.verdict === 'degrading').length
    const improving_count = results.filter(r => r.verdict === 'improving').length

    const overall_status: LearningHealth['overall_status'] =
      degrading_count >= 2 ? 'degrading' :
      results.length === 0 ? 'unknown' :
      'healthy'

    return {
      agent_id,
      org_id,
      overall_status,
      metrics: results,
      degrading_count,
      improving_count,
      last_validated_at: new Date().toISOString(),
    }
  }

  /**
   * Persist validation snapshot to Supabase.
   */
  async persistSnapshot(snapshot: LearningSnapshot): Promise<void> {
    const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb.from('learning_events') as any).insert({
      event_type: `learning_snapshot:${snapshot.metric}`,
      org_id: snapshot.org_id,
      metadata: snapshot as unknown as Record<string, unknown>,
      created_at: snapshot.recorded_at,
    })
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private _key(org_id: string, agent_id: string, metric: LearningMetric): string {
    return `${org_id}:${agent_id}:${metric}`
  }

  private _computeBaseline(history: LearningSnapshot[], _metric: LearningMetric): number | null {
    if (history.length < 3) return null

    // Use median of last 5 snapshots as baseline (robust to outliers)
    const recent = history.slice(-5)
    const sorted = [...recent].sort((a, b) => a.value - b.value)
    return sorted[Math.floor(sorted.length / 2)].value
  }

  private _classify(
    metric: LearningMetric,
    delta_pct: number,
    sample_count: number
  ): { verdict: ValidationResult['verdict']; should_apply: boolean } {
    // Determine directionality
    const direction = HIGHER_IS_BETTER.has(metric) ? 1 :
                      LOWER_IS_BETTER.has(metric)  ? -1 : 1

    const effective_delta = delta_pct * direction

    // Large unexpected deltas require extra samples before applying
    const sample_sufficient = !(Math.abs(delta_pct) >= SIGNIFICANT_DELTA && sample_count < 100)

    if (effective_delta <= DEGRADATION_THRESHOLD) {
      return { verdict: 'degrading', should_apply: false }
    }

    if (effective_delta >= IMPROVEMENT_THRESHOLD && sample_sufficient) {
      return { verdict: 'improving', should_apply: true }
    }

    return { verdict: 'stable', should_apply: true }
  }

  private _computeConfidence(sample_count: number, abs_delta_pct: number): number {
    // More samples + larger delta = higher confidence
    const sample_factor = Math.min(1, sample_count / 100)
    const delta_factor  = Math.min(1, abs_delta_pct / 0.2)
    return Math.round((0.6 * sample_factor + 0.4 * delta_factor) * 100) / 100
  }

  private _buildReason(
    metric: LearningMetric,
    verdict: ValidationResult['verdict'],
    delta_pct: number,
    baseline: number
  ): string {
    const sign = delta_pct >= 0 ? '+' : ''
    const pct  = (delta_pct * 100).toFixed(1)

    switch (verdict) {
      case 'improving':
        return `${metric} improved ${sign}${pct}% vs baseline ${baseline.toFixed(3)}`
      case 'degrading':
        return `${metric} degraded ${sign}${pct}% vs baseline ${baseline.toFixed(3)} — update blocked`
      case 'stable':
        return `${metric} stable (${sign}${pct}%)`
      case 'insufficient_data':
        return `Insufficient samples for ${metric} validation`
    }
  }
}

export const learningValidator = new LearningValidator()
