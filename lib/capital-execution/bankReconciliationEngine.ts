// Agency Group — Bank Reconciliation Engine
// lib/capital-execution/bankReconciliationEngine.ts
// Cross-references ledger entries with PSP intents and bank statement imports.
// TypeScript strict — 0 errors

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReconciliationEntry {
  entry_id: string
  ledger_entry_id: string
  bank_statement_ref: string | null
  psp_ref: string | null
  amount_eur_cents: number
  ledger_amount_eur_cents: number
  discrepancy_eur_cents: number
  status: 'MATCHED' | 'DISCREPANCY' | 'MISSING_BANK' | 'MISSING_LEDGER' | 'PENDING'
  reconciled_at: string | null
}

export interface ReconciliationRun {
  run_id: string
  tenant_id: string
  period_start: string
  period_end: string
  total_entries: number
  matched: number
  discrepancies: number
  missing_bank: number
  missing_ledger: number
  total_discrepancy_eur_cents: number
  status: 'COMPLETED' | 'PARTIAL' | 'FAILED'
  run_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rowToRun(row: Record<string, unknown>): ReconciliationRun {
  return {
    run_id: row.run_id as string,
    tenant_id: row.tenant_id as string,
    period_start: row.period_start as string,
    period_end: row.period_end as string,
    total_entries: row.total_entries as number,
    matched: row.matched as number,
    discrepancies: row.discrepancies as number,
    missing_bank: row.missing_bank as number,
    missing_ledger: row.missing_ledger as number,
    total_discrepancy_eur_cents: row.total_discrepancy_eur_cents as number,
    status: row.status as ReconciliationRun['status'],
    run_at: row.run_at as string,
  }
}

function rowToEntry(row: Record<string, unknown>): ReconciliationEntry {
  return {
    entry_id: row.entry_id as string,
    ledger_entry_id: row.ledger_entry_id as string,
    bank_statement_ref: (row.bank_statement_ref as string | null) ?? null,
    psp_ref: (row.psp_ref as string | null) ?? null,
    amount_eur_cents: row.amount_eur_cents as number,
    ledger_amount_eur_cents: row.ledger_amount_eur_cents as number,
    discrepancy_eur_cents: row.discrepancy_eur_cents as number,
    status: row.status as ReconciliationEntry['status'],
    reconciled_at: (row.reconciled_at as string | null) ?? null,
  }
}

// ─── runReconciliation ────────────────────────────────────────────────────────

/**
 * Reads ledger entries, cross-references with PSP intents + bank statements,
 * generates reconciliation entries, persists run.
 */
export async function runReconciliation(
  tenantId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<ReconciliationRun> {
  const runId = `rec_${randomUUID()}`
  const now = new Date().toISOString()

  try {
    // 1. Fetch ledger entries for period
    const { data: ledgerData, error: ledgerErr } = await (supabaseAdmin as any)
      .from('investor_ledger_entries')
      .select('id, amount_eur_cents, reference, created_at')
      .eq('tenant_id', tenantId)
      .gte('created_at', periodStart.toISOString())
      .lte('created_at', periodEnd.toISOString())

    if (ledgerErr) throw new Error(`Ledger fetch failed: ${(ledgerErr as { message: string }).message}`)

    // 2. Fetch PSP intents for period
    const { data: pspData } = await (supabaseAdmin as any)
      .from('psp_payment_intents')
      .select('intent_id, external_ref, amount_eur_cents, status')
      .eq('tenant_id', tenantId)
      .gte('created_at', periodStart.toISOString())
      .lte('created_at', periodEnd.toISOString())

    // 3. Fetch bank statement imports for period
    const { data: bankData } = await (supabaseAdmin as any)
      .from('bank_statement_imports')
      .select('ref, amount_eur_cents, statement_date')
      .eq('tenant_id', tenantId)
      .gte('statement_date', periodStart.toISOString())
      .lte('statement_date', periodEnd.toISOString())

    const ledgerEntries = (ledgerData as Array<{ id: string; amount_eur_cents: number; reference: string; created_at: string }>) ?? []
    const pspIntents = (pspData as Array<{ intent_id: string; external_ref: string; amount_eur_cents: number; status: string }>) ?? []
    const bankImports = (bankData as Array<{ ref: string; amount_eur_cents: number; statement_date: string }>) ?? []

    // Build lookup maps
    const bankRefMap = new Map<string, number>(bankImports.map((b) => [b.ref, b.amount_eur_cents]))
    const pspRefMap = new Map<string, { intent_id: string; amount_eur_cents: number }>(
      pspIntents.map((p) => [p.external_ref, { intent_id: p.intent_id, amount_eur_cents: p.amount_eur_cents }])
    )

    const reconciliationEntries: ReconciliationEntry[] = []
    let matched = 0
    let discrepancies = 0
    let missing_bank = 0
    let total_discrepancy = 0

    for (const ledger of ledgerEntries) {
      const entryId = `re_${randomUUID()}`
      const pspMatch = pspRefMap.get(ledger.reference)
      const bankAmount = bankRefMap.get(ledger.reference) ?? pspMatch?.amount_eur_cents

      let status: ReconciliationEntry['status'] = 'PENDING'
      let discrepancy = 0

      if (bankAmount !== undefined) {
        discrepancy = ledger.amount_eur_cents - bankAmount
        if (discrepancy === 0) {
          status = 'MATCHED'
          matched++
        } else {
          status = 'DISCREPANCY'
          discrepancies++
          total_discrepancy += Math.abs(discrepancy)
        }
      } else {
        status = 'MISSING_BANK'
        missing_bank++
        discrepancy = ledger.amount_eur_cents
        total_discrepancy += Math.abs(discrepancy)
      }

      reconciliationEntries.push({
        entry_id: entryId,
        ledger_entry_id: ledger.id,
        bank_statement_ref: bankRefMap.has(ledger.reference) ? ledger.reference : null,
        psp_ref: pspMatch?.intent_id ?? null,
        amount_eur_cents: bankAmount ?? 0,
        ledger_amount_eur_cents: ledger.amount_eur_cents,
        discrepancy_eur_cents: discrepancy,
        status,
        reconciled_at: status === 'MATCHED' ? now : null,
      })
    }

    const total_entries = ledgerEntries.length
    const runStatus: ReconciliationRun['status'] =
      discrepancies === 0 && missing_bank === 0 ? 'COMPLETED' : 'PARTIAL'

    const run: ReconciliationRun = {
      run_id: runId,
      tenant_id: tenantId,
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      total_entries,
      matched,
      discrepancies,
      missing_bank,
      missing_ledger: 0,
      total_discrepancy_eur_cents: total_discrepancy,
      status: runStatus,
      run_at: now,
    }

    // Persist run
    const { error: runErr } = await (supabaseAdmin as any)
      .from('bank_reconciliation_runs')
      .insert({
        run_id: runId,
        tenant_id: tenantId,
        period_start: run.period_start,
        period_end: run.period_end,
        total_entries,
        matched,
        discrepancies,
        missing_bank,
        missing_ledger: 0,
        total_discrepancy_eur_cents: total_discrepancy,
        status: runStatus,
        run_at: now,
      })

    if (runErr) {
      log.error('[bank-reconciliation] failed to persist run', runErr, { run_id: runId })
    }

    // Persist entries (batch)
    if (reconciliationEntries.length > 0) {
      void (supabaseAdmin as any)
        .from('bank_reconciliation_entries')
        .insert(
          reconciliationEntries.map((e) => ({
            entry_id: e.entry_id,
            tenant_id: tenantId,
            run_id: runId,
            ledger_entry_id: e.ledger_entry_id,
            bank_statement_ref: e.bank_statement_ref,
            psp_ref: e.psp_ref,
            amount_eur_cents: e.amount_eur_cents,
            ledger_amount_eur_cents: e.ledger_amount_eur_cents,
            discrepancy_eur_cents: e.discrepancy_eur_cents,
            status: e.status,
            reconciled_at: e.reconciled_at,
          }))
        )
        .then(({ error: insErr }: { error: unknown }) => {
          if (insErr) log.warn('[bank-reconciliation] entries insert failed', { run_id: runId })
        })
        .catch((e: unknown) => log.warn('[bank-reconciliation] entries fire-and-forget', { error: String(e) }))
    }

    log.info('[bank-reconciliation] run complete', { run_id: runId, matched, discrepancies, total_entries })
    return run
  } catch (e) {
    log.error('[bank-reconciliation] runReconciliation failed', e instanceof Error ? e : new Error(String(e)), { tenant_id: tenantId })

    const failedRun: ReconciliationRun = {
      run_id: runId,
      tenant_id: tenantId,
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      total_entries: 0,
      matched: 0,
      discrepancies: 0,
      missing_bank: 0,
      missing_ledger: 0,
      total_discrepancy_eur_cents: 0,
      status: 'FAILED',
      run_at: now,
    }

    void (supabaseAdmin as any)
      .from('bank_reconciliation_runs')
      .insert({ ...failedRun })
      .catch((err: unknown) => log.warn('[bank-reconciliation] failed run persist error', { error: String(err) }))

    return failedRun
  }
}

// ─── importBankStatement ──────────────────────────────────────────────────────

/**
 * Inserts bank statement entries. Idempotent on (tenant_id, ref).
 */
export async function importBankStatement(
  tenantId: string,
  entries: Array<{ ref: string; amount_eur_cents: number; date: string; description: string }>,
): Promise<{ imported: number }> {
  if (entries.length === 0) return { imported: 0 }

  const rows = entries.map((e) => ({
    tenant_id: tenantId,
    ref: e.ref,
    amount_eur_cents: e.amount_eur_cents,
    statement_date: e.date,
    description: e.description,
    imported_at: new Date().toISOString(),
  }))

  const { data, error } = await (supabaseAdmin as any)
    .from('bank_statement_imports')
    .upsert(rows, { onConflict: 'tenant_id,ref', ignoreDuplicates: true })
    .select('ref')

  if (error) {
    log.error('[bank-reconciliation] importBankStatement failed', error, { tenant_id: tenantId, count: entries.length })
    return { imported: 0 }
  }

  const imported = (data as unknown[])?.length ?? entries.length
  log.info('[bank-reconciliation] bank statement imported', { tenant_id: tenantId, imported })
  return { imported }
}

// ─── getReconciliationHistory ─────────────────────────────────────────────────

export async function getReconciliationHistory(
  tenantId: string,
  limit = 20,
): Promise<ReconciliationRun[]> {
  const { data, error } = await (supabaseAdmin as any)
    .from('bank_reconciliation_runs')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('run_at', { ascending: false })
    .limit(limit)

  if (error) {
    log.error('[bank-reconciliation] getReconciliationHistory failed', error, { tenant_id: tenantId })
    return []
  }

  return ((data as Record<string, unknown>[]) ?? []).map(rowToRun)
}

// ─── getUnreconciledDiscrepancies ─────────────────────────────────────────────

export async function getUnreconciledDiscrepancies(tenantId: string): Promise<ReconciliationEntry[]> {
  const { data, error } = await (supabaseAdmin as any)
    .from('bank_reconciliation_entries')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('status', 'DISCREPANCY')
    .order('reconciled_at', { ascending: true, nullsFirst: true })

  if (error) {
    log.error('[bank-reconciliation] getUnreconciledDiscrepancies failed', error, { tenant_id: tenantId })
    return []
  }

  return ((data as Record<string, unknown>[]) ?? []).map(rowToEntry)
}
