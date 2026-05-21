// Agency Group — Session Recorder
// lib/security/sessionRecorder.ts
// TypeScript strict — 0 errors
//
// Financial-grade session recording for privileged operations.
// Immutable append-only log — no UPDATE/DELETE allowed.
// Captures: admin actions, settlement actions, replay execution,
//           compliance overrides, tenant impersonation.
// All entries SHA-256 chained.

import { createHash, randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ─────────────────────────────────────────────────────────────────────

export type SessionActionType =
  | 'admin_config_change'
  | 'settlement_execution'
  | 'replay_operation'
  | 'compliance_override'
  | 'tenant_impersonation'
  | 'privileged_data_access'
  | 'jit_elevation_use'
  | 'incident_response_action'
  | 'credential_rotation'
  | 'backup_restore'

export interface SessionRecord {
  record_id: string
  session_id: string
  user_id: string
  tenant_id: string
  action_type: SessionActionType
  action_detail: string
  resource_type: string | null
  resource_id: string | null
  payload_hash: string
  previous_record_hash: string | null
  record_hash: string
  ip_address: string | null
  user_agent: string | null
  approved_by: string | null
  recorded_at: string
}

// ─── Hash helpers ───────────────────────────────────────────────────────────────

function hashPayload(payload: Record<string, unknown>): string {
  return createHash('sha256')
    .update(JSON.stringify(payload, Object.keys(payload).sort()))
    .digest('hex')
}

function hashRecord(
  recordId: string,
  sessionId: string,
  userId: string,
  tenantId: string,
  actionType: string,
  actionDetail: string,
  payloadHash: string,
  previousHash: string | null,
  recordedAt: string,
): string {
  const parts = [
    recordId,
    sessionId,
    userId,
    tenantId,
    actionType,
    actionDetail,
    payloadHash,
    previousHash ?? '',
    recordedAt,
  ]
  return createHash('sha256').update(parts.join('||')).digest('hex')
}

// ─── getLastRecordHash ──────────────────────────────────────────────────────────

async function getLastRecordHash(sessionId: string): Promise<string | null> {
  try {
    const db = supabaseAdmin as any
    const { data, error } = await db
      .from('privileged_session_log')
      .select('record_hash')
      .eq('session_id', sessionId)
      .order('recorded_at', { ascending: false })
      .limit(1)

    if (error || !data) return null

    const rows = (data ?? []) as Array<{ record_hash: string }>
    return rows.length > 0 ? rows[0].record_hash : null
  } catch {
    return null
  }
}

// ─── recordAction ───────────────────────────────────────────────────────────────

export async function recordAction(
  sessionId: string,
  userId: string,
  tenantId: string,
  actionType: SessionActionType,
  detail: string,
  payload: Record<string, unknown>,
  meta?: {
    resourceType?: string
    resourceId?: string
    approvedBy?: string
    ipAddress?: string
    userAgent?: string
  },
): Promise<SessionRecord> {
  const db = supabaseAdmin as any
  const recordId = randomUUID()
  const recordedAt = new Date().toISOString()

  const payloadHash = hashPayload(payload)
  const previousRecordHash = await getLastRecordHash(sessionId)

  const recordHash = hashRecord(
    recordId,
    sessionId,
    userId,
    tenantId,
    actionType,
    detail,
    payloadHash,
    previousRecordHash,
    recordedAt,
  )

  const record: SessionRecord = {
    record_id: recordId,
    session_id: sessionId,
    user_id: userId,
    tenant_id: tenantId,
    action_type: actionType,
    action_detail: detail,
    resource_type: meta?.resourceType ?? null,
    resource_id: meta?.resourceId ?? null,
    payload_hash: payloadHash,
    previous_record_hash: previousRecordHash,
    record_hash: recordHash,
    ip_address: meta?.ipAddress ?? null,
    user_agent: meta?.userAgent ?? null,
    approved_by: meta?.approvedBy ?? null,
    recorded_at: recordedAt,
  }

  const { error } = await db
    .from('privileged_session_log')
    .insert({
      id: recordId,
      session_id: sessionId,
      user_id: userId,
      tenant_id: tenantId,
      action_type: actionType,
      action_detail: detail,
      resource_type: record.resource_type,
      resource_id: record.resource_id,
      payload_hash: payloadHash,
      previous_record_hash: previousRecordHash,
      record_hash: recordHash,
      ip_address: record.ip_address,
      user_agent: record.user_agent,
      approved_by: record.approved_by,
      recorded_at: recordedAt,
    })

  if (error) {
    log.warn('[SessionRecorder] recordAction insert failed', {
      error: error.message,
      session_id: sessionId,
      action_type: actionType,
    })
    throw new Error(`SessionRecorder: insert failed — ${error.message}`)
  }

  log.info('[SessionRecorder] action recorded', {
    record_id: recordId,
    session_id: sessionId,
    user_id: userId,
    action_type: actionType,
    chained: previousRecordHash !== null,
  })

  return record
}

// ─── verifySessionChain ────────────────────────────────────────────────────────

export async function verifySessionChain(
  sessionId: string,
): Promise<{ valid: boolean; records: number; broken_at: string | null }> {
  const db = supabaseAdmin as any

  try {
    const { data, error } = await db
      .from('privileged_session_log')
      .select('id, session_id, user_id, tenant_id, action_type, action_detail, payload_hash, previous_record_hash, record_hash, recorded_at')
      .eq('session_id', sessionId)
      .order('recorded_at', { ascending: true })

    if (error || !data) {
      return { valid: false, records: 0, broken_at: null }
    }

    const rows = data as Array<{
      id: string
      session_id: string
      user_id: string
      tenant_id: string
      action_type: string
      action_detail: string
      payload_hash: string
      previous_record_hash: string | null
      record_hash: string
      recorded_at: string
    }>

    if (rows.length === 0) {
      return { valid: true, records: 0, broken_at: null }
    }

    let previousHash: string | null = null

    for (const row of rows) {
      // Verify previous_record_hash linkage
      if (row.previous_record_hash !== previousHash) {
        return { valid: false, records: rows.length, broken_at: row.id }
      }

      // Recompute record_hash to verify integrity
      const expectedHash = hashRecord(
        row.id,
        row.session_id,
        row.user_id,
        row.tenant_id,
        row.action_type,
        row.action_detail,
        row.payload_hash,
        row.previous_record_hash,
        row.recorded_at,
      )

      if (expectedHash !== row.record_hash) {
        return { valid: false, records: rows.length, broken_at: row.id }
      }

      previousHash = row.record_hash
    }

    return { valid: true, records: rows.length, broken_at: null }
  } catch (err) {
    log.warn('[SessionRecorder] verifySessionChain failed', {
      error: err instanceof Error ? err.message : String(err),
      session_id: sessionId,
    })
    return { valid: false, records: 0, broken_at: null }
  }
}

// ─── getSessionHistory ─────────────────────────────────────────────────────────

export async function getSessionHistory(
  userId: string,
  tenantId: string,
  since?: string,
): Promise<SessionRecord[]> {
  try {
    const db = supabaseAdmin as any
    let query = db
      .from('privileged_session_log')
      .select('id, session_id, user_id, tenant_id, action_type, action_detail, resource_type, resource_id, payload_hash, previous_record_hash, record_hash, ip_address, user_agent, approved_by, recorded_at')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .order('recorded_at', { ascending: false })
      .limit(200)

    if (since) {
      query = query.gte('recorded_at', since)
    }

    const { data, error } = await query

    if (error || !data) return []

    return (data as Array<{
      id: string
      session_id: string
      user_id: string
      tenant_id: string
      action_type: SessionActionType
      action_detail: string
      resource_type: string | null
      resource_id: string | null
      payload_hash: string
      previous_record_hash: string | null
      record_hash: string
      ip_address: string | null
      user_agent: string | null
      approved_by: string | null
      recorded_at: string
    }>).map(row => ({
      record_id: row.id,
      session_id: row.session_id,
      user_id: row.user_id,
      tenant_id: row.tenant_id,
      action_type: row.action_type,
      action_detail: row.action_detail,
      resource_type: row.resource_type,
      resource_id: row.resource_id,
      payload_hash: row.payload_hash,
      previous_record_hash: row.previous_record_hash,
      record_hash: row.record_hash,
      ip_address: row.ip_address,
      user_agent: row.user_agent,
      approved_by: row.approved_by,
      recorded_at: row.recorded_at,
    }))
  } catch (err) {
    log.warn('[SessionRecorder] getSessionHistory failed', {
      error: err instanceof Error ? err.message : String(err),
    })
    return []
  }
}

// ─── exportSessionAudit ───────────────────────────────────────────────────────

export async function exportSessionAudit(
  tenantId: string,
  since: string,
  until: string,
): Promise<SessionRecord[]> {
  try {
    const db = supabaseAdmin as any
    const { data, error } = await db
      .from('privileged_session_log')
      .select('id, session_id, user_id, tenant_id, action_type, action_detail, resource_type, resource_id, payload_hash, previous_record_hash, record_hash, ip_address, user_agent, approved_by, recorded_at')
      .eq('tenant_id', tenantId)
      .gte('recorded_at', since)
      .lte('recorded_at', until)
      .order('recorded_at', { ascending: true })

    if (error || !data) {
      log.warn('[SessionRecorder] exportSessionAudit failed', { error: error?.message })
      return []
    }

    return (data as Array<{
      id: string
      session_id: string
      user_id: string
      tenant_id: string
      action_type: SessionActionType
      action_detail: string
      resource_type: string | null
      resource_id: string | null
      payload_hash: string
      previous_record_hash: string | null
      record_hash: string
      ip_address: string | null
      user_agent: string | null
      approved_by: string | null
      recorded_at: string
    }>).map(row => ({
      record_id: row.id,
      session_id: row.session_id,
      user_id: row.user_id,
      tenant_id: row.tenant_id,
      action_type: row.action_type,
      action_detail: row.action_detail,
      resource_type: row.resource_type,
      resource_id: row.resource_id,
      payload_hash: row.payload_hash,
      previous_record_hash: row.previous_record_hash,
      record_hash: row.record_hash,
      ip_address: row.ip_address,
      user_agent: row.user_agent,
      approved_by: row.approved_by,
      recorded_at: row.recorded_at,
    }))
  } catch (err) {
    log.warn('[SessionRecorder] exportSessionAudit threw', {
      error: err instanceof Error ? err.message : String(err),
    })
    return []
  }
}
