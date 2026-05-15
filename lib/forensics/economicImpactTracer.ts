// AGENCY GROUP — SH-ROS Ω∞∞ Forensics: economicImpactTracer | AMI: 22506
// Traces economic impact of any event backward and forward through the system
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import logger from '@/lib/logger'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabaseAdmin as any

export interface EconomicImpactTrace {
  trigger_event_id: string
  org_id: string
  direct_revenue_eur: number
  indirect_revenue_eur: number
  total_revenue_eur: number
  revenue_chain: Array<{
    event_id: string
    event_type: string
    revenue_contribution_eur: number
    contribution_pct: number
    deal_id?: string
  }>
  cost_eur: number
  net_economic_value_eur: number
  roi_multiplier: number
  time_to_revenue_days: number
}

const COST_PER_EVENT_EUR = 0.001

export class EconomicImpactTracer {
  async traceEvent(
    event_id: string,
    org_id: string
  ): Promise<EconomicImpactTrace> {
    // Find all downstream deals linked to this event
    const { data: eventData } = await sb
      .from('learning_events')
      .select('metadata, created_at')
      .eq('org_id', org_id)
      .contains('metadata', { event_id })
      .limit(1)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ev = (eventData ?? [])[0] as any
    const ev_meta = (ev?.metadata as Record<string, unknown>) ?? {}
    const ev_created = ev?.created_at as string | undefined

    // Find deals that reference this event in their event_chain
    const { data: dealsData } = await sb
      .from('learning_events')
      .select('metadata, created_at, event_type')
      .eq('org_id', org_id)
      .order('created_at', { ascending: true })
      .limit(100)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allEvents: any[] = dealsData ?? []

    // Filter events that mention this event_id in their chain
    const downstream = allEvents.filter((e: any) => {
      const meta = (e.metadata as Record<string, unknown>) ?? {}
      const chain = (meta['event_chain'] as string[]) ?? []
      return chain.includes(event_id) || meta['parent_event_id'] === event_id
    })

    let direct_revenue_eur = (ev_meta['revenue_impact_eur'] as number) ?? 0
    let indirect_revenue_eur = 0
    const revenue_chain: EconomicImpactTrace['revenue_chain'] = []

    for (const e of downstream) {
      const meta = (e.metadata as Record<string, unknown>) ?? {}
      const ev_rev = (meta['revenue_impact_eur'] as number) ?? 0
      indirect_revenue_eur += ev_rev

      const eid = (meta['event_id'] as string) ?? `e-${revenue_chain.length}`
      revenue_chain.push({
        event_id: eid,
        event_type: e.event_type as string,
        revenue_contribution_eur: ev_rev,
        contribution_pct: 0, // filled below
        deal_id: (meta['deal_id'] as string) ?? undefined,
      })
    }

    const total_revenue_eur = direct_revenue_eur + indirect_revenue_eur

    // Fill contribution_pct
    for (const item of revenue_chain) {
      item.contribution_pct = total_revenue_eur > 0
        ? Math.round((item.revenue_contribution_eur / total_revenue_eur) * 1000) / 10
        : 0
    }

    const cost_eur = (1 + downstream.length) * COST_PER_EVENT_EUR
    const net_economic_value_eur = total_revenue_eur - cost_eur
    const roi_multiplier = cost_eur > 0
      ? Math.round((total_revenue_eur / cost_eur) * 10) / 10
      : 0

    // Time to revenue
    let time_to_revenue_days = 0
    if (ev_created && revenue_chain.length > 0) {
      // Find most recent downstream event with revenue
      const lastRevEvent = downstream
        .filter((e: any) => ((e.metadata as Record<string, unknown>)?.['revenue_impact_eur'] as number) > 0)
        .sort((a: any, b: any) => (b.created_at as string).localeCompare(a.created_at as string))[0]
      if (lastRevEvent) {
        time_to_revenue_days = Math.max(0,
          (new Date(lastRevEvent.created_at as string).getTime() - new Date(ev_created).getTime()) / 86_400_000
        )
      }
    }

    logger.info('[EconomicImpactTracer] Trace complete', { event_id, org_id, total_revenue_eur })

    return {
      trigger_event_id: event_id, org_id,
      direct_revenue_eur: Math.round(direct_revenue_eur * 100) / 100,
      indirect_revenue_eur: Math.round(indirect_revenue_eur * 100) / 100,
      total_revenue_eur: Math.round(total_revenue_eur * 100) / 100,
      revenue_chain,
      cost_eur: Math.round(cost_eur * 10000) / 10000,
      net_economic_value_eur: Math.round(net_economic_value_eur * 100) / 100,
      roi_multiplier,
      time_to_revenue_days: Math.round(time_to_revenue_days * 10) / 10,
    }
  }

  async traceAgent(
    agent_id: string,
    org_id: string,
    period_days = 30
  ): Promise<EconomicImpactTrace[]> {
    const from = new Date(Date.now() - period_days * 86_400_000).toISOString()

    const { data } = await sb
      .from('learning_events')
      .select('metadata')
      .eq('org_id', org_id)
      .contains('metadata', { agent_id })
      .gte('created_at', from)
      .limit(200)

    const traces: EconomicImpactTrace[] = []
    const seen = new Set<string>()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const e of (data ?? []) as any[]) {
      const meta = (e.metadata as Record<string, unknown>) ?? {}
      const eid = (meta['event_id'] as string) ?? null
      if (eid && !seen.has(eid)) {
        seen.add(eid)
        traces.push(await this.traceEvent(eid, org_id))
      }
    }

    return traces
  }
}

export const economicImpactTracer = new EconomicImpactTracer()
