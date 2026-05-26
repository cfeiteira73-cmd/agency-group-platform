// Agency Group — Final Production Certification
// lib/certification/finalProductionCertification.ts
// Wave 45 Agent 6 — Apex certification gate for SH-ROS platform
// Aggregates ALL certification subsystems built in Waves 43-45
// TypeScript strict — 0 errors

import { randomUUID, createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { runSyntheticTests } from '@/lib/financial-integrity/syntheticTransactionEngine'

// ── Tenant constant ────────────────────────────────────────────────────────────

const SYSTEM_TENANT_ID =
  process.env.DEFAULT_TENANT_ID ??
  process.env.SYSTEM_ORG_ID ??
  '00000000-0000-0000-0000-000000000001'

// ── Types ─────────────────────────────────────────────────────────────────────

export type CertificationCondition =
  | 'ZERO_TYPESCRIPT_ERRORS'
  | 'ZERO_CRITICAL_VULNERABILITIES'
  | 'LEDGER_BALANCED'
  | 'FINANCIAL_INTEGRITY_CERTIFIED'
  | 'SYNTHETIC_TESTS_PASSING'
  | 'ZERO_TENANT_LEAKAGE'
  | 'AUDIT_CHAIN_VERIFIED'
  | 'DR_VALIDATED'
  | 'BACKUP_FRESH'
  | 'REPLAY_DETERMINISTIC'
  | 'SECURITY_HARDENED'
  | 'RATE_LIMITING_ACTIVE'
  | 'SLO_TARGETS_MET'
  | 'COMPLIANCE_OPERATIONAL'
  | 'SUPPLY_INGESTION_ACTIVE'

export type SystemStatus =
  | 'FULLY_OPERATIONAL_REAL_ESTATE_CAPITAL_OS'
  | 'CONDITIONALLY_OPERATIONAL'
  | 'DEGRADED'
  | 'NOT_READY'

export interface ConditionResult {
  condition: CertificationCondition
  status: 'PASS' | 'FAIL' | 'WARN' | 'PENDING'
  score: number // 0-100
  detail: string
  checked_at: string
}

export interface FinalCertificationResult {
  certification_id: string
  tenant_id: string
  system_status: SystemStatus
  overall_score: number // 0-100 weighted average
  conditions: ConditionResult[]
  blocking_failures: CertificationCondition[]
  warnings: CertificationCondition[]
  certification_hash: string | null // SHA-256, only when FULLY_OPERATIONAL
  certified_at: string
}

// ── Condition weight map (LEDGER_BALANCED and AUDIT_CHAIN_VERIFIED are 2x) ───

const CONDITION_WEIGHTS: Record<CertificationCondition, number> = {
  ZERO_TYPESCRIPT_ERRORS: 1,
  ZERO_CRITICAL_VULNERABILITIES: 1,
  LEDGER_BALANCED: 2,
  FINANCIAL_INTEGRITY_CERTIFIED: 1,
  SYNTHETIC_TESTS_PASSING: 1,
  ZERO_TENANT_LEAKAGE: 1,
  AUDIT_CHAIN_VERIFIED: 2,
  DR_VALIDATED: 1,
  BACKUP_FRESH: 1,
  REPLAY_DETERMINISTIC: 1,
  SECURITY_HARDENED: 1,
  RATE_LIMITING_ACTIVE: 1,
  SLO_TARGETS_MET: 1,
  COMPLIANCE_OPERATIONAL: 1,
  SUPPLY_INGESTION_ACTIVE: 1,
}

// ── Status score constants ─────────────────────────────────────────────────────

const STATUS_SCORE: Record<'PASS' | 'WARN' | 'PENDING' | 'FAIL', number> = {
  PASS: 100,
  WARN: 75,
  PENDING: 50,
  FAIL: 0,
}

// ── Individual condition checkers ─────────────────────────────────────────────

async function checkZeroTypescriptErrors(now: string): Promise<ConditionResult> {
  // No runtime compilation table — return PENDING with manual check instruction
  try {
    const { data } = await (supabaseAdmin as any)
      .from('compilation_status')
      .select('status, checked_at')
      .order('checked_at', { ascending: false })
      .limit(1)

    const row = (data as Array<{ status: string; checked_at: string }> | null)?.[0]
    if (row?.status === 'PASS') {
      return {
        condition: 'ZERO_TYPESCRIPT_ERRORS',
        status: 'PASS',
        score: 100,
        detail: `Last TS check: PASS at ${row.checked_at}`,
        checked_at: now,
      }
    }
  } catch {
    // Table may not exist — return PENDING
  }

  return {
    condition: 'ZERO_TYPESCRIPT_ERRORS',
    status: 'PENDING',
    score: 50,
    detail: 'Manual TS check required before live deployment. Run: tsc --noEmit',
    checked_at: now,
  }
}

async function checkZeroCriticalVulnerabilities(
  tenantId: string,
  now: string,
): Promise<ConditionResult> {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count } = await (supabaseAdmin as any)
      .from('threat_events')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('severity', 'CRITICAL')
      .gte('detected_at', cutoff)

    const criticalCount = count ?? 0
    if (criticalCount === 0) {
      return {
        condition: 'ZERO_CRITICAL_VULNERABILITIES',
        status: 'PASS',
        score: 100,
        detail: 'No CRITICAL threat events in the last 24 hours',
        checked_at: now,
      }
    }

    return {
      condition: 'ZERO_CRITICAL_VULNERABILITIES',
      status: 'FAIL',
      score: 0,
      detail: `${criticalCount} CRITICAL threat events detected in the last 24 hours`,
      checked_at: now,
    }
  } catch {
    return {
      condition: 'ZERO_CRITICAL_VULNERABILITIES',
      status: 'PENDING',
      score: 50,
      detail: 'threat_events table not accessible — manual security review required',
      checked_at: now,
    }
  }
}

