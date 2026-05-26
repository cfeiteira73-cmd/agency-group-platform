// Agency Group — Reconciliation Test Suite
// lib/validation/reconciliationTestSuite.ts
// Pure in-memory test runner for 1000 synthetic transactions.
// No writes to financial tables — only writes to reconciliation_test_runs.
// TypeScript strict — 0 errors

import { computeFeeBreakdown } from '@/lib/ledger/transactionFeeEngine'
import { computeCommissionCents, validateCommissionSplit } from '@/lib/financial/safeArithmetic'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ── Tenant constant ────────────────────────────────────────────────────────────

const TENANT_ID =
  process.env.DEFAULT_TENANT_ID ??
  process.env.SYSTEM_ORG_ID ??
  '00000000-0000-0000-0000-000000000001'

// ── BigInt replacer ────────────────────────────────────────────────────────────

function bigintReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? value.toString() : value
}

// ── Result types ───────────────────────────────────────────────────────────────

export interface ReconciliationTestSuiteResult {
  run_id: string
  tenant_id: string
  executed_at: string
  total_transactions: number
  transactions_passed: number
  transactions_failed: number
  all_passed: boolean
  total_volume_cents: bigint
  total_commission_cents: bigint
  max_deviation_cents: bigint
  split_validation_failures: number
  double_entry_violations: number
  inconsistencies_above_1_euro: number
  pt_transactions: { passed: number; failed: number }
  es_transactions: { passed: number; failed: number }
  overall_status: 'CLEAN' | 'INCONSISTENCIES_FOUND' | 'CRITICAL_FAILURES'
  sample_failures: Array<{
    index: number
    sale_price_cents: string
    country: string
    error: string
  }>
}

// ── Generate synthetic price list ──────────────────────────────────────────────

function buildTransactions(): Array<{ price: number; country: 'PT' | 'ES' }> {
  const txns: Array<{ price: number; country: 'PT' | 'ES' }> = []

  // 500 Portugal transactions: €50,000 to €5,000,000 spread evenly
  for (let i = 0; i < 500; i++) {
    const price = 50_000 + (i * (5_000_000 - 50_000)) / 499
    txns.push({ price, country: 'PT' })
  }

  // 500 Spain transactions: €100,000 to €3,000,000 spread evenly
  for (let i = 0; i < 500; i++) {
    const price = 100_000 + (i * (3_000_000 - 100_000)) / 499
    txns.push({ price, country: 'ES' })
  }

  return txns
}

// ── runReconciliationTestSuite ─────────────────────────────────────────────────

