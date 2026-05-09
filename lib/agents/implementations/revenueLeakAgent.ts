// =============================================================================
// AGENCY GROUP — Revenue Leak Agent v1.0
// Detects revenue leakage patterns: stalled deals, dormant leads, missed follow-ups
// AMI: 22506
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import { BaseAgent } from '../base'
import type { AgentConfig, AgentContext, AgentInsight, AgentAction } from '../types'

export class RevenueLeakAgent extends BaseAgent {
  readonly id = 'revenue-leak' as const
  readonly name = 'Revenue Leak Agent'
  readonly description = 'Detects stalled deals, dormant high-score leads, and missed follow-up windows that represent revenue leakage'

  readonly config: AgentConfig = {
    rate_limit_per_hour:    4,
    max_retries:            2,
    timeout_ms:             30_000,
    require_human_approval: false,
    can_send_comms:         false,
  }

  protected async execute(ctx: AgentContext): Promise<{ insights: AgentInsight[]; actions: AgentAction[]; metadata: Record<string, unknown> }> {
    const insights: AgentInsight[] = []
    const actions: AgentAction[] = []

    // 1. Stalled high-priority offmarket leads (score ≥ 70, no action 7+ days)
    const stalledThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: stalledLeads } = await supabaseAdmin
      .from('offmarket_leads')
      .select('id, nome, score, assigned_to, last_contact_at, deal_priority_score')
      .gte('score', 70)
      .in('status', ['new', 'contacted', 'interested'])
      .or(`last_contact_at.lt.${stalledThreshold},last_contact_at.is.null`)
      .limit(20)

    for (const lead of stalledLeads ?? []) {
      const revenueEstimate = (lead.score ?? 0) * 500 // rough proxy
      insights.push({
        type:               'stalled_high_score_lead',
        summary:            `Lead "${lead.nome}" (score ${lead.score}) sem contacto há 7+ dias`,
        severity:           (lead.score ?? 0) >= 85 ? 'critical' : 'warning',
        confidence:         0.9,
        revenue_impact_eur: revenueEstimate,
        entity_type:        'offmarket_lead',
        entity_id:          lead.id,
        evidence:           { score: lead.score, last_contact_at: lead.last_contact_at, assigned_to: lead.assigned_to },
      })
      actions.push({
        type:               'create_task',
        description:        `Follow-up urgente: ${lead.nome} (score ${lead.score})`,
        entity_type:        'offmarket_lead',
        entity_id:          lead.id,
        payload:            { assigned_to: lead.assigned_to, score: lead.score },
        risk:               'low',
        requires_approval:  false,
      })
    }

    // 2. SLA breach leads
    const { data: slaBreaches } = await supabaseAdmin
      .from('offmarket_leads')
      .select('id, nome, score, assigned_to, sla_contacted_at')
      .eq('sla_breach', true)
      .in('status', ['new', 'contacted'])
      .limit(10)

    for (const lead of slaBreaches ?? []) {
      insights.push({
        type:               'sla_breach',
        summary:            `SLA violado: "${lead.nome}" não foi contactado no prazo`,
        severity:           'critical',
        confidence:         1.0,
        revenue_impact_eur: null,
        entity_type:        'offmarket_lead',
        entity_id:          lead.id,
        evidence:           { sla_contacted_at: lead.sla_contacted_at },
      })
    }

    return {
      insights,
      actions,
      metadata: {
        stalled_leads_found: stalledLeads?.length ?? 0,
        sla_breaches_found:  slaBreaches?.length ?? 0,
        entity_scope:        ctx.entity_id ?? 'global',
      },
    }
  }
}
