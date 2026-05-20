// =============================================================================
// AGENCY GROUP — Deal Closing Agent v1.0
// Monitors late-stage deals, computes closing risk, recommends next-best-action
// AMI: 22506 | SH-ROS Layer: sales_execution
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import { BaseAgent } from '../base'
import type { AgentConfig, AgentContext, AgentInsight, AgentAction } from '../types'
import { COMMISSION_RATE } from '@/lib/constants/pipeline'

// Maximum days per stage before flagging closing-risk
const CLOSING_SLA: Record<string, number> = {
  'Proposta Enviada': 10,
  'Proposta':         10,
  'Negociação':        7,
  'Due Diligence':    21,
}

// Recommended next action per stage
const NEXT_ACTION: Record<string, string> = {
  'Proposta Enviada': 'Ligar ao comprador para confirmar recepção e esclarecer dúvidas',
  'Proposta':         'Agendar reunião de negociação formal com comprador e advogado',
  'Negociação':       'Enviar contra-proposta estruturada com prazo de resposta de 48h',
  'Due Diligence':    'Verificar pendências jurídicas e fornecer documentação em falta',
}

export class DealClosingAgent extends BaseAgent {
  readonly id = 'deal-closing' as const
  readonly name = 'Deal Closing Agent'
  readonly description = 'Detects closing-risk deals in late pipeline stages and recommends next-best-action per deal'

  readonly config: AgentConfig = {
    rate_limit_per_hour:    6,
    max_retries:            2,
    timeout_ms:             2000,
    require_human_approval: false,
    can_send_comms:         false,
    layer:                  'sales_execution',
  }

  protected async execute(ctx: AgentContext): Promise<{ insights: AgentInsight[]; actions: AgentAction[]; metadata: Record<string, unknown> }> {
    const insights: AgentInsight[] = []
    const actions:  AgentAction[]  = []

    try {
      const stages = Object.keys(CLOSING_SLA)
      // org isolation: pending migration 015 (deals has no org_id column)
      const { data: deals } = await supabaseAdmin
        .from('deals')
        .select('id, ref, imovel, fase, valor, updated_at, agent_email, comprador')
        .in('fase', stages)
        .order('updated_at', { ascending: true })
        .limit(50)

      const now = Date.now()
      let closingRiskCount = 0
      let totalAtRisk = 0

      for (const deal of deals ?? []) {
        const sla      = CLOSING_SLA[deal.fase ?? ''] ?? 14
        const daysIn   = (now - new Date(deal.updated_at).getTime()) / 86_400_000
        if (daysIn <= sla) continue

        closingRiskCount++
        const valor        = (deal.valor as number | null) ?? 0
        const commission   = valor * COMMISSION_RATE
        totalAtRisk       += commission

        // Closing probability degrades 5% per day over SLA
        const overdueDays     = daysIn - sla
        const closingProb     = Math.max(0.1, 1 - overdueDays * 0.05)
        const nextAction      = NEXT_ACTION[deal.fase ?? ''] ?? 'Contactar cliente para rever proposta'

        insights.push({
          type:               'closing_risk',
          summary:            `Deal "${deal.ref ?? deal.imovel}" em "${deal.fase}" há ${Math.round(daysIn)}d (SLA ${sla}d) — probabilidade de fecho ${Math.round(closingProb * 100)}%`,
          severity:           overdueDays > sla ? 'critical' : 'warning',
          confidence:         0.88,
          revenue_impact_eur: commission,
          entity_type:        'deal',
          entity_id:          deal.id,
          evidence:           {
            fase:          deal.fase,
            days_in_stage: Math.round(daysIn),
            sla_days:      sla,
            overdue_days:  Math.round(overdueDays),
            valor:         valor,
            commission:    commission,
            closing_prob:  closingProb,
          },
        })
        actions.push({
          type:               'create_task',
          description:        `${deal.ref ?? deal.imovel}: ${nextAction}`,
          entity_type:        'deal',
          entity_id:          deal.id,
          payload:            { fase: deal.fase, days_overdue: Math.round(overdueDays), agent_email: deal.agent_email, next_action: nextAction, closing_prob: closingProb },
          risk:               'medium',
          requires_approval:  false,
        })
      }

      if (insights.length === 0) {
        insights.push({
          type:               'closing_pipeline_healthy',
          summary:            'Todos os deals em fase de fecho dentro do prazo SLA',
          severity:           'info',
          confidence:         0.9,
          revenue_impact_eur: null,
          entity_type:        'pipeline',
          entity_id:          null,
          evidence:           { deals_checked: deals?.length ?? 0 },
        })
      }

      return {
        insights,
        actions,
        metadata: { org_id: ctx.org_id, closing_risk_count: closingRiskCount, total_commission_at_risk: totalAtRisk },
      }
    } catch (err) {
      return {
        insights: [{
          type: 'agent_error', summary: `Erro ao analisar fecho de deals: ${String(err)}`,
          severity: 'warning', confidence: 1, revenue_impact_eur: null,
          entity_type: 'system', entity_id: null, evidence: {},
        }],
        actions: [],
        metadata: { org_id: ctx.org_id },
      }
    }
  }
}