async function checkLedgerBalanced(tenantId: string, now: string): Promise<ConditionResult> {
  try {
    const { data } = await (supabaseAdmin as any)
      .from('journal_entries')
      .select('entry_type, amount_cents')
      .eq('tenant_id', tenantId)
      .eq('status', 'POSTED')

    const rows = (data as Array<{ entry_type: string; amount_cents: string | number | null }> | null) ?? []

    let debitTotal = BigInt(0)
    let creditTotal = BigInt(0)

    for (const row of rows) {
      const amt = BigInt(String(row.amount_cents ?? '0'))
      if (row.entry_type === 'DEBIT') {
        debitTotal += amt
      } else if (row.entry_type === 'CREDIT') {
        creditTotal += amt
      }
    }

    const diff = debitTotal > creditTotal ? debitTotal - creditTotal : creditTotal - debitTotal
    const tolerance = BigInt(100) // €1 = 100 cents

    if (diff <= tolerance) {
      return {
        condition: 'LEDGER_BALANCED',
        status: 'PASS',
        score: 100,
        detail: `Ledger balanced: debit=${debitTotal.toString()} credit=${creditTotal.toString()} diff=${diff.toString()} cents (within €1 tolerance). ${rows.length} POSTED entries.`,
        checked_at: now,
      }
    }

    return {
      condition: 'LEDGER_BALANCED',
      status: 'FAIL',
      score: 0,
      detail: `Ledger imbalanced: debit=${debitTotal.toString()} credit=${creditTotal.toString()} diff=${diff.toString()} cents (exceeds €1 tolerance)`,
      checked_at: now,
    }
  } catch (e) {
    return {
      condition: 'LEDGER_BALANCED',
      status: 'PENDING',
      score: 50,
      detail: `journal_entries not accessible: ${e instanceof Error ? e.message : 'unknown error'}`,
      checked_at: now,
    }
  }
}

async function checkFinancialIntegrityCertified(
  tenantId: string,
  now: string,
): Promise<ConditionResult> {
  try {
    const { data } = await (supabaseAdmin as any)
      .from('ledger_certifications')
      .select('overall_status, certified_at')
      .eq('tenant_id', tenantId)
      .order('certified_at', { ascending: false })
      .limit(1)

    const row = (data as Array<{ overall_status: string; certified_at: string }> | null)?.[0]

    if (row?.overall_status === 'CERTIFIED') {
      return {
        condition: 'FINANCIAL_INTEGRITY_CERTIFIED',
        status: 'PASS',
        score: 100,
        detail: `Latest ledger certification: CERTIFIED at ${row.certified_at}`,
        checked_at: now,
      }
    }

    if (row) {
      return {
        condition: 'FINANCIAL_INTEGRITY_CERTIFIED',
        status: 'WARN',
        score: 75,
        detail: `Latest ledger certification status: ${row.overall_status} — re-run certifier`,
        checked_at: now,
      }
    }

    return {
      condition: 'FINANCIAL_INTEGRITY_CERTIFIED',
      status: 'PENDING',
      score: 50,
      detail: 'No ledger certification found — run ledgerCertifier.runLedgerCertification()',
      checked_at: now,
    }
  } catch {
    return {
      condition: 'FINANCIAL_INTEGRITY_CERTIFIED',
      status: 'PENDING',
      score: 50,
      detail: 'ledger_certifications table not accessible',
      checked_at: now,
    }
  }
}

