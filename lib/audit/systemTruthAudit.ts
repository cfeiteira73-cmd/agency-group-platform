// Agency Group — System Truth Audit
// lib/audit/systemTruthAudit.ts
// TypeScript strict — 0 errors
//
// Master 6-dimension system truth audit:
// 1. Data Integrity  2. Event System  3. Financial Consistency
// 4. ML Consistency  5. Security & Isolation  6. Infrastructure Resilience
// Aggregates all sub-auditors into single SystemTruthAuditReport

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { runDataIntegrityAudit } from './dataIntegrityAuditor'
import { runEventSystemAudit } from './eventSystemAuditor'
import { runFinancialConsistencyAudit } from './financialConsistencyAuditor'
import { runMLConsistencyAudit } from './mlConsistencyAuditor'
import { runGapDetection, type GapDetectionReport } from './gapDetectionEngine'
import type { SecurityIsolationReport } from '@/lib/validation/securityIsolationTester'
import type { ResilienceValidationReport } from '@/lib/validation/distributedResilienceTester'

// ─── Types ────────────────────────────────────────────────────────────────────

type DimensionStatus = 'pass' | 'warn' | 'fail'

export interface SystemTruthAuditReport {
  audit_id: string
  tenant_id: string

  dimensions: {
    data_integrity:        { score: number; status: DimensionStatus; summary: string }
    event_system:          { score: number; status: DimensionStatus; summary: string }
    financial_consistency: { score: number; status: DimensionStatus; summary: string }
    ml_consistency:        { score: number; status: DimensionStatus; summary: string }
    security_isolation:    { score: number; status: DimensionStatus; summary: string }
    infra_resilience:      { score: number; status: DimensionStatus; summary: string }
  }

  gap_report: GapDetectionReport

  // Weighted composite score
  // Integrity 20% + Financial 25% + Events 20% + ML 15% + Security 10% + Resilience 10%
  composite_score: number

  system_truth_status: 'VERIFIED' | 'DEGRADED' | 'CRITICAL' | 'UNKNOWN'

  critical_blockers: string[]

  audit_duration_ms: number
  audited_at: string
}

// ─── Status thresholds ────────────────────────────────────────────────────────

function scoreToDimensionStatus(score: number): DimensionStatus {
  if (score >= 80) return 'pass'
  if (score >= 60) return 'warn'
  return 'fail'
}

// ─── Safe dynamic imports ─────────────────────────────────────────────────────

async function runSecurityDimension(
  tenantId: string,
): Promise<{ score: number; status: DimensionStatus; summary: string }> {
  try {
    const { runSecurityIsolationTests } = await import(
      '@/lib/validation/securityIsolationTester'
    ) as { runSecurityIsolationTests: (tenantId: string) => Promise<SecurityIsolationReport> }

    const report = await runSecurityIsolationTests(tenantId)
    const score  = Math.round(report.security_integrity_score)
    const status = scoreToDimensionStatus(score)
    const summary =
      report.isolation_breach_detected
        ? `Isolation breach detected — ${report.critical_failures.length} critical failure(s)`
        : `Security score ${score}/100 — ${report.tests.length} test(s) completed`

    return { score, status, summary }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.warn('[systemTruthAudit] security dimension error', { error: msg })
    return {
      score:   0,
      status:  'fail',
      summary: `Security audit failed to run: ${msg}`,
    }
  }
}

async function runResilienceDimension(
  tenantId: string,
): Promise<{ score: number; status: DimensionStatus; summary: string }> {
  try {
    const { runResilienceValidation } = await import(
      '@/lib/validation/distributedResilienceTester'
    ) as { runResilienceValidation: (tenantId: string) => Promise<ResilienceValidationReport> }

    const report = await runResilienceValidation(tenantId)
    const score  = Math.round(report.resilience_score)
    const status = scoreToDimensionStatus(score)
    const summary = `Resilience score ${score}/100 — ${report.system_readiness}`

    return { score, status, summary }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.warn('[systemTruthAudit] resilience dimension error', { error: msg })
    return {
      score:   0,
      status:  'fail',
      summary: `Resilience audit failed to run: ${msg}`,
    }
  }
}

