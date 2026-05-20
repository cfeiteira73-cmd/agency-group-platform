// AGENCY GROUP — SH-ROS Ω∞∞ Economics: revenueAttribution | AMI: 22506
// Revenue attribution engine — traces every closed deal to its event chain
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import logger from '@/lib/logger'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabaseAdmin as any

export type AttributionModel = 'linear' | 'time_decay' | 'first_touch' | 'last_touch'

export interface AttributionNode {
  event_id: string
  event_type: string
  agent_id: string
  timestamp: string
  contribution_pct: number
  revenue_eur: number
}

export interface RevenueAttributionReport {
  deal_id: string
  total_revenue_eur: number
  attribution_chain: AttributionNode[]
  first_touch_agent: string
  last_touch_agent: string
  attributed_by_source: Record<string, number>
  attributed_by_agent: Record<string, number>
  days_to_close: number
  attribution_model: AttributionModel
}

export class RevenueAttributionEngine {
  async attributeDeal(
    deal_id: string,
    org_id: string,
    model: AttributionModel = 'linear'
  ): Promise<RevenueAttributionReport> {
    const { data: deal } = await sb
      .from('deals')
      .select('id, value_eur, source, assigned_to, status, created_at, updated_at')
      .eq('id', deal_id)
      .eq('org_id', org_id)
      .single()

    if (!deal) return this._empty(deal_id, model)

    const { data: events } = await sb
      .from('learning_events')
      .select('deal_id, metadata, created_at')
      .eq('org_id', org_id)
      .contains('metadata', { deal_id })
      .order('created_at', { ascending: true })
      .limit(100)

    return this._attributeDealFromEvents(deal, events ?? [], model)
  }

  /**
   * Pure helper: compute attribution from pre-fetched event rows.
   * No DB calls — safe to call inside a map().
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _attributeDealFromEvents(deal: any, events: any[], model: AttributionModel): RevenueAttributionReport {
    const deal_id = deal.id as string
    const value_eur = (deal.value_eur as number) ?? 0
    const days_to_close = Math.max(
      0,
      (new Date(deal.updated_at as string).getTime() -
        new Date(deal.created_at as string).getTime()) /
        86_400_000
    )

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chain: AttributionNode[] = events.map((e: any, i: number) => {
      const meta = (e.metadata as Record<string, unknown>) ?? {}
      const pct = this._contribution(model, i, events.length)
      return {
        event_id: (meta['event_id'] as string) ?? `evt-${i}`,
        event_type: (meta['event_type'] as string) ?? 'unknown',
        agent_id: (meta['agent_id'] as string) ?? (deal.assigned_to as string) ?? 'system',
        timestamp: e.created_at as string,
        contribution_pct: pct,
        revenue_eur: Math.round(value_eur * (pct / 100) * 100) / 100,
      }
    })

    const first_touch = chain[0]?.agent_id ?? (deal.assigned_to as string) ?? 'unassigned'
    const last_touch = chain[chain.length - 1]?.agent_id ?? (deal.assigned_to as string) ?? 'unassigned'
    const source = (deal.source as string) ?? 'unknown'
    const attributed_by_agent: Record<string, number> = {}
    for (const n of chain) {
      attributed_by_agent[n.agent_id] = (attributed_by_agent[n.agent_id] ?? 0) + n.revenue_eur
    }
    if (chain.length === 0) attributed_by_agent[last_touch] = value_eur

    return {
      deal_id,
      total_revenue_eur: value_eur,
      attribution_chain: chain,
      first_touch_agent: first_touch,
      last_touch_agent: last_touch,
      attributed_by_source: { [source]: value_eur },
      attributed_by_agent,
      days_to_close,
      attribution_model: model,
    }
  }

  async batchAttributeOrg(
    org_id: string,
    period_days: number,
    model: AttributionModel = 'linear'
  ): Promise<RevenueAttributionReport[]> {
    const from = new Date(Date.now() - period_days * 86_400_000).toISOString()

    // Query 1: fetch all closed deals in the period
    const { data: dealsData, error } = await sb
      .from('deals')
      .select('id, value_eur, source, assigned_to, status, created_at, updated_at')
      .eq('org_id', org_id)
      .eq('status', 'closed_won')
      .gte('updated_at', from)
      .limit(200)

    if (error || !dealsData) {
      logger.error('[RevenueAttribution] Batch query failed', { error, org_id })
      return []
    }

    const deals = dealsData as Array<{
      id: string; value_eur: number; source: string
      assigned_to: string; status: string; created_at: string; updated_at: string
    }>

    if (deals.length === 0) return []

    // Query 2: fetch ALL learning_events for all deals in ONE query
    const dealIds = deals.map(d => d.id)
    const { data: allEvents } = await sb
      .from('learning_events')
      .select('deal_id, metadata, created_at')
      .eq('org_id', org_id)
      .in('deal_id', dealIds)
      .order('created_at', { ascending: true })
      .limit(2000)

    // Build O(1) lookup map: deal_id → sorted event rows
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const eventsByDeal = new Map<string, any[]>()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const ev of (allEvents ?? []) as any[]) {
      const did = ev.deal_id as string | undefined
      if (!did) continue
      const arr = eventsByDeal.get(did) ?? []
      arr.push(ev)
      eventsByDeal.set(did, arr)
    }

    // Compute attribution per deal using in-memory map — no further DB calls
    const results = deals.map(deal =>
      this._attributeDealFromEvents(deal, eventsByDeal.get(deal.id) ?? [], model)
    )

    logger.info('[RevenueAttribution] Batch done', { org_id, count: results.length })
    return results
  }

  async getTopAttributedAgents(
    org_id: string,
    period_days: number
  ): Promise<Array<{ agent_id: string; total_revenue_eur: number; deals_attributed: number }>> {
    const reports = await this.batchAttributeOrg(org_id, period_days)
    const map: Record<string, { total: number; count: number }> = {}
    for (const r of reports) {
      for (const [agent_id, rev] of Object.entries(r.attributed_by_agent)) {
        if (!map[agent_id]) map[agent_id] = { total: 0, count: 0 }
        map[agent_id].total += rev
        map[agent_id].count += 1
      }
    }
    return Object.entries(map)
      .map(([agent_id, { total, count }]) => ({
        agent_id,
        total_revenue_eur: Math.round(total * 100) / 100,
        deals_attributed: count,
      }))
      .sort((a, b) => b.total_revenue_eur - a.total_revenue_eur)
  }

  private _contribution(model: AttributionModel, i: number, total: number): number {
    if (total <= 1) return 100
    switch (model) {
      case 'linear': {
        const base = Math.round((100 / total) * 10) / 10
        // Last element absorbs rounding remainder so all nodes always sum to 100%
        if (i === total - 1) {
          return Math.round((100 - base * (total - 1)) * 10) / 10
        }
        return base
      }
      case 'first_touch': return i === 0 ? 100 : 0
      case 'last_touch': return i === total - 1 ? 100 : 0
      case 'time_decay': {
        const w = Math.pow(2, i)
        const tw = Math.pow(2, total) - 1
        return Math.round((w / tw) * 1000) / 10
      }
    }
  }

  private _empty(deal_id: string, model: AttributionModel): RevenueAttributionReport {
    return { deal_id, total_revenue_eur: 0, attribution_chain: [], first_touch_agent: 'unknown',
      last_touch_agent: 'unknown', attributed_by_source: {}, attributed_by_agent: {},
      days_to_close: 0, attribution_model: model }
  }
}

export const revenueAttributionEngine = new RevenueAttributionEngine()
