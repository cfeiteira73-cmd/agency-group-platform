// =============================================================================
// Agency Group — SH-ROS | AMI: 22506
// Production Readiness Gate — 8-condition final gate for production go-live
// Wave 44 Agent 6 — Production Lock
// =============================================================================

import { createHash, randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'

let log: { info: (m: string, c?: Record<string, unknown>) => void; warn: (m: string, c?: Record<string, unknown>) => void; error: (m: string, c?: Record<string, unknown>) => void }
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { logger } = require('@/lib/observability/logger')
  log = logger
} catch {
  log = {
    info: (m: string, c?: Record<string, unknown>) => console.log('[prod-gate]', m, c ?? {}),
    warn: (m: string, c?: Record<string, unknown>) => console.warn('[prod-gate]', m, c ?? {}),
    error: (m: string, c?: Record<string, unknown>) => console.error('[prod-gate]', m, c ?? {}),
  }
}

const TENANT_ID =
  process.env.DEFAULT_TENANT_ID ??
  process.env.SYSTEM_ORG_ID ??
  '00000000-0000-0000-0000-000000000001'

// ── Types ──────────────────────────────────────────────────────────────────────

export type GateCondition =
  | 'CAPITAL_EXECUTION_REAL'
  | 'ESCROW_BANK_CONFIRMED'
  | 'LEGAL_REGISTRATION_COMPLETE'
  | 'EXTERNAL_DATA_RECONCILED'
  | 'LEDGER_BALANCED'
  | 'DR_TEST_APPROVED'
  | 'SECURITY_SCAN_CLEAN'
  | 'COMPLIANCE_APPROVED'

export type GateStatus = 'PASS' | 'FAIL' | 'PENDING' | 'BLOCKED'

export interface GateCheck {
  condition: GateCondition
  status: GateStatus
  measured_value: string
  threshold: string
  description: string
  checked_at: string
  blocking: boolean
}

export interface ProductionReadinessAssessment {
  assessment_id: string
  tenant_id: string
  assessed_at: string
  overall_status: 'PRODUCTION_READY' | 'NOT_READY' | 'PARTIALLY_READY'
  pass_count: number
  fail_count: number
  pending_count: number
  blocking_fails: number
  gate_checks: GateCheck[]
  estimated_days_to_ready: number | null
  certification_hash: string | null
}

// ── Gate check helpers ─────────────────────────────────────────────────────────

function makeCheck(
  condition: GateCondition,
  status: GateStatus,
  measuredValue: string,
  threshold: string,
  description: string,
): GateCheck {
  return {
    condition,
    status,
    measured_value: measuredValue,
    threshold,
    description,
    checked_at: new Date().toISOString(),
    blocking: true,
  }
}

// ── Check 1: Capital execution real ───────────────────────────────────────────

export async function checkCapitalExecutionReal(tenantId: string = TENANT_ID): Promise<GateCheck> {
  const condition: GateCondition = 'CAPITAL_EXECUTION_REAL'
  const threshold = '≥1 real end-to-end execution'
  const description = 'At least one capital execution completed through CONFIRMATION stage'

  try {
    // Try capital_execution_pipelines first, then capital_execution_events
    let count = 0
    const { data: pipeData } = await (supabaseAdmin as any)
      .from('capital_execution_pipelines')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('current_stage', 'CONFIRMATION')

    if (typeof pipeData === 'object' && pipeData !== null) {
      const { count: pipeCount } = await (supabaseAdmin as any)
        .from('capital_execution_pipelines')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('current_stage', 'CONFIRMATION')
      count = pipeCount ?? 0
    }

    if (count === 0) {
      // Try real_capital_executions
      const { count: execCount } = await (supabaseAdmin as any)
        .from('real_capital_executions')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'CONFIRMATION')
      count = execCount ?? 0
    }

    const status: GateStatus = count >= 1 ? 'PASS' : 'FAIL'
    return makeCheck(condition, status, `${count} confirmed executions`, threshold, description)
  } catch (e) {
    log.warn('checkCapitalExecutionReal failed', { error: String(e) })
    return makeCheck(condition, 'PENDING', 'query error', threshold, description)
  }
}

// ── Check 2: Escrow bank confirmed ────────────────────────────────────────────

