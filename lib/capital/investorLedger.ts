// Agency Group — Investor Capital Ledger
// lib/capital/investorLedger.ts
// Per-investor double-entry ledger: available / committed / executed balances.
// IMMUTABLE entries — never update, always insert new entries.
// All amounts in EUR cents (integer) to avoid floating point errors.
// TypeScript strict — 0 errors

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type LedgerEntryType =
  | 'DEPOSIT'
  | 'WITHDRAWAL'
  | 'COMMITMENT'
  | 'COMMITMENT_RELEASE'
  | 'EXECUTION'
  | 'SETTLEMENT_LOCK'
  | 'SETTLEMENT_RELEASE'
  | 'FEE'
  | 'REFUND'

export interface LedgerEntry {
  entry_id: string
  investor_id: string
  tenant_id: string
  entry_type: LedgerEntryType
  amount_eur_cents: number
  running_available_cents: number
  running_committed_cents: number
  running_executed_cents: number
  reference_id: string
  reference_type: 'deal' | 'bid' | 'settlement' | 'deposit' | 'fee'
  description: string
  created_at: string
  idempotency_key: string
}

export interface InvestorBalance {
  investor_id: string
  tenant_id: string
  available_eur_cents: number
  committed_eur_cents: number
  executed_eur_cents: number
  total_eur_cents: number
  last_updated_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CANONICAL_TENANT = process.env.DEFAULT_TENANT_ID ?? process.env.SYSTEM_ORG_ID ?? '00000000-0000-0000-0000-000000000001'

// ─── getInvestorBalance ───────────────────────────────────────────────────────

/**
 * Reads the most recent ledger entry to get running totals.
 * Returns zeroed balance if no entries exist.
 */
export async function getInvestorBalance(
  investorId: string,
  tenantId: string,
): Promise<InvestorBalance> {
  const tid = tenantId || CANONICAL_TENANT

  const { data, error } = await (supabaseAdmin as any)
    .from('investor_ledger_entries')
    .select('running_available_cents, running_committed_cents, running_executed_cents, created_at')
    .eq('tenant_id', tid)
    .eq('investor_id', investorId)
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) {
    log.info('[investorLedger] getInvestorBalance error', { investor_id: investorId, error: error.message })
  }

  const entry = data?.[0]

  const available  = entry?.running_available_cents  ?? 0
  const committed  = entry?.running_committed_cents  ?? 0
  const executed   = entry?.running_executed_cents   ?? 0

  return {
    investor_id:           investorId,
    tenant_id:             tid,
    available_eur_cents:   available,
    committed_eur_cents:   committed,
    executed_eur_cents:    executed,
    total_eur_cents:       available + committed + executed,
    last_updated_at:       entry?.created_at ?? new Date().toISOString(),
  }
}

// ─── recordLedgerEntry ────────────────────────────────────────────────────────

/**
 * Reads current balance, applies entry type logic, inserts immutable entry.
 * Idempotency: checks for existing entry by idempotency_key — returns existing if found.
 * All arithmetic in integer EUR cents. No floating point.
 */
export async function recordLedgerEntry(
  entry: Omit<LedgerEntry, 'entry_id' | 'created_at' | 'running_available_cents' | 'running_committed_cents' | 'running_executed_cents'>,
  tenantId: string,
): Promise<LedgerEntry> {
  const tid = tenantId || CANONICAL_TENANT

  // ── Idempotency check ────────────────────────────────────────────────────────
  const { data: existing, error: existErr } = await (supabaseAdmin as any)
    .from('investor_ledger_entries')
    .select('*')
    .eq('idempotency_key', entry.idempotency_key)
    .maybeSingle()

  if (existErr) {
    log.info('[investorLedger] idempotency check error', { key: entry.idempotency_key, error: existErr.message })
  }

  if (existing) {
    return mapRow(existing)
  }

  // ── Current balance ───────────────────────────────────────────────────────────
  const balance = await getInvestorBalance(entry.investor_id, tid)

  let newAvailable  = balance.available_eur_cents
  let newCommitted  = balance.committed_eur_cents
  let newExecuted   = balance.executed_eur_cents
  const amt = entry.amount_eur_cents

  // ── Apply entry type logic ────────────────────────────────────────────────────
  switch (entry.entry_type) {
    case 'DEPOSIT':
      newAvailable += amt
      break

    case 'WITHDRAWAL':
      if (newAvailable < amt) {
        throw new Error(
          `[investorLedger] Insufficient available balance for WITHDRAWAL. ` +
          `Available: ${newAvailable} cents, requested: ${amt} cents`,
        )
      }
      newAvailable -= amt
      break

    case 'COMMITMENT':
      if (newAvailable < amt) {
        throw new Error(
          `[investorLedger] Insufficient available balance for COMMITMENT. ` +
          `Available: ${newAvailable} cents, requested: ${amt} cents`,
        )
      }
      newAvailable -= amt
      newCommitted += amt
      break

    case 'COMMITMENT_RELEASE':
      newCommitted -= amt
      newAvailable += amt
      break

    case 'EXECUTION':
      newCommitted -= amt
      newExecuted  += amt
      break

    case 'SETTLEMENT_LOCK':
      // Audit only — capital already moved to settlement_accounts externally
      // No balance change; running totals stay identical
      break

    case 'SETTLEMENT_RELEASE':
      // Mirror of SETTLEMENT_LOCK: no balance change here (handled by COMMITMENT_RELEASE or REFUND)
      break

    case 'FEE':
      if (newAvailable < amt) {
        throw new Error(
          `[investorLedger] Insufficient available balance for FEE. ` +
          `Available: ${newAvailable} cents, fee: ${amt} cents`,
        )
      }
      newAvailable -= amt
      newExecuted  += amt
      break

    case 'REFUND':
      newExecuted  -= amt
      newAvailable += amt
      break

    default: {
      // Exhaustive check for TypeScript strict
      const _exhaustive: never = entry.entry_type
      throw new Error(`[investorLedger] Unknown entry_type: ${String(_exhaustive)}`)
    }
  }

  const entryId = `le_${randomUUID()}`

  const row = {
    entry_id:                   entryId,
    tenant_id:                  tid,
    investor_id:                entry.investor_id,
    entry_type:                 entry.entry_type,
    amount_eur_cents:           amt,
    running_available_cents:    newAvailable,
    running_committed_cents:    newCommitted,
    running_executed_cents:     newExecuted,
    reference_id:               entry.reference_id,
    reference_type:             entry.reference_type,
    description:                entry.description,
    idempotency_key:            entry.idempotency_key,
  }

  const { data: inserted, error: insertErr } = await (supabaseAdmin as any)
    .from('investor_ledger_entries')
    .insert(row)
    .select('*')
    .single()

  if (insertErr) {
    // Race condition: another insert with same idempotency_key may have just been committed
    if (insertErr.code === '23505') {
      const { data: raceRow } = await (supabaseAdmin as any)
        .from('investor_ledger_entries')
        .select('*')
        .eq('idempotency_key', entry.idempotency_key)
        .single()
      if (raceRow) return mapRow(raceRow)
    }
    throw new Error(`[investorLedger] Insert failed: ${insertErr.message}`)
  }

  log.info('[investorLedger] entry recorded', {
    entry_id:   entryId,
    entry_type: entry.entry_type,
    investor_id: entry.investor_id,
    amount_eur_cents: amt,
  })

  return mapRow(inserted)
}

