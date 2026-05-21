// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — Transaction Pipeline
// lib/capital/transactionPipeline.ts
//
// Orchestrates the full capital execution flow:
// computeLiquidityGrade → createEscrowEntry → createSettlementRecord → INSERT capital_transactions
//
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { computeLiquidityGrade } from '@/lib/liquidity/liquidityEngine'
import { createEscrowEntry } from '@/lib/capital/escrowLayer'
import { createSettlementRecord } from '@/lib/capital/settlementTracker'
import { randomUUID } from 'crypto'

// ─── Types ────────────────────────────────────────────────────────────────────

export type TransactionStatus =
  | 'initiated'
  | 'escrow_created'
  | 'settlement_tracking'
  | 'completed'
  | 'failed'
  | 'cancelled'

export interface CapitalTransaction {
  id:                   string
  tenant_id:            string
  property_id:          string
  investor_id:          string
  amount_eur:           number
  status:               TransactionStatus
  escrow_id:            string | null
  settlement_id:        string | null
  liquidity_grade:      string | null
  probability_of_close: number | null
  initiated_at:         string
  completed_at:         string | null
  failure_reason:       string | null
  metadata:             Record<string, unknown>
}

// ─── Internal row shape ───────────────────────────────────────────────────────

interface TransactionRow {
  id:                   string
  tenant_id:            string
  property_id:          string
  investor_id:          string
  amount_eur:           number
  status:               string
  escrow_id:            string | null
  settlement_id:        string | null
  liquidity_grade:      string | null
  probability_of_close: number | null
  initiated_at:         string
  completed_at:         string | null
  failure_reason:       string | null
  metadata:             Record<string, unknown>
}

// ─── rowToTransaction ─────────────────────────────────────────────────────────

function rowToTransaction(row: TransactionRow): CapitalTransaction {
  return {
    id:                   row.id,
    tenant_id:            row.tenant_id,
    property_id:          row.property_id,
    investor_id:          row.investor_id,
    amount_eur:           row.amount_eur,
    status:               row.status as TransactionStatus,
    escrow_id:            row.escrow_id,
    settlement_id:        row.settlement_id,
    liquidity_grade:      row.liquidity_grade,
    probability_of_close: row.probability_of_close,
    initiated_at:         row.initiated_at,
    completed_at:         row.completed_at,
    failure_reason:       row.failure_reason,
    metadata:             row.metadata ?? {},
  }
}

// ─── initiateCapitalExecution ─────────────────────────────────────────────────

export async function initiateCapitalExecution(
  tenantId: string,
  params: {
    property_id:       string
    investor_id:       string
    amount_eur:        number
    escrow_provider?:  'manual' | 'stripe_escrow' | 'bank_transfer'
    target_close_date?: string
    notes?:            string
  },
): Promise<CapitalTransaction> {
  const db            = supabaseAdmin as any
  const transactionId = randomUUID()

  // Step 1: Compute liquidity grade
  const assessment = await computeLiquidityGrade(tenantId, params.property_id, params.amount_eur)

  // Step 2: Create escrow entry
  const escrow = await createEscrowEntry(tenantId, {
    transaction_id: transactionId,
    property_id:    params.property_id,
    investor_id:    params.investor_id,
    amount_eur:     params.amount_eur,
    provider:       params.escrow_provider,
    notes:          params.notes,
  })

  // Step 3: Create settlement record
  const settlement = await createSettlementRecord(tenantId, {
    transaction_id:    transactionId,
    property_id:       params.property_id,
    investor_id:       params.investor_id,
    amount_eur:        params.amount_eur,
    target_close_date: params.target_close_date,
  })

  // Step 4: Insert capital_transactions record
  const { data, error } = await (db
    .from('capital_transactions')
    .insert({
      id:                   transactionId,
      tenant_id:            tenantId,
      property_id:          params.property_id,
      investor_id:          params.investor_id,
      amount_eur:           params.amount_eur,
      status:               'settlement_tracking' as TransactionStatus,
      escrow_id:            escrow.id,
      settlement_id:        settlement.id,
      liquidity_grade:      assessment.grade,
      probability_of_close: assessment.probability_of_close,
      metadata:             {
        liquidity_score:          assessment.score,
        time_to_execution_days:   assessment.time_to_execution_days,
        capital_absorption_rate:  assessment.capital_absorption_rate,
      },
    })
    .select()
    .single() as Promise<{ data: TransactionRow | null; error: { message: string } | null }>)

  if (error || !data) {
    const msg = error?.message ?? 'no data returned'
    log.warn('[transactionPipeline] initiateCapitalExecution insert failed', {
      transaction_id: transactionId,
      error:          msg,
    })
    throw new Error(`initiateCapitalExecution failed: ${msg}`)
  }

  log.info('[transactionPipeline] initiated', {
    id:              transactionId,
    property_id:     params.property_id,
    investor_id:     params.investor_id,
    amount_eur:      params.amount_eur,
    liquidity_grade: assessment.grade,
  })

  return rowToTransaction(data)
}

// ─── getTransaction ───────────────────────────────────────────────────────────

export async function getTransaction(
  tenantId: string,
  transactionId: string,
): Promise<CapitalTransaction | null> {
  const db = supabaseAdmin as any

  const { data, error } = await (db
    .from('capital_transactions')
    .select('*')
    .eq('id', transactionId)
    .eq('tenant_id', tenantId)
    .single() as Promise<{ data: TransactionRow | null; error: { message: string } | null }>)

  if (error || !data) return null
  return rowToTransaction(data)
}

// ─── getTransactionsByProperty ────────────────────────────────────────────────

export async function getTransactionsByProperty(
  tenantId: string,
  propertyId: string,
): Promise<CapitalTransaction[]> {
  const db = supabaseAdmin as any

  const { data, error } = await (db
    .from('capital_transactions')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('property_id', propertyId)
    .order('initiated_at', { ascending: false }) as Promise<{ data: TransactionRow[] | null; error: { message: string } | null }>)

  if (error) {
    log.warn('[transactionPipeline] getTransactionsByProperty failed', { error: error.message })
    return []
  }

  return (data ?? []).map(rowToTransaction)
}

// ─── updateTransactionStatus ──────────────────────────────────────────────────

export async function updateTransactionStatus(
  tenantId: string,
  transactionId: string,
  status: TransactionStatus,
  reason?: string,
): Promise<void> {
  const db  = supabaseAdmin as any
  const now = new Date().toISOString()

  const patch: Record<string, unknown> = { status }
  if (reason)                          patch.failure_reason = reason
  if (status === 'completed')          patch.completed_at   = now

  const { error } = await (db
    .from('capital_transactions')
    .update(patch)
    .eq('id', transactionId)
    .eq('tenant_id', tenantId) as Promise<{ error: { message: string } | null }>)

  if (error) {
    log.warn('[transactionPipeline] updateTransactionStatus failed', {
      transaction_id: transactionId,
      status,
      error: error.message,
    })
    throw new Error(`updateTransactionStatus failed: ${error.message}`)
  }

  log.info('[transactionPipeline] status updated', { id: transactionId, status })
}
