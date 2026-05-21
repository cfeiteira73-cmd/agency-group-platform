// Agency Group — Incident Response Engine
// lib/security/incidentResponseEngine.ts
// TypeScript strict — 0 errors
//
// Automated response to security incidents.
// Actions: isolate_account, revoke_sessions, freeze_settlement, pause_replay,
//          force_mfa_reset, lock_privileged_actions, quarantine_tenant
// All actions are logged to incident_response_log and are REVERSIBLE except quarantine.

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import type { ThreatSignal } from './runtimeThreatEngine'

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ResponseAction =
  | 'isolate_account'
  | 'revoke_sessions'
  | 'freeze_settlement'
  | 'pause_replay'
  | 'force_mfa_reset'
  | 'lock_privileged_actions'
  | 'quarantine_tenant'
  | 'notify_security_team'

export interface IncidentRecord {
  incident_id: string
  tenant_id: string
  threat_signal_id: string | null
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  description: string
  actions_taken: ResponseAction[]
  status: 'open' | 'contained' | 'resolved' | 'false_positive'
  responder_id: string | null
  created_at: string
  resolved_at: string | null
  timeline: Array<{ timestamp: string; action: string; actor: string; result: string }>
}

export interface ResponseResult {
  action: ResponseAction
  success: boolean
  details: string
  executed_at: string
}

// ─── Row → IncidentRecord ──────────────────────────────────────────────────────

function toIncidentRecord(row: Record<string, unknown>): IncidentRecord {
  return {
    incident_id:      String(row['id'] ?? ''),
    tenant_id:        String(row['tenant_id'] ?? ''),
    threat_signal_id: row['threat_signal_id'] != null ? String(row['threat_signal_id']) : null,
    severity:         (row['severity'] as IncidentRecord['severity']) ?? 'low',
    title:            String(row['title'] ?? ''),
    description:      String(row['description'] ?? ''),
    actions_taken:    (row['actions_taken'] as ResponseAction[]) ?? [],
    status:           (row['status'] as IncidentRecord['status']) ?? 'open',
    responder_id:     row['responder_id'] != null ? String(row['responder_id']) : null,
    created_at:       String(row['created_at'] ?? new Date().toISOString()),
    resolved_at:      row['resolved_at'] != null ? String(row['resolved_at']) : null,
    timeline:         (row['timeline'] as IncidentRecord['timeline']) ?? [],
  }
}

// ─── Log response action ───────────────────────────────────────────────────────

async function logResponseAction(
  incidentId: string,
  tenantId: string,
  action: ResponseAction,
  success: boolean,
  details: string,
  executedBy: string = 'incident_response_engine',
): Promise<void> {
  const now = new Date().toISOString()

  void (supabaseAdmin as any)
    .from('incident_response_log')
    .insert({
      id:          randomUUID(),
      incident_id: incidentId,
      tenant_id:   tenantId,
      action,
      success,
      details,
      executed_by: executedBy,
      executed_at: now,
    })
    .catch((e: unknown) =>
      log.warn('[incidentResponseEngine] logResponseAction failed', {
        incident_id: incidentId,
        action,
        error: e instanceof Error ? e.message : String(e),
      }),
    )
}

// ─── Action implementations ────────────────────────────────────────────────────

async function executeIsolateAccount(
  tenantId: string,
  actorId: string | null,
): Promise<ResponseResult> {
  const executedAt = new Date().toISOString()
  try {
    if (!actorId) {
      return {
        action:      'isolate_account',
        success:     false,
        details:     'No actor_id — cannot isolate',
        executed_at: executedAt,
      }
    }
    await (supabaseAdmin as any)
      .from('tenant_user_roles')
      .update({ isolated: true, isolated_at: executedAt })
      .eq('tenant_id', tenantId)
      .eq('actor_id', actorId)
    return {
      action:      'isolate_account',
      success:     true,
      details:     `Account ${actorId} isolated`,
      executed_at: executedAt,
    }
  } catch (e) {
    return {
      action:      'isolate_account',
      success:     false,
      details:     e instanceof Error ? e.message : String(e),
      executed_at: executedAt,
    }
  }
}

async function executeRevokeSessions(
  tenantId: string,
  actorId: string | null,
): Promise<ResponseResult> {
  const executedAt = new Date().toISOString()
  try {
    // Mark all active sessions as revoked for this actor
    let query = (supabaseAdmin as any)
      .from('user_sessions')
      .update({ revoked: true, revoked_at: executedAt, revoked_reason: 'incident_response' })
      .eq('tenant_id', tenantId)

    if (actorId) {
      query = query.eq('actor_id', actorId)
    }

    await query
    return {
      action:      'revoke_sessions',
      success:     true,
      details:     actorId ? `Sessions revoked for actor ${actorId}` : `All tenant sessions revoked`,
      executed_at: executedAt,
    }
  } catch (e) {
    return {
      action:      'revoke_sessions',
      success:     false,
      details:     e instanceof Error ? e.message : String(e),
      executed_at: executedAt,
    }
  }
}

