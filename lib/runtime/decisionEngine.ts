// =============================================================================
// AGENCY GROUP — SH-ROS Decision Engine vFINAL
//
// EV = (probability × financial_impact × urgency × confidence × feasibility)
//      − (risk_score × PENALTY_EUR)
//
// Inputs (from AgentOutputContract):
//   probability    — P(action achieves outcome | analysis is correct)   0–1
//   financial_impact — EUR revenue impact estimate                       ≥ 0
//   urgency        — derived from priority enum                          0–1
//   confidence     — P(agent's analysis is correct)                     0–1
//   feasibility    — P(action is executable in current context)         constant 0.9
//   risk_score     — overall risk of action backfiring                  0–1
//   PENALTY_EUR    — fixed EUR penalty weight per unit of risk           5000
//
// All agent outputs MUST be ranked by EV before action selection.
// Only the highest EV action set executes.
// AMI: 22506 | SH-ROS Production Runtime
// =============================================================================

import type { AgentId } from '@/lib/agents/types'
import type { AgentOutputContract } from '@/lib/agents/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIORITY_URGENCY: Record<string, number> = {
  critical: 1.0,
  high:     0.75,
  medium:   0.5,
  low:      0.25,
}

const BASE_FEASIBILITY  = 0.9     // All agents are production-deployed — high feasibility
const PENALTY_EUR       = 5_000   // EUR — penalty weight per unit of risk_score
const EV_FLOOR          = -PENALTY_EUR // Prevent runaway negative scores

// ─── Core EV computation ──────────────────────────────────────────────────────

/**
 * Compute Expected Value for an agent output.
 * EV = (probability × financial_impact × urgency × confidence × feasibility)
 *      − (risk_score × PENALTY_EUR)
 *
 * probability and confidence are DISTINCT:
 *   confidence  = how certain the agent is that its analysis is correct
 *   probability = P(the recommended action succeeds)
 *
 * Both are set in AgentOutputContract by _buildOutputContract:
 *   confidence  = avg(insight.confidence across all insights)
 *   probability = confidence × 0.85  (execution discount on top of analytical uncertainty)
 */
export function computeEV(output: AgentOutputContract): number {
  const probability     = output.probability
  const financial       = Math.max(0, output.financial_impact)
  const urgency         = PRIORITY_URGENCY[output.priority] ?? 0.5
  const confidence      = output.confidence
  const feasibility     = BASE_FEASIBILITY
  const risk            = output.risk_score

  const gross = probability * financial * urgency * confidence * feasibility
  const net   = gross - (risk * PENALTY_EUR)

  return Math.max(EV_FLOOR, net)
}

// ─── Ranking ──────────────────────────────────────────────────────────────────

/**
 * Rank agent outputs by EV (descending).
 * Returns augmented outputs with their computed EV scores.
 * Used by orchestrator to prioritise which agent recommendations to surface first.
 */
export function rankOutputs(
  outputs: AgentOutputContract[],
): Array<AgentOutputContract & { ev: number }> {
  return outputs
    .map(o => ({ ...o, ev: computeEV(o) }))
    .sort((a, b) => b.ev - a.ev)
}

/**
 * Filter to only the top-N outputs by EV.
 * Used when agent count exceeds the execution budget.
 */
export function topN(
  outputs: AgentOutputContract[],
  n: number,
): Array<AgentOutputContract & { ev: number }> {
  return rankOutputs(outputs).slice(0, n)
}

// ─── Execution scoring ────────────────────────────────────────────────────────

/**
 * Composite economic score for a RuntimeExecutionTrace.
 * Ranges 0–1 (higher = better).
 *
 *   completion_rate  = agents_completed / total_agents
 *   latency_penalty  = max(0, (latency_ms - 2000) / 10000)  → 0 within budget
 *   score            = completion_rate × (1 − latency_penalty)
 *
 * Stored in runtime_events.economic_score for observability.
 */
export function scoreExecution(
  completed: AgentId[],
  failed: AgentId[],
  latency_ms: number,
): number {
  const total = completed.length + failed.length
  if (total === 0) return 0

  const completion_rate  = completed.length / total
  const latency_penalty  = Math.min(0.5, Math.max(0, (latency_ms - 2_000) / 10_000))
  const raw              = completion_rate * (1 - latency_penalty)

  return Math.round(raw * 10_000) / 10_000
}

// ─── Singleton export ─────────────────────────────────────────────────────────

export const decisionEngine = {
  computeEV,
  rankOutputs,
  topN,
  scoreExecution,
}
