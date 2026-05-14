// =============================================================================
// AGENCY GROUP — Conversion Optimization Agent v1.0
// Detects funnel drop-off rates and stalled high-score leads
// AMI: 22506 | SH-ROS Layer: revenue_intelligence
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import { BaseAgent } from '../base'
import type { AgentConfig, AgentContext, AgentInsight, AgentAction } from '../types'

const FUNNEL_STAGES = ['lead', 'prospect', 'qualified', 'proposal', 'closed'] as const

export class ConversionOptimizationAgent extends BaseAgent {
  readonly id = 'conversion-optimization' as const
  readonly name = 'Conversion Optimization Agent'
  readonly description = 'Detects funnel drop-off rates and flags stalled high-score leads that are stuck in early stages'

  readonly config: AgentConfig = {
    rate_limit_per_hour:    6,
    max_retries:            2,
    timeout_ms:             2000,
    require_human_approval: false,
    can_send_comms:         false,
    layer:                  'revenue_intelligence',
  }

  protected async execute(ctx: AgentContext): Promise<{ insights: AgentInsight[]; actions: AgentAction[]; metadata: Record<string, unknown> }> {
    const insights: AgentInsight[] = []
    const actions:  AgentAction[]  = []

    try {
      // 1. Count contacts by status to compute drop-off rates
      // org isolation: pending migration 015 (contacts has no org_id column)
      const { data: statusCounts } = await supabaseAdmin
        .from('contacts')
        .select('status')
        .limit(50)

      const counts: Record<string, number> = {}
      for (const row of statusCounts ?? []) {
        counts[row.status ?? 'unknown'] = (counts[row.status ?? 'unknown'] ?? 0) + 1
      }

      const lead      = counts['lead']      ?? 0
      const prospect  = counts['prospect']  ?? 0
      const qualified = counts['qualified'] ?? 0
      const proposal  = counts['proposal']  ?? 0

      // Drop-off: prospect→qualified
      if (lead > 0 && prospect > 0) {
        const leadToProspect   = prospect / lead
        const prospectToQual   = qualified > 0 ? qualified / prospect : 0

        if (prospectToQual < 0.3 && prospect > 5) {
          insights.push({
            type:               'funnel_dropoff',
            summary:            `Baixa conversão prospect→qualificado: ${Math.round(prospectToQual * 100)}% (${qualified}/${prospect})`,
            severity:           prospectToQual < 0.15 ? 'critical' : 'warning',
            confidence:         0.85,
            revenue_impact_eur: qualified > 0 ? (prospect - qualified) * 5000 : prospect * 5000,
            entity_type:        'funnel',
            entity_id:          null,
            evidence:           { lead, prospect, qualified, proposal, lead_to_prospect_rate: leadToProspect, prospect_to_qual_rate: prospectToQual },
          })
          actions.push({
            type:               'create_task',
            description:        `Optimizar qualificação: ${prospect} prospects sem avançar para qualificado`,
            entity_type:        'funnel',
            entity_id:          null,
            payload:            { stage: 'prospect→qualified', count: prospect - qualified, drop_off_rate: prospectToQual },
            risk:               'low',
            requires_approval:  false,
          })
        }

        if (lead > 0 && leadToProspect < 0.4 && lead > 10) {
          insights.push({
            type:               'funnel_dropoff',
            summary:            `Baixa conversão lead→prospect: ${Math.round(leadToProspect * 100)}% (${prospect}/${lead})`,
            severity:           'warning',
            confidence:         0.8,
            revenue_impact_eur: (lead - prospect) * 3000,
            entity_type:        'funnel',
            entity_id:          null,
            evidence:           { lead, prospect, rate: leadToProspect },
          })
        }
      }

      // 2. High-score leads stalled for 14+ days — org isolation: pending migration 015 (contacts has no org_id column)
      const stalledThreshold = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
      const { data: stalledLeads } = await supabaseAdmin
        .from('contacts')
        .select('id, full_name, email, lead_score, status, updated_at')
        .eq('status', 'lead')
        .gte('lead_score', 60)
        .lt('updated_at', stalledThreshold)
        .limit(20)

      for (const contact of stalledLeads ?? []) {
        const daysStalled = Math.round((Date.now() - new Date(contact.updated_at).getTime()) / 86_400_000)
        insights.push({
          type:               'stalled_high_score_lead',
          summary:            `Lead "${contact.full_name}" (score ${contact.lead_score}) parado em 'lead' há ${daysStalled} dias`,
          severity:           (contact.lead_score ?? 0) >= 80 ? 'critical' : 'warning',
          confidence:         0.9,
          revenue_impact_eur: (contact.lead_score ?? 60) * 200,
          entity_type:        'contact',
          entity_id:          contact.id,
          evidence:           { lead_score: contact.lead_score, days_stalled: daysStalled, status: contact.status },
        })
        actions.push({
          type:               'create_task',
          description:        `Re-engajar lead estagnado: ${contact.full_name} (score ${contact.lead_score}, ${daysStalled}d parado)`,
          entity_type:        'contact',
          entity_id:          contact.id,
          payload:            { lead_score: contact.lead_score, days_stalled: daysStalled },
          risk:               'low',
          requires_approval:  false,
        })
      }

      if (insights.length === 0) {
        insights.push({
          type:               'funnel_healthy',
          summary:            'Funil de conversão sem anomalias detectadas',
          severity:           'info',
          confidence:         0.7,
          revenue_impact_eur: null,
          entity_type:        'funnel',
          entity_id:          null,
          evidence:           { stage_counts: counts },
        })
      }
    } catch (err) {
      insights.push({
        type: 'agent_error', summary: `Erro ao analisar funil: ${String(err)}`,
        severity: 'warning', confidence: 1, revenue_impact_eur: null,
        entity_type: 'system', entity_id: null, evidence: {},
      })
    }

    return { insights, actions, metadata: { org_id: ctx.org_id, entity_scope: ctx.entity_id ?? 'global' } }
  }
}
