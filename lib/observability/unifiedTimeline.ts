// =============================================================================
// Agency Group — Unified Timeline
// lib/observability/unifiedTimeline.ts
//
// Merges audit_log + runtime_events + causal_trace into a single chronological
// feed. Read-only from existing tables.
//
// Schema alignment (audit_log):
//   Original diff-log columns:  table_name, operation, record_id,
//                                actor_email, correlation_id (UUID),
//                                old_data, new_data, changed_columns
//   Added by migration 20260521000001:
//                                action, actor_id, actor_type,
//                                resource_type, resource_id,
//                                result, risk_level, metadata,
//                                correlation_id_text
//
// The SELECT uses the union of both sets; mappers are tolerant of NULLs so
// rows written by the old diff-log triggers still appear correctly.
//
// causal_trace source is gated on CAUSAL_TRACE_ENABLED=true.
//
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'

// Bypass stale generated types for tables that have been altered since the
// last `supabase gen types` run.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const auditLogTable   = () => (supabaseAdmin as any).from('audit_log')
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const causalTraceTable = () => (supabaseAdmin as any).from('causal_trace')

// ─── Public types ─────────────────────────────────────────────────────────────

export interface TimelineEntry {
  id:             string
  source:         'audit' | 'event' | 'causal'
  timestamp:      string                  // ISO-8601
  tenant_id:      string
  correlation_id: string | null
  event_type:     string                  // derived label — see mappers below
  actor?:         string                  // best available actor identifier
  status?:        string                  // result / success flag
  summary:        string                  // human-readable one-liner
  raw:            Record<string, unknown>
}

export interface UnifiedTimelineRequest {
  tenant_id:       string
  correlation_id?: string
  time_range?:     { from: string; to: string }  // ISO strings
  limit?:          number                         // default 50, max 500
  sources?:        Array<'audit' | 'event' | 'causal'>  // default all
}

// ─── Internal DB row shapes ───────────────────────────────────────────────────

// Covers both old diff-log rows AND new security-event rows. All new columns
// are optional so pre-migration rows deserialise without errors.
interface AuditRow {
  id:                   string
  tenant_id:            string | null
  // Security-event columns (added by migration 20260521000001)
  action?:              string | null
  actor_id?:            string | null
  actor_type?:          string | null
  resource_type?:       string | null
  resource_id?:         string | null
  result?:              string | null
  risk_level?:          string | null
  metadata?:            Record<string, unknown> | null
  correlation_id_text?: string | null
  // Original diff-log columns (always present)
  table_name?:          string | null
  operation?:           string | null
  record_id?:           string | null
  actor_email?:         string | null
  correlation_id?:      string | null   // UUID stored as text in JSON response
  created_at:           string
  [key: string]:        unknown
}

interface RuntimeEventRow {
  event_id:          string
  org_id:            string
  type:              string
  status:            string
  retry_count:       number
  payload?:          unknown
  result?:           unknown
  agents_triggered?: string[] | null
  agents_failed?:    string[] | null
  correlation_id?:   string | null
  event_timestamp:   string
  created_at:        string
}

