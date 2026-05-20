// AGENCY GROUP — SH-ROS Product: Revenue Outcome Mapper | AMI: 22506
// Maps all system activity to financial outcomes in real time
// Every event, match, and action has a € value attached
// The north star: "is the system generating revenue?"
// =============================================================================

import { supabaseAdmin }           from '@/lib/supabase'
import { businessPrimitiveEngine } from './businessPrimitiveEngine'
import logger from '@/lib/logger'
import { COMMISSION_RATE } from '@/lib/constants/pipeline'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RevenueEvent {
  event_id:        string
  org_id:          string
  event_type:      RevenueEventType
  entity_id:       string
  gross_value:     number         // € deal value
  commission:      number         // gross × 5%
  probability:     number         // 0–1
  expected_value:  number         // gross × probability
  stage:           string
  recorded_at:     string
}

export type RevenueEventType =
  | 'lead_created'
  | 'lead_qualified'
  | 'match_created'
  | 'match_accepted'
  | 'proposal_sent'
  | 'proposal_accepted'
  | 'negotiation_started'
  | 'deal_closed_won'
  | 'deal_closed_lost'
  | 'cpcv_signed'
  | 'escritura_completed'

export interface RevenueFunnel {
  org_id:         string
  period:         string
  stages: {
    stage:          string
    count:          number
    total_value:    number
    conversion_rate: number    // to next stage
    avg_days:       number
    revenue_at_risk: number    // lost if this stage drops
  }[]
  total_pipeline:   number
  total_expected:   number
  projected_revenue: number   // Monte Carlo style estimate
  computed_at:      string
}

export interface RevenueAttribution {
  org_id:          string
  period:          string
  by_source: {
    source:        string   // 'organic', 'referral', 'cold_outreach', etc.
    deals:         number
    revenue:       number
    commission:    number
  }[]
  by_agent: {
    agent_id:      string
    deals:         number
    revenue:       number
    close_rate:    number
  }[]
  total_revenue:   number
  total_commission: number
}

export interface DailyRevenueTarget {
  org_id:          string
  date:            string
  target:          number        // daily commission target
  actual:          number        // commission earned today
  pipeline_contribution: number  // expected from pipeline movement
  on_track:        boolean
  gap:             number        // target - actual (negative = ahead)
  recommended_actions: string[]
}

// ─── Stage Probabilities (Portugal 2026) ─────────────────────────────────────

const STAGE_PROBABILITIES: Record<string, number> = {
  lead_created:         0.05,
  lead_qualified:       0.12,
  match_created:        0.18,
  match_accepted:       0.30,
  proposal_sent:        0.40,
  proposal_accepted:    0.60,
  negotiation_started:  0.75,
  cpcv_signed:          0.92,
  deal_closed_won:      1.00,
  deal_closed_lost:     0.00,
  escritura_completed:  1.00,
}

const MONTHLY_TARGET  = 50_000 // €50K/month commission target per org

// ─── Revenue Outcome Mapper ───────────────────────────────────────────────────

export class RevenueOutcomeMapper {

  /**
   * Map a system event to a revenue event.
   * Every meaningful event has a financial value.
   */
  mapEvent(params: {
    org_id:       string
    event_type:   RevenueEventType
    entity_id:    string
    gross_value?: number
    stage?:       string
  }): RevenueEvent {
    const probability = STAGE_PROBABILITIES[params.event_type] ?? 0.18
    const gross       = params.gross_value ?? 500_000  // default €500K
    const commission  = gross * COMMISSION_RATE
    const expected    = commission * probability

    const event: RevenueEvent = {
      event_id:       `rev:${params.entity_id}:${params.event_type}:${Date.now()}`,
      org_id:         params.org_id,
      event_type:     params.event_type,
      entity_id:      params.entity_id,
      gross_value:    gross,
      commission,
      probability,
      expected_value: expected,
      stage:          params.stage ?? params.event_type,
      recorded_at:    new Date().toISOString(),
    }

    logger.info('[RevenueMapper] Event mapped', {
      org_id:          params.org_id,
      event_type:      params.event_type,
      gross_value:     gross,
      expected_value:  expected.toFixed(0),
    })

    return event
  }

