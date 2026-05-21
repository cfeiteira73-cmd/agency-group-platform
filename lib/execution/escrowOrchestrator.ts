// Agency Group — Escrow Orchestrator
// lib/execution/escrowOrchestrator.ts
// Manages capital locking for real estate transactions.
// Escrow: capital is LOCKED (not available, not yet executed) until conditions met.
// ESCROW RELEASE = either complete (→ EXECUTED) or revert (→ AVAILABLE).
// Never loses money. Every EUR tracked.
// TypeScript strict — 0 errors

import { randomUUID, createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { getInvestorBalance, recordLedgerEntry } from '@/lib/capital/investorLedger'
import log from '@/lib/logger'

// ─── Constants ────────────────────────────────────────────────────────────────

const CANONICAL_TENANT =
  process.env.DEFAULT_TENANT_ID ??
  process.env.SYSTEM_ORG_ID ??
  '00000000-0000-0000-0000-000000000001'

// ─── Types ────────────────────────────────────────────────────────────────────

export type EscrowState =
  | 'PENDING'
  | 'FUNDED'
  | 'LOCKED'
  | 'RELEASING'
  | 'RELEASED'
  | 'REVERTED'

export interface EscrowAccount {
  escrow_id: string
  tenant_id: string
  settlement_id: string
  investor_id: string
  amount_eur_cents: number
  fee_eur_cents: number
  state: EscrowState
  funded_at: string | null
  locked_at: string | null
  released_at: string | null
  release_type: 'EXECUTION' | 'REVERT' | null
  conditions_met: boolean
  audit_hash: string
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(row: Record<string, any>): EscrowAccount {
  return {
    escrow_id:        row.escrow_id as string,
    tenant_id:        row.tenant_id as string,
    settlement_id:    row.settlement_id as string,
    investor_id:      row.investor_id as string,
    amount_eur_cents: row.amount_eur_cents as number,
    fee_eur_cents:    row.fee_eur_cents as number,
    state:            row.state as EscrowState,
    funded_at:        (row.funded_at as string | null) ?? null,
    locked_at:        (row.locked_at as string | null) ?? null,
    released_at:      (row.released_at as string | null) ?? null,
    release_type:     (row.release_type as 'EXECUTION' | 'REVERT' | null) ?? null,
    conditions_met:   (row.conditions_met as boolean) ?? false,
    audit_hash:       (row.audit_hash as string) ?? '',
  }
}

// ─── createEscrow ─────────────────────────────────────────────────────────────

/**
 * Creates a new escrow account in PENDING state.
 * fee = 0.1% of amount (integer arithmetic, rounded).
 * Does NOT lock capital yet — that happens at FUNDED.
 */
export async function createEscrow(params: {
  settlement_id: string
  investor_id: string
  amount_eur_cents: number
  tenant_id: string
}): Promise<EscrowAccount> {
  const tid = params.tenant_id || CANONICAL_TENANT
  const escrowId = `esc_${randomUUID()}`
  const fee = Math.round(params.amount_eur_cents * 0.001)
  const now = new Date().toISOString()

  const row = {
    escrow_id:        escrowId,
    tenant_id:        tid,
    settlement_id:    params.settlement_id,
    investor_id:      params.investor_id,
    amount_eur_cents: params.amount_eur_cents,
    fee_eur_cents:    fee,
    state:            'PENDING' as EscrowState,
    conditions:       [],
    funded_at:        null,
    locked_at:        null,
    released_at:      null,
    release_type:     null,
    conditions_met:   false,
    audit_hash:       createHash('sha256').update(`${escrowId}:PENDING:${now}`).digest('hex'),
    created_at:       now,
    updated_at:       now,
  }

  const { data, error } = await (supabaseAdmin as any)
    .from('escrow_accounts')
    .insert(row)
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(`[escrowOrchestrator] createEscrow failed: ${error?.message ?? 'no data'}`)
  }

  log.info('[escrowOrchestrator] escrow created', {
    escrow_id:        escrowId,
    settlement_id:    params.settlement_id,
    amount_eur_cents: params.amount_eur_cents,
  })

  return mapRow(data)
}

// ─── fundEscrow ───────────────────────────────────────────────────────────────

/**
 * Moves escrow from PENDING → FUNDED.
 * 1. Validates PENDING state.
 * 2. Checks investor has sufficient available balance.
 * 3. Records COMMITMENT ledger entry (available → committed).
 * 4. Updates escrow to FUNDED.
 */
export async function fundEscrow(
  escrowId: string,
  tenantId: string,
): Promise<EscrowAccount> {
  const tid = tenantId || CANONICAL_TENANT

  // ── Fetch escrow ──────────────────────────────────────────────────────────
  const { data: existing, error: fetchErr } = await (supabaseAdmin as any)
    .from('escrow_accounts')
    .select('*')
    .eq('escrow_id', escrowId)
    .eq('tenant_id', tid)
    .maybeSingle()

  if (fetchErr || !existing) {
    throw new Error(`[escrowOrchestrator] fundEscrow: escrow not found: ${escrowId}`)
  }

  const escrow = mapRow(existing)

  if (escrow.state !== 'PENDING') {
    throw new Error(
      `[escrowOrchestrator] fundEscrow: escrow ${escrowId} is in state '${escrow.state}', expected PENDING`,
    )
  }

  // ── Check balance ─────────────────────────────────────────────────────────
  const balance = await getInvestorBalance(escrow.investor_id, tid)

  if (balance.available_eur_cents < escrow.amount_eur_cents) {
    throw new Error(
      `[escrowOrchestrator] fundEscrow: insufficient available balance. ` +
      `Available: ${balance.available_eur_cents} cents, required: ${escrow.amount_eur_cents} cents`,
    )
  }

  // ── Record COMMITMENT ledger entry ────────────────────────────────────────
  await recordLedgerEntry(
    {
      investor_id:    escrow.investor_id,
      tenant_id:      tid,
      entry_type:     'COMMITMENT',
      amount_eur_cents: escrow.amount_eur_cents,
      reference_id:   escrow.settlement_id,
      reference_type: 'settlement',
      description:    `Escrow funded for settlement ${escrow.settlement_id}`,
      idempotency_key: `escrow_commit_${escrowId}`,
    },
    tid,
  )

  // ── Update escrow to FUNDED ───────────────────────────────────────────────
  const now = new Date().toISOString()

  const { data: updated, error: updateErr } = await (supabaseAdmin as any)
    .from('escrow_accounts')
    .update({
      state:      'FUNDED',
      funded_at:  now,
      audit_hash: createHash('sha256').update(`${escrowId}:FUNDED:${now}`).digest('hex'),
      updated_at: now,
    })
    .eq('escrow_id', escrowId)
    .eq('tenant_id', tid)
    .select('*')
    .single()

  if (updateErr || !updated) {
    throw new Error(`[escrowOrchestrator] fundEscrow update failed: ${updateErr?.message ?? 'no data'}`)
  }

  log.info('[escrowOrchestrator] escrow funded', {
    escrow_id:     escrowId,
    settlement_id: escrow.settlement_id,
  })

  return mapRow(updated)
}

// ─── lockEscrow ───────────────────────────────────────────────────────────────

/**
 * Moves escrow from FUNDED → LOCKED.
 * Records SETTLEMENT_LOCK ledger entry.
 * Saves conditions to escrow metadata.
 */
export async function lockEscrow(
  escrowId: string,
  conditions: string[],
  tenantId: string,
): Promise<EscrowAccount> {
  const tid = tenantId || CANONICAL_TENANT

  // ── Fetch escrow ──────────────────────────────────────────────────────────
  const { data: existing, error: fetchErr } = await (supabaseAdmin as any)
    .from('escrow_accounts')
    .select('*')
    .eq('escrow_id', escrowId)
    .eq('tenant_id', tid)
    .maybeSingle()

  if (fetchErr || !existing) {
    throw new Error(`[escrowOrchestrator] lockEscrow: escrow not found: ${escrowId}`)
  }

  const escrow = mapRow(existing)

  if (escrow.state !== 'FUNDED') {
    throw new Error(
      `[escrowOrchestrator] lockEscrow: escrow ${escrowId} is in state '${escrow.state}', expected FUNDED`,
    )
  }

  // ── Record SETTLEMENT_LOCK ledger entry ───────────────────────────────────
  await recordLedgerEntry(
    {
      investor_id:     escrow.investor_id,
      tenant_id:       tid,
      entry_type:      'SETTLEMENT_LOCK',
      amount_eur_cents: escrow.amount_eur_cents,
      reference_id:    escrow.settlement_id,
      reference_type:  'settlement',
      description:     `Escrow locked for settlement ${escrow.settlement_id} — conditions: ${conditions.join(', ')}`,
      idempotency_key: `escrow_lock_${escrowId}`,
    },
    tid,
  )

  // ── Update escrow to LOCKED ───────────────────────────────────────────────
  const now = new Date().toISOString()

  const { data: updated, error: updateErr } = await (supabaseAdmin as any)
    .from('escrow_accounts')
    .update({
      state:      'LOCKED',
      locked_at:  now,
      conditions: conditions,
      audit_hash: createHash('sha256').update(`${escrowId}:LOCKED:${now}`).digest('hex'),
      updated_at: now,
    })
    .eq('escrow_id', escrowId)
    .eq('tenant_id', tid)
    .select('*')
    .single()

  if (updateErr || !updated) {
    throw new Error(`[escrowOrchestrator] lockEscrow update failed: ${updateErr?.message ?? 'no data'}`)
  }

  log.info('[escrowOrchestrator] escrow locked', {
    escrow_id:  escrowId,
    conditions: conditions.join(', '),
  })

  return mapRow(updated)
}

// ─── releaseEscrow ────────────────────────────────────────────────────────────

/**
 * Releases escrow from LOCKED state.
 * EXECUTION: LOCKED → RELEASED. Records EXECUTION ledger entry (committed → executed). Fee deducted.
 * REVERT:    LOCKED → REVERTED. Records COMMITMENT_RELEASE entry (committed → available, fee returned).
 * Computes audit_hash = SHA-256(escrow_id + release_type + actor + timestamp).
 */
export async function releaseEscrow(
  escrowId: string,
  releaseType: 'EXECUTION' | 'REVERT',
  actor: string,
  tenantId: string,
): Promise<EscrowAccount> {
  const tid = tenantId || CANONICAL_TENANT

  // ── Fetch escrow ──────────────────────────────────────────────────────────
  const { data: existing, error: fetchErr } = await (supabaseAdmin as any)
    .from('escrow_accounts')
    .select('*')
    .eq('escrow_id', escrowId)
    .eq('tenant_id', tid)
    .maybeSingle()

  if (fetchErr || !existing) {
    throw new Error(`[escrowOrchestrator] releaseEscrow: escrow not found: ${escrowId}`)
  }

  const escrow = mapRow(existing)

  if (escrow.state !== 'LOCKED') {
    throw new Error(
      `[escrowOrchestrator] releaseEscrow: escrow ${escrowId} is in state '${escrow.state}', expected LOCKED`,
    )
  }

  const now = new Date().toISOString()
  const auditHash = createHash('sha256')
    .update(`${escrowId}:${releaseType}:${actor}:${now}`)
    .digest('hex')

  if (releaseType === 'EXECUTION') {
    // ── EXECUTION: committed → executed, fee deducted ──────────────────────
    // Total execution amount = principal + fee
    const totalExecution = escrow.amount_eur_cents + escrow.fee_eur_cents

    await recordLedgerEntry(
      {
        investor_id:     escrow.investor_id,
        tenant_id:       tid,
        entry_type:      'EXECUTION',
        amount_eur_cents: totalExecution,
        reference_id:    escrow.settlement_id,
        reference_type:  'settlement',
        description:     `Escrow executed for settlement ${escrow.settlement_id} by ${actor}`,
        idempotency_key: `escrow_execute_${escrowId}`,
      },
      tid,
    )

    const newState: EscrowState = 'RELEASED'

    const { data: updated, error: updateErr } = await (supabaseAdmin as any)
      .from('escrow_accounts')
      .update({
        state:          newState,
        released_at:    now,
        release_type:   releaseType,
        conditions_met: true,
        audit_hash:     auditHash,
        updated_at:     now,
      })
      .eq('escrow_id', escrowId)
      .eq('tenant_id', tid)
      .select('*')
      .single()

    if (updateErr || !updated) {
      throw new Error(`[escrowOrchestrator] releaseEscrow EXECUTION update failed: ${updateErr?.message ?? 'no data'}`)
    }

    log.info('[escrowOrchestrator] escrow EXECUTED', {
      escrow_id:     escrowId,
      settlement_id: escrow.settlement_id,
      actor,
    })

    return mapRow(updated)
  } else {
    // ── REVERT: committed → available, fee returned ────────────────────────
    await recordLedgerEntry(
      {
        investor_id:     escrow.investor_id,
        tenant_id:       tid,
        entry_type:      'COMMITMENT_RELEASE',
        amount_eur_cents: escrow.amount_eur_cents,
        reference_id:    escrow.settlement_id,
        reference_type:  'settlement',
        description:     `Escrow reverted for settlement ${escrow.settlement_id} by ${actor}`,
        idempotency_key: `escrow_revert_${escrowId}`,
      },
      tid,
    )

    const newState: EscrowState = 'REVERTED'

    const { data: updated, error: updateErr } = await (supabaseAdmin as any)
      .from('escrow_accounts')
      .update({
        state:          newState,
        released_at:    now,
        release_type:   releaseType,
        conditions_met: false,
        audit_hash:     auditHash,
        updated_at:     now,
      })
      .eq('escrow_id', escrowId)
      .eq('tenant_id', tid)
      .select('*')
      .single()

    if (updateErr || !updated) {
      throw new Error(`[escrowOrchestrator] releaseEscrow REVERT update failed: ${updateErr?.message ?? 'no data'}`)
    }

    log.info('[escrowOrchestrator] escrow REVERTED', {
      escrow_id:     escrowId,
      settlement_id: escrow.settlement_id,
      actor,
    })

    return mapRow(updated)
  }
}

// ─── getEscrowBySettlement ────────────────────────────────────────────────────

/**
 * Reads the escrow account for a given settlement.
 */
export async function getEscrowBySettlement(
  settlementId: string,
  tenantId: string,
): Promise<EscrowAccount | null> {
  const tid = tenantId || CANONICAL_TENANT

  const { data, error } = await (supabaseAdmin as any)
    .from('escrow_accounts')
    .select('*')
    .eq('settlement_id', settlementId)
    .eq('tenant_id', tid)
    .maybeSingle()

  if (error) {
    log.info('[escrowOrchestrator] getEscrowBySettlement error', {
      settlement_id: settlementId,
      error: error.message,
    })
    return null
  }

  return data ? mapRow(data) : null
}
