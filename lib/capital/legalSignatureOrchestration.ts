// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — Legal Signature Orchestration
// lib/capital/legalSignatureOrchestration.ts
//
// Tracks legal document signing workflow. When both buyer and seller have
// signed, automatically marks fully_signed and advances linked settlement
// to legal_signed via fire-and-forget.
//
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { advanceSettlementStage } from '@/lib/capital/settlementTracker'

// ─── Types ────────────────────────────────────────────────────────────────────

export type SignatureRequestStatus =
  | 'pending'
  | 'sent'
  | 'signed_buyer'
  | 'signed_seller'
  | 'fully_signed'
  | 'expired'
  | 'cancelled'

export interface SignatureRequest {
  id:               string
  tenant_id:        string
  transaction_id:   string
  document_type:    'cpcv' | 'promissory_contract' | 'deed' | 'power_of_attorney' | 'other'
  status:           SignatureRequestStatus
  buyer_signed_at:  string | null
  seller_signed_at: string | null
  fully_signed_at:  string | null
  expires_at:       string
  notes:            string | null
  created_at:       string
}

// ─── Internal row shape ───────────────────────────────────────────────────────

interface SignatureRow {
  id:               string
  tenant_id:        string
  transaction_id:   string
  document_type:    string
  status:           string
  buyer_signed_at:  string | null
  seller_signed_at: string | null
  fully_signed_at:  string | null
  expires_at:       string
  notes:            string | null
  created_at:       string
}

// ─── rowToRequest ─────────────────────────────────────────────────────────────

function rowToRequest(row: SignatureRow): SignatureRequest {
  return {
    id:               row.id,
    tenant_id:        row.tenant_id,
    transaction_id:   row.transaction_id,
    document_type:    row.document_type as SignatureRequest['document_type'],
    status:           row.status as SignatureRequestStatus,
    buyer_signed_at:  row.buyer_signed_at,
    seller_signed_at: row.seller_signed_at,
    fully_signed_at:  row.fully_signed_at,
    expires_at:       row.expires_at,
    notes:            row.notes,
    created_at:       row.created_at,
  }
}

// ─── createSignatureRequest ───────────────────────────────────────────────────

export async function createSignatureRequest(
  tenantId: string,
  params: {
    transaction_id: string
    document_type:  SignatureRequest['document_type']
    expires_in_days?: number
    notes?:         string
  },
): Promise<SignatureRequest> {
  const db = supabaseAdmin as any

  const expiresInDays = params.expires_in_days ?? 30
  const expiresAt     = new Date(Date.now() + expiresInDays * 86400000).toISOString()

  const { data, error } = await (db
    .from('signature_requests')
    .insert({
      tenant_id:      tenantId,
      transaction_id: params.transaction_id,
      document_type:  params.document_type,
      status:         'pending',
      expires_at:     expiresAt,
      notes:          params.notes ?? null,
    })
    .select()
    .single() as Promise<{ data: SignatureRow | null; error: { message: string } | null }>)

  if (error || !data) {
    const msg = error?.message ?? 'no data returned'
    log.warn('[legalSignature] createSignatureRequest failed', {
      transaction_id: params.transaction_id,
      error:          msg,
    })
    throw new Error(`createSignatureRequest failed: ${msg}`)
  }

  log.info('[legalSignature] created', {
    id:            data.id,
    document_type: params.document_type,
    expires_at:    expiresAt,
  })
  return rowToRequest(data)
}

// ─── recordSignature ──────────────────────────────────────────────────────────

export async function recordSignature(
  tenantId: string,
  requestId: string,
  party: 'buyer' | 'seller',
  notes?: string,
): Promise<SignatureRequest> {
  const db  = supabaseAdmin as any
  const now = new Date().toISOString()

  // Fetch current state
  const { data: current, error: fetchErr } = await (db
    .from('signature_requests')
    .select('*')
    .eq('id', requestId)
    .eq('tenant_id', tenantId)
    .single() as Promise<{ data: SignatureRow | null; error: { message: string } | null }>)

  if (fetchErr || !current) {
    const msg = fetchErr?.message ?? 'not found'
    log.warn('[legalSignature] recordSignature: request not found', { request_id: requestId, error: msg })
    throw new Error(`SignatureRequest not found: ${msg}`)
  }

  const patch: Record<string, unknown> = {}
  if (notes) patch.notes = notes

  if (party === 'buyer') {
    patch.buyer_signed_at = now
  } else {
    patch.seller_signed_at = now
  }

  // Determine if both have now signed
  const buyerSigned  = party === 'buyer'  ? now : current.buyer_signed_at
  const sellerSigned = party === 'seller' ? now : current.seller_signed_at

  if (buyerSigned && sellerSigned) {
    patch.status          = 'fully_signed'
    patch.fully_signed_at = now
  } else {
    patch.status = party === 'buyer' ? 'signed_buyer' : 'signed_seller'
  }

  const { data: updated, error: updateErr } = await (db
    .from('signature_requests')
    .update(patch)
    .eq('id', requestId)
    .eq('tenant_id', tenantId)
    .select()
    .single() as Promise<{ data: SignatureRow | null; error: { message: string } | null }>)

  if (updateErr || !updated) {
    const msg = updateErr?.message ?? 'no data returned'
    log.warn('[legalSignature] recordSignature update failed', { request_id: requestId, error: msg })
    throw new Error(`recordSignature failed: ${msg}`)
  }

  log.info('[legalSignature] signature recorded', { id: requestId, party, status: updated.status })

  // Fire-and-forget: advance settlement to legal_signed when fully signed
  if (updated.status === 'fully_signed') {
    void (async () => {
      try {
        // Find settlement by transaction_id
        const { data: settlementRow } = await (db
          .from('settlement_records')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('transaction_id', updated.transaction_id)
          .single() as Promise<{ data: { id: string } | null; error: unknown }>)

        if (settlementRow?.id) {
          await advanceSettlementStage(
            tenantId,
            settlementRow.id,
            'legal_signed',
            'Auto-advanced: all parties have signed',
          )
        }
      } catch (e) {
        log.warn('[legalSignature] fire-and-forget advanceSettlementStage failed', {
          request_id:     requestId,
          transaction_id: updated.transaction_id,
          error:          e instanceof Error ? e.message : String(e),
        })
      }
    })()
  }

  return rowToRequest(updated)
}

// ─── getSignaturesForTransaction ──────────────────────────────────────────────

export async function getSignaturesForTransaction(
  tenantId: string,
  transactionId: string,
): Promise<SignatureRequest[]> {
  const db = supabaseAdmin as any

  const { data, error } = await (db
    .from('signature_requests')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('transaction_id', transactionId)
    .order('created_at', { ascending: false }) as Promise<{ data: SignatureRow[] | null; error: { message: string } | null }>)

  if (error) {
    log.warn('[legalSignature] getSignaturesForTransaction failed', { error: error.message })
    return []
  }

  return (data ?? []).map(rowToRequest)
}
