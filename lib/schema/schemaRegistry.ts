// =============================================================================
// Agency Group — Schema Registry: Source of Truth Layer
// lib/schema/schemaRegistry.ts
//
// Principle: DB is truth. Types are derived. Never inverse.
//
// Queries information_schema.columns against a hardcoded expected manifest.
// Produces drift reports used by Control Tower and CI gates.
//
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'

// ─── Known Schema Manifest ────────────────────────────────────────────────────
// Derived from DDL comments in source files + orchestrator insert shapes.
// Update this when you add/rename columns (additive is fine, subtractive is drift).

const KNOWN_SCHEMA: Record<string, string[]> = {
  // DDL: lib/audit/auditLogger.ts (top-of-file comment)
  audit_log: [
    'id',
    'tenant_id',
    'actor_id',
    'actor_type',
    'actor_email',
    'action',
    'resource_type',
    'resource_id',
    'result',
    'risk_level',
    'correlation_id',
    'ip_address',
    'user_agent',
    'metadata',
    'created_at',
  ],

  // DDL: supabase/migrations/20260520000002_incidents_add_columns.sql
  governance_approvals: [
    'id',
    'tenant_id',
    'incident_id',
    'action_type',
    'execution_mode',
    'requested_by',
    'approved_by',
    'status',
    'context',
    'causal_confidence',
    'confidence',
    'created_at',
    'updated_at',
  ],

  // Shape from lib/runtime/orchestrator.ts _persistEvent() + dbFallbackProvider.ts enqueue()
  runtime_events: [
    'event_id',
    'org_id',
    'type',
    'status',
    'priority',
    'retry_count',
    'payload',
    'correlation_id',
    'trace_id',
    'source_system',
    'schema_version',
    'event_timestamp',
    'event_chain',
    'created_at',
    'updated_at',
  ],

  // DATABASE_SCHEMA_BACKUP.md §3 — contacts
  contacts: [
    'id',
    'full_name',
    'email',
    'phone',
    'whatsapp',
    'nationality',
    'language',
    'role',
    'status',
    'lead_tier',
    'lead_score',
    'lead_score_breakdown',
    'source',
    'source_detail',
    'referrer_id',
    'assigned_to',
    'budget_min',
    'budget_max',
    'preferred_locations',
    'typologies_wanted',
    'bedrooms_min',
    'bedrooms_max',
    'features_required',
    'use_type',
    'timeline',
    'financing_type',
    'property_to_sell_id',
    'asking_price',
    'motivation_score',
    'last_contact_at',
    'next_followup_at',
    'total_interactions',
    'opt_out_marketing',
    'opt_out_whatsapp',
    'gdpr_consent',
    'gdpr_consent_at',
    'enriched_at',
    'clearbit_data',
    'apollo_data',
    'linkedin_url',
    'company',
    'job_title',
    'qualified_at',
    'qualification_notes',
    'ai_summary',
    'ai_suggested_action',
    'detected_intent',
    'tags',
    'notes',
    'created_at',
    'updated_at',
  ],

  // DATABASE_SCHEMA_BACKUP.md §3 — deals
  deals: [
    'id',
    'title',
    'reference',
    'contact_id',
    'property_id',
    'assigned_consultant',
    'type',
    'stage',
    'probability',
    'deal_value',
    'commission_rate',
    'gci_net',
    'cpcv_date',
    'escritura_date',
    'expected_close_date',
    'actual_close_date',
    'cpcv_deposit',
    'cpcv_deposit_pct',
    'notario_id',
    'advogado_id',
    'initial_offer',
    'accepted_offer',
    'negotiation_notes',
    'lost_at',
    'lost_reason',
    'lost_to_agency',
    'nps_score',
    'nps_comment',
    'google_review_requested',
    'google_review_at',
    'ai_deal_memo',
    'ai_risk_factors',
    'source',
    'tags',
    'notes',
    'created_at',
    'updated_at',
  ],

  // DATABASE_SCHEMA_BACKUP.md §3 — properties
  properties: [
    'id',
    'title',
    'description',
    'description_en',
    'description_fr',
    'status',
    'type',
    'price',
    'price_previous',
    'price_reduced_at',
    'price_per_sqm',
    'address',
    'street',
    'city',
    'concelho',
    'distrito',
    'parish',
    'postcode',
    'country',
    'latitude',
    'longitude',
    'zone',
    'area_m2',
    'area_plot_m2',
    'area_terraco_m2',
    'bedrooms',
    'bathrooms',
    'parking_spaces',
    'floor',
    'total_floors',
    'year_built',
    'energy_certificate',
    'condition',
    'features',
    'orientation',
    'furnished',
    'is_exclusive',
    'mandate_signed_at',
    'mandate_expires_at',
    'owner_contact_id',
    'assigned_consultant',
    'idealista_id',
    'imovirtual_id',
    'casasapo_id',
    'olx_id',
    'avm_estimate',
    'avm_confidence',
    'avm_updated_at',
    'opportunity_score',
    'investor_suitable',
    'estimated_rental_yield',
    'estimated_cap_rate',
    'estimated_irr',
    'photos',
    'virtual_tour_url',
    'floor_plan_url',
    'embedding',
    'source',
    'is_off_market',
    'portal_published',
    'portal_published_at',
    'views_total',
    'inquiries_total',
    'visits_total',
    'created_at',
    'updated_at',
    'nome',
    'zona',
    'bairro',
    'tipo',
    'preco',
    'area',
    'quartos',
    'casas_banho',
    'gradient',
  ],

  // lib/agents/base.ts + lib/ops/operatorTasks.ts
  operator_tasks: [
    'id',
    'type',
    'title',
    'description',
    'org_id',
    'priority',
    'status',
    'assigned_to',
    'payload',
    'created_at',
    'updated_at',
  ],

  // DDL: lib/database.types.ts learning_events Row + migration 20260429_001
  learning_events: [
    'id',
    'event_type',
    'lead_id',
    'deal_id',
    'property_id',
    'match_id',
    'deal_pack_id',
    'agent_email',
    'match_score',
    'correlation_id',
    'session_id',
    'source_system',
    'metadata',
    'created_at',
  ],

  // lib/agents/base.ts + lib/observability/alertRouter.ts + lib/ops/alertEngine.ts
  system_alerts: [
    'id',
    'org_id',
    'alert_type',
    'severity',
    'message',
    'status',
    'payload',
    'resolved_at',
    'created_at',
  ],

  // lib/agents/base.ts + lib/ingestion/pipeline.ts + lib/ops/governance.ts
  automations_log: [
    'id',
    'org_id',
    'automation_type',
    'trigger',
    'status',
    'payload',
    'result',
    'duration_ms',
    'created_at',
  ],

  // lib/observability/causalTrace.ts + lib/graph/recursiveCTE.ts
  causal_trace: [
    'id',
    'org_id',
    'cause_event_id',
    'effect_event_id',
    'cause_type',
    'effect_type',
    'relationship',
    'confidence',
    'metadata',
    'created_at',
  ],

  // lib/queue/adapter.ts + lib/ops/jobQueue.ts
  job_queue: [
    'id',
    'org_id',
    'job_type',
    'status',
    'priority',
    'payload',
    'result',
    'retry_count',
    'max_retries',
    'scheduled_at',
    'started_at',
    'completed_at',
    'created_at',
    'updated_at',
  ],

  // lib/billing/usageMeter.ts + lib/billing/stripeReporter.ts
  usage_events: [
    'id',
    'org_id',
    'event_type',
    'quantity',
    'unit',
    'metadata',
    'created_at',
  ],

  // lib/tenant/registry.ts + lib/billing/stripeReporter.ts
  tenants: [
    'id',
    'name',
    'slug',
    'plan',
    'stripe_customer_id',
    'stripe_subscription_id',
    'status',
    'metadata',
    'created_at',
    'updated_at',
  ],

  // lib/ops/cronLock.ts
  cron_lock: [
    'id',
    'lock_name',
    'locked_at',
    'locked_by',
    'expires_at',
    'metadata',
  ],

  // lib/ops/featureFlags.ts
  feature_flags: [
    'id',
    'org_id',
    'flag_name',
    'enabled',
    'rollout_pct',
    'metadata',
    'created_at',
    'updated_at',
  ],

  // lib/ops/incidentLog.ts
  incident_log: [
    'id',
    'org_id',
    'title',
    'severity',
    'status',
    'description',
    'root_cause',
    'resolution',
    'detected_at',
    'resolved_at',
    'created_at',
    'updated_at',
  ],

  // lib/push/notifications.ts
  push_tokens: [
    'id',
    'user_id',
    'endpoint',
    'keys',
    'created_at',
  ],

  // lib/events/bus.ts
  event_history: [
    'id',
    'org_id',
    'event_type',
    'payload',
    'correlation_id',
    'created_at',
  ],

  // lib/security/signedAuditChain.ts
  signed_audit_log: [
    'id',
    'org_id',
    'event_hash',
    'prev_hash',
    'chain_seq',
    'payload',
    'signed_at',
  ],

  // lib/security/rbac.ts
  rbac_user_roles: [
    'id',
    'user_id',
    'org_id',
    'role',
    'granted_by',
    'granted_at',
    'expires_at',
  ],

  // lib/compliance/soc2Evidence.ts
  soc2_evidence_log: [
    'id',
    'org_id',
    'control_id',
    'evidence_type',
    'description',
    'payload',
    'collected_at',
  ],

  // lib/security/siem.ts
  security_events: [
    'id',
    'tenant_id',
    'event_type',
    'severity',
    'source',
    'actor_id',
    'payload',
    'created_at',
  ],

  // lib/ai/feedbackEngine.ts + lib/vault/aiMemoryVault.ts
  ai_feedback: [
    'id',
    'org_id',
    'model',
    'prompt_hash',
    'response_hash',
    'rating',
    'tags',
    'metadata',
    'created_at',
  ],

  // lib/ops/governance.ts
  governance_decisions: [
    'id',
    'org_id',
    'decision_type',
    'actor_id',
    'resource_type',
    'resource_id',
    'decision',
    'reasoning',
    'metadata',
    'decided_at',
  ],

  // lib/platform/config.ts
  platform_config: [
    'id',
    'org_id',
    'key',
    'value',
    'updated_by',
    'created_at',
    'updated_at',
  ],

  // lib/incidents/incidentIngestor.ts (DDL comment at top of file)
  incidents: [
    'incident_id',
    'tenant_id',
    'severity',
    'classification',
    'region',
    'subsystem',
    'raw_error',
    'status',
    'detected_at',
    'resolved_at',
    'metrics_snapshot',
    'causal_chain',
    'impact',
    'autopsy_report',
    'created_at',
    'updated_at',
  ],
}

