// =============================================================================
// AGENCY GROUP — System Health Agent v1.0
// Monitors open alerts, automation error rate, and learning event cadence
// AMI: 22506 | SH-ROS Layer: system_automation
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import { BaseAgent } from '../base'
import type { AgentConfig, AgentContext, AgentInsight, AgentAction } from '../types'

export class SystemHealthAgent extends BaseAgent {
  readonly id = 'system-health' as const
  readonly name = 'System Health Agent'
  readonly description = 'Monitors open/critical system alerts, automation error rate in last 24h, and learning event cadence as a health signal'

  readonly config: AgentConfig = {
    rate_limit_per_hour:    12,
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
      const now          = new Date()
      const last24h      = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
      const last1h       = new Date(now.getTime() -      60 * 60 * 1000).toISOString()

      // 1. Open/critical system alerts — may not have org_id
      const { data: alerts, count: alertCount } = await supabaseAdmin
        .from('system_alerts')
        .select('id, alert_type, severity, message, created_at', { count: 'exact' })
        .eq('status', 'open')
        .limit(50)

      const criticalAlerts = (alerts ?? []).filter(a => a.severity === 'P0' || a.severity === 'P1')

      // 2. Automation error rate last 24h — no org_id on automations_log
      const { data: recentLogs } = await supabaseAdmin
        .from('automations_log')
        .select('id, status')
        .gte('created_at', last24h)
        .limit(500)

      const total24h  = recentLogs?.length ?? 0
      const errors24h = (recentLogs ?? []).filter(l => l.status === 'error').length
      const errorRate = total24h > 0 ? errors24h / total24h : 0

      // 3. Learning events last 1h — health signal
      const { count: learningCount } = await supabaseAdmin
        .from('learning_events')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', last1h)

      // Compute health score (0-100)
      let healthScore = 100
      healthScore -= criticalAlerts.length * 15
      healthScore -= (alertCount ?? 0 - criticalAlerts.length) * 5
      healthScore -= Math.round(errorRate * 30)
      if ((learningCount ?? 0) === 0) healthScore -= 10
      healthScore = Math.max(0, Math.min(100, healthScore))

      // Emit critical-alert insights
      for (const alert of criticalAlerts.slice(0, 5)) {
        insights.push({
          type:               'critical_system_alert',
          summary:            `Alerta crítico: ${alert.alert_type} — ${alert.message ?? 'sem mensagem'}`,
          severity:           'critical',
          confidence:         1.0,
          revenue_impact_eur: 500,
          entity_type:        'system_alert',
          entity_id:          alert.id,
          evidence:           { alert_type: alert.alert_type, created_at: alert.created_at },
        })
        actions.push({
          type:               'escalate_human',
          description:        `Resolver alerta crítico: ${alert.alert_type}`,
          entity_type:        'system_alert',
          entity_id:          alert.id,
          payload:            { severity: 'critical', message: alert.message },
          risk:               'high',
          requires_approval:  true,
        })
      }

      // High error rate
      if (errorRate > 0.20 && total24h > 5) {
        insights.push({
          type:               'high_error_rate',
          summary:            `Taxa de erros de automação elevada: ${Math.round(errorRate * 100)}% nas últimas 24h (${errors24h}/${total24h})`,
          severity:           errorRate > 0.40 ? 'critical' : 'warning',
          confidence:         0.95,
          revenue_impact_eur: errors24h * 150,
          entity_type:        'automation_system',
          entity_id:          null,
          evidence:           { total_runs: total24h, errors: errors24h, error_rate: errorRate },
        })
      }

      // No learning events in last hour
      if ((learningCount ?? 0) === 0) {
        insights.push({
          type:               'learning_event_silence',
          summary:            'Nenhum learning_event registado na última hora — possível problema sistémico',
          severity:           'warning',
          confidence:         0.70,
          revenue_impact_eur: null,
          entity_type:        'system',
          entity_id:          null,
          evidence:           { learning_events_last_1h: 0 },
        })
      }

      // Overall health summary
      insights.push({
        type:               'system_health_score',
        summary:            `Saúde do sistema: ${healthScore}/100 — ${healthScore >= 80 ? 'Bom' : healthScore >= 60 ? 'Atenção' : 'Crítico'}`,
        severity:           healthScore >= 80 ? 'info' : healthScore >= 60 ? 'warning' : 'critical',
        confidence:         0.9,
        revenue_impact_eur: null,
        entity_type:        'system',
        entity_id:          null,
        evidence:           { health_score: healthScore, critical_alerts: criticalAlerts.length, open_alerts: alertCount ?? 0, error_rate_24h: errorRate, learning_events_1h: learningCount ?? 0 },
      })

      return {
        insights,
        actions,
        metadata: {
          org_id:           ctx.org_id,
          health_score:     healthScore,
          open_alerts:      alertCount ?? 0,
          critical_alerts:  criticalAlerts.length,
          error_rate_24h:   errorRate,
          learning_events:  learningCount ?? 0,
        },
      }
    } catch (err) {
      return {
        insights: [{
          type: 'agent_error', summary: `Erro ao verificar saúde do sistema: ${String(err)}`,
          severity: 'warning', confidence: 1, revenue_impact_eur: null,
          entity_type: 'system', entity_id: null, evidence: {},
        }],
        actions: [],
        metadata: { org_id: ctx.org_id },
      }
    }
  }
}
