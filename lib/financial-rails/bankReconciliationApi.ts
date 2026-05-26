// lib/financial-rails/bankReconciliationApi.ts
// PSD2-compliant bank account reconciliation
// Provider: Salt Edge (https://www.saltedge.com/products/account_information)
// Used for: confirming escrow deposits, verifying outbound payments

import log from '@/lib/logger'
import { supabaseAdmin } from '@/lib/supabase'

export interface BankTransaction {
  external_id: string
  account_id: string
  amount_cents: bigint       // negative for debits
  currency: string
  description: string
  status: 'POSTED' | 'PENDING'
  booking_date: string        // ISO date
  value_date: string
  debtor_name?: string
  debtor_iban?: string
  creditor_name?: string
  creditor_iban?: string
  remittance_info?: string
}

export interface ReconciliationResult {
  account_id: string
  bank_name: string
  transactions_fetched: number
  transactions_matched: number
  transactions_unmatched: number
  total_debits_cents: bigint
  total_credits_cents: bigint
  reconciliation_status: 'BALANCED' | 'IMBALANCED' | 'PENDING'
  run_at: string
}

type NotConfigured = { status: 'NOT_CONFIGURED'; rail: string; reason: string; action_required: string }
type RailError = { status: 'ERROR'; rail: string; error: string }

const SALTEDGE_APP_ID = process.env.SALTEDGE_APP_ID
const SALTEDGE_SECRET = process.env.SALTEDGE_SECRET
const SALTEDGE_BASE_URL = 'https://www.saltedge.com/api/v5'

function notConfigured(): NotConfigured {
  return {
    status: 'NOT_CONFIGURED',
    rail: 'Salt Edge OpenBanking',
    reason: 'SALTEDGE_APP_ID or SALTEDGE_SECRET not set',
    action_required: 'Register at https://www.saltedge.com/products/account_information, complete PSD2 registration, and set SALTEDGE_APP_ID + SALTEDGE_SECRET in Vercel environment',
  }
}

export async function fetchBankTransactions(params: {
  connection_id: string  // Salt Edge connection ID for the bank account
  from_date: string      // ISO date
  to_date: string
  tenant_id: string
}): Promise<BankTransaction[] | NotConfigured | RailError> {
  if (!SALTEDGE_APP_ID || !SALTEDGE_SECRET) return notConfigured()

  try {
    const qs = new URLSearchParams({
      connection_id: params.connection_id,
      from_made_on: params.from_date,
      to_made_on: params.to_date,
    })

    const response = await fetch(`${SALTEDGE_BASE_URL}/transactions?${qs.toString()}`, {
      headers: {
        'App-id': SALTEDGE_APP_ID,
        'Secret': SALTEDGE_SECRET,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      return { status: 'ERROR', rail: 'Salt Edge', error: `HTTP ${response.status}` }
    }

    const data = await response.json() as { data: Array<{
      id: string
      account_id: string
      amount: number
      currency_code: string
      description: string
      status: string
      made_on: string
      extra?: { debtor_name?: string; debtor_account?: string; creditor_name?: string; creditor_account?: string; payment_information?: string }
    }> }

    const transactions: BankTransaction[] = data.data.map(tx => ({
      external_id: tx.id,
      account_id: tx.account_id,
      amount_cents: BigInt(Math.round(tx.amount * 100)),
      currency: tx.currency_code,
      description: tx.description,
      status: tx.status === 'posted' ? 'POSTED' : 'PENDING',
      booking_date: tx.made_on,
      value_date: tx.made_on,
      debtor_name: tx.extra?.debtor_name,
      debtor_iban: tx.extra?.debtor_account,
      creditor_name: tx.extra?.creditor_name,
      creditor_iban: tx.extra?.creditor_account,
      remittance_info: tx.extra?.payment_information,
    }))

    log.info('[bankReconciliationApi] transactions fetched', { count: transactions.length, tenant_id: params.tenant_id })
    return transactions
  } catch (e) {
    return { status: 'ERROR', rail: 'Salt Edge', error: e instanceof Error ? e.message : 'unknown' }
  }
}

export async function runReconciliation(params: {
  connection_id: string
  bank_name: string
  from_date: string
  to_date: string
  tenant_id: string
}): Promise<ReconciliationResult | NotConfigured | RailError> {
  if (!SALTEDGE_APP_ID || !SALTEDGE_SECRET) return notConfigured()

  const txResult = await fetchBankTransactions(params)
  if ('status' in txResult) return txResult

  const transactions = txResult

  // Cross-match with our bank_statement_lines table
  let matched = 0
  let unmatched = 0
  let totalDebits = BigInt(0)
  let totalCredits = BigInt(0)

  for (const tx of transactions) {
    if (tx.amount_cents < BigInt(0)) {
      totalDebits += -tx.amount_cents
    } else {
      totalCredits += tx.amount_cents
    }

    // Try to match with existing bank statement lines
    try {
      const { data: existing } = await (supabaseAdmin as any)
        .from('bank_statement_lines')
        .select('id')
        .eq('tenant_id', params.tenant_id)
        .eq('external_transaction_id', tx.external_id)
        .limit(1)

      if (existing && (existing as unknown[]).length > 0) {
        matched++
      } else {
        unmatched++
        // Insert unmatched line for review
        void (supabaseAdmin as any)
          .from('bank_statement_lines')
          .upsert({
            tenant_id: params.tenant_id,
            external_transaction_id: tx.external_id,
            amount_cents: Number(tx.amount_cents),
            currency: tx.currency,
            description: tx.description,
            transaction_date: tx.booking_date,
            match_status: 'UNMATCHED',
            raw_data: tx,
          }, { onConflict: 'tenant_id,external_transaction_id' })
          .catch(() => { /* ignore */ })
      }
    } catch { unmatched++ }
  }

  const result: ReconciliationResult = {
    account_id: params.connection_id,
    bank_name: params.bank_name,
    transactions_fetched: transactions.length,
    transactions_matched: matched,
    transactions_unmatched: unmatched,
    total_debits_cents: totalDebits,
    total_credits_cents: totalCredits,
    reconciliation_status: unmatched === 0 ? 'BALANCED' : 'IMBALANCED',
    run_at: new Date().toISOString(),
  }

  log.info('[bankReconciliationApi] reconciliation complete', {
    bank_name: params.bank_name,
    matched,
    unmatched,
    status: result.reconciliation_status,
  })

  return result
}

export function isConfigured(): boolean {
  return !!(SALTEDGE_APP_ID && SALTEDGE_SECRET)
}
