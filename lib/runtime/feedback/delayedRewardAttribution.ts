// AGENCY GROUP — SH-ROS Feedback: Delayed Reward Attribution | AMI: 22506
// Attributes credit to decisions made weeks/months before the outcome materialized
// Real estate has long feedback loops: match→close can take 210 days
// Uses eligibility traces (λ-return) for multi-step credit assignment
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import type { RewardSignal } from './rewardCalibrationEngine'
import logger from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DecisionRecord {
  decision_id: string
  org_id: string
  agent_id: string
  entity_id: string          // the match/deal this decision was about
  decision_type: 'match_proposed' | 'priority_assigned' | 'action_recommended' | 'deal_pack_sent'
  decision_value: number     // the score/prediction at decision time
  decided_at: string
  outcome_received: boolean
  attributed_reward: number | null
  attributed_at: string | null
}

export interface AttributionResult {
  decision_id: string
  agent_id: string
  entity_id: string
  days_elapsed: number
  decay_factor: number       // λ^days — credit decays over time
  attributed_reward: number
  original_reward: number
  attribution_confidence: number
  attributed_at: string
}

export interface AttributionTrace {
  org_id: string
  entity_id: string
  decisions: DecisionRecord[]   // all decisions that contributed to this outcome
  outcome_reward: number
  total_attributed: number
  attribution_variance: number  // spread of credit across decisions
  trace_created_at: string
}

// ─── Attribution Configuration ────────────────────────────────────────────────

const LAMBDA              = 0.95   // eligibility trace decay (λ)
const MAX_ATTRIBUTION_DAYS = 300   // beyond 300 days, credit is near-zero
const MIN_DECAY_THRESHOLD  = 0.01  // ignore attribution < 1% credit

// ─── Delayed Reward Attribution ───────────────────────────────────────────────

export class DelayedRewardAttribution {
  private _pending_decisions = new Map<string, DecisionRecord>()  // decision_id
  private _entity_decisions  = new Map<string, string[]>()        // entity_id → [decision_ids]

  /**
   * Register a decision for future attribution.
   * Called at decision time, before outcome is known.
   */
  registerDecision(params: {
    org_id: string
    agent_id: string
    entity_id: string
    decision_type: DecisionRecord['decision_type']
    decision_value: number
  }): DecisionRecord {
    const decision_id = `dec:${params.agent_id}:${params.entity_id}:${Date.now()}`

    const record: DecisionRecord = {
      decision_id,
      org_id:            params.org_id,
      agent_id:          params.agent_id,
      entity_id:         params.entity_id,
      decision_type:     params.decision_type,
      decision_value:    params.decision_value,
      decided_at:        new Date().toISOString(),
      outcome_received:  false,
      attributed_reward: null,
      attributed_at:     null,
    }

    this._pending_decisions.set(decision_id, record)

    // Index by entity_id for fast lookup when outcome arrives
    const entity_list = this._entity_decisions.get(params.entity_id) ?? []
    entity_list.push(decision_id)
    this._entity_decisions.set(params.entity_id, entity_list)

    logger.info('[DelayedAttribution] Decision registered', {
      decision_id,
      agent_id:      params.agent_id,
      entity_id:     params.entity_id,
      decision_type: params.decision_type,
    })

    return record
  }

  /**
   * Attribute a reward signal to all pending decisions for this entity.
   * Called when an outcome (deal close, rejection etc.) is received.
   */
  attribute(reward: RewardSignal): AttributionTrace {
    const decision_ids = this._entity_decisions.get(reward.entity_id) ?? []
    const decisions    = decision_ids
      .map(id => this._pending_decisions.get(id))
      .filter((d): d is DecisionRecord => d != null && !d.outcome_received)

    const now    = new Date()
    const results: AttributionResult[] = []
    let total_attributed = 0

    for (const decision of decisions) {
      const decided_at   = new Date(decision.decided_at)
      const days_elapsed = Math.floor((now.getTime() - decided_at.getTime()) / 86_400_000)

      if (days_elapsed > MAX_ATTRIBUTION_DAYS) {
        logger.info('[DelayedAttribution] Decision too old — skipping', {
          decision_id:  decision.decision_id,
          days_elapsed,
        })
        continue
      }

      // λ-return decay: credit = reward × λ^days
      const decay_factor    = Math.pow(LAMBDA, days_elapsed)
      const attributed_val  = reward.calibrated_reward * decay_factor

      if (Math.abs(attributed_val) < MIN_DECAY_THRESHOLD) continue

      const attribution_confidence = this._computeConfidence(
        decision, reward, days_elapsed
      )

      const result: AttributionResult = {
        decision_id:            decision.decision_id,
        agent_id:               decision.agent_id,
        entity_id:              reward.entity_id,
        days_elapsed,
        decay_factor,
        attributed_reward:      Math.round(attributed_val * 10000) / 10000,
        original_reward:        reward.calibrated_reward,
        attribution_confidence,
        attributed_at:          now.toISOString(),
      }

      results.push(result)
      total_attributed += Math.abs(attributed_val)

      // Mark decision as attributed
      this._pending_decisions.set(decision.decision_id, {
        ...decision,
        outcome_received:  true,
        attributed_reward: result.attributed_reward,
        attributed_at:     result.attributed_at,
      })

      logger.info('[DelayedAttribution] Credit attributed', {
        decision_id:       decision.decision_id,
        agent_id:          decision.agent_id,
        days_elapsed,
        decay:             decay_factor.toFixed(3),
        credit:            result.attributed_reward.toFixed(4),
      })
    }

    const variance = this._computeVariance(results.map(r => r.attributed_reward))

    const trace: AttributionTrace = {
      org_id:               reward.org_id,
      entity_id:            reward.entity_id,
      decisions:            decisions,
      outcome_reward:       reward.calibrated_reward,
      total_attributed,
      attribution_variance: variance,
      trace_created_at:     now.toISOString(),
    }

    logger.info('[DelayedAttribution] Attribution trace created', {
      entity_id:        reward.entity_id,
      decisions_count:  decisions.length,
      credited:         results.length,
      total_attributed: total_attributed.toFixed(4),
    })

    return trace
  }

