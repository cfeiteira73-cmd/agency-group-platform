// Agency Group — Reconciliation Validator
// lib/financial-integrity/reconciliationValidator.ts
// Validates bank statement reconciliation rates, capital velocity, fee record
// consistency, and escrow lifecycle state machine integrity.
// TypeScript strict — 0 errors

import { supabaseAdmin } from '@/lib/supabase'

// ── Logger ─────────────────────────────────────────────────────────────────────

const log = {
  info: (m: string, c?: Record<string, unknown>) => console.log('[recon-validator]', m, c ?? {}),
  warn: (m: string, c?: Record<string, unknown>) => console.warn('[recon-validator]', m, c ?? {}),
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ReconciliationReport {
  tenant_id: string
  validated_at: string

  // Bank statement reconciliation
  total_bank_lines: number
  matched_bank_lines: number
  unmatched_bank_lines: number
  reconciliation_rate_pct: number

  // Capital velocity
  capital_velocity_ratio: number | null // from capital_velocity_snapshots

  // Fee records consistency
  total_fee_records: number
  fees_with_journal_entries: number
  orphan_fee_records: number

  // Escrow lifecycle integrity
  escrow_state_violations: number // e.g., RELEASED without released_at set

  overall_reconciliation_status: 'CLEAN' | 'DISCREPANCIES_FOUND' | 'INSUFFICIENT_DATA'
  issues: string[]
}

// ── runReconciliationValidation ───────────────────────────────────────────────

export async function runReconciliationValidation(tenantId: string): Promise<ReconciliationReport> {
  const issues: string[] = []
  const now = new Date().toISOString()

  // ── Bank lines reconciliation ──────────────────────────────────────────────
  let totalLines = 0
  let matchedLines = 0

  try {
    const { count: total } = await (supabaseAdmin as any)
      .from('bank_statement_lines')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
    const { count: matched } = await (supabaseAdmin as any)
      .from('bank_statement_lines')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .in('match_status', ['AUTO_MATCHED', 'MANUAL_MATCHED', 'RECONCILED'])
    totalLines = total ?? 0
    matchedLines = matched ?? 0
  } catch {
    issues.push('BANK_LINES_QUERY_FAILED')
  }

  const reconcRate = totalLines > 0 ? (matchedLines / totalLines) * 100 : 0
  if (totalLines > 0 && reconcRate < 80) {
    issues.push(`LOW_RECONCILIATION_RATE: ${reconcRate.toFixed(1)}%`)
  }

  // ── Capital velocity ───────────────────────────────────────────────────────
  let velocityRatio: number | null = null

  try {
    const { data: velRows } = await (supabaseAdmin as any)
      .from('capital_velocity_snapshots')
      .select('velocity_ratio')
      .eq('tenant_id', tenantId)
      .order('computed_at', { ascending: false })
      .limit(1)
    velocityRatio = (velRows as Array<{ velocity_ratio: number }>)?.[0]?.velocity_ratio ?? null
  } catch {
    // No velocity data yet — not an issue
  }

  // ── Fee records consistency ────────────────────────────────────────────────
  let totalFees = 0
  let feesWithJournal = 0

  try {
    const { count: fees } = await (supabaseAdmin as any)
      .from('transaction_fee_records')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
    totalFees = fees ?? 0

    // Cross-check: fee records should each have a corresponding journal entry
    if (totalFees > 0) {
      const { data: feeRows } = await (supabaseAdmin as any)
        .from('transaction_fee_records')
        .select('transaction_id')
        .eq('tenant_id', tenantId)

      if (feeRows) {
        for (const fr of feeRows as Array<{ transaction_id: string }>) {
          const { count: jCount } = await (supabaseAdmin as any)
            .from('journal_entries')
            .select('entry_id', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)
            .eq('transaction_id', fr.transaction_id)
          if ((jCount ?? 0) > 0) feesWithJournal++
        }
      }
    }
  } catch {
    // Tables may not exist yet
  }

  const orphanFees = Math.max(0, totalFees - feesWithJournal)
  if (orphanFees > 0) {
    issues.push(`ORPHAN_FEE_RECORDS: ${orphanFees}`)
  }

  // ── Escrow state violations ────────────────────────────────────────────────
  let stateViolations = 0

  try {
    // RELEASED escrow positions must have released_at set
    const { count: violations } = await (supabaseAdmin as any)
      .from('escrow_positions')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'RELEASED')
      .is('released_at', null)
    stateViolations = violations ?? 0
    if (stateViolations > 0) {
      issues.push(`ESCROW_STATE_VIOLATIONS: ${stateViolations} RELEASED positions missing released_at`)
    }
  } catch {
    // Table may not exist yet
  }

  // ── Determine overall status ───────────────────────────────────────────────
  let overallStatus: ReconciliationReport['overall_reconciliation_status']

  if (totalLines === 0 && totalFees === 0) {
    overallStatus = 'INSUFFICIENT_DATA'
  } else if (issues.length === 0) {
    overallStatus = 'CLEAN'
  } else {
    overallStatus = 'DISCREPANCIES_FOUND'
  }

  const report: ReconciliationReport = {
    tenant_id: tenantId,
    validated_at: now,
    total_bank_lines: totalLines,
    matched_bank_lines: matchedLines,
    unmatched_bank_lines: totalLines - matchedLines,
    reconciliation_rate_pct: Math.round(reconcRate * 100) / 100,
    capital_velocity_ratio: velocityRatio,
    total_fee_records: totalFees,
    fees_with_journal_entries: feesWithJournal,
    orphan_fee_records: orphanFees,
    escrow_state_violations: stateViolations,
    overall_reconciliation_status: overallStatus,
    issues,
  }

  // Persist (fire-and-forget)
  void (supabaseAdmin as any)
    .from('reconciliation_validation_runs')
    .insert({
      tenant_id: tenantId,
      validated_at: now,
      reconciliation_rate_pct: report.reconciliation_rate_pct,
      overall_status: overallStatus,
      issues_count: issues.length,
      report_json: report,
    })
    .catch((e: unknown) => log.warn('persist reconciliation run failed', { error: String(e) }))

  log.info('reconciliation validation complete', { overall_status: overallStatus, issues: issues.length })
  return report
}
