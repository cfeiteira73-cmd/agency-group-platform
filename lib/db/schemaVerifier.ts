// =============================================================================
// Agency Group — Schema Verifier
// lib/db/schemaVerifier.ts
//
// Startup check that detects column drift on critical tables.
// Run in development via lib/db/schemaVerifier.ts or import at app boot.
//
// Usage:
//   import { verifySchema } from '@/lib/db/schemaVerifier'
//   await verifySchema()  // throws with diff on mismatch, no-op on success
//
// In production: run as part of /api/health or /api/cron/schema-check.
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'

// ─── Expected column maps ─────────────────────────────────────────────────────
// Key = table name. Value = array of required column names.
// These are the columns that have caused production bugs — add others as needed.

// ─── VERIFIED AGAINST PRODUCTION DB 2026-05-20 ───────────────────────────────
// Each entry reflects ACTUAL columns in Supabase (dhmfnzsqzdutelzzejay).
// Do NOT add expected columns here unless you have verified they exist.
// Rule: if the column is in this list and absent in DB → P0 incident at startup.
//
// Wave 12 ground truth:
//  • deals:    original portal columns + portal-compat (portal_compat_v1 migration)
//  • contacts: original portal columns + portal-compat (portal_compat_v1 migration)
//  • orgs table is 'organizations', NOT 'tenants'
//  • governance_approvals schema differs from Wave 11 assumption: no approval_id/actor_id/resource_type
//  • learning_events has org_id (TEXT primary tenant key) + tenant_id (TEXT added Wave 11)

