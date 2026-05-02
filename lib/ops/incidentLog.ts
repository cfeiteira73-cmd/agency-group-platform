// =============================================================================
// Agency Group — Incident Log
// lib/ops/incidentLog.ts
//
// Phase 7: Incident / Alert / Risk Management
//
// Tracks incident lifecycle from detection → investigation → mitigation → resolution.
// Links to system_alerts and operator_tasks for full observability chain.
//
// SEVERITY:
//   critical — revenue impacting, immediate action required
//   warning  — degraded state, monitor + plan mitigation
//   info     — informational, log for post-mortem
//
// ROOT CAUSE CATEGORIES:
//   code_bug | data_quality | external_provider | config | infra | human_error | unknown
//
// PURE FUNCTIONS:
//   classifyIncidentSeverity, buildIncident
//
// DB FUNCTIONS:
//   createIncident, updateIncidentStatus, mitigateIncident, resolveIncident,
//   getOpenIncidents, linkAlertToIncident
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IncidentSeverity = 'critical' | 'warning' | 'info'
export type IncidentStatus   = 'open' | 'investigating' | 'mitigated' | 'resolved'

export type RootCauseCategory =
  | 'code_bug'
  | 'data_quality'
  | 'external_provider'
  | 'config'
  | 'infra'
  | 'human_error'
  | 'unknown'

export interface Incident {
  id:                   string
  incident_type:        string
  title:                string
  description?:         string | null
  severity:             IncidentSeverity
  status:               IncidentStatus
  affected_systems:     string[]
  affected_count?:      number | null
  root_cause?:          string | null
  root_cause_category?: RootCauseCategory | null
  started_at?:          string | null
  detected_at:          string
  mitigated_at?:        string | null
  resolved_at?:         string | null
  duration_minutes?:    number | null
  detected_by?:         string | null
  owned_by?:            string | null
  alert_id?:            string | null
  post_mortem?:         string | null
  created_at:           string
  updated_at:           string
}

export interface IncidentPayload {
  incident_type:       string
  title:               string
  description?:        string
  severity:            IncidentSeverity
  affected_systems?:   string[]
  affected_count?:     number
  started_at?:         string
  detected_by?:        string
  owned_by?:           string
  alert_id?:           string
}

// ---------------------------------------------------------------------------
// PURE: Classify incident severity from incident type string
// ---------------------------------------------------------------------------

const CRITICAL_INCIDENT_TYPES: string[] = [
  'scoring_pipeline_down',
  'distribution_halted',
  'avm_compute_failure',
  'data_corruption',
  'auth_breach',
  'revenue_pipeline_blocked',
  'cron_cascade_failure',
]

const WARNING_INCIDENT_TYPES: string[] = [
  'provider_degraded',
  'high_error_rate',
  'scoring_drift_detected',
  'review_queue_overflow',
  'job_queue_backed_up',
  'avm_confidence_degraded',
  'distribution_slowdown',
]

export function classifyIncidentSeverity(incidentType: string): IncidentSeverity {
  if (CRITICAL_INCIDENT_TYPES.includes(incidentType)) return 'critical'
  if (WARNING_INCIDENT_TYPES.includes(incidentType))  return 'warning'
  return 'info'
}

// ---------------------------------------------------------------------------
// PURE: Build an incident payload
// ---------------------------------------------------------------------------

export function buildIncident(
  incidentType: string,
  title:        string,
  opts: {
    description?:     string
    severity?:        IncidentSeverity
    affectedSystems?: string[]
    affectedCount?:   number
    startedAt?:       string
    detectedBy?:      string
    ownedBy?:         string
    alertId?:         string
  } = {},
): IncidentPayload {
  return {
    incident_type:     incidentType,
    title,
    description:       opts.description,
    severity:          opts.severity ?? classifyIncidentSeverity(incidentType),
    affected_systems:  opts.affectedSystems ?? [],
    affected_count:    opts.affectedCount,
    started_at:        opts.startedAt,
    detected_by:       opts.detectedBy,
    owned_by:          opts.ownedBy,
    alert_id:          opts.alertId,
  }
}

