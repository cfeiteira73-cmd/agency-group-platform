// =============================================================================
// AGENCY GROUP — Lead Qualification Agent v1.0
// Identifies unscored leads and leads with score mismatches
// AMI: 22506 | SH-ROS Layer: sales_execution
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import { BaseAgent } from '../base'
import type { AgentConfig, AgentContext, AgentInsight, AgentAction } from '../types'

export class LeadQualificationAgent extends BaseAgent {
  readonly id = 'lead-qualification' as const
  readonly name = 'Lead Qualification Agent'
  readonly description = 'Identifies unscored leads and leads with score mismatches'

  readonly config: AgentConfig = {
    rate_limit_per_hour:    4,
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
      // Query unscored leads: lead_score IS NULL or 0, status = 'lead'
      // org isolation: pending migration 015 (contacts has no org_id column)
      const { data: unscoredLeads } = await supabaseAdmin
        .from('contacts')
        .select('id, full_name, email, status, lead_score, source, created_at')
        .eq('status', 'lead')
        .or('lead_score.is.null,lead_score.eq.0')
        .limit(50)

      const unscored      = unscoredLeads ?? []
      const unscoredCount = unscored.length

      // Individual insights for each unscored lead
      for (const contact of unscored) {
        insights.push({
          type:               'unscored_lead',
          summary:            `${contact.full_name ?? contact.email ?? contact.id} sem score de qualificação`,
          severity:           'warning',
          confidence:         1.0,
          revenue_impact_eur: null,
          entity_type:        'contact',
          entity_id:          contact.id,
          evidence:           { email: contact.email, source: contact.source, created_at: contact.created_at },
        })
      }

      // Aggregate critical insight if > 10 unscored
      if (unscoredCount > 10) {
        insights.push({
          type:               'qualification_engine_inactive',
          summary:            `${unscoredCount} leads sem score — motor de qualificação pode estar inactivo`,
          severity:           'critical',
          confidence:         0.90,
          revenue_impact_eur: unscoredCount * 3000,
          entity_type:        'system',
          entity_id:          null,
          evidence:           { unscored_count: unscoredCount },
        })
      }

      // Query high-score leads still in 'lead' status (not promoted to prospect)
      // org isolation: pending migration 015 (contacts has no org_id column)
      const { data: highScoreLeads } = await supabaseAdmin
        .from('contacts')
        .select('id, full_name, email, lead_score, status, next_followup_at, updated_at')
        .eq('status', 'lead')
        .gte('lead_score', 80)
        .limit(50)

      const highScore          = highScoreLeads ?? []
      const highScoreInLead    = highScore.length

      for (const contact of highScore) {
        insights.push({
          type:               'high_score_not_promoted',
          summary:            `Lead de alta pontuação (${contact.lead_score}) ainda em status 'lead' — promover para prospect`,
          severity:           'warning',
          confidence:         0.95,
          revenue_impact_eur: null,
          entity_type:        'contact',
          entity_id:          contact.id,
          evidence:           { lead_score: contact.lead_score, email: contact.email, updated_at: contact.updated_at },
        })

        actions.push({
          type:              'create_task',
          description:       `Promover lead de alta pontuação para prospect: ${contact.full_name ?? contact.email ?? contact.id} (score: ${contact.lead_score})`,
          entity_type:       'contact',
          entity_id:         contact.id,
          payload:           {
            action:      'promote_to_prospect',
            contact_id:  contact.id,
            lead_score:  contact.lead_score,
            email:       contact.email,
          },
          risk:              'low',
          requires_approval: false,
        })
      }

      return {
        insights,
        actions,
        metadata: {
          org_id:               ctx.org_id,
          unscored_count:       unscoredCount,
          high_score_in_lead:   highScoreInLead,
          total_reviewed:       unscoredCount + highScoreInLead,
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
