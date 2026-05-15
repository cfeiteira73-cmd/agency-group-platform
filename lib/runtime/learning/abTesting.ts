// AGENCY GROUP — SH-ROS Learning: A/B Testing for Decision Engine | AMI: 22506
// Phase Ω∞-8: Statistical A/B testing for EV formula variants + agent weights
// =============================================================================

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import logger from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ABVariant = 'control' | 'treatment'

export interface ABExperiment {
  experiment_id: string
  name: string
  description: string
  metric: string       // primary metric being optimized
  control_pct: number  // % assigned to control (remainder to treatment)
  active: boolean
  org_id?: string
  created_at: string
}

export interface ABAssignment {
  experiment_id: string
  entity_id: string   // deal_id, contact_id, etc.
  variant: ABVariant
  assigned_at: string
}

export interface ABObservation {
  experiment_id: string
  entity_id: string
  variant: ABVariant
  metric_value: number
  observed_at: string
}

export interface ABResult {
  experiment_id: string
  name: string
  metric: string
  total_observations: number
  control: {
    n: number
    mean: number
    variance: number
    confidence_interval: [number, number]
  }
  treatment: {
    n: number
    mean: number
    variance: number
    confidence_interval: [number, number]
  }
  relative_lift_pct: number
  p_value: number           // approximate t-test
  significant: boolean      // p < 0.05
  recommendation: 'promote_treatment' | 'keep_control' | 'insufficient_data'
}

// ─── A/B Testing Engine ───────────────────────────────────────────────────────

export class ABTestingEngine {
  private _experiments = new Map<string, ABExperiment>()
  private _assignments = new Map<string, ABVariant>()  // `${exp_id}:${entity_id}` → variant

  /**
   * Register an experiment.
   */
  registerExperiment(exp: Omit<ABExperiment, 'created_at'>): void {
    const full: ABExperiment = { ...exp, created_at: new Date().toISOString() }
    this._experiments.set(exp.experiment_id, full)
    logger.info('[ABTest] Experiment registered', {
      experiment_id: exp.experiment_id,
      name: exp.name,
      control_pct: exp.control_pct,
    })
  }

  /**
   * Assign an entity deterministically to a variant.
   * Deterministic: same entity always gets same variant (stable assignment).
   */
  assign(experiment_id: string, entity_id: string): ABVariant {
    const key = `${experiment_id}:${entity_id}`

    // Return cached assignment
    if (this._assignments.has(key)) return this._assignments.get(key)!

    const exp = this._experiments.get(experiment_id)
    if (!exp || !exp.active) return 'control'

    // Deterministic hash assignment
    let hash = 0
    for (let i = 0; i < key.length; i++) {
      hash = ((hash << 5) - hash) + key.charCodeAt(i)
      hash |= 0
    }
    const pct = Math.abs(hash % 100)
    const variant: ABVariant = pct < exp.control_pct ? 'control' : 'treatment'

    this._assignments.set(key, variant)
    return variant
  }

