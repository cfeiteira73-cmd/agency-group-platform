// AGENCY GROUP — SH-ROS Ω∞∞ Forensics: causalGraph | AMI: 22506
// Directed causal graphs — what caused what through the system
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import logger from '@/lib/logger'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabaseAdmin as any

export interface CausalNode {
  id: string
  type: 'event' | 'agent_action' | 'workflow' | 'decision' | 'external_trigger'
  label: string
  timestamp: string
  org_id: string
  economic_impact_eur?: number
  outcome?: 'positive' | 'negative' | 'neutral'
}

export interface CausalEdge {
  from_id: string
  to_id: string
  causality_type: 'triggers' | 'caused_by' | 'correlates_with' | 'blocks' | 'enables'
  confidence: number
  delay_ms?: number
}

export interface CausalGraphData {
  org_id: string
  root_cause_node_id: string
  terminal_outcome_node_id?: string
  nodes: CausalNode[]
  edges: CausalEdge[]
  depth: number
  total_economic_impact_eur: number
  confidence_score: number
}

export class CausalGraphBuilder {
  async buildFromEvent(
    event_id: string,
    org_id: string,
    depth = 3
  ): Promise<CausalGraphData> {
    const nodes: CausalNode[] = []
    const edges: CausalEdge[] = []
    const visited = new Set<string>()

    await this._traverseForward(event_id, org_id, nodes, edges, visited, 0, depth)

    const total_economic_impact_eur = nodes
      .filter((n) => n.outcome === 'positive')
      .reduce((s, n) => s + (n.economic_impact_eur ?? 0), 0)

    const confidence_score = nodes.length > 0
      ? edges.reduce((s, e) => s + e.confidence, 0) / Math.max(1, edges.length)
      : 0

    // Terminal outcome = last positive node
    const terminal = nodes
      .filter((n) => n.outcome === 'positive')
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0]

    logger.info('[CausalGraph] Built', { event_id, org_id, nodes: nodes.length })

    return {
      org_id,
      root_cause_node_id: event_id,
      terminal_outcome_node_id: terminal?.id,
      nodes,
      edges,
      depth,
      total_economic_impact_eur: Math.round(total_economic_impact_eur * 100) / 100,
      confidence_score: Math.round(confidence_score * 1000) / 1000,
    }
  }

  async findRootCause(
    outcome_event_id: string,
    org_id: string
  ): Promise<CausalNode | null> {
    const { data } = await sb
      .from('learning_events')
      .select('metadata, created_at, event_type')
      .eq('org_id', org_id)
      .order('created_at', { ascending: true })
      .limit(500)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const events: any[] = data ?? []
    if (events.length === 0) return null

    // Root cause = earliest event in the chain
    const earliest = events[0]
    const meta = (earliest.metadata as Record<string, unknown>) ?? {}
    return {
      id: (meta['event_id'] as string) ?? 'root',
      type: 'event',
      label: earliest.event_type as string,
      timestamp: earliest.created_at as string,
      org_id,
      outcome: 'neutral',
    }
  }

  computeEconomicImpact(graph: CausalGraphData): number {
    return graph.nodes
      .filter((n) => n.outcome === 'positive')
      .reduce((s, n) => s + (n.economic_impact_eur ?? 0), 0)
  }

  private async _traverseForward(
    event_id: string,
    org_id: string,
    nodes: CausalNode[],
    edges: CausalEdge[],
    visited: Set<string>,
    current_depth: number,
    max_depth: number
  ): Promise<void> {
    if (current_depth >= max_depth || visited.has(event_id)) return
    visited.add(event_id)

    // Fetch this event
    const { data } = await sb
      .from('learning_events')
      .select('metadata, created_at, event_type')
      .eq('org_id', org_id)
      .contains('metadata', { event_id })
      .limit(1)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ev = (data ?? [])[0] as any
    if (!ev) return

    const meta = (ev.metadata as Record<string, unknown>) ?? {}
    const ev_score = (meta['ev_score'] as number) ?? 0
    const outcome = ev_score > 0.7 ? 'positive' : ev_score < 0.3 ? 'negative' : 'neutral'

    nodes.push({
      id: event_id,
      type: this._classifyType(ev.event_type as string),
      label: ev.event_type as string,
      timestamp: ev.created_at as string,
      org_id,
      economic_impact_eur: (meta['financial_impact'] as number) ?? 0,
      outcome,
    })

    // Find events in the event_chain that reference this event
    const { data: downstream } = await sb
      .from('learning_events')
      .select('metadata, created_at, event_type')
      .eq('org_id', org_id)
      .contains('metadata', { parent_event_id: event_id })
      .limit(10)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const next of (downstream ?? []) as any[]) {
      const nextMeta = (next.metadata as Record<string, unknown>) ?? {}
      const next_id = (nextMeta['event_id'] as string) ?? `ev-${Math.random()}`
      edges.push({
        from_id: event_id,
        to_id: next_id,
        causality_type: 'triggers',
        confidence: 0.8,
        delay_ms: Math.max(0,
          new Date(next.created_at as string).getTime() -
          new Date(ev.created_at as string).getTime()
        ),
      })
      await this._traverseForward(next_id, org_id, nodes, edges, visited, current_depth + 1, max_depth)
    }
  }

  private _classifyType(event_type: string): CausalNode['type'] {
    if (event_type.includes('workflow')) return 'workflow'
    if (event_type.includes('agent')) return 'agent_action'
    if (event_type.includes('decision') || event_type.includes('ev_computed')) return 'decision'
    if (event_type.includes('webhook') || event_type.includes('external')) return 'external_trigger'
    return 'event'
  }
}

export const causalGraphBuilder = new CausalGraphBuilder()
