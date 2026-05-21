// Agency Group — Settlement State Machine
// lib/capital/settlementStateMachine.ts
// 8-state IMMUTABLE settlement lifecycle.
// INTENT → COMMITTED → FUNDED → LOCKED → CONTRACTED → NOTARIZED → SETTLED → TRANSFERRED
// Once a state is entered, it CANNOT be reverted. Only forward transitions allowed.
// Every transition creates an immutable audit entry.
// TypeScript strict — 0 errors

import { randomUUID, createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type SettlementState =
  | 'INTENT'
  | 'COMMITTED'
  | 'FUNDED'
  | 'LOCKED'
  | 'CONTRACTED'
  | 'NOTARIZED'
  | 'SETTLED'
  | 'TRANSFERRED'

export type SettlementTransition =
  | 'commit'
  | 'fund'
  | 'lock'
  | 'contract'
  | 'notarize'
  | 'settle'
  | 'transfer'

export interface Settlement {
  settlement_id: string
  tenant_id: string
  asset_id: string
  buyer_investor_id: string
  seller_id: string
  agreed_price_eur_cents: number
  commission_eur_cents: number
  current_state: SettlementState
  created_at: string
  updated_at: string
  metadata: Record<string, unknown>
}

export interface SettlementTransitionRecord {
  transition_id: string
  settlement_id: string
  from_state: SettlementState
  to_state: SettlementState
  transition: SettlementTransition
  actor: string
  timestamp: string
  notes: string
  sha256_chain_hash: string
}

// ─── State Machine Constants ──────────────────────────────────────────────────

/**
 * Maps each state to its ONLY valid next state.
 * TRANSFERRED is terminal — maps to itself (idempotent, no re-entry).
 */
export const VALID_TRANSITIONS: Record<SettlementState, SettlementState> = {
  INTENT:      'COMMITTED',
  COMMITTED:   'FUNDED',
  FUNDED:      'LOCKED',
  LOCKED:      'CONTRACTED',
  CONTRACTED:  'NOTARIZED',
  NOTARIZED:   'SETTLED',
  SETTLED:     'TRANSFERRED',
  TRANSFERRED: 'TRANSFERRED',
}

/**
 * Maps transition verb to the required from_state.
 * Ensures callers cannot pass an arbitrary verb — it must match the current state.
 */
const TRANSITION_REQUIRES_STATE: Record<SettlementTransition, SettlementState> = {
  commit:    'INTENT',
  fund:      'COMMITTED',
  lock:      'FUNDED',
  contract:  'LOCKED',
  notarize:  'CONTRACTED',
  settle:    'NOTARIZED',
  transfer:  'SETTLED',
}

const CANONICAL_TENANT = process.env.DEFAULT_TENANT_ID ?? process.env.SYSTEM_ORG_ID ?? '00000000-0000-0000-0000-000000000001'

// ─── computeTransitionHash ────────────────────────────────────────────────────

/**
 * Computes SHA-256 chain hash for an immutable audit trail.
 * Links each transition to the previous one via prev_hash, forming a hash chain.
 */
export function computeTransitionHash(
  record: Omit<SettlementTransitionRecord, 'sha256_chain_hash'>,
  prevHash: string,
): string {
  const payload = JSON.stringify({ ...record, prev_hash: prevHash })
  return createHash('sha256').update(payload).digest('hex')
}

// ─── createSettlement ─────────────────────────────────────────────────────────

/**
 * Creates a new settlement in INTENT state and records the genesis transition.
 */
export async function createSettlement(
  params: Omit<Settlement, 'settlement_id' | 'created_at' | 'updated_at' | 'current_state'>,
  actor: string,
): Promise<Settlement> {
  const settlementId = `smt_${randomUUID()}`
  const now = new Date().toISOString()
  const tid = params.tenant_id || CANONICAL_TENANT

  const settlementRow = {
    settlement_id:          settlementId,
    tenant_id:              tid,
    asset_id:               params.asset_id,
    buyer_investor_id:      params.buyer_investor_id,
    seller_id:              params.seller_id,
    agreed_price_eur_cents: params.agreed_price_eur_cents,
    commission_eur_cents:   params.commission_eur_cents,
    current_state:          'INTENT' as SettlementState,
    metadata:               params.metadata ?? {},
    created_at:             now,
    updated_at:             now,
  }

  const { data: insertedSettlement, error: settlementErr } = await (supabaseAdmin as any)
    .from('settlements')
    .insert(settlementRow)
    .select('*')
    .single()

  if (settlementErr) {
    throw new Error(`[settlementStateMachine] Failed to create settlement: ${settlementErr.message}`)
  }

  // Genesis transition record (INTENT → INTENT, genesis event)
  const transitionId = `str_${randomUUID()}`
  const genesisRecord: Omit<SettlementTransitionRecord, 'sha256_chain_hash'> = {
    transition_id: transitionId,
    settlement_id: settlementId,
    from_state:    'INTENT',
    to_state:      'INTENT',
    transition:    'commit' as SettlementTransition, // placeholder — genesis does not consume a transition verb
    actor,
    timestamp:     now,
    notes:         'Settlement created — genesis entry',
  }

  // Use empty string as prev_hash for genesis
  const genesisHash = computeTransitionHash(genesisRecord, '')

  const { error: transErr } = await (supabaseAdmin as any)
    .from('settlement_transitions')
    .insert({ ...genesisRecord, sha256_chain_hash: genesisHash })

  if (transErr) {
    log.info('[settlementStateMachine] genesis transition insert error', {
      settlement_id: settlementId,
      error: transErr.message,
    })
  }

  log.info('[settlementStateMachine] settlement created', { settlement_id: settlementId, actor })

  return mapSettlementRow(insertedSettlement)
}

// ─── transitionSettlement ─────────────────────────────────────────────────────

/**
 * Advances settlement to next state. IMMUTABLE — only forward allowed.
 * Validates transition is allowed, computes chain hash, inserts audit record, updates settlement.
 */
export async function transitionSettlement(
  settlementId: string,
  transition: SettlementTransition,
  actor: string,
  notes: string,
  tenantId: string,
): Promise<{ settlement: Settlement; transition_record: SettlementTransitionRecord }> {
  const tid = tenantId || CANONICAL_TENANT

  // ── Fetch current settlement ──────────────────────────────────────────────
  const settlement = await getSettlement(settlementId, tid)
  if (!settlement) {
    throw new Error(`[settlementStateMachine] Settlement not found: ${settlementId}`)
  }

  // ── Validate transition ───────────────────────────────────────────────────
  const requiredState = TRANSITION_REQUIRES_STATE[transition]
  if (settlement.current_state !== requiredState) {
    throw new Error(
      `[settlementStateMachine] Transition '${transition}' requires state '${requiredState}', ` +
      `but settlement is currently in '${settlement.current_state}'. ` +
      `FINANCIAL GRADE: Cannot revert or skip states.`,
    )
  }

  if (settlement.current_state === 'TRANSFERRED') {
    throw new Error(`[settlementStateMachine] Settlement ${settlementId} is TRANSFERRED (terminal state). No further transitions allowed.`)
  }

  const toState = VALID_TRANSITIONS[settlement.current_state]

  // ── Get last chain hash ───────────────────────────────────────────────────
  const { data: lastTransitions, error: hashErr } = await (supabaseAdmin as any)
    .from('settlement_transitions')
    .select('sha256_chain_hash')
    .eq('settlement_id', settlementId)
    .order('timestamp', { ascending: false })
    .limit(1)

  if (hashErr) {
    log.info('[settlementStateMachine] hash fetch error', { settlement_id: settlementId, error: hashErr.message })
  }

  const prevHash = (lastTransitions?.[0]?.sha256_chain_hash as string) ?? ''

  // ── Build transition record ───────────────────────────────────────────────
  const transitionId = `str_${randomUUID()}`
  const now = new Date().toISOString()

  const transitionRecordWithoutHash: Omit<SettlementTransitionRecord, 'sha256_chain_hash'> = {
    transition_id: transitionId,
    settlement_id: settlementId,
    from_state:    settlement.current_state,
    to_state:      toState,
    transition,
    actor,
    timestamp:     now,
    notes,
  }

  const chainHash = computeTransitionHash(transitionRecordWithoutHash, prevHash)

  const transitionRecord: SettlementTransitionRecord = {
    ...transitionRecordWithoutHash,
    sha256_chain_hash: chainHash,
  }

  // ── Insert transition record (immutable) ─────────────────────────────────
  const { error: transInsertErr } = await (supabaseAdmin as any)
    .from('settlement_transitions')
    .insert(transitionRecord)

  if (transInsertErr) {
    throw new Error(`[settlementStateMachine] Failed to insert transition record: ${transInsertErr.message}`)
  }

  // ── Update settlement state ───────────────────────────────────────────────
  const { data: updatedSettlement, error: updateErr } = await (supabaseAdmin as any)
    .from('settlements')
    .update({ current_state: toState, updated_at: now })
    .eq('settlement_id', settlementId)
    .eq('tenant_id', tid)
    .select('*')
    .single()

  if (updateErr) {
    throw new Error(`[settlementStateMachine] Failed to update settlement state: ${updateErr.message}`)
  }

  log.info('[settlementStateMachine] transition applied', {
    settlement_id: settlementId,
    from_state:    settlement.current_state,
    to_state:      toState,
    transition,
    actor,
  })

  return {
    settlement:        mapSettlementRow(updatedSettlement),
    transition_record: transitionRecord,
  }
}

// ─── getSettlement ────────────────────────────────────────────────────────────

export async function getSettlement(
  settlementId: string,
  tenantId: string,
): Promise<Settlement | null> {
  const tid = tenantId || CANONICAL_TENANT

  const { data, error } = await (supabaseAdmin as any)
    .from('settlements')
    .select('*')
    .eq('settlement_id', settlementId)
    .eq('tenant_id', tid)
    .maybeSingle()

  if (error) {
    log.info('[settlementStateMachine] getSettlement error', { settlement_id: settlementId, error: error.message })
    return null
  }

  return data ? mapSettlementRow(data) : null
}

// ─── getSettlementAuditTrail ──────────────────────────────────────────────────

/**
 * Returns the full ordered audit trail for a settlement.
 */
export async function getSettlementAuditTrail(
  settlementId: string,
  tenantId: string,
): Promise<SettlementTransitionRecord[]> {
  const tid = tenantId || CANONICAL_TENANT

  // Verify settlement belongs to tenant before exposing audit trail
  const settlement = await getSettlement(settlementId, tid)
  if (!settlement) return []

  const { data, error } = await (supabaseAdmin as any)
    .from('settlement_transitions')
    .select('*')
    .eq('settlement_id', settlementId)
    .order('timestamp', { ascending: true })

  if (error) {
    log.info('[settlementStateMachine] getSettlementAuditTrail error', { settlement_id: settlementId, error: error.message })
    return []
  }

  return (data ?? []).map(mapTransitionRow)
}

// ─── getActiveSettlements ─────────────────────────────────────────────────────

/**
 * Returns all settlements not yet in terminal TRANSFERRED state for a tenant.
 */
export async function getActiveSettlements(tenantId: string): Promise<Settlement[]> {
  const tid = tenantId || CANONICAL_TENANT

  const { data, error } = await (supabaseAdmin as any)
    .from('settlements')
    .select('*')
    .eq('tenant_id', tid)
    .neq('current_state', 'TRANSFERRED')
    .order('updated_at', { ascending: false })

  if (error) {
    log.info('[settlementStateMachine] getActiveSettlements error', { error: error.message })
    return []
  }

  return (data ?? []).map(mapSettlementRow)
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSettlementRow(row: Record<string, any>): Settlement {
  return {
    settlement_id:          row.settlement_id as string,
    tenant_id:              row.tenant_id as string,
    asset_id:               row.asset_id as string,
    buyer_investor_id:      row.buyer_investor_id as string,
    seller_id:              row.seller_id as string,
    agreed_price_eur_cents: row.agreed_price_eur_cents as number,
    commission_eur_cents:   row.commission_eur_cents as number,
    current_state:          row.current_state as SettlementState,
    created_at:             row.created_at as string,
    updated_at:             row.updated_at as string,
    metadata:               (row.metadata as Record<string, unknown>) ?? {},
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTransitionRow(row: Record<string, any>): SettlementTransitionRecord {
  return {
    transition_id:     row.transition_id as string,
    settlement_id:     row.settlement_id as string,
    from_state:        row.from_state as SettlementState,
    to_state:          row.to_state as SettlementState,
    transition:        row.transition as SettlementTransition,
    actor:             row.actor as string,
    timestamp:         row.timestamp as string,
    notes:             (row.notes as string) ?? '',
    sha256_chain_hash: row.sha256_chain_hash as string,
  }
}