  /**
   * Get all pending (un-attributed) decisions for an org.
   */
  getPendingDecisions(org_id: string): DecisionRecord[] {
    return Array.from(this._pending_decisions.values())
      .filter(d => d.org_id === org_id && !d.outcome_received)
  }

  /**
   * Expire decisions older than MAX_ATTRIBUTION_DAYS with zero credit.
   * Called by maintenance cron.
   */
  expireStaleDecisions(): number {
    const now      = Date.now()
    const cutoff   = MAX_ATTRIBUTION_DAYS * 86_400_000
    let   expired  = 0

    for (const [id, decision] of this._pending_decisions.entries()) {
      if (decision.outcome_received) continue

      const age = now - new Date(decision.decided_at).getTime()
      if (age > cutoff) {
        this._pending_decisions.set(id, {
          ...decision,
          outcome_received:  true,
          attributed_reward: 0,
          attributed_at:     new Date().toISOString(),
        })
        expired++
      }
    }

    if (expired > 0) {
      logger.info('[DelayedAttribution] Expired stale decisions', { expired })
    }

    return expired
  }

  /**
   * Persist attribution trace to Supabase.
   */
  async persistTrace(trace: AttributionTrace): Promise<void> {
    const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb.from('learning_events') as any).insert({
      event_type: 'attribution_trace',
      org_id:     trace.org_id,
      metadata:   trace as unknown as Record<string, unknown>,
      created_at: trace.trace_created_at,
    })
  }

  /**
   * Load historical decisions from Supabase for recovery after restart.
   */
  async loadPendingFromDB(org_id: string): Promise<number> {
    const sb    = supabaseAdmin as unknown as { from: (t: string) => unknown }
    const since = new Date(Date.now() - MAX_ATTRIBUTION_DAYS * 86_400_000).toISOString()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (sb.from('learning_events') as any)
      .select('metadata')
      .eq('org_id', org_id)
      .eq('event_type', 'decision_registered')
      .gte('created_at', since)
      .limit(10_000)

    if (error || !data) return 0

    let loaded = 0
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const row of data as any[]) {
      const decision = row.metadata as DecisionRecord
      if (!decision?.decision_id) continue
      if (!this._pending_decisions.has(decision.decision_id)) {
        this._pending_decisions.set(decision.decision_id, decision)
        const entity_list = this._entity_decisions.get(decision.entity_id) ?? []
        if (!entity_list.includes(decision.decision_id)) {
          entity_list.push(decision.decision_id)
          this._entity_decisions.set(decision.entity_id, entity_list)
        }
        loaded++
      }
    }

    logger.info('[DelayedAttribution] Loaded pending decisions from DB', { org_id, loaded })
    return loaded
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private _computeConfidence(
    decision: DecisionRecord,
    reward: RewardSignal,
    days_elapsed: number
  ): number {
    // Higher confidence when:
    // - Decision was made close to the outcome
    // - Decision value was close to the reward value (prediction quality)
    // - Reward signal itself had high confidence

    const recency_factor = 1 - (days_elapsed / MAX_ATTRIBUTION_DAYS)
    const accuracy_delta = Math.abs(decision.decision_value - reward.calibrated_reward)
    const accuracy_factor = Math.max(0, 1 - accuracy_delta * 2)

    return Math.round(
      (recency_factor * 0.4 + accuracy_factor * 0.4 + reward.calibrated_reward * 0.2) * 100
    ) / 100
  }

  private _computeVariance(values: number[]): number {
    if (values.length < 2) return 0
    const mean = values.reduce((s, v) => s + v, 0) / values.length
    return values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length
  }
}

export const delayedRewardAttribution = new DelayedRewardAttribution()
