// Agency Group — System Final Validator
// lib/validation/systemFinalValidator.ts
// TypeScript strict — 0 errors
//
// The production readiness gate for REAL_EUROPEAN_CAPITAL_MARKET_INFRASTRUCTURE.
// Checks all 5 mandatory conditions before declaring production status.

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ValidationGateStatus = 'PASS' | 'FAIL' | 'PARTIAL' | 'NOT_CHECKED'

export interface ValidationGate {
  gate_id: string
  gate_name: string
  description: string
  status: ValidationGateStatus
  details: string
  blocking: boolean
  checked_at: string
}

export interface ProductionReadinessReport {
  report_id: string
  tenant_id: string
  system_status:
    | 'REAL_EUROPEAN_CAPITAL_MARKET_INFRASTRUCTURE'
    | 'SIMULATION_ONLY'
    | 'PARTIAL_REAL'
    | 'BLOCKED'
  overall_ready: boolean
  gates: ValidationGate[]
  blocking_gates: ValidationGate[]
  pass_count: number
  fail_count: number
  partial_count: number
  readiness_score_pct: number
  generated_at: string
  valid_until: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isoNow(): string {
  return new Date().toISOString()
}

function isoIn24h(): string {
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
}

function gate(
  id: string,
  name: string,
  description: string,
  status: ValidationGateStatus,
  details: string,
): ValidationGate {
  return {
    gate_id: id,
    gate_name: name,
    description,
    status,
    details,
    blocking: true,
    checked_at: isoNow(),
  }
}

// ─── Gate Checks ──────────────────────────────────────────────────────────────

async function checkCapitalFlowVerified(tenantId: string): Promise<ValidationGate> {
  try {
    const [pipelinesRes, realityRes] = await Promise.allSettled([
      (supabaseAdmin as any)
        .from('capital_execution_pipelines')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'COMPLETED'),
      (supabaseAdmin as any)
        .from('capital_reality_checks')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('reality_status', 'REAL'),
    ])

    const pipelinesCount =
      pipelinesRes.status === 'fulfilled' ? (pipelinesRes.value.count ?? 0) : 0
    const realityCount =
      realityRes.status === 'fulfilled' ? (realityRes.value.count ?? 0) : 0

    if (pipelinesCount >= 1 && realityCount >= 1) {
      return gate(
        'CAPITAL_FLOW_VERIFIED',
        'Capital Flow Verified',
        'Real capital execution pipelines and reality checks must exist',
        'PASS',
        `${pipelinesCount} completed pipelines, ${realityCount} REAL reality checks`,
      )
    }
    if (pipelinesCount >= 1) {
      return gate(
        'CAPITAL_FLOW_VERIFIED',
        'Capital Flow Verified',
        'Real capital execution pipelines and reality checks must exist',
        'PARTIAL',
        `${pipelinesCount} completed pipelines but 0 REAL reality checks`,
      )
    }
    return gate(
      'CAPITAL_FLOW_VERIFIED',
      'Capital Flow Verified',
      'Real capital execution pipelines and reality checks must exist',
      'FAIL',
      'No completed capital pipelines or REAL reality checks found',
    )
  } catch (err) {
    log.warn('[systemFinalValidator] CAPITAL_FLOW_VERIFIED check error', { err })
    return gate(
      'CAPITAL_FLOW_VERIFIED',
      'Capital Flow Verified',
      'Real capital execution pipelines and reality checks must exist',
      'FAIL',
      'Gate check threw an error',
    )
  }
}

