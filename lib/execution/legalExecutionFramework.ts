// Agency Group — Legal Execution Framework
// lib/execution/legalExecutionFramework.ts
// Manages CPCV workflow, digital signature coordination, notary confirmation.
// Does NOT integrate actual signature providers (Docusign/Signaturit) —
// provides the state management layer. Providers integrate via webhook events.
// TypeScript strict — 0 errors

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { transitionSettlement } from '@/lib/capital/settlementStateMachine'
import log from '@/lib/logger'

// ─── Constants ────────────────────────────────────────────────────────────────

const CANONICAL_TENANT =
  process.env.DEFAULT_TENANT_ID ??
  process.env.SYSTEM_ORG_ID ??
  '00000000-0000-0000-0000-000000000001'

// ─── Types ────────────────────────────────────────────────────────────────────

export type LegalDocumentType =
  | 'CPCV'
  | 'PROMISSORY_CONTRACT'
  | 'DEED'
  | 'POWER_OF_ATTORNEY'
  | 'ID_VERIFICATION'
  | 'COMPLIANCE_DECLARATION'

export type LegalEventType =
  | 'DOCUMENT_GENERATED'
  | 'SENT_FOR_SIGNATURE'
  | 'PARTIALLY_SIGNED'
  | 'FULLY_SIGNED'
  | 'NOTARY_SUBMITTED'
  | 'NOTARY_CONFIRMED'
  | 'REGISTERED'
  | 'REJECTED'

export interface LegalDocument {
  doc_id: string
  settlement_id: string
  tenant_id: string
  doc_type: LegalDocumentType
  status: LegalEventType
  parties: string[]
  document_hash: string | null
  signed_by: string[]
  notary_reference: string | null
  registered_at: string | null
  created_at: string
  updated_at: string
}

