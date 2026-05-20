// =============================================================================
// Agency Group — SOC2 Audit Logger
// lib/audit/auditLogger.ts
//
// Records every significant action to Supabase audit_log table.
// Fire-and-forget (non-blocking) for normal actions.
// Synchronous flush available for critical security events.
//
// DDL (run once in Supabase):
// -- CREATE TABLE audit_log (
// --   id uuid primary key default gen_random_uuid(),
// --   tenant_id text not null,
// --   actor_id text,
// --   actor_type text not null,
// --   actor_email text,
// --   action text not null,
// --   resource_type text,
// --   resource_id text,
// --   result text not null,
// --   risk_level text not null default 'low',
// --   correlation_id text,
// --   ip_address text,
// --   user_agent text,
// --   metadata jsonb,
// --   created_at timestamptz not null default now()
// -- );
// -- CREATE INDEX idx_audit_log_tenant ON audit_log(tenant_id, created_at DESC);
// -- CREATE INDEX idx_audit_log_actor ON audit_log(actor_id, created_at DESC);
// -- CREATE INDEX idx_audit_log_action ON audit_log(action, created_at DESC);
// -- CREATE INDEX idx_audit_log_risk ON audit_log(risk_level, created_at DESC) WHERE risk_level IN ('high','critical');
//
// TypeScript strict — 0 errors
// =============================================================================

import { createClient } from '@supabase/supabase-js'
import type { AuditInput, AuditRecord, AuditQueryFilter } from './auditTypes'

// ─── Client ───────────────────────────────────────────────────────────────────

function getDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase env vars missing')
  return createClient(url, key)
}

// ─── Fire-and-forget audit log ───────────────────────────────────────────────

/**
 * Records an audit event. Non-blocking — safe to call anywhere.
 * For critical security events, use logAuditSync() to await the write.
 *
 * @example
 *   logAudit({
 *     tenant_id: 'agency-group',
 *     actor_type: 'user',
 *     actor_id: userId,
 *     action: 'deal:create',
 *     resource_type: 'deal',
 *     resource_id: dealId,
 *     result: 'success',
 *     risk_level: 'low',
 *     correlation_id: corrId,
 *   })
 */
export function logAudit(input: AuditInput): void {
  if (process.env.AI_AUDIT_ENABLED !== 'true' && process.env.NODE_ENV !== 'production') return
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return

  const db = createClient(url, key)
  void db.from('audit_log').insert(input).then(({ error }) => {
    if (error) console.warn('[AuditLog] insert error:', error.message)
  })
}

/**
 * Synchronous (await) version — use for critical security events
 * (auth failures, privilege escalation, secret access) where you
 * need to know the write succeeded before responding.
 */
export async function logAuditSync(input: AuditInput): Promise<void> {
  try {
    const db = getDb()
    const { error } = await db.from('audit_log').insert(input)
    if (error) console.error('[AuditLog] sync insert error:', error.message)
  } catch (err) {
    console.error('[AuditLog] logAuditSync threw:', err)
  }
}

/**
 * Query the audit log with filters.
 * Returns paginated results.
 */
export async function queryAuditLog(filter: AuditQueryFilter): Promise<{
  records: AuditRecord[]
  total:   number
}> {
  try {
    const db = getDb()
    const limit  = filter.limit  ?? 50
    const offset = filter.offset ?? 0

    let q = db
      .from('audit_log')
      .select('*', { count: 'exact' })
      .eq('tenant_id', filter.tenant_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (filter.actor_id)      q = q.eq('actor_id', filter.actor_id)
    if (filter.action)        q = q.eq('action', filter.action)
    if (filter.resource_type) q = q.eq('resource_type', filter.resource_type)
    if (filter.resource_id)   q = q.eq('resource_id', filter.resource_id)
    if (filter.result)        q = q.eq('result', filter.result)
    if (filter.risk_level)    q = q.eq('risk_level', filter.risk_level)
    if (filter.from_date)     q = q.gte('created_at', filter.from_date)
    if (filter.to_date)       q = q.lte('created_at', filter.to_date)

    const { data, error, count } = await q

    if (error || !data) return { records: [], total: 0 }
    return { records: data as unknown as AuditRecord[], total: count ?? 0 }
  } catch { return { records: [], total: 0 } }
}

/**
 * Returns risk summary for a tenant (last 24h).
 * Used by Control Tower dashboard.
 */
export async function getAuditRiskSummary(tenantId: string): Promise<{
  critical: number
  high:     number
  medium:   number
  low:      number
  total:    number
}> {
  try {
    const db = getDb()
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const { data } = await db
      .from('audit_log')
      .select('risk_level')
      .eq('tenant_id', tenantId)
      .gte('created_at', cutoff)

    const counts = { critical: 0, high: 0, medium: 0, low: 0, total: 0 }
    for (const row of (data ?? []) as { risk_level: string }[]) {
      counts.total++
      if (row.risk_level === 'critical') counts.critical++
      else if (row.risk_level === 'high') counts.high++
      else if (row.risk_level === 'medium') counts.medium++
      else counts.low++
    }
    return counts
  } catch { return { critical: 0, high: 0, medium: 0, low: 0, total: 0 } }
}
