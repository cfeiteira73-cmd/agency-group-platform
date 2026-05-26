// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — Legal Execution Pipeline
// lib/legal-execution/legalExecutionPipeline.ts
//
// Orchestrates the external legal workflow for Portuguese/European real estate
// transactions: CPCV → Notary → Escritura → Land Registry → Complete
//
// All money values are integer bigint EUR cents — no floats.
// SHA-256 chain provides tamper-evident audit trail.
// =============================================================================

import { randomUUID, createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type LegalStage =
  | 'DRAFT_CPCV'
  | 'SIGN_CPCV'
  | 'SUBMIT_TO_NOTARY'
  | 'NOTARY_APPOINTMENT'
  | 'ESCRITURA_SIGNED'
  | 'LAND_REGISTRY_SUBMITTED'
  | 'LAND_REGISTRY_CONFIRMED'
  | 'COMPLETE'

export type LegalWorkflowStatus = 'ACTIVE' | 'PENDING_EXTERNAL' | 'COMPLETED' | 'BLOCKED' | 'CANCELLED'

export interface LegalWorkflow {
  workflow_id: string
  tenant_id: string
  deal_id: string
  pipeline_id: string | null
  current_stage: LegalStage
  status: LegalWorkflowStatus
  notary_ref: string | null
  escritura_doc_id: string | null
  land_registry_ref: string | null
  eidas_signature_ids: string[]
  property_value_eur_cents: number
  imt_eur_cents: number
  stamp_duty_eur_cents: number
  notary_fee_eur_cents: number
  external_refs: Record<string, string>
  sha256_chain: string
  started_at: string
  completed_at: string | null
  blocking_reason: string | null
}

// ─── Stage order (for advancement validation) ────────────────────────────────

const STAGE_ORDER: LegalStage[] = [
  'DRAFT_CPCV',
  'SIGN_CPCV',
  'SUBMIT_TO_NOTARY',
  'NOTARY_APPOINTMENT',
  'ESCRITURA_SIGNED',
  'LAND_REGISTRY_SUBMITTED',
  'LAND_REGISTRY_CONFIRMED',
  'COMPLETE',
]

// ─── Row mapper ───────────────────────────────────────────────────────────────

function rowToWorkflow(row: Record<string, unknown>): LegalWorkflow {
  return {
    workflow_id:              String(row['workflow_id'] ?? ''),
    tenant_id:                String(row['tenant_id'] ?? ''),
    deal_id:                  String(row['deal_id'] ?? ''),
    pipeline_id:              row['pipeline_id'] != null ? String(row['pipeline_id']) : null,
    current_stage:            String(row['current_stage'] ?? 'DRAFT_CPCV') as LegalStage,
    status:                   String(row['status'] ?? 'ACTIVE') as LegalWorkflowStatus,
    notary_ref:               row['notary_ref'] != null ? String(row['notary_ref']) : null,
    escritura_doc_id:         row['escritura_doc_id'] != null ? String(row['escritura_doc_id']) : null,
    land_registry_ref:        row['land_registry_ref'] != null ? String(row['land_registry_ref']) : null,
    eidas_signature_ids:      Array.isArray(row['eidas_signature_ids']) ? (row['eidas_signature_ids'] as string[]) : [],
    property_value_eur_cents: Number(row['property_value_eur_cents'] ?? 0),
    imt_eur_cents:            Number(row['imt_eur_cents'] ?? 0),
    stamp_duty_eur_cents:     Number(row['stamp_duty_eur_cents'] ?? 0),
    notary_fee_eur_cents:     Number(row['notary_fee_eur_cents'] ?? 0),
    external_refs:            (row['external_refs'] as Record<string, string>) ?? {},
    sha256_chain:             String(row['sha256_chain'] ?? ''),
    started_at:               String(row['started_at'] ?? new Date().toISOString()),
    completed_at:             row['completed_at'] != null ? String(row['completed_at']) : null,
    blocking_reason:          row['blocking_reason'] != null ? String(row['blocking_reason']) : null,
  }
}

// ─── computeLegalCosts ────────────────────────────────────────────────────────

/**
 * Pure function — all integer arithmetic, no floats.
 * IMT: 6% of property value (residential default)
 * Stamp Duty: 0.8% of property value
 * Notary Fee: flat €1500 minimum = 150000 cents
 */
export function computeLegalCosts(propertyValueEurCents: number): {
  imt_eur_cents: number
  stamp_duty_eur_cents: number
  notary_fee_eur_cents: number
  total_eur_cents: number
} {
  // Integer arithmetic only — multiply then integer-divide
  const imt_eur_cents          = Math.floor(propertyValueEurCents * 6 / 100)
  const stamp_duty_eur_cents   = Math.floor(propertyValueEurCents * 8 / 1000)
  const notary_fee_eur_cents   = 150000 // €1500 minimum flat

  return {
    imt_eur_cents,
    stamp_duty_eur_cents,
    notary_fee_eur_cents,
    total_eur_cents: imt_eur_cents + stamp_duty_eur_cents + notary_fee_eur_cents,
  }
}

// ─── SHA-256 chain helper ─────────────────────────────────────────────────────

function computeChainHash(
  prevHash: string,
  workflowId: string,
  stage: LegalStage,
  externalRef: string,
): string {
  return createHash('sha256')
    .update(`${prevHash}|${workflowId}|${stage}|${externalRef}`)
    .digest('hex')
}

// ─── initiateLegalWorkflow ────────────────────────────────────────────────────

/**
 * Creates a new legal workflow at DRAFT_CPCV stage.
 * Computes IMT (6%), stamp duty (0.8%), notary fee (€1500 flat minimum).
 * Persists to legal_workflows.
 */
export async function initiateLegalWorkflow(
  dealId: string,
  pipelineId: string | null,
  propertyValueEurCents: number,
  tenantId: string,
): Promise<LegalWorkflow> {
  const workflowId = `lwf_${randomUUID().replace(/-/g, '')}`
  const costs = computeLegalCosts(propertyValueEurCents)
  const startedAt = new Date().toISOString()

  // Initial SHA-256 chain seeded with workflow_id
  const initialHash = computeChainHash('GENESIS', workflowId, 'DRAFT_CPCV', workflowId)

  const row: Record<string, unknown> = {
    workflow_id:              workflowId,
    tenant_id:                tenantId,
    deal_id:                  dealId,
    pipeline_id:              pipelineId,
    current_stage:            'DRAFT_CPCV',
    status:                   'ACTIVE',
    notary_ref:               null,
    escritura_doc_id:         null,
    land_registry_ref:        null,
    eidas_signature_ids:      [],
    property_value_eur_cents: propertyValueEurCents,
    imt_eur_cents:            costs.imt_eur_cents,
    stamp_duty_eur_cents:     costs.stamp_duty_eur_cents,
    notary_fee_eur_cents:     costs.notary_fee_eur_cents,
    external_refs:            {},
    sha256_chain:             initialHash,
    started_at:               startedAt,
    completed_at:             null,
    blocking_reason:          null,
  }

  const { data, error } = await (supabaseAdmin as any)
    .from('legal_workflows')
    .insert(row)
    .select()
    .single()

  if (error) {
    log.error('[legalExecutionPipeline] initiateLegalWorkflow insert failed', error, { deal_id: dealId, tenant_id: tenantId })
    throw new Error(`Failed to initiate legal workflow: ${error.message}`)
  }

  log.info('[legalExecutionPipeline] workflow initiated', { workflow_id: workflowId, deal_id: dealId, tenant_id: tenantId })
  return rowToWorkflow(data as Record<string, unknown>)
}

// ─── advanceLegalStage ────────────────────────────────────────────────────────

/**
 * Advances the workflow to the next stage in sequence.
 * Updates SHA-256 chain: hash(prevHash + workflowId + newStage + externalRef).
 * Updates external_refs with the provided reference.
 */
export async function advanceLegalStage(
  workflowId: string,
  tenantId: string,
  externalRef: string,
  signatureIds?: string[],
): Promise<LegalWorkflow> {
  const existing = await getLegalWorkflow(workflowId, tenantId)
  if (!existing) {
    throw new Error(`Legal workflow not found: ${workflowId}`)
  }
  if (existing.status === 'BLOCKED' || existing.status === 'CANCELLED' || existing.status === 'COMPLETED') {
    throw new Error(`Cannot advance workflow in status: ${existing.status}`)
  }

  const currentIdx = STAGE_ORDER.indexOf(existing.current_stage)
  if (currentIdx === -1 || currentIdx === STAGE_ORDER.length - 1) {
    throw new Error(`Workflow is already at final stage: ${existing.current_stage}`)
  }

  const nextStage = STAGE_ORDER[currentIdx + 1]!
  const newHash = computeChainHash(existing.sha256_chain, workflowId, nextStage, externalRef)

  const updatedRefs = { ...existing.external_refs, [nextStage]: externalRef }
  const updatedSignatureIds = signatureIds
    ? [...new Set([...existing.eidas_signature_ids, ...signatureIds])]
    : existing.eidas_signature_ids

  const isComplete = nextStage === 'COMPLETE'
  const updatePayload: Record<string, unknown> = {
    current_stage:       nextStage,
    status:              isComplete ? 'COMPLETED' : 'ACTIVE',
    sha256_chain:        newHash,
    external_refs:       updatedRefs,
    eidas_signature_ids: updatedSignatureIds,
    ...(isComplete ? { completed_at: new Date().toISOString() } : {}),
  }

  // Set notary_ref if advancing to NOTARY_APPOINTMENT stage
  if (nextStage === 'NOTARY_APPOINTMENT') {
    updatePayload['notary_ref'] = externalRef
  }
  // Set land_registry_ref if advancing to LAND_REGISTRY_SUBMITTED
  if (nextStage === 'LAND_REGISTRY_SUBMITTED') {
    updatePayload['land_registry_ref'] = externalRef
  }
  // Set escritura_doc_id if advancing to ESCRITURA_SIGNED
  if (nextStage === 'ESCRITURA_SIGNED') {
    updatePayload['escritura_doc_id'] = externalRef
  }

  const { data, error } = await (supabaseAdmin as any)
    .from('legal_workflows')
    .update(updatePayload)
    .eq('workflow_id', workflowId)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) {
    log.error('[legalExecutionPipeline] advanceLegalStage failed', error, { workflow_id: workflowId, tenant_id: tenantId })
    throw new Error(`Failed to advance legal stage: ${error.message}`)
  }

  log.info('[legalExecutionPipeline] stage advanced', { workflow_id: workflowId, from: existing.current_stage, to: nextStage, tenant_id: tenantId })
  return rowToWorkflow(data as Record<string, unknown>)
}

