// Agency Group — Gap Detection Engine
// lib/audit/gapDetectionEngine.ts
// TypeScript strict — 0 errors
//
// Aggregates all audit dimensions and classifies gaps:
// CRITICAL (system broken) / HIGH (financial risk) / MEDIUM (performance) / LOW (optimization)
// Outputs structured JSON gap list with priority ordering

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { runDataIntegrityAudit, type DataIntegrityReport } from './dataIntegrityAuditor'
import { runEventSystemAudit, type EventSystemReport } from './eventSystemAuditor'
import { runFinancialConsistencyAudit, type FinancialConsistencyReport } from './financialConsistencyAuditor'
import { runMLConsistencyAudit, type MLConsistencyReport } from './mlConsistencyAuditor'

// ─── Types ────────────────────────────────────────────────────────────────────

export type GapSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

export interface DetectedGap {
  gap_id: string
  gap_type: string
  severity: GapSeverity
  affected_modules: string[]
  root_cause: string
  impact: string
  fix_strategy: string
  priority_order: number       // 1 = fix first
  auto_fixable: boolean        // can self-healing engine resolve?
  detected_at: string
}

export interface GapDetectionReport {
  report_id: string
  tenant_id: string

  gaps: DetectedGap[]

  summary: {
    critical: number
    high: number
    medium: number
    low: number
    total: number
    auto_fixable: number
  }

  // Blocking issues (CRITICAL gaps that prevent production)
  blocking_issues: string[]

  // Is system production-ready?
  production_blocked: boolean   // true if any CRITICAL gaps

  generated_at: string
}

// ─── classifyGaps ─────────────────────────────────────────────────────────────