// ─── getLedgerHistory ─────────────────────────────────────────────────────────

/**
 * Returns last N ledger entries for an investor, ordered newest first.
 */
export async function getLedgerHistory(
  investorId: string,
  tenantId: string,
  limit = 50,
): Promise<LedgerEntry[]> {
  const tid = tenantId || CANONICAL_TENANT

  const { data, error } = await (supabaseAdmin as any)
    .from('investor_ledger_entries')
    .select('*')
    .eq('tenant_id', tid)
    .eq('investor_id', investorId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    log.info('[investorLedger] getLedgerHistory error', { investor_id: investorId, error: error.message })
    return []
  }

  return (data ?? []).map(mapRow)
}

// ─── getTotalCapitalUnderManagement ──────────────────────────────────────────

/**
 * Aggregates available/committed/executed balances across all investors for a tenant.
 * Uses the most recent ledger entry per investor for running totals.
 */
export async function getTotalCapitalUnderManagement(tenantId: string): Promise<{
  total_available_eur_cents: number
  total_committed_eur_cents: number
  total_executed_eur_cents: number
  investor_count: number
}> {
  const tid = tenantId || CANONICAL_TENANT

  // Fetch all entries and compute per-investor latest running totals in memory.
  // For large datasets this could be replaced with a materialised view.
  const { data, error } = await (supabaseAdmin as any)
    .from('investor_ledger_entries')
    .select('investor_id, running_available_cents, running_committed_cents, running_executed_cents, created_at')
    .eq('tenant_id', tid)
    .order('created_at', { ascending: false })

  if (error) {
    log.info('[investorLedger] getTotalCapitalUnderManagement error', { error: error.message })
    return { total_available_eur_cents: 0, total_committed_eur_cents: 0, total_executed_eur_cents: 0, investor_count: 0 }
  }

  // Keep only the latest entry per investor (array is newest-first already)
  const seenInvestors = new Set<string>()
  let totalAvailable = 0
  let totalCommitted = 0
  let totalExecuted  = 0

  for (const row of (data ?? [])) {
    if (!seenInvestors.has(row.investor_id as string)) {
      seenInvestors.add(row.investor_id as string)
      totalAvailable += (row.running_available_cents as number) ?? 0
      totalCommitted += (row.running_committed_cents as number) ?? 0
      totalExecuted  += (row.running_executed_cents  as number) ?? 0
    }
  }

  return {
    total_available_eur_cents: totalAvailable,
    total_committed_eur_cents: totalCommitted,
    total_executed_eur_cents:  totalExecuted,
    investor_count:            seenInvestors.size,
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(row: Record<string, any>): LedgerEntry {
  return {
    entry_id:                  row.entry_id as string,
    investor_id:               row.investor_id as string,
    tenant_id:                 row.tenant_id as string,
    entry_type:                row.entry_type as LedgerEntryType,
    amount_eur_cents:          row.amount_eur_cents as number,
    running_available_cents:   row.running_available_cents as number,
    running_committed_cents:   row.running_committed_cents as number,
    running_executed_cents:    row.running_executed_cents as number,
    reference_id:              row.reference_id as string,
    reference_type:            row.reference_type as LedgerEntry['reference_type'],
    description:               row.description as string,
    created_at:                row.created_at as string,
    idempotency_key:           row.idempotency_key as string,
  }
}
