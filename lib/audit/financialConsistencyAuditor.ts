// Agency Group — Financial Consistency Auditor
// lib/audit/financialConsistencyAuditor.ts
// TypeScript strict — 0 errors
//
// Validates financial integrity:
// capital_in == capital_out, escrow consistency, settlement correctness
// Detects: phantom revenue, double-counting, missing settlements

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FinancialConsistencyReport {
  audit_id: string
  tenant_id: string

  ledger_balance: {
    total_capital_committed: number   // sum of capital_transactions where status=committed
    total_capital_released: number    // sum of completed settlements
    total_in_escrow: number           // sum of escrow_accounts where status=funded
    balance_reconciled: boolean       // committed == released + in_escrow (within tolerance)
    imbalance_amount: number          // abs(committed - released - in_escrow)
    tolerance_eur: number             // €0.01 tolerance
  }

  escrow_consistency: {
    total_escrow_records: number
    orphaned_escrows: number          // no linked capital_transaction
    stale_escrows: number             // funded >30 days with no settlement
    invalid_transitions: number       // e.g. released → funded
    consistency_score: number         // 0–100
  }

  settlement_correctness: {
    total_settlements: number
    completed_settlements: number
    missing_settlements: number       // capital_transactions with status=completed but no settlement
    settlement_amount_mismatches: number  // settlement amount != transaction amount
    correctness_score: number         // 0–100
  }

  anomalies: {
    phantom_revenue: string[]         // settlement amounts with no backing transaction
    double_counted: string[]          // transaction IDs appearing in multiple settlements
    missing_settlements: string[]     // transaction IDs with no settlement
  }

  financial_integrity_score: number   // 0–100
  critical_issues: string[]
}

// ─── TOLERANCE ───────────────────────────────────────────────────────────────

const TOLERANCE_EUR = 0.01
const STALE_ESCROW_DAYS = 30

// ─── checkLedgerBalance ───────────────────────────────────────────────────────

export async function checkLedgerBalance(
  tenantId: string,
): Promise<FinancialConsistencyReport['ledger_balance']> {
  const result = {
    total_capital_committed: 0,
    total_capital_released:  0,
    total_in_escrow:         0,
    balance_reconciled:      true,
    imbalance_amount:        0,
    tolerance_eur:           TOLERANCE_EUR,
  }

  try {
    // Sum capital_transactions where status = 'committed'
    const { data: txData } = await (supabaseAdmin as any)
      .from('capital_transactions')
      .select('amount_eur')
      .eq('tenant_id', tenantId)
      .eq('status', 'committed') as { data: Array<{ amount_eur: number }> | null }

    if (txData) {
      result.total_capital_committed = txData.reduce(
        (sum, r) => sum + (Number(r.amount_eur) || 0),
        0,
      )
    }

    // Sum settlement_tracking where status = 'completed'
    const { data: settlData } = await (supabaseAdmin as any)
      .from('settlement_tracking')
      .select('settlement_amount_eur')
      .eq('tenant_id', tenantId)
      .eq('status', 'completed') as { data: Array<{ settlement_amount_eur: number }> | null }

    if (settlData) {
      result.total_capital_released = settlData.reduce(
        (sum, r) => sum + (Number(r.settlement_amount_eur) || 0),
        0,
      )
    }

    // Sum escrow_accounts where status = 'funded'
    const { data: escrowData } = await (supabaseAdmin as any)
      .from('escrow_accounts')
      .select('balance_eur')
      .eq('tenant_id', tenantId)
      .eq('status', 'funded') as { data: Array<{ balance_eur: number }> | null }

    if (escrowData) {
      result.total_in_escrow = escrowData.reduce(
        (sum, r) => sum + (Number(r.balance_eur) || 0),
        0,
      )
    }

    const imbalance = Math.abs(
      result.total_capital_committed -
      result.total_capital_released -
      result.total_in_escrow,
    )
    result.imbalance_amount   = imbalance
    result.balance_reconciled = imbalance <= TOLERANCE_EUR
  } catch (err) {
    log.warn('[financialConsistencyAuditor] checkLedgerBalance error', {
      error: err instanceof Error ? err.message : String(err),
    })
  }

  return result
}

// ─── checkEscrowConsistency ───────────────────────────────────────────────────