async function checkLegalExecutionVerified(tenantId: string): Promise<ValidationGate> {
  try {
    const [workflowsRes, eidasRes] = await Promise.allSettled([
      (supabaseAdmin as any)
        .from('legal_workflows')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .neq('status', 'ACTIVE'),
      (supabaseAdmin as any)
        .from('eidas_signature_requests')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'SIGNED'),
    ])

    const workflowsCount =
      workflowsRes.status === 'fulfilled' ? (workflowsRes.value.count ?? 0) : 0
    const eidasCount =
      eidasRes.status === 'fulfilled' ? (eidasRes.value.count ?? 0) : 0

    if (workflowsCount >= 1 && eidasCount >= 1) {
      return gate(
        'LEGAL_EXECUTION_VERIFIED',
        'Legal Execution Verified',
        'Legal workflows must have progressed and eIDAS signatures must exist',
        'PASS',
        `${workflowsCount} progressed workflows, ${eidasCount} signed eIDAS requests`,
      )
    }
    if (workflowsCount >= 1) {
      return gate(
        'LEGAL_EXECUTION_VERIFIED',
        'Legal Execution Verified',
        'Legal workflows must have progressed and eIDAS signatures must exist',
        'PARTIAL',
        `${workflowsCount} progressed workflows but 0 signed eIDAS requests`,
      )
    }
    return gate(
      'LEGAL_EXECUTION_VERIFIED',
      'Legal Execution Verified',
      'Legal workflows must have progressed and eIDAS signatures must exist',
      'FAIL',
      'No progressed legal workflows or signed eIDAS requests found',
    )
  } catch (err) {
    log.warn('[systemFinalValidator] LEGAL_EXECUTION_VERIFIED check error', { err })
    return gate(
      'LEGAL_EXECUTION_VERIFIED',
      'Legal Execution Verified',
      'Legal workflows must have progressed and eIDAS signatures must exist',
      'FAIL',
      'Gate check threw an error',
    )
  }
}

async function checkExternalMarketSyncVerified(tenantId: string): Promise<ValidationGate> {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const [benchmarksRes, reportsRes] = await Promise.allSettled([
      (supabaseAdmin as any)
        .from('external_price_benchmarks')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .gte('fetched_at', sevenDaysAgo),
      (supabaseAdmin as any)
        .from('market_externalization_reports')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId),
    ])

    const benchmarksCount =
      benchmarksRes.status === 'fulfilled' ? (benchmarksRes.value.count ?? 0) : 0
    const reportsCount =
      reportsRes.status === 'fulfilled' ? (reportsRes.value.count ?? 0) : 0

    if (benchmarksCount >= 1 && reportsCount >= 1) {
      return gate(
        'EXTERNAL_MARKET_SYNC_VERIFIED',
        'External Market Sync Verified',
        'Fresh external price benchmarks and market externalization reports must exist',
        'PASS',
        `${benchmarksCount} fresh benchmarks (last 7d), ${reportsCount} externalization reports`,
      )
    }
    if (benchmarksCount >= 1) {
      return gate(
        'EXTERNAL_MARKET_SYNC_VERIFIED',
        'External Market Sync Verified',
        'Fresh external price benchmarks and market externalization reports must exist',
        'PARTIAL',
        `${benchmarksCount} fresh benchmarks but 0 externalization reports`,
      )
    }
    return gate(
      'EXTERNAL_MARKET_SYNC_VERIFIED',
      'External Market Sync Verified',
      'Fresh external price benchmarks and market externalization reports must exist',
      'FAIL',
      'No fresh external price benchmarks or externalization reports found',
    )
  } catch (err) {
    log.warn('[systemFinalValidator] EXTERNAL_MARKET_SYNC_VERIFIED check error', { err })
    return gate(
      'EXTERNAL_MARKET_SYNC_VERIFIED',
      'External Market Sync Verified',
      'Fresh external price benchmarks and market externalization reports must exist',
      'FAIL',
      'Gate check threw an error',
    )
  }
}

async function checkMlAlignedWithReality(tenantId: string): Promise<ValidationGate> {
  try {
    const [alignmentsRes, outcomesRes] = await Promise.allSettled([
      (supabaseAdmin as any)
        .from('ml_reality_alignments')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .not('drift_severity', 'in', '("HIGH","CRITICAL")'),
      (supabaseAdmin as any)
        .from('real_outcomes')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId),
    ])

    const alignmentsCount =
      alignmentsRes.status === 'fulfilled' ? (alignmentsRes.value.count ?? 0) : 0
    const outcomesCount =
      outcomesRes.status === 'fulfilled' ? (outcomesRes.value.count ?? 0) : 0

    if (alignmentsCount >= 1 && outcomesCount >= 5) {
      return gate(
        'ML_ALIGNED_WITH_REALITY',
        'ML Aligned with Reality',
        'ML alignments must show no HIGH/CRITICAL drift and at least 5 real outcomes must exist',
        'PASS',
        `${alignmentsCount} non-critical alignments, ${outcomesCount} real outcomes`,
      )
    }
    if (alignmentsCount >= 1) {
      return gate(
        'ML_ALIGNED_WITH_REALITY',
        'ML Aligned with Reality',
        'ML alignments must show no HIGH/CRITICAL drift and at least 5 real outcomes must exist',
        'PARTIAL',
        `${alignmentsCount} non-critical alignments but only ${outcomesCount} real outcomes (need 5)`,
      )
    }
    return gate(
      'ML_ALIGNED_WITH_REALITY',
      'ML Aligned with Reality',
      'ML alignments must show no HIGH/CRITICAL drift and at least 5 real outcomes must exist',
      'FAIL',
      'No acceptable ML reality alignments found',
    )
  } catch (err) {
    log.warn('[systemFinalValidator] ML_ALIGNED_WITH_REALITY check error', { err })
    return gate(
      'ML_ALIGNED_WITH_REALITY',
      'ML Aligned with Reality',
      'ML alignments must show no HIGH/CRITICAL drift and at least 5 real outcomes must exist',
      'FAIL',
      'Gate check threw an error',
    )
  }
}

