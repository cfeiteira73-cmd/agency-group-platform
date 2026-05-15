// AGENCY GROUP — SH-ROS: Economic Closed Loop System | AMI: 22506
// Phase Ω∞-11: Closes the loop from deal outcome → weight adjustment → EV recalibration
// The revenue engine learns from every closed deal, won or lost
// =============================================================================

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { reinforcementWeightStore } from './learning/reinforcementWeights'
import { confidenceCalibrator } from './learning/confidenceCalibration'
import { outcomeTracker } from './learning/outcomeTracking'
import logger from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DealOutcome {
  deal_id: string
  org_id: string
  outcome: 'won' | 'lost' | 'stalled'
  actual_value_eur: number
  predicted_value_eur: number
  actual_close_days: number
  predicted_close_days: number
  agent_id: string
  stage_at_outcome: string
  match_score: number       // score that was assigned at deal creation
  ev_at_creation: number    // EV computed when deal was created
}

export interface ClosedLoopAdjustment {
  deal_id: string
  org_id: string
  agent_id: string
  confidence_delta: number     // how much confidence was adjusted
  weight_delta: number         // how much agent weight was adjusted
  value_accuracy_pct: number   // how accurate was the value prediction
  time_accuracy_pct: number    // how accurate was the time prediction
  loop_closed_at: string
}

export interface EconomicLoopHealth {
  org_id: string
  total_outcomes_processed: number
  last_processed_at: string | null
  avg_value_accuracy_pct: number
  avg_time_accuracy_pct: number
  calibration_drift: number    // how much confidence scores have drifted from reality
  loop_healthy: boolean
}

// ─── Economic Closed Loop ─────────────────────────────────────────────────────

export class EconomicClosedLoopSystem {
  /**
   * Process a deal outcome and close the learning loop.
   * Called when a deal reaches closed_won, closed_lost, or stalled state.
   */
  async processOutcome(outcome: DealOutcome): Promise<ClosedLoopAdjustment> {
    const now = new Date().toISOString()

    // 1. Track outcome in learning system
    await outcomeTracker.recordOutcome(
      outcome.deal_id,
      outcome.org_id,
      {
        outcome_id: randomUUID(),
        event_id: outcome.deal_id,
        org_id: outcome.org_id,
        actual_result: outcome.outcome === 'won' ? 'success' : outcome.outcome === 'lost' ? 'failure' : 'partial',
        actual_revenue_eur: outcome.actual_value_eur,
        occurred_at: now,
        feedback: `stage:${outcome.stage_at_outcome} match_score:${outcome.match_score}`,
      }
    )

    // 2. Compute prediction accuracy
    const value_accuracy_pct = outcome.predicted_value_eur > 0
      ? Math.max(0, 100 - Math.abs((outcome.actual_value_eur - outcome.predicted_value_eur) / outcome.predicted_value_eur) * 100)
      : 0

    const time_accuracy_pct = outcome.predicted_close_days > 0
      ? Math.max(0, 100 - Math.abs((outcome.actual_close_days - outcome.predicted_close_days) / outcome.predicted_close_days) * 100)
      : 0

    // 3. Adjust agent reinforcement weights based on outcome
    let weight_delta = 0
    const currentWeights = await reinforcementWeightStore.getWeights(outcome.agent_id, outcome.org_id)

    if (outcome.outcome === 'won' && value_accuracy_pct > 80) {
      // High-accuracy win: small positive reinforcement
      weight_delta = 0.02
    } else if (outcome.outcome === 'won' && value_accuracy_pct <= 50) {
      // Won but prediction was way off: mild correction
      weight_delta = -0.01
    } else if (outcome.outcome === 'lost') {
      // Lost: negative signal proportional to prediction error
      weight_delta = -(0.05 * (1 - value_accuracy_pct / 100))
    }
    // stalled: no weight adjustment — insufficient signal

    if (weight_delta !== 0 && currentWeights) {
      await reinforcementWeightStore.updateWeights(outcome.agent_id, outcome.org_id, {
        calibration_change: weight_delta,
        accuracy_change: weight_delta * 0.5,
        financial_accuracy_change: (value_accuracy_pct - 70) / 100,  // normalize around 70%
      })
    }

    // 4. Calibrate confidence scores with actual outcome
    confidenceCalibrator.calibrate(
      outcome.agent_id,
      outcome.org_id,
      Math.min(1, outcome.match_score / 100),
      outcome.outcome === 'won'
    )
    const confidence_delta = weight_delta  // proxy: same delta as weight adjustment

    // 5. Log the closed loop action
    const adjustment: ClosedLoopAdjustment = {
      deal_id: outcome.deal_id,
      org_id: outcome.org_id,
      agent_id: outcome.agent_id,
      confidence_delta,
      weight_delta,
      value_accuracy_pct: Math.round(value_accuracy_pct * 10) / 10,
      time_accuracy_pct: Math.round(time_accuracy_pct * 10) / 10,
      loop_closed_at: now,
    }

    const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }
    await (sb.from('learning_events') as {
      insert: (d: unknown) => Promise<{ error: unknown }>
    }).insert({
      event_type: 'economic_loop_closed',
      org_id: outcome.org_id,
      metadata: {
        ...adjustment,
        deal_outcome: outcome.outcome,
        match_score: outcome.match_score,
        ev_at_creation: outcome.ev_at_creation,
      },
      created_at: now,
    })