// ─── runSystemTruthAudit ──────────────────────────────────────────────────────

export async function runSystemTruthAudit(tenantId: string): Promise<SystemTruthAuditReport> {
  const auditId  = randomUUID()
  const startedAt = Date.now()

  log.info('[systemTruthAudit] starting 6-dimension audit', {
    tenant_id: tenantId,
    audit_id:  auditId,
  })

  // Run all 6 dimensions in parallel (security + resilience via dynamic import)
  const [
    dataResult,
    eventResult,
    financialResult,
    mlResult,
    gapResult,
    securityResult,
    resilienceResult,
  ] = await Promise.allSettled([
    runDataIntegrityAudit(tenantId),
    runEventSystemAudit(tenantId),
    runFinancialConsistencyAudit(tenantId),
    runMLConsistencyAudit(tenantId),
    runGapDetection(tenantId),
    runSecurityDimension(tenantId),
    runResilienceDimension(tenantId),
  ])

  // ── Extract results safely ────────────────────────────────────────────────

  const dataReport =
    dataResult.status === 'fulfilled' ? dataResult.value : null

  const eventReport =
    eventResult.status === 'fulfilled' ? eventResult.value : null

  const financialReport =
    financialResult.status === 'fulfilled' ? financialResult.value : null

  const mlReport =
    mlResult.status === 'fulfilled' ? mlResult.value : null

  const gapReport =
    gapResult.status === 'fulfilled'
      ? gapResult.value
      : {
          report_id:         randomUUID(),
          tenant_id:         tenantId,
          gaps:              [],
          summary:           { critical: 0, high: 0, medium: 0, low: 0, total: 0, auto_fixable: 0 },
          blocking_issues:   [],
          production_blocked: false,
          generated_at:      new Date().toISOString(),
        } satisfies GapDetectionReport

  const secDim = securityResult.status === 'fulfilled'
    ? securityResult.value
    : { score: 0, status: 'fail' as DimensionStatus, summary: 'Security audit failed to complete' }

  const resDim = resilienceResult.status === 'fulfilled'
    ? resilienceResult.value
    : { score: 0, status: 'fail' as DimensionStatus, summary: 'Resilience audit failed to complete' }

  // ── Build dimension summaries ─────────────────────────────────────────────

  const dataScore     = dataReport?.integrity_score ?? 0
  const eventScore    = eventReport?.event_integrity_score ?? 0
  const finScore      = financialReport?.financial_integrity_score ?? 0
  const mlScore       = mlReport?.ml_stability_score ?? 0

  const dimensions: SystemTruthAuditReport['dimensions'] = {
    data_integrity: {
      score:   dataScore,
      status:  scoreToDimensionStatus(dataScore),
      summary: dataReport
        ? `Integrity score ${dataScore}/100 — ${dataReport.critical_issues.length} critical issue(s), ${dataReport.warnings.length} warning(s)`
        : 'Data integrity audit failed to complete',
    },
    event_system: {
      score:   eventScore,
      status:  scoreToDimensionStatus(eventScore),
      summary: eventReport
        ? `Event score ${eventScore}/100 — ${eventReport.critical_issues.length} critical issue(s), est. ${eventReport.lost_events_estimate} lost event(s)`
        : 'Event system audit failed to complete',
    },
    financial_consistency: {
      score:   finScore,
      status:  scoreToDimensionStatus(finScore),
      summary: financialReport
        ? `Financial score ${finScore}/100 — ${financialReport.critical_issues.length} critical issue(s), balance ${financialReport.ledger_balance.balance_reconciled ? 'reconciled' : 'IMBALANCED'}`
        : 'Financial consistency audit failed to complete',
    },
    ml_consistency: {
      score:   mlScore,
      status:  scoreToDimensionStatus(mlScore),
      summary: mlReport
        ? `ML score ${mlScore}/100 — PSI ${mlReport.drift_analysis.psi_estimate.toFixed(3)}, ${mlReport.feature_store.stale_features} stale feature(s)`
        : 'ML consistency audit failed to complete',
    },
    security_isolation: secDim,
    infra_resilience:   resDim,
  }

  // ── Weighted composite score ──────────────────────────────────────────────
  // Integrity 20% + Financial 25% + Events 20% + ML 15% + Security 10% + Resilience 10%
  const compositeScore = Math.round(
    dataScore    * 0.20 +
    finScore     * 0.25 +
    eventScore   * 0.20 +
    mlScore      * 0.15 +
    secDim.score * 0.10 +
    resDim.score * 0.10,
  )

  // ── System truth status ───────────────────────────────────────────────────
  const dimStatuses = Object.values(dimensions).map(d => d.status)
  let systemTruthStatus: SystemTruthAuditReport['system_truth_status']

  if (dimStatuses.some(s => s === 'fail')) {
    systemTruthStatus = 'CRITICAL'
  } else if (dimStatuses.some(s => s === 'warn')) {
    systemTruthStatus = 'DEGRADED'
  } else if (dimStatuses.every(s => s === 'pass')) {
    systemTruthStatus = 'VERIFIED'
  } else {
    systemTruthStatus = 'UNKNOWN'
  }

  // ── Critical blockers ─────────────────────────────────────────────────────
  const criticalBlockers: string[] = [
    ...(gapReport.blocking_issues),
    ...(financialReport?.critical_issues ?? []),
    ...(dataReport?.critical_issues ?? []),
    ...(eventReport?.critical_issues ?? []),
    ...(mlReport?.critical_issues ?? []),
  ].filter((v, i, arr) => arr.indexOf(v) === i) // deduplicate

  const auditDurationMs = Date.now() - startedAt

  const report: SystemTruthAuditReport = {
    audit_id:           auditId,
    tenant_id:          tenantId,
    dimensions,
    gap_report:         gapReport,
    composite_score:    compositeScore,
    system_truth_status: systemTruthStatus,
    critical_blockers:  criticalBlockers,
    audit_duration_ms:  auditDurationMs,
    audited_at:         new Date().toISOString(),
  }

  log.info('[systemTruthAudit] audit complete', {
    tenant_id:           tenantId,
    composite_score:     compositeScore,
    system_truth_status: systemTruthStatus,
    critical_blockers:   criticalBlockers.length,
    duration_ms:         auditDurationMs,
  })

  void persistAuditReport(report).catch(e =>
    log.warn('[systemTruthAudit] persist failed', {
      error: e instanceof Error ? e.message : String(e),
    })
  )

  return report
}

