// AGENCY GROUP — SH-ROS | AMI: 22506
// Central controller that orchestrates the full autonomy pipeline:
// confidence gate → governance check → checkpoint creation → audit log.

import { logger } from '@/lib/observability/logger'
import { confidenceGate, type GateDecision } from './confidenceGate'
import { executionGovernance } from './executionGovernance'
import { rollbackSafeAutonomy } from './rollbackSafeAutonomy'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AutonomyRequest {
  request_id: string
  action: string
  org_id: string
  confidence: number
  economic_impact_eur?: number
  context?: Record<string, unknown>
  chain_depth?: number
}

export interface AutonomyResult {
  request_id: string
  decision: GateDecision
  executed: boolean
  checkpoint_id?: string
  chain_id?: string
  audit_logged: boolean
  human_approval_required: boolean
  reason: string
  estimated_impact_eur?: number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ECONOMIC_GATE_EUR = 50_000

// ---------------------------------------------------------------------------
// AutonomyController
// ---------------------------------------------------------------------------

class AutonomyController {
  /**
   * Full autonomy pipeline:
   * 1. Economic gate — if impact >= €50K, always escalate to human.
   * 2. Confidence gate — determine execution tier and decision.
   * 3. Governance check — validate org limits, chain depth, forbidden patterns.
   * 4. Checkpoint — create rollback point if execution is approved.
   * 5. Audit log — structured log with full context.
   * 6. Return AutonomyResult.
   */
  async process(request: AutonomyRequest): Promise<AutonomyResult> {
    const {
      request_id,
      action,
      org_id,
      confidence,
      economic_impact_eur,
      context = {},
      chain_depth = 0,
    } = request

    // ------------------------------------------------------------------
    // Step 1 — Economic gate
    // ------------------------------------------------------------------
    if (economic_impact_eur !== undefined && economic_impact_eur >= ECONOMIC_GATE_EUR) {
      const reason = `Economic impact €${economic_impact_eur.toLocaleString()} meets or exceeds limit (€${ECONOMIC_GATE_EUR.toLocaleString()}). Escalating to human.`

      logger.warn('[autonomyController] process — economic gate triggered', {
        request_id,
        action,
        org_id,
        economic_impact_eur,
        threshold: ECONOMIC_GATE_EUR,
      })

      return {
        request_id,
        decision: 'always_human',
        executed: false,
        audit_logged: true,
        human_approval_required: true,
        reason,
        estimated_impact_eur: economic_impact_eur,
      }
    }

    // ------------------------------------------------------------------
    // Step 2 — Confidence gate
    // ------------------------------------------------------------------
    const gateResult = confidenceGate.evaluate(action, confidence, context)

    // ------------------------------------------------------------------
    // Step 3 — Governance check
    // ------------------------------------------------------------------
    const govCheck = await executionGovernance.check(action, org_id, chain_depth)

    const decisionRequiresHuman =
      gateResult.decision === 'always_human' || gateResult.decision === 'require_approval'

    const governanceBlocked = !govCheck.allowed

    if (decisionRequiresHuman || governanceBlocked) {
      const reasons: string[] = []
      if (decisionRequiresHuman) reasons.push(gateResult.reason)
      if (governanceBlocked) reasons.push(...govCheck.violations)
      const reason = reasons.join(' | ')

      logger.info('[autonomyController] process — human required', {
        request_id,
        action,
        org_id,
        decision: gateResult.decision,
        governance_allowed: govCheck.allowed,
        violations: govCheck.violations,
      })

      return {
        request_id,
        decision: gateResult.decision,
        executed: false,
        audit_logged: true,
        human_approval_required: true,
        reason,
        estimated_impact_eur: economic_impact_eur,
      }
    }

    // ------------------------------------------------------------------
    // Step 4 — Create rollback checkpoint
    // ------------------------------------------------------------------
    const pre_state: Record<string, unknown> = {
      action,
      org_id,
      confidence,
      chain_depth,
      economic_impact_eur: economic_impact_eur ?? null,
      context,
      timestamp: new Date().toISOString(),
    }

    const checkpoint = rollbackSafeAutonomy.createCheckpoint(action, org_id, pre_state)

    // ------------------------------------------------------------------
    // Step 5 — Audit log
    // ------------------------------------------------------------------
    logger.info('[autonomyController] process — executing autonomous action', {
      request_id,
      action,
      org_id,
      decision: gateResult.decision,
      tier: gateResult.tier,
      confidence,
      chain_depth,
      checkpoint_id: checkpoint.checkpoint_id,
      is_rollbackable: checkpoint.is_rollbackable,
      rule_matched: govCheck.rule_matched?.rule_id ?? null,
      economic_impact_eur: economic_impact_eur ?? null,
    })

    // ------------------------------------------------------------------
    // Step 6 — Return result
    // ------------------------------------------------------------------
    return {
      request_id,
      decision: gateResult.decision,
      executed: true,
      checkpoint_id: checkpoint.checkpoint_id,
      audit_logged: true,
      human_approval_required: false,
      reason: gateResult.reason,
      estimated_impact_eur: economic_impact_eur,
    }
  }
}

export const autonomyController = new AutonomyController()
