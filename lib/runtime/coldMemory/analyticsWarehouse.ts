// AGENCY GROUP — SH-ROS coldMemory: analyticsWarehouse | AMI: 22506
// Long-term analytics queries — KPI trends, pipeline velocity, conversion funnels
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import logger from '@/lib/logger'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabaseAdmin as any

// ─── Types ────────────────────────────────────────────────────────────────────

export interface KPITrendPoint {
  date: string
  value: number
  delta_pct?: number
}

export interface PipelineVelocityData {
  avg_days_per_stage: Record<string, number>
  bottleneck_stage: string
  velocity_trend: 'improving' | 'stable' | 'degrading'
}

export interface ConversionFunnelData {
  stages: Array<{
    name: string
    count: number
    conversion_rate: number
  }>
}

export interface RevenueAttributionData {
  by_source: Record<string, number>
  by_agent: Record<string, number>
  total_eur: number
  avg_deal_eur: number
}

export interface AgentPerformanceData {
  agents: Array<{
    agent_email: string
    deals_closed: number
    revenue_eur: number
    avg_days_to_close: number
    conversion_rate: number
  }>
}

// ─── Warehouse ────────────────────────────────────────────────────────────────

export class AnalyticsWarehouse {
  /**
   * Query KPI trend over a rolling window.
   * Aggregates daily totals from learning_events.
   */
  async queryKPITrend(
    org_id: string,
    metric: string,
    period_days: number
  ): Promise<KPITrendPoint[]> {
    const from = new Date(Date.now() - period_days * 86_400_000).toISOString()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseAdmin.from('learning_events') as any)
      .select('metadata, created_at')
      .eq('org_id', org_id)
      .eq('event_type', 'kpi_snapshot')
      .contains('metadata', { metric })
      .gte('created_at', from)
      .order('created_at', { ascending: true })
      .limit(500)

    if (error) {
      logger.error('[AnalyticsWarehouse] KPI trend query failed', { error, org_id, metric })
      return []
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const points = (data ?? []).map((row: any) => {
      const meta = row.metadata as Record<string, unknown>
      return {
        date: (row.created_at as string).slice(0, 10),
        value: (meta['value'] as number) ?? 0,
      }
    })

    // Add delta_pct
    return points.map((p: { date: string; value: number }, i: number) => ({
      ...p,
      delta_pct:
        i === 0
          ? undefined
          : points[i - 1].value !== 0
            ? ((p.value - points[i - 1].value) / points[i - 1].value) * 100
            : undefined,
    }))
  }

  /**
   * Query pipeline velocity — average days per stage from deals table.
   */
  async queryPipelineVelocity(
    org_id: string,
    period_days: number
  ): Promise<PipelineVelocityData> {
    const from = new Date(Date.now() - period_days * 86_400_000).toISOString()

    const { data, error } = await sb
      .from('deals')
      .select('stage, created_at, updated_at, status')
      .eq('org_id', org_id)
      .gte('created_at', from)
      .limit(500)

    if (error || !data || data.length === 0) {
      return {
        avg_days_per_stage: {},
        bottleneck_stage: 'unknown',
        velocity_trend: 'stable',
      }
    }

    // Group by stage, compute avg days
    const stageTotals: Record<string, { total_days: number; count: number }> = {}

    for (const deal of data) {
      const stage = deal.stage as string
      const created = new Date(deal.created_at as string).getTime()
      const updated = new Date(deal.updated_at as string).getTime()
      const days = Math.max(0, (updated - created) / 86_400_000)

      if (!stageTotals[stage]) stageTotals[stage] = { total_days: 0, count: 0 }
      stageTotals[stage].total_days += days
      stageTotals[stage].count += 1
    }

    const avg_days_per_stage: Record<string, number> = {}
    let bottleneck_stage = 'unknown'
    let max_days = 0

    for (const [stage, { total_days, count }] of Object.entries(stageTotals)) {
      const avg = count > 0 ? total_days / count : 0
      avg_days_per_stage[stage] = Math.round(avg * 10) / 10
      if (avg > max_days) {
        max_days = avg
        bottleneck_stage = stage
      }
    }

    // Simple trend: compare first half vs second half avg velocity
    const mid = Math.floor(data.length / 2)
    const firstHalf = data.slice(0, mid)
    const secondHalf = data.slice(mid)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const avgAge = (deals: any[]) => {
      if (deals.length === 0) return 0
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const total = deals.reduce((sum: number, d: any) => {
        const diff =
          new Date(d.updated_at as string).getTime() -
          new Date(d.created_at as string).getTime()
        return sum + diff / 86_400_000
      }, 0)
      return total / deals.length
    }

    const firstAvg = avgAge(firstHalf)
    const secondAvg = avgAge(secondHalf)
    let velocity_trend: PipelineVelocityData['velocity_trend'] = 'stable'

    if (firstAvg > 0) {
      const delta = (secondAvg - firstAvg) / firstAvg
      if (delta < -0.1) velocity_trend = 'improving'
      else if (delta > 0.1) velocity_trend = 'degrading'
    }

    return { avg_days_per_stage, bottleneck_stage, velocity_trend }
  }

