// =============================================================================
// AGENCY GROUP — Follow-Up Agent v1.0
// Identifies contacts due for follow-up and creates operator tasks
// AMI: 22506
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import { BaseAgent } from '../base'
import type { AgentConfig, AgentContext, AgentInsight, AgentAction } from '../types'

export class FollowUpAgent extends BaseAgent {
  readonly id = 'follow-up' as const
  readonly name = 'Follow-Up Agent'
  readonly description = 'Identifies contacts and deals past their next_followup_at deadline and creates prioritised tasks'

  readonly config: AgentConfig = {
    rate_limit_per_hour:    6,
    max_retries:            2,
    timeout_ms:             2000,
    require_human_approval: false,
    can_send_comms:         false,
  }

  protected async execute(ctx: AgentContext): Promise<{ insights: AgentInsight[]; actions: AgentAction[]; metadata: Record<string, unknown> }> {
    const insights: AgentInsight[] = []
    const actions:  AgentAction[]  = []
    const now = new Date().toISOString()

    // Overdue follow-ups on contacts — org isolation: pending migration 015 (contacts has no org_id column)
    const { data: overdueContacts } = await supabaseAdmin
      .from('contacts')
      .select('id, full_name, lead_score, next_followup_at, assigned_to, status')
      .lt('next_followup_at', now)
      .in('status', ['lead', 'prospect', 'qualified', 'active', 'negotiating'])
      .order('lead_score', { ascending: false })
      .limit(25)

    for (const contact of overdueContacts ?? []) {
      const hoursOverdue = (Date.now() - new Date(contact.next_followup_at ?? new Date()).getTime()) / 3_600_000
      insights.push({
        type:               'overdue_followup',
        summary:            `${contact.full_name} — follow-up em atraso ${Math.round(hoursOverdue)}h (score: ${contact.lead_score ?? 'N/A'})`,
        severity:           hoursOverdue > 48 ? 'critical' : 'warning',
        confidence:         1.0,
        revenue_impact_eur: null,
        entity_type:        'contact',
        entity_id:          contact.id,
        evidence:           { next_followup_at: contact.next_followup_at, hours_overdue: Math.round(hoursOverdue), lead_score: contact.lead_score },
      })
      actions.push({
        type:               'create_task',
        description:        `Follow-up em atraso: ${contact.full_name}`,
        entity_type:        'contact',
        entity_id:          contact.id,
        payload:            { assigned_to: contact.assigned_to, lead_score: contact.lead_score },
        risk:               'low',
        requires_approval:  false,
      })
    }

    return {
      insights,
      actions,
      metadata: { org_id: ctx.org_id, overdue_contacts: overdueContacts?.length ?? 0 },
    }
  }
}
