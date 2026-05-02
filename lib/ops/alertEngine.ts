// =============================================================================
// Agency Group — Alert Engine
// lib/ops/alertEngine.ts
//
// Creates, deduplicates, and manages platform-level alerts.
// Alerts are raised by cron jobs, health checks, and anomaly detectors.
//
// SEVERITY LEVELS:
//   info     — informational, no action required
//   warning  — degraded state, monitor closely
//   critical — immediate action required, blocks revenue flow
//
// PURE FUNCTIONS:
//   buildAlert, classifyAlertSeverity, formatAlertTitle
//
// DB FUNCTIONS:
//   createAlert, acknowledgeAlert, resolveAlert, getActiveAlerts
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AlertSeverity = 'info' | 'warning' | 'critical'

export type AlertType =
  | 'cron_failure'
  | 'provider_failure'
  | 'score_drift_critical'
  | 'score_distribution_anomaly'
  | 'routing_failure'
  | 'pdf_generation_failure'
  | 'api_degradation'
  | 'review_queue_overdue'
  | 'data_quality_critical'
  | 'job_dead_letter'
  | 'avm_confidence_low'
  | 'distribution_paused'

export interface AlertPayload {
  type:       AlertType
  title:      string
  message:    string
  context?:   Record<string, unknown>
  dedup_key?: string   // if set, prevents duplicate active alerts
}

export interface SystemAlert {
  id:               string
  alert_type:       AlertType
  severity:         AlertSeverity
  title:            string
  message:          string
  context:          Record<string, unknown>
  status:           'active' | 'acknowledged' | 'resolved'
  acknowledged_by?: string
  acknowledged_at?: string
  resolved_at?:     string
  dedup_key?:       string
  created_at:       string
}

// ---------------------------------------------------------------------------
// PURE: Map alert type to default severity
// ---------------------------------------------------------------------------

export function classifyAlertSeverity(type: AlertType): AlertSeverity {
  const critical: AlertType[] = [
    'cron_failure',
    'score_drift_critical',
    'routing_failure',
    'provider_failure',
    'job_dead_letter',
  ]
  const warning: AlertType[] = [
    'score_distribution_anomaly',
    'review_queue_overdue',
    'data_quality_critical',
    'avm_confidence_low',
    'api_degradation',
    'distribution_paused',
  ]

  if (critical.includes(type)) return 'critical'
  if (warning.includes(type))  return 'warning'
  return 'info'
}

// ---------------------------------------------------------------------------
// PURE: Build a well-formed alert payload with dedup key
// ---------------------------------------------------------------------------

export function buildAlert(
  type:    AlertType,
  title:   string,
  message: string,
  context: Record<string, unknown> = {},
  dedupSuffix?: string,
): AlertPayload {
  const dateSuffix = new Date().toISOString().split('T')[0]  // YYYY-MM-DD
  const dedup_key  = dedupSuffix
    ? `${type}:${dedupSuffix}`
    : `${type}:${dateSuffix}`

  return { type, title, message, context, dedup_key }
}

// ---------------------------------------------------------------------------
// PURE: Format a human-readable alert title with emoji prefix
// ---------------------------------------------------------------------------

export function formatAlertTitle(type: AlertType, subject: string): string {
  const severity = classifyAlertSeverity(type)
  const emoji    = severity === 'critical' ? '🚨' : severity === 'warning' ? '⚠️' : 'ℹ️'
  return `${emoji} ${subject}`
}

// ---------------------------------------------------------------------------
// DB: Create or update an alert (deduplicates by dedup_key)
// ---------------------------------------------------------------------------

export async function createAlert(payload: AlertPayload): Promise<string | null> {
  const severity = classifyAlertSeverity(payload.type)

  // If dedup_key set — check for existing active alert with same key
  if (payload.dedup_key) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabaseAdmin as any)
      .from('system_alerts')
      .select('id')
      .eq('dedup_key', payload.dedup_key)
      .eq('status', 'active')
      .single()

    if (existing) return null  // already active — skip
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from('system_alerts')
    .insert({
      alert_type: payload.type,
      severity,
      title:      payload.title,
      message:    payload.message,
      context:    payload.context ?? {},
      dedup_key:  payload.dedup_key ?? null,
      status:     'active',
    })
    .select('id')
    .single()

  if (error) throw new Error(`createAlert: ${error.message}`)
  return data.id as string
}

// ---------------------------------------------------------------------------
// DB: Acknowledge an alert
// ---------------------------------------------------------------------------

export async function acknowledgeAlert(
  alertId:  string,
  byEmail:  string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabaseAdmin as any)
    .from('system_alerts')
    .update({
      status:           'acknowledged',
      acknowledged_by:  byEmail,
      acknowledged_at:  new Date().toISOString(),
    })
    .eq('id', alertId)

  if (error) throw new Error(`acknowledgeAlert: ${error.message}`)
}

// ---------------------------------------------------------------------------
// DB: Resolve an alert
// ---------------------------------------------------------------------------

export async function resolveAlert(alertId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabaseAdmin as any)
    .from('system_alerts')
    .update({ status: 'resolved', resolved_at: new Date().toISOString() })
    .eq('id', alertId)

  if (error) throw new Error(`resolveAlert: ${error.message}`)
}

// ---------------------------------------------------------------------------
// DB: Get active alerts (optionally filtered by severity)
// ---------------------------------------------------------------------------

export async function getActiveAlerts(
  severity?: AlertSeverity,
): Promise<SystemAlert[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabaseAdmin as any)
    .from('system_alerts')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(100)

  if (severity) query = query.eq('severity', severity)

  const { data, error } = await query
  if (error) throw new Error(`getActiveAlerts: ${error.message}`)
  return (data ?? []) as SystemAlert[]
}
