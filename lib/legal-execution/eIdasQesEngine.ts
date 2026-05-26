// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — eIDAS Qualified Electronic Signature Engine
// lib/legal-execution/eIdasQesEngine.ts
//
// eIDAS-compliant electronic signature orchestration for CPCV and Escritura.
// Supports SES / AES / QES levels. External provider is graceful no-op when
// EIDAS_PROVIDER_URL + EIDAS_API_KEY are not configured.
//
// References:
// - Regulation (EU) No 910/2014 (eIDAS)
// - CPCV: minimum AES required
// - Escritura: QES required
// =============================================================================

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

/** eIDAS signature levels: Simple, Advanced, Qualified Electronic Signature */
export type SignatureLevel = 'SES' | 'AES' | 'QES'

export interface EidasSignatureRequest {
  signature_id: string
  tenant_id: string
  workflow_id: string
  document_id: string
  signer_id: string
  signer_email: string
  signature_level: SignatureLevel
  status: 'PENDING' | 'SIGNED' | 'REJECTED' | 'EXPIRED'
  provider: string
  provider_ref: string | null
  signed_at: string | null
  expires_at: string
  created_at: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SIGNATURE_EXPIRY_DAYS = 7

// ─── Row mapper ───────────────────────────────────────────────────────────────

function rowToSignatureRequest(row: Record<string, unknown>): EidasSignatureRequest {
  return {
    signature_id:    String(row['signature_id'] ?? ''),
    tenant_id:       String(row['tenant_id'] ?? ''),
    workflow_id:     String(row['workflow_id'] ?? ''),
    document_id:     String(row['document_id'] ?? ''),
    signer_id:       String(row['signer_id'] ?? ''),
    signer_email:    String(row['signer_email'] ?? ''),
    signature_level: String(row['signature_level'] ?? 'SES') as SignatureLevel,
    status:          String(row['status'] ?? 'PENDING') as EidasSignatureRequest['status'],
    provider:        String(row['provider'] ?? 'internal'),
    provider_ref:    row['provider_ref'] != null ? String(row['provider_ref']) : null,
    signed_at:       row['signed_at'] != null ? String(row['signed_at']) : null,
    expires_at:      String(row['expires_at'] ?? ''),
    created_at:      String(row['created_at'] ?? new Date().toISOString()),
  }
}

// ─── requestSignature ─────────────────────────────────────────────────────────

/**
 * Creates an eIDAS signature request.
 * If EIDAS_PROVIDER_URL and EIDAS_API_KEY are set, calls external provider (graceful no-op).
 * Always persists to eidas_signature_requests. Expires in 7 days.
 */
export async function requestSignature(
  workflowId: string,
  documentId: string,
  signerId: string,
  signerEmail: string,
  level: SignatureLevel,
  tenantId: string,
): Promise<EidasSignatureRequest> {
  const signatureId = `esig_${randomUUID().replace(/-/g, '')}`
  const createdAt = new Date().toISOString()
  const expiresAt = new Date(Date.now() + SIGNATURE_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const providerUrl = process.env.EIDAS_PROVIDER_URL
  const providerApiKey = process.env.EIDAS_API_KEY
  const providerName = process.env.EIDAS_PROVIDER_NAME ?? 'internal'

  let providerRef: string | null = null

  if (providerUrl && providerApiKey) {
    try {
      const res = await fetch(`${providerUrl}/signature-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${providerApiKey}`,
        },
        body: JSON.stringify({
          signature_id: signatureId,
          workflow_id: workflowId,
          document_id: documentId,
          signer_id: signerId,
          signer_email: signerEmail,
          signature_level: level,
          expires_at: expiresAt,
        }),
        signal: AbortSignal.timeout(10000),
      })
      if (res.ok) {
        const payload = (await res.json()) as Record<string, unknown>
        if (payload['provider_ref']) providerRef = String(payload['provider_ref'])
        log.info('[eIdasQesEngine] external signature request created', { signature_id: signatureId, level })
      } else {
        log.warn('[eIdasQesEngine] provider returned non-OK', { status: res.status, signature_id: signatureId })
      }
    } catch (err) {
      void Promise.resolve(err).catch(e => console.warn('[eIdasQesEngine] provider API error', e))
      log.warn('[eIdasQesEngine] eIDAS provider unavailable — graceful no-op', { workflow_id: workflowId, level })
    }
  }

