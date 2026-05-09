// =============================================================================
// AGENCY GROUP — Risk Governance Agent v1.0
// Detects cross-cutting risks: high-value deals without activity, compliance gaps
// AMI: 22506 | SH-ROS Layer: strategy_analytics
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import { BaseAgent } from '../base'
import type { AgentConfig, AgentContext, AgentInsight, AgentAction } from '../types'

const HIGH_RISK_PHASES = ['CPCV', 'CPCV Assinado', 'Financiamento', 'Escritura Marcada']
const INACTIVITY_DAYS  = 30

export class RiskGovernanceAgent extends BaseAgent {
  readonly id = 'risk-governance' as const
  readonly name = 'Risk Governance Agent'
  readonly description = 'Detects cross-cutting risks: high-value deals without activity, compliance gaps'

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
      const now            = new Date()
      const thresholdDate  = new Date(now.getTime() - INACTIVITY_DAYS * 24 * 60 * 60 * 1000)

      // Query active deals ordered by oldest activity first
      const { data: activeDeals } = await supabaseAdmin
        .from('deals')
        .select('id, ref, imovel, fase, valor, updated_at, agent_email, comprador')
        .not('fase', 'in', '("Escritura Concluída","Perdido","Rejeitado")')
        .order('updated_at', { ascending: true })
        .limit(30)

      const deals          = activeDeals ?? []
      let highRiskDeals    = 0

      for (const deal of deals) {
        const updatedAt   = new Date(deal.updated_at)
        const daysSince   = Math.floor((now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24))
        const isHighPhase = deal.fase != null && HIGH_RISK_PHASES.includes(deal.fase)

        if (daysSince >= INACTIVITY_DAYS && isHighPhase) {
          highRiskDeals++
          insights.push({
            type:               'high_risk_stalled_deal',
            summary:            `Deal de alto risco inativo: ${deal.ref ?? deal.id} em ${deal.fase} há ${daysSince}d sem actividade`,
            severity:           'critical',
            confidence:         0.95,
            revenue_impact_eur: 500000,
            entity_type:        'deal',
            entity_id:          deal.id,
            evidence:           {
              ref:          deal.ref,
              fase:         deal.fase,
              valor:        deal.valor,
              days_inactive: daysSince,
              updated_at:   deal.updated_at,
              agent_email:  deal.agent_email,
              comprador:    deal.comprador,
            },
          })
        }
      }

      // Query qualified leads with overdue follow-up
      const { data: overdueLeads } = await supabaseAdmin
        .from('contacts')
        .select('id, full_name, email, lead_score, next_followup_at, status')
        .eq('status', 'lead')
        .lt('next_followup_at', now.toISOString())
        .gte('lead_score', 70)
        .limit(20)

      const overdue               = overdueLeads ?? []
      const overdueQualifiedLeads = overdue.length

      if (overdueQualifiedLeads > 0) {
        insights.push({
          type:               'overdue_qualified_followup',
          summary:            `${overdueQualifiedLeads} lead${overdueQualifiedLeads !== 1 ? 's' : ''} qualificado${overdueQualifiedLeads !== 1 ? 's' : ''} com follow-up em atraso — risco de perda`,
          severity:           'warning',
          confidence:         0.90,
          revenue_impact_eur: overdueQualifiedLeads * 5000,
          entity_type:        'contact',
          entity_id:          null,
          evidence:           {
            overdue_count: overdueQualifiedLeads,
            sample_ids:    overdue.slice(0, 5).map(c => c.id),
          },
        })
      }

      return {
        insights,
        actions,
        metadata: {
          org_id:                   ctx.org_id,
          high_risk_deals:          highRiskDeals,
          overdue_qualified_leads:  overdueQualifiedLeads,
        },
      }
    } catch (err) {
      insights.push({
        type: 'agent_error', summary: `Erro: ${String(err)}`,
        severity: 'warning', confidence: 1, revenue_impact_eur: null,
        entity_type: 'system', entity_id: null, evidence: {},
      })
    }

    return { insights, actions, metadata: { org_id: ctx.org_id } }
  }
}
