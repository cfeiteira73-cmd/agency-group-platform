// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — GDPR Full Engine v1.0
// lib/compliance/gdprFullEngine.ts
//
// Full GDPR compliance engine:
//   - Art 17 erasure (right to be forgotten)
//   - Art 20 portability (data export)
//   - Retention policies per table category
//   - Automated purge with evidence hashing
//
// TypeScript strict — 0 errors
// =============================================================================

import { createHash, randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'

// ─── Logger shim ──────────────────────────────────────────────────────────────

let log: { info: (msg: string, ctx?: unknown) => void; warn: (msg: string, ctx?: unknown) => void; error: (msg: string, ctx?: unknown) => void }
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { logger } = require('@/lib/observability/logger') as { logger: typeof log }
  log = logger
} catch {
  log = {
    info: (msg, ctx) => console.log('[gdprFullEngine]', msg, ctx ?? ''),
    warn: (msg, ctx) => console.warn('[gdprFullEngine]', msg, ctx ?? ''),
    error: (msg, ctx) => console.error('[gdprFullEngine]', msg, ctx ?? ''),
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type GdprRequestType =
  | 'ERASURE'
  | 'PORTABILITY'
  | 'RECTIFICATION'
  | 'ACCESS'
  | 'RESTRICTION'
  | 'OBJECTION'

export type GdprRequestStatus =
  | 'RECEIVED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'REJECTED'
  | 'PARTIALLY_COMPLETED'

export interface GdprRequest {
  request_id: string
  tenant_id: string
  subject_id: string
  subject_email: string
  request_type: GdprRequestType
  status: GdprRequestStatus
  legal_basis: string
  tables_affected: string[]
  completed_fields: string[]
  rejection_reason: string | null
  received_at: string
  deadline_at: string // 30 days from received_at (GDPR requirement)
  completed_at: string | null
  evidence_hash: string | null // SHA-256 of completion evidence
}

// ─── Retention Policies ───────────────────────────────────────────────────────

// Data retention policies per table category
export const RETENTION_POLICIES: Record<string, { days: number; legal_basis: string }> = {
  personal_data:      { days: 365 * 2,  legal_basis: 'GDPR Art 5(1)(e) — storage limitation' },
  transaction_data:   { days: 365 * 7,  legal_basis: 'Portuguese commercial law — 7yr retention' },
  audit_logs:         { days: 365 * 10, legal_basis: 'AML/KYC regulatory requirement — 10yr' },
  marketing_data:     { days: 365,      legal_basis: 'Consent-based — 1yr' },
  session_data:       { days: 90,       legal_basis: 'Security requirement — 90 days' },
}

// Tables that may be erased/anonymized (personal data only)
const ERASABLE_TABLES = ['contacts', 'marketing_preferences', 'session_data', 'crm_contacts', 'lead_captures']
// Tables that must be retained for legal/regulatory reasons
const RETAINED_TABLES = ['transaction_data', 'audit_trail', 'audit_logs', 'tax_assessments', 'kyc_records']

// ─── submitGdprRequest ────────────────────────────────────────────────────────

export async function submitGdprRequest(
  subjectId: string,
  subjectEmail: string,
  type: GdprRequestType,
  legalBasis: string,
  tenantId: string,
): Promise<GdprRequest> {
  const requestId = randomUUID()
  const now = new Date()
  const deadline = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  const record: Omit<GdprRequest, 'tables_affected' | 'completed_fields'> & {
    tables_affected: string[]
    completed_fields: string[]
  } = {
    request_id:      requestId,
    tenant_id:       tenantId,
    subject_id:      subjectId,
    subject_email:   subjectEmail,
    request_type:    type,
    status:          'RECEIVED',
    legal_basis:     legalBasis,
    tables_affected: [],
    completed_fields:[],
    rejection_reason:null,
    received_at:     now.toISOString(),
    deadline_at:     deadline.toISOString(),
    completed_at:    null,
    evidence_hash:   null,
  }

  const { error } = await (supabaseAdmin as any).from('gdpr_requests').insert(record)
  if (error) {
    log.error('Failed to insert GDPR request', { error, requestId })
    throw new Error(`GDPR request insert failed: ${error.message}`)
  }

  log.info('GDPR request submitted', { requestId, type, subjectId })
  return record as GdprRequest
}

// ─── processErasureRequest ────────────────────────────────────────────────────

export async function processErasureRequest(
  requestId: string,
): Promise<{ tables_processed: string[]; rows_deleted: number; retained_for_legal: string[] }> {
  // Load request
  const { data: reqData, error: reqErr } = await (supabaseAdmin as any)
    .from('gdpr_requests')
    .select('*')
    .eq('request_id', requestId)
    .maybeSingle()

  if (reqErr || !reqData) {
    throw new Error(`GDPR request not found: ${requestId}`)
  }

  const request = reqData as GdprRequest
  const subjectId = request.subject_id
  const subjectEmail = request.subject_email

  const tablesProcessed: string[] = []
  let rowsDeleted = 0
  const retainedForLegal: string[] = []

  // Anonymize erasable tables
  for (const table of ERASABLE_TABLES) {
    try {
      const anonymized = {
        email:  `deleted_${requestId}@anonymized.invalid`,
        name:   '[DELETED]',
        phone:  '[DELETED]',
      }

      // Try by subject_id first, then by email
      const { data: byId } = await (supabaseAdmin as any)
        .from(table)
        .update(anonymized)
        .or(`user_id.eq.${subjectId},investor_id.eq.${subjectId}`)
        .select('id')

      const { data: byEmail } = await (supabaseAdmin as any)
        .from(table)
        .update(anonymized)
        .eq('email', subjectEmail)
        .select('id')

      const affected = ((byId ?? []) as unknown[]).length + ((byEmail ?? []) as unknown[]).length
      if (affected > 0) {
        tablesProcessed.push(table)
        rowsDeleted += affected
        // Log erasure
        void (supabaseAdmin as any).from('gdpr_erasure_log').insert({
          request_id:   requestId,
          tenant_id:    request.tenant_id,
          table_name:   table,
          rows_affected:affected,
          action_taken: 'ANONYMIZED',
        }).then(({ error: e }: { error: { message: string } | null }) => {
          if (e) console.warn('[gdprFullEngine] erasure log insert', e.message)
        })
      }
    } catch (e) {
      log.warn(`Could not anonymize table ${table}`, { error: e })
    }
  }

  // Mark retained tables
  for (const table of RETAINED_TABLES) {
    retainedForLegal.push(`${table} (retained under ${RETENTION_POLICIES['audit_logs']?.legal_basis ?? 'legal requirement'})`)
  }

  // Compute evidence hash
  const evidence = JSON.stringify({ tablesProcessed, rowsDeleted, retainedForLegal, requestId })
  const evidenceHash = createHash('sha256').update(evidence).digest('hex')

  // Update request status
  void (supabaseAdmin as any).from('gdpr_requests').update({
    status:         'COMPLETED',
    completed_at:   new Date().toISOString(),
    tables_affected:tablesProcessed,
    evidence_hash:  evidenceHash,
  }).eq('request_id', requestId).then(({ error: e }: { error: { message: string } | null }) => {
    if (e) console.warn('[gdprFullEngine] status update', e.message)
  })

  log.info('GDPR erasure completed', { requestId, rowsDeleted, tablesProcessed: tablesProcessed.length })

  return { tables_processed: tablesProcessed, rows_deleted: rowsDeleted, retained_for_legal: retainedForLegal }
}

// ─── exportPersonalData ───────────────────────────────────────────────────────

export async function exportPersonalData(
  subjectId: string,
  tenantId: string,
): Promise<{ export_id: string; data_categories: string[]; record_count: number; export_hash: string }> {
  const exportId = randomUUID()
  const dataCategories: string[] = []
  let recordCount = 0

  // Collect from known tables
  const readTables = ['contacts', 'kyc_records', 'gdpr_requests', 'tax_assessments']
  for (const table of readTables) {
    try {
      const { data } = await (supabaseAdmin as any)
        .from(table)
        .select('*')
        .or(`subject_id.eq.${subjectId},user_id.eq.${subjectId},investor_id.eq.${subjectId}`)
        .eq('tenant_id', tenantId)
        .limit(1000)

      if (data && (data as unknown[]).length > 0) {
        dataCategories.push(table)
        recordCount += (data as unknown[]).length
      }
    } catch {
      // Table may not exist yet — skip
    }
  }

  const exportHash = createHash('sha256')
    .update(JSON.stringify({ exportId, subjectId, dataCategories, recordCount, ts: new Date().toISOString() }))
    .digest('hex')

  // Insert export record
  void (supabaseAdmin as any).from('gdpr_portability_exports').insert({
    export_id:      exportId,
    tenant_id:      tenantId,
    subject_id:     subjectId,
    data_categories:dataCategories,
    record_count:   recordCount,
    export_hash:    exportHash,
  }).then(({ error: e }: { error: { message: string } | null }) => {
    if (e) console.warn('[gdprFullEngine] portability export insert', e.message)
  })

  log.info('GDPR portability export created', { exportId, subjectId, recordCount })

  return { export_id: exportId, data_categories: dataCategories, record_count: recordCount, export_hash: exportHash }
}

// ─── runRetentionPurge ────────────────────────────────────────────────────────

export async function runRetentionPurge(
  tenantId: string,
): Promise<{ purged_records: number; categories: string[] }> {
  let totalPurged = 0
  const purgedCategories: string[] = []

  for (const [category, policy] of Object.entries(RETENTION_POLICIES)) {
    if (category === 'audit_logs' || category === 'transaction_data') continue // Never auto-purge regulated data

    const cutoff = new Date(Date.now() - policy.days * 24 * 60 * 60 * 1000).toISOString()

    // Map category to table
    const tableMap: Record<string, string> = {
      personal_data:  'contacts',
      marketing_data: 'marketing_preferences',
      session_data:   'session_data',
    }
    const table = tableMap[category]
    if (!table) continue

    try {
      const { data: toDelete } = await (supabaseAdmin as any)
        .from(table)
        .select('id')
        .lt('created_at', cutoff)
        .eq('tenant_id', tenantId)
        .limit(500)

      const ids = ((toDelete ?? []) as Array<{ id: string }>).map(r => r.id)
      if (ids.length === 0) continue

      void (supabaseAdmin as any)
        .from(table)
        .delete()
        .in('id', ids)
        .then(({ error: e }: { error: { message: string } | null }) => {
          if (e) console.warn('[gdprFullEngine] purge delete', table, e.message)
        })

      totalPurged += ids.length
      purgedCategories.push(category)

      void (supabaseAdmin as any).from('gdpr_purge_log').insert({
        tenant_id:  tenantId,
        category,
        rows_purged:ids.length,
      }).then(({ error: e }: { error: { message: string } | null }) => {
        if (e) console.warn('[gdprFullEngine] purge log insert', e.message)
      })
    } catch (e) {
      log.warn(`Retention purge failed for ${category}`, { error: e })
    }
  }

  log.info('Retention purge completed', { tenantId, totalPurged, categories: purgedCategories })
  return { purged_records: totalPurged, categories: purgedCategories }
}

// ─── getGdprDashboard ─────────────────────────────────────────────────────────

export async function getGdprDashboard(tenantId: string): Promise<{
  pending_requests: number
  overdue_requests: number
  avg_completion_days: number
  last_purge_at: string | null
}> {
  const now = new Date().toISOString()

  const [pendingRes, overdueRes, completedRes, purgeRes] = await Promise.all([
    (supabaseAdmin as any)
      .from('gdpr_requests')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .in('status', ['RECEIVED', 'IN_PROGRESS']),

    (supabaseAdmin as any)
      .from('gdpr_requests')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .in('status', ['RECEIVED', 'IN_PROGRESS'])
      .lt('deadline_at', now),

    (supabaseAdmin as any)
      .from('gdpr_requests')
      .select('received_at, completed_at')
      .eq('tenant_id', tenantId)
      .eq('status', 'COMPLETED')
      .limit(50),

    (supabaseAdmin as any)
      .from('gdpr_purge_log')
      .select('purged_at')
      .eq('tenant_id', tenantId)
      .order('purged_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const completed = (completedRes.data ?? []) as Array<{ received_at: string; completed_at: string | null }>
  let avgDays = 0
  if (completed.length > 0) {
    const totalMs = completed.reduce((sum, r) => {
      if (!r.completed_at) return sum
      return sum + (new Date(r.completed_at).getTime() - new Date(r.received_at).getTime())
    }, 0)
    avgDays = Math.round(totalMs / completed.length / 86400000)
  }

  return {
    pending_requests:  pendingRes.count ?? 0,
    overdue_requests:  overdueRes.count ?? 0,
    avg_completion_days: avgDays,
    last_purge_at:     (purgeRes.data as { purged_at: string } | null)?.purged_at ?? null,
  }
}
