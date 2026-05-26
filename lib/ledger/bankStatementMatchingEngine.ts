// Agency Group — Bank Statement Matching Engine
// lib/ledger/bankStatementMatchingEngine.ts
// Imports bank statement lines, auto-matches against journal entries,
// and produces reconciliation reports. All amounts in bigint cents (EUR).
// TypeScript strict — 0 errors

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'

// ── Logger ─────────────────────────────────────────────────────────────────────

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
    info: (m, c) => console.log('[bank-match]', m, c ?? {}),
    warn: (m, c) => console.warn('[bank-match]', m, c ?? {}),
    error: (m, c) => console.error('[bank-match]', m, c ?? {}),
  }
}

const TENANT_ID =
  process.env.DEFAULT_TENANT_ID ??
  process.env.SYSTEM_ORG_ID ??
  '00000000-0000-0000-0000-000000000001'

const ZERO = BigInt(0)

// ── Types ─────────────────────────────────────────────────────────────────────

export type MatchStatus =
  | 'UNMATCHED'
  | 'AUTO_MATCHED'
  | 'MANUAL_MATCHED'
  | 'DISPUTED'
  | 'RECONCILED'

export interface BankStatementLine {
  line_id: string
  tenant_id: string
  statement_date: string
  value_date: string
  description: string
  reference: string | null
  amount_cents: bigint
  currency: 'EUR'
  bank_account: string
  matched_transaction_id: string | null
  match_status: MatchStatus
  match_confidence: number | null
  imported_at: string
}

interface BankStatementLineRow {
  line_id: string
  tenant_id: string
  statement_date: string
  value_date: string
  description: string
  reference: string | null
  amount_cents: string | number
  currency: string
  bank_account: string
  matched_transaction_id: string | null
  match_status: string
  match_confidence: number | null
  imported_at: string
}

function rowToLine(row: BankStatementLineRow): BankStatementLine {
  return {
    ...row,
    amount_cents: BigInt(row.amount_cents ?? 0),
    currency: row.currency as 'EUR',
    match_status: row.match_status as MatchStatus,
  }
}

// ── importBankLines ───────────────────────────────────────────────────────────

export async function importBankLines(
  lines: Omit<
    BankStatementLine,
    'line_id' | 'imported_at' | 'matched_transaction_id' | 'match_status' | 'match_confidence'
  >[]
): Promise<{ imported: number; duplicates: number }> {
  if (lines.length === 0) return { imported: 0, duplicates: 0 }

  const rows = lines.map((l) => ({
    line_id: randomUUID(),
    tenant_id: l.tenant_id,
    statement_date: l.statement_date,
    value_date: l.value_date,
    description: l.description,
    reference: l.reference ?? null,
    amount_cents: Number(l.amount_cents),
    currency: l.currency,
    bank_account: l.bank_account,
    matched_transaction_id: null,
    match_status: 'UNMATCHED',
    match_confidence: null,
    imported_at: new Date().toISOString(),
  }))

  const { data, error } = await (supabaseAdmin as any)
    .from('bank_statement_lines')
    .upsert(rows, {
      onConflict: 'tenant_id,statement_date,amount_cents,reference',
      ignoreDuplicates: true,
    })
    .select('line_id')

  if (error) {
    log.error('[bank-match] importBankLines upsert failed', { error })
    throw new Error(`importBankLines failed: ${String(error.message)}`)
  }

  const imported = (data as unknown[])?.length ?? 0
  const duplicates = lines.length - imported
  log.info('[bank-match] lines imported', { imported, duplicates, total: lines.length })
  return { imported, duplicates }
}

// ── autoMatchStatementLines ───────────────────────────────────────────────────

export async function autoMatchStatementLines(
  tenantId: string = TENANT_ID
): Promise<{ matched: number; unmatched: number; total_processed: number }> {
  const { data: unmatchedLines, error: fetchErr } = await (supabaseAdmin as any)
    .from('bank_statement_lines')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('match_status', 'UNMATCHED')
    .limit(500)

  if (fetchErr || !unmatchedLines) {
    log.error('[bank-match] autoMatch fetch failed', { error: fetchErr })
    return { matched: 0, unmatched: 0, total_processed: 0 }
  }

  const lines = (unmatchedLines as BankStatementLineRow[]).map(rowToLine)
  let matched = 0

  for (const line of lines) {
    const statDate = new Date(line.statement_date)
    const dateFrom = new Date(statDate)
    dateFrom.setDate(dateFrom.getDate() - 2)
    const dateTo = new Date(statDate)
    dateTo.setDate(dateTo.getDate() + 2)

    // abs value for matching (bank debit is negative)
    const absAmount = line.amount_cents < ZERO ? -line.amount_cents : line.amount_cents

    const { data: candidates, error: searchErr } = await (supabaseAdmin as any)
      .from('journal_entries')
      .select('entry_id, amount_cents, posted_at')
      .eq('tenant_id', tenantId)
      .eq('amount_cents', Number(absAmount))
      .gte('posted_at', dateFrom.toISOString())
      .lte('posted_at', dateTo.toISOString())
      .limit(5)

    if (searchErr || !candidates) continue

    const matchList = candidates as Array<{
      entry_id: string
      amount_cents: string | number
      posted_at: string
    }>

    if (matchList.length === 1) {
      void (supabaseAdmin as any)
        .from('bank_statement_lines')
        .update({
          match_status: 'AUTO_MATCHED',
          matched_transaction_id: matchList[0].entry_id,
          match_confidence: 0.9,
        })
        .eq('line_id', line.line_id)
        .catch((e: unknown) => console.warn('[bank-match] update match', e))

      matched++
    }
  }

  const unmatched = lines.length - matched
  log.info('[bank-match] auto-match complete', { matched, unmatched, total: lines.length })
  return { matched, unmatched, total_processed: lines.length }
}

// ── getReconciliationReport ───────────────────────────────────────────────────

export async function getReconciliationReport(tenantId: string = TENANT_ID): Promise<{
  total_lines: number
  reconciled_pct: number
  unmatched_count: number
  disputed_count: number
  unmatched_lines: BankStatementLine[]
}> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 90)

  const { data, error } = await (supabaseAdmin as any)
    .from('bank_statement_lines')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('statement_date', cutoff.toISOString().slice(0, 10))
    .order('statement_date', { ascending: false })

  if (error || !data) {
    log.error('[bank-match] getReconciliationReport query failed', { error })
    return {
      total_lines: 0,
      reconciled_pct: 0,
      unmatched_count: 0,
      disputed_count: 0,
      unmatched_lines: [],
    }
  }

  const rows = (data as BankStatementLineRow[]).map(rowToLine)
  const total = rows.length
  const reconciled = rows.filter(
    (r) =>
      r.match_status === 'RECONCILED' ||
      r.match_status === 'AUTO_MATCHED' ||
      r.match_status === 'MANUAL_MATCHED'
  ).length
  const unmatched_count = rows.filter((r) => r.match_status === 'UNMATCHED').length
  const disputed_count = rows.filter((r) => r.match_status === 'DISPUTED').length
  const reconciled_pct = total > 0 ? Math.round((reconciled / total) * 100) : 0
  const unmatched_lines = rows.filter((r) => r.match_status === 'UNMATCHED').slice(0, 20)

  return { total_lines: total, reconciled_pct, unmatched_count, disputed_count, unmatched_lines }
}