  /**
   * Build revenue funnel for an org.
   * Shows pipeline health as a financial funnel.
   */
  async buildFunnel(org_id: string, period = 'mtd'): Promise<RevenueFunnel> {
    const pipeline = await businessPrimitiveEngine.getPipeline(org_id)
    const now      = new Date().toISOString()

    const stages = [
      {
        stage:           'Leads',
        count:           pipeline.active_leads,
        total_value:     pipeline.active_leads * 500_000,
        conversion_rate: 0.20,
        avg_days:        14,
        revenue_at_risk: pipeline.active_leads * 500_000 * COMMISSION_RATE * 0.20,
      },
      {
        stage:           'Hot Leads (≥80)',
        count:           pipeline.hot_leads,
        total_value:     pipeline.hot_leads * 700_000,
        conversion_rate: 0.45,
        avg_days:        21,
        revenue_at_risk: pipeline.hot_leads * 700_000 * COMMISSION_RATE * 0.45,
      },
      {
        stage:           'Proposals',
        count:           pipeline.proposals_pending,
        total_value:     pipeline.proposals_pending * 650_000,
        conversion_rate: 0.60,
        avg_days:        30,
        revenue_at_risk: pipeline.proposals_pending * 650_000 * COMMISSION_RATE * 0.60,
      },
      {
        stage:           'Active Deals',
        count:           pipeline.deals_in_progress,
        total_value:     pipeline.pipeline_value,
        conversion_rate: 0.75,
        avg_days:        60,
        revenue_at_risk: pipeline.pipeline_value * COMMISSION_RATE * 0.75,
      },
      {
        stage:           'Won MTD',
        count:           pipeline.deals_won_mtd,
        total_value:     pipeline.revenue_mtd,
        conversion_rate: 1.0,
        avg_days:        0,
        revenue_at_risk: 0,
      },
    ]

    const projected_revenue = stages
      .filter(s => s.stage !== 'Won MTD')
      .reduce((s, stage) => s + stage.total_value * COMMISSION_RATE * stage.conversion_rate * 0.3, 0)
      + pipeline.commission_mtd

    return {
      org_id,
      period,
      stages,
      total_pipeline:    pipeline.pipeline_value,
      total_expected:    pipeline.expected_revenue * COMMISSION_RATE,
      projected_revenue,
      computed_at:       now,
    }
  }

  /**
   * Compute daily revenue target tracking.
   */
  async getDailyTarget(org_id: string): Promise<DailyRevenueTarget> {
    const pipeline = await businessPrimitiveEngine.getPipeline(org_id)
    const now      = new Date()
    const day_of_month = now.getDate()
    const days_in_month = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()

    const daily_target = MONTHLY_TARGET / days_in_month
    const actual       = pipeline.commission_mtd / day_of_month  // daily avg so far

    const pipeline_contribution =
      (pipeline.proposals_pending * 650_000 * COMMISSION_RATE * 0.60) / 30

    const on_track = actual >= daily_target * 0.8

    const actions: string[] = []
    if (!on_track) {
      if (pipeline.hot_leads < 3) actions.push('Qualify more leads — need 3+ hot leads in pipeline')
      if (pipeline.proposals_pending === 0) actions.push('Send at least 1 proposal today')
      actions.push('Call top 2 hot leads — push for viewing or signature')
    }

    return {
      org_id,
      date:                      now.toISOString().split('T')[0],
      target:                    daily_target,
      actual,
      pipeline_contribution,
      on_track,
      gap:                       daily_target - actual,
      recommended_actions:       actions,
    }
  }

  /**
   * Compute revenue attribution by source and agent.
   * Requires deals data from Supabase.
   */
  async getAttribution(org_id: string, since_ts: string): Promise<RevenueAttribution> {
    const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (sb.from('deals') as any)
      .select('id, value, stage, metadata, created_at, closed_at')
      .eq('org_id', org_id)
      .eq('stage', 'closed_won')
      .gte('closed_at', since_ts)
      .limit(500)

    if (error || !data) {
      return {
        org_id,
        period:          since_ts,
        by_source:       [],
        by_agent:        [],
        total_revenue:   0,
        total_commission: 0,
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const deals = data as any[]

    const total_revenue   = deals.reduce((s: number, d: { value: number }) => s + (d.value ?? 0), 0)
    const total_commission = total_revenue * COMMISSION_RATE

    // Group by source
    const source_map: Record<string, { deals: number; revenue: number }> = {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const deal of deals) {
      const source = (deal.metadata?.source as string) ?? 'organic'
      if (!source_map[source]) source_map[source] = { deals: 0, revenue: 0 }
      source_map[source].deals++
      source_map[source].revenue += deal.value ?? 0
    }

    const by_source = Object.entries(source_map).map(([source, data]) => ({
      source,
      deals:      data.deals,
      revenue:    data.revenue,
      commission: data.revenue * COMMISSION_RATE,
    }))

    // Group by agent
    const agent_map: Record<string, { deals: number; revenue: number }> = {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const deal of deals) {
      const agent_id = (deal.metadata?.agent_id as string) ?? 'unassigned'
      if (!agent_map[agent_id]) agent_map[agent_id] = { deals: 0, revenue: 0 }
      agent_map[agent_id].deals++
      agent_map[agent_id].revenue += deal.value ?? 0
    }

    const by_agent = Object.entries(agent_map).map(([agent_id, data]) => ({
      agent_id,
      deals:      data.deals,
      revenue:    data.revenue,
      close_rate: 0.18,  // would need total attempts to compute accurately
    }))

    return {
      org_id,
      period:          since_ts,
      by_source,
      by_agent,
      total_revenue,
      total_commission,
    }
  }
}

export const revenueOutcomeMapper = new RevenueOutcomeMapper()