// ─── persistAuditReport ───────────────────────────────────────────────────────

export async function persistAuditReport(report: SystemTruthAuditReport): Promise<void> {
  try {
    const { error } = await (supabaseAdmin as any)
      .from('system_truth_audits')
      .insert({
        id:                  report.audit_id,
        tenant_id:           report.tenant_id,
        composite_score:     report.composite_score,
        system_truth_status: report.system_truth_status,
        dimensions:          report.dimensions,
        critical_blockers:   report.critical_blockers,
        audit_duration_ms:   report.audit_duration_ms,
        audited_at:          report.audited_at,
      })

    if (error) {
      log.warn('[systemTruthAudit] DB persist error', { error: error.message })
    }
  } catch (err) {
    log.warn('[systemTruthAudit] persistAuditReport error', {
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

// ─── getLatestAudit ───────────────────────────────────────────────────────────

export async function getLatestAudit(
  tenantId: string,
): Promise<SystemTruthAuditReport | null> {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('system_truth_audits')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('audited_at', { ascending: false })
      .limit(1)
      .single() as { data: Record<string, unknown> | null; error: { message: string } | null }

    if (error || !data) return null
    return data as unknown as SystemTruthAuditReport
  } catch (err) {
    log.warn('[systemTruthAudit] getLatestAudit error', {
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}