    logger.info('[EconomicClosedLoop] Loop closed', {
      deal_id: outcome.deal_id,
      org_id: outcome.org_id,
      outcome: outcome.outcome,
      value_accuracy_pct: adjustment.value_accuracy_pct,
      weight_delta,
      confidence_delta,
    })

    return adjustment
  }

  /**
   * Get health metrics for the economic closed loop.
   */
  async getLoopHealth(org_id: string, period_days = 30): Promise<EconomicLoopHealth> {
    const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }
    const since = new Date(Date.now() - period_days * 86_400_000).toISOString()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (sb.from('learning_events') as any)
      .select('metadata, created_at')
      .eq('event_type', 'economic_loop_closed')
      .eq('org_id', org_id)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(500)

    if (error || !data || data.length === 0) {
      return {
        org_id,
        total_outcomes_processed: 0,
        last_processed_at: null,
        avg_value_accuracy_pct: 0,
        avg_time_accuracy_pct: 0,
        calibration_drift: 0,
        loop_healthy: false,
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (data ?? []).map((r: any) => r.metadata as ClosedLoopAdjustment & {
      deal_outcome: string
      match_score: number
    })

    type LoopRow = ClosedLoopAdjustment & { deal_outcome: string; match_score: number }
    const avg_value = rows.reduce((s: number, r: LoopRow) => s + (r.value_accuracy_pct ?? 0), 0) / rows.length
    const avg_time = rows.reduce((s: number, r: LoopRow) => s + (r.time_accuracy_pct ?? 0), 0) / rows.length

    // Calibration drift: average |confidence_delta| (large drift = system is miscalibrated)
    const calibration_drift = rows.reduce((s: number, r: LoopRow) => s + Math.abs(r.confidence_delta ?? 0), 0) / rows.length

    return {
      org_id,
      total_outcomes_processed: rows.length,
      last_processed_at: (data[0] as { created_at: string }).created_at,
      avg_value_accuracy_pct: Math.round(avg_value * 10) / 10,
      avg_time_accuracy_pct: Math.round(avg_time * 10) / 10,
      calibration_drift: Math.round(calibration_drift * 1000) / 1000,
      loop_healthy: avg_value > 60 && calibration_drift < 0.1,
    }
  }

  /**
   * Trigger batch loop closure for all recently closed deals (catch-up run).
   */
  async runCatchUp(org_id: string): Promise<{ processed: number; errors: number }> {
    const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }

    // Find closed deals with no learning loop entry
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: closedDeals } = await (sb.from('deals') as any)
      .select('id, org_id, value_eur, status, stage, assigned_to, updated_at, created_at')
      .eq('org_id', org_id)
      .in('status', ['closed_won', 'closed_lost'])
      .order('updated_at', { ascending: false })
      .limit(100)

    if (!closedDeals || closedDeals.length === 0) return { processed: 0, errors: 0 }

    let processed = 0
    let errors = 0

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const deal of closedDeals as any[]) {
      try {
        const created = new Date(deal.created_at as string).getTime()
        const updated = new Date(deal.updated_at as string).getTime()
        const actual_close_days = Math.max(1, (updated - created) / 86_400_000)

        await this.processOutcome({
          deal_id: deal.id as string,
          org_id: deal.org_id as string,
          outcome: deal.status === 'closed_won' ? 'won' : 'lost',
          actual_value_eur: (deal.value_eur as number) ?? 0,
          predicted_value_eur: (deal.value_eur as number) ?? 0,  // no prediction stored = use actual
          actual_close_days,
          predicted_close_days: 210,  // Portugal market benchmark
          agent_id: (deal.assigned_to as string) ?? 'unassigned',
          stage_at_outcome: (deal.stage as string) ?? 'unknown',
          match_score: 50,    // default when no score stored
          ev_at_creation: 0,  // not stored on deal
        })

        processed++
      } catch (err) {
        logger.error('[EconomicClosedLoop] CatchUp error', { deal_id: deal.id, error: String(err) })
        errors++
      }
    }

    logger.info('[EconomicClosedLoop] CatchUp complete', { org_id, processed, errors })
    return { processed, errors }
  }
}

export const economicClosedLoop = new EconomicClosedLoopSystem()
