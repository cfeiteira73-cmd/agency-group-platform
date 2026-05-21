// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — Immutable Audit Log v1.0
// lib/compliance/immutableAuditLog.ts
//
// Financial-grade immutable audit log with SHA-256 chaining.
// Each entry's hash covers (sequence_number, action, entity_id, payload,
// previous_hash) — enabling tamper detection by recomputing the chain.
//
// Chain rules:
//   - sequence_number is monotonically increasing per tenant (UNIQUE constraint)
//   - entry_hash = SHA-256(JSON({ seq, action, entity_id, payload, prev }))
//   - previous_hash = entry_hash of (sequence_number - 1) for the same tenant
//   - First entry: previous_hash = null
//
// TypeScript strict — 0 errors
// =============================================================================

import { createHash, randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Public types ─────────────────────────────────────────────────────────────

export type AuditAction =
  | 'capital_transaction_initiated'
  | 'escrow_created'
  | 'escrow_funded'
  | 'escrow_released'
  | 'settlement_stage_advanced'
  | 'legal_document_signed'
  | 'kyc_status_changed'
  | 'aml_flag_added'
  | 'bid_placed'
  | 'bid_cancelled'
  | 'asset_ingested'
  | 'closing_price_recorded'
  | 'compliance_check_performed'

export interface AuditLogEntry {
  id: string
  tenant_id: string
  sequence_number: number         // monotonically increasing per tenant
  action: AuditAction
  actor_id: string                // user_id or 'system'
  entity_type: string
  entity_id: string
  payload: Record<string, unknown>
  previous_hash: string | null    // SHA-256 of previous entry's hash
  entry_hash: string              // SHA-256(seq + action + entity_id + payload + prev)
  correlation_id: string | null
  created_at: string
}

// ─── Hash computation ─────────────────────────────────────────────────────────

function computeEntryHash(
  sequence_number: number,
  action: AuditAction,
  entity_id: string,
  payload: Record<string, unknown>,
  previous_hash: string | null,
): string {
  return createHash('sha256')
    .update(JSON.stringify({
      seq:       sequence_number,
      action,
      entity_id,
      payload,
      prev:      previous_hash,
    }))
    .digest('hex')
}

// ─── Sequence number ──────────────────────────────────────────────────────────

async function getNextSequenceNumber(tenantId: string): Promise<{ seq: number; prevHash: string | null }> {
  const { data, error } = await (supabaseAdmin as any)
    .from('audit_log_entries')
    .select('sequence_number, entry_hash')
    .eq('tenant_id', tenantId)
    .order('sequence_number', { ascending: false })
    .limit(1) as {
      data: Array<{ sequence_number: number; entry_hash: string }> | null
      error: { message: string } | null
    }

  if (error) {
    log.warn('[immutableAuditLog] getNextSequenceNumber failed', {
      tenant_id: tenantId,
      error:     error.message,
    })
    return { seq: 1, prevHash: null }
  }

  if (!data || data.length === 0) {
    return { seq: 1, prevHash: null }
  }

  return {
    seq:      data[0].sequence_number + 1,
    prevHash: data[0].entry_hash,
  }
}

// ─── DB row → AuditLogEntry ───────────────────────────────────────────────────

function toEntry(row: Record<string, unknown>): AuditLogEntry {
  return {
    id:              String(row['id'] ?? ''),
    tenant_id:       String(row['tenant_id'] ?? ''),
    sequence_number: Number(row['sequence_number'] ?? 0),
    action:          (row['action'] as AuditAction),
    actor_id:        String(row['actor_id'] ?? 'system'),
    entity_type:     String(row['entity_type'] ?? ''),
    entity_id:       String(row['entity_id'] ?? ''),
    payload:         (row['payload'] as Record<string, unknown>) ?? {},
    previous_hash:   row['previous_hash'] != null ? String(row['previous_hash']) : null,
    entry_hash:      String(row['entry_hash'] ?? ''),
    correlation_id:  row['correlation_id'] != null ? String(row['correlation_id']) : null,
    created_at:      String(row['created_at'] ?? new Date().toISOString()),
  }
}

// ─── writeAuditLog ────────────────────────────────────────────────────────────

/**
 * Appends an immutable, hash-chained entry to the audit log.
 * This is append-only — never updates or deletes existing entries.
 * Returns the persisted AuditLogEntry with computed hashes.
 */
export async function writeAuditLog(
  tenantId: string,
  action: AuditAction,
  actorId: string,
  entityType: string,
  entityId: string,
  payload: Record<string, unknown>,
  correlationId?: string,
): Promise<AuditLogEntry> {
  const id = randomUUID()
  const { seq, prevHash } = await getNextSequenceNumber(tenantId)
  const entry_hash = computeEntryHash(seq, action, entityId, payload, prevHash)
  const now = new Date().toISOString()

  const row = {
    id,
    tenant_id:       tenantId,
    sequence_number: seq,
    action,
    actor_id:        actorId,
    entity_type:     entityType,
    entity_id:       entityId,
    payload,
    previous_hash:   prevHash,
    entry_hash,
    correlation_id:  correlationId ?? null,
    created_at:      now,
  }

  const { data, error } = await (supabaseAdmin as any)
    .from('audit_log_entries')
    .insert(row)
    .select('*')
    .single() as { data: Record<string, unknown> | null; error: { message: string } | null }

  if (error || !data) {
    const msg = error?.message ?? 'insert returned no data'
    log.warn('[immutableAuditLog] writeAuditLog failed', {
      tenant_id: tenantId,
      action,
      entity_id: entityId,
      error:     msg,
    })
    throw new Error(`[immutableAuditLog] writeAuditLog: ${msg}`)
  }

  return toEntry(data)
}

// ─── queryAuditLog ────────────────────────────────────────────────────────────

/**
 * Queries audit log entries for a tenant with optional filters.
 * Returns entries sorted by sequence_number DESC (newest first).
 */
export async function queryAuditLog(
  tenantId: string,
  opts?: {
    action?: AuditAction
    entity_id?: string
    actor_id?: string
    from?: string
    to?: string
    limit?: number
  },
): Promise<AuditLogEntry[]> {
  try {
    const limit = Math.min(opts?.limit ?? 100, 1000)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabaseAdmin as any)
      .from('audit_log_entries')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('sequence_number', { ascending: false })
      .limit(limit)

    if (opts?.action)    query = query.eq('action', opts.action)
    if (opts?.entity_id) query = query.eq('entity_id', opts.entity_id)
    if (opts?.actor_id)  query = query.eq('actor_id', opts.actor_id)
    if (opts?.from)      query = query.gte('created_at', opts.from)
    if (opts?.to)        query = query.lte('created_at', opts.to)

    const { data, error } = await query as {
      data:  Array<Record<string, unknown>> | null
      error: { message: string } | null
    }

    if (error) {
      log.warn('[immutableAuditLog] queryAuditLog failed', {
        tenant_id: tenantId,
        error:     error.message,
      })
      return []
    }

    return (data ?? []).map(toEntry)
  } catch (err) {
    log.warn('[immutableAuditLog] queryAuditLog error', {
      tenant_id: tenantId,
      error:     err instanceof Error ? err.message : String(err),
    })
    return []
  }
}