// ─── Critical tables — blockDeploymentIfDrift throws if these have missing cols
const CRITICAL_TABLES: ReadonlySet<string> = new Set([
  'audit_log',
  'runtime_events',
  'governance_approvals',
  'learning_events',
  'incidents',
])

// ─── Public Types ─────────────────────────────────────────────────────────────

export interface ColumnDrift {
  /** Table name */
  table: string
  /** Columns declared in KNOWN_SCHEMA */
  expected_columns: string[]
  /** Columns actually present in information_schema.columns */
  actual_columns: string[]
  /** In expected but absent from DB — signals a missing migration */
  missing_in_db: string[]
  /** In DB but not in expected manifest — additive migrations, not necessarily bad */
  extra_in_db: string[]
  /**
   * true  = drift detected (columns missing in DB)
   * false = no drift
   * null  = DB unreachable — result is indeterminate, NOT the same as clean
   */
  drift_detected: boolean | null
  /** Present when drift_detected is null — reason DB check could not run */
  db_unreachable?: true
}

export interface SchemaDriftReport {
  generated_at: string
  total_tables_checked: number
  tables_with_drift: number
  /**
   * true  = zero tables have missing_in_db columns
   * false = drift detected
   * null  = at least one table was db_unreachable — cannot certify clean
   */
  clean: boolean | null
  drifts: ColumnDrift[]
}