export function classifyGaps(
  dataReport:      DataIntegrityReport,
  eventReport:     EventSystemReport,
  financialReport: FinancialConsistencyReport,
  mlReport:        MLConsistencyReport,
): DetectedGap[] {
  const gaps: DetectedGap[] = []
  const now = new Date().toISOString()

  // ── DATA INTEGRITY GAPS ───────────────────────────────────────────────────

  const totalOrphans =
    dataReport.orphan_analysis.canonical_assets_without_source +
    dataReport.orphan_analysis.capital_transactions_without_escrow +
    dataReport.orphan_analysis.settlements_without_transactions +
    dataReport.orphan_analysis.matches_without_deals +
    dataReport.orphan_analysis.deal_packs_without_contacts

  if (totalOrphans > 0) {
    gaps.push({
      gap_id:           randomUUID(),
      gap_type:         'data_integrity_orphan_records',
      severity:         'HIGH',
      affected_modules: ['canonical_assets', 'capital_transactions', 'settlement_tracking', 'matches', 'deal_packs'],
      root_cause:       `${totalOrphans} orphan record(s) found across pipeline — missing parent references`,
      impact:           'Pipeline stages cannot be fully traced; reports will have gaps; downstream joins will fail',
      fix_strategy:     'Audit ingestion pipeline for missing FK assignments; add NOT NULL constraints on required FK columns',
      priority_order:   2,
      auto_fixable:     false,
      detected_at:      now,
    })
  }

  if (dataReport.state_transition_violations.length > 0) {
    gaps.push({
      gap_id:           randomUUID(),
      gap_type:         'data_integrity_state_transition_violation',
      severity:         'HIGH',
      affected_modules: ['escrow_accounts'],
      root_cause:       `${dataReport.state_transition_violations.length} invalid escrow state transition(s) — e.g. released → funded`,
      impact:           'Financial state machine is corrupted; settlement processing may be blocked or double-triggered',
      fix_strategy:     'Add DB-level CHECK constraints on status transitions; audit application code for direct status overwrites',
      priority_order:   1,
      auto_fixable:     false,
      detected_at:      now,
    })
  }

  // ── EVENT SYSTEM GAPS ─────────────────────────────────────────────────────

  if (eventReport.idempotency_analysis.duplicate_keys_found > 0) {
    gaps.push({
      gap_id:           randomUUID(),
      gap_type:         'event_system_duplicate_idempotency_keys',
      severity:         'CRITICAL',
      affected_modules: ['event_replay_log', 'lib/events/kafkaClient'],
      root_cause:       `${eventReport.idempotency_analysis.duplicate_keys_found} duplicate idempotency key(s) found in event_replay_log`,
      impact:           'Events are being processed multiple times — financial transactions may be double-executed',
      fix_strategy:     'Add UNIQUE constraint on idempotency_key in event_replay_log; implement deduplication before processing',
      priority_order:   1,
      auto_fixable:     false,
      detected_at:      now,
    })
  }

  const uncoveredTopics = eventReport.topic_coverage.filter(t => t.expected && t.event_count === 0)
  if (uncoveredTopics.length > 0) {
    const severity: GapSeverity = uncoveredTopics.length >= 5 ? 'HIGH' : 'MEDIUM'
    gaps.push({
      gap_id:           randomUUID(),
      gap_type:         'event_system_missing_topic_coverage',
      severity,
      affected_modules: uncoveredTopics.map(t => `kafka:${t.topic}`),
      root_cause:       `${uncoveredTopics.length} required topic(s) have zero events: ${uncoveredTopics.map(t => t.topic).join(', ')}`,
      impact:           'Pipeline stages are not emitting events — observability and replay capability are incomplete',
      fix_strategy:     'Instrument missing pipeline stages to emit events on each state change',
      priority_order:   3,
      auto_fixable:     false,
      detected_at:      now,
    })
  }

  if (eventReport.replay_determinism.divergent_replays > 0) {
    gaps.push({
      gap_id:           randomUUID(),
      gap_type:         'event_system_non_deterministic_replay',
      severity:         'HIGH',
      affected_modules: ['event_replay_log', 'lib/events/replayEngine'],
      root_cause:       `${eventReport.replay_determinism.divergent_replays} replay(s) produced different outcomes — side effects in event handlers`,
      impact:           'Disaster recovery via replay will produce inconsistent state; audit trail cannot be trusted',
      fix_strategy:     'Remove side effects from event handlers; ensure all handlers are pure functions of their inputs',
      priority_order:   2,
      auto_fixable:     false,
      detected_at:      now,
    })
  }

  // ── FINANCIAL CONSISTENCY GAPS ────────────────────────────────────────────

  if (!financialReport.ledger_balance.balance_reconciled) {
    gaps.push({
      gap_id:           randomUUID(),
      gap_type:         'financial_ledger_imbalance',
      severity:         'CRITICAL',
      affected_modules: ['capital_transactions', 'escrow_accounts', 'settlement_tracking'],
      root_cause:       `Ledger imbalance of €${financialReport.ledger_balance.imbalance_amount.toFixed(2)}: committed ≠ released + in_escrow`,
      impact:           'Financial reporting is incorrect; regulatory compliance at risk; investor funds may be misaccounted',
      fix_strategy:     'Audit all capital_transactions for missing escrow links; reconcile settlement amounts against transaction amounts',
      priority_order:   1,
      auto_fixable:     false,
      detected_at:      now,
    })
  }

  if (financialReport.anomalies.phantom_revenue.length > 0) {
    gaps.push({
      gap_id:           randomUUID(),
      gap_type:         'financial_phantom_revenue',
      severity:         'CRITICAL',
      affected_modules: ['settlement_tracking', 'capital_transactions'],
      root_cause:       `${financialReport.anomalies.phantom_revenue.length} settlement(s) with no backing capital_transaction`,
      impact:           'Revenue is being reported without underlying transactions — financial fraud risk; audit failure',
      fix_strategy:     'Delete or link orphaned settlements; add FK constraint settlement_tracking.capital_transaction_id → capital_transactions.id',
      priority_order:   1,
      auto_fixable:     false,
      detected_at:      now,
    })
  }

  if (financialReport.anomalies.double_counted.length > 0) {
    gaps.push({
      gap_id:           randomUUID(),
      gap_type:         'financial_double_counting',
      severity:         'CRITICAL',
      affected_modules: ['settlement_tracking', 'capital_transactions'],
      root_cause:       `${financialReport.anomalies.double_counted.length} capital_transaction(s) linked to multiple settlements`,
      impact:           'Capital is being double-counted in financial reports; investor statements will be incorrect',
      fix_strategy:     'Add UNIQUE constraint on settlement_tracking.capital_transaction_id; remove duplicate settlement records',
      priority_order:   1,
      auto_fixable:     false,
      detected_at:      now,
    })
  }

  if (financialReport.escrow_consistency.stale_escrows > 0) {
    gaps.push({
      gap_id:           randomUUID(),
      gap_type:         'financial_stale_escrow',
      severity:         'HIGH',
      affected_modules: ['escrow_accounts'],
      root_cause:       `${financialReport.escrow_consistency.stale_escrows} escrow(s) funded >30 days with no settlement`,
      impact:           'Capital locked in escrow without progression; investor funds may be stranded',
      fix_strategy:     'Review stale escrows with deal managers; trigger settlement or release process',
      priority_order:   3,
      auto_fixable:     false,
      detected_at:      now,
    })
  }

  // ── ML CONSISTENCY GAPS ───────────────────────────────────────────────────

  if (mlReport.drift_analysis.drift_detected && mlReport.drift_analysis.psi_estimate > 0.25) {
    gaps.push({
      gap_id:           randomUUID(),
      gap_type:         'ml_data_drift_exceeded_threshold',
      severity:         'HIGH',
      affected_modules: ['ml_features', 'ml_predictions', 'lib/avm/propertyValuation'],
      root_cause:       `PSI ${mlReport.drift_analysis.psi_estimate.toFixed(3)} exceeds drift threshold ${mlReport.drift_analysis.drift_threshold} — feature distribution has shifted`,
      impact:           'AVM predictions are based on outdated distribution; property valuations may be systematically wrong',
      fix_strategy:     'Trigger immediate model retraining; update feature normalisation parameters',
      priority_order:   2,
      auto_fixable:     true,
      detected_at:      now,
    })
  }

  if (mlReport.feature_store.stale_features > 10) {
    gaps.push({
      gap_id:           randomUUID(),
      gap_type:         'ml_stale_features',
      severity:         'MEDIUM',
      affected_modules: ['ml_features'],
      root_cause:       `${mlReport.feature_store.stale_features} features past their valid_to expiry date`,
      impact:           'Predictions may be using expired feature values; model accuracy degraded',
      fix_strategy:     'Run feature refresh pipeline; purge features with valid_to < now()',
      priority_order:   4,
      auto_fixable:     true,
      detected_at:      now,
    })
  }

  if (mlReport.feature_store.features_with_nulls > 0) {
    const severity: GapSeverity = mlReport.feature_store.features_with_nulls > 5 ? 'MEDIUM' : 'LOW'
    gaps.push({
      gap_id:           randomUUID(),
      gap_type:         'ml_high_null_rate_features',
      severity,
      affected_modules: ['ml_features'],
      root_cause:       `${mlReport.feature_store.features_with_nulls} feature(s) with >10% null values`,
      impact:           'Predictions for properties with null feature values will fall back to defaults; accuracy reduced',
      fix_strategy:     'Implement feature imputation pipeline; investigate data collection gaps for high-null features',
      priority_order:   5,
      auto_fixable:     false,
      detected_at:      now,
    })
  }

  if (mlReport.retraining_determinism.rollbacks > 0) {
    gaps.push({
      gap_id:           randomUUID(),
      gap_type:         'ml_retraining_rollbacks',
      severity:         'MEDIUM',
      affected_modules: ['ml_training_runs'],
      root_cause:       `${mlReport.retraining_determinism.rollbacks} retraining rollback(s) recorded — new models underperformed previous versions`,
      impact:           'Retraining is not producing improvements; model may be stuck at local optimum',
      fix_strategy:     'Review training data quality; adjust hyperparameter search space; increase training dataset size',
      priority_order:   5,
      auto_fixable:     false,
      detected_at:      now,
    })
  }

  return gaps
}