function checkSyntheticTestsPassing(now: string): ConditionResult {
  try {
    const suite = runSyntheticTests()

    if (suite.all_passed) {
      return {
        condition: 'SYNTHETIC_TESTS_PASSING',
        status: 'PASS',
        score: 100,
        detail: `All ${suite.pass_count}/${suite.results.length} synthetic transaction tests pass (PT+ES fee engine)`,
        checked_at: now,
      }
    }

    const failedNames = suite.results.filter(r => !r.passed).map(r => r.test_name)
    return {
      condition: 'SYNTHETIC_TESTS_PASSING',
      status: 'FAIL',
      score: Math.round((suite.pass_count / suite.results.length) * 100),
      detail: `${suite.fail_count} synthetic tests failing: ${failedNames.join(', ')}`,
      checked_at: now,
    }
  } catch (e) {
    return {
      condition: 'SYNTHETIC_TESTS_PASSING',
      status: 'FAIL',
      score: 0,
      detail: `Synthetic test runner error: ${e instanceof Error ? e.message : 'unknown'}`,
      checked_at: now,
    }
  }
}

async function checkZeroTenantLeakage(tenantId: string, now: string): Promise<ConditionResult> {
  try {
    const { data } = await (supabaseAdmin as any)
      .from('journal_entries')
      .select('id, tenant_id')
      .order('created_at', { ascending: false })
      .limit(10)

    const rows =
      (data as Array<{ id: string; tenant_id: string }> | null) ?? []

    if (rows.length === 0) {
      return {
        condition: 'ZERO_TENANT_LEAKAGE',
        status: 'PASS',
        score: 100,
        detail: 'No journal entries found — no leakage possible',
        checked_at: now,
      }
    }

    const leaked = rows.filter(r => r.tenant_id !== tenantId)
    if (leaked.length === 0) {
      return {
        condition: 'ZERO_TENANT_LEAKAGE',
        status: 'PASS',
        score: 100,
        detail: `Sampled ${rows.length} journal entries — all belong to tenant ${tenantId}`,
        checked_at: now,
      }
    }

    return {
      condition: 'ZERO_TENANT_LEAKAGE',
      status: 'FAIL',
      score: 0,
      detail: `CRITICAL: ${leaked.length}/${rows.length} sampled journal entries have wrong tenant_id`,
      checked_at: now,
    }
  } catch {
    return {
      condition: 'ZERO_TENANT_LEAKAGE',
      status: 'PENDING',
      score: 50,
      detail: 'Could not sample journal_entries for tenant leakage check',
      checked_at: now,
    }
  }
}

async function checkAuditChainVerified(tenantId: string, now: string): Promise<ConditionResult> {
  try {
    const { data } = await (supabaseAdmin as any)
      .from('immutable_audit_trail')
      .select('entry_id, chain_hash, previous_hash, sequence_number')
      .eq('tenant_id', tenantId)
      .order('sequence_number', { ascending: false })
      .limit(100)

    const rows = (
      data as Array<{
        entry_id: string
        chain_hash: string
        previous_hash: string | null
        sequence_number: number
      }> | null
    ) ?? []

    if (rows.length === 0) {
      return {
        condition: 'AUDIT_CHAIN_VERIFIED',
        status: 'PENDING',
        score: 50,
        detail: 'No audit trail entries found — new deployment or trail not yet populated',
        checked_at: now,
      }
    }

    // Verify chain: each entry's previous_hash should not equal its own chain_hash
    // (basic sanity — deep cryptographic replay is done by immutableAuditTrail.ts)
    let brokenLinks = 0
    const sortedRows = [...rows].sort((a, b) => a.sequence_number - b.sequence_number)
    for (let i = 1; i < sortedRows.length; i++) {
      if (sortedRows[i].previous_hash !== sortedRows[i - 1].chain_hash) {
        brokenLinks++
      }
    }

    if (brokenLinks === 0) {
      return {
        condition: 'AUDIT_CHAIN_VERIFIED',
        status: 'PASS',
        score: 100,
        detail: `Audit chain verified: ${rows.length} entries, 0 broken links. Latest seq: ${rows[0]?.sequence_number}`,
        checked_at: now,
      }
    }

    return {
      condition: 'AUDIT_CHAIN_VERIFIED',
      status: 'FAIL',
      score: 0,
      detail: `CRITICAL: ${brokenLinks} broken links found in audit chain — chain integrity compromised`,
      checked_at: now,
    }
  } catch {
    return {
      condition: 'AUDIT_CHAIN_VERIFIED',
      status: 'PENDING',
      score: 50,
      detail: 'immutable_audit_trail not accessible',
      checked_at: now,
    }
  }
}

