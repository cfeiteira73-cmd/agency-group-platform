// =============================================================================
// Agency Group — Audit Log Helper
// lib/auditLog.ts
//
// Server-side audit logging for GDPR compliance, security reviews,
// and revenue dispute resolution.
//
// Design:
//   - Fire-and-forget (non-blocking) — never fails a request
//   - Records actor context (email, auth method, correlation_id)
//   - Integrated with the audit_log table (migration 20260430_004)
//   - Automatic tenant_id stamping
//
// Usage:
//   import { auditLog } from '@/lib/auditLog'
//   await auditLog.write({
//     table: 'deals', operation: 'UPDATE', recordId: deal.id,
//     actorEmail: auth.email, actorVia: auth.via,
//     oldData: before, newData: after, correlationId,
//   })
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import { DEFAULT_TENANT_ID } from '@/lib/tenant'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AuditOperation = 'INSERT' | 'UPDATE' | 'DELETE' | 'SELECT_SENSITIVE'

export interface AuditEntry {
  table:           string
  operation:       AuditOperation
  recordId:        string
  actorEmail?:     string | null
  actorVia?:       string | null
  tenantId?:       string | null
  correlationId?:  string | null
  sessionId?:      string | null
  ipAddress?:      string | null
  userAgent?:      string | null
  oldData?:        Record<string, unknown> | null
  newData?:        Record<string, unknown> | null
  changedColumns?: string[]
}

// ---------------------------------------------------------------------------
// Internal writer — never throws
// ---------------------------------------------------------------------------

async function writeAuditEntry(entry: AuditEntry): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin as any)
      .from('audit_log')
      .insert({
        table_name:      entry.table,
        operation:       entry.operation,
        record_id:       entry.recordId,
        actor_email:     entry.actorEmail ?? null,
        actor_via:       entry.actorVia ?? null,
        tenant_id:       entry.tenantId ?? DEFAULT_TENANT_ID,
        correlation_id:  entry.correlationId ? toUUID(entry.correlationId) : null,
        session_id:      entry.sessionId    ? toUUID(entry.sessionId)    : null,
        ip_address:      redactIp(entry.ipAddress),
        user_agent:      entry.userAgent ? entry.userAgent.slice(0, 200) : null,
        old_data:        entry.oldData  ?? null,
        new_data:        entry.newData  ?? null,
        changed_columns: entry.changedColumns ?? null,
      })
  } catch (err) {
    // Never propagate — audit failure must not break the request
    console.warn('[auditLog] write failed (non-fatal):', err instanceof Error ? err.message : String(err))
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function redactIp(ip: string | null | undefined): string | null {
  if (!ip) return null
  // Redact last octet of IPv4 for GDPR minimization
  const parts = ip.split('.')
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`
  return ip.slice(0, 20)  // IPv6: truncate
}

function toUUID(val: string | null | undefined): string | null {
  if (!val) return null
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidPattern.test(val) ? val : null
}

function computeChangedColumns(
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>
): string[] {
  const changed: string[] = []
  const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)])
  for (const key of allKeys) {
    if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
      changed.push(key)
    }
  }
  return changed
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const auditLog = {
  /**
   * Record any data mutation. Non-blocking.
   */
  write(entry: AuditEntry): void {
    // Fire-and-forget — intentionally void
    void writeAuditEntry(entry)
  },

  /**
   * Log a deal mutation (INSERT or UPDATE).
   */
  deal(opts: {
    operation:    AuditOperation
    dealId:       string
    actorEmail?:  string | null
    actorVia?:    string | null
    tenantId?:    string | null
    correlationId?: string | null
    before?:      Record<string, unknown>
    after?:       Record<string, unknown>
  }): void {
    const changedColumns = opts.before && opts.after
      ? computeChangedColumns(opts.before, opts.after)
      : undefined

    void writeAuditEntry({
      table:          'deals',
      operation:      opts.operation,
      recordId:       opts.dealId,
      actorEmail:     opts.actorEmail,
      actorVia:       opts.actorVia,
      tenantId:       opts.tenantId,
      correlationId:  opts.correlationId,
      oldData:        opts.before   ?? null,
      newData:        opts.after    ?? null,
      changedColumns,
    })
  },

  /**
   * Log a contact mutation.
   */
  contact(opts: {
    operation:    AuditOperation
    contactId:    string
    actorEmail?:  string | null
    actorVia?:    string | null
    tenantId?:    string | null
    correlationId?: string | null
    before?:      Record<string, unknown>
    after?:       Record<string, unknown>
  }): void {
    const changedColumns = opts.before && opts.after
      ? computeChangedColumns(opts.before, opts.after)
      : undefined

    void writeAuditEntry({
      table:          'contacts',
      operation:      opts.operation,
      recordId:       opts.contactId,
      actorEmail:     opts.actorEmail,
      actorVia:       opts.actorVia,
      tenantId:       opts.tenantId,
      correlationId:  opts.correlationId,
      oldData:        opts.before   ?? null,
      newData:        opts.after    ?? null,
      changedColumns,
    })
  },

  /**
   * Log a deal pack event (sent, viewed, generated).
   */
  dealPack(opts: {
    operation:    AuditOperation
    packId:       string
    actorEmail?:  string | null
    actorVia?:    string | null
    tenantId?:    string | null
    correlationId?: string | null
    before?:      Record<string, unknown>
    after?:       Record<string, unknown>
  }): void {
    void writeAuditEntry({
      table:          'deal_packs',
      operation:      opts.operation,
      recordId:       opts.packId,
      actorEmail:     opts.actorEmail,
      actorVia:       opts.actorVia,
      tenantId:       opts.tenantId,
      correlationId:  opts.correlationId,
      oldData:        opts.before  ?? null,
      newData:        opts.after   ?? null,
    })
  },

  /**
   * Log sensitive data access (e.g. export, bulk fetch).
   */
  sensitiveAccess(opts: {
    table:        string
    recordId:     string
    actorEmail?:  string | null
    correlationId?: string | null
    note?:        string
  }): void {
    void writeAuditEntry({
      table:         opts.table,
      operation:     'SELECT_SENSITIVE',
      recordId:      opts.recordId,
      actorEmail:    opts.actorEmail,
      correlationId: opts.correlationId,
      newData:       opts.note ? { note: opts.note } : null,
    })
  },
}

export default auditLog