// ─── verifyChainIntegrity ─────────────────────────────────────────────────────

/**
 * Verifies the SHA-256 chain integrity for a tenant's audit log.
 * Reads entries in ascending sequence order and recomputes each hash,
 * comparing against the stored entry_hash.
 *
 * Returns:
 *   - valid: true if all hashes match
 *   - checked_entries: number of entries checked
 *   - first_broken_sequence: sequence_number of the first broken link, or null
 */
export async function verifyChainIntegrity(
  tenantId: string,
  limit: number = 1000,
): Promise<{
  valid: boolean
  checked_entries: number
  first_broken_sequence: number | null
}> {
  try {
    const cap = Math.min(limit, 10_000)

    const { data, error } = await (supabaseAdmin as any)
      .from('audit_log_entries')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('sequence_number', { ascending: true })
      .limit(cap) as {
        data: Array<Record<string, unknown>> | null
        error: { message: string } | null
      }

    if (error) {
      log.warn('[immutableAuditLog] verifyChainIntegrity query failed', {
        tenant_id: tenantId,
        error:     error.message,
      })
      return { valid: false, checked_entries: 0, first_broken_sequence: null }
    }

    const entries = (data ?? []).map(toEntry)
    let checked = 0

    for (const entry of entries) {
      const expected = computeEntryHash(
        entry.sequence_number,
        entry.action,
        entry.entity_id,
        entry.payload,
        entry.previous_hash,
      )

      if (expected !== entry.entry_hash) {
        log.warn('[immutableAuditLog] chain integrity broken', {
          tenant_id:       tenantId,
          sequence_number: entry.sequence_number,
          expected,
          stored:          entry.entry_hash,
        })
        return {
          valid:                  false,
          checked_entries:        checked + 1,
          first_broken_sequence:  entry.sequence_number,
        }
      }

      checked++
    }

    return { valid: true, checked_entries: checked, first_broken_sequence: null }
  } catch (err) {
    log.warn('[immutableAuditLog] verifyChainIntegrity error', {
      tenant_id: tenantId,
      error:     err instanceof Error ? err.message : String(err),
    })
    return { valid: false, checked_entries: 0, first_broken_sequence: null }
  }
}