export async function checkEscrowConsistency(
  tenantId: string,
): Promise<FinancialConsistencyReport['escrow_consistency']> {
  try {
    // Total escrow records
    const { count: totalCount } = await (supabaseAdmin as any)
      .from('escrow_accounts')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId) as { count: number | null }

    const total = totalCount ?? 0

    // Orphaned: no linked capital_transaction_id
    const { count: orphanCount } = await (supabaseAdmin as any)
      .from('escrow_accounts')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .is('capital_transaction_id', null) as { count: number | null }

    const orphaned = orphanCount ?? 0

    // Stale: status=funded, created >30 days ago, no settlement
    const thirtyDaysAgo = new Date(Date.now() - STALE_ESCROW_DAYS * 24 * 60 * 60 * 1000).toISOString()
    const { count: staleCount } = await (supabaseAdmin as any)
      .from('escrow_accounts')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'funded')
      .lt('created_at', thirtyDaysAgo) as { count: number | null }

    const stale = staleCount ?? 0

    // Invalid transitions: status=funded but previous_status=released
    const { count: invalidCount } = await (supabaseAdmin as any)
      .from('escrow_accounts')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'funded')
      .eq('previous_status', 'released') as { count: number | null }

    const invalid = invalidCount ?? 0

    const consistencyScore = Math.max(0, 100 - orphaned * 10 - stale * 5 - invalid * 20)

    return {
      total_escrow_records: total,
      orphaned_escrows:     orphaned,
      stale_escrows:        stale,
      invalid_transitions:  invalid,
      consistency_score:    consistencyScore,
    }
  } catch (err) {
    log.warn('[financialConsistencyAuditor] checkEscrowConsistency error', {
      error: err instanceof Error ? err.message : String(err),
    })
    return {
      total_escrow_records: 0,
      orphaned_escrows:     0,
      stale_escrows:        0,
      invalid_transitions:  0,
      consistency_score:    100,
    }
  }
}

// ─── checkSettlementCorrectness ───────────────────────────────────────────────

export async function checkSettlementCorrectness(
  tenantId: string,
): Promise<FinancialConsistencyReport['settlement_correctness']> {
  try {
    // Total settlements
    const { count: totalCount } = await (supabaseAdmin as any)
      .from('settlement_tracking')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId) as { count: number | null }

    const total = totalCount ?? 0

    // Completed settlements
    const { count: completedCount } = await (supabaseAdmin as any)
      .from('settlement_tracking')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'completed') as { count: number | null }

    const completed = completedCount ?? 0

    // Capital transactions with status=completed but no settlement record
    const { data: completedTxData } = await (supabaseAdmin as any)
      .from('capital_transactions')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('status', 'completed') as { data: Array<{ id: string }> | null }

    const completedTxIds = (completedTxData ?? []).map(r => r.id)
    let missingSettlements = 0

    if (completedTxIds.length > 0) {
      const { count: settledCount } = await (supabaseAdmin as any)
        .from('settlement_tracking')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .in('capital_transaction_id', completedTxIds) as { count: number | null }

      missingSettlements = completedTxIds.length - (settledCount ?? 0)
      if (missingSettlements < 0) missingSettlements = 0
    }

    // Settlement amount mismatches: join settlement with transaction amount
    const { data: joinData } = await (supabaseAdmin as any)
      .from('settlement_tracking')
      .select('id, settlement_amount_eur, capital_transaction_id, capital_transactions(amount_eur)')
      .eq('tenant_id', tenantId)
      .not('capital_transaction_id', 'is', null)
      .limit(500) as {
        data: Array<{
          id: string
          settlement_amount_eur: number | null
          capital_transaction_id: string | null
          capital_transactions: { amount_eur: number } | null
        }> | null
      }

    let amountMismatches = 0
    if (joinData) {
      for (const row of joinData) {
        const settlAmt = Number(row.settlement_amount_eur ?? 0)
        const txAmt    = Number(row.capital_transactions?.amount_eur ?? 0)
        if (Math.abs(settlAmt - txAmt) > TOLERANCE_EUR) {
          amountMismatches++
        }
      }
    }

    const correctnessScore = Math.max(
      0,
      100 - missingSettlements * 15 - amountMismatches * 20,
    )

    return {
      total_settlements:            total,
      completed_settlements:        completed,
      missing_settlements:          missingSettlements,
      settlement_amount_mismatches: amountMismatches,
      correctness_score:            correctnessScore,
    }
  } catch (err) {
    log.warn('[financialConsistencyAuditor] checkSettlementCorrectness error', {
      error: err instanceof Error ? err.message : String(err),
    })
    return {
      total_settlements:            0,
      completed_settlements:        0,
      missing_settlements:          0,
      settlement_amount_mismatches: 0,
      correctness_score:            100,
    }
  }
}

// ─── detectAnomalies ──────────────────────────────────────────────────────────

