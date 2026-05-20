// AGENCY GROUP — SH-ROS Ω∞∞ Economics: opportunityCost | AMI: 22506
// Opportunity cost — revenue lost from delayed or missed execution
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import logger from '@/lib/logger'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabaseAdmin as any

// Probability decay: each day of stall costs 2% of deal close probability
const DAILY_PROBABILITY_DECAY = 0.02

export interface OpportunityCostEstimate {
  org_id: string
  stalled_deals: number
  stalled_value_eur: number
  avg_stall_days: number
  estimated_loss_per_day_eur: number
  total_estimated_opportunity_cost_eur: number
  recovery_actions: Array<{
    deal_id: string
    recommended_action: string
    urgency: 'critical' | 'high' | 'medium'
    estimated_recovery_eur: number
  }>
}

export class OpportunityCostAnalyzer {
  async analyzeOrg(org_id: string): Promise<OpportunityCostEstimate> {
    const stall_threshold = new Date(Date.now() - 7 * 86_400_000).toISOString()

    const { data, error } = await sb
      .from('deals')
      .select('id, deal_value, fase, assigned_consultant, updated_at, created_at')
      .eq('tenant_id', org_id)
      .not('fase', 'in', '(post_sale,escritura,escritura_sell)')
      .lt('updated_at', stall_threshold)
      .limit(200)

    if (error) {
      logger.error('[OpportunityCost] Query failed', { error, org_id })
      return this._empty(org_id)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stalledDeals: any[] = data ?? []
    if (stalledDeals.length === 0) return this._empty(org_id)

    let stalled_value_eur = 0
    let total_stall_days = 0

    for (const d of stalledDeals) {
      stalled_value_eur += (d.deal_value as number) ?? 0
      const stall_days = Math.max(0,
        (Date.now() - new Date(d.updated_at as string).getTime()) / 86_400_000
      )
      total_stall_days += stall_days
    }

    const avg_stall_days = stalledDeals.length > 0 ? total_stall_days / stalledDeals.length : 0
    const estimated_loss_per_day_eur = stalled_value_eur * DAILY_PROBABILITY_DECAY
    const total_estimated_opportunity_cost_eur = estimated_loss_per_day_eur * avg_stall_days

    // Recovery actions for top stalled deals
    const recovery_actions = stalledDeals
      .sort((a: any, b: any) => ((b.value_eur as number) ?? 0) - ((a.value_eur as number) ?? 0))
      .slice(0, 10)
      .map((d: any) => {
        const stall_days = Math.max(0,
          (Date.now() - new Date(d.updated_at as string).getTime()) / 86_400_000
        )
        const val = (d.deal_value as number) ?? 0
        const urgency: 'critical' | 'high' | 'medium' =
          stall_days > 30 ? 'critical' : stall_days > 14 ? 'high' : 'medium'
        return {
          deal_id: d.id as string,
          recommended_action: this._recommendAction(d.fase as string, stall_days),
          urgency,
          estimated_recovery_eur: Math.round(Math.max(0, val * (1 - stall_days * DAILY_PROBABILITY_DECAY)) * 100) / 100,
        }
      })

    logger.info('[OpportunityCost] Analysis complete', {
      org_id,
      stalled: stalledDeals.length,
      total_at_risk: stalled_value_eur,
    })

    return {
      org_id,
      stalled_deals: stalledDeals.length,
      stalled_value_eur: Math.round(stalled_value_eur * 100) / 100,
      avg_stall_days: Math.round(avg_stall_days * 10) / 10,
      estimated_loss_per_day_eur: Math.round(estimated_loss_per_day_eur * 100) / 100,
      total_estimated_opportunity_cost_eur: Math.round(total_estimated_opportunity_cost_eur * 100) / 100,
      recovery_actions,
    }
  }

  private _recommendAction(stage: string, stall_days: number): string {
    const stageActions: Record<string, string> = {
      qualification: 'Schedule qualification call — prospect may have gone cold',
      price_analysis: 'Send updated market analysis to re-engage',
      visit_scheduled: 'Confirm visit or reschedule — urgency required',
      proposal: 'Follow up on proposal — offer to clarify terms',
      negotiation: 'Re-engage negotiation — propose compromise or deadline',
      cpcv_pending: 'CRITICAL: Push CPCV signing — revenue at immediate risk',
      cpcv_signed: 'Coordinate with notary for escritura date',
      escritura_done: 'Verify payment clearance and close accounting',
    }
    const base = stageActions[stage] ?? 'Review deal status and re-engage'
    return stall_days > 30 ? `URGENT: ${base}` : base
  }

  private _empty(org_id: string): OpportunityCostEstimate {
    return { org_id, stalled_deals: 0, stalled_value_eur: 0, avg_stall_days: 0,
      estimated_loss_per_day_eur: 0, total_estimated_opportunity_cost_eur: 0, recovery_actions: [] }
  }
}

export const opportunityCostAnalyzer = new OpportunityCostAnalyzer()
