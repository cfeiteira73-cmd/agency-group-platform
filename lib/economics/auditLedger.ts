// =============================================================================
// Agency Group — Immutable Financial Audit Ledger
// lib/economics/auditLedger.ts
//
// Append-only audit trail with SHA-256 hash chain for tamper evidence.
// Every euro is traced from lead qualification to commission payment.
//
// INVARIANTS:
//   - Once written, entries CANNOT be modified or deleted (INSERT only)
//   - Sequence numbers are monotonically increasing per tenant
//   - Hash chain: each entry hashes (previous_hash + entry_data)
//   - All financial computations are deterministic and reproducible from ledger alone
//
// AMI: 22506 | SH-ROS | TypeScript strict — 0 errors
// =============================================================================

import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type LedgerEntryType =
  | 'lead_qualified'          // lead enters pipeline with estimated value
  | 'match_created'           // property ↔ investor match
  | 'deal_created'            // deal object created
  | 'deal_stage_advanced'     // stage change event
  | 'bid_submitted'           // investor bid recorded
  | 'cpcv_signed'             // CPCV signed — 50% revenue recognition
  | 'escritura_completed'     // Escritura — 50% revenue recognition
  | 'revenue_recognized'      // revenue recognition event
  | 'commission_calculated'   // commission computed
  | 'commission_paid'         // commission actually paid
  | 'deal_lost'               // deal failed — lost opportunity cost
  | 'adjustment'              // manual correction with approval
  | 'reversal'                // reversal of previous entry (with reference)

export interface LedgerEntry {
  entry_id: string            // UUID, immutable
  tenant_id: string
  sequence_number: number     // monotonically increasing per tenant (for ordering)

  entry_type: LedgerEntryType

  // Entity references
  deal_id: string | null
  property_id: string | null
  investor_id: string | null
  lead_id: string | null
  agent_id: string | null

  // Financial data
  gross_value_eur: number | null      // deal value / property price
  commission_rate_pct: number | null  // 5%, 4.5%, 4%
  commission_gross_eur: number | null // gross commission before VAT
  vat_eur: number | null              // IVA at 23%
  commission_net_eur: number | null   // net to agency
  agent_split_eur: number | null      // agent's portion
  agency_split_eur: number | null     // agency's portion

  // Recognition
  recognition_pct: number | null      // 50 for CPCV, 50 for Escritura
  cumulative_recognized_pct: number | null

  // Metadata
  previous_entry_id: string | null    // for reversals
  correlation_id: string
  recorded_by: string                 // 'system' | 'agent_email' | 'admin_email'
  recorded_at: string                 // immutable creation timestamp
  notes: string | null

  // Hash chain (tamper evidence)
  entry_hash: string    // SHA-256(previous_hash + entry_data)
  previous_hash: string
}

// Partial type for callers — entry_id, sequence_number, recorded_at, hashes are computed internally
export type AppendEntryInput = Omit<LedgerEntry, 'entry_id' | 'sequence_number' | 'recorded_at' | 'entry_hash' | 'previous_hash'>

// ─── Genesis hash (block-0 sentinel) ─────────────────────────────────────────

const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000'

// ─── Hash computation ─────────────────────────────────────────────────────────

function computeEntryHash(previousHash: string, entryData: Record<string, unknown>): string {
  // Deterministic: sort keys to avoid key-ordering variance
  const payload = previousHash + JSON.stringify(entryData, Object.keys(entryData).sort())
  return createHash('sha256').update(payload).digest('hex')
}

// ─── Internal Supabase helper ─────────────────────────────────────────────────

function getLedgerClient() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabaseAdmin as any
}

// ─── appendEntry ─────────────────────────────────────────────────────────────

/**
 * Append one immutable entry to the financial_ledger.
 *
 * Steps:
 *   1. Fetch last entry for tenant (for hash chain continuity + next sequence_number)
 *   2. Build deterministic entry_data record
 *   3. Compute entry_hash = SHA-256(previous_hash + sorted(entry_data))
 *   4. INSERT into financial_ledger (never UPDATE)
 *
 * @throws if Supabase insert fails — callers must treat commission/revenue entries as critical
 */