async function executeFreezeSetting(tenantId: string): Promise<ResponseResult> {
  const executedAt = new Date().toISOString()
  try {
    await (supabaseAdmin as any)
      .from('capital_transactions')
      .update({ status: 'frozen', frozen_at: executedAt, frozen_reason: 'incident_response' })
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
    return {
      action:      'freeze_settlement',
      success:     true,
      details:     `All pending capital transactions frozen for tenant ${tenantId}`,
      executed_at: executedAt,
    }
  } catch (e) {
    return {
      action:      'freeze_settlement',
      success:     false,
      details:     e instanceof Error ? e.message : String(e),
      executed_at: executedAt,
    }
  }
}

async function executePauseReplay(
  tenantId: string,
  incidentId: string,
): Promise<ResponseResult> {
  const executedAt = new Date().toISOString()
  try {
    await (supabaseAdmin as any)
      .from('replay_pause_flags')
      .insert({
        id:          randomUUID(),
        tenant_id:   tenantId,
        incident_id: incidentId,
        paused_by:   'incident_response_engine',
        reason:      `Paused by incident ${incidentId}`,
        active:      true,
        created_at:  executedAt,
      })
    return {
      action:      'pause_replay',
      success:     true,
      details:     `Replay paused for tenant ${tenantId} due to incident ${incidentId}`,
      executed_at: executedAt,
    }
  } catch (e) {
    return {
      action:      'pause_replay',
      success:     false,
      details:     e instanceof Error ? e.message : String(e),
      executed_at: executedAt,
    }
  }
}

async function executeForceMfaReset(
  tenantId: string,
  actorId: string | null,
): Promise<ResponseResult> {
  const executedAt = new Date().toISOString()
  try {
    let query = (supabaseAdmin as any)
      .from('tenant_user_roles')
      .update({ mfa_reset_required: true, mfa_reset_at: executedAt })
      .eq('tenant_id', tenantId)

    if (actorId) {
      query = query.eq('actor_id', actorId)
    }

    await query
    return {
      action:      'force_mfa_reset',
      success:     true,
      details:     actorId ? `MFA reset forced for ${actorId}` : `MFA reset forced for all tenant users`,
      executed_at: executedAt,
    }
  } catch (e) {
    return {
      action:      'force_mfa_reset',
      success:     false,
      details:     e instanceof Error ? e.message : String(e),
      executed_at: executedAt,
    }
  }
}

async function executeLockPrivilegedActions(tenantId: string): Promise<ResponseResult> {
  const executedAt = new Date().toISOString()
  try {
    await (supabaseAdmin as any)
      .from('tenant_security_locks')
      .upsert({
        tenant_id:           tenantId,
        privileged_locked:   true,
        locked_at:           executedAt,
        locked_by:           'incident_response_engine',
      },
      { onConflict: 'tenant_id' })
    return {
      action:      'lock_privileged_actions',
      success:     true,
      details:     `Privileged actions locked for tenant ${tenantId}`,
      executed_at: executedAt,
    }
  } catch (e) {
    return {
      action:      'lock_privileged_actions',
      success:     false,
      details:     e instanceof Error ? e.message : String(e),
      executed_at: executedAt,
    }
  }
}

async function executeQuarantineTenant(tenantId: string): Promise<ResponseResult> {
  const executedAt = new Date().toISOString()
  try {
    await (supabaseAdmin as any)
      .from('tenant_isolation_status')
      .upsert({
        tenant_id:       tenantId,
        quarantined:     true,
        quarantined_at:  executedAt,
        quarantined_by:  'incident_response_engine',
      },
      { onConflict: 'tenant_id' })
    return {
      action:      'quarantine_tenant',
      success:     true,
      details:     `Tenant ${tenantId} quarantined — ALL access blocked`,
      executed_at: executedAt,
    }
  } catch (e) {
    return {
      action:      'quarantine_tenant',
      success:     false,
      details:     e instanceof Error ? e.message : String(e),
      executed_at: executedAt,
    }
  }
}

