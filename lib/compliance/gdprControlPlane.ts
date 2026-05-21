// Agency Group — GDPR Control Plane
// lib/compliance/gdprControlPlane.ts
// TypeScript strict — 0 errors
//
// GDPR compliance engine: Art.17 erasure, Art.20 portability, retention, legal hold.
// All erasure is soft-delete with audit trail (immutable audit log entry).
// Legal hold prevents erasure until hold is lifted.

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { writeAuditLog } from '@/lib/compliance/immutableAuditLog'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type GdprBasis =
  | 'consent'
  | 'contract'
  | 'legal_obligation'
  | 'vital_interests'
  | 'public_task'
  | 'legitimate_interests'

export interface DataSubjectRequest {
  request_id: string
  tenant_id: string
  subject_type: 'contact' | 'investor' | 'user'
  subject_id: string
  request_type: 'erasure' | 'portability' | 'access' | 'rectification' | 'restriction'
  basis: GdprBasis | null
  status: 'pending' | 'processing' | 'completed' | 'rejected' | 'on_hold'
  legal_hold: boolean
  legal_hold_reason: string | null
  submitted_at: string
  deadline_at: string        // GDPR: 30 days from request
  completed_at: string | null
  response_package: string | null  // JSON export for portability
}

export interface RetentionPolicy {
  policy_id: string
  tenant_id: string
  data_category: string    // 'contacts', 'deals', 'audit_logs', 'ml_features'
  retention_days: number
  legal_basis: GdprBasis
  auto_purge: boolean
  last_purge_at: string | null
}

// ─── submitErasureRequest ────────────────────────────────────────────────────

export async function submitErasureRequest(
  tenantId: string,
  subjectType: DataSubjectRequest['subject_type'],
  subjectId: string,
): Promise<DataSubjectRequest> {
  const requestId   = randomUUID()
  const submittedAt = new Date().toISOString()
  const deadlineAt  = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  const row = {
    id:                requestId,
    tenant_id:         tenantId,
    subject_type:      subjectType,
    subject_id:        subjectId,
    request_type:      'erasure',
    basis:             null,
    status:            'pending',
    legal_hold:        false,
    legal_hold_reason: null,
    submitted_at:      submittedAt,
    deadline_at:       deadlineAt,
    completed_at:      null,
    response_package:  null,
  }

  const { error } = await (supabaseAdmin as any)
    .from('gdpr_requests')
    .insert(row) as { error: { message: string } | null }

  if (error) {
    log.warn('[gdprControlPlane] submitErasureRequest failed', { tenant_id: tenantId, error: error.message })
    throw new Error(`[gdprControlPlane] submitErasureRequest: ${error.message}`)
  }

  log.info('[gdprControlPlane] erasure request submitted', {
    request_id:   requestId,
    tenant_id:    tenantId,
    subject_type: subjectType,
    subject_id:   subjectId,
    deadline_at:  deadlineAt,
  })

  return {
    request_id:        requestId,
    tenant_id:         tenantId,
    subject_type:      subjectType,
    subject_id:        subjectId,
    request_type:      'erasure',
    basis:             null,
    status:            'pending',
    legal_hold:        false,
    legal_hold_reason: null,
    submitted_at:      submittedAt,
    deadline_at:       deadlineAt,
    completed_at:      null,
    response_package:  null,
  }
}

// ─── processErasureRequest ────────────────────────────────────────────────────

