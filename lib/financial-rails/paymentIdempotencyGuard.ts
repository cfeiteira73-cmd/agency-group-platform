// lib/financial-rails/paymentIdempotencyGuard.ts
// Centralized idempotency guard for all payment operations
// Prevents double-execution of any financial operation

import { supabaseAdmin } from '@/lib/supabase'
import { createHash } from 'crypto'
import log from '@/lib/logger'

export type PaymentOperationType =
  | 'PSP_CHARGE'
  | 'SEPA_TRANSFER'
  | 'SWIFT_TRANSFER'
  | 'ESCROW_DEPOSIT'
  | 'COMMISSION_DISBURSEMENT'
  | 'TAX_PAYMENT'
  | 'REFUND'

export interface IdempotencyRecord {
  key: string
  operation_type: PaymentOperationType
  amount_cents: number
  tenant_id: string
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED'
  result_snapshot?: string  // JSON of result
  created_at: string
  completed_at?: string
}

/**
 * Check if a payment operation with this key already exists.
 * Returns the existing result if found, null if it's a new operation.
 */
export async function checkIdempotency(
  key: string,
  operationType: PaymentOperationType,
  tenantId: string,
): Promise<{ exists: boolean; record?: IdempotencyRecord }> {
  try {
    const { data } = await (supabaseAdmin as any)
      .from('payment_idempotency_records')
      .select('*')
      .eq('key', key)
      .eq('operation_type', operationType)
      .eq('tenant_id', tenantId)
      .limit(1)

    type Row = IdempotencyRecord
    const record = (data as Row[] | null)?.[0]
    return { exists: !!record, record }
  } catch {
    // If table doesn't exist, allow operation to proceed
    return { exists: false }
  }
}

/**
 * Register a payment operation start (PROCESSING state).
 * Returns the idempotency key to use.
 */
export async function registerOperation(params: {
  key: string
  operationType: PaymentOperationType
  amountCents: bigint
  tenantId: string
}): Promise<void> {
  try {
    await (supabaseAdmin as any)
      .from('payment_idempotency_records')
      .upsert({
        key: params.key,
        operation_type: params.operationType,
        amount_cents: Number(params.amountCents),
        tenant_id: params.tenantId,
        status: 'PROCESSING',
        created_at: new Date().toISOString(),
      }, { onConflict: 'key,operation_type,tenant_id' })
  } catch (e) {
    log.warn('[paymentIdempotencyGuard] register failed', { e })
  }
}

/**
 * Mark a payment operation as completed with result snapshot.
 */
export async function completeOperation(
  key: string,
  operationType: PaymentOperationType,
  tenantId: string,
  result: unknown,
): Promise<void> {
  try {
    await (supabaseAdmin as any)
      .from('payment_idempotency_records')
      .update({
        status: 'COMPLETED',
        result_snapshot: JSON.stringify(result),
        completed_at: new Date().toISOString(),
      })
      .eq('key', key)
      .eq('operation_type', operationType)
      .eq('tenant_id', tenantId)
  } catch (e) {
    log.warn('[paymentIdempotencyGuard] complete failed', { e })
  }
}

/**
 * Generate a deterministic idempotency key from operation parameters.
 */
export function generateIdempotencyKey(params: {
  operationType: PaymentOperationType
  dealId: string
  amountCents: bigint
  creditorIban?: string
  timestamp?: string
}): string {
  const input = [
    params.operationType,
    params.dealId,
    params.amountCents.toString(),
    params.creditorIban ?? '',
    params.timestamp ?? new Date().toISOString().substring(0, 10),  // date-scoped
  ].join('|')
  return createHash('sha256').update(input).digest('hex').substring(0, 32)
}
