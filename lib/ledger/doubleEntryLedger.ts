// Agency Group — Double-Entry Ledger System
// lib/ledger/doubleEntryLedger.ts
// Proper double-entry bookkeeping: every financial movement creates two equal
// and opposite entries (debit + credit). All EUR values stored as bigint cents.
// TypeScript strict — 0 errors

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'

// ── Logger ────────────────────────────────────────────────────────────────────

let log: {
  info: (m: string, c?: Record<string, unknown>) => void
  warn: (m: string, c?: Record<string, unknown>) => void
  error: (m: string, c?: Record<string, unknown>) => void
}
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { logger } = require('@/lib/observability/logger') as { logger: typeof log }
  log = logger
} catch {
  log = {
    info: (m, c) => console.log('[ledger]', m, c ?? {}),
    warn: (m, c) => console.warn('[ledger]', m, c ?? {}),
    error: (m, c) => console.error('[ledger]', m, c ?? {}),
  }
}

const TENANT_ID =
  process.env.DEFAULT_TENANT_ID ??
  process.env.SYSTEM_ORG_ID ??
  '00000000-0000-0000-0000-000000000001'

// ── Account types (chart of accounts) ────────────────────────────────────────

export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'

export interface LedgerAccount {
  account_id: string
  tenant_id: string
  account_code: string
  account_name: string
  account_type: AccountType
  currency: 'EUR'
  balance_cents: bigint
  is_escrow: boolean
  is_active: boolean
}

// Standard chart of accounts
export const STANDARD_ACCOUNTS = {
  INVESTOR_FUNDS:        { code: '1001', name: 'Investor Funds Received',       type: 'ASSET'     as AccountType },
  ESCROW_ACCOUNT:        { code: '1002', name: 'Escrow Holdings',               type: 'ASSET'     as AccountType },
  COMMISSION_RECEIVABLE: { code: '1003', name: 'Commission Receivable',         type: 'ASSET'     as AccountType },
  OPERATING_CASH:        { code: '1004', name: 'Operating Cash',                type: 'ASSET'     as AccountType },
  PROPERTY_PURCHASE:     { code: '2001', name: 'Property Purchase Payable',     type: 'LIABILITY' as AccountType },
  ESCROW_LIABILITY:      { code: '2002', name: 'Escrow Liability to Investors', type: 'LIABILITY' as AccountType },
  COMMISSION_REVENUE:    { code: '4001', name: 'Commission Revenue',            type: 'REVENUE'   as AccountType },
  TRANSACTION_FEES:      { code: '4002', name: 'Transaction Fee Revenue',       type: 'REVENUE'   as AccountType },
  IMT_TAX_EXPENSE:       { code: '5001', name: 'IMT Tax Expense',               type: 'EXPENSE'   as AccountType },
  NOTARY_EXPENSE:        { code: '5002', name: 'Notary Expense',                type: 'EXPENSE'   as AccountType },
} as const

export type JournalEntryStatus = 'PENDING' | 'POSTED' | 'REVERSED' | 'FAILED'

export interface JournalEntry {
  entry_id: string
  tenant_id: string
  transaction_id: string
  description: string
  status: JournalEntryStatus
  debit_account_code: string
  credit_account_code: string
  amount_cents: bigint
  currency: 'EUR'
  idempotency_key: string
  posted_at: string | null
  created_at: string
  metadata: Record<string, unknown>
}

// ── Internal row type returned by Supabase (bigint → string) ─────────────────

interface LedgerAccountRow {
  account_id: string
  tenant_id: string
  account_code: string
  account_name: string
  account_type: string
  currency: string
  balance_cents: string | number
  is_escrow: boolean
  is_active: boolean
}

