// =============================================================================
// AGENCY GROUP — Agent Framework Public API
// SH-ROS Runtime Core — 16 production agents across 5 layers
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
import { ForecastingAgent }             from './implementations/forecastingAgent'

// ─── Sales Execution Layer ────────────────────────────────────────────────────
import { FollowUpAgent }                from './implementations/followUpAgent'
import { PipelineStallAgent }           from './implementations/pipelineStallAgent'
import { DealClosingAgent }             from './implementations/dealClosingAgent'
import { LeadQualificationAgent }       from './implementations/leadQualificationAgent'

// ─── System Automation Layer ──────────────────────────────────────────────────
import { WorkflowAutomationAgent }      from './implementations/workflowAutomationAgent'
import { SystemHealthAgent }            from './implementations/systemHealthAgent'
import { DataIntegrityAgent }           from './implementations/dataIntegrityAgent'
import { AgentSupervisor }              from './implementations/agentSupervisor'

// ─── Strategy & Analytics Layer ───────────────────────────────────────────────
import { KpiIntelligenceAgent }         from './implementations/kpiIntelligenceAgent'
import { GrowthStrategyAgent }          from './implementations/growthStrategyAgent'

// ─── Governance Layer ─────────────────────────────────────────────────────────
import { RiskGovernanceAgent }          from './implementations/riskGovernanceAgent'
import { DecisionArbitrationAgent }     from './implementations/decisionArbitrationAgent'

// ─── Register all production agents ──────────────────────────────────────────

// Revenue Intelligence
agentRegistry.register(new RevenueLeakAgent())
agentRegistry.register(new ConversionOptimizationAgent())
agentRegistry.register(new PricingStrategyAgent())
agentRegistry.register(new ForecastingAgent())

// Sales Execution
agentRegistry.register(new FollowUpAgent())
agentRegistry.register(new PipelineStallAgent())
agentRegistry.register(new DealClosingAgent())
agentRegistry.register(new LeadQualificationAgent())

// System Automation
agentRegistry.register(new WorkflowAutomationAgent())
agentRegistry.register(new SystemHealthAgent())
agentRegistry.register(new DataIntegrityAgent())
agentRegistry.register(new AgentSupervisor())

// Strategy & Analytics
agentRegistry.register(new KpiIntelligenceAgent())
agentRegistry.register(new GrowthStrategyAgent())

// Governance
agentRegistry.register(new RiskGovernanceAgent())
agentRegistry.register(new DecisionArbitrationAgent())

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