export async function checkEscrowBankConfirmed(tenantId: string = TENANT_ID): Promise<GateCheck> {
  const condition: GateCondition = 'ESCROW_BANK_CONFIRMED'
  const threshold = '≥1 bank-confirmed escrow deposit'
  const description = 'At least one escrow position confirmed by the bank'

  try {
    const { count } = await (supabaseAdmin as any)
      .from('escrow_positions')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('bank_confirmed', true)

    const c = count ?? 0
    const status: GateStatus = c >= 1 ? 'PASS' : 'FAIL'
    return makeCheck(condition, status, `${c} bank-confirmed escrow positions`, threshold, description)
  } catch (e) {
    log.warn('checkEscrowBankConfirmed failed', { error: String(e) })
    return makeCheck(condition, 'PENDING', 'query error', threshold, description)
  }
}

// ── Check 3: Legal registration complete ──────────────────────────────────────

export async function checkLegalRegistrationComplete(tenantId: string = TENANT_ID): Promise<GateCheck> {
  const condition: GateCondition = 'LEGAL_REGISTRATION_COMPLETE'
  const threshold = '≥1 completed land registry confirmation'
  const description = 'At least one transaction reached LAND_REGISTRY stage completion'

  try {
    let count = 0

    // Try legal_execution_pipelines first
    const { count: pipeCount } = await (supabaseAdmin as any)
      .from('legal_execution_pipelines')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('current_stage', 'LAND_REGISTRY')

    count = pipeCount ?? 0

    if (count === 0) {
      const { count: evtCount } = await (supabaseAdmin as any)
        .from('legal_execution_events')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('stage', 'LAND_REGISTRY')
      count = evtCount ?? 0
    }

    const status: GateStatus = count >= 1 ? 'PASS' : 'FAIL'
    return makeCheck(condition, status, `${count} land registry completions`, threshold, description)
  } catch (e) {
    log.warn('checkLegalRegistrationComplete failed', { error: String(e) })
    return makeCheck(condition, 'PENDING', 'query error', threshold, description)
  }
}

// ── Check 4: External data reconciled ─────────────────────────────────────────

export async function checkExternalDataReconciled(tenantId: string = TENANT_ID): Promise<GateCheck> {
  const condition: GateCondition = 'EXTERNAL_DATA_RECONCILED'
  const threshold = '<10% rejection rate'
  const description = '90%+ of ingested data validates successfully'

  try {
    const { count: total } = await (supabaseAdmin as any)
      .from('validated_data_points')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)

    const { count: rejected } = await (supabaseAdmin as any)
      .from('validated_data_points')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('validation_status', 'REJECTED')

    const totalCount = total ?? 0
    const rejectedCount = rejected ?? 0

    if (totalCount === 0) {
      return makeCheck(condition, 'PENDING', '0 data points ingested', threshold, description)
    }

    const rejectionRate = (rejectedCount / totalCount) * 100
    const status: GateStatus = rejectionRate < 10 ? 'PASS' : 'FAIL'
    return makeCheck(
      condition,
      status,
      `${rejectionRate.toFixed(1)}% rejection rate (${rejectedCount}/${totalCount})`,
      threshold,
      description,
    )
  } catch (e) {
    log.warn('checkExternalDataReconciled failed', { error: String(e) })
    return makeCheck(condition, 'PENDING', 'query error', threshold, description)
  }
}

// ── Check 5: Ledger balanced ───────────────────────────────────────────────────

export async function checkLedgerBalanced(tenantId: string = TENANT_ID): Promise<GateCheck> {
  const condition: GateCondition = 'LEDGER_BALANCED'
  const threshold = 'Zero ledger imbalance (tolerance €1)'
  const description = 'Sum of all debits equals sum of all credits within €1 tolerance'

  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('journal_entries')
      .select('debit_cents, credit_cents')
      .eq('tenant_id', tenantId)

    if (error || !data) {
      return makeCheck(condition, 'PENDING', 'no journal entries', threshold, description)
    }

    const rows = data as Array<{ debit_cents: number; credit_cents: number }>
    if (rows.length === 0) {
      return makeCheck(condition, 'PENDING', 'no journal entries', threshold, description)
    }

    let debitTotal = BigInt(0)
    let creditTotal = BigInt(0)
    for (const row of rows) {
      debitTotal += BigInt(row.debit_cents ?? 0)
      creditTotal += BigInt(row.credit_cents ?? 0)
    }

    const diff = debitTotal > creditTotal
      ? debitTotal - creditTotal
      : creditTotal - debitTotal

    const balanced = diff <= BigInt(100) // €1 = 100 cents
    const status: GateStatus = balanced ? 'PASS' : 'FAIL'
    return makeCheck(
      condition,
      status,
      `imbalance: ${diff.toString()} cents`,
      threshold,
      description,
    )
  } catch (e) {
    log.warn('checkLedgerBalanced failed', { error: String(e) })
    return makeCheck(condition, 'PENDING', 'query error', threshold, description)
  }
}

