// Agency Group — Escrow Reconciliation Engine
// lib/ledger/escrowReconciliationEngine.ts
// Manages escrow positions: deposit tracking, bank confirmation, release,
// and cross-reconciliation against the double-entry ledger.
// TypeScript strict — 0 errors

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { recordEscrowRelease, STANDARD_ACCOUNTS } from '@/lib/ledger/doubleEntryLedger'

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
    info: (m, c) => console.log('[escrow]', m, c ?? {}),
    warn: (m, c) => console.warn('[escrow]', m, c ?? {}),
    error: (m, c) => console.error('[escrow]', m, c ?? {}),
  }
}

const TENANT_ID =
  process.env.DEFAULT_TENANT_ID ??
  process.env.SYSTEM_ORG_ID ??
  '00000000-0000-0000-0000-000000000001'

const ZERO = BigInt(0)
const ONE_HUNDRED = BigInt(100)

// ── Types ─────────────────────────────────────────────────────────────────────

export type EscrowStatus =
  | 'PENDING_DEPOSIT'
  | 'DEPOSITED'
  | 'IN_ESCROW'
  | 'RELEASED'
  | 'REFUNDED'
  | 'DISPUTED'

export interface EscrowPosition {
  escrow_id: string
  tenant_id: string
  deal_id: string
  investor_id: string
  expected_amount_cents: bigint
  actual_amount_cents: bigint | null
  status: EscrowStatus
  bank_reference: string | null
  bank_confirmed: boolean
  deposited_at: string | null
  release_condition: string
  released_at: string | null
  discrepancy_cents: bigint
}

interface EscrowPositionRow {
  escrow_id: string
  tenant_id: string
  deal_id: string
  investor_id: string
  expected_amount_cents: string | number
  actual_amount_cents: string | number | null
  status: string
  bank_reference: string | null
  bank_confirmed: boolean
  deposited_at: string | null
  release_condition: string
  released_at: string | null
  discrepancy_cents: string | number
}

function rowToPosition(row: EscrowPositionRow): EscrowPosition {
  return {
    ...row,
    status: row.status as EscrowStatus,
    expected_amount_cents: BigInt(row.expected_amount_cents ?? 0),
    actual_amount_cents:
      row.actual_amount_cents != null ? BigInt(row.actual_amount_cents) : null,
    discrepancy_cents: BigInt(row.discrepancy_cents ?? 0),
  }
}

// ── createEscrowPosition ──────────────────────────────────────────────────────

export async function createEscrowPosition(
  dealId: string,
  investorId: string,
  expectedAmountCents: bigint,
  releaseCondition: string,
  tenantId: string = TENANT_ID
): Promise<EscrowPosition> {
  // Idempotency: check existing by (deal_id, investor_id)
  const { data: existing } = await (supabaseAdmin as any)
    .from('escrow_positions')
    .select('*')
    .eq('deal_id', dealId)
    .eq('investor_id', investorId)
    .maybeSingle()

  if (existing) {
    log.info('[escrow] createEscrowPosition — already exists', {
      deal_id: dealId,
      investor_id: investorId,
    })
    return rowToPosition(existing as EscrowPositionRow)
  }

  const escrowId = randomUUID()
  const { data, error } = await (supabaseAdmin as any)
    .from('escrow_positions')
    .insert({
      escrow_id: escrowId,
      tenant_id: tenantId,
      deal_id: dealId,
      investor_id: investorId,
      expected_amount_cents: Number(expectedAmountCents),
      actual_amount_cents: null,
      status: 'PENDING_DEPOSIT',
      bank_reference: null,
      bank_confirmed: false,
      deposited_at: null,
      release_condition: releaseCondition,
      released_at: null,
      discrepancy_cents: 0,
    })
    .select('*')
    .single()

  if (error || !data) {
    log.error('[escrow] createEscrowPosition insert failed', { error })
    throw new Error(`createEscrowPosition failed: ${String(error?.message ?? 'unknown')}`)
  }

  log.info('[escrow] position created', { escrow_id: escrowId, deal_id: dealId })
  return rowToPosition(data as EscrowPositionRow)
}

// ── confirmBankDeposit ────────────────────────────────────────────────────────

export async function confirmBankDeposit(
  escrowId: string,
  actualAmountCents: bigint,
  bankReference: string
): Promise<{ reconciled: boolean; discrepancy_cents: bigint }> {
  const { data: pos, error: fetchErr } = await (supabaseAdmin as any)
    .from('escrow_positions')
    .select('expected_amount_cents')
    .eq('escrow_id', escrowId)
    .maybeSingle()

  if (fetchErr || !pos) {
    throw new Error(`confirmBankDeposit: escrow ${escrowId} not found`)
  }

  const expected = BigInt((pos as EscrowPositionRow).expected_amount_cents ?? 0)
  const discrepancy = actualAmountCents - expected
  const absDisc = discrepancy < ZERO ? -discrepancy : discrepancy
  const reconciled = absDisc <= ONE_HUNDRED // within €1

  if (!reconciled) {
    log.warn('[escrow] bank deposit discrepancy > €1', {
      escrow_id: escrowId,
      expected: Number(expected),
      actual: Number(actualAmountCents),
      discrepancy: Number(discrepancy),
    })
  }

  const { error: updateErr } = await (supabaseAdmin as any)
    .from('escrow_positions')
    .update({
      actual_amount_cents: Number(actualAmountCents),
      bank_reference: bankReference,
      bank_confirmed: true,
      status: 'DEPOSITED',
      deposited_at: new Date().toISOString(),
      discrepancy_cents: Number(discrepancy),
    })
    .eq('escrow_id', escrowId)

  if (updateErr) {
    log.error('[escrow] confirmBankDeposit update failed', { error: updateErr })
    throw new Error(`confirmBankDeposit update failed: ${String(updateErr.message)}`)
  }

  log.info('[escrow] bank deposit confirmed', { escrow_id: escrowId, reconciled })
  return { reconciled, discrepancy_cents: discrepancy }
}

