// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — Settlement Tracker
// lib/capital/settlementTracker.ts
//
// State machine for tracking real estate transaction settlement stages.
// Persists stage history as JSONB. Computes days_in_current_stage on read.
//
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type SettlementStage =
  | 'investor_committed'
  | 'capital_locked'
  | 'legal_in_progress'
  | 'legal_signed'
  | 'notarial_scheduled'
  | 'notarial_complete'
  | 'settlement_confirmed'
  | 'asset_transferred'
  | 'cancelled'
  | 'disputed'

export interface SettlementRecord {
  id:                    string
  tenant_id:             string
  transaction_id:        string
  property_id:           string
  investor_id:           string
  stage:                 SettlementStage
  amount_eur:            number
  stage_history:         Array<{ stage: SettlementStage; entered_at: string; notes?: string }>
  target_close_date:     string | null
  actual_close_date:     string | null
  days_in_current_stage: number
  created_at:            string
  updated_at:            string
}

// ─── Internal row shape ───────────────────────────────────────────────────────

interface SettlementRow {
  id:                string
  tenant_id:         string
  transaction_id:    string
  property_id:       string
  investor_id:       string
  stage:             string
  amount_eur:        number
  stage_history:     Array<{ stage: string; entered_at: string; notes?: string }>
  target_close_date: string | null
  actual_close_date: string | null
  created_at:        string
  updated_at:        string
}

// ─── computeDaysInStage ───────────────────────────────────────────────────────

function computeDaysInStage(stageHistory: Array<{ entered_at: string }>): number {
  if (stageHistory.length === 0) return 0
  const lastEntry = stageHistory[stageHistory.length - 1]
  if (!lastEntry) return 0
  const enteredAt = new Date(lastEntry.entered_at).getTime()
  return Math.floor((Date.now() - enteredAt) / 86400000)
}

// ─── rowToRecord ──────────────────────────────────────────────────────────────

function rowToRecord(row: SettlementRow): SettlementRecord {
  const typedHistory = row.stage_history.map(h => ({
    stage:      h.stage as SettlementStage,
    entered_at: h.entered_at,
    ...(h.notes !== undefined ? { notes: h.notes } : {}),
  }))

  return {
    id:                    row.id,
    tenant_id:             row.tenant_id,
    transaction_id:        row.transaction_id,
    property_id:           row.property_id,
    investor_id:           row.investor_id,
    stage:                 row.stage as SettlementStage,
    amount_eur:            row.amount_eur,
    stage_history:         typedHistory,
    target_close_date:     row.target_close_date,
    actual_close_date:     row.actual_close_date,
    days_in_current_stage: computeDaysInStage(row.stage_history),
    created_at:            row.created_at,
    updated_at:            row.updated_at,
  }
}

// ─── createSettlementRecord ───────────────────────────────────────────────────

export async function createSettlementRecord(
  tenantId: string,
  params: {
    transaction_id:    string
    property_id:       string
    investor_id:       string
    amount_eur:        number
    target_close_date?: string
  },
): Promise<SettlementRecord> {
  const db  = supabaseAdmin as any
  const now = new Date().toISOString()

  const initialStage: SettlementStage = 'investor_committed'
  const initialHistory = [{ stage: initialStage, entered_at: now }]

  const { data, error } = await (db
    .from('settlement_records')
    .insert({
      tenant_id:         tenantId,
      transaction_id:    params.transaction_id,
      property_id:       params.property_id,
      investor_id:       params.investor_id,
      stage:             initialStage,
      amount_eur:        params.amount_eur,
      stage_history:     initialHistory,
      target_close_date: params.target_close_date ?? null,
      actual_close_date: null,
    })
    .select()
    .single() as Promise<{ data: SettlementRow | null; error: { message: string } | null }>)

  if (error || !data) {
    const msg = error?.message ?? 'no data returned'
    log.warn('[settlementTracker] createSettlementRecord failed', { transaction_id: params.transaction_id, error: msg })
    throw new Error(`createSettlementRecord failed: ${msg}`)
  }

  log.info('[settlementTracker] created', { id: data.id, stage: initialStage })
  return rowToRecord(data)
}

// ─── advanceSettlementStage ───────────────────────────────────────────────────

export async function advanceSettlementStage(
  tenantId: string,
  settlementId: string,
  newStage: SettlementStage,
  notes?: string,
): Promise<SettlementRecord> {
  const db  = supabaseAdmin as any
  const now = new Date().toISOString()

  // Fetch current record to append history
  const { data: current, error: fetchErr } = await (db
    .from('settlement_records')
    .select('*')
    .eq('id', settlementId)
    .eq('tenant_id', tenantId)
    .single() as Promise<{ data: SettlementRow | null; error: { message: string } | null }>)

  if (fetchErr || !current) {
    const msg = fetchErr?.message ?? 'not found'
    log.warn('[settlementTracker] advanceSettlementStage: record not found', { settlement_id: settlementId, error: msg })
    throw new Error(`Settlement record not found: ${msg}`)
  }

  const historyEntry: { stage: SettlementStage; entered_at: string; notes?: string } = {
    stage:      newStage,
    entered_at: now,
  }
  if (notes) historyEntry.notes = notes

  const updatedHistory = [...current.stage_history, historyEntry]

  // Set actual_close_date when asset is transferred
  const actualCloseDate = newStage === 'asset_transferred' ? now.split('T')[0] ?? null : current.actual_close_date

  const { data: updated, error: updateErr } = await (db
    .from('settlement_records')
    .update({
      stage:             newStage,
      stage_history:     updatedHistory,
      actual_close_date: actualCloseDate,
      updated_at:        now,
    })
    .eq('id', settlementId)
    .eq('tenant_id', tenantId)
    .select()
    .single() as Promise<{ data: SettlementRow | null; error: { message: string } | null }>)

  if (updateErr || !updated) {
    const msg = updateErr?.message ?? 'no data returned'
    log.warn('[settlementTracker] advanceSettlementStage update failed', { settlement_id: settlementId, error: msg })
    throw new Error(`advanceSettlementStage failed: ${msg}`)
  }

  log.info('[settlementTracker] stage advanced', { id: settlementId, newStage })
  return rowToRecord(updated)
}

// ─── getSettlement ────────────────────────────────────────────────────────────

export async function getSettlement(
  tenantId: string,
  transactionId: string,
): Promise<SettlementRecord | null> {
  const db = supabaseAdmin as any

  const { data, error } = await (db
    .from('settlement_records')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('transaction_id', transactionId)
    .single() as Promise<{ data: SettlementRow | null; error: { message: string } | null }>)

  if (error || !data) return null
  return rowToRecord(data)
}

// ─── getActiveSettlements ─────────────────────────────────────────────────────

export async function getActiveSettlements(tenantId: string): Promise<SettlementRecord[]> {
  const db = supabaseAdmin as any

  const terminalStages: SettlementStage[] = ['asset_transferred', 'cancelled', 'disputed']

  const { data, error } = await (db
    .from('settlement_records')
    .select('*')
    .eq('tenant_id', tenantId)
    .not('stage', 'in', `(${terminalStages.map(s => `"${s}"`).join(',')})`)
    .order('created_at', { ascending: false }) as Promise<{ data: SettlementRow[] | null; error: { message: string } | null }>)

  if (error) {
    log.warn('[settlementTracker] getActiveSettlements failed', { error: error.message })
    return []
  }

  return (data ?? []).map(rowToRecord)
}