export interface CPCVWorkflow {
  workflow_id: string
  settlement_id: string
  tenant_id: string
  cpcv_doc_id: string | null
  deed_doc_id: string | null
  cpcv_signed_at: string | null
  deed_signed_at: string | null
  notary_confirmed_at: string | null
  registered_at: string | null
  current_stage:
    | 'INITIATED'
    | 'CPCV_PENDING'
    | 'CPCV_SIGNED'
    | 'DEED_PENDING'
    | 'DEED_SIGNED'
    | 'NOTARY_PENDING'
    | 'COMPLETE'
  blocking_reason: string | null
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDocRow(row: Record<string, any>): LegalDocument {
  return {
    doc_id:           row.doc_id as string,
    settlement_id:    row.settlement_id as string,
    tenant_id:        row.tenant_id as string,
    doc_type:         row.doc_type as LegalDocumentType,
    status:           row.status as LegalEventType,
    parties:          (row.parties as string[]) ?? [],
    document_hash:    (row.document_hash as string | null) ?? null,
    signed_by:        (row.signed_by as string[]) ?? [],
    notary_reference: (row.notary_reference as string | null) ?? null,
    registered_at:    (row.registered_at as string | null) ?? null,
    created_at:       row.created_at as string,
    updated_at:       row.updated_at as string,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapWorkflowRow(row: Record<string, any>): CPCVWorkflow {
  return {
    workflow_id:         row.workflow_id as string,
    settlement_id:       row.settlement_id as string,
    tenant_id:           row.tenant_id as string,
    cpcv_doc_id:         (row.cpcv_doc_id as string | null) ?? null,
    deed_doc_id:         (row.deed_doc_id as string | null) ?? null,
    cpcv_signed_at:      (row.cpcv_signed_at as string | null) ?? null,
    deed_signed_at:      (row.deed_signed_at as string | null) ?? null,
    notary_confirmed_at: (row.notary_confirmed_at as string | null) ?? null,
    registered_at:       (row.registered_at as string | null) ?? null,
    current_stage:       row.current_stage as CPCVWorkflow['current_stage'],
    blocking_reason:     (row.blocking_reason as string | null) ?? null,
  }
}

// ─── initiateCPCVWorkflow ─────────────────────────────────────────────────────

/**
 * Creates a CPCV workflow and the initial CPCV document record.
 * Inserts into cpcv_workflows and legal_documents tables.
 */
export async function initiateCPCVWorkflow(
  settlementId: string,
  parties: string[],
  tenantId: string,
): Promise<CPCVWorkflow> {
  const tid = tenantId || CANONICAL_TENANT
  const workflowId = `wf_${randomUUID()}`
  const docId = `doc_${randomUUID()}`
  const now = new Date().toISOString()

  // ── Create CPCV document record ───────────────────────────────────────────
  const docRow = {
    doc_id:           docId,
    tenant_id:        tid,
    settlement_id:    settlementId,
    doc_type:         'CPCV' as LegalDocumentType,
    status:           'DOCUMENT_GENERATED' as LegalEventType,
    parties,
    document_hash:    null,
    signed_by:        [],
    notary_reference: null,
    registered_at:    null,
    created_at:       now,
    updated_at:       now,
  }

  const { error: docErr } = await (supabaseAdmin as any)
    .from('legal_documents')
    .insert(docRow)

  if (docErr) {
    throw new Error(`[legalExecutionFramework] initiateCPCVWorkflow: failed to create CPCV document: ${docErr.message}`)
  }

  // ── Record initial legal event ────────────────────────────────────────────
  void (supabaseAdmin as any)
    .from('legal_events')
    .insert({
      tenant_id:       tid,
      doc_id:          docId,
      settlement_id:   settlementId,
      event_type:      'DOCUMENT_GENERATED',
      signed_by:       null,
      notary_reference: null,
      recorded_at:     now,
      metadata:        { workflow_id: workflowId, parties },
    })
    .then(({ error }: { error: { message: string } | null }) => {
      if (error) log.info('[legalExecutionFramework] legal_event insert warn', { doc_id: docId, error: error.message })
    })

  // ── Create CPCV workflow ──────────────────────────────────────────────────
  const workflowRow = {
    workflow_id:         workflowId,
    tenant_id:           tid,
    settlement_id:       settlementId,
    cpcv_doc_id:         docId,
    deed_doc_id:         null,
    cpcv_signed_at:      null,
    deed_signed_at:      null,
    notary_confirmed_at: null,
    registered_at:       null,
    current_stage:       'CPCV_PENDING' as CPCVWorkflow['current_stage'],
    blocking_reason:     null,
    created_at:          now,
    updated_at:          now,
  }

  const { data: workflowData, error: workflowErr } = await (supabaseAdmin as any)
    .from('cpcv_workflows')
    .insert(workflowRow)
    .select('*')
    .single()

  if (workflowErr || !workflowData) {
    throw new Error(`[legalExecutionFramework] initiateCPCVWorkflow: failed to create workflow: ${workflowErr?.message ?? 'no data'}`)
  }

  log.info('[legalExecutionFramework] CPCV workflow initiated', {
    workflow_id:   workflowId,
    settlement_id: settlementId,
    doc_id:        docId,
  })

  return mapWorkflowRow(workflowData)
}

// ─── recordLegalEvent ─────────────────────────────────────────────────────────

/**
 * Updates document status, records in legal_events.
 * If FULLY_SIGNED: updates CPCVWorkflow stage accordingly.
 * If NOTARY_CONFIRMED: triggers settlement transition via transitionSettlement (notarize).
 */
export async function recordLegalEvent(
  docId: string,
  event: LegalEventType,
  signedBy: string | null,
  notaryRef: string | null,
  tenantId: string,
): Promise<LegalDocument> {
  const tid = tenantId || CANONICAL_TENANT
  const now = new Date().toISOString()

  // ── Fetch document ────────────────────────────────────────────────────────
  const { data: docData, error: fetchErr } = await (supabaseAdmin as any)
    .from('legal_documents')
    .select('*')
    .eq('doc_id', docId)
    .eq('tenant_id', tid)
    .maybeSingle()

  if (fetchErr || !docData) {
    throw new Error(`[legalExecutionFramework] recordLegalEvent: document not found: ${docId}`)
  }

  const doc = mapDocRow(docData)

  // ── Build updated signed_by ───────────────────────────────────────────────
  const updatedSignedBy: string[] =
    signedBy && !doc.signed_by.includes(signedBy)
      ? [...doc.signed_by, signedBy]
      : doc.signed_by

  // ── Update document ───────────────────────────────────────────────────────
  const docUpdates: Record<string, unknown> = {
    status:     event,
    signed_by:  updatedSignedBy,
    updated_at: now,
  }

  if (notaryRef) {
    docUpdates['notary_reference'] = notaryRef
  }

  if (event === 'REGISTERED') {
    docUpdates['registered_at'] = now
  }

  const { data: updatedDoc, error: updateErr } = await (supabaseAdmin as any)
    .from('legal_documents')
    .update(docUpdates)
    .eq('doc_id', docId)
    .eq('tenant_id', tid)
    .select('*')
    .single()

  if (updateErr || !updatedDoc) {
    throw new Error(`[legalExecutionFramework] recordLegalEvent: update failed: ${updateErr?.message ?? 'no data'}`)
  }

  // ── Record legal event ────────────────────────────────────────────────────
  void (supabaseAdmin as any)
    .from('legal_events')
    .insert({
      tenant_id:        tid,
      doc_id:           docId,
      settlement_id:    doc.settlement_id,
      event_type:       event,
      signed_by:        signedBy,
      notary_reference: notaryRef,
      recorded_at:      now,
      metadata:         { doc_type: doc.doc_type },
    })
    .then(({ error }: { error: { message: string } | null }) => {
      if (error) log.info('[legalExecutionFramework] legal_event insert warn', { doc_id: docId, error: error.message })
    })

  // ── Update CPCVWorkflow stage if relevant ─────────────────────────────────
  if (event === 'FULLY_SIGNED') {
    const { data: wf, error: wfErr } = await (supabaseAdmin as any)
      .from('cpcv_workflows')
      .select('*')
      .eq('settlement_id', doc.settlement_id)
      .eq('tenant_id', tid)
      .maybeSingle()

    if (!wfErr && wf) {
      const workflow = mapWorkflowRow(wf)

      let newStage: CPCVWorkflow['current_stage'] = workflow.current_stage
      const stageUpdates: Record<string, unknown> = { updated_at: now }

      // Determine which document was just signed
      if (doc.doc_type === 'CPCV' || doc.doc_type === 'PROMISSORY_CONTRACT') {
        if (workflow.current_stage === 'CPCV_PENDING' || workflow.current_stage === 'INITIATED') {
          newStage = 'CPCV_SIGNED'
          stageUpdates['cpcv_signed_at'] = now
          stageUpdates['current_stage'] = newStage
        }
      } else if (doc.doc_type === 'DEED') {
        if (workflow.current_stage === 'DEED_PENDING' || workflow.current_stage === 'CPCV_SIGNED') {
          newStage = 'DEED_SIGNED'
          stageUpdates['deed_signed_at'] = now
          stageUpdates['current_stage'] = newStage
        }
      }

      if (Object.keys(stageUpdates).length > 1) {
        void (supabaseAdmin as any)
          .from('cpcv_workflows')
          .update(stageUpdates)
          .eq('workflow_id', workflow.workflow_id)
          .eq('tenant_id', tid)
          .then(({ error: wfUpdateErr }: { error: { message: string } | null }) => {
            if (wfUpdateErr) {
              log.info('[legalExecutionFramework] workflow stage update warn', {
                workflow_id: workflow.workflow_id,
                error: wfUpdateErr.message,
              })
            }
          })
      }
    }
  }

  if (event === 'NOTARY_CONFIRMED') {
    // Trigger settlement transition → NOTARIZED
    void transitionSettlement(
      doc.settlement_id,
      'notarize',
      `legal_framework:${docId}`,
      `Notary confirmed — doc ${docId}, ref: ${notaryRef ?? 'N/A'}`,
      tid,
    )
      .then(() => {
        log.info('[legalExecutionFramework] settlement notarized', {
          settlement_id: doc.settlement_id,
          doc_id:        docId,
        })
      })
      .catch((e: unknown) => {
        console.warn('[legalExecutionFramework] settlement notarize transition warn', e)
      })

    // Update workflow
    void (supabaseAdmin as any)
      .from('cpcv_workflows')
      .update({
        current_stage:       'NOTARY_PENDING',
        notary_confirmed_at: now,
        updated_at:          now,
      })
      .eq('settlement_id', doc.settlement_id)
      .eq('tenant_id', tid)
      .then(({ error: wfErr2 }: { error: { message: string } | null }) => {
        if (wfErr2) {
          log.info('[legalExecutionFramework] workflow notary update warn', { error: wfErr2.message })
        }
      })
  }

  if (event === 'REGISTERED') {
    // Mark workflow as COMPLETE
    void (supabaseAdmin as any)
      .from('cpcv_workflows')
      .update({
        current_stage: 'COMPLETE',
        registered_at: now,
        updated_at:    now,
      })
      .eq('settlement_id', doc.settlement_id)
      .eq('tenant_id', tid)
      .then(({ error: wfErr3 }: { error: { message: string } | null }) => {
        if (wfErr3) {
          log.info('[legalExecutionFramework] workflow complete update warn', { error: wfErr3.message })
        }
      })
  }

  log.info('[legalExecutionFramework] legal event recorded', {
    doc_id:  docId,
    event,
  })

  return mapDocRow(updatedDoc)
}

// ─── getCPCVWorkflow ──────────────────────────────────────────────────────────

export async function getCPCVWorkflow(
  settlementId: string,
  tenantId: string,
): Promise<CPCVWorkflow | null> {
  const tid = tenantId || CANONICAL_TENANT

  const { data, error } = await (supabaseAdmin as any)
    .from('cpcv_workflows')
    .select('*')
    .eq('settlement_id', settlementId)
    .eq('tenant_id', tid)
    .maybeSingle()

  if (error) {
    log.info('[legalExecutionFramework] getCPCVWorkflow error', {
      settlement_id: settlementId,
      error: error.message,
    })
    return null
  }

  return data ? mapWorkflowRow(data) : null
}

// ─── getBlockingIssues ────────────────────────────────────────────────────────

/**
 * Returns a list of blocking issues for the settlement's CPCV workflow.
 * Checks for missing/incomplete required documents and workflow stages.
 */
export async function getBlockingIssues(
  settlementId: string,
  tenantId: string,
): Promise<string[]> {
  const tid = tenantId || CANONICAL_TENANT
  const issues: string[] = []

  // Fetch workflow
  const workflow = await getCPCVWorkflow(settlementId, tid)

  if (!workflow) {
    issues.push('CPCV workflow not initiated for this settlement')
    return issues
  }

  // Fetch all documents for this settlement
  const { data: docs, error: docsErr } = await (supabaseAdmin as any)
    .from('legal_documents')
    .select('*')
    .eq('settlement_id', settlementId)
    .eq('tenant_id', tid)

  if (docsErr) {
    issues.push(`Unable to fetch legal documents: ${docsErr.message}`)
    return issues
  }

  const documents: LegalDocument[] = ((docs ?? []) as Record<string, unknown>[]).map(mapDocRow)

  // Required documents for a complete transaction
  const requiredTypes: LegalDocumentType[] = ['CPCV', 'DEED', 'ID_VERIFICATION']

  for (const requiredType of requiredTypes) {
    const doc = documents.find((d) => d.doc_type === requiredType)
    if (!doc) {
      issues.push(`Missing required document: ${requiredType}`)
    } else if (doc.status === 'REJECTED') {
      issues.push(`Document ${requiredType} was REJECTED — must be re-issued`)
    } else if (requiredType === 'CPCV' && doc.status !== 'FULLY_SIGNED' && doc.status !== 'NOTARY_CONFIRMED' && doc.status !== 'REGISTERED') {
      issues.push(`CPCV not fully signed (current status: ${doc.status})`)
    } else if (requiredType === 'DEED' && doc.status !== 'FULLY_SIGNED' && doc.status !== 'NOTARY_CONFIRMED' && doc.status !== 'REGISTERED') {
      issues.push(`DEED not fully signed (current status: ${doc.status})`)
    }
  }

  // Check workflow blocking_reason
  if (workflow.blocking_reason) {
    issues.push(`Workflow blocking reason: ${workflow.blocking_reason}`)
  }

  // Stage-specific checks
  if (workflow.current_stage === 'CPCV_PENDING') {
    issues.push('CPCV awaiting all party signatures')
  }

  if (workflow.current_stage === 'DEED_PENDING') {
    issues.push('DEED awaiting all party signatures')
  }

  if (workflow.current_stage === 'NOTARY_PENDING') {
    issues.push('Awaiting notary confirmation')
  }

  if (!workflow.notary_confirmed_at && workflow.current_stage !== 'COMPLETE') {
    const cpcvSigned = workflow.cpcv_signed_at !== null
    const deedSigned = workflow.deed_signed_at !== null
    if (!cpcvSigned || !deedSigned) {
      if (!cpcvSigned) issues.push('Notary submission blocked: CPCV not signed')
      if (!deedSigned) issues.push('Notary submission blocked: DEED not signed')
    }
  }

  return issues
}