async function executeNotifySecurityTeam(
  tenantId: string,
  incidentId: string,
  severity: string,
): Promise<ResponseResult> {
  const executedAt = new Date().toISOString()
  try {
    // Emit SIEM event for security team notification
    const { emitSecurityEvent } = await import('./siemPipeline')
    await emitSecurityEvent({
      tenant_id:      tenantId,
      category:       'incident_response',
      severity:       severity as 'info' | 'low' | 'medium' | 'high' | 'critical',
      actor_id:       null,
      actor_type:     'system',
      action:         'security_team_notification',
      resource_type:  'incident',
      resource_id:    incidentId,
      outcome:        'success',
      source_ip:      null,
      geo_region:     null,
      raw_event:      { incident_id: incidentId, tenant_id: tenantId, severity },
      correlation_id: incidentId,
      mitre_technique: null,
    })
    return {
      action:      'notify_security_team',
      success:     true,
      details:     `Security team notified via SIEM for incident ${incidentId}`,
      executed_at: executedAt,
    }
  } catch (e) {
    return {
      action:      'notify_security_team',
      success:     false,
      details:     e instanceof Error ? e.message : String(e),
      executed_at: executedAt,
    }
  }
}

// ─── createIncident ────────────────────────────────────────────────────────────

export async function createIncident(
  tenantId: string,
  signal: ThreatSignal,
): Promise<IncidentRecord> {
  const id = randomUUID()
  const now = new Date().toISOString()

  const title = `${signal.threat_type.replace(/_/g, ' ').toUpperCase()} — ${signal.severity.toUpperCase()}`
  const description = `Automated incident created from threat signal ${signal.signal_id}. Confidence: ${signal.confidence}%. Evidence: ${JSON.stringify(signal.evidence)}`

  const { data, error } = await (supabaseAdmin as any)
    .from('security_incidents')
    .insert({
      id,
      tenant_id:        tenantId,
      threat_signal_id: signal.signal_id,
      severity:         signal.severity,
      title,
      description,
      actions_taken:    [],
      status:           'open',
      responder_id:     null,
      timeline:         [{
        timestamp: now,
        action:    'incident_created',
        actor:     'incident_response_engine',
        result:    `Created from threat signal ${signal.signal_id}`,
      }],
      resolved_at:      null,
      created_at:       now,
    })
    .select('*')
    .single() as { data: Record<string, unknown> | null; error: { message: string } | null }

  if (error || !data) {
    const msg = error?.message ?? 'insert returned no data'
    log.warn('[incidentResponseEngine] createIncident failed', {
      tenant_id: tenantId,
      signal_id: signal.signal_id,
      error: msg,
    })
    // Return in-memory record
    return {
      incident_id:      id,
      tenant_id:        tenantId,
      threat_signal_id: signal.signal_id,
      severity:         signal.severity,
      title,
      description,
      actions_taken:    [],
      status:           'open',
      responder_id:     null,
      created_at:       now,
      resolved_at:      null,
      timeline:         [{
        timestamp: now,
        action:    'incident_created',
        actor:     'incident_response_engine',
        result:    `Created from threat signal ${signal.signal_id}`,
      }],
    }
  }

  return toIncidentRecord(data)
}

// ─── executeResponse ───────────────────────────────────────────────────────────

export async function executeResponse(
  incidentId: string,
  actions: ResponseAction[],
): Promise<ResponseResult[]> {
  // Fetch incident to get tenant_id and actor context
  const { data: incData, error: incErr } = await (supabaseAdmin as any)
    .from('security_incidents')
    .select('*')
    .eq('id', incidentId)
    .maybeSingle() as { data: Record<string, unknown> | null; error: { message: string } | null }

  if (incErr || !incData) {
    log.warn('[incidentResponseEngine] executeResponse: incident not found', {
      incident_id: incidentId,
      error: incErr?.message,
    })
    return []
  }

  const incident = toIncidentRecord(incData)
  const actorId = incident.threat_signal_id
    ? await getActorIdFromSignal(incident.threat_signal_id)
    : null

  const results: ResponseResult[] = []
  const timelineEntries: IncidentRecord['timeline'] = []

  for (const action of actions) {
    let result: ResponseResult

    switch (action) {
      case 'isolate_account':
        result = await executeIsolateAccount(incident.tenant_id, actorId)
        break
      case 'revoke_sessions':
        result = await executeRevokeSessions(incident.tenant_id, actorId)
        break
      case 'freeze_settlement':
        result = await executeFreezeSetting(incident.tenant_id)
        break
      case 'pause_replay':
        result = await executePauseReplay(incident.tenant_id, incidentId)
        break
      case 'force_mfa_reset':
        result = await executeForceMfaReset(incident.tenant_id, actorId)
        break
      case 'lock_privileged_actions':
        result = await executeLockPrivilegedActions(incident.tenant_id)
        break
      case 'quarantine_tenant':
        result = await executeQuarantineTenant(incident.tenant_id)
        break
      case 'notify_security_team':
        result = await executeNotifySecurityTeam(incident.tenant_id, incidentId, incident.severity)
        break
      default: {
        const _exhaustive: never = action
        result = {
          action:      _exhaustive,
          success:     false,
          details:     `Unknown action: ${String(_exhaustive)}`,
          executed_at: new Date().toISOString(),
        }
      }
    }

    results.push(result)

    timelineEntries.push({
      timestamp: result.executed_at,
      action,
      actor:     'incident_response_engine',
      result:    result.success ? result.details : `FAILED: ${result.details}`,
    })

    await logResponseAction(
      incidentId,
      incident.tenant_id,
      action,
      result.success,
      result.details,
    )
  }

  // Update incident: append actions and timeline
  const updatedActionsTaken = [...incident.actions_taken, ...actions]
  const updatedTimeline = [...incident.timeline, ...timelineEntries]

  void (supabaseAdmin as any)
    .from('security_incidents')
    .update({
      actions_taken: updatedActionsTaken,
      timeline:      updatedTimeline,
      status:        'contained',
    })
    .eq('id', incidentId)
    .catch((e: unknown) =>
      log.warn('[incidentResponseEngine] executeResponse update failed', {
        incident_id: incidentId,
        error: e instanceof Error ? e.message : String(e),
      }),
    )

  return results
}

