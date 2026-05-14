// AGENCY GROUP — SH-ROS Compliance: auditExports | AMI: 22506
import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'

export interface AuditSection {
  title: string
  data: Record<string, unknown>[]
  summary: string
}

export interface AuditReport {
  report_id: string
  org_id: string
  period: { from: string; to: string }
  generated_at: string
  events_count: number
  agent_actions_count: number
  gdpr_operations: number
  security_events: number
  sections: AuditSection[]
}

export class AuditExportEngine {
  async generateAuditReport(org_id: string, from: string, to: string): Promise<AuditReport> {
    const report_id = randomUUID()

    const [eventsRes, agentActionsRes, gdprRes, securityRes] = await Promise.allSettled([
      supabaseAdmin.from('runtime_events')
        .select('event_id, type, status, created_at')
        .eq('org_id', org_id).gte('created_at', from).lte('created_at', to).limit(500),
      supabaseAdmin.from('automations_log')
        .select('workflow_name, status, started_at')
        .gte('started_at', from).lte('started_at', to).limit(500),
      supabaseAdmin.from('learning_events')
        .select('id, metadata, created_at')
        .eq('event_type', 'gdpr_operation')
        .gte('created_at', from).lte('created_at', to).limit(100),
      supabaseAdmin.from('system_alerts')
        .select('id, alert_type, severity, message, created_at')
        .in('severity', ['P0', 'P1'])
        .gte('created_at', from).lte('created_at', to).limit(100),
    ])

    const events        = eventsRes.status       === 'fulfilled' ? eventsRes.value.data       ?? [] : []
    const agentActions  = agentActionsRes.status  === 'fulfilled' ? agentActionsRes.value.data  ?? [] : []
    const gdprOps       = gdprRes.status          === 'fulfilled' ? gdprRes.value.data          ?? [] : []
    const securityEvts  = securityRes.status      === 'fulfilled' ? securityRes.value.data      ?? [] : []

    const sections: AuditSection[] = [
      {
        title: 'Runtime Events',
        data: events.slice(0, 20) as Record<string, unknown>[],
        summary: `${events.length} total events in period. Status distribution: ${
          Object.entries(events.reduce((a: Record<string, number>, e) => {
            a[e.status] = (a[e.status] ?? 0) + 1; return a
          }, {})).map(([k, v]) => `${k}=${v}`).join(', ')
        }`,
      },
      {
        title: 'Agent Executions',
        data: agentActions.slice(0, 20) as Record<string, unknown>[],
        summary: `${agentActions.length} agent executions. Success rate: ${
          agentActions.length > 0
            ? Math.round(agentActions.filter(a => a.status === 'success').length / agentActions.length * 100)
            : 0
        }%`,
      },
      {
        title: 'GDPR Operations',
        data: gdprOps as Record<string, unknown>[],
        summary: `${gdprOps.length} GDPR operations performed`,
      },
      {
        title: 'Security Events',
        data: securityEvts as Record<string, unknown>[],
        summary: `${securityEvts.length} P0/P1 security alerts`,
      },
    ]

    return {
      report_id, org_id, period: { from, to },
      generated_at:       new Date().toISOString(),
      events_count:        events.length,
      agent_actions_count: agentActions.length,
      gdpr_operations:     gdprOps.length,
      security_events:     securityEvts.length,
      sections,
    }
  }

  exportToJSON(report: AuditReport): string {
    return JSON.stringify(report, null, 2)
  }

  exportToCSV(report: AuditReport): string {
    const lines = ['report_id,org_id,from,to,generated_at,events,agent_actions,gdpr_ops,security']
    lines.push([
      report.report_id, report.org_id, report.period.from, report.period.to,
      report.generated_at, report.events_count, report.agent_actions_count,
      report.gdpr_operations, report.security_events,
    ].join(','))
    return lines.join('\n')
  }
}

export const auditExportEngine = new AuditExportEngine()