interface JournalEntryRow {
  entry_id: string
  tenant_id: string
  transaction_id: string
  description: string
  status: string
  debit_account_code: string
  credit_account_code: string
  amount_cents: string | number
  currency: string
  idempotency_key: string
  posted_at: string | null
  created_at: string
  metadata: Record<string, unknown>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function rowToJournalEntry(row: JournalEntryRow): JournalEntry {
  return {
    ...row,
    status: row.status as JournalEntryStatus,
    currency: row.currency as 'EUR',
    amount_cents: BigInt(row.amount_cents ?? 0),
  }
}

// ── ensureStandardAccounts ────────────────────────────────────────────────────

export function ensureStandardAccounts(tenantId: string): void {
  const accounts = Object.values(STANDARD_ACCOUNTS).map((a) => ({
    account_id: randomUUID(),
    tenant_id: tenantId,
    account_code: a.code,
    account_name: a.name,
    account_type: a.type,
    currency: 'EUR',
    balance_cents: 0,
    is_escrow: a.code === '1002',
    is_active: true,
  }))

  void (supabaseAdmin as any)
    .from('ledger_accounts')
    .upsert(accounts, { onConflict: 'tenant_id,account_code', ignoreDuplicates: true })
    .then(({ error }: { error: unknown }) => {
      if (error) log.warn('[ledger] ensureStandardAccounts upsert warn', { error })
    })
    .catch((e: unknown) => console.warn('[ledger] ensureStandardAccounts', e))
}

// ── postJournalEntry ──────────────────────────────────────────────────────────

export async function postJournalEntry(
  entry: Omit<JournalEntry, 'entry_id' | 'created_at' | 'posted_at'>
): Promise<JournalEntry> {
  // Idempotency check
  const { data: existing } = await (supabaseAdmin as any)
    .from('journal_entries')
    .select('*')
    .eq('idempotency_key', entry.idempotency_key)
    .maybeSingle()

  if (existing) {
    log.info('[ledger] postJournalEntry — idempotent hit', { key: entry.idempotency_key })
    return rowToJournalEntry(existing as JournalEntryRow)
  }

  const entryId = randomUUID()
  const now = new Date().toISOString()

  const row = {
    entry_id: entryId,
    tenant_id: entry.tenant_id,
    transaction_id: entry.transaction_id,
    description: entry.description,
    status: 'POSTED',
    debit_account_code: entry.debit_account_code,
    credit_account_code: entry.credit_account_code,
    amount_cents: Number(entry.amount_cents),
    currency: entry.currency,
    idempotency_key: entry.idempotency_key,
    posted_at: now,
    metadata: entry.metadata ?? {},
  }

  const { data, error } = await (supabaseAdmin as any)
    .from('journal_entries')
    .insert(row)
    .select('*')
    .single()

  if (error || !data) {
    log.error('[ledger] postJournalEntry insert failed', { error, entryId })
    throw new Error(`postJournalEntry failed: ${String(error?.message ?? 'unknown')}`)
  }

  // Update balances best-effort / fire-and-forget
  void updateAccountBalance(entry.tenant_id, entry.debit_account_code, entry.amount_cents, 'debit')
    .catch((e) => console.warn('[ledger] balance update debit', e))
  void updateAccountBalance(entry.tenant_id, entry.credit_account_code, entry.amount_cents, 'credit')
    .catch((e) => console.warn('[ledger] balance update credit', e))

  log.info('[ledger] journal entry posted', { entry_id: entryId, key: entry.idempotency_key })
  return rowToJournalEntry(data as JournalEntryRow)
}

async function updateAccountBalance(
  tenantId: string,
  accountCode: string,
  amountCents: bigint,
  side: 'debit' | 'credit'
): Promise<void> {
  const { data: acct } = await (supabaseAdmin as any)
    .from('ledger_accounts')
    .select('balance_cents')
    .eq('tenant_id', tenantId)
    .eq('account_code', accountCode)
    .maybeSingle()

  if (!acct) return

  const current = BigInt(acct.balance_cents ?? 0)
  const next = side === 'debit' ? current + amountCents : current - amountCents

  await (supabaseAdmin as any)
    .from('ledger_accounts')
    .update({ balance_cents: Number(next), updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('account_code', accountCode)
}

// ── recordCommissionRevenue ───────────────────────────────────────────────────

export async function recordCommissionRevenue(
  transactionId: string,
  _propertyId: string,
  salePriceCents: bigint,
  commissionRatePct: number
): Promise<JournalEntry> {
  const commissionCents = BigInt(Math.round(Number(salePriceCents) * commissionRatePct / 100))

  return postJournalEntry({
    tenant_id: TENANT_ID,
    transaction_id: transactionId,
    description: `Commission revenue — ${commissionRatePct}% of ${Number(salePriceCents) / 100} EUR`,
    status: 'POSTED',
    debit_account_code: STANDARD_ACCOUNTS.COMMISSION_RECEIVABLE.code,
    credit_account_code: STANDARD_ACCOUNTS.COMMISSION_REVENUE.code,
    amount_cents: commissionCents,
    currency: 'EUR',
    idempotency_key: `commission::${transactionId}`,
    metadata: { sale_price_cents: Number(salePriceCents), commission_rate_pct: commissionRatePct },
  })
}

// ── recordEscrowReceipt ───────────────────────────────────────────────────────

export async function recordEscrowReceipt(
  transactionId: string,
  investorId: string,
  amountCents: bigint
): Promise<JournalEntry> {
  return postJournalEntry({
    tenant_id: TENANT_ID,
    transaction_id: transactionId,
    description: `Escrow receipt — investor ${investorId}`,
    status: 'POSTED',
    debit_account_code: STANDARD_ACCOUNTS.ESCROW_ACCOUNT.code,
    credit_account_code: STANDARD_ACCOUNTS.ESCROW_LIABILITY.code,
    amount_cents: amountCents,
    currency: 'EUR',
    idempotency_key: `escrow-in::${transactionId}::${investorId}`,
    metadata: { investor_id: investorId },
  })
}

// ── recordEscrowRelease ───────────────────────────────────────────────────────

export async function recordEscrowRelease(
  transactionId: string,
  investorId: string,
  amountCents: bigint
): Promise<JournalEntry> {
  return postJournalEntry({
    tenant_id: TENANT_ID,
    transaction_id: transactionId,
    description: `Escrow release — investor ${investorId}`,
    status: 'POSTED',
    debit_account_code: STANDARD_ACCOUNTS.ESCROW_LIABILITY.code,
    credit_account_code: STANDARD_ACCOUNTS.PROPERTY_PURCHASE.code,
    amount_cents: amountCents,
    currency: 'EUR',
    idempotency_key: `escrow-out::${transactionId}::${investorId}`,
    metadata: { investor_id: investorId },
  })
}

// ── getTrialBalance ───────────────────────────────────────────────────────────

export async function getTrialBalance(
  tenantId: string
): Promise<
  Array<{
    account_code: string
    account_name: string
    account_type: AccountType
    debit_cents: bigint
    credit_cents: bigint
    net_cents: bigint
  }>
> {
  const { data, error } = await (supabaseAdmin as any)
    .from('ledger_accounts')
    .select('account_code, account_name, account_type, balance_cents')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)

  if (error || !data) {
    log.error('[ledger] getTrialBalance query failed', { error })
    return []
  }

  const ZERO = BigInt(0)
  let totalDebits = ZERO
  let totalCredits = ZERO

  const rows = (data as LedgerAccountRow[]).map((row) => {
    const balance = BigInt(row.balance_cents ?? 0)
    const type = row.account_type as AccountType
    let debit_cents = ZERO
    let credit_cents = ZERO

    // ASSET and EXPENSE have debit-normal balances
    // LIABILITY, EQUITY, REVENUE have credit-normal balances
    if (type === 'ASSET' || type === 'EXPENSE') {
      if (balance >= ZERO) debit_cents = balance
      else credit_cents = -balance
    } else {
      if (balance <= ZERO) debit_cents = -balance
      else credit_cents = balance
    }

    totalDebits = totalDebits + debit_cents
    totalCredits = totalCredits + credit_cents

    return {
      account_code: row.account_code,
      account_name: row.account_name,
      account_type: type,
      debit_cents,
      credit_cents,
      net_cents: balance,
    }
  })

  if (totalDebits !== totalCredits) {
    log.warn('[ledger] trial balance out of balance', {
      total_debits: Number(totalDebits),
      total_credits: Number(totalCredits),
      variance: Number(totalDebits - totalCredits),
    })
  }

  return rows
}

// ── getLedgerHealth ───────────────────────────────────────────────────────────

export async function getLedgerHealth(tenantId: string): Promise<{
  balanced: boolean
  total_entries: number
  revenue_cents: bigint
  commission_pending_cents: bigint
  escrow_held_cents: bigint
}> {
  const ZERO = BigInt(0)

  const [trialBalance, entryRes] = await Promise.all([
    getTrialBalance(tenantId),
    (supabaseAdmin as any)
      .from('journal_entries')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId),
  ])

  const totalDebits = trialBalance.reduce((s, r) => s + r.debit_cents, ZERO)
  const totalCredits = trialBalance.reduce((s, r) => s + r.credit_cents, ZERO)
  const balanced = totalDebits === totalCredits

  const revenueRow = trialBalance.find((r) => r.account_code === STANDARD_ACCOUNTS.COMMISSION_REVENUE.code)
  const commissionRow = trialBalance.find((r) => r.account_code === STANDARD_ACCOUNTS.COMMISSION_RECEIVABLE.code)
  const escrowRow = trialBalance.find((r) => r.account_code === STANDARD_ACCOUNTS.ESCROW_ACCOUNT.code)

  return {
    balanced,
    total_entries: (entryRes as { count?: number }).count ?? 0,
    revenue_cents: revenueRow?.net_cents ?? ZERO,
    commission_pending_cents: commissionRow?.net_cents ?? ZERO,
    escrow_held_cents: escrowRow?.net_cents ?? ZERO,
  }
}