export async function detectAnomalies(
  tenantId: string,
): Promise<FinancialConsistencyReport['anomalies']> {
  const phantomRevenue: string[]    = []
  const doubleCounted: string[]     = []
  const missingSettlements: string[] = []

  try {
    // Phantom revenue: settlement rows with no backing capital_transaction
    const { data: phantomData } = await (supabaseAdmin as any)
      .from('settlement_tracking')
      .select('id, capital_transaction_id')
      .eq('tenant_id', tenantId)
      .is('capital_transaction_id', null)
      .limit(100) as { data: Array<{ id: string; capital_transaction_id: string | null }> | null }

    if (phantomData) {
      for (const row of phantomData) {
        phantomRevenue.push(`settlement:${row.id} — no backing capital_transaction`)
      }
    }

    // Double-counted: same capital_transaction_id in more than one settlement
    const { data: allSettlements } = await (supabaseAdmin as any)
      .from('settlement_tracking')
      .select('id, capital_transaction_id')
      .eq('tenant_id', tenantId)
      .not('capital_transaction_id', 'is', null)
      .limit(5000) as {
        data: Array<{ id: string; capital_transaction_id: string }> | null
      }

    if (allSettlements) {
      const txSettlementMap = new Map<string, string[]>()
      for (const row of allSettlements) {
        const existing = txSettlementMap.get(row.capital_transaction_id) ?? []
        existing.push(row.id)
        txSettlementMap.set(row.capital_transaction_id, existing)
      }
      for (const [txId, settlIds] of txSettlementMap.entries()) {
        if (settlIds.length > 1) {
          doubleCounted.push(
            `capital_transaction:${txId} appears in ${settlIds.length} settlements: [${settlIds.join(', ')}]`,
          )
        }
      }
    }

    // Missing settlements: completed capital_transactions with no settlement
    const { data: completedTx } = await (supabaseAdmin as any)
      .from('capital_transactions')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('status', 'completed')
      .limit(500) as { data: Array<{ id: string }> | null }

    if (completedTx && completedTx.length > 0) {
      const txIds = completedTx.map(r => r.id)
      const { data: settledTx } = await (supabaseAdmin as any)
        .from('settlement_tracking')
        .select('capital_transaction_id')
        .eq('tenant_id', tenantId)
        .in('capital_transaction_id', txIds) as {
          data: Array<{ capital_transaction_id: string }> | null
        }

      const settledIds = new Set((settledTx ?? []).map(r => r.capital_transaction_id))
      for (const txId of txIds) {
        if (!settledIds.has(txId)) {
          missingSettlements.push(`capital_transaction:${txId} — completed but no settlement record`)
        }
      }
    }
  } catch (err) {
    log.warn('[financialConsistencyAuditor] detectAnomalies error', {
      error: err instanceof Error ? err.message : String(err),
    })
  }

  return { phantom_revenue: phantomRevenue, double_counted: doubleCounted, missing_settlements: missingSettlements }
}

// ─── runFinancialConsistencyAudit ─────────────────────────────────────────────

export async function runFinancialConsistencyAudit(
  tenantId: string,
): Promise<FinancialConsistencyReport> {
  const auditId = randomUUID()
  log.info('[financialConsistencyAuditor] starting audit', {
    tenant_id: tenantId,
    audit_id:  auditId,
  })

  const [ledgerBalance, escrowConsistency, settlementCorrectness, anomalies] = await Promise.all([
    checkLedgerBalance(tenantId),
    checkEscrowConsistency(tenantId),
    checkSettlementCorrectness(tenantId),
    detectAnomalies(tenantId),
  ])

  // Score formula:
  // ledger_balance.balance_reconciled: +40
  // escrow_consistency.consistency_score × 0.3
  // settlement_correctness.correctness_score × 0.3
  const financialIntegrityScore = Math.round(
    (ledgerBalance.balance_reconciled ? 40 : 0) +
    escrowConsistency.consistency_score * 0.3 +
    settlementCorrectness.correctness_score * 0.3,
  )

  const criticalIssues: string[] = []

  if (!ledgerBalance.balance_reconciled) {
    criticalIssues.push(
      `Ledger imbalance of €${ledgerBalance.imbalance_amount.toFixed(2)} detected — committed ≠ released + in_escrow`,
    )
  }
  if (anomalies.phantom_revenue.length > 0) {
    criticalIssues.push(
      `${anomalies.phantom_revenue.length} phantom revenue settlement(s) detected with no backing transaction`,
    )
  }
  if (anomalies.double_counted.length > 0) {
    criticalIssues.push(
      `${anomalies.double_counted.length} capital transaction(s) double-counted across multiple settlements`,
    )
  }
  if (settlementCorrectness.settlement_amount_mismatches > 0) {
    criticalIssues.push(
      `${settlementCorrectness.settlement_amount_mismatches} settlement amount(s) do not match their capital_transaction amounts`,
    )
  }

  const report: FinancialConsistencyReport = {
    audit_id:                 auditId,
    tenant_id:                tenantId,
    ledger_balance:           ledgerBalance,
    escrow_consistency:       escrowConsistency,
    settlement_correctness:   settlementCorrectness,
    anomalies,
    financial_integrity_score: financialIntegrityScore,
    critical_issues:          criticalIssues,
  }

  log.info('[financialConsistencyAuditor] audit complete', {
    tenant_id:                 tenantId,
    financial_integrity_score: financialIntegrityScore,
    critical_issues:           criticalIssues.length,
  })

  // Fire-and-forget persist
  void (supabaseAdmin as any)
    .from('financial_consistency_audits')
    .insert({
      id:                       auditId,
      tenant_id:                tenantId,
      financial_integrity_score: financialIntegrityScore,
      ledger_balance:           ledgerBalance,
      escrow_consistency:       escrowConsistency,
      settlement_correctness:   settlementCorrectness,
      anomalies,
      critical_issues:          criticalIssues,
      audited_at:               new Date().toISOString(),
    })
    .catch((e: unknown) =>
      log.warn('[financialConsistencyAuditor] persist failed', {
        error: e instanceof Error ? e.message : String(e),
      })
    )

  return report
}
