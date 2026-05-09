// =============================================================================
// AGENCY GROUP — Decision Arbitration Agent v1.0
// Resolves conflicts between competing agent recommendations using EV scoring
// AMI: 22506 | SH-ROS Layer: strategy_analytics
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import { BaseAgent } from '../base'
import type { AgentConfig, AgentContext, AgentInsight, AgentAction } from '../types'

const EV_WEIGHTS = {
  critical: 50000,
  high:     20000,
  medium:   5000,
  low:      1000,
} as const

type TaskPriority = keyof typeof EV_WEIGHTS

export class DecisionArbitrationAgent extends BaseAgent {
  readonly id = 'decision-arbitration' as const
  readonly name = 'Decision Arbitration Agent'
  readonly description = 'Resolves conflicts between competing agent recommendations using EV scoring'

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
      // Query pending operator tasks
      const { data: tasks } = await supabaseAdmin
        .from('operator_tasks')
        .select('id, priority, status, created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(50)

      const allTasks  = tasks ?? []
      const total     = allTasks.length

      // Count by priority
      const byPriority: Record<TaskPriority, number> = {
        critical: 0,
        high:     0,
        medium:   0,
        low:      0,
      }

      for (const task of allTasks) {
        const prio = (task.priority ?? 'low') as TaskPriority
        if (prio in byPriority) {
          byPriority[prio]++
        } else {
          byPriority.low++
        }
      }

      // Critical backlog warning
      if (byPriority.critical > 5) {
        insights.push({
          type:               'critical_task_backlog',
          summary:            `Backlog crítico: ${byPriority.critical} tarefas críticas pendentes — arbitragem necessária`,
          severity:           'warning',
          confidence:         0.95,
          revenue_impact_eur: byPriority.critical * EV_WEIGHTS.critical,
          entity_type:        'operator_tasks',
          entity_id:          null,
          evidence:           { critical_count: byPriority.critical, total_pending: total },
        })
      }

      // High total task count
      if (total > 30) {
        insights.push({
          type:               'high_task_volume',
          summary:            `${total} tarefas pendentes no sistema — considerar priorização automática`,
          severity:           'info',
          confidence:         0.90,
          revenue_impact_eur: null,
          entity_type:        'operator_tasks',
          entity_id:          null,
          evidence:           { total_pending: total, by_priority: byPriority },
        })
      }

      // EV scoring of backlog
      const theoreticalEv =
        byPriority.critical * EV_WEIGHTS.critical +
        byPriority.high     * EV_WEIGHTS.high     +
        byPriority.medium   * EV_WEIGHTS.medium   +
        byPriority.low      * EV_WEIGHTS.low

      const evFormatted = theoreticalEv >= 1_000_000
        ? `€${(theoreticalEv / 1_000_000).toFixed(2)}M`
        : `€${theoreticalEv.toLocaleString('pt-PT')}`

      insights.push({
        type:               'backlog_ev_estimate',
        summary:            `Valor potencial no backlog: ${evFormatted} (EV estimado)`,
        severity:           'info',
        confidence:         0.75,
        revenue_impact_eur: theoreticalEv,
        entity_type:        'operator_tasks',
        entity_id:          null,
        evidence:           { by_priority: byPriority, theoretical_ev_eur: theoreticalEv, total_pending: total },
      })

      return {
        insights,
        actions,
        metadata: {
          org_id:            ctx.org_id,
          total_pending:     total,
          by_priority:       byPriority,
          theoretical_ev_eur: theoreticalEv,
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
