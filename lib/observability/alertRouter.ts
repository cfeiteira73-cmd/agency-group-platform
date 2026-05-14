// AGENCY GROUP — SH-ROS Observability: alertRouter | AMI: 22506

import { supabaseAdmin } from '@/lib/supabase'

export interface Alert {
  alert_id: string
  type: string
  severity: 'P0' | 'P1' | 'P2' | 'P3'
  title: string
  message: string
  org_id?: string
  metadata: Record<string, unknown>
  created_at: string
  acknowledged: boolean
}

export interface AlertCondition {
  type?: string
  severity?: string
  org_id?: string
  pattern?: RegExp
}

export type AlertDestination = 'system_alerts' | 'operator_tasks' | 'console' | 'webhook'

interface RouteEntry {
  condition: AlertCondition
  destination: AlertDestination
}

export class AlertRouter {
  private readonly _routes: RouteEntry[] = []
  private readonly _activeAlerts: Map<string, Alert> = new Map()

  constructor() {
    this._registerDefaults()
  }

  private _registerDefaults(): void {
    // P0/P1 → system_alerts + operator_tasks
    this._routes.push(
      { condition: { severity: 'P0' }, destination: 'system_alerts' },
      { condition: { severity: 'P0' }, destination: 'operator_tasks' },
      { condition: { severity: 'P1' }, destination: 'system_alerts' },
      { condition: { severity: 'P1' }, destination: 'operator_tasks' },
      // P2 → system_alerts
      { condition: { severity: 'P2' }, destination: 'system_alerts' },
      // P3 → console
      { condition: { severity: 'P3' }, destination: 'console' },
    )
  }

  registerRoute(condition: AlertCondition, destination: AlertDestination): void {
    this._routes.push({ condition, destination })
  }

  async route(alert: Alert): Promise<void> {
    this._activeAlerts.set(alert.alert_id, alert)

    const destinations = new Set<AlertDestination>()

    for (const route of this._routes) {
      if (this._matches(alert, route.condition)) {
        destinations.add(route.destination)
      }
    }

    // Default fallback: always console
    if (destinations.size === 0) {
      destinations.add('console')
    }

    const tasks: Promise<void>[] = []

    for (const dest of destinations) {
      tasks.push(this._dispatch(alert, dest))
    }

    await Promise.allSettled(tasks)
  }

  getActiveAlerts(org_id?: string): Alert[] {
    const all = Array.from(this._activeAlerts.values())
    if (org_id) return all.filter((a) => a.org_id === org_id)
    return all
  }

  async acknowledgeAlert(alert_id: string, acknowledged_by: string): Promise<void> {
    const alert = this._activeAlerts.get(alert_id)
    if (alert) {
      alert.acknowledged = true
    }

    try {
      await supabaseAdmin
        .from('system_alerts')
        .update({
          acknowledged: true,
          acknowledged_by,
          acknowledged_at: new Date().toISOString(),
        })
        .eq('id', alert_id)
    } catch (err) {
      console.warn('[AlertRouter] acknowledge error:', err)
    }
  }

  private _matches(alert: Alert, condition: AlertCondition): boolean {
    if (condition.type && alert.type !== condition.type) return false
    if (condition.severity && alert.severity !== condition.severity) return false
    if (condition.org_id && alert.org_id !== condition.org_id) return false
    if (condition.pattern && !condition.pattern.test(alert.message)) return false
    return true
  }

  private async _dispatch(alert: Alert, destination: AlertDestination): Promise<void> {
    switch (destination) {
      case 'system_alerts': {
        try {
          await supabaseAdmin.from('system_alerts').insert({
            alert_id: alert.alert_id,
            alert_type: alert.type,
            severity: alert.severity,
            title: alert.title,
            message: alert.message,
            org_id: alert.org_id ?? null,
            metadata: alert.metadata,
            created_at: alert.created_at,
            acknowledged: alert.acknowledged,
          })
        } catch (err) {
          console.warn('[AlertRouter] system_alerts insert error:', err)
        }
        break
      }

      case 'operator_tasks': {
        try {
          await supabaseAdmin.from('operator_tasks').insert({
            task_type: 'alert',
            title: `[${alert.severity}] ${alert.title}`,
            description: alert.message,
            org_id: alert.org_id ?? null,
            priority: alert.severity === 'P0' ? 'critical' : alert.severity === 'P1' ? 'high' : 'normal',
            metadata: { alert_id: alert.alert_id, ...alert.metadata },
            status: 'pending',
            created_at: alert.created_at,
          })
        } catch (err) {
          console.warn('[AlertRouter] operator_tasks insert error:', err)
        }
        break
      }

      case 'console': {
        const prefix = alert.severity === 'P0' || alert.severity === 'P1' ? 'error' : 'warn'
        console[prefix](`[AlertRouter][${alert.severity}] ${alert.title}: ${alert.message}`)
        break
      }

      case 'webhook': {
        const webhookUrl = process.env.ALERT_WEBHOOK_URL
        if (!webhookUrl) break
        try {
          await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(alert),
          })
        } catch (err) {
          console.warn('[AlertRouter] webhook dispatch error:', err)
        }
        break
      }
    }
  }
}

export const alertRouter = new AlertRouter()
