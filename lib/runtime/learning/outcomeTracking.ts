// AGENCY GROUP — SH-ROS Learning: outcomeTracking | AMI: 22506
// Track and measure agent prediction outcomes for reinforcement learning.
// All predictions and outcomes are persisted to learning_events — fully auditable.

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AgentPrediction {
  prediction_id: string
  event_id: string
  agent_id: string
  org_id: string
  predicted_at: string
  probability: number
  confidence: number
  financial_impact_eur: number
  action_recommended: string
  insight_summary: string
}

export interface OutcomeResult {
  outcome_id: string
  event_id: string
  org_id: string
  occurred_at: string
  actual_result: 'success' | 'failure' | 'partial' | 'unknown'
  actual_revenue_eur?: number
  feedback?: string
}

export interface PredictionOutcomeMatch {
  prediction: AgentPrediction
  outcome: OutcomeResult
  accuracy: number
  calibration_error: number
}

export interface AccuracyStats {
  agent_id: string
  period_days: number
  predictions_total: number
  outcomes_matched: number
  accuracy_rate: number
  calibration_error: number
  avg_probability_error: number
  financial_accuracy_pct: number
}

// ─── OutcomeTracker ───────────────────────────────────────────────────────────

export class OutcomeTracker {
  /**
   * Record an agent prediction to learning_events.
   * Called immediately after an agent emits its AgentOutputContract.
   */
  async recordPrediction(prediction: AgentPrediction): Promise<void> {
    try {
      await supabaseAdmin.from('learning_events').insert({
        event_type: 'agent_prediction',
        agent_email: `agent:${prediction.agent_id}`,
        lead_id: null,
        deal_id: null,
        metadata: prediction as unknown as Record<string, unknown>,
      })
    } catch (err) {
      console.warn('[OutcomeTracker] recordPrediction error:', err)
    }
  }

  /**
   * Record a concrete outcome for an event.
   * Called when the downstream real-world result is known (e.g. deal closed).
   */
  async recordOutcome(
    event_id: string,
    org_id: string,
    outcome: OutcomeResult
  ): Promise<void> {
    try {
      const enriched: OutcomeResult = {
        ...outcome,
        outcome_id: outcome.outcome_id || randomUUID(),
        event_id,
        org_id,
        occurred_at: outcome.occurred_at || new Date().toISOString(),
      }

      await supabaseAdmin.from('learning_events').insert({
        event_type: 'outcome_result',
        agent_email: 'system:outcome-tracker',
        metadata: enriched as unknown as Record<string, unknown>,
      })
    } catch (err) {
      console.warn('[OutcomeTracker] recordOutcome error:', err)
    }
  }

  /**
   * Find the matching prediction for a given event and compute accuracy.
   */
  async matchOutcome(
    event_id: string,
    org_id: string
  ): Promise<PredictionOutcomeMatch | null> {
    try {
      // Fetch prediction
      const { data: predData, error: predErr } = await supabaseAdmin
        .from('learning_events')
        .select('metadata')
        .eq('event_type', 'agent_prediction')
        .order('created_at', { ascending: false })
        .limit(200)

      if (predErr) throw predErr

      const prediction = (predData ?? [])
        .map((r) => (r as Record<string, unknown>).metadata as AgentPrediction)
        .find((p) => p?.event_id === event_id && p?.org_id === org_id)

      if (!prediction) return null

      // Fetch outcome
      const { data: outData, error: outErr } = await supabaseAdmin
        .from('learning_events')
        .select('metadata')
        .eq('event_type', 'outcome_result')
        .order('created_at', { ascending: false })
        .limit(200)

      if (outErr) throw outErr

      const outcome = (outData ?? [])
        .map((r) => (r as Record<string, unknown>).metadata as OutcomeResult)
        .find((o) => o?.event_id === event_id && o?.org_id === org_id)

      if (!outcome) return null

      // Compute accuracy
      const actual_binary =
        outcome.actual_result === 'success'
          ? 1.0
          : outcome.actual_result === 'partial'
          ? 0.5
          : 0.0

      const accuracy = 1.0 - Math.abs(prediction.probability - actual_binary)
      const calibration_error = Math.abs(prediction.probability - actual_binary)

      return { prediction, outcome, accuracy, calibration_error }
    } catch (err) {
      console.warn('[OutcomeTracker] matchOutcome error:', err)
      return null
    }
  }

