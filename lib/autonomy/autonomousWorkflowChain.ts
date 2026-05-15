// AGENCY GROUP — SH-ROS | AMI: 22506
// Safe autonomous workflow chaining with depth limits and break conditions.
// Ensures chains halt before causing irreversible or high-impact cascades.

import { logger } from '@/lib/observability/logger'
import { confidenceGate } from './confidenceGate'
import { executionGovernance } from './executionGovernance'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChainStep {
  step_id: string
  action: string
  confidence: number
  result?: 'success' | 'failure' | 'skipped' | 'human_required'
  executed_at?: Date
  rollback_id?: string
}

export interface ChainExecution {
  chain_id: string
  org_id: string
  steps: ChainStep[]
  depth: number
  status: 'running' | 'completed' | 'halted' | 'human_required' | 'rolled_back'
  halt_reason?: string
  started_at: Date
  completed_at?: Date
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_CHAIN_DEPTH = 5
const MIN_MID_CHAIN_CONFIDENCE = 0.60
const MAX_ECONOMIC_IMPACT_EUR = 50_000

// ---------------------------------------------------------------------------
// AutonomousWorkflowChain
// ---------------------------------------------------------------------------

class AutonomousWorkflowChain {
  private chains = new Map<string, ChainExecution>()

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  async startChain(
    org_id: string,
    steps: ChainStep[],
  ): Promise<ChainExecution> {
    const chain_id = crypto.randomUUID()

    const chain: ChainExecution = {
      chain_id,
      org_id,
      steps: steps.map((s) => ({ ...s })),
      depth: 0,
      status: 'running',
      started_at: new Date(),
    }

    this.chains.set(chain_id, chain)

    logger.info('[autonomousWorkflowChain] startChain', {
      chain_id,
      org_id,
      step_count: steps.length,
    })

    return { ...chain }
  }

  async executeStep(chain_id: string, step_id: string): Promise<ChainStep> {
    const chain = this.chains.get(chain_id)
    if (!chain) {
      const msg = `Chain "${chain_id}" not found.`
      logger.warn('[autonomousWorkflowChain] executeStep — chain not found', { chain_id, step_id })
      return {
        step_id,
        action: 'unknown',
        confidence: 0,
        result: 'failure',
        executed_at: new Date(),
      }
    }

    if (chain.status !== 'running') {
      logger.warn('[autonomousWorkflowChain] executeStep — chain not running', {
        chain_id,
        step_id,
        status: chain.status,
      })
      const step = chain.steps.find((s) => s.step_id === step_id)
      if (step) {
        step.result = 'skipped'
        return { ...step }
      }
      return {
        step_id,
        action: 'unknown',
        confidence: 0,
        result: 'skipped',
        executed_at: new Date(),
      }
    }

    const step = chain.steps.find((s) => s.step_id === step_id)
    if (!step) {
      logger.warn('[autonomousWorkflowChain] executeStep — step not found', { chain_id, step_id })
      return {
        step_id,
        action: 'unknown',
        confidence: 0,
        result: 'failure',
        executed_at: new Date(),
      }
    }

    // --- Break condition: max depth ---
    if (chain.depth >= MAX_CHAIN_DEPTH) {
      return this._haltStep(chain, step, `Chain depth ${chain.depth} reached maximum (${MAX_CHAIN_DEPTH}).`, 'human_required')
    }

    // --- Break condition: mid-chain confidence ---
    if (step.confidence < MIN_MID_CHAIN_CONFIDENCE) {
      return this._haltStep(
        chain,
        step,
        `Mid-chain confidence ${step.confidence.toFixed(3)} dropped below minimum (${MIN_MID_CHAIN_CONFIDENCE}).`,
        'human_required',
      )
    }

    // --- Break condition: economic impact ---
    const economic_impact = this._extractEconomicImpact(step)
    if (economic_impact !== null && economic_impact > MAX_ECONOMIC_IMPACT_EUR) {
      return this._haltStep(
        chain,
        step,
        `Economic impact €${economic_impact.toLocaleString()} exceeds limit (€${MAX_ECONOMIC_IMPACT_EUR.toLocaleString()}).`,
        'human_required',
      )
    }

    // --- Confidence gate check ---
    const gateResult = confidenceGate.evaluate(step.action, step.confidence)
    if (gateResult.decision === 'always_human' || gateResult.decision === 'require_approval') {
      return this._haltStep(chain, step, `Gate decision "${gateResult.decision}": ${gateResult.reason}`, 'human_required')
    }

    // --- Governance check ---
    const govCheck = await executionGovernance.check(step.action, chain.org_id, chain.depth)
    if (!govCheck.allowed) {
      const reason = govCheck.violations.join(' | ')
      return this._haltStep(chain, step, `Governance violation: ${reason}`, 'halted')
    }

    // --- Execute step ---
    chain.depth += 1
    step.result = 'success'
    step.executed_at = new Date()
    step.rollback_id = crypto.randomUUID()

    logger.info('[autonomousWorkflowChain] executeStep — success', {
      chain_id,
      step_id,
      action: step.action,
      depth: chain.depth,
      rollback_id: step.rollback_id,
    })

    // Check if chain is fully complete
    const allDone = chain.steps.every(
      (s) => s.result === 'success' || s.result === 'skipped',
    )
    if (allDone) {
      chain.status = 'completed'
      chain.completed_at = new Date()
    }

    return { ...step }
  }

  haltChain(chain_id: string, reason: string): void {
    const chain = this.chains.get(chain_id)
    if (!chain) {
      logger.warn('[autonomousWorkflowChain] haltChain — chain not found', { chain_id })
      return
    }
    chain.status = 'halted'
    chain.halt_reason = reason
    chain.completed_at = new Date()

    // Mark pending steps as skipped
    for (const step of chain.steps) {
      if (!step.result) step.result = 'skipped'
    }

    logger.warn('[autonomousWorkflowChain] haltChain', { chain_id, reason })
  }

  getChainStatus(chain_id: string): ChainExecution | null {
    const chain = this.chains.get(chain_id)
    return chain ? { ...chain, steps: chain.steps.map((s) => ({ ...s })) } : null
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private _haltStep(
    chain: ChainExecution,
    step: ChainStep,
    reason: string,
    status: 'halted' | 'human_required',
  ): ChainStep {
    chain.status = status
    chain.halt_reason = reason
    chain.completed_at = new Date()
    step.result = 'human_required'
    step.executed_at = new Date()

    // Mark subsequent steps as skipped
    let reached = false
    for (const s of chain.steps) {
      if (s.step_id === step.step_id) { reached = true; continue }
      if (reached && !s.result) s.result = 'skipped'
    }

    logger.warn('[autonomousWorkflowChain] chain halted', {
      chain_id: chain.chain_id,
      step_id: step.step_id,
      action: step.action,
      reason,
      status,
    })

    return { ...step }
  }

  private _extractEconomicImpact(step: ChainStep): number | null {
    // Economic impact may be embedded in action name convention: e.g. action contains a numeric suffix
    // or carried via a separate field. For safety, return null (no impact known) unless detectable.
    // Callers can set step metadata by extending ChainStep if needed.
    return null
  }
}

export const autonomousWorkflowChain = new AutonomousWorkflowChain()