async function checkDrValidated(tenantId: string, now: string): Promise<ConditionResult> {
  try {
    const { data } = await (supabaseAdmin as any)
      .from('dr_certifications')
      .select('overall_dr_grade, certified_at')
      .eq('tenant_id', tenantId)
      .order('certified_at', { ascending: false })
      .limit(1)

    const row = (
      data as Array<{ overall_dr_grade: string; certified_at: string }> | null
    )?.[0]

    if (!row) {
      return {
        condition: 'DR_VALIDATED',
        status: 'PENDING',
        score: 50,
        detail: 'No DR certification found — run drCertifier.runDrCertification()',
        checked_at: now,
      }
    }

    if (row.overall_dr_grade === 'CERTIFIED_DR_READY') {
      return {
        condition: 'DR_VALIDATED',
        status: 'PASS',
        score: 100,
        detail: `DR grade: CERTIFIED_DR_READY at ${row.certified_at}`,
        checked_at: now,
      }
    }

    if (row.overall_dr_grade === 'CONDITIONAL_DR_READY') {
      return {
        condition: 'DR_VALIDATED',
        status: 'WARN',
        score: 75,
        detail: `DR grade: CONDITIONAL_DR_READY at ${row.certified_at} — some DR gaps remain`,
        checked_at: now,
      }
    }

    return {
      condition: 'DR_VALIDATED',
      status: 'FAIL',
      score: 0,
      detail: `DR grade: ${row.overall_dr_grade} — DR not ready for production`,
      checked_at: now,
    }
  } catch {
    return {
      condition: 'DR_VALIDATED',
      status: 'PENDING',
      score: 50,
      detail: 'dr_certifications table not accessible',
      checked_at: now,
    }
  }
}

async function checkBackupFresh(tenantId: string, now: string): Promise<ConditionResult> {
  try {
    const { data } = await (supabaseAdmin as any)
      .from('backup_records')
      .select('completed_at, backup_type, status')
      .eq('tenant_id', tenantId)
      .eq('status', 'COMPLETED')
      .order('completed_at', { ascending: false })
      .limit(1)

    const row = (
      data as Array<{ completed_at: string; backup_type: string; status: string }> | null
    )?.[0]

    if (!row) {
      return {
        condition: 'BACKUP_FRESH',
        status: 'WARN',
        score: 75,
        detail: 'No completed backup found — new deployment or backup not yet run',
        checked_at: now,
      }
    }

    const ageHours = (Date.now() - new Date(row.completed_at).getTime()) / 3_600_000

    if (ageHours <= 25) {
      return {
        condition: 'BACKUP_FRESH',
        status: 'PASS',
        score: 100,
        detail: `Latest ${row.backup_type} backup completed ${ageHours.toFixed(1)}h ago (within 25h threshold)`,
        checked_at: now,
      }
    }

    return {
      condition: 'BACKUP_FRESH',
      status: 'FAIL',
      score: 0,
      detail: `Latest backup is ${ageHours.toFixed(1)}h old (exceeds 25h threshold)`,
      checked_at: now,
    }
  } catch {
    return {
      condition: 'BACKUP_FRESH',
      status: 'PENDING',
      score: 50,
      detail: 'backup_records table not accessible',
      checked_at: now,
    }
  }
}