  /**
   * Compute accuracy statistics for an agent over a rolling period.
   */
  async getAccuracy(
    agent_id: string,
    org_id: string,
    period_days = 30
  ): Promise<AccuracyStats> {
    const empty: AccuracyStats = {
      agent_id,
      period_days,
      predictions_total: 0,
      outcomes_matched: 0,
      accuracy_rate: 0,
      calibration_error: 0,
      avg_probability_error: 0,
      financial_accuracy_pct: 0,
    }

    try {
      const since = new Date(Date.now() - period_days * 86_400_000).toISOString()

      // Fetch predictions in period
      const { data: predData, error: predErr } = await supabaseAdmin
        .from('learning_events')
        .select('metadata')
        .eq('event_type', 'agent_prediction')
        .gte('created_at', since)

      if (predErr) throw predErr

      const predictions = (predData ?? [])
        .map((r) => (r as Record<string, unknown>).metadata as AgentPrediction)
        .filter((p) => p?.agent_id === agent_id && p?.org_id === org_id)

      if (predictions.length === 0) return { ...empty, predictions_total: 0 }

      // Fetch outcomes in period
      const { data: outData, error: outErr } = await supabaseAdmin
        .from('learning_events')
        .select('metadata')
        .eq('event_type', 'outcome_result')
        .gte('created_at', since)

      if (outErr) throw outErr

      const outcomes = new Map<string, OutcomeResult>()
      for (const row of outData ?? []) {
        const o = (row as Record<string, unknown>).metadata as OutcomeResult
        if (o?.org_id === org_id) outcomes.set(o.event_id, o)
      }

      const matched: Array<{ pred: AgentPrediction; out: OutcomeResult }> = []
      for (const pred of predictions) {
        const out = outcomes.get(pred.event_id)
        if (out) matched.push({ pred, out })
      }

      if (matched.length === 0) {
        return { ...empty, predictions_total: predictions.length }
      }

      let totalCalibError = 0
      let totalProbError = 0
      let totalFinancialError = 0
      let financialCount = 0

      for (const { pred, out } of matched) {
        const actual_binary =
          out.actual_result === 'success'
            ? 1.0
            : out.actual_result === 'partial'
            ? 0.5
            : 0.0

        totalCalibError += Math.abs(pred.probability - actual_binary)
        totalProbError += Math.abs(pred.probability - actual_binary)

        if (out.actual_revenue_eur !== undefined && pred.financial_impact_eur > 0) {
          const finError = Math.abs(pred.financial_impact_eur - out.actual_revenue_eur) / Math.max(pred.financial_impact_eur, 1)
          totalFinancialError += finError
          financialCount++
        }
      }

      const n = matched.length
      const calibration_error = totalCalibError / n
      const accuracy_rate = 1.0 - calibration_error
      const avg_probability_error = totalProbError / n
      const financial_accuracy_pct =
        financialCount > 0
          ? Math.max(0, (1.0 - totalFinancialError / financialCount) * 100)
          : 0

      return {
        agent_id,
        period_days,
        predictions_total: predictions.length,
        outcomes_matched: matched.length,
        accuracy_rate: Math.max(0, Math.min(1, accuracy_rate)),
        calibration_error,
        avg_probability_error,
        financial_accuracy_pct,
      }
    } catch (err) {
      console.warn('[OutcomeTracker] getAccuracy error:', err)
      return empty
    }
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const outcomeTracker = new OutcomeTracker()