export function runReconciliationTestSuite(tenantId: string): ReconciliationTestSuiteResult {
  const run_id = crypto.randomUUID()
  const executed_at = new Date().toISOString()

  const transactions = buildTransactions()

  let transactions_passed = 0
  let transactions_failed = 0
  let total_volume_cents = BigInt(0)
  let total_commission_cents = BigInt(0)
  let max_deviation_cents = BigInt(0)
  let split_validation_failures = 0
  let double_entry_violations = 0
  let inconsistencies_above_1_euro = 0

  const pt_stats = { passed: 0, failed: 0 }
  const es_stats = { passed: 0, failed: 0 }

  const sample_failures: ReconciliationTestSuiteResult['sample_failures'] = []

  for (let idx = 0; idx < transactions.length; idx++) {
    const tx = transactions[idx]
    const salePriceCents = BigInt(Math.round(tx.price * 100))
    const country = tx.country

    let txPassed = true
    const errors: string[] = []

    try {
      // Primary computation
      const breakdown = computeFeeBreakdown(salePriceCents, country)

      // Commission split computation
      const split = computeCommissionCents(salePriceCents)

      // 1. Validate internal commission split consistency
      const splitValid = validateCommissionSplit(split)
      if (!splitValid) {
        split_validation_failures++
        txPassed = false
        errors.push('SPLIT_VALIDATION_FAILED')
      }

      // 2. Double-entry check: agency_commission_cents === split.total_cents (max 1 cent tolerance)
      const commissionDiff =
        breakdown.agency_commission_cents > split.total_cents
          ? breakdown.agency_commission_cents - split.total_cents
          : split.total_cents - breakdown.agency_commission_cents

      if (commissionDiff > BigInt(1)) {
        double_entry_violations++
        txPassed = false
        errors.push(`DOUBLE_ENTRY_VIOLATION: diff=${commissionDiff.toString()}`)
      }

      // 3. Track max deviation
      if (commissionDiff > max_deviation_cents) {
        max_deviation_cents = commissionDiff
      }

      // 4. Inconsistency > €1.00 (100 cents)
      if (commissionDiff > BigInt(100)) {
        inconsistencies_above_1_euro++
        txPassed = false
        errors.push(`INCONSISTENCY_ABOVE_1_EUR: ${commissionDiff.toString()}`)
      }

      // 5. Buyer always pays more than sale price
      if (breakdown.total_buyer_costs_cents <= salePriceCents) {
        txPassed = false
        errors.push('BUYER_COSTS_NOT_ABOVE_SALE_PRICE')
      }

      // 6. Seller always receives less than sale price (after commission)
      if (breakdown.total_seller_revenue_cents >= salePriceCents) {
        txPassed = false
        errors.push('SELLER_REVENUE_NOT_BELOW_SALE_PRICE')
      }

      // Accumulate totals only on successful computation
      total_volume_cents = total_volume_cents + salePriceCents
      total_commission_cents = total_commission_cents + breakdown.agency_commission_cents
    } catch (e) {
      txPassed = false
      errors.push(`EXCEPTION: ${e instanceof Error ? e.message : String(e)}`)
    }

    if (txPassed) {
      transactions_passed++
      if (country === 'PT') pt_stats.passed++
      else es_stats.passed++
    } else {
      transactions_failed++
      if (country === 'PT') pt_stats.failed++
      else es_stats.failed++

      if (sample_failures.length < 10) {
        sample_failures.push({
          index: idx,
          sale_price_cents: salePriceCents.toString(),
          country,
          error: errors.join('; '),
        })
      }
    }
  }

  const all_passed = transactions_failed === 0

  let overall_status: ReconciliationTestSuiteResult['overall_status']
  if (inconsistencies_above_1_euro === 0 && all_passed) {
    overall_status = 'CLEAN'
  } else if (transactions_failed >= 50) {
    overall_status = 'CRITICAL_FAILURES'
  } else {
    overall_status = 'INCONSISTENCIES_FOUND'
  }

  const result: ReconciliationTestSuiteResult = {
    run_id,
    tenant_id: tenantId,
    executed_at,
    total_transactions: transactions.length,
    transactions_passed,
    transactions_failed,
    all_passed,
    total_volume_cents,
    total_commission_cents,
    max_deviation_cents,
    split_validation_failures,
    double_entry_violations,
    inconsistencies_above_1_euro,
    pt_transactions: pt_stats,
    es_transactions: es_stats,
    overall_status,
    sample_failures,
  }

  log.info('[reconciliation-test-suite] run complete', {
    run_id,
    overall_status,
    transactions_passed,
    transactions_failed,
    total_volume_cents: JSON.stringify(total_volume_cents, bigintReplacer),
    total_commission_cents: JSON.stringify(total_commission_cents, bigintReplacer),
    max_deviation_cents: JSON.stringify(max_deviation_cents, bigintReplacer),
  })

  return result
}

// ── runAndPersistReconciliationTests ──────────────────────────────────────────

export async function runAndPersistReconciliationTests(
  tenantId: string = TENANT_ID
): Promise<ReconciliationTestSuiteResult> {
  const result = runReconciliationTestSuite(tenantId)

  // Persist fire-and-forget
  void (supabaseAdmin as any)
    .from('reconciliation_test_runs')
    .insert({
      run_id: result.run_id,
      tenant_id: result.tenant_id,
      executed_at: result.executed_at,
      total_transactions: result.total_transactions,
      transactions_passed: result.transactions_passed,
      transactions_failed: result.transactions_failed,
      all_passed: result.all_passed,
      total_volume_cents: Number(result.total_volume_cents),
      total_commission_cents: Number(result.total_commission_cents),
      max_deviation_cents: Number(result.max_deviation_cents),
      split_validation_failures: result.split_validation_failures,
      double_entry_violations: result.double_entry_violations,
      inconsistencies_above_1_euro: result.inconsistencies_above_1_euro,
      overall_status: result.overall_status,
      sample_failures: result.sample_failures,
    })
    .catch((e: unknown) => log.warn('[reconciliation-test-suite] persist failed', { e: String(e) }))

  return result
}