// ---------------------------------------------------------------------------
// DB: Create a new incident
// ---------------------------------------------------------------------------

export async function createIncident(payload: IncidentPayload): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from('incident_log')
    .insert({
      incident_type:    payload.incident_type,
      title:            payload.title,
      description:      payload.description ?? null,
      severity:         payload.severity,
      status:           'open',
      affected_systems: payload.affected_systems ?? [],
      affected_count:   payload.affected_count ?? null,
      started_at:       payload.started_at ?? null,
      detected_at:      new Date().toISOString(),
      detected_by:      payload.detected_by ?? null,
      owned_by:         payload.owned_by ?? null,
      alert_id:         payload.alert_id ?? null,
    })
    .select('id')
    .single()

  if (error) throw new Error(`createIncident: ${error.message}`)
  return data.id as string
}

// ---------------------------------------------------------------------------
// DB: Update incident status
// ---------------------------------------------------------------------------

export async function updateIncidentStatus(
  id:       string,
  status:   IncidentStatus,
  opts: {
    rootCause?:         string
    rootCauseCategory?: RootCauseCategory
    ownedBy?:           string
    notes?:             string
  } = {},
): Promise<void> {
  const now = new Date().toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabaseAdmin as any)
    .from('incident_log')
    .update({
      status,
      updated_at:           now,
      ...(opts.rootCause          && { root_cause:          opts.rootCause }),
      ...(opts.rootCauseCategory  && { root_cause_category: opts.rootCauseCategory }),
      ...(opts.ownedBy            && { owned_by:            opts.ownedBy }),
    })
    .eq('id', id)

  if (error) throw new Error(`updateIncidentStatus: ${error.message}`)
}

// ---------------------------------------------------------------------------
// DB: Mark incident as mitigated
// ---------------------------------------------------------------------------

export async function mitigateIncident(
  id:         string,
  mitigatedBy: string,
  rootCause?:  string,
): Promise<void> {
  const now = new Date().toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabaseAdmin as any)
    .from('incident_log')
    .update({
      status:          'mitigated',
      mitigated_at:    now,
      owned_by:        mitigatedBy,
      root_cause:      rootCause ?? null,
      updated_at:      now,
    })
    .eq('id', id)

  if (error) throw new Error(`mitigateIncident: ${error.message}`)
}

// ---------------------------------------------------------------------------
// DB: Resolve an incident with post-mortem
// ---------------------------------------------------------------------------

export async function resolveIncident(
  id:          string,
  resolvedBy:  string,
  opts: {
    rootCause?:         string
    rootCauseCategory?: RootCauseCategory
    postMortem?:        string
  } = {},
): Promise<void> {
  const now = new Date().toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabaseAdmin as any)
    .from('incident_log')
    .update({
      status:               'resolved',
      resolved_at:          now,
      owned_by:             resolvedBy,
      root_cause:           opts.rootCause ?? null,
      root_cause_category:  opts.rootCauseCategory ?? null,
      post_mortem:          opts.postMortem ?? null,
      updated_at:           now,
    })
    .eq('id', id)

  if (error) throw new Error(`resolveIncident: ${error.message}`)
}

// ---------------------------------------------------------------------------
// DB: Get open incidents
// ---------------------------------------------------------------------------

export async function getOpenIncidents(
  severity?: IncidentSeverity,
): Promise<Incident[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabaseAdmin as any)
    .from('incident_log')
    .select('*')
    .in('status', ['open', 'investigating', 'mitigated'])
    .order('detected_at', { ascending: false })
    .limit(50)

  if (severity) query = query.eq('severity', severity)

  const { data, error } = await query
  if (error) throw new Error(`getOpenIncidents: ${error.message}`)
  return (data ?? []) as Incident[]
}

// ---------------------------------------------------------------------------
// DB: Link a system_alert to an incident
// ---------------------------------------------------------------------------

export async function linkAlertToIncident(
  incidentId: string,
  alertId:    string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabaseAdmin as any)
    .from('incident_log')
    .update({ alert_id: alertId, updated_at: new Date().toISOString() })
    .eq('id', incidentId)

  if (error) throw new Error(`linkAlertToIncident: ${error.message}`)
}
