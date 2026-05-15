// AGENCY GROUP — SH-ROS Product: Business Primitive Engine | AMI: 22506
// Translates raw system state into business-level primitives agents and UI can consume
// No ML jargon — everything expressed as: deals, leads, actions, revenue
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import logger from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BusinessPipeline {
  org_id: string
  // Real-time state
  active_leads:        number
  hot_leads:           number   // score ≥ 80
  proposals_pending:   number
  deals_in_progress:   number
  deals_won_mtd:       number   // month-to-date
  deals_lost_mtd:      number

  // Revenue
  pipeline_value:      number   // €
  expected_revenue:    number   // pipeline × close probability
  revenue_mtd:         number   // realized this month
  commission_mtd:      number   // 5% of closed deals this month

  // Velocity
  avg_days_to_close:   number
  close_rate_30d:      number   // last 30 days

  // Computed at
  computed_at: string
}

export interface LeadSummary {
  contact_id:    string
  org_id:        string
  name:          string
  stage:         'new' | 'contacted' | 'qualified' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost'
  score:         number          // 0–100 (from matchScore / priority)
  priority:      'critical' | 'high' | 'medium' | 'low'
  expected_value: number         // estimated deal value €
  days_in_stage: number
  next_action:   string
  next_action_due: string | null
  last_activity: string | null
}

export interface DealSummary {
  deal_id:      string
  org_id:       string
  title:        string
  value:        number           // asking price €
  stage:        string
  probability:  number           // 0–1
  expected_value: number         // value × probability
  days_active:  number
  close_by:     string | null    // estimated close date
  agent:        string
}

export interface RevenueSnapshot {
  org_id:              string
  period:              'today' | 'mtd' | 'ytd' | 'last_30d'
  gross_revenue:       number
  net_commission:      number   // 5% of gross
  deals_closed:        number
  avg_deal_value:      number
  vs_previous_period:  number   // % change
  on_track_for_target: boolean
  monthly_target:      number
}

// ─── Business Primitive Engine ────────────────────────────────────────────────

export class BusinessPrimitiveEngine {
  private _pipeline_cache = new Map<string, { data: BusinessPipeline; expires: number }>()
  private readonly CACHE_TTL = 60_000  // 1 minute

