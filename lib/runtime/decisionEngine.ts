// =============================================================================
// AGENCY GROUP — SH-ROS Decision Engine vFINAL
// EV = (probability × financial_impact × urgency × confidence × feasibility)
//      − (risk × penalty)
// All agent outputs ranked by EV. Only highest EV actions execute.
// AMI: 22506 | SH-ROS Production Runtime
// =============================================================================

import type { AgentId } from '@/lib/agents/types'
import type { AgentOutputContract } from '@/lib/agents/types'

// ─── EV constants ─────────────────────────────────────────────────────────────

const PRIORITY_URGENCY: Record<string, number> = {
  critical: 1.0,
  high:     0.75,
  medium:   0.5,
  low:      0.25,
}

const BASE_FEASIBILITY = 0.9  // Default — all agents are production-deployed
const PENALTY_FACTOR   = 5_000 // EUR — weight for risk penalty

// ─── EV computation ───────────────────────────────────────────────────────────

export function computeEV(output: AgentOutputContract): number {
  const probability    = output.confidence
  const financial      = Math.max(0, output.financial_impact)
  const urgency        = PRIORITY_URGENCY[output.priority] ?? 0.5
  const confidence     = output.confidence
  const feasibility    = BASE_FEASIBILITY
  const risk           = output.risk_score
  const penalty        = risk * PENALTY_FACTOR

  const ev = (probability * financial * urgency * confidence * feasibility) - penalty

  // Clamp to prevent runaway negative scores dominating
  return Math.max(-PENALTY_FACTOR, ev)
}

// ─── Ranking ──────────────────────────────────────────────────────────────────

export function rankOutputs(
  outputs: AgentOutputContract[],
): Array<AgentOutputContract & { ev: number }> {
  return outputs
    .map(o => ({ ...o, ev: computeEV(o) }))
    .sort((a, b) => b.ev - a.ev)
}

// ─── Execution scoring ────────────────────────────────────────────────────────

/**
 * Composite economic score for a RuntimeExecutionTrace:
 *   completion_rate × (1 - latency_penalty)
 * Used for observability / audit.
 */
function scoreExecution(
  completed: AgentId[],
  failed: AgentId[],
  latency_ms: number,
): number {
  const total = completed.length + failed.length
  if (total === 0) return 0

  const completion_rate = completed.length / total
  // Performance budget: 2000ms target → penalty scales above 2000ms
  const latency_penalty = Math.min(0.5, Math.max(0, (latency_ms - 2_000) / 10_000))

  return Math.round((completion_rate * (1 - latency_penalty)) * 10_000) / 10_000
}

// ─── Singleton with method binding ────────────────────────────────────────────

export const decisionEngine = {
  computeEV,
  rankOutputs,
  scoreExecution,
}
