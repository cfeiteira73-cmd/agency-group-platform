// =============================================================================
// Agency Group — AI Decision Audit Logger
// lib/observability/ai-audit.ts
//
// Fire-and-forget audit logging for every AI call routed through withAI /
// withAIStream. Writes to the `ai_audit_log` Supabase table using the admin
// client (bypasses RLS — server-only, never imported in client components).
//
// DESIGN:
//   - Non-blocking: logAIDecision() never awaits the insert, never throws
//   - Feature-flagged: only active when AI_AUDIT_ENABLED=true
//   - Silent on failure: console.warn only — never crashes the caller
//
// SCHEMA (create once in Supabase dashboard or migration):
//   create table ai_audit_log (
//     id              uuid primary key default gen_random_uuid(),
//     correlation_id  text        not null,
//     model           text        not null,
//     circuit_name    text        not null,
//     input_tokens    int,
//     output_tokens   int,
//     latency_ms      int         not null,
//     success         boolean     not null,
//     fallback_used   boolean     not null,
//     error_type      text,
//     revenue_context text,
//     created_at      timestamptz not null default now()
//   );
//
// TypeScript strict — 0 errors
// =============================================================================

import { createClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface AIAuditEntry {
  correlation_id: string
  model: string
  /** Circuit breaker key — e.g. 'anthropic-opus', 'anthropic-haiku', 'anthropic' */
  circuit_name: string
  input_tokens?: number
  output_tokens?: number
  latency_ms: number
  success: boolean
  fallback_used: boolean
  /** Reason for non-success: 'circuit_open' | 'rate_limit' | 'timeout' | 'error' */
  error_type?: string
  /** Optional business tag — e.g. 'deal_pack' | 'sofia_chat' | 'whatsapp' */
  revenue_context?: string
  /** ISO-8601 UTC timestamp — callers should pass new Date().toISOString() */
  created_at: string
}

// ---------------------------------------------------------------------------
// logAIDecision
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Untyped admin client — used only in this module so the insert can target
// `ai_audit_log` without requiring it in the generated Database types.
// The table must exist in Supabase (see schema comment above).
// ---------------------------------------------------------------------------

function getAuditClient() {
  const url     = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key     = process.env.SUPABASE_SERVICE_ROLE_KEY
              ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createClient<any>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/**
 * Fire-and-forget insert into `ai_audit_log`.
 *
 * Also writes a corresponding row into `audit_log` using the security-event
 * columns (action, actor_id, actor_type, resource_type, result, metadata) so
 * that the AI Decision Timeline page and unifiedTimeline.ts can surface AI
 * calls without querying the separate ai_audit_log table.
 *
 * - Returns immediately; both Supabase inserts run in the background.
 * - Never throws; logs a console.warn on failure.
 * - Skipped entirely unless `AI_AUDIT_ENABLED=true`.
 */
export function logAIDecision(entry: AIAuditEntry): void {
  // Guard: only log when explicitly enabled
  if (process.env.AI_AUDIT_ENABLED !== 'true') return

  const client = getAuditClient()
  if (!client) {
    console.warn('[ai-audit] Supabase not configured — skipping audit log')
    return
  }

  // ── 1. Write to dedicated ai_audit_log ──────────────────────────────────────
  // Fire-and-forget — no await, callers are not blocked
  void client
    .from('ai_audit_log')
    .insert({
      correlation_id:  entry.correlation_id,
      model:           entry.model,
      circuit_name:    entry.circuit_name,
      input_tokens:    entry.input_tokens ?? null,
      output_tokens:   entry.output_tokens ?? null,
      latency_ms:      entry.latency_ms,
      success:         entry.success,
      fallback_used:   entry.fallback_used,
      error_type:      entry.error_type ?? null,
      revenue_context: entry.revenue_context ?? null,
      created_at:      entry.created_at,
    })
    .then(({ error }: { error: { message: string } | null }) => {
      if (error) {
        console.warn('[ai-audit] ai_audit_log insert failed:', error.message)
      }
    })

  // ── 2. Mirror into audit_log for timeline visibility ─────────────────────────
  // Derives action from success + error_type so the AI timeline page query
  // (.in('action', ['ai:execute', 'ai:deny', 'ai:escalate'])) finds these rows.
  const action =
    !entry.success && entry.error_type === 'circuit_open' ? 'ai:deny'     :
    !entry.success && entry.fallback_used                  ? 'ai:escalate' :
    entry.success                                          ? 'ai:execute'  :
                                                             'ai:escalate'

  // audit_log requires table_name + operation + record_id (NOT NULL in DDL).
  // We supply sentinel values that are clearly machine-generated.
  void client
    .from('audit_log')
    .insert({
      table_name:           'ai_audit_log',
      operation:            'INSERT',
      record_id:            entry.correlation_id,
      // Security-event columns (added by migration 20260521000001)
      action,
      actor_id:             entry.model,
      actor_type:           'ai_agent',
      resource_type:        'ai_call',
      resource_id:          entry.circuit_name,
      result:               entry.success ? 'success' : (entry.error_type ?? 'error'),
      correlation_id_text:  entry.correlation_id,
      metadata: {
        model:           entry.model,
        circuit_name:    entry.circuit_name,
        latency_ms:      entry.latency_ms,
        tokens:          (entry.input_tokens ?? 0) + (entry.output_tokens ?? 0),
        input_tokens:    entry.input_tokens  ?? null,
        output_tokens:   entry.output_tokens ?? null,
        fallback_used:   entry.fallback_used,
        error_type:      entry.error_type   ?? null,
        revenue_context: entry.revenue_context ?? null,
        // ai-timeline page reads these keys from metadata
        agent:           entry.model,
        policy:          entry.error_type ?? 'allow',
        caller_route:    entry.revenue_context ?? null,
      },
      created_at: entry.created_at,
    })
    .then(({ error }: { error: { message: string } | null }) => {
      if (error) {
        console.warn('[ai-audit] audit_log mirror insert failed:', error.message)
      }
    })
}
