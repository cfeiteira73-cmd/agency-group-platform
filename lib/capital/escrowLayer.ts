// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — Escrow Abstraction Layer
// lib/capital/escrowLayer.ts
//
// Pluggable escrow state tracker. Does NOT execute real financial transactions.
// Tracks escrow lifecycle: pending → funded → locked → released / refunded / disputed.
//
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type EscrowProvider = 'manual' | 'stripe_escrow' | 'bank_transfer'
export type EscrowStatus   = 'pending' | 'funded' | 'locked' | 'released' | 'refunded' | 'disputed'

export interface EscrowEntry {
  id:             string
  tenant_id:      string
  transaction_id: string
  property_id:    string
  investor_id:    string
  amount_eur:     number
  provider:       EscrowProvider
  status:         EscrowStatus
  reference_code: string
  funded_at:      string | null
  locked_at:      string | null
  released_at:    string | null
  notes:          string | null
  created_at:     string
}

// ─── Internal row shape ───────────────────────────────────────────────────────

interface EscrowRow {
  id:             string
  tenant_id:      string
  transaction_id: string
  property_id:    string
  investor_id:    string
  amount_eur:     number
  provider:       string
  status:         string
  reference_code: string
  funded_at:      string | null
  locked_at:      string | null
  released_at:    string | null
  notes:          string | null
  created_at:     string
}

// ─── generateReferenceCode ────────────────────────────────────────────────────

function generateReferenceCode(): string {
  const ts  = Date.now().toString(36).toUpperCase()
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `AGE-${ts}-${rnd}`
}

// ─── rowToEntry ───────────────────────────────────────────────────────────────

function rowToEntry(row: EscrowRow): EscrowEntry {
  return {
    id:             row.id,
    tenant_id:      row.tenant_id,
    transaction_id: row.transaction_id,
    property_id:    row.property_id,
    investor_id:    row.investor_id,
    amount_eur:     row.amount_eur,
    provider:       row.provider as EscrowProvider,
    status:         row.status as EscrowStatus,
    reference_code: row.reference_code,
    funded_at:      row.funded_at,
    locked_at:      row.locked_at,
    released_at:    row.released_at,
    notes:          row.notes,
    created_at:     row.created_at,
  }
}

// ─── createEscrowEntry ────────────────────────────────────────────────────────

export async function createEscrowEntry(
  tenantId: string,
  params: {
    transaction_id: string
    property_id:    string
    investor_id:    string
    amount_eur:     number
    provider?:      EscrowProvider
    notes?:         string
  },
): Promise<EscrowEntry> {
  const db = supabaseAdmin as any

  const reference_code = generateReferenceCode()
  const provider: EscrowProvider = params.provider ?? 'manual'

  const { data, error } = await (db
    .from('escrow_entries')
    .insert({
      tenant_id:      tenantId,
      transaction_id: params.transaction_id,
      property_id:    params.property_id,
      investor_id:    params.investor_id,
      amount_eur:     params.amount_eur,
      provider,
      status:         'pending',
      reference_code,
      notes:          params.notes ?? null,
    })
    .select()
    .single() as Promise<{ data: EscrowRow | null; error: { message: string } | null }>)

  if (error || !data) {
    const msg = error?.message ?? 'no data returned'
    log.warn('[escrowLayer] createEscrowEntry failed', { transaction_id: params.transaction_id, error: msg })
    throw new Error(`createEscrowEntry failed: ${msg}`)
  }

  log.info('[escrowLayer] created', { id: data.id, reference_code, provider })
  return rowToEntry(data)
}

// ─── updateEscrowStatus ───────────────────────────────────────────────────────

export async function updateEscrowStatus(
  tenantId: string,
  escrowId: string,
  status: EscrowStatus,
  notes?: string,
): Promise<EscrowEntry> {
  const db  = supabaseAdmin as any
  const now = new Date().toISOString()

  const patch: Record<string, unknown> = {
    status,
    updated_at: now,
  }
  if (notes !== undefined) patch.notes = notes
  if (status === 'funded')   patch.funded_at   = now
  if (status === 'locked')   patch.locked_at   = now
  if (status === 'released') patch.released_at = now

  const { data, error } = await (db
    .from('escrow_entries')
    .update(patch)
    .eq('id', escrowId)
    .eq('tenant_id', tenantId)
    .select()
    .single() as Promise<{ data: EscrowRow | null; error: { message: string } | null }>)

  if (error || !data) {
    const msg = error?.message ?? 'no data returned'
    log.warn('[escrowLayer] updateEscrowStatus failed', { escrow_id: escrowId, status, error: msg })
    throw new Error(`updateEscrowStatus failed: ${msg}`)
  }

  log.info('[escrowLayer] status updated', { id: escrowId, status })
  return rowToEntry(data)
}

// ─── getEscrowForTransaction ──────────────────────────────────────────────────

export async function getEscrowForTransaction(
  tenantId: string,
  transactionId: string,
): Promise<EscrowEntry | null> {
  const db = supabaseAdmin as any

  const { data, error } = await (db
    .from('escrow_entries')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('transaction_id', transactionId)
    .single() as Promise<{ data: EscrowRow | null; error: { message: string } | null }>)

  if (error || !data) return null
  return rowToEntry(data)
}
