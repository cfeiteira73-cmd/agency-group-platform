// =============================================================================
// AGENCY GROUP — Workflow Automation Agent v1.0
// Detects repeated automation failures and un-nurtured high-score contacts
// AMI: 22506 | SH-ROS Layer: system_automation
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import { BaseAgent } from '../base'
import type { AgentConfig, AgentContext, AgentInsight, AgentAction } from '../types'

const ONE_WEEK_AGO  = new Date(Date.now() - 7  * 24 * 60 * 60 * 1000).toISOString()
const SEVEN_DAYS_AGO = ONE_WEEK_AGO

export class WorkflowAutomationAgent extends BaseAgent {
  readonly id = 'workflow-automation' as const
  readonly name = 'Workflow Automation Agent'
  readonly description = 'Detects failing automations (>3 failures/week) and contacts with no activity that need automated nurturing'

  readonly config: AgentConfig = {
    rate_limit_per_hour:    4,
    max_retries:            2,
    timeout_ms:             2000,
    require_human_approval: false,
    can_send_comms:         false,
    layer:                  'system_automation',
  }

  protected async execute(ctx: AgentContext): Promise<{ insights: AgentInsight[]; actions: AgentAction[]; metadata: Record<string, unknown> }> {
    const insights: AgentInsight[] = []
    const actions:  AgentAction[]  = []

    try {
      // 1. Detect repeatedly-failing automations — org isolation: pending migration 015 (automations_log has no org_id column)
      const { data: failedLogs } = await supabaseAdmin
        .from('automations_log')
        .select('id, workflow_name, status, created_at')
        .eq('status', 'error')
        .gte('created_at', ONE_WEEK_AGO)
        .limit(50)

      // Group by workflow_name
      const failCounts: Record<string, number> = {}
      for (const log of failedLogs ?? []) {
        const wf = log.workflow_name ?? 'unknown'
        failCounts[wf] = (failCounts[wf] ?? 0) + 1
      }

      for (const [wfName, count] of Object.entries(failCounts)) {
        if (count > 3) {
          insights.push({
            type:               'repeated_automation_failure',
            summary:            `Workflow "${wfName}" falhou ${count}x esta semana — requer atenção`,
            severity:           count > 10 ? 'critical' : 'warning',
            confidence:         1.0,
            revenue_impact_eur: count * 200,
            entity_type:        'automation',
            entity_id:          null,
            evidence:           { workflow_name: wfName, failure_count: count, window: '7d' },
          })
          actions.push({
            type:               'create_task',
            description:        `Investigar e corrigir workflow "${wfName}" (${count} falhas em 7 dias)`,
            entity_type:        'automation',
            entity_id:          null,
            payload:            { workflow_name: wfName, failure_count: count },
            risk:               'medium',
            requires_approval:  false,
          })
        }
      }

      // 2. Contacts with lead_score > 50 and no activity in 7 days — nurture gap
      // org isolation: pending migration 015 (contacts has no org_id column)
      const { data: dormantContacts } = await supabaseAdmin
        .from('contacts')
        .select('id, full_name, lead_score, status, updated_at')
        .gt('lead_score', 50)
        .not('status', 'in', '("closed","lost","inactive")')
        .lt('updated_at', SEVEN_DAYS_AGO)
        .limit(30)

      if ((dormantContacts?.length ?? 0) > 5) {
        const totalScore = dormantContacts!.reduce((s, c) => s + (c.lead_score ?? 0), 0)
        insights.push({
          type:               'nurture_gap',
          summary:            `${dormantContacts!.length} contactos com lead_score > 50 sem actividade há 7+ dias — automação de nurture em falta`,
          severity:           dormantContacts!.length > 15 ? 'critical' : 'warning',
          confidence:         0.87,
          revenue_impact_eur: (dormantContacts!.length ?? 0) * 1500,
          entity_type:        'contacts_segment',
          entity_id:          null,
          evidence:           { count: dormantContacts!.length, avg_score: Math.round(totalScore / dormantContacts!.length) },
        })
        actions.push({
          type:               'trigger_workflow',
          description:        `Activar sequência de nurture automático para ${dormantContacts!.length} contactos dormentes de alto score`,
          entity_type:        'contacts_segment',
          entity_id:          null,
          payload:            { contact_ids: dormantContacts!.slice(0, 10).map(c => c.id), workflow: 'high_score_nurture_7d' },
          risk:               'low',
          requires_approval:  false,
        })
      }

      if (insights.length === 0) {
        insights.push({
          type:               'automation_healthy',
          summary:            'Sem falhas recorrentes de automação e sem lacunas de nurture detectadas',
          severity:           'info',
          confidence:         0.8,
          revenue_impact_eur: null,
          entity_type:        'system',
          entity_id:          null,
          evidence:           { failing_workflows: Object.keys(failCounts).length, dormant_contacts: dormantContacts?.length ?? 0 },
        })
      }

      return {
        insights,
        actions,
        metadata: {
          org_id:               ctx.org_id,
          failing_workflows:    Object.entries(failCounts).filter(([, v]) => v > 3).length,
          dormant_high_score:   dormantContacts?.length ?? 0,
        },
      }
    } catch (err) {
      return {
        insights: [{
          type: 'agent_error', summary: `Erro ao analisar automações: ${String(err)}`,
          severity: 'warning', confidence: 1, revenue_impact_eur: null,
          entity_type: 'system', entity_id: null, evidence: {},
        }],
        actions: [],
        metadata: { org_id: ctx.org_id },
      }
    }
  }
}
