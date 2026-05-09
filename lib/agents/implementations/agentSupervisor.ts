// =============================================================================
// AGENCY GROUP — Agent Supervisor v1.0
// Monitors the health and performance of all other agents via runtime_events
// AMI: 22506 | SH-ROS Layer: system_automation
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import { BaseAgent } from '../base'
import type { AgentConfig, AgentContext, AgentInsight, AgentAction } from '../types'

export class AgentSupervisor extends BaseAgent {
  readonly id = 'agent-supervisor' as const
  readonly name = 'Agent Supervisor'
  readonly description = 'Monitors the health and performance of all other agents via runtime_events'

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

    let dlqCount      = 0
    let failedCount   = 0
    let slowCount     = 0
    let avgLatencyMs  = 0
    let eventsSampled = 0

    try {
      // Query runtime_events — wrap in try/catch in case table doesn't exist yet
      try {
        const { data: events } = await supabaseAdmin
          .from('runtime_events')
          .select('event_id, status, latency_ms, created_at')
          .order('created_at', { ascending: false })
          .limit(100)

        const allEvents = events ?? []
        eventsSampled   = allEvents.length

        dlqCount    = allEvents.filter(e => e.status === 'dlq').length
        failedCount = allEvents.filter(e => e.status === 'failed').length
        slowCount   = allEvents.filter(e => (e.latency_ms ?? 0) > 2000).length

        const completedEvents = allEvents.filter(e => e.latency_ms != null)
        avgLatencyMs = completedEvents.length > 0
          ? completedEvents.reduce((sum, e) => sum + (e.latency_ms ?? 0), 0) / completedEvents.length
          : 0
      } catch {
        // runtime_events table may not exist — emit soft warning and continue
        insights.push({
          type:               'runtime_events_unavailable',
          summary:            'Tabela runtime_events não disponível — supervisão parcial',
          severity:           'warning',
          confidence:         1.0,
          revenue_impact_eur: null,
          entity_type:        'system',
          entity_id:          null,
          evidence:           {},
        })
      }

      // DLQ events
      if (dlqCount > 0) {
        insights.push({
          type:               'dlq_events_detected',
          summary:            `${dlqCount} evento${dlqCount !== 1 ? 's' : ''} em Dead Letter Queue — verificar falhas de agente`,
          severity:           'critical',
          confidence:         1.0,
          revenue_impact_eur: null,
          entity_type:        'agent_runtime',
          entity_id:          null,
          evidence:           { dlq_count: dlqCount, events_sampled: eventsSampled },
        })
      }

      // Failed events
      if (failedCount > 5) {
        insights.push({
          type:               'high_failure_rate',
          summary:            `${failedCount} falhas recentes — sistema pode estar degradado`,
          severity:           'warning',
          confidence:         0.90,
          revenue_impact_eur: null,
          entity_type:        'agent_runtime',
          entity_id:          null,
          evidence:           { failed_count: failedCount, events_sampled: eventsSampled },
        })
      }

      // High average latency
      if (avgLatencyMs > 1500 && eventsSampled > 0) {
        insights.push({
          type:               'high_avg_latency',
          summary:            `Latência média elevada: ${Math.round(avgLatencyMs)}ms (budget: 2000ms)`,
          severity:           'warning',
          confidence:         0.85,
          revenue_impact_eur: null,
          entity_type:        'agent_runtime',
          entity_id:          null,
          evidence:           { avg_latency_ms: avgLatencyMs, slow_count: slowCount, events_sampled: eventsSampled },
        })
      }

      // Health summary
      const healthStatus = dlqCount > 0 ? 'Crítico' : failedCount > 5 || avgLatencyMs > 1500 ? 'Atenção' : 'Bom'
      insights.push({
        type:               'agent_supervisor_summary',
        summary:            `Saúde dos agentes: ${healthStatus} — DLQ: ${dlqCount} | Falhas: ${failedCount} | Lentos: ${slowCount} | Latência média: ${Math.round(avgLatencyMs)}ms`,
        severity:           dlqCount > 0 ? 'critical' : failedCount > 5 || avgLatencyMs > 1500 ? 'warning' : 'info',
        confidence:         0.90,
        revenue_impact_eur: null,
        entity_type:        'agent_runtime',
        entity_id:          null,
        evidence:           {
          dlq_count:      dlqCount,
          failed_count:   failedCount,
          slow_count:     slowCount,
          avg_latency_ms: avgLatencyMs,
          events_sampled: eventsSampled,
        },
      })

      return {
        insights,
        actions,
        metadata: {
          org_id:         ctx.org_id,
          dlq_count:      dlqCount,
          failed_count:   failedCount,
          slow_count:     slowCount,
          avg_latency_ms: avgLatencyMs,
          events_sampled: eventsSampled,
        },
      }
    } catch (err) {
      insights.push({
        type: 'agent_error', summary: `Erro: ${String(err)}`,
        severity: 'warning', confidence: 1, revenue_impact_eur: null,
        entity_type: 'system', entity_id: null, evidence: {},
      })
    }

    return {
      insights,
      actions,
      metadata: {
        org_id:         ctx.org_id,
        dlq_count:      dlqCount,
        failed_count:   failedCount,
        slow_count:     slowCount,
        avg_latency_ms: avgLatencyMs,
        events_sampled: eventsSampled,
      },
    }
  }
}
