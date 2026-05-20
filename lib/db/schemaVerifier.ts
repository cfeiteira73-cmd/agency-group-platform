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

const EXPECTED_COLUMNS: Record<string, string[]> = {
  deals: [
    'id', 'title', 'deal_value', 'stage', 'probability',
    'contact_id', 'property_id', 'assigned_consultant',
    'actual_close_date', 'lost_at',
    // Portal-compat columns (added by 003_portal_compat.sql)
    'valor', 'fase', 'tenant_id',
  ],
  contacts: [
    'id', 'full_name', 'email', 'phone',
    'status', 'lead_score', 'lead_tier',
    // Multi-tenant column (added by 20260430_002)
    'tenant_id',
  ],
  kpi_snapshots: [
    'id', 'snapshot_date', 'pipeline_value',  // NOT pipeline_value_eur
    'total_leads', 'total_deals', 'avg_deal_value',
  ],
  governance_approvals: [
    'id',
    // approvalFlow.ts columns (added by 20260520000005)
    'approval_id', 'tenant_id', 'actor_id', 'action_type',
    'resource_type', 'risk_level', 'description', 'context',
    'status', 'requested_at', 'expires_at',
  ],
  tenants: [
    'id', 'slug', 'name', 'plan', 'org_id', 'created_at',
  ],
  learning_events: [
    'id', 'event_type', 'lead_id', 'deal_id', 'property_id',
    'deal_pack_id', 'agent_email', 'match_score', 'metadata', 'created_at',
    // Multi-tenant column (added via migration 20260521_add_tenant_id_learning_events)
    'tenant_id',
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