export async function appendEntry(input: AppendEntryInput): Promise<LedgerEntry> {
  const client = getLedgerClient()

  // 1. Get the last entry for this tenant to establish chain continuity
  const { data: lastEntry, error: lastError } = await client
    .from('financial_ledger')
    .select('sequence_number, entry_hash, entry_id')
    .eq('tenant_id', input.tenant_id)
    .order('sequence_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (lastError) {
    log.warn('[auditLedger] Failed to fetch last entry for hash chain', {
      error: lastError.message,
      deal_id: input.deal_id,
    })
  }

  const previousHash: string       = (lastEntry as { entry_hash?: string } | null)?.entry_hash ?? GENESIS_HASH
  const previousSeq: number        = (lastEntry as { sequence_number?: number } | null)?.sequence_number ?? 0
  const previousEntryDbId: string | null = (lastEntry as { entry_id?: string } | null)?.entry_id ?? null

  const nextSeq    = previousSeq + 1
  const recordedAt = new Date().toISOString()
  const entryId    = crypto.randomUUID()

  // 2. Build the canonical entry_data object for hashing
  //    All fields included to ensure any tampering changes the hash
  const entryData: Record<string, unknown> = {
    entry_id:                  entryId,
    tenant_id:                 input.tenant_id,
    sequence_number:           nextSeq,
    entry_type:                input.entry_type,
    deal_id:                   input.deal_id,
    property_id:               input.property_id,
    investor_id:               input.investor_id,
    lead_id:                   input.lead_id,
    agent_id:                  input.agent_id,
    gross_value_eur:           input.gross_value_eur,
    commission_rate_pct:       input.commission_rate_pct,
    commission_gross_eur:      input.commission_gross_eur,
    vat_eur:                   input.vat_eur,
    commission_net_eur:        input.commission_net_eur,
    agent_split_eur:           input.agent_split_eur,
    agency_split_eur:          input.agency_split_eur,
    recognition_pct:           input.recognition_pct,
    cumulative_recognized_pct: input.cumulative_recognized_pct,
    previous_entry_id:         input.previous_entry_id,
    correlation_id:            input.correlation_id,
    recorded_by:               input.recorded_by,
    recorded_at:               recordedAt,
    notes:                     input.notes,
  }

  // 3. Compute tamper-evident hash
  const entryHash = computeEntryHash(previousHash, entryData)

  // 4. INSERT — no UPDATE, ever
  const record: LedgerEntry = {
    ...(entryData as Omit<LedgerEntry, 'entry_hash' | 'previous_hash'>),
    entry_hash:    entryHash,
    previous_hash: previousHash,
    // Override previous_entry_id for reversals: caller can pass it explicitly,
    // otherwise we leave it as the caller supplied value (may be null)
    previous_entry_id: input.previous_entry_id ?? null,
  }

  const { data, error } = await client
    .from('financial_ledger')
    .insert({
      entry_id:                  record.entry_id,
      tenant_id:                 record.tenant_id,
      sequence_number:           record.sequence_number,
      entry_type:                record.entry_type,
      deal_id:                   record.deal_id,
      property_id:               record.property_id,
      investor_id:               record.investor_id,
      lead_id:                   record.lead_id,
      agent_id:                  record.agent_id,
      gross_value_eur:           record.gross_value_eur,
      commission_rate_pct:       record.commission_rate_pct,
      commission_gross_eur:      record.commission_gross_eur,
      vat_eur:                   record.vat_eur,
      commission_net_eur:        record.commission_net_eur,
      agent_split_eur:           record.agent_split_eur,
      agency_split_eur:          record.agency_split_eur,
      recognition_pct:           record.recognition_pct,
      cumulative_recognized_pct: record.cumulative_recognized_pct,
      previous_entry_id:         record.previous_entry_id,
      correlation_id:            record.correlation_id,
      recorded_by:               record.recorded_by,
      recorded_at:               record.recorded_at,
      notes:                     record.notes,
      entry_hash:                record.entry_hash,
      previous_hash:             record.previous_hash,
    })
    .select()
    .single()

  if (error) {
    // Sequence conflict on concurrent insert — retry once with fresh sequence
    if (error.code === '23505' && error.message?.includes('sequence_number')) {
      log.warn('[auditLedger] Sequence conflict — retrying with fresh sequence', {
        tenant_id: input.tenant_id,
        error:     error.message,
      })
      return appendEntry(input)
    }

    log.error('[auditLedger] INSERT failed', new Error(error.message), {
      tenant_id:  input.tenant_id,
      deal_id:    input.deal_id,
      entry_type: input.entry_type,
      error:      error.message,
    })
    throw new Error(`[auditLedger] Ledger write failed: ${error.message}`)
  }

  log.revenue('[auditLedger] entry appended', {
    deal_id:     record.deal_id,
    entry_type:  record.entry_type,
    sequence:    record.sequence_number,
    tenant_id:   record.tenant_id,
  })

  return (data as LedgerEntry) ?? record
}

// ─── getDealLedger ────────────────────────────────────────────────────────────

/**
 * Return all ledger entries for a deal, ordered by sequence_number ascending.
 * Full audit trail for one deal from creation to commission payment.
 */
