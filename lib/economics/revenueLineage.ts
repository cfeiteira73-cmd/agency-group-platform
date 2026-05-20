// AGENCY GROUP — SH-ROS Ω∞∞ Economics: revenueLineage | AMI: 22506
// Revenue lineage graph — DAG from lead to close
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import logger from '@/lib/logger'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabaseAdmin as any

export interface LineageNode {
  id: string
  type: 'lead' | 'contact' | 'deal' | 'workflow' | 'agent_action' | 'event'
  label: string
  timestamp: string
  value_eur?: number
}

export interface LineageEdge {
  from_id: string
  to_id: string
  relationship: string
  delay_ms?: number
}

export interface RevenueLineageGraph {
  org_id: string
  root_lead_id: string
  nodes: LineageNode[]
  edges: LineageEdge[]
  total_revenue_eur: number
  total_duration_days: number
  critical_path: string[]
}

export class RevenueLineageBuilder {
  async buildLineage(
    lead_id: string,
    org_id: string
  ): Promise<RevenueLineageGraph> {
    const nodes: LineageNode[] = []
    const edges: LineageEdge[] = []

    // 1. Root contact node
    const { data: contact } = await sb
      .from('contacts')
      .select('id, full_name, email, created_at')
      .eq('id', lead_id)
      .eq('tenant_id', org_id)
      .single()

    if (!contact) {
      logger.warn('[RevenueLineage] Contact not found', { lead_id, org_id })
      return this._empty(lead_id, org_id)
    }

    nodes.push({
      id: lead_id,
      type: 'contact',
      label: (contact.full_name as string) ?? (contact.email as string) ?? lead_id,
      timestamp: contact.created_at as string,
    })

    // 2. Deals for this contact
    const { data: deals } = await sb
      .from('deals')
      .select('id, deal_value, fase, created_at, actual_close_date, assigned_consultant')
      .eq('contact_id', lead_id)
      .eq('tenant_id', org_id)
      .limit(20)

    const CLOSED_STAGES = ['post_sale', 'escritura', 'escritura_sell']
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dealData: any[] = deals ?? []
    let total_revenue_eur = 0

    for (const deal of dealData) {
      const deal_id = deal.id as string
      const val = (deal.deal_value as number) ?? 0
      if (CLOSED_STAGES.includes(deal.fase as string)) total_revenue_eur += val

      nodes.push({
        id: deal_id,
        type: 'deal',
        label: `Deal ${deal_id.slice(0, 8)} — ${deal.fase}`,
        timestamp: deal.created_at as string,
        value_eur: val,
      })
      edges.push({
        from_id: lead_id,
        to_id: deal_id,
        relationship: 'has_deal',
        delay_ms: Math.max(0,
          new Date(deal.created_at as string).getTime() -
          new Date(contact.created_at as string).getTime()
        ) as number,
      })
    }

    // 3. Learning events linked to this contact
    const { data: events } = await sb
      .from('learning_events')
      .select('metadata, created_at, event_type')
      .eq('tenant_id', org_id)
      .contains('metadata', { contact_id: lead_id })
      .order('created_at', { ascending: true })
      .limit(50)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const evArr: any[] = events ?? []
    let prev_event_id: string | null = null

    for (const ev of evArr) {
      const meta = (ev.metadata as Record<string, unknown>) ?? {}
      const ev_id = (meta['event_id'] as string) ?? `ev-${nodes.length}`
      nodes.push({
        id: ev_id,
        type: 'event',
        label: (ev.event_type as string) ?? 'event',
        timestamp: ev.created_at as string,
      })
      if (prev_event_id) {
        edges.push({ from_id: prev_event_id, to_id: ev_id, relationship: 'followed_by' })
      } else {
        edges.push({ from_id: lead_id, to_id: ev_id, relationship: 'triggered' })
      }
      prev_event_id = ev_id
    }

    // Total duration
    const all_timestamps = nodes.map((n) => new Date(n.timestamp).getTime())
    const total_duration_days = all_timestamps.length >= 2
      ? (Math.max(...all_timestamps) - Math.min(...all_timestamps)) / 86_400_000
      : 0

    const critical_path = this.findCriticalPath({ org_id, root_lead_id: lead_id, nodes, edges,
      total_revenue_eur, total_duration_days, critical_path: [] })

    logger.info('[RevenueLineage] Graph built', { lead_id, org_id, nodes: nodes.length })

    return { org_id, root_lead_id: lead_id, nodes, edges, total_revenue_eur, total_duration_days, critical_path }
  }

  findCriticalPath(graph: RevenueLineageGraph): string[] {
    // Longest path in the node chain (nodes with type 'deal' carrying value_eur)
    return graph.nodes
      .filter((n) => n.type === 'deal' && (n.value_eur ?? 0) > 0)
      .sort((a, b) => (b.value_eur ?? 0) - (a.value_eur ?? 0))
      .map((n) => n.id)
  }

  private _empty(root_lead_id: string, org_id: string): RevenueLineageGraph {
    return { org_id, root_lead_id, nodes: [], edges: [], total_revenue_eur: 0,
      total_duration_days: 0, critical_path: [] }
  }
}

export const revenueLineageBuilder = new RevenueLineageBuilder()