  /**
   * Record an observation for an entity.
   * Call after measuring the outcome metric.
   */
  async observe(opts: {
    experiment_id: string
    entity_id: string
    org_id: string
    metric_value: number
  }): Promise<void> {
    const variant = this.assign(opts.experiment_id, opts.entity_id)
    const observation: ABObservation = {
      experiment_id: opts.experiment_id,
      entity_id: opts.entity_id,
      variant,
      metric_value: opts.metric_value,
      observed_at: new Date().toISOString(),
    }

    const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }
    await (sb.from('learning_events') as {
      insert: (d: unknown) => Promise<{ error: unknown }>
    }).insert({
      event_type: 'ab_test_observation',
      org_id: opts.org_id,
      metadata: observation,
      created_at: new Date().toISOString(),
    })
  }

  /**
   * Compute statistical results for an experiment.
   * Uses Welch's t-test approximation.
   */
  async getResults(
    experiment_id: string,
    org_id?: string,
    period_days = 30
  ): Promise<ABResult> {
    const exp = this._experiments.get(experiment_id)
    const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }
    const since = new Date(Date.now() - period_days * 86_400_000).toISOString()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (sb.from('learning_events') as any)
      .select('metadata')
      .eq('event_type', 'ab_test_observation')
      .contains('metadata', { experiment_id })
      .gte('created_at', since)
      .limit(10000)

    if (org_id) q = q.eq('org_id', org_id)
    const { data, error } = await q

    if (error || !data) {
      return this._emptyResult(experiment_id, exp?.name ?? experiment_id, exp?.metric ?? 'unknown')
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const observations = (data ?? []).map((r: any) => r.metadata as ABObservation)
    const control_vals = observations.filter((o: ABObservation) => o.variant === 'control').map((o: ABObservation) => o.metric_value)
    const treatment_vals = observations.filter((o: ABObservation) => o.variant === 'treatment').map((o: ABObservation) => o.metric_value)

    if (control_vals.length < 30 || treatment_vals.length < 30) {
      return this._emptyResult(experiment_id, exp?.name ?? experiment_id, exp?.metric ?? 'unknown', observations.length)
    }

    const ctrl = this._stats(control_vals)
    const trt = this._stats(treatment_vals)
    const relative_lift_pct = ctrl.mean > 0
      ? Math.round(((trt.mean - ctrl.mean) / ctrl.mean) * 10000) / 100
      : 0

    const p_value = this._welchTTest(ctrl, trt)
    const significant = p_value < 0.05

    let recommendation: ABResult['recommendation'] = 'insufficient_data'
    if (control_vals.length + treatment_vals.length >= 100) {
      if (significant && relative_lift_pct > 0) recommendation = 'promote_treatment'
      else if (significant && relative_lift_pct <= 0) recommendation = 'keep_control'
      else recommendation = 'insufficient_data'
    }

    return {
      experiment_id,
      name: exp?.name ?? experiment_id,
      metric: exp?.metric ?? 'unknown',
      total_observations: observations.length,
      control: {
        n: ctrl.n,
        mean: Math.round(ctrl.mean * 1000) / 1000,
        variance: Math.round(ctrl.variance * 1000) / 1000,
        confidence_interval: this._ci(ctrl),
      },
      treatment: {
        n: trt.n,
        mean: Math.round(trt.mean * 1000) / 1000,
        variance: Math.round(trt.variance * 1000) / 1000,
        confidence_interval: this._ci(trt),
      },
      relative_lift_pct,
      p_value: Math.round(p_value * 10000) / 10000,
      significant,
      recommendation,
    }
  }

  private _stats(values: number[]): { n: number; mean: number; variance: number; se: number } {
    const n = values.length
    const mean = values.reduce((s, v) => s + v, 0) / n
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1)
    const se = Math.sqrt(variance / n)
    return { n, mean, variance, se }
  }

  private _ci(stats: { mean: number; se: number }): [number, number] {
    const z = 1.96  // 95% CI
    return [
      Math.round((stats.mean - z * stats.se) * 1000) / 1000,
      Math.round((stats.mean + z * stats.se) * 1000) / 1000,
    ]
  }

  private _welchTTest(
    a: { mean: number; variance: number; n: number },
    b: { mean: number; variance: number; n: number }
  ): number {
    // Welch's t-statistic
    const t = Math.abs(a.mean - b.mean) / Math.sqrt(a.variance / a.n + b.variance / b.n)
    // df approximation (Welch–Satterthwaite)
    const df = Math.pow(a.variance / a.n + b.variance / b.n, 2) /
      (Math.pow(a.variance / a.n, 2) / (a.n - 1) + Math.pow(b.variance / b.n, 2) / (b.n - 1))

    // Two-tailed p-value approximation using Cornish-Fisher
    // For large df (>30), approximate using normal distribution
    if (df > 30) {
      // P(|Z| > t) ≈ 2 * Φ(-|t|) using rational approximation
      return 2 * this._normalSurvival(t)
    }

    // For small df, use a rough polynomial approximation
    return Math.min(1, 2 * Math.exp(-0.717 * t - 0.416 * t * t))
  }

  private _normalSurvival(z: number): number {
    // Rational approximation for the normal CDF upper tail
    const t = 1 / (1 + 0.2316419 * Math.abs(z))
    const poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
    const pdf = Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI)
    return pdf * poly
  }

  private _emptyResult(
    experiment_id: string,
    name: string,
    metric: string,
    n = 0
  ): ABResult {
    const empty = { n, mean: 0, variance: 0, confidence_interval: [0, 0] as [number, number] }
    return {
      experiment_id, name, metric,
      total_observations: n,
      control: empty, treatment: empty,
      relative_lift_pct: 0,
      p_value: 1,
      significant: false,
      recommendation: 'insufficient_data',
    }
  }
}

export const abTestingEngine = new ABTestingEngine()

// ─── Pre-register core SH-ROS experiments ────────────────────────────────────

abTestingEngine.registerExperiment({
  experiment_id: 'ev_formula_v2',
  name: 'EV Formula V2 — Higher urgency weight',
  description: 'Test urgency coefficient 1.2x vs current 1.0x in EV formula',
  metric: 'deal_close_rate',
  control_pct: 80,
  active: false,  // activate when ready
})

abTestingEngine.registerExperiment({
  experiment_id: 'agent_weight_decay',
  name: 'Agent Weight Decay — Faster learning rate',
  description: 'Test 0.15 learning rate vs 0.10 for reinforcement weights',
  metric: 'ev_accuracy',
  control_pct: 70,
  active: false,
})

abTestingEngine.registerExperiment({
  experiment_id: 'priority_threshold',
  name: 'Priority Threshold — Lower HIGH cutoff',
  description: 'Test HIGH >= 75 vs current >= 80',
  metric: 'response_rate',
  control_pct: 50,
  active: false,
})