export class SchemaRegistryError extends Error {
  constructor(
    message: string,
    public readonly drifts: ColumnDrift[],
  ) {
    super(message)
    this.name = 'SchemaRegistryError'
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Returns the actual column names for a single table by querying
 * information_schema.columns via the service-role client.
 *
 * Fail-open: returns null on any DB error so callers can handle gracefully.
 */
async function getActualColumns(tableName: string): Promise<string[] | null> {
  try {
    // supabaseAdmin exposes `rpc` and `from`. We use a raw RPC-style query
    // via the REST endpoint that PostgREST exposes for information_schema.
    // Because Supabase blocks direct SELECT on information_schema from the
    // client, we use the `rpc` approach with a known safe SQL function, or
    // fall back to the PostgREST table endpoint.
    //
    // The cleanest path: use supabaseAdmin.from('information_schema.columns')
    // via the schema override supported in the Supabase JS client v2.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseAdmin as any)
      .schema('information_schema')
      .from('columns')
      .select('column_name')
      .eq('table_schema', 'public')
      .eq('table_name', tableName)

    if (error) {
      console.warn(
        `[SchemaRegistry] information_schema query failed for "${tableName}":`,
        error.message,
      )
      return null
    }

    if (!data || !Array.isArray(data)) return null

    return (data as Array<{ column_name: string }>).map((r) => r.column_name)
  } catch (err) {
    console.warn(
      `[SchemaRegistry] getActualColumns threw for "${tableName}":`,
      err,
    )
    return null
  }
}

/**
 * Produces a ColumnDrift entry for a single table.
 * If the DB query fails, returns drift_detected: false (fail-open).
 */
async function diffTable(tableName: string): Promise<ColumnDrift> {
  const expected = KNOWN_SCHEMA[tableName] ?? []
  const actual = await getActualColumns(tableName)

  // DB unreachable: return indeterminate result — NOT the same as clean.
  // Callers and deploy gates must treat drift_detected === null as "cannot verify".
  if (actual === null) {
    return {
      table:            tableName,
      expected_columns: expected,
      actual_columns:   [],
      missing_in_db:    [],
      extra_in_db:      [],
      drift_detected:   null,
      db_unreachable:   true,
    }
  }

  const actualSet   = new Set(actual)
  const expectedSet = new Set(expected)

  const missing_in_db = expected.filter((c) => !actualSet.has(c))
  const extra_in_db   = actual.filter((c) => !expectedSet.has(c))

  return {
    table:            tableName,
    expected_columns: expected,
    actual_columns:   actual,
    missing_in_db,
    extra_in_db,
    drift_detected:   missing_in_db.length > 0,
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Full drift report across all known tables.
 *
 * Queries information_schema in parallel (one request per table).
 * Fail-open per table: a DB connectivity failure for one table does not
 * affect results for other tables.
 */
export async function validateRuntimeSchemaAgainstDB(): Promise<SchemaDriftReport> {
  const tableNames = Object.keys(KNOWN_SCHEMA)

  const drifts = await Promise.all(tableNames.map(diffTable))

  const tablesWithDrift = drifts.filter((d) => d.drift_detected === true).length
  // clean is null when any table was db_unreachable — cannot certify schema is clean
  const hasUnreachable  = drifts.some((d) => d.db_unreachable === true)
  const clean: boolean | null = hasUnreachable
    ? null
    : drifts.every((d) => d.missing_in_db.length === 0)

  return {
    generated_at:         new Date().toISOString(),
    total_tables_checked: tableNames.length,
    tables_with_drift:    tablesWithDrift,
    clean,
    drifts,
  }
}

/**
 * Quick boolean check — returns whether any table has schema drift plus
 * the list of drifted table names.
 *
 * Useful for health-check endpoints that need a fast yes/no answer.
 */
export async function detectSchemaDrift(): Promise<{
  drifted: boolean
  tables: string[]
}> {
  const report = await validateRuntimeSchemaAgainstDB()
  const tables  = report.drifts
    .filter((d) => d.drift_detected === true)
    .map((d) => d.table)

  return { drifted: tables.length > 0, tables }
}

/**
 * CI gate — throws SchemaRegistryError if any CRITICAL table has columns
 * present in KNOWN_SCHEMA but absent from the DB.
 *
 * Additive migrations (extra_in_db) are not considered failures.
 * Non-critical tables with drift produce a console warning but do not throw.
 */
export async function blockDeploymentIfDrift(): Promise<void> {
  const report = await validateRuntimeSchemaAgainstDB()

  // Treat db_unreachable on any CRITICAL table as a blocking condition —
  // we cannot certify schema is clean if the DB could not be reached.
  const criticalUnreachable = report.drifts.filter(
    (d) => CRITICAL_TABLES.has(d.table) && d.db_unreachable === true,
  )

  if (criticalUnreachable.length > 0) {
    const summary = criticalUnreachable
      .map((d) => `${d.table}: db_unreachable — schema cannot be verified`)
      .join('\n')

    throw new SchemaRegistryError(
      `[SchemaRegistry] CRITICAL tables unreachable — deployment blocked (cannot verify schema):\n${summary}`,
      criticalUnreachable,
    )
  }

  const criticalDrifts = report.drifts.filter(
    (d) => CRITICAL_TABLES.has(d.table) && d.missing_in_db.length > 0,
  )

  const nonCriticalDrifts = report.drifts.filter(
    (d) => !CRITICAL_TABLES.has(d.table) && d.drift_detected,
  )

  if (nonCriticalDrifts.length > 0) {
    console.warn(
      '[SchemaRegistry] Non-critical schema drift detected (non-blocking):',
      nonCriticalDrifts.map((d) => `${d.table}: missing=${d.missing_in_db.join(',')}`).join(' | '),
    )
  }

  if (criticalDrifts.length > 0) {
    const summary = criticalDrifts
      .map(
        (d) =>
          `${d.table}: missing columns [${d.missing_in_db.join(', ')}]`,
      )
      .join('\n')

    throw new SchemaRegistryError(
      `[SchemaRegistry] CRITICAL schema drift detected — deployment blocked:\n${summary}`,
      criticalDrifts,
    )
  }
}

/**
 * Human-readable diff string suitable for CI logs and Control Tower UI.
 *
 * Format per table:
 *   audit_log: OK
 *   runtime_events: DRIFT — missing in DB: [agent_id] | extra in DB: [legacy_col]
 *   governance_approvals: OK
 */
export async function generateSchemaDiffReport(): Promise<string> {
  const report = await validateRuntimeSchemaAgainstDB()

  const lines = report.drifts.map((d) => {
    if (d.db_unreachable) {
      return `${d.table}: DB_UNREACHABLE — schema could not be verified`
    }

    if (d.drift_detected === false && d.extra_in_db.length === 0) {
      return `${d.table}: OK`
    }

    const parts: string[] = []

    if (d.missing_in_db.length > 0) {
      parts.push(`missing in DB: [${d.missing_in_db.join(', ')}]`)
    }
    if (d.extra_in_db.length > 0) {
      parts.push(`extra in DB: [${d.extra_in_db.join(', ')}]`)
    }

    const status = d.drift_detected === true ? 'DRIFT' : 'ADDITIVE'
    return `${d.table}: ${status} — ${parts.join(' | ')}`
  })

  const header = [
    `Schema Drift Report — ${report.generated_at}`,
    `Tables checked: ${report.total_tables_checked} | Tables with drift: ${report.tables_with_drift} | Clean: ${report.clean}`,
    '─'.repeat(72),
  ].join('\n')

  return `${header}\n${lines.join('\n')}`
}
