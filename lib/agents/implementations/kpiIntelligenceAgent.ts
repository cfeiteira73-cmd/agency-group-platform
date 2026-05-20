// =============================================================================
// AGENCY GROUP — KPI Intelligence Agent v1.0
// Computes executive KPI snapshot + WoW anomaly detection
// AMI: 22506 | SH-ROS Layer: strategy_analytics
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import { BaseAgent } from '../base'
import type { AgentConfig, AgentContext, AgentInsight, AgentAction } from '../types'
import { COMMISSION_RATE } from '@/lib/constants/pipeline'

const ACTIVE_DEAL_STAGES = [
  'Proposta', 'Proposta Enviada', 'Negociação', 'Due Diligence', 'CPCV', 'CPCV Assinado', 'Financiamento',
]

export class KpiIntelligenceAgent extends BaseAgent {
  readonly id = 'kpi-intelligence' as const
  readonly name = 'KPI Intelligence Agent'
  readonly description = 'Generates executive KPI snapshot with lead growth, pipeline value, and WoW anomaly detection'

  readonly config: AgentConfig = {
    rate_limit_per_hour:    4,
    max_retries:            2,
    timeout_ms:             2000,
    require_human_approval: false,
    can_send_comms:         false,
    layer:                  'strategy_analytics',
  }

  protected async execute(ctx: AgentContext): Promise<{ insights: AgentInsight[]; actions: AgentAction[]; metadata: Record<string, unknown> }> {
    const insights: AgentInsight[] = []
    const actions:  AgentAction[]  = []

    try {
      const now       = new Date()
      const d30ago    = new Date(now.getTime() - 30 * 86_400_000).toISOString()
      const d60ago    = new Date(now.getTime() - 60 * 86_400_000).toISOString()
      const d7ago     = new Date(now.getTime() -  7 * 86_400_000).toISOString()
      const d14ago    = new Date(now.getTime() - 14 * 86_400_000).toISOString()

      // 1. Contacts: last 30d vs prior 30d — org isolation: pending migration 015 (contacts has no org_id column)
      const { count: leadsLast30 } = await supabaseAdmin
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', d30ago)

      const { count: leadsPrior30 } = await supabaseAdmin
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', d60ago)
        .lt('created_at', d30ago)

      // WoW: last 7d vs prior 7d — org isolation: pending migration 015 (contacts has no org_id column)
      const { count: leadsLast7 } = await supabaseAdmin
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', d7ago)

      const { count: leadsPrior7 } = await supabaseAdmin
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', d14ago)
        .lt('created_at', d7ago)

      const leadGrowth30d = leadsPrior30 && leadsPrior30 > 0
        ? ((leadsLast30 ?? 0) - leadsPrior30) / leadsPrior30
        : null

      const leadGrowthWoW = leadsPrior7 && leadsPrior7 > 0
        ? ((leadsLast7 ?? 0) - leadsPrior7) / leadsPrior7
        : null

      // 2. Pipeline value — org isolation: pending migration 015 (deals has no org_id column)
      const { data: activeDeals } = await supabaseAdmin
        .from('deals')
        .select('id, fase, valor')
        .in('fase', ACTIVE_DEAL_STAGES)
        .not('valor', 'is', null)
        .limit(50)

      const pipelineValue    = (activeDeals ?? []).reduce((s, d) => s + ((d.valor as number) ?? 0), 0)
      const pipelineByStage: Record<string, { count: number; value: number }> = {}
      for (const d of activeDeals ?? []) {
        const stage = d.fase ?? 'unknown'
        if (!pipelineByStage[stage]) pipelineByStage[stage] = { count: 0, value: 0 }
        pipelineByStage[stage].count++
        pipelineByStage[stage].value += (d.valor as number) ?? 0
      }

      // 3. Growth metrics — 4 weeks trend
      const { data: growthRows } = await supabaseAdmin
        .from('growth_metrics')
        .select('week_start, new_leads, new_qualified, new_clients, viral_coefficient, cac_eur')
        .or(`organization_id.is.null,organization_id.eq.${ctx.org_id}`)
        .order('week_start', { ascending: false })
        .limit(4)

      // Detect anomalies
      const anomalies: string[] = []

      if (leadGrowthWoW !== null && leadGrowthWoW < -0.20) {
        anomalies.push(`Queda WoW de leads: ${Math.round(Math.abs(leadGrowthWoW) * 100)}%`)
        insights.push({
          type:               'lead_count_drop',
          summary:            `Queda de leads WoW: ${leadsLast7} vs ${leadsPrior7} na semana anterior (${Math.round(leadGrowthWoW * 100)}%)`,
          severity:           leadGrowthWoW < -0.35 ? 'critical' : 'warning',
          confidence:         0.90,
          revenue_impact_eur: (leadsPrior7 ?? 0) * 3000 * Math.abs(leadGrowthWoW),
          entity_type:        'kpi',
          entity_id:          null,
          evidence:           { leads_last_7d: leadsLast7, leads_prior_7d: leadsPrior7, wow_change: leadGrowthWoW },
        })
        actions.push({
          type:               'create_task',
          description:        `Investigar queda de ${Math.round(Math.abs(leadGrowthWoW) * 100)}% em leads WoW — rever canais de aquisição`,
          entity_type:        'kpi',
          entity_id:          null,
          payload:            { metric: 'leads_wow', change: leadGrowthWoW },
          risk:               'medium',
          requires_approval:  false,
        })
      }

      // Pipeline drop vs growth_metrics prior week — pipeline_value column removed, skip comparison
      // growthRows available for future use (new_leads, new_qualified, new_clients, viral_coefficient, cac_eur)

      // Executive KPI summary insight
      insights.push({
        type:               'kpi_snapshot',
        summary:            `KPI executivo: ${leadsLast30} leads (30d) | Pipeline €${Math.round(pipelineValue / 1000)}K | ${activeDeals?.length ?? 0} deals activos | WoW leads ${leadGrowthWoW !== null ? (leadGrowthWoW >= 0 ? '+' : '') + Math.round(leadGrowthWoW * 100) + '%' : 'N/A'}`,
        severity:           anomalies.length > 0 ? 'warning' : 'info',
        confidence:         0.9,
        revenue_impact_eur: pipelineValue * COMMISSION_RATE,
        entity_type:        'org',
        entity_id:          ctx.org_id,
        evidence:           {
          leads_last_30d:   leadsLast30,
          leads_prior_30d:  leadsPrior30,
          lead_growth_30d:  leadGrowth30d,
          lead_growth_wow:  leadGrowthWoW,
          pipeline_value:   pipelineValue,
          active_deals:     activeDeals?.length ?? 0,
          pipeline_by_stage: pipelineByStage,
          anomalies,
        },
      })

      return {
        insights,
        actions,
        metadata: {
          org_id:          ctx.org_id,
          leads_last_30d:  leadsLast30,
          pipeline_value:  pipelineValue,
          active_deals:    activeDeals?.length ?? 0,
          anomalies_found: anomalies.length,
        },
      }
    } catch (err) {
      return {
        insights: [{
          type: 'agent_error', summary: `Erro ao calcular KPIs: ${String(err)}`,
          severity: 'warning', confidence: 1, revenue_impact_eur: null,
          entity_type: 'system', entity_id: null, evidence: {},
        }],
        actions: [],
        metadata: { org_id: ctx.org_id },
      }
    }
  }
}