  /**
   * Get current business pipeline for an org.
   * Primary business primitive — answers "how's the business doing right now?"
   */
  async getPipeline(org_id: string): Promise<BusinessPipeline> {
    const cached = this._pipeline_cache.get(org_id)
    if (cached && cached.expires > Date.now()) return cached.data

    const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }
    const now = new Date()
    const mtd_start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    // Fetch deals
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [deals_res, contacts_res] = await Promise.all([
      (sb.from('deals') as any)
        .select('id, value, stage, probability, created_at, closed_at, metadata')
        .eq('org_id', org_id)
        .limit(1_000),

      (sb.from('contacts') as any)
        .select('id, score, stage, created_at, metadata')
        .eq('org_id', org_id)
        .limit(2_000),
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const deals    = (deals_res.data    ?? []) as any[]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contacts = (contacts_res.data ?? []) as any[]

    const active_deals    = deals.filter((d: { stage: string }) => !['closed_won', 'closed_lost'].includes(d.stage))
    const deals_won_mtd   = deals.filter((d: { stage: string; closed_at: string | null }) =>
      d.stage === 'closed_won' && d.closed_at && d.closed_at >= mtd_start)
    const deals_lost_mtd  = deals.filter((d: { stage: string; closed_at: string | null }) =>
      d.stage === 'closed_lost' && d.closed_at && d.closed_at >= mtd_start)

    const pipeline_value    = active_deals.reduce((s: number, d: { value: number }) => s + (d.value ?? 0), 0)
    const expected_revenue  = active_deals.reduce((s: number, d: { value: number; probability: number }) =>
      s + (d.value ?? 0) * (d.probability ?? 0.18), 0)
    const revenue_mtd       = deals_won_mtd.reduce((s: number, d: { value: number }) => s + (d.value ?? 0), 0)

    const hot_leads = contacts.filter((c: { score: number }) => (c.score ?? 0) >= 80).length

    const pipeline: BusinessPipeline = {
      org_id,
      active_leads:       contacts.filter((c: { stage: string }) =>
        !['closed_won', 'closed_lost'].includes(c.stage ?? '')).length,
      hot_leads,
      proposals_pending:  contacts.filter((c: { stage: string }) => c.stage === 'proposal').length,
      deals_in_progress:  active_deals.length,
      deals_won_mtd:      deals_won_mtd.length,
      deals_lost_mtd:     deals_lost_mtd.length,
      pipeline_value,
      expected_revenue,
      revenue_mtd,
      commission_mtd:     revenue_mtd * 0.05,
      avg_days_to_close:  210,  // Portugal benchmark; would compute from closed deals
      close_rate_30d:     deals.length > 0
        ? deals_won_mtd.length / Math.max(1, deals.length) : 0.18,
      computed_at:        now.toISOString(),
    }

    this._pipeline_cache.set(org_id, { data: pipeline, expires: Date.now() + this.CACHE_TTL })

    logger.info('[BusinessPrimitive] Pipeline computed', {
      org_id,
      deals_in_progress: pipeline.deals_in_progress,
      pipeline_value:    pipeline.pipeline_value,
      hot_leads:         pipeline.hot_leads,
    })

    return pipeline
  }

  /**
   * Get top leads for an org, sorted by business priority.
   * Translates internal scores into actionable lead summaries.
   */
  async getTopLeads(org_id: string, limit = 20): Promise<LeadSummary[]> {
    const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (sb.from('contacts') as any)
      .select('id, name, stage, score, created_at, metadata')
      .eq('org_id', org_id)
      .not('stage', 'in', '("closed_won","closed_lost")')
      .order('score', { ascending: false })
      .limit(limit)

    if (error || !data) return []

    const now = Date.now()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data as any[]).map((row: {
      id: string
      name: string
      stage: string
      score: number
      created_at: string
      metadata: Record<string, unknown>
    }) => {
      const score       = row.score ?? 0
      const days_active = Math.floor((now - new Date(row.created_at).getTime()) / 86_400_000)

      return {
        contact_id:    row.id,
        org_id,
        name:          row.name ?? 'Unknown',
        stage:         (row.stage ?? 'new') as LeadSummary['stage'],
        score,
        priority:      score >= 80 ? 'critical' : score >= 60 ? 'high' : score >= 40 ? 'medium' : 'low',
        expected_value: (row.metadata?.budget as number) ?? 500_000,
        days_in_stage:  days_active,
        next_action:    this._suggestNextAction(row.stage, score),
        next_action_due: this._suggestActionDate(row.stage, days_active),
        last_activity:  (row.metadata?.last_activity as string) ?? null,
      } as LeadSummary
    })
  }

  /**
   * Get revenue snapshot for an org.
   */
  async getRevenueSnapshot(org_id: string, period: RevenueSnapshot['period']): Promise<RevenueSnapshot> {
    const pipeline = await this.getPipeline(org_id)

    const monthly_target = 2_000_000  // €2M/month default target

    return {
      org_id,
      period,
      gross_revenue:      pipeline.revenue_mtd,
      net_commission:     pipeline.commission_mtd,
      deals_closed:       pipeline.deals_won_mtd,
      avg_deal_value:     pipeline.deals_won_mtd > 0
        ? pipeline.revenue_mtd / pipeline.deals_won_mtd : 0,
      vs_previous_period: 0,  // would require previous period data
      on_track_for_target: pipeline.commission_mtd >= monthly_target * 0.5,
      monthly_target,
    }
  }

  /**
   * Invalidate pipeline cache for an org (call after deal/contact updates).
   */
  invalidateCache(org_id: string): void {
    this._pipeline_cache.delete(org_id)
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private _suggestNextAction(stage: string, score: number): string {
    if (stage === 'new' && score >= 80)          return 'Call immediately — hot lead'
    if (stage === 'new')                         return 'Send introduction email'
    if (stage === 'contacted' && score >= 60)    return 'Schedule property viewing'
    if (stage === 'contacted')                   return 'Follow up — no response'
    if (stage === 'qualified')                   return 'Prepare deal pack'
    if (stage === 'proposal')                    return 'Follow up on proposal'
    if (stage === 'negotiation')                 return 'Schedule closing meeting'
    return 'Update contact status'
  }

  private _suggestActionDate(stage: string, days_in_stage: number): string | null {
    const now = new Date()
    if (stage === 'new' && days_in_stage === 0) return now.toISOString()
    if (days_in_stage > 7) {
      const due = new Date(now.getTime() + 24 * 60 * 60 * 1000)  // tomorrow
      return due.toISOString()
    }
    return null
  }
}

export const businessPrimitiveEngine = new BusinessPrimitiveEngine()