interface CausalTraceRow {
  id:             string
  correlation_id: string | null
  tenant_id:      string
  step_type?:     string | null
  entity_type?:   string | null
  entity_id?:     string | null
  agent_id?:      string | null
  action?:        string | null
  revenue_delta?: number | null
  latency_ms?:    number | null
  success?:       boolean | null
  error_message?: string | null
  created_at:     string
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function mapAuditRow(row: AuditRow, tenantId: string): TimelineEntry {
  // Derive event_type: prefer the new `action` column, fall back to
  // "operation:table_name" from the original diff-log columns.
  const eventType =
    row.action
    ?? (row.operation && row.table_name ? `${row.operation}:${row.table_name}` : null)
    ?? row.operation
    ?? row.table_name
    ?? 'audit:unknown'

  // Best available actor: prefer actor_id (security events), fall back to
  // actor_email (diff-log trigger rows).
  const actor = row.actor_id ?? row.actor_email ?? undefined

  // Status: prefer result column (security events), fall back to operation.
  const status = row.result ?? row.operation ?? undefined

  // Correlation id: prefer the explicit TEXT alias added by migration, then
  // cast the UUID column (Supabase returns it as a string in JSON responses).
  const correlationId =
    row.correlation_id_text
    ?? (row.correlation_id ? String(row.correlation_id) : null)

  return {
    id:             row.id,
    source:         'audit',
    timestamp:      row.created_at,
    tenant_id:      row.tenant_id ?? tenantId,
    correlation_id: correlationId,
    event_type:     eventType,
    actor,
    status,
    summary: `[audit] ${eventType}${status ? ` → ${status}` : ''}${actor ? ` by ${actor}` : ''}`,
    raw: row as unknown as Record<string, unknown>,
  }
}

function mapRuntimeEventRow(row: RuntimeEventRow, tenantId: string): TimelineEntry {
  const agents = row.agents_triggered
  const firstAgent = Array.isArray(agents) && agents.length > 0 ? agents[0] : undefined

  return {
    id:             row.event_id,
    source:         'event',
    timestamp:      row.event_timestamp ?? row.created_at,
    tenant_id:      tenantId,
    correlation_id: row.correlation_id ?? null,
    event_type:     row.type,
    actor:          firstAgent,
    status:         row.status,
    summary:        `[event] ${row.type} (${row.status})${firstAgent ? ` via ${firstAgent}` : ''}`,
    raw:            row as unknown as Record<string, unknown>,
  }
}

function mapCausalRow(row: CausalTraceRow, tenantId: string): TimelineEntry {
  const stepType  = row.step_type ?? 'step'
  const eventType = `causal:${stepType}`
  const status    = row.success === false ? 'failed' : 'completed'

  return {
    id:             row.id,
    source:         'causal',
    timestamp:      row.created_at,
    tenant_id:      row.tenant_id ?? tenantId,
    correlation_id: row.correlation_id ?? null,
    event_type:     eventType,
    actor:          row.agent_id ?? undefined,
    status,
    summary: `[causal] ${row.action ?? stepType}${row.entity_type ? ` on ${row.entity_type}` : ''}${row.revenue_delta != null ? ` (€${row.revenue_delta})` : ''}`,
    raw: row as unknown as Record<string, unknown>,
  }
}

// ─── Main function ─────────────────────────────────────────────────────────────

export async function getUnifiedTimeline(
  req: UnifiedTimelineRequest,
): Promise<TimelineEntry[]> {
  const {
    tenant_id,
    correlation_id,
    time_range,
    limit   = 50,
    sources = ['audit', 'event', 'causal'],
  } = req

  const effectiveLimit  = Math.min(Math.max(1, limit), 500)
  const includeAudit    = sources.includes('audit')
  const includeEvents   = sources.includes('event')
  const includeCausal   = sources.includes('causal')
                          && process.env.CAUSAL_TRACE_ENABLED === 'true'

  // ── audit_log ────────────────────────────────────────────────────────────────

  async function fetchAudit(): Promise<TimelineEntry[]> {
    if (!includeAudit) return []

    // Select both the original diff-log columns and the new security-event
    // columns added by migration 20260521000001.
    let q = auditLogTable()
      .select([
        'id',
        'tenant_id',
        'created_at',
        // Security-event columns (new)
        'action',
        'actor_id',
        'actor_type',
        'resource_type',
        'resource_id',
        'result',
        'risk_level',
        'metadata',
        'correlation_id_text',
        // Diff-log columns (original)
        'table_name',
        'operation',
        'record_id',
        'actor_email',
        'correlation_id',
      ].join(', '))
      .eq('tenant_id', tenant_id)
      .order('created_at', { ascending: false })
      .limit(effectiveLimit)

    if (correlation_id) {
      // Try to match either the UUID column or the new text alias
      q = q.or(`correlation_id.eq.${correlation_id},correlation_id_text.eq.${correlation_id}`)
    }
    if (time_range?.from) q = q.gte('created_at', time_range.from)
    if (time_range?.to)   q = q.lte('created_at', time_range.to)

    const { data, error } = await q
    if (error || !data) {
      console.warn('[UnifiedTimeline] audit_log query error:', error?.message)
      return []
    }

    return (data as AuditRow[]).map((row) => mapAuditRow(row, tenant_id))
  }

  // ── runtime_events ────────────────────────────────────────────────────────────

  async function fetchEvents(): Promise<TimelineEntry[]> {
    if (!includeEvents) return []

    let q = supabaseAdmin
      .from('runtime_events')
      .select('*')
      .eq('org_id', tenant_id)
      .order('event_timestamp', { ascending: false })
      .limit(effectiveLimit)

    if (correlation_id) q = q.eq('correlation_id', correlation_id)
    if (time_range?.from) q = q.gte('event_timestamp', time_range.from)
    if (time_range?.to)   q = q.lte('event_timestamp', time_range.to)

    const { data, error } = await q
    if (error || !data) {
      console.warn('[UnifiedTimeline] runtime_events query error:', error?.message)
      return []
    }

    return (data as RuntimeEventRow[]).map((row) => mapRuntimeEventRow(row, tenant_id))
  }

  // ── causal_trace ──────────────────────────────────────────────────────────────

  async function fetchCausal(): Promise<TimelineEntry[]> {
    if (!includeCausal) return []

    try {
      let q = causalTraceTable()
        .select([
          'id',
          'correlation_id',
          'tenant_id',
          'step_type',
          'entity_type',
          'entity_id',
          'agent_id',
          'action',
          'revenue_delta',
          'latency_ms',
          'success',
          'error_message',
          'created_at',
        ].join(', '))
        .eq('tenant_id', tenant_id)
        .order('created_at', { ascending: false })
        .limit(200)

      if (correlation_id) q = q.eq('correlation_id', correlation_id)
      if (time_range?.from) q = q.gte('created_at', time_range.from)
      if (time_range?.to)   q = q.lte('created_at', time_range.to)

      const { data, error } = await q
      if (error || !data) {
        console.warn('[UnifiedTimeline] causal_trace query error:', error?.message)
        return []
      }

      return (data as CausalTraceRow[]).map((row) => mapCausalRow(row, tenant_id))
    } catch (err) {
      console.warn('[UnifiedTimeline] causal_trace fetch failed:', err)
      return []
    }
  }

  // ── Run all queries concurrently, fail-open ───────────────────────────────────

  const [auditResult, eventsResult, causalResult] = await Promise.allSettled([
    fetchAudit(),
    fetchEvents(),
    fetchCausal(),
  ])

  const auditEntries  = auditResult.status  === 'fulfilled' ? auditResult.value  : []
  const eventsEntries = eventsResult.status === 'fulfilled' ? eventsResult.value : []
  const causalEntries = causalResult.status === 'fulfilled' ? causalResult.value : []

  if (auditResult.status  === 'rejected') console.warn('[UnifiedTimeline] audit fetch rejected:',  auditResult.reason)
  if (eventsResult.status === 'rejected') console.warn('[UnifiedTimeline] events fetch rejected:', eventsResult.reason)
  if (causalResult.status === 'rejected') console.warn('[UnifiedTimeline] causal fetch rejected:', causalResult.reason)

  // ── Merge, sort DESC, slice ───────────────────────────────────────────────────

  const normalizeTs = (ts: string | Date): number => new Date(ts).getTime()

  const merged = [...auditEntries, ...eventsEntries, ...causalEntries].sort(
    (a, b) => normalizeTs(b.timestamp) - normalizeTs(a.timestamp),
  )

  return merged.slice(0, effectiveLimit)
}
