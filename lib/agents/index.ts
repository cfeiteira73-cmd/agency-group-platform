// =============================================================================
// AGENCY GROUP — Agent Framework Public API
// Usage: import { agentRegistry, BaseAgent, runAgent } from '@/lib/agents'
// =============================================================================

export { BaseAgent } from './base'
export { agentRegistry } from './registry'
import { agentRegistry } from './registry'
export type {
  AgentId, AgentContext, AgentResult, AgentInsight,
  AgentAction, AgentConfig, AgentStatus,
} from './types'

// ─── Register production agents ──────────────────────────────────────────────
import { RevenueLeakAgent }    from './implementations/revenueLeakAgent'
import { FollowUpAgent }        from './implementations/followUpAgent'
import { PipelineStallAgent }   from './implementations/pipelineStallAgent'

agentRegistry.register(new RevenueLeakAgent())
agentRegistry.register(new FollowUpAgent())
agentRegistry.register(new PipelineStallAgent())

// ─── Convenience runner ───────────────────────────────────────────────────────

import type { AgentContext } from './types'
import { BaseAgent as _Base } from './base'

export async function runAgent(
  id: import('./types').AgentId,
  ctx: Partial<AgentContext> = {}
) {
  const agent = agentRegistry.get(id)
  if (!agent) throw new Error(`Agent "${id}" not registered`)
  return agent.run(_Base.createContext(ctx))
}