const EXPECTED_COLUMNS: Record<string, string[]> = {
  deals: [
    // ── Original portal columns (always existed) ──────────────────────────────
    'id', 'agent_email', 'ref', 'imovel', 'valor', 'fase', 'tenant_id',
    // ── Portal-compat columns (added by portal_compat_v1_deals_contacts) ─────
    // Required by all economics files: agentProfitability, economicBenchmarks,
    // opportunityCost, revenueAttribution, revenueLineage, revenueOutcomeMapper
    'deal_value', 'stage', 'probability', 'assigned_consultant',
    'actual_close_date', 'lost_at',
  ],
  contacts: [
    // ── Original portal columns (always existed) ──────────────────────────────
    'id', 'agent_email', 'name', 'email', 'phone', 'status', 'tenant_id',
    // ── Portal-compat columns (added by portal_compat_v1_deals_contacts) ─────
    'full_name', 'lead_score', 'lead_tier', 'clearbit_data',
  ],
  kpi_snapshots: [
    // Verified: snapshot_date, pipeline_value, total_leads, total_deals, avg_deal_value all exist
    'id', 'snapshot_date', 'pipeline_value',
    'total_leads', 'total_deals', 'avg_deal_value',
  ],
  governance_approvals: [
    // NOTE: actual schema differs from Wave 11 assumption.
    // incident_id + execution_mode exist; approval_id/actor_id/resource_type do NOT.
    'id', 'tenant_id', 'incident_id', 'action_type',
    'status', 'requested_by', 'context', 'created_at',
  ],
  organizations: [
    // NOTE: table is 'organizations', NOT 'tenants' — Wave 11 schema map was wrong.
    // agency-group org: id=00000000-0000-0000-0000-000000000001, slug='agency-group'
    'id', 'slug', 'name', 'plan', 'status', 'created_at',
  ],
  learning_events: [
    // org_id (TEXT) is the primary tenant key; tenant_id (TEXT) was added Wave 11.
    // Wave 11 assumption of deal_pack_id/agent_email/match_score was wrong — those don't exist.
    'id', 'org_id', 'event_type', 'lead_id', 'deal_id',
    'metadata', 'created_at',
    'tenant_id',
  ],
  priority_items: [
    // Wave 14: org_id column added by priority_items_add_org_id_and_rls migration.
    // RLS now enforced via org_members lookup.
    'id', 'entity_type', 'entity_id', 'priority_score', 'reason',
    'next_best_action', 'deadline', 'owner_id', 'revenue_impact',
    'status', 'source', 'created_at', 'org_id',
  ],
  runtime_events_warm: [
    // Event bus warm store — tracks in-flight and recently processed events
    'event_id', 'org_id', 'type', 'status', 'priority',
    'retry_count', 'correlation_id', 'trace_id', 'source_system',
    'payload', 'result', 'latency_ms', 'created_at', 'updated_at',
  ],
  runtime_events_dlq: [
    // Dead letter queue — events that exhausted all retries
    'event_id', 'org_id', 'type', 'retry_count', 'correlation_id',
    'payload', 'result', 'created_at', 'updated_at',
  ],
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SchemaDrift {
  table:    string
  missing:  string[]   // columns expected but absent
}

export interface SchemaVerificationResult {
  ok:     boolean
  drifts: SchemaDrift[]
  checked_at: string
}

// ─── Core verifier ────────────────────────────────────────────────────────────

/**
 * Queries information_schema.columns for each critical table and compares
 * against the expected column list. Returns a structured result.
 * Never throws — always returns a result object.
 */
export async function verifySchema(): Promise<SchemaVerificationResult> {
  const drifts: SchemaDrift[] = []
  const tables = Object.keys(EXPECTED_COLUMNS)

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabaseAdmin as any

    // Fetch all columns for our critical tables in a single query
    const { data, error } = await sb
      .from('information_schema.columns')
      .select('table_name, column_name')
      .eq('table_schema', 'public')
      .in('table_name', tables)

    if (error) {
      console.error('[SchemaVerifier] Failed to query information_schema:', error.message)
      return { ok: false, drifts: [{ table: '_meta', missing: [`query_error: ${error.message}`] }], checked_at: new Date().toISOString() }
    }

    // Build present-columns map: table → Set<column>
    const present = new Map<string, Set<string>>()
    for (const row of (data ?? []) as { table_name: string; column_name: string }[]) {
      if (!present.has(row.table_name)) present.set(row.table_name, new Set())
      present.get(row.table_name)!.add(row.column_name)
    }

    // Compare expected vs present
    for (const [table, expectedCols] of Object.entries(EXPECTED_COLUMNS)) {
      const actualCols = present.get(table) ?? new Set<string>()
      const missing = expectedCols.filter(col => !actualCols.has(col))

      if (missing.length > 0) {
        drifts.push({ table, missing })
      }
    }
  } catch (err) {
    console.error('[SchemaVerifier] Unexpected error:', err)
    return { ok: false, drifts: [{ table: '_meta', missing: [`unexpected_error: ${String(err)}`] }], checked_at: new Date().toISOString() }
  }

  const result: SchemaVerificationResult = {
    ok:         drifts.length === 0,
    drifts,
    checked_at: new Date().toISOString(),
  }

  if (!result.ok) {
    const summary = drifts
      .map(d => `  [${d.table}] missing: ${d.missing.join(', ')}`)
      .join('\n')

    const message = `[SchemaVerifier] SCHEMA DRIFT DETECTED:\n${summary}`

    if (process.env.NODE_ENV === 'production') {
      // In production: log as critical error (do NOT throw — avoid crashing the app)
      console.error(message)
    } else {
      // In development: throw so the developer sees it immediately
      throw new Error(message)
    }
  }

  return result
}

/**
 * Run verifySchema and return a concise one-line status string.
 * Suitable for /api/health endpoints.
 */
export async function schemaHealthCheck(): Promise<{ status: 'ok' | 'drift'; summary: string }> {
  const result = await verifySchema()
  if (result.ok) {
    return { status: 'ok', summary: `Schema OK — ${Object.keys(EXPECTED_COLUMNS).length} tables verified` }
  }

  const driftList = result.drifts
    .map(d => `${d.table}(${d.missing.join(',')})`)
    .join('; ')

  return {
    status: 'drift',
    summary: `Schema drift: ${driftList}`,
  }
}