// ─── prioritizeGaps ───────────────────────────────────────────────────────────

export function prioritizeGaps(gaps: DetectedGap[]): DetectedGap[] {
  const severityOrder: Record<GapSeverity, number> = {
    CRITICAL: 0,
    HIGH:     1,
    MEDIUM:   2,
    LOW:      3,
  }

  return gaps
    .sort((a, b) => {
      // First: severity
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity]
      if (severityDiff !== 0) return severityDiff
      // Second: priority_order
      return a.priority_order - b.priority_order
    })
    .map((gap, idx) => ({ ...gap, priority_order: idx + 1 }))
}

// ─── persistGapReport ─────────────────────────────────────────────────────────

export async function persistGapReport(report: GapDetectionReport): Promise<void> {
  try {
    const { error } = await (supabaseAdmin as any)
      .from('gap_detection_reports')
      .insert({
        id:                report.report_id,
        tenant_id:         report.tenant_id,
        gaps:              report.gaps,
        summary:           report.summary,
        blocking_issues:   report.blocking_issues,
        production_blocked: report.production_blocked,
        critical_count:    report.summary.critical,
        high_count:        report.summary.high,
        generated_at:      report.generated_at,
      })

    if (error) {
      log.warn('[gapDetectionEngine] persistGapReport DB error', { error: error.message })
    }
  } catch (err) {
    log.warn('[gapDetectionEngine] persistGapReport error', {
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

// ─── runGapDetection ──────────────────────────────────────────────────────────

export async function runGapDetection(tenantId: string): Promise<GapDetectionReport> {
  const reportId = randomUUID()
  const generatedAt = new Date().toISOString()

  log.info('[gapDetectionEngine] starting gap detection', {
    tenant_id: tenantId,
    report_id: reportId,
  })

  const [dataReport, eventReport, financialReport, mlReport] = await Promise.all([
    runDataIntegrityAudit(tenantId),
    runEventSystemAudit(tenantId),
    runFinancialConsistencyAudit(tenantId),
    runMLConsistencyAudit(tenantId),
  ])

  const rawGaps = classifyGaps(dataReport, eventReport, financialReport, mlReport)
  const gaps = prioritizeGaps(rawGaps)

  const summary = {
    critical:     gaps.filter(g => g.severity === 'CRITICAL').length,
    high:         gaps.filter(g => g.severity === 'HIGH').length,
    medium:       gaps.filter(g => g.severity === 'MEDIUM').length,
    low:          gaps.filter(g => g.severity === 'LOW').length,
    total:        gaps.length,
    auto_fixable: gaps.filter(g => g.auto_fixable).length,
  }

  const blockingIssues = gaps
    .filter(g => g.severity === 'CRITICAL')
    .map(g => `[${g.gap_type}] ${g.root_cause}`)

  const productionBlocked = summary.critical > 0

  const report: GapDetectionReport = {
    report_id:         reportId,
    tenant_id:         tenantId,
    gaps,
    summary,
    blocking_issues:   blockingIssues,
    production_blocked: productionBlocked,
    generated_at:      generatedAt,
  }

  log.info('[gapDetectionEngine] gap detection complete', {
    tenant_id:          tenantId,
    total_gaps:         summary.total,
    critical:           summary.critical,
    production_blocked: productionBlocked,
  })

  void persistGapReport(report).catch(e =>
    log.warn('[gapDetectionEngine] persist failed', {
      error: e instanceof Error ? e.message : String(e),
    })
  )

  return report
}
