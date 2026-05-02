// =============================================================================
// Agency Group — Audit Log
// lib/auth/auditLog.ts
//
// Immutable append-only audit trail for all operational overrides.
// Every action that changes system state must be logged here.
//
// The audit log is the source of truth for compliance, dispute resolution,
// and security forensics.
//
// PURE FUNCTIONS:
//   buildAuditEntry, formatAuditSummary
//
// DB FUNCTIONS:
//   logAction, getAuditTrail
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AuditActionType =
  | 'approve_deal'
  | 'reject_deal'
  | 'override_score'
  | 'override_routing'
  | 'pause_distribution'
  | 'resume_distribution'
  | 'force_route'
  | 'grant_role'
  | 'revoke_role'
  | 'acknowledge_alert'
  | 'resolve_alert'
  | 'replay_job'
  | 'record_attribution'
  | 'update_commission'
  | 'update_partner_tier'
  | 'flag_data_quality'
  | 'resolve_data_quality'

export type AuditResourceType =
  | 'deal_review'
  | 'distribution_event'
  | 'distribution_control'
  | 'property'
  | 'system_alert'
  | 'job_queue'
  | 'admin_role'
  | 'commission_record'
  | 'partner_tier'
  | 'data_quality_flag'

export interface AuditEntry {
  actor_email:    string
  actor_role?:    string
  action_type:    AuditActionType
  resource_type:  AuditResourceType
  resource_id:    string
  old_value?:     Record<string, unknown>
  new_value?:     Record<string, unknown>
  ip_address?:    string
  user_agent?:    string
}

export interface AuditRecord extends AuditEntry {
  id:         string
  created_at: string
}

// ---------------------------------------------------------------------------
// PURE: Build a well-typed audit entry
// ---------------------------------------------------------------------------

export function buildAuditEntry(
  actorEmail:   string,
  actionType:   AuditActionType,
  resourceType: AuditResourceType,
  resourceId:   string,
  opts: {
    actorRole?:  string
    oldValue?:   Record<string, unknown>
    newValue?:   Record<string, unknown>
    ipAddress?:  string
    userAgent?:  string
  } = {},
): AuditEntry {
  return {
    actor_email:   actorEmail,
    actor_role:    opts.actorRole,
    action_type:   actionType,
    resource_type: resourceType,
    resource_id:   resourceId,
    old_value:     opts.oldValue,
    new_value:     opts.newValue,
    ip_address:    opts.ipAddress,
    user_agent:    opts.userAgent,
  }
}

// ---------------------------------------------------------------------------
// PURE: Format a human-readable summary of an audit record
// ---------------------------------------------------------------------------

export function formatAuditSummary(entry: AuditEntry): string {
  const actor = entry.actor_role
    ? `${entry.actor_email} (${entry.actor_role})`
    : entry.actor_email
  return `[${entry.action_type}] ${actor} → ${entry.resource_type}:${entry.resource_id}`
}

// ---------------------------------------------------------------------------
// DB: Log an action to the audit trail
// ---------------------------------------------------------------------------

export async function logAction(entry: AuditEntry): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabaseAdmin as any)
    .from('audit_log')
    .insert({
      actor_email:   entry.actor_email,
      actor_role:    entry.actor_role    ?? null,
      action_type:   entry.action_type,
      resource_type: entry.resource_type,
      resource_id:   entry.resource_id,
      old_value:     entry.old_value     ?? null,
      new_value:     entry.new_value     ?? null,
      ip_address:    entry.ip_address    ?? null,
      user_agent:    entry.user_agent    ?? null,
    })

  if (error) {
    // Audit log failures must NEVER block operations — log to console only
    console.error('[audit_log] failed to write:', error.message, JSON.stringify(entry))
  }
}

// ---------------------------------------------------------------------------
// DB: Get audit trail for a specific resource
// ---------------------------------------------------------------------------

export async function getAuditTrail(
  resourceType: AuditResourceType,
  resourceId:   string,
  limit         = 50,
): Promise<AuditRecord[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from('audit_log')
    .select('*')
    .eq('resource_type', resourceType)
    .eq('resource_id', resourceId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(`getAuditTrail: ${error.message}`)
  return (data ?? []) as AuditRecord[]
}

// ---------------------------------------------------------------------------
// DB: Get recent actions by actor
// ---------------------------------------------------------------------------

export async function getActorHistory(
  actorEmail: string,
  limit       = 100,
): Promise<AuditRecord[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from('audit_log')
    .select('*')
    .eq('actor_email', actorEmail)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(`getActorHistory: ${error.message}`)
  return (data ?? []) as AuditRecord[]
}