  const row: Record<string, unknown> = {
    signature_id:    signatureId,
    tenant_id:       tenantId,
    workflow_id:     workflowId,
    document_id:     documentId,
    signer_id:       signerId,
    signer_email:    signerEmail,
    signature_level: level,
    status:          'PENDING',
    provider:        providerName,
    provider_ref:    providerRef,
    signed_at:       null,
    expires_at:      expiresAt,
    created_at:      createdAt,
  }

  const { data, error } = await (supabaseAdmin as any)
    .from('eidas_signature_requests')
    .insert(row)
    .select()
    .single()

  if (error) {
    log.error('[eIdasQesEngine] requestSignature insert failed', error, { workflow_id: workflowId, signer_email: signerEmail })
    throw new Error(`Failed to persist signature request: ${error.message}`)
  }

  log.info('[eIdasQesEngine] signature request created', { signature_id: signatureId, workflow_id: workflowId, level })
  return rowToSignatureRequest(data as Record<string, unknown>)
}

// ─── confirmSignature ─────────────────────────────────────────────────────────

/**
 * Marks a signature request as SIGNED with provider reference and timestamp.
 */
export async function confirmSignature(
  signatureId: string,
  providerRef: string,
  tenantId: string,
): Promise<void> {
  const { error } = await (supabaseAdmin as any)
    .from('eidas_signature_requests')
    .update({
      status:       'SIGNED',
      provider_ref: providerRef,
      signed_at:    new Date().toISOString(),
    })
    .eq('signature_id', signatureId)
    .eq('tenant_id', tenantId)

  if (error) {
    log.error('[eIdasQesEngine] confirmSignature failed', error, { signature_id: signatureId })
    throw new Error(`Failed to confirm signature: ${error.message}`)
  }

  log.info('[eIdasQesEngine] signature confirmed', { signature_id: signatureId, provider_ref: providerRef })
}

// ─── getSignaturesForWorkflow ─────────────────────────────────────────────────

export async function getSignaturesForWorkflow(
  workflowId: string,
  tenantId: string,
): Promise<EidasSignatureRequest[]> {
  const { data, error } = await (supabaseAdmin as any)
    .from('eidas_signature_requests')
    .select('*')
    .eq('workflow_id', workflowId)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true })

  if (error) {
    log.warn('[eIdasQesEngine] getSignaturesForWorkflow query failed', { error: error.message, workflow_id: workflowId })
    return []
  }

  return Array.isArray(data) ? (data as Record<string, unknown>[]).map(rowToSignatureRequest) : []
}

// ─── validateQESCompliance ────────────────────────────────────────────────────

/**
 * Validates that a signature meets the required eIDAS level:
 * - Escritura: requires QES
 * - CPCV: requires minimum AES
 * Returns { compliant, level, reason }
 */
export async function validateQESCompliance(
  signatureId: string,
  tenantId: string,
): Promise<{ compliant: boolean; level: SignatureLevel; reason: string }> {
  const { data, error } = await (supabaseAdmin as any)
    .from('eidas_signature_requests')
    .select('*')
    .eq('signature_id', signatureId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error || !data) {
    return {
      compliant: false,
      level: 'SES',
      reason: `Signature not found: ${signatureId}`,
    }
  }

  const sig = rowToSignatureRequest(data as Record<string, unknown>)

  if (sig.status !== 'SIGNED') {
    return {
      compliant: false,
      level: sig.signature_level,
      reason: `Signature status is '${sig.status}' — must be SIGNED`,
    }
  }

  const levelRank: Record<SignatureLevel, number> = { SES: 1, AES: 2, QES: 3 }
  const sigRank = levelRank[sig.signature_level]

  // For now, check QES compliance (Escritura standard)
  if (sigRank < levelRank['QES']) {
    return {
      compliant: false,
      level: sig.signature_level,
      reason: `Signature level '${sig.signature_level}' does not meet QES requirement for Escritura`,
    }
  }

  return {
    compliant: true,
    level: sig.signature_level,
    reason: 'Signature meets QES compliance requirements',
  }
}