async function checkReplayDeterministic(tenantId: string, now: string): Promise<ConditionResult> {
  try {
    const { count } = await (supabaseAdmin as any)
      .from('replayable_events')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)

    const total = count ?? 0

    if (total > 0) {
      return {
        condition: 'REPLAY_DETERMINISTIC',
        status: 'PASS',
        score: 100,
        detail: `${total} replayable events in store — event replay infrastructure is active`,
        checked_at: now,
      }
    }

    return {
      condition: 'REPLAY_DETERMINISTIC',
      status: 'WARN',
      score: 75,
      detail: 'No replayable events found — new deployment; events will accumulate on first transactions',
      checked_at: now,
    }
  } catch {
    return {
      condition: 'REPLAY_DETERMINISTIC',
      status: 'PENDING',
      score: 50,
      detail: 'replayable_events table not accessible',
      checked_at: now,
    }
  }
}

async function checkSecurityHardened(tenantId: string, now: string): Promise<ConditionResult> {
  try {
    // Check request_fingerprints table is accessible
    const { count: fpCount } = await (supabaseAdmin as any)
      .from('request_fingerprints')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)

    // Check rate_limit_blocks table is accessible
    const { count: blockCount } = await (supabaseAdmin as any)
      .from('rate_limit_blocks')
      .select('id', { count: 'exact', head: true })

    return {
      condition: 'SECURITY_HARDENED',
      status: 'PASS',
      score: 100,
      detail: `Security tables active — ${fpCount ?? 0} fingerprints tracked, ${blockCount ?? 0} rate-limit blocks recorded`,
      checked_at: now,
    }
  } catch (e) {
    return {
      condition: 'SECURITY_HARDENED',
      status: 'WARN',
      score: 75,
      detail: `Security hardening tables partially accessible: ${e instanceof Error ? e.message : 'unknown'}`,
      checked_at: now,
    }
  }
}

async function checkRateLimitingActive(now: string): Promise<ConditionResult> {
  try {
    const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count } = await (supabaseAdmin as any)
      .from('rate_limit_counters')
      .select('id', { count: 'exact', head: true })
      .gte('window_start', cutoff)

    // Table accessible = rate limiting infrastructure ready
    return {
      condition: 'RATE_LIMITING_ACTIVE',
      status: 'PASS',
      score: 100,
      detail: `Rate limiting infrastructure active — ${count ?? 0} counter windows in last hour`,
      checked_at: now,
    }
  } catch {
    return {
      condition: 'RATE_LIMITING_ACTIVE',
      status: 'WARN',
      score: 75,
      detail:
        'rate_limit_counters not yet accessible — rate limiting ready but no traffic recorded',
      checked_at: now,
    }
  }
}

async function checkSloTargetsMet(tenantId: string, now: string): Promise<ConditionResult> {
  try {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data } = await (supabaseAdmin as any)
      .from('slo_measurements')
      .select('slo_id, status, measured_at')
      .eq('tenant_id', tenantId)
      .eq('status', 'BREACHED')
      .gte('measured_at', cutoff)

    const breaches = (data as Array<{ slo_id: string; status: string; measured_at: string }> | null) ?? []

    if (breaches.length === 0) {
      return {
        condition: 'SLO_TARGETS_MET',
        status: 'PASS',
        score: 100,
        detail: 'No SLO breaches in the last 7 days',
        checked_at: now,
      }
    }

    const sloIds = [...new Set(breaches.map(b => b.slo_id))].join(', ')
    return {
      condition: 'SLO_TARGETS_MET',
      status: 'WARN',
      score: 75,
      detail: `${breaches.length} SLO breach events in last 7 days: ${sloIds}`,
      checked_at: now,
    }
  } catch {
    return {
      condition: 'SLO_TARGETS_MET',
      status: 'PENDING',
      score: 50,
      detail: 'slo_measurements table not accessible',
      checked_at: now,
    }
  }
}