// ── releaseEscrow ─────────────────────────────────────────────────────────────

export async function releaseEscrow(escrowId: string, confirmedBy: string): Promise<void> {
  const { data: pos, error: fetchErr } = await (supabaseAdmin as any)
    .from('escrow_positions')
    .select('*')
    .eq('escrow_id', escrowId)
    .maybeSingle()

  if (fetchErr || !pos) {
    throw new Error(`releaseEscrow: escrow ${escrowId} not found`)
  }

  const { error: updateErr } = await (supabaseAdmin as any)
    .from('escrow_positions')
    .update({ status: 'RELEASED', released_at: new Date().toISOString() })
    .eq('escrow_id', escrowId)

  if (updateErr) {
    log.error('[escrow] releaseEscrow update failed', { error: updateErr })
    throw new Error(`releaseEscrow update failed: ${String(updateErr.message)}`)
  }

  const row = pos as EscrowPositionRow
  const amountCents = BigInt(row.actual_amount_cents ?? row.expected_amount_cents ?? 0)
  void recordEscrowRelease(escrowId, row.investor_id, amountCents)
    .catch((e) => console.warn('[escrow] journal release', e))

  log.info('[escrow] position released', { escrow_id: escrowId, confirmed_by: confirmedBy })
}

// ── getEscrowSummary ──────────────────────────────────────────────────────────

export async function getEscrowSummary(tenantId: string): Promise<{
  total_positions: number
  in_escrow_count: number
  total_held_cents: bigint
  total_discrepancy_cents: bigint
  disputed_count: number
}> {
  const { data, error } = await (supabaseAdmin as any)
    .from('escrow_positions')
    .select('status, actual_amount_cents, expected_amount_cents, discrepancy_cents')
    .eq('tenant_id', tenantId)

  if (error || !data) {
    log.error('[escrow] getEscrowSummary query failed', { error })
    return {
      total_positions: 0,
      in_escrow_count: 0,
      total_held_cents: ZERO,
      total_discrepancy_cents: ZERO,
      disputed_count: 0,
    }
  }

  const rows = data as EscrowPositionRow[]
  let totalHeld = ZERO
  let totalDisc = ZERO
  let inEscrowCount = 0
  let disputedCount = 0

  for (const row of rows) {
    const amount = BigInt(row.actual_amount_cents ?? row.expected_amount_cents ?? 0)
    if (row.status === 'IN_ESCROW' || row.status === 'DEPOSITED') {
      inEscrowCount++
      totalHeld = totalHeld + amount
    }
    if (row.status === 'DISPUTED') disputedCount++
    totalDisc = totalDisc + BigInt(row.discrepancy_cents ?? 0)
  }

  return {
    total_positions: rows.length,
    in_escrow_count: inEscrowCount,
    total_held_cents: totalHeld,
    total_discrepancy_cents: totalDisc,
    disputed_count: disputedCount,
  }
}

// ── reconcileEscrowVsLedger ───────────────────────────────────────────────────

export async function reconcileEscrowVsLedger(tenantId: string): Promise<{
  match: boolean
  escrow_total_cents: bigint
  ledger_escrow_cents: bigint
  variance_cents: bigint
}> {
  const [summary, ledgerRes] = await Promise.all([
    getEscrowSummary(tenantId),
    (supabaseAdmin as any)
      .from('ledger_accounts')
      .select('balance_cents')
      .eq('tenant_id', tenantId)
      .eq('account_code', STANDARD_ACCOUNTS.ESCROW_ACCOUNT.code)
      .maybeSingle(),
  ])

  const ledgerData = ledgerRes?.data as { balance_cents?: string | number } | null
  const ledgerEscrowCents = BigInt(ledgerData?.balance_cents ?? 0)
  const escrowTotalCents = summary.total_held_cents
  const variance = escrowTotalCents - ledgerEscrowCents
  const absVariance = variance < ZERO ? -variance : variance
  const match = absVariance <= ONE_HUNDRED

  if (!match) {
    log.warn('[escrow] reconcileEscrowVsLedger — variance detected', {
      escrow_total: Number(escrowTotalCents),
      ledger_escrow: Number(ledgerEscrowCents),
      variance: Number(variance),
    })
  }

  return {
    match,
    escrow_total_cents: escrowTotalCents,
    ledger_escrow_cents: ledgerEscrowCents,
    variance_cents: variance,
  }
}