export async function getDealLedger(dealId: string, tenantId: string): Promise<LedgerEntry[]> {
  const client = getLedgerClient()

  const { data, error } = await client
    .from('financial_ledger')
    .select('*')
    .eq('deal_id', dealId)
    .eq('tenant_id', tenantId)
    .order('sequence_number', { ascending: true })

  if (error) {
    log.warn('[auditLedger] getDealLedger failed', { error: error.message, deal_id: dealId })
    return []
  }

  return (data ?? []) as LedgerEntry[]
}

// ─── verifyLedgerIntegrity ────────────────────────────────────────────────────

export interface LedgerIntegrityReport {
  is_valid: boolean
  entries_checked: number
  first_invalid_sequence: number | null
  error: string | null
}

/**
 * Replay hash chain from start (or fromSequence) and verify every entry's hash.
 * O(n) operation — use sparingly; designed for scheduled audit runs, not hot path.
 *
 * Returns is_valid=true only if every hash in the chain matches.
 */
export async function verifyLedgerIntegrity(
  tenantId: string,
  fromSequence = 1,
): Promise<LedgerIntegrityReport> {
  const client = getLedgerClient()

  // Fetch entries in batches to avoid memory pressure on large ledgers
  const BATCH_SIZE = 500
  let offset       = 0
  let entriesChecked = 0
  let runningHash  = GENESIS_HASH
  let firstInvalidSeq: number | null = null

  // If fromSequence > 1, seed the running hash from the entry just before
  if (fromSequence > 1) {
    const { data: prevEntry, error: prevErr } = await client
      .from('financial_ledger')
      .select('entry_hash, sequence_number')
      .eq('tenant_id', tenantId)
      .eq('sequence_number', fromSequence - 1)
      .maybeSingle()

    if (prevErr || !prevEntry) {
      return {
        is_valid: false,
        entries_checked: 0,
        first_invalid_sequence: fromSequence - 1,
        error: `Cannot seed hash: entry at sequence ${fromSequence - 1} not found`,
      }
    }
    runningHash = (prevEntry as { entry_hash: string }).entry_hash
  }

  while (true) {
    const { data: batch, error: batchErr } = await client
      .from('financial_ledger')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('sequence_number', fromSequence + offset)
      .order('sequence_number', { ascending: true })
      .limit(BATCH_SIZE)

    if (batchErr) {
      return {
        is_valid: false,
        entries_checked: entriesChecked,
        first_invalid_sequence: null,
        error: `Batch fetch failed: ${batchErr.message}`,
      }
    }

    const entries = (batch ?? []) as LedgerEntry[]
    if (entries.length === 0) break

    for (const entry of entries) {
      // Rebuild entry_data exactly as appendEntry would have hashed it
      const entryData: Record<string, unknown> = {
        entry_id:                  entry.entry_id,
        tenant_id:                 entry.tenant_id,
        sequence_number:           entry.sequence_number,
        entry_type:                entry.entry_type,
        deal_id:                   entry.deal_id,
        property_id:               entry.property_id,
        investor_id:               entry.investor_id,
        lead_id:                   entry.lead_id,
        agent_id:                  entry.agent_id,
        gross_value_eur:           entry.gross_value_eur,
        commission_rate_pct:       entry.commission_rate_pct,
        commission_gross_eur:      entry.commission_gross_eur,
        vat_eur:                   entry.vat_eur,
        commission_net_eur:        entry.commission_net_eur,
        agent_split_eur:           entry.agent_split_eur,
        agency_split_eur:          entry.agency_split_eur,
        recognition_pct:           entry.recognition_pct,
        cumulative_recognized_pct: entry.cumulative_recognized_pct,
        previous_entry_id:         entry.previous_entry_id,
        correlation_id:            entry.correlation_id,
        recorded_by:               entry.recorded_by,
        recorded_at:               entry.recorded_at,
        notes:                     entry.notes,
      }

      const expectedHash = computeEntryHash(runningHash, entryData)

      if (entry.entry_hash !== expectedHash) {
        return {
          is_valid: false,
          entries_checked: entriesChecked + 1,
          first_invalid_sequence: entry.sequence_number,
          error: `Hash mismatch at sequence ${entry.sequence_number}: expected ${expectedHash.slice(0, 16)}… got ${entry.entry_hash.slice(0, 16)}…`,
        }
      }

      if (entry.previous_hash !== runningHash) {
        return {
          is_valid: false,
          entries_checked: entriesChecked + 1,
          first_invalid_sequence: entry.sequence_number,
          error: `previous_hash broken at sequence ${entry.sequence_number}`,
        }
      }

      runningHash = entry.entry_hash
      entriesChecked++
    }

    if (entries.length < BATCH_SIZE) break
    offset += BATCH_SIZE
  }

  return {
    is_valid: firstInvalidSeq === null,
    entries_checked: entriesChecked,
    first_invalid_sequence: firstInvalidSeq,
    error: null,
  }
}

