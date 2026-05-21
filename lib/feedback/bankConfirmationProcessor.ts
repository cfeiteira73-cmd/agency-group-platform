// Agency Group — Bank Confirmation Processor
// lib/feedback/bankConfirmationProcessor.ts
// TypeScript strict — 0 errors
//
// Processes bank payment confirmations, updates escrow entries and advances
// settlement stages. Uses direct DB updates to avoid circular dependencies
// with the capital layer.

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BankConfirmation {
  id: string
  tenant_id: string
  reference_code: string
  amount_eur: number
  confirmed_at: string
  bank_reference: string
  status: 'confirmed' | 'rejected' | 'pending_review'
  notes: string | null
}

interface EscrowEntry {
  id: string
  tenant_id: string
  reference_code: string
  transaction_id: string | null
  status: string
  amount_eur: number
}

// ---------------------------------------------------------------------------
// processBankConfirmation
// ---------------------------------------------------------------------------

export async function processBankConfirmation(
  tenantId: string,
  confirmation: Omit<BankConfirmation, 'id' | 'tenant_id'>
): Promise<{
  confirmation: BankConfirmation
  escrow_updated: boolean
  settlement_advanced: boolean
}> {
  let escrow_updated = false
  let settlement_advanced = false

  // 1. Find escrow entry by reference_code
  const { data: escrow, error: escrowErr } = await (supabaseAdmin as any)
    .from('escrow_entries')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('reference_code', confirmation.reference_code)
    .single()

  if (escrowErr) {
    log.warn('[bankConfirmationProcessor] escrow lookup failed', {
      tenant_id: tenantId,
      reference_code: confirmation.reference_code,
      error: escrowErr,
    })
  }

  const escrowEntry = escrow as EscrowEntry | null

  // 2. If found and confirmation is 'confirmed', update escrow to 'funded'
  if (escrowEntry && confirmation.status === 'confirmed') {
    void (supabaseAdmin as any)
      .from('escrow_entries')
      .update({ status: 'funded', updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('id', escrowEntry.id)
      .then(({ error }: { error: unknown }) => {
        if (error) {
          log.warn('[bankConfirmationProcessor] escrow update failed', {
            tenant_id: tenantId,
            escrow_id: escrowEntry.id,
            error,
          })
        }
      })

    escrow_updated = true

    // 3. Advance settlement to 'capital_locked' via direct DB update
    if (escrowEntry.transaction_id) {
      void (supabaseAdmin as any)
        .from('settlement_records')
        .update({ stage: 'capital_locked', updated_at: new Date().toISOString() })
        .eq('tenant_id', tenantId)
        .eq('transaction_id', escrowEntry.transaction_id)
        .then(({ error }: { error: unknown }) => {
          if (error) {
            log.warn('[bankConfirmationProcessor] settlement advance failed', {
              tenant_id: tenantId,
              transaction_id: escrowEntry.transaction_id,
              error,
            })
          }
        })

      settlement_advanced = true
    }
  }

  // 4. INSERT to bank_confirmations table
  const row = {
    tenant_id: tenantId,
    reference_code: confirmation.reference_code,
    amount_eur: confirmation.amount_eur,
    confirmed_at: confirmation.confirmed_at,
    bank_reference: confirmation.bank_reference,
    status: confirmation.status,
    notes: confirmation.notes,
  }

  const { data: inserted, error: insertErr } = await (supabaseAdmin as any)
    .from('bank_confirmations')
    .insert(row)
    .select()
    .single()

  if (insertErr) {
    log.error('[bankConfirmationProcessor] insert failed', insertErr as Error, {
      tenant_id: tenantId,
      reference_code: confirmation.reference_code,
    })
    throw insertErr
  }

  log.info('[bankConfirmationProcessor] processed', {
    tenant_id: tenantId,
    id: inserted.id,
    reference_code: confirmation.reference_code,
    status: confirmation.status,
    escrow_updated,
    settlement_advanced,
  })

  return {
    confirmation: inserted as BankConfirmation,
    escrow_updated,
    settlement_advanced,
  }
}

// ---------------------------------------------------------------------------
// getBankConfirmations
// ---------------------------------------------------------------------------

export async function getBankConfirmations(
  tenantId: string,
  referenceCode?: string
): Promise<BankConfirmation[]> {
  let query = (supabaseAdmin as any)
    .from('bank_confirmations')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('confirmed_at', { ascending: false })
    .limit(200)

  if (referenceCode) {
    query = query.eq('reference_code', referenceCode)
  }

  const { data, error } = await query

  if (error) {
    log.warn('[bankConfirmationProcessor] getBankConfirmations failed', {
      tenant_id: tenantId,
      error,
    })
    return []
  }

  return (data ?? []) as BankConfirmation[]
}