export async function processErasureRequest(
  requestId: string,
): Promise<{ erased_records: number; audit_entry_id: string }> {
  // Fetch the request
  const { data: reqData, error: fetchErr } = await (supabaseAdmin as any)
    .from('gdpr_requests')
    .select('*')
    .eq('id', requestId)
    .single() as { data: Record<string, unknown> | null; error: { message: string } | null }

  if (fetchErr || !reqData) {
    throw new Error(`[gdprControlPlane] processErasureRequest: request not found (${requestId})`)
  }

  const req = toDataSubjectRequest(reqData)

  // Legal hold check
  if (req.legal_hold) {
    log.warn('[gdprControlPlane] erasure blocked by legal hold', {
      request_id: requestId,
      reason:     req.legal_hold_reason,
    })
    throw new Error(`[gdprControlPlane] Erasure blocked by legal hold: ${req.legal_hold_reason ?? 'unknown reason'}`)
  }

  // Mark as processing
  await (supabaseAdmin as any)
    .from('gdpr_requests')
    .update({ status: 'processing' })
    .eq('id', requestId)

  let erasedRecords = 0

  // Soft-delete based on subject type
  const table = subjectTypeToTable(req.subject_type)
  if (table) {
    try {
      const anonymized: Record<string, unknown> = {
        deleted_at: new Date().toISOString(),
        gdpr_erased: true,
      }

      // Anonymize PII fields if they exist on the table
      if (req.subject_type === 'contact' || req.subject_type === 'investor') {
        Object.assign(anonymized, {
          full_name: '[ERASED]',
          email:     '[ERASED]',
          phone:     '[ERASED]',
        })
      }

      const { count } = await (supabaseAdmin as any)
        .from(table)
        .update(anonymized)
        .eq('id', req.subject_id)
        .select('id', { count: 'exact' }) as { count: number | null; error: unknown }

      erasedRecords = count ?? 1
    } catch (err) {
      log.warn('[gdprControlPlane] soft-delete failed', {
        table,
        subject_id: req.subject_id,
        error:      String(err),
      })
    }
  }

  // Write immutable audit entry
  const auditEntry = await writeAuditLog(
    req.tenant_id,
    'compliance_check_performed',
    'gdpr_system',
    'gdpr_request',
    requestId,
    {
      gdpr_action:     'erasure',
      subject_type:    req.subject_type,
      subject_id:      req.subject_id,
      erased_records:  erasedRecords,
      processed_at:    new Date().toISOString(),
    },
    requestId,
  )

  // Mark as completed
  await (supabaseAdmin as any)
    .from('gdpr_requests')
    .update({
      status:       'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', requestId)

  log.info('[gdprControlPlane] erasure completed', {
    request_id:     requestId,
    erased_records: erasedRecords,
    audit_entry_id: auditEntry.id,
  })

  return { erased_records: erasedRecords, audit_entry_id: auditEntry.id }
}

// ─── exportSubjectData ────────────────────────────────────────────────────────

export async function exportSubjectData(
  tenantId: string,
  subjectType: string,
  subjectId: string,
): Promise<Record<string, unknown>> {
  const exportData: Record<string, unknown> = {
    export_generated_at: new Date().toISOString(),
    tenant_id:           tenantId,
    subject_type:        subjectType,
    subject_id:          subjectId,
    gdpr_article:        'Article 20 — Data Portability',
  }

  const table = subjectTypeToTable(subjectType as DataSubjectRequest['subject_type'])
  if (table) {
    try {
      const { data } = await (supabaseAdmin as any)
        .from(table)
        .select('*')
        .eq('id', subjectId)
        .eq('tenant_id', tenantId)
        .single() as { data: Record<string, unknown> | null; error: unknown }

      if (data) {
        exportData['profile'] = data
      }
    } catch (err) {
      log.warn('[gdprControlPlane] exportSubjectData profile error', { error: String(err) })
    }
  }

  // Collect audit entries for the subject
  try {
    const { data: auditRows } = await (supabaseAdmin as any)
      .from('audit_log_entries')
      .select('action, entity_type, created_at, payload')
      .eq('tenant_id', tenantId)
      .eq('entity_id', subjectId)
      .order('created_at', { ascending: false })
      .limit(500) as { data: unknown[] | null; error: unknown }

    exportData['audit_history'] = auditRows ?? []
  } catch (err) {
    log.warn('[gdprControlPlane] exportSubjectData audit error', { error: String(err) })
    exportData['audit_history'] = []
  }

  return exportData
}

// ─── applyLegalHold ──────────────────────────────────────────────────────────

export async function applyLegalHold(requestId: string, reason: string): Promise<void> {
  const { error } = await (supabaseAdmin as any)
    .from('gdpr_requests')
    .update({
      legal_hold:        true,
      legal_hold_reason: reason,
      status:            'on_hold',
    })
    .eq('id', requestId) as { error: { message: string } | null }

  if (error) {
    throw new Error(`[gdprControlPlane] applyLegalHold: ${error.message}`)
  }

  log.info('[gdprControlPlane] legal hold applied', { request_id: requestId, reason })
}

// ─── runRetentionPurge ────────────────────────────────────────────────────────

export async function runRetentionPurge(
  tenantId: string,
): Promise<{ purged: number; skipped: number; errors: number }> {
  const now = new Date().toISOString()
  let purged = 0
  let skipped = 0
  let errors = 0

  // Fetch retention policies with auto_purge enabled
  const { data: policies } = await (supabaseAdmin as any)
    .from('retention_policies')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('auto_purge', true) as { data: Array<Record<string, unknown>> | null; error: unknown }

  const activePolicies = policies ?? []

  for (const policyRow of activePolicies) {
    const policy = toRetentionPolicy(policyRow)
    const cutoffDate = new Date(
      Date.now() - policy.retention_days * 24 * 60 * 60 * 1000,
    ).toISOString()

    // Tables that support soft-delete purge
    const purgeable = ['contacts', 'investors', 'deals']
    if (!purgeable.includes(policy.data_category)) {
      skipped++
      continue
    }

    try {
      const { count } = await (supabaseAdmin as any)
        .from(policy.data_category)
        .update({ deleted_at: now, gdpr_purged: true })
        .eq('tenant_id', tenantId)
        .lte('created_at', cutoffDate)
        .is('deleted_at', null)
        .select('id', { count: 'exact' }) as { count: number | null; error: unknown }

      purged += count ?? 0

      // Update last_purge_at
      await (supabaseAdmin as any)
        .from('retention_policies')
        .update({ last_purge_at: now })
        .eq('id', policy.policy_id)
    } catch (err) {
      log.warn('[gdprControlPlane] retention purge error', {
        tenant_id:     tenantId,
        data_category: policy.data_category,
        error:         String(err),
      })
      errors++
    }
  }

  log.info('[gdprControlPlane] retention purge complete', {
    tenant_id: tenantId,
    purged,
    skipped,
    errors,
  })

  return { purged, skipped, errors }
}

// ─── getGdprStatus ────────────────────────────────────────────────────────────

export async function getGdprStatus(
  tenantId: string,
): Promise<{ pending_requests: number; overdue_requests: number; retention_policies: RetentionPolicy[] }> {
  const now = new Date().toISOString()

  const [pendingRes, overdueRes, policiesRes] = await Promise.allSettled([
    (supabaseAdmin as any)
      .from('gdpr_requests')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .in('status', ['pending', 'processing']),
    (supabaseAdmin as any)
      .from('gdpr_requests')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .in('status', ['pending', 'processing'])
      .lt('deadline_at', now),
    (supabaseAdmin as any)
      .from('retention_policies')
      .select('*')
      .eq('tenant_id', tenantId),
  ])

  const pendingCount  = pendingRes.status === 'fulfilled'  ? ((pendingRes.value as { count: number | null }).count  ?? 0) : 0
  const overdueCount  = overdueRes.status === 'fulfilled'  ? ((overdueRes.value as { count: number | null }).count  ?? 0) : 0
  const policiesData  = policiesRes.status === 'fulfilled' ? ((policiesRes.value as { data: Array<Record<string, unknown>> | null }).data ?? []) : []

  return {
    pending_requests:  pendingCount,
    overdue_requests:  overdueCount,
    retention_policies: policiesData.map(toRetentionPolicy),
  }
}

// ─── Row → DataSubjectRequest ─────────────────────────────────────────────────

function toDataSubjectRequest(row: Record<string, unknown>): DataSubjectRequest {
  return {
    request_id:        String(row['id'] ?? ''),
    tenant_id:         String(row['tenant_id'] ?? ''),
    subject_type:      (row['subject_type'] as DataSubjectRequest['subject_type']) ?? 'contact',
    subject_id:        String(row['subject_id'] ?? ''),
    request_type:      (row['request_type'] as DataSubjectRequest['request_type']) ?? 'erasure',
    basis:             row['basis'] != null ? (row['basis'] as GdprBasis) : null,
    status:            (row['status'] as DataSubjectRequest['status']) ?? 'pending',
    legal_hold:        Boolean(row['legal_hold']),
    legal_hold_reason: row['legal_hold_reason'] != null ? String(row['legal_hold_reason']) : null,
    submitted_at:      String(row['submitted_at'] ?? new Date().toISOString()),
    deadline_at:       String(row['deadline_at'] ?? ''),
    completed_at:      row['completed_at'] != null ? String(row['completed_at']) : null,
    response_package:  row['response_package'] != null ? String(row['response_package']) : null,
  }
}

function toRetentionPolicy(row: Record<string, unknown>): RetentionPolicy {
  return {
    policy_id:      String(row['id'] ?? ''),
    tenant_id:      String(row['tenant_id'] ?? ''),
    data_category:  String(row['data_category'] ?? ''),
    retention_days: Number(row['retention_days'] ?? 365),
    legal_basis:    (row['legal_basis'] as GdprBasis) ?? 'legitimate_interests',
    auto_purge:     Boolean(row['auto_purge']),
    last_purge_at:  row['last_purge_at'] != null ? String(row['last_purge_at']) : null,
  }
}

function subjectTypeToTable(subjectType: DataSubjectRequest['subject_type']): string | null {
  const map: Record<DataSubjectRequest['subject_type'], string> = {
    contact:  'contacts',
    investor: 'investors',
    user:     'users',
  }
  return map[subjectType] ?? null
}