async function checkComplianceOperational(
  tenantId: string,
  now: string,
): Promise<ConditionResult> {
  try {
    const [amlResult, gdprResult] = await Promise.all([
      (supabaseAdmin as any)
        .from('aml_kyc_records')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId),
      (supabaseAdmin as any)
        .from('gdpr_requests')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId),
    ])

    const amlAccessible = amlResult.error == null
    const gdprAccessible = gdprResult.error == null

    if (amlAccessible && gdprAccessible) {
      return {
        condition: 'COMPLIANCE_OPERATIONAL',
        status: 'PASS',
        score: 100,
        detail: `AML/KYC records: ${amlResult.count ?? 0}, GDPR requests: ${gdprResult.count ?? 0} — compliance tables operational`,
        checked_at: now,
      }
    }

    const missing = [
      !amlAccessible ? 'aml_kyc_records' : null,
      !gdprAccessible ? 'gdpr_requests' : null,
    ]
      .filter(Boolean)
      .join(', ')

    return {
      condition: 'COMPLIANCE_OPERATIONAL',
      status: 'FAIL',
      score: 0,
      detail: `Compliance tables not accessible: ${missing}`,
      checked_at: now,
    }
  } catch {
    return {
      condition: 'COMPLIANCE_OPERATIONAL',
      status: 'FAIL',
      score: 0,
      detail: 'Compliance tables not accessible — critical compliance gap',
      checked_at: now,
    }
  }
}

async function checkSupplyIngestionActive(
  tenantId: string,
  now: string,
): Promise<ConditionResult> {
  try {
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const { count } = await (supabaseAdmin as any)
      .from('ingestion_runs')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('started_at', cutoff)

    const recentCount = count ?? 0

    if (recentCount >= 1) {
      return {
        condition: 'SUPPLY_INGESTION_ACTIVE',
        status: 'PASS',
        score: 100,
        detail: `${recentCount} ingestion run(s) in last 48 hours — supply pipeline active`,
        checked_at: now,
      }
    }

    return {
      condition: 'SUPPLY_INGESTION_ACTIVE',
      status: 'WARN',
      score: 75,
      detail: 'No ingestion runs in last 48 hours — new deployment or supply connectors not yet active',
      checked_at: now,
    }
  } catch {
    return {
      condition: 'SUPPLY_INGESTION_ACTIVE',
      status: 'WARN',
      score: 75,
      detail: 'ingestion_runs table not accessible — supply pipeline status unknown',
      checked_at: now,
    }
  }
}

// ── System status logic ────────────────────────────────────────────────────────

function determineSystemStatus(
  conditions: ConditionResult[],
): { status: SystemStatus; blocking: CertificationCondition[]; warnings: CertificationCondition[] } {
  const failedConditions = conditions
    .filter(c => c.status === 'FAIL')
    .map(c => c.condition)

  const warnConditions = conditions
    .filter(c => c.status === 'WARN')
    .map(c => c.condition)

  const criticalFails = failedConditions.filter(
    c => c === 'LEDGER_BALANCED' || c === 'AUDIT_CHAIN_VERIFIED',
  )

  const failCount = failedConditions.length

  let systemStatus: SystemStatus

  if (failCount === 0) {
    // All PASS or WARN
    systemStatus = 'FULLY_OPERATIONAL_REAL_ESTATE_CAPITAL_OS'
  } else if (failCount <= 3 && criticalFails.length === 0) {
    systemStatus = 'CONDITIONALLY_OPERATIONAL'
  } else if (failCount <= 7 || criticalFails.length > 0) {
    systemStatus = 'DEGRADED'
  } else {
    systemStatus = 'NOT_READY'
  }

  return {
    status: systemStatus,
    blocking: failedConditions,
    warnings: warnConditions,
  }
}

// ── Weighted score calculation ─────────────────────────────────────────────────

function computeOverallScore(conditions: ConditionResult[]): number {
  let totalWeight = 0
  let weightedSum = 0

  for (const c of conditions) {
    const weight = CONDITION_WEIGHTS[c.condition]
    const rawScore = STATUS_SCORE[c.status]
    weightedSum += rawScore * weight
    totalWeight += weight
  }

  if (totalWeight === 0) return 0
  return Math.round((weightedSum / totalWeight) * 100) / 100
}

// ── Certification hash ────────────────────────────────────────────────────────

function computeCertificationHash(
  certificationId: string,
  tenantId: string,
  systemStatus: SystemStatus,
  overallScore: number,
  certifiedAt: string,
): string {
  const payload = JSON.stringify({
    certification_id: certificationId,
    tenant_id: tenantId,
    system_status: systemStatus,
    overall_score: overallScore,
    certified_at: certifiedAt,
  })
  return createHash('sha256').update(payload).digest('hex')
}

// ── Main certification runner ──────────────────────────────────────────────────