  /**
   * Query conversion funnel across deal stages.
   */
  async queryConversionFunnel(
    org_id: string,
    period_days: number
  ): Promise<ConversionFunnelData> {
    const from = new Date(Date.now() - period_days * 86_400_000).toISOString()

    const { data, error } = await sb
      .from('deals')
      .select('stage, status')
      .eq('org_id', org_id)
      .gte('created_at', from)

    if (error || !data) {
      return { stages: [] }
    }

    const ORDERED_STAGES = [
      'qualification',
      'price_analysis',
      'visit_scheduled',
      'proposal',
      'negotiation',
      'cpcv_pending',
      'cpcv_signed',
      'escritura_done',
    ]

    const stageCounts: Record<string, number> = {}
    for (const deal of data) {
      const s = deal.stage as string
      stageCounts[s] = (stageCounts[s] ?? 0) + 1
    }

    const total = data.length
    const stages = ORDERED_STAGES.map((name, idx) => {
      const count = stageCounts[name] ?? 0
      const prev_count = idx === 0 ? total : (stageCounts[ORDERED_STAGES[idx - 1]] ?? 0)
      const conversion_rate =
        prev_count > 0 ? Math.round((count / prev_count) * 1000) / 10 : 0
      return { name, count, conversion_rate }
    }).filter((s) => s.count > 0)

    return { stages }
  }

  /**
   * Query revenue attribution by source and agent.
   */
  async queryRevenueAttribution(
    org_id: string,
    period_days: number
  ): Promise<RevenueAttributionData> {
    const from = new Date(Date.now() - period_days * 86_400_000).toISOString()

    const { data, error } = await sb
      .from('deals')
      .select('value_eur, source, assigned_to, status')
      .eq('org_id', org_id)
      .eq('status', 'closed_won')
      .gte('created_at', from)

    if (error || !data) {
      return { by_source: {}, by_agent: {}, total_eur: 0, avg_deal_eur: 0 }
    }

    const by_source: Record<string, number> = {}
    const by_agent: Record<string, number> = {}
    let total_eur = 0

    for (const deal of data) {
      const value = (deal.value_eur as number) ?? 0
      total_eur += value

      const source = (deal.source as string) ?? 'unknown'
      by_source[source] = (by_source[source] ?? 0) + value

      const agent = (deal.assigned_to as string) ?? 'unassigned'
      by_agent[agent] = (by_agent[agent] ?? 0) + value
    }

    return {
      by_source,
      by_agent,
      total_eur,
      avg_deal_eur: data.length > 0 ? total_eur / data.length : 0,
    }
  }

  /**
   * Query agent performance over a period.
   */
  async queryAgentPerformance(
    org_id: string,
    period_days: number
  ): Promise<AgentPerformanceData> {
    const from = new Date(Date.now() - period_days * 86_400_000).toISOString()

    const { data, error } = await sb
      .from('deals')
      .select('value_eur, assigned_to, status, created_at, updated_at')
      .eq('org_id', org_id)
      .gte('created_at', from)

    if (error || !data) {
      return { agents: [] }
    }

    const agentMap: Record<
      string,
      { closed: number; revenue: number; total_days: number; total: number }
    > = {}

    for (const deal of data) {
      const agent = (deal.assigned_to as string) ?? 'unassigned'
      if (!agentMap[agent]) {
        agentMap[agent] = { closed: 0, revenue: 0, total_days: 0, total: 0 }
      }

      agentMap[agent].total += 1

      if (deal.status === 'closed_won') {
        const days =
          (new Date(deal.updated_at as string).getTime() -
            new Date(deal.created_at as string).getTime()) /
          86_400_000
        agentMap[agent].closed += 1
        agentMap[agent].revenue += (deal.value_eur as number) ?? 0
        agentMap[agent].total_days += days
      }
    }

    const agents = Object.entries(agentMap).map(([agent_email, stats]) => ({
      agent_email,
      deals_closed: stats.closed,
      revenue_eur: stats.revenue,
      avg_days_to_close:
        stats.closed > 0 ? Math.round((stats.total_days / stats.closed) * 10) / 10 : 0,
      conversion_rate:
        stats.total > 0 ? Math.round((stats.closed / stats.total) * 1000) / 10 : 0,
    }))

    return {
      agents: agents.sort((a, b) => b.revenue_eur - a.revenue_eur),
    }
  }
}

export const analyticsWarehouse = new AnalyticsWarehouse()