async function checkComplianceApproved(tenantId: string): Promise<ValidationGate> {
  try {
    const [reportsRes, mifidRes] = await Promise.allSettled([
      (supabaseAdmin as any)
        .from('compliance_reports')
        .select('overall_score_pct, ready_for_institutional')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(1),
      (supabaseAdmin as any)
        .from('mifid_classifications')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId),
    ])

    const latestReport =
      reportsRes.status === 'fulfilled' && reportsRes.value.data?.length > 0
        ? reportsRes.value.data[0]
        : null
    const mifidCount =
      mifidRes.status === 'fulfilled' ? (mifidRes.value.count ?? 0) : 0

    const compliancePassed =
      latestReport !== null &&
      (latestReport.overall_score_pct ?? 0) >= 60 &&
      latestReport.ready_for_institutional === true

    if (compliancePassed && mifidCount >= 1) {
      return gate(
        'COMPLIANCE_APPROVED',
        'Compliance Approved',
        'Latest compliance report must score ≥60% and be institutional-ready, with MiFID classifications',
        'PASS',
        `Compliance score ${latestReport!.overall_score_pct}%, institutional-ready: true, ${mifidCount} MiFID classifications`,
      )
    }
    if (mifidCount >= 1) {
      return gate(
        'COMPLIANCE_APPROVED',
        'Compliance Approved',
        'Latest compliance report must score ≥60% and be institutional-ready, with MiFID classifications',
        'PARTIAL',
        `${mifidCount} MiFID classifications but compliance report insufficient (score: ${latestReport?.overall_score_pct ?? 'N/A'}, institutional: ${latestReport?.ready_for_institutional ?? false})`,
      )
    }
    return gate(
      'COMPLIANCE_APPROVED',
      'Compliance Approved',
      'Latest compliance report must score ≥60% and be institutional-ready, with MiFID classifications',
      'FAIL',
      'No valid compliance approval or MiFID classifications found',
    )
  } catch (err) {
    log.warn('[systemFinalValidator] COMPLIANCE_APPROVED check error', { err })
    return gate(
      'COMPLIANCE_APPROVED',
      'Compliance Approved',
      'Latest compliance report must score ≥60% and be institutional-ready, with MiFID classifications',
      'FAIL',
      'Gate check threw an error',
    )
  }
}

// ─── System Status Resolver ───────────────────────────────────────────────────

function resolveSystemStatus(
  gates: ValidationGate[],
): ProductionReadinessReport['system_status'] {
  const passCount = gates.filter(g => g.status === 'PASS').length
  const failCount = gates.filter(g => g.status === 'FAIL').length
  const hasBlockingFail = gates.some(g => g.blocking && g.status === 'FAIL')

  if (passCount === 5) return 'REAL_EUROPEAN_CAPITAL_MARKET_INFRASTRUCTURE'
  if (hasBlockingFail) return 'BLOCKED'
  if (passCount >= 3 && failCount === 0) return 'PARTIAL_REAL'
  if (failCount === 5) return 'SIMULATION_ONLY'
  return 'BLOCKED'
}

// ─── Main: runProductionReadinessCheck ───────────────────────────────────────

