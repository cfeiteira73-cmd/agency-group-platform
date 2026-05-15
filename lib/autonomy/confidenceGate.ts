// AGENCY GROUP — SH-ROS | AMI: 22506
// Confidence-gated execution — evaluates whether AI confidence is sufficient
// for autonomous execution based on action type and tier thresholds.

import { logger } from '@/lib/observability/logger'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AutonomyTier = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type GateDecision = 'auto_execute' | 'execute_and_notify' | 'require_approval' | 'always_human'

export interface GateResult {
  decision: GateDecision
  tier: AutonomyTier
  confidence: number
  threshold_used: number
  reason: string
}

// ---------------------------------------------------------------------------
// Action → Tier mapping
// ---------------------------------------------------------------------------

const CRITICAL_ACTIONS = new Set([
  'delete_contact',
  'send_mass_email',
  'override_deal_stage',
  'close_deal_forced',
  'refund_commission',
])

const HIGH_ACTIONS = new Set([
  'send_deal_pack',
  'book_appointment',
  'escalate_priority',
  'send_proposal',
])

const MEDIUM_ACTIONS = new Set([
  'update_lead_score',
  'trigger_workflow',
  'assign_agent',
  'create_follow_up',
])

const LOW_ACTIONS = new Set([
  'generate_digest',
  'compute_match',
  'update_analytics',
  'log_event',
])

// ---------------------------------------------------------------------------
// Thresholds per tier
// ---------------------------------------------------------------------------

const TIER_CONFIG: Record<AutonomyTier, { threshold: number; decision: GateDecision }> = {
  LOW: { threshold: 0.70, decision: 'auto_execute' },
  MEDIUM: { threshold: 0.80, decision: 'execute_and_notify' },
  HIGH: { threshold: 0.90, decision: 'require_approval' },
  CRITICAL: { threshold: 1.01, decision: 'always_human' }, // threshold > 1 → never passes
}

// ---------------------------------------------------------------------------
// ConfidenceGate
// ---------------------------------------------------------------------------

class ConfidenceGate {
  private resolveActionTier(action_type: string): AutonomyTier {
    if (CRITICAL_ACTIONS.has(action_type)) return 'CRITICAL'
    if (HIGH_ACTIONS.has(action_type)) return 'HIGH'
    if (MEDIUM_ACTIONS.has(action_type)) return 'MEDIUM'
    if (LOW_ACTIONS.has(action_type)) return 'LOW'
    // Unknown actions default to HIGH for safety
    return 'HIGH'
  }

  evaluate(
    action_type: string,
    confidence: number,
    context?: Record<string, unknown>,
  ): GateResult {
    const tier = this.resolveActionTier(action_type)
    const { threshold, decision } = TIER_CONFIG[tier]

    let resolvedDecision: GateDecision
    let reason: string

    if (tier === 'CRITICAL') {
      resolvedDecision = 'always_human'
      reason = `Action "${action_type}" is classified CRITICAL — human approval always required.`
    } else if (confidence >= threshold) {
      resolvedDecision = decision
      reason = `Confidence ${confidence.toFixed(3)} meets ${tier} threshold (${threshold}). Decision: ${decision}.`
    } else {
      // Below threshold — escalate to require_approval
      resolvedDecision = 'require_approval'
      reason = `Confidence ${confidence.toFixed(3)} is below ${tier} threshold (${threshold}). Escalating to require_approval.`
    }

    logger.info('[confidenceGate] evaluate', {
      action_type,
      confidence,
      tier,
      decision: resolvedDecision,
      threshold_used: threshold,
      ...(context ?? {}),
    })

    return {
      decision: resolvedDecision,
      tier,
      confidence,
      threshold_used: threshold,
      reason,
    }
  }
}

export const confidenceGate = new ConfidenceGate()