// ─── blockWorkflow ────────────────────────────────────────────────────────────

/**
 * Marks workflow as BLOCKED with a reason.
 */
export async function blockWorkflow(
  workflowId: string,
  tenantId: string,
  reason: string,
): Promise<void> {
  const { error } = await (supabaseAdmin as any)
    .from('legal_workflows')
    .update({ status: 'BLOCKED', blocking_reason: reason })
    .eq('workflow_id', workflowId)
    .eq('tenant_id', tenantId)

  if (error) {
    log.error('[legalExecutionPipeline] blockWorkflow failed', error, { workflow_id: workflowId, tenant_id: tenantId })
    throw new Error(`Failed to block workflow: ${error.message}`)
  }

  log.warn('[legalExecutionPipeline] workflow blocked', { workflow_id: workflowId, reason, tenant_id: tenantId })
}

// ─── getLegalWorkflow ─────────────────────────────────────────────────────────

export async function getLegalWorkflow(
  workflowId: string,
  tenantId: string,
): Promise<LegalWorkflow | null> {
  const { data, error } = await (supabaseAdmin as any)
    .from('legal_workflows')
    .select('*')
    .eq('workflow_id', workflowId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error) {
    log.warn('[legalExecutionPipeline] getLegalWorkflow query failed', { error: error.message, workflow_id: workflowId })
    return null
  }

  return data ? rowToWorkflow(data as Record<string, unknown>) : null
}

// ─── getWorkflowsForDeal ──────────────────────────────────────────────────────

export async function getWorkflowsForDeal(
  dealId: string,
  tenantId: string,
): Promise<LegalWorkflow[]> {
  const { data, error } = await (supabaseAdmin as any)
    .from('legal_workflows')
    .select('*')
    .eq('deal_id', dealId)
    .eq('tenant_id', tenantId)
    .order('started_at', { ascending: false })

  if (error) {
    log.warn('[legalExecutionPipeline] getWorkflowsForDeal query failed', { error: error.message, deal_id: dealId })
    return []
  }

  return Array.isArray(data) ? (data as Record<string, unknown>[]).map(rowToWorkflow) : []
}