export async function runProductionReadinessCheck(
  tenantId: string,
): Promise<ProductionReadinessReport> {
  const reportId = randomUUID()
  log.info('[systemFinalValidator] running production readiness check', { tenant_id: tenantId })

  const results = await Promise.allSettled([
    checkCapitalFlowVerified(tenantId),
    checkLegalExecutionVerified(tenantId),
    checkExternalMarketSyncVerified(tenantId),
    checkMlAlignedWithReality(tenantId),
    checkComplianceApproved(tenantId),
  ])

  const gates: ValidationGate[] = results.map(r =>
    r.status === 'fulfilled'
      ? r.value
      : gate('UNKNOWN', 'Unknown Gate', 'Gate check failed to run', 'FAIL', 'Promise rejected'),
  )

  const passCount = gates.filter(g => g.status === 'PASS').length
  const failCount = gates.filter(g => g.status === 'FAIL').length
  const partialCount = gates.filter(g => g.status === 'PARTIAL').length
  const blockingGates = gates.filter(g => g.blocking && g.status !== 'PASS')
  const systemStatus = resolveSystemStatus(gates)
  const readinessScorePct = Math.round((passCount / gates.length) * 100 * 100) / 100

  const report: ProductionReadinessReport = {
    report_id: reportId,
    tenant_id: tenantId,
    system_status: systemStatus,
    overall_ready: systemStatus === 'REAL_EUROPEAN_CAPITAL_MARKET_INFRASTRUCTURE',
    gates,
    blocking_gates: blockingGates,
    pass_count: passCount,
    fail_count: failCount,
    partial_count: partialCount,
    readiness_score_pct: readinessScorePct,
    generated_at: isoNow(),
    valid_until: isoIn24h(),
  }

  void (supabaseAdmin as any)
    .from('production_readiness_reports')
    .insert({
      report_id: report.report_id,
      tenant_id: report.tenant_id,
      system_status: report.system_status,
      overall_ready: report.overall_ready,
      gates: report.gates,
      blocking_gates: report.blocking_gates,
      pass_count: report.pass_count,
      fail_count: report.fail_count,
      partial_count: report.partial_count,
      readiness_score_pct: report.readiness_score_pct,
      generated_at: report.generated_at,
      valid_until: report.valid_until,
    })
    .catch((e: unknown) => log.warn('[systemFinalValidator] persist failed', { e }))

  log.info('[systemFinalValidator] readiness check complete', {
    tenant_id: tenantId,
    system_status: systemStatus,
    pass_count: passCount,
    fail_count: failCount,
    score_pct: readinessScorePct,
  })

  return report
}

// ─── getLatestReadinessReport ─────────────────────────────────────────────────

export async function getLatestReadinessReport(
  tenantId: string,
): Promise<ProductionReadinessReport | null> {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('production_readiness_reports')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('generated_at', { ascending: false })
      .limit(1)

    if (error || !data || data.length === 0) return null

    const row = data[0]
    return {
      report_id: row.report_id,
      tenant_id: row.tenant_id,
      system_status: row.system_status,
      overall_ready: row.overall_ready,
      gates: row.gates ?? [],
      blocking_gates: row.blocking_gates ?? [],
      pass_count: row.pass_count ?? 0,
      fail_count: row.fail_count ?? 0,
      partial_count: row.partial_count ?? 0,
      readiness_score_pct: parseFloat(row.readiness_score_pct ?? '0'),
      generated_at: row.generated_at,
      valid_until: row.valid_until,
    }
  } catch (err) {
    log.warn('[systemFinalValidator] getLatestReadinessReport failed', { err })
    return null
  }
}

// ─── getSystemStatusBadge ─────────────────────────────────────────────────────

export async function getSystemStatusBadge(tenantId: string): Promise<{
  status: string
  score: number
  color: 'green' | 'yellow' | 'red'
}> {
  const report = await getLatestReadinessReport(tenantId)

  if (!report) {
    return { status: 'NOT_CHECKED', score: 0, color: 'red' }
  }

  const color: 'green' | 'yellow' | 'red' =
    report.system_status === 'REAL_EUROPEAN_CAPITAL_MARKET_INFRASTRUCTURE'
      ? 'green'
      : report.system_status === 'PARTIAL_REAL'
        ? 'yellow'
        : 'red'

  return {
    status: report.system_status,
    score: report.readiness_score_pct,
    color,
  }
}
