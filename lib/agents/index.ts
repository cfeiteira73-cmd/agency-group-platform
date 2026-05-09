// =============================================================================
// AGENCY GROUP — Agent Framework Public API
// SH-ROS Runtime Core — 11 production agents across 4 layers
// Usage: import { agentRegistry, runAgent } from '@/lib/agents'
// AMI: 22506
// =============================================================================

export { BaseAgent } from './base'
export { agentRegistry } from './registry'
import { agentRegistry } from './registry'
export type {
  AgentId, AgentContext, AgentResult, AgentInsight,
  AgentAction, AgentConfig, AgentStatus, AgentOutputContract,
} from './types'

// ─── Revenue Intelligence Layer ───────────────────────────────────────────────
import { RevenueLeakAgent }             from './implementations/revenueLeakAgent'
import { ConversionOptimizationAgent }  from './implementations/conversionOptimizationAgent'
import { PricingStrategyAgent }         from './implementations/pricingStrategyAgent'

// ─── Sales Execution Layer ────────────────────────────────────────────────────
import { FollowUpAgent }                from './implementations/followUpAgent'
import { PipelineStallAgent }           from './implementations/pipelineStallAgent'
import { DealClosingAgent }             from './implementations/dealClosingAgent'

// ─── System Automation Layer ──────────────────────────────────────────────────
import { WorkflowAutomationAgent }      from './implementations/workflowAutomationAgent'
import { SystemHealthAgent }            from './implementations/systemHealthAgent'
import { DataIntegrityAgent }           from './implementations/dataIntegrityAgent'

// ─── Strategy & Analytics Layer ───────────────────────────────────────────────
import { KpiIntelligenceAgent }          from './implementations/kpiIntelligenceAgent'
import { GrowthStrategyAgent }          from './implementations/growthStrategyAgent'

// ─── Register all production agents ──────────────────────────────────────────
agentRegistry.register(new RevenueLeakAgent())
agentRegistry.register(new ConversionOptimizationAgent())
agentRegistry.register(new PricingStrategyAgent())
agentRegistry.register(new FollowUpAgent())
agentRegistry.register(new PipelineStallAgent())
agentRegistry.register(new DealClosingAgent())
agentRegistry.register(new WorkflowAutomationAgent())
agentRegistry.register(new SystemHealthAgent())
agentRegistry.register(new DataIntegrityAgent())
agentRegistry.register(new KpiIntelligenceAgent())
agentRegistry.register(new GrowthStrategyAgent())

// ─── Convenience runner ───────────────────────────────────────────────────────

import type { AgentContext } from './types'
import { BaseAgent as _Base } from './base'

export async function runAgent(
  id: import('./types').AgentId,
  ctx: Partial<AgentContext> & { org_id?: string } = {}
) {
  const agent = agentRegistry.get(id)
  if (!agent) throw new Error(`Agent "${id}" not registered`)
  return agent.run(_Base.createContext(ctx))
}