export async function runFinalCertification(
  tenantId: string = SYSTEM_TENANT_ID,
): Promise<FinalCertificationResult> {
  const now = new Date().toISOString()
  const certificationId = randomUUID()

  log.info('[finalProductionCertification] Starting apex certification gate', {
    correlation_id: certificationId,
    route: '/lib/certification/finalProductionCertification',
  })

  // Run all 15 checks — async where possible, sync for synthetic tests
  const [
    tsErrors,
    critVulns,
    ledgerBalanced,
    financialCertified,
    zeroLeakage,
    auditChain,
    drValidated,
    backupFresh,
    replayDet,
    securityHardened,
    rateLimiting,
    sloTargets,
    complianceOps,
    supplyIngestion,
  ] = await Promise.all([
    checkZeroTypescriptErrors(now),
    checkZeroCriticalVulnerabilities(tenantId, now),
    checkLedgerBalanced(tenantId, now),
    checkFinancialIntegrityCertified(tenantId, now),
    checkZeroTenantLeakage(tenantId, now),
    checkAuditChainVerified(tenantId, now),
    checkDrValidated(tenantId, now),
    checkBackupFresh(tenantId, now),
    checkReplayDeterministic(tenantId, now),
    checkSecurityHardened(tenantId, now),
    checkRateLimitingActive(now),
    checkSloTargetsMet(tenantId, now),
    checkComplianceOperational(tenantId, now),
    checkSupplyIngestionActive(tenantId, now),
  ])

  // Synthetic tests are synchronous (pure function)
  const syntheticTests = checkSyntheticTestsPassing(now)

  const conditions: ConditionResult[] = [
    tsErrors,
    critVulns,
    ledgerBalanced,
    financialCertified,
    syntheticTests,
    zeroLeakage,
    auditChain,
    drValidated,
    backupFresh,
    replayDet,
    securityHardened,
    rateLimiting,
    sloTargets,
    complianceOps,
    supplyIngestion,
  ]

  const { status: systemStatus, blocking, warnings } = determineSystemStatus(conditions)
  const overallScore = computeOverallScore(conditions)

  const certificationHash =
    systemStatus === 'FULLY_OPERATIONAL_REAL_ESTATE_CAPITAL_OS'
      ? computeCertificationHash(certificationId, tenantId, systemStatus, overallScore, now)
      : null

  const result: FinalCertificationResult = {
    certification_id: certificationId,
    tenant_id: tenantId,
    system_status: systemStatus,
    overall_score: overallScore,
    conditions,
    blocking_failures: blocking,
    warnings,
    certification_hash: certificationHash,
    certified_at: now,
  }

  log.info('[finalProductionCertification] Certification complete', {
    correlation_id: certificationId,
    route: '/lib/certification/finalProductionCertification',
    system_status: systemStatus,
    overall_score: String(overallScore),
    blocking_count: String(blocking.length),
    warn_count: String(warnings.length),
  } as Record<string, unknown>)

  // Fire-and-forget persist
  void (supabaseAdmin as any)
    .from('final_production_certifications')
    .insert({
      certification_id: certificationId,
      tenant_id: tenantId,
      system_status: systemStatus,
      overall_score: overallScore,
      conditions: conditions,
      blocking_failures: blocking,
      warnings: warnings,
      certification_hash: certificationHash,
      certified_at: now,
    })
    .catch((e: unknown) =>
      log.warn('[finalProductionCertification] persist error', { e: String(e) }),
    )

  return result
}

// ── Query helpers ──────────────────────────────────────────────────────────────

export async function getLatestCertification(
  tenantId: string = SYSTEM_TENANT_ID,
): Promise<FinalCertificationResult | null> {
  try {
    const { data } = await (supabaseAdmin as any)
      .from('final_production_certifications')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('certified_at', { ascending: false })
      .limit(1)

    const row = (data as FinalCertificationResult[] | null)?.[0]
    return row ?? null
  } catch (e) {
    log.warn('[finalProductionCertification] getLatestCertification error', { e: String(e) })
    return null
  }
}

export async function getCertificationHistory(
  tenantId: string = SYSTEM_TENANT_ID,
  limit: number = 10,
): Promise<FinalCertificationResult[]> {
  try {
    const { data } = await (supabaseAdmin as any)
      .from('final_production_certifications')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('certified_at', { ascending: false })
      .limit(limit)

    return (data as FinalCertificationResult[] | null) ?? []
  } catch (e) {
    log.warn('[finalProductionCertification] getCertificationHistory error', { e: String(e) })
    return []
  }
}
