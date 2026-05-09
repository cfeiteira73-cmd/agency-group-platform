// =============================================================================
// AGENCY GROUP — Agent Registry v1.0
// Central registry for all SH-ROS operational agents
// AMI: 22506
// =============================================================================

import type { AgentId, AgentRegistration } from './types'
import type { BaseAgent } from './base'

class AgentRegistry {
  private agents = new Map<AgentId, BaseAgent>()

  register(agent: BaseAgent): void {
    this.agents.set(agent.id, agent)
  }

  get(id: AgentId): BaseAgent | undefined {
    return this.agents.get(id)
  }

  getAll(): BaseAgent[] {
    return [...this.agents.values()]
  }

  list(): AgentRegistration[] {
    return [...this.agents.values()].map(a => ({
      id:          a.id,
      name:        a.name,
      description: a.description,
      config:      a.config,
      tags:        [],
    }))
  }

  has(id: AgentId): boolean {
    return this.agents.has(id)
  }
}

export const agentRegistry = new AgentRegistry()
