// AGENCY GROUP — SH-ROS Learning: roiOptimization | AMI: 22506
// Revenue outcome optimization — tracks predicted vs actual EUR revenue,
// computes MAPE, bias direction, and derives optimized EV weighting.

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RevenuePrediction {
  event_id: string
  org_id: string
  agent_id: string
  predicted_eur: number
  confidence: number
  predicted_at: string
}

export interface ROIStats {
  org_id: string
  period_days: number
  total_predicted_eur: number
  total_actual_eur: number
  accuracy_pct: number
  bias: 'over' | 'under' | 'calibrated'
  mape: number
}

export interface EVWeighting {
  probability_weight: number
  financial_weight: number
  confidence_weight: number
  urgency_weight: number
}

// ─── ROIOptimizer ─────────────────────────────────────────────────────────────

export class ROIOptimizer {
  /**
   * Record a revenue prediction to learning_events.
   */
  async recordRevenuePrediction(prediction: RevenuePrediction): Promise<void> {
    try {
      await supabaseAdmin.from('learning_events').insert({
        event_type: 'revenue_prediction',
        agent_email: `agent:${prediction.agent_id}`,
        metadata: {
          ...prediction,
          prediction_id: randomUUID(),
        } as unknown as Record<string, unknown>,
      })
    } catch (err) {
      console.warn('[ROIOptimizer] recordRevenuePrediction error:', err)
    }
  }

  /**
   * Record the actual revenue outcome for an event.
   * Called when a deal closes or revenue is confirmed.
   */
  async recordRevenueOutcome(
    event_id: string,
    org_id: string,
    actual_eur: number
  ): Promise<void> {
    try {
      await supabaseAdmin.from('learning_events').insert({
        event_type: 'revenue_outcome',
        agent_email: 'system:roi-optimizer',
        metadata: {
          outcome_id: randomUUID(),
          event_id,
          org_id,
          actual_eur,
          recorded_at: new Date().toISOString(),
        } as unknown as Record<string, unknown>,
      })
    } catch (err) {
      console.warn('[ROIOptimizer] recordRevenueOutcome error:', err)
    }
  }

  /**
   * Compute ROI accuracy stats for an org over a rolling period.
   * Returns MAPE, total predicted vs actual, and bias direction.
   */
  async getROIAccuracy(org_id: string, period_days = 30): Promise<ROIStats> {
    const empty: ROIStats = {
      org_id,
      period_days,
      total_predicted_eur: 0,
      total_actual_eur: 0,
      accuracy_pct: 0,
      bias: 'calibrated',
      mape: 0,
    }

    try {
      const since = new Date(Date.now() - period_days * 86_400_000).toISOString()

      const { data, error } = await supabaseAdmin
        .from('learning_events')
        .select('event_type, metadata')
        .in('event_type', ['revenue_prediction', 'revenue_outcome'])
        .gte('created_at', since)

      if (error) throw error

      const predictions = new Map<string, RevenuePrediction>()
      const outcomes = new Map<string, number>()

      for (const row of data ?? []) {
        const r = row as Record<string, unknown>
        const et = r.event_type as string
        const meta = r.metadata as Record<string, unknown>
        if (!meta) continue

        if (et === 'revenue_prediction' && meta.org_id === org_id) {
          const pred = meta as unknown as RevenuePrediction
          predictions.set(pred.event_id, pred)
        } else if (et === 'revenue_outcome' && meta.org_id === org_id) {
          outcomes.set(meta.event_id as string, meta.actual_eur as number)
        }
      }

      // Match predictions to outcomes
      const matched: Array<{ predicted: number; actual: number }> = []
      for (const [event_id, pred] of predictions) {
        const actual = outcomes.get(event_id)
        if (actual !== undefined) matched.push({ predicted: pred.predicted_eur, actual })
      }

      if (matched.length === 0) return empty

      const total_predicted_eur = matched.reduce((s, m) => s + m.predicted, 0)
      const total_actual_eur = matched.reduce((s, m) => s + m.actual, 0)

      // MAPE = mean of |predicted - actual| / max(actual, 1) * 100
      const mape =
        matched.reduce((s, m) => s + Math.abs(m.predicted - m.actual) / Math.max(m.actual, 1), 0) /
        matched.length *
        100

      const accuracy_pct = Math.max(0, 100 - mape)
      const net_bias = total_predicted_eur - total_actual_eur
      const bias: 'over' | 'under' | 'calibrated' =
        Math.abs(net_bias) < total_actual_eur * 0.05
          ? 'calibrated'
          : net_bias > 0
          ? 'over'
          : 'under'

      return { org_id, period_days, total_predicted_eur, total_actual_eur, accuracy_pct, bias, mape }
    } catch (err) {
      console.warn('[ROIOptimizer] getROIAccuracy error:', err)
      return empty
    }
  }

  /**
   * Derive optimized EV weighting based on ROI performance.
   * Over-predictor: reduce financial_weight; under-predictor: increase.
   * Returns bounded weights summing to ~1.0.
   */
  async getOptimizedWeighting(org_id: string): Promise<EVWeighting> {
    const defaults: EVWeighting = {
      probability_weight: 0.35,
      financial_weight: 0.30,
      confidence_weight: 0.20,
      urgency_weight: 0.15,
    }

    try {
      const stats = await this.getROIAccuracy(org_id, 30)

      if (stats.mape === 0) return defaults

      // If over-predicting revenue: reduce financial_weight, increase probability_weight
      // If under-predicting: increase financial_weight, reduce urgency
      let { probability_weight, financial_weight, confidence_weight, urgency_weight } = defaults

      const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))
      const adjustment = Math.min(0.05, stats.mape / 200) // max ±5% adjustment per cycle

      if (stats.bias === 'over') {
        financial_weight = clamp(financial_weight - adjustment, 0.15, 0.45)
        probability_weight = clamp(probability_weight + adjustment, 0.25, 0.50)
      } else if (stats.bias === 'under') {
        financial_weight = clamp(financial_weight + adjustment, 0.15, 0.45)
        urgency_weight = clamp(urgency_weight - adjustment * 0.5, 0.05, 0.25)
        confidence_weight = clamp(confidence_weight - adjustment * 0.5, 0.10, 0.30)
      }

      // Renormalize to sum to 1.0
      const total = probability_weight + financial_weight + confidence_weight + urgency_weight
      return {
        probability_weight: probability_weight / total,
        financial_weight: financial_weight / total,
        confidence_weight: confidence_weight / total,
        urgency_weight: urgency_weight / total,
      }
    } catch (err) {
      console.warn('[ROIOptimizer] getOptimizedWeighting error:', err)
      return defaults
    }
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const roiOptimizer = new ROIOptimizer()