// ─── Helper: get actor_id from threat signal ───────────────────────────────────

async function getActorIdFromSignal(signalId: string): Promise<string | null> {
  try {
    const { data } = await (supabaseAdmin as any)
      .from('threat_signals')
      .select('actor_id')
      .eq('id', signalId)
      .maybeSingle() as { data: { actor_id: string | null } | null }
    return data?.actor_id ?? null
  } catch {
    return null
  }
}

// ─── autoRespond ──────────────────────────────────────────────────────────────

export async function autoRespond(signal: ThreatSignal): Promise<IncidentRecord> {
  const incident = await createIncident(signal.tenant_id, signal)

  let actions: ResponseAction[]

  switch (signal.severity) {
    case 'critical':
      actions = ['quarantine_tenant', 'freeze_settlement', 'revoke_sessions']
      break
    case 'high':
      actions = ['freeze_settlement', 'lock_privileged_actions', 'notify_security_team']
      break
    case 'medium':
      actions = ['lock_privileged_actions', 'notify_security_team']
      break
    default:
      actions = ['notify_security_team']
  }

  await executeResponse(incident.incident_id, actions)

  // Refetch latest state
  const { data } = await (supabaseAdmin as any)
    .from('security_incidents')
    .select('*')
    .eq('id', incident.incident_id)
    .maybeSingle() as { data: Record<string, unknown> | null }

  return data ? toIncidentRecord(data) : incident
}

// ─── resolveIncident ───────────────────────────────────────────────────────────

export async function resolveIncident(
  incidentId: string,
  resolution: string,
  resolvedBy: string,
): Promise<void> {
  const now = new Date().toISOString()

  // Fetch current timeline
  const { data } = await (supabaseAdmin as any)
    .from('security_incidents')
    .select('timeline')
    .eq('id', incidentId)
    .maybeSingle() as { data: { timeline: IncidentRecord['timeline'] } | null }

  const existingTimeline: IncidentRecord['timeline'] = data?.timeline ?? []
  const updatedTimeline: IncidentRecord['timeline'] = [
    ...existingTimeline,
    {
      timestamp: now,
      action:    'incident_resolved',
      actor:     resolvedBy,
      result:    resolution,
    },
  ]

  const { error } = await (supabaseAdmin as any)
    .from('security_incidents')
    .update({
      status:      'resolved',
      resolved_at: now,
      responder_id: resolvedBy,
      timeline:    updatedTimeline,
    })
    .eq('id', incidentId) as { error: { message: string } | null }

  if (error) {
    log.warn('[incidentResponseEngine] resolveIncident failed', {
      incident_id: incidentId,
      resolved_by: resolvedBy,
      error: error.message,
    })
    return
  }

  log.info('[incidentResponseEngine] Incident resolved', {
    incident_id: incidentId,
    resolved_by: resolvedBy,
    resolution,
  })
}

// ─── getOpenIncidents ──────────────────────────────────────────────────────────

export async function getOpenIncidents(tenantId: string): Promise<IncidentRecord[]> {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('security_incidents')
      .select('*')
      .eq('tenant_id', tenantId)
      .in('status', ['open', 'contained'])
      .order('created_at', { ascending: false })
      .limit(100) as {
        data: Array<Record<string, unknown>> | null
        error: { message: string } | null
      }

    if (error) {
      log.warn('[incidentResponseEngine] getOpenIncidents failed', {
        tenant_id: tenantId,
        error: error.message,
      })
      return []
    }

    return (data ?? []).map(toIncidentRecord)
  } catch (err) {
    log.warn('[incidentResponseEngine] getOpenIncidents error', {
      tenant_id: tenantId,
      error: err instanceof Error ? err.message : String(err),
    })
    return []
  }
}
