// lib/ai/decisionEngine.ts
// Central AI routing engine — selects optimal agent/model for a given context.

import { AgentConfig, AgentRiskLevel, AGENT_REGISTRY } from './agentRegistry'

export interface DecisionContext {
  capability: string
  priority: 'speed' | 'quality' | 'cost'
  maxLatencyMs?: number
  maxCostUsd?: number
  riskTolerance?: AgentRiskLevel
  tenantId?: string
  correlationId?: string
}

export interface RoutingDecision {
  agentId: string
  agentConfig: AgentConfig
  reason: string
  estimatedCostUsd: number
  estimatedLatencyMs: number
  fallbackAgentId?: string
}

function getRiskScore(level: AgentRiskLevel): number {
  return { low: 1, medium: 2, high: 3, critical: 4 }[level]
}

function getModelScore(model: string): number {
  if (model.includes('opus')) return 3
  if (model.includes('sonnet')) return 2
  if (model.includes('haiku')) return 1
  return 0
}

export function route(context: DecisionContext): RoutingDecision | null {
  const { capability, priority, maxLatencyMs, maxCostUsd, riskTolerance } = context

  const candidates = Object.values(AGENT_REGISTRY).filter(a => {
    if (!a.capabilities.includes(capability)) return false
    if (maxLatencyMs && a.latencySLA > maxLatencyMs) return false
    if (riskTolerance && getRiskScore(a.riskLevel) > getRiskScore(riskTolerance)) return false
    const estimatedCost = (a.costPer1kInputTokens * 2 + a.costPer1kOutputTokens) / 1000 * a.maxTokens
    if (maxCostUsd && estimatedCost > maxCostUsd) return false
    return true
  })

  if (candidates.length === 0) return null

  const sorted = [...candidates].sort((a, b) => {
    if (priority === 'speed') return a.latencySLA - b.latencySLA
    if (priority === 'cost') {
      const costA = (a.costPer1kInputTokens + a.costPer1kOutputTokens) * a.maxTokens / 1000
      const costB = (b.costPer1kInputTokens + b.costPer1kOutputTokens) * b.maxTokens / 1000
      return costA - costB
    }
    return getModelScore(b.model) - getModelScore(a.model)
  })

  const selected = sorted[0]
  const fallback = sorted[1]
  const estimatedCostUsd = (selected.costPer1kInputTokens * 2 + selected.costPer1kOutputTokens) / 1000 * selected.maxTokens

  return {
    agentId: selected.id,
    agentConfig: selected,
    reason: `Selected for ${priority} with capability: ${capability}`,
    estimatedCostUsd,
    estimatedLatencyMs: selected.latencySLA,
    fallbackAgentId: fallback?.id,
  }
}

export function estimateMonthlyCost(agentId: string, callsPerDay: number): {
  estimatedMonthlyUsd: number
  withinBudget: boolean
  budgetUtilization: number
} {
  const agent = AGENT_REGISTRY[agentId]
  if (!agent) return { estimatedMonthlyUsd: 0, withinBudget: true, budgetUtilization: 0 }

  const costPerCall = (agent.costPer1kInputTokens * 2 + agent.costPer1kOutputTokens) / 1000 * agent.maxTokens
  const estimatedMonthlyUsd = costPerCall * callsPerDay * 30
  const withinBudget = !agent.monthlyTokenBudget ||
    (agent.maxTokens * callsPerDay * 30) <= agent.monthlyTokenBudget
  const budgetUtilization = agent.monthlyTokenBudget
    ? (agent.maxTokens * callsPerDay * 30) / agent.monthlyTokenBudget
    : 0

  return { estimatedMonthlyUsd, withinBudget, budgetUtilization }
}