// ── Check 6: DR test approved ──────────────────────────────────────────────────

export async function checkDrTestApproved(tenantId: string = TENANT_ID): Promise<GateCheck> {
  const condition: GateCondition = 'DR_TEST_APPROVED'
  const threshold = '≥1 DR test passed in last 30 days'
  const description = 'Disaster recovery test completed successfully within the last 30 days'

  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { count } = await (supabaseAdmin as any)
      .from('dr_test_results')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'PASSED')
      .gte('completed_at', since)

    const c = count ?? 0
    const status: GateStatus = c >= 1 ? 'PASS' : 'FAIL'
    return makeCheck(condition, status, `${c} DR tests passed in last 30 days`, threshold, description)
  } catch (e) {
    log.warn('checkDrTestApproved failed', { error: String(e) })
    return makeCheck(condition, 'PENDING', 'query error', threshold, description)
  }
}

// ── Check 7: Security scan clean ──────────────────────────────────────────────

export async function checkSecurityScanClean(tenantId: string = TENANT_ID): Promise<GateCheck> {
  const condition: GateCondition = 'SECURITY_SCAN_CLEAN'
  const threshold = 'Zero CRITICAL threat events in last 7 days'
  const description = 'No critical security threats detected in the past 7 days'

  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { count } = await (supabaseAdmin as any)
      .from('threat_events')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('severity', 'CRITICAL')
      .gte('detected_at', since)

    const c = count ?? 0
    const status: GateStatus = c === 0 ? 'PASS' : 'FAIL'
    return makeCheck(condition, status, `${c} CRITICAL threats in last 7 days`, threshold, description)
  } catch (e) {
    log.warn('checkSecurityScanClean failed', { error: String(e) })
    return makeCheck(condition, 'PENDING', 'query error', threshold, description)
  }
}

// ── Check 8: Compliance approved ──────────────────────────────────────────────

export async function checkComplianceApproved(tenantId: string = TENANT_ID): Promise<GateCheck> {
  const condition: GateCondition = 'COMPLIANCE_APPROVED'
  const threshold = '≥1 KYC approved, 0 GDPR overdue'
  const description = 'At least one approved KYC record and zero overdue GDPR requests'

  try {
    const { count: kycCount } = await (supabaseAdmin as any)
      .from('kyc_records')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'APPROVED')

    const now = new Date().toISOString()
    const { count: overdueCount } = await (supabaseAdmin as any)
      .from('gdpr_requests')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .neq('status', 'COMPLETED')
      .lt('deadline', now)

    const kyc = kycCount ?? 0
    const overdue = overdueCount ?? 0

    const pass = kyc >= 1 && overdue === 0
    const status: GateStatus = pass ? 'PASS' : 'FAIL'
    return makeCheck(
      condition,
      status,
      `${kyc} KYC approved, ${overdue} GDPR overdue`,
      threshold,
      description,
    )
  } catch (e) {
    log.warn('checkComplianceApproved failed', { error: String(e) })
    return makeCheck(condition, 'PENDING', 'query error', threshold, description)
  }
}

// ── Run all 8 gate checks ──────────────────────────────────────────────────────