// ─── computeRevenueReconciliation ─────────────────────────────────────────────

export interface RevenueReconciliation {
  total_deals: number
  total_gross_value_eur: number
  total_commission_gross_eur: number
  total_vat_eur: number
  total_commission_net_eur: number
  total_agent_splits_eur: number
  total_agency_revenue_eur: number
  by_agent: Array<{ agent_id: string; commission_eur: number; deal_count: number }>
  by_month: Array<{ month: string; revenue_eur: number }>
  lost_opportunity_eur: number
}

/**
 * Pure computation from ledger entries — fully reproducible from ledger alone.
 * Covers entries where recorded_at falls within [fromDate, toDate].
 *
 * Uses only 'commission_calculated' entries for financial aggregation
 * (single authoritative source per deal) and 'deal_lost' for lost opportunity.
 */
export async function computeRevenueReconciliation(
  tenantId: string,
  fromDate: string,
  toDate: string,
): Promise<RevenueReconciliation> {
  const client = getLedgerClient()

  // Fetch commission_calculated entries in date range
  const { data: commEntries, error: commErr } = await client
    .from('financial_ledger')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('entry_type', 'commission_calculated')
    .gte('recorded_at', fromDate)
    .lte('recorded_at', toDate)
    .order('recorded_at', { ascending: true })

  if (commErr) {
    log.warn('[auditLedger] computeRevenueReconciliation commission fetch failed', { error: commErr.message })
  }

  // Fetch deal_lost entries in date range
  const { data: lostEntries, error: lostErr } = await client
    .from('financial_ledger')
    .select('gross_value_eur')
    .eq('tenant_id', tenantId)
    .eq('entry_type', 'deal_lost')
    .gte('recorded_at', fromDate)
    .lte('recorded_at', toDate)

  if (lostErr) {
    log.warn('[auditLedger] computeRevenueReconciliation lost fetch failed', { error: lostErr.message })
  }

  const entries = (commEntries ?? []) as LedgerEntry[]
  const lost    = (lostEntries ?? []) as Array<{ gross_value_eur: number | null }>

  // Aggregate totals
  let totalGrossValue      = 0
  let totalCommGross       = 0
  let totalVat             = 0
  let totalCommNet         = 0
  let totalAgentSplits     = 0
  let totalAgencySplits    = 0
  const dealIds            = new Set<string>()
  const byAgent: Record<string, { commission_eur: number; deal_count: number }> = {}
  const byMonth: Record<string, number> = {}

  for (const e of entries) {
    if (e.deal_id) dealIds.add(e.deal_id)

    totalGrossValue   += e.gross_value_eur       ?? 0
    totalCommGross    += e.commission_gross_eur   ?? 0
    totalVat          += e.vat_eur               ?? 0
    totalCommNet      += e.commission_net_eur     ?? 0
    totalAgentSplits  += e.agent_split_eur        ?? 0
    totalAgencySplits += e.agency_split_eur       ?? 0

    // By agent
    if (e.agent_id) {
      const ag = byAgent[e.agent_id] ?? { commission_eur: 0, deal_count: 0 }
      ag.commission_eur += e.agent_split_eur ?? 0
      ag.deal_count     += 1
      byAgent[e.agent_id] = ag
    }

    // By month (YYYY-MM)
    const month = e.recorded_at.slice(0, 7)
    byMonth[month] = (byMonth[month] ?? 0) + (e.commission_net_eur ?? 0)
  }

  const lostOpportunityEur = lost.reduce((sum, r) => sum + (r.gross_value_eur ?? 0), 0)

  return {
    total_deals:              dealIds.size,
    total_gross_value_eur:    Math.round(totalGrossValue * 100) / 100,
    total_commission_gross_eur: Math.round(totalCommGross * 100) / 100,
    total_vat_eur:            Math.round(totalVat * 100) / 100,
    total_commission_net_eur: Math.round(totalCommNet * 100) / 100,
    total_agent_splits_eur:   Math.round(totalAgentSplits * 100) / 100,
    total_agency_revenue_eur: Math.round(totalAgencySplits * 100) / 100,
    by_agent: Object.entries(byAgent).map(([agent_id, v]) => ({
      agent_id,
      commission_eur: Math.round(v.commission_eur * 100) / 100,
      deal_count:     v.deal_count,
    })).sort((a, b) => b.commission_eur - a.commission_eur),
    by_month: Object.entries(byMonth).map(([month, revenue_eur]) => ({
      month,
      revenue_eur: Math.round(revenue_eur * 100) / 100,
    })).sort((a, b) => a.month.localeCompare(b.month)),
    lost_opportunity_eur: Math.round(lostOpportunityEur * 100) / 100,
  }
}
