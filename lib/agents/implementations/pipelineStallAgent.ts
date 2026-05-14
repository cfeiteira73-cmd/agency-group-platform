// =============================================================================
// AGENCY GROUP — Pipeline Stall Agent v1.0
// Detects deals stalled in the same stage for too long
// AMI: 22506
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import { BaseAgent } from '../base'
import type { AgentConfig, AgentContext, AgentInsight, AgentAction } from '../types'

// Days threshold per stage before flagging as stalled
const STAGE_SLA_DAYS: Record<string, number> = {
  'Contacto':           3,
  'Qualificado':        5,
  'Visita':             7,
  'Proposta':           10,
  'Negociação':         14,
  'CPCV':               21,
  'Proposta Enviada':   10,
  'Proposta Aceite':    14,
  'Due Diligence':      21,
  'CPCV Assinado':      30,
  'Financiamento':      30,
  'Escritura Marcada':  14,
}

export class PipelineStallAgent extends BaseAgent {
  readonly id = 'pipeline-stall' as const
  readonly name = 'Pipeline Stall Agent'
  readonly description = 'Detects deals that have been in the same stage beyond the SLA threshold'

  readonly config: AgentConfig = {
    rate_limit_per_hour:    4,
    max_retries:            2,
    timeout_ms:             2000,
    require_human_approval: false,
    can_send_comms:         false,
  }

  protected async execute(ctx: AgentContext): Promise<{ insights: AgentInsight[]; actions: AgentAction[]; metadata: Record<string, unknown> }> {
    const insights: AgentInsight[] = []
    const actions:  AgentAction[]  = []

    // org isolation: pending migration 015 (deals has no org_id column)
    const { data: deals } = await supabaseAdmin
      .from('deals')
      .select('id, ref, imovel, fase, valor, updated_at, agent_email, comprador')
      .not('fase', 'in', '("Escritura Concluída","Escritura")')
      .order('updated_at', { ascending: true })
      .limit(50)

    const now = Date.now()

    for (const deal of deals ?? []) {
      const slaDays = STAGE_SLA_DAYS[deal.fase ?? ''] ?? 14
      const updatedMs = new Date(deal.updated_at).getTime()
      const daysStalled = (now - updatedMs) / 86_400_000

      if (daysStalled > slaDays) {
        insights.push({
          type:               'stalled_deal',
          summary:            `Deal "${deal.ref ?? deal.imovel}" estagnado em "${deal.fase}" há ${Math.round(daysStalled)} dias (SLA: ${slaDays}d)`,
          severity:           daysStalled > slaDays * 2 ? 'critical' : 'warning',
          confidence:         1.0,
          revenue_impact_eur: null,
          entity_type:        'deal',
          entity_id:          deal.id,
          evidence:           { fase: deal.fase, days_stalled: Math.round(daysStalled), sla_days: slaDays, agent_email: deal.agent_email },
        })
        actions.push({
          type:               'create_task',
          description:        `Deal estagnado: ${deal.ref ?? deal.imovel} (${Math.round(daysStalled)}d em "${deal.fase}")`,
          entity_type:        'deal',
          entity_id:          deal.id,
          payload:            { fase: deal.fase, days_stalled: Math.round(daysStalled), agent_email: deal.agent_email },
          risk:               'low',
          requires_approval:  false,
        })
      }
    }

    return {
      insights,
      actions,
      metadata: { org_id: ctx.org_id, stalled_deals_found: insights.length },
    }
  }
}