export async function runProductionReadinessGate(
  tenantId: string = TENANT_ID,
): Promise<ProductionReadinessAssessment> {
  const assessedAt = new Date().toISOString()
  const assessmentId = randomUUID()

  const results = await Promise.allSettled([
    checkCapitalExecutionReal(tenantId),
    checkEscrowBankConfirmed(tenantId),
    checkLegalRegistrationComplete(tenantId),
    checkExternalDataReconciled(tenantId),
    checkLedgerBalanced(tenantId),
    checkDrTestApproved(tenantId),
    checkSecurityScanClean(tenantId),
    checkComplianceApproved(tenantId),
  ])

  const conditions: GateCondition[] = [
    'CAPITAL_EXECUTION_REAL',
    'ESCROW_BANK_CONFIRMED',
    'LEGAL_REGISTRATION_COMPLETE',
    'EXTERNAL_DATA_RECONCILED',
    'LEDGER_BALANCED',
    'DR_TEST_APPROVED',
    'SECURITY_SCAN_CLEAN',
    'COMPLIANCE_APPROVED',
  ]

  const gateChecks: GateCheck[] = results.map((result, i) => {
    if (result.status === 'fulfilled') return result.value
    return makeCheck(
      conditions[i],
      'PENDING',
      'check failed to run',
      'N/A',
      `Gate check ${conditions[i]} failed to execute`,
    )
  })

  const passCount = gateChecks.filter(c => c.status === 'PASS').length
  const failCount = gateChecks.filter(c => c.status === 'FAIL').length
  const pendingCount = gateChecks.filter(c => c.status === 'PENDING' || c.status === 'BLOCKED').length
  const blockingFails = gateChecks.filter(c => c.blocking && c.status === 'FAIL').length

  let overallStatus: ProductionReadinessAssessment['overall_status']
  if (blockingFails === 0 && passCount === 8) {
    overallStatus = 'PRODUCTION_READY'
  } else if (blockingFails > 0) {
    overallStatus = 'NOT_READY'
  } else {
    overallStatus = 'PARTIALLY_READY'
  }

  const certificationHash = overallStatus === 'PRODUCTION_READY'
    ? createHash('sha256')
        .update(JSON.stringify({ tenant_id: tenantId, pass_count: 8, assessed_at: assessedAt }))
        .digest('hex')
    : null

  const estimatedDaysToReady = overallStatus === 'PRODUCTION_READY'
    ? null
    : (failCount + pendingCount) * 7

  const assessment: ProductionReadinessAssessment = {
    assessment_id: assessmentId,
    tenant_id: tenantId,
    assessed_at: assessedAt,
    overall_status: overallStatus,
    pass_count: passCount,
    fail_count: failCount,
    pending_count: pendingCount,
    blocking_fails: blockingFails,
    gate_checks: gateChecks,
    estimated_days_to_ready: estimatedDaysToReady,
    certification_hash: certificationHash,
  }

  // Fire-and-forget persist
  void (supabaseAdmin as any)
    .from('production_readiness_assessments')
    .insert({
      assessment_id: assessment.assessment_id,
      tenant_id: assessment.tenant_id,
      assessed_at: assessment.assessed_at,
      overall_status: assessment.overall_status,
      pass_count: assessment.pass_count,
      fail_count: assessment.fail_count,
      pending_count: assessment.pending_count,
      blocking_fails: assessment.blocking_fails,
      gate_checks: assessment.gate_checks,
      estimated_days_to_ready: assessment.estimated_days_to_ready,
      certification_hash: assessment.certification_hash,
    })
    .catch((e: unknown) => console.warn('[prod-gate] persist assessment error', e))

  log.info('Production readiness gate assessed', {
    overall_status: overallStatus,
    pass_count: passCount,
    fail_count: failCount,
    blocking_fails: blockingFails,
  })

  return assessment
}

// ── Query helpers ──────────────────────────────────────────────────────────────

export async function getLatestAssessment(
  tenantId: string = TENANT_ID,
): Promise<ProductionReadinessAssessment | null> {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('production_readiness_assessments')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('assessed_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error || !data) return null

    return {
      assessment_id: data.assessment_id,
      tenant_id: data.tenant_id,
      assessed_at: data.assessed_at,
      overall_status: data.overall_status,
      pass_count: data.pass_count,
      fail_count: data.fail_count,
      pending_count: data.pending_count,
      blocking_fails: data.blocking_fails,
      gate_checks: data.gate_checks,
      estimated_days_to_ready: data.estimated_days_to_ready,
      certification_hash: data.certification_hash,
    }
  } catch (e) {
    log.error('getLatestAssessment exception', { error: String(e) })
    return null
  }
}

export async function getAssessmentHistory(
  tenantId: string = TENANT_ID,
  limit = 10,
): Promise<ProductionReadinessAssessment[]> {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('production_readiness_assessments')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('assessed_at', { ascending: false })
      .limit(limit)

    if (error || !data) return []

    return (data as Array<Record<string, unknown>>).map(row => ({
      assessment_id: row.assessment_id as string,
      tenant_id: row.tenant_id as string,
      assessed_at: row.assessed_at as string,
      overall_status: row.overall_status as ProductionReadinessAssessment['overall_status'],
      pass_count: row.pass_count as number,
      fail_count: row.fail_count as number,
      pending_count: row.pending_count as number,
      blocking_fails: row.blocking_fails as number,
      gate_checks: row.gate_checks as GateCheck[],
      estimated_days_to_ready: row.estimated_days_to_ready as number | null,
      certification_hash: row.certification_hash as string | null,
    }))
  } catch (e) {
    log.error('getAssessmentHistory exception', { error: String(e) })
    return []
  }
}
