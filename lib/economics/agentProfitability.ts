// AGENCY GROUP — SH-ROS Ω∞∞ Economics: agentProfitability | AMI: 22506
// Per-agent economic profitability scoring
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import logger from '@/lib/logger'
import { WON_STAGES } from '@/lib/constants/pipeline'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabaseAdmin as any

export interface AgentProfitabilityScore {
  agent_id: string
  org_id: string
  period_days: number
  revenue_generated_eur: number
  deals_closed: number
  avg_deal_size_eur: number
  conversion_rate: number
  avg_close_days: number
  economic_efficiency_score: number
  profitability_rank: number
  profitability_tier: 'elite' | 'high' | 'standard' | 'developing'
}

export class AgentProfitabilityEngine {
  async scoreAgent(
    agent_id: string,
    org_id: string,
    period_days = 90
  ): Promise<AgentProfitabilityScore> {
    const from = new Date(Date.now() - period_days * 86_400_000).toISOString()

    const { data, error } = await sb
      .from('deals')
      .select('deal_value, fase, created_at, actual_close_date')
      .eq('tenant_id', org_id)
      .eq('assigned_consultant', agent_id)
      .gte('created_at', from)
      .limit(500)

    if (error) logger.error('[AgentProfitability] Query failed', { error, agent_id, org_id })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allDeals: any[] = data ?? []
    const wonDeals = allDeals.filter((d: any) => (WON_STAGES as readonly string[]).includes(d.fase as string))

    const revenue_generated_eur = wonDeals.reduce(
      (s: number, d: any) => s + ((d.deal_value as number) ?? 0), 0
    )
    const deals_closed = wonDeals.length
    const avg_deal_size_eur = deals_closed > 0 ? revenue_generated_eur / deals_closed : 0
    const conversion_rate = allDeals.length > 0 ? deals_closed / allDeals.length : 0

    const avg_close_days = deals_closed > 0
      ? wonDeals.reduce((s: number, d: any) => {
          const closeDate = d.actual_close_date ?? d.created_at
          const diff = new Date(closeDate as string).getTime() -
            new Date(d.created_at as string).getTime()
          return s + diff / 86_400_000
        }, 0) / deals_closed
      : 0

    // Composite score: revenue(40%) + conversion(30%) + speed(30%)
    // Normalize each component to 0-100 using reasonable benchmarks
    const revenue_score = Math.min(100, (revenue_generated_eur / 1_000_000) * 100)
    const conversion_score = Math.min(100, conversion_rate * 200) // 50% conversion = 100 score
    const speed_score = avg_close_days > 0 ? Math.min(100, Math.max(0, 100 - avg_close_days)) : 50
    const economic_efficiency_score = Math.round(
      revenue_score * 0.4 + conversion_score * 0.3 + speed_score * 0.3
    )

    const profitability_tier: AgentProfitabilityScore['profitability_tier'] =
      economic_efficiency_score >= 75 ? 'elite'
      : economic_efficiency_score >= 55 ? 'high'
      : economic_efficiency_score >= 35 ? 'standard'
      : 'developing'

    return {
      agent_id, org_id, period_days,
      revenue_generated_eur: Math.round(revenue_generated_eur * 100) / 100,
      deals_closed, avg_deal_size_eur: Math.round(avg_deal_size_eur * 100) / 100,
      conversion_rate: Math.round(conversion_rate * 1000) / 10,
      avg_close_days: Math.round(avg_close_days * 10) / 10,
      economic_efficiency_score,
      profitability_rank: 0, // set during rankOrg
      profitability_tier,
    }
  }

  async rankOrg(
    org_id: string,
    period_days = 90
  ): Promise<AgentProfitabilityScore[]> {
    const from = new Date(Date.now() - period_days * 86_400_000).toISOString()

    // Discover unique agents from deals
    const { data } = await sb
      .from('deals')
      .select('assigned_consultant')
      .eq('tenant_id', org_id)
      .gte('created_at', from)
      .limit(1000)

    const agents = new Set<string>(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (data ?? []).map((d: any) => d.assigned_consultant as string).filter(Boolean)
    )

    // Process in batches of 5 to avoid saturating the connection pool
    const BATCH_SIZE = 5
    const agentArr = Array.from(agents)
    const scores: AgentProfitabilityScore[] = []
    for (let i = 0; i < agentArr.length; i += BATCH_SIZE) {
      const batch = agentArr.slice(i, i + BATCH_SIZE)
      const batchResults = await Promise.all(
        batch.map(agent_id => this.scoreAgent(agent_id, org_id, period_days).catch(() => null))
      )
      scores.push(...batchResults.filter((r): r is AgentProfitabilityScore => r !== null))
    }

    scores.sort((a, b) => b.economic_efficiency_score - a.economic_efficiency_score)
    return scores.map((s, i) => ({ ...s, profitability_rank: i + 1 }))
  }
}

export const agentProfitabilityEngine = new AgentProfitabilityEngine()
