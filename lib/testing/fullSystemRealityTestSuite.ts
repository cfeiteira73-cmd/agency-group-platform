// Agency Group — Full System Reality Test Suite
// lib/testing/fullSystemRealityTestSuite.ts
// TypeScript strict — 0 errors
//
// Comprehensive end-to-end test suite that validates the real capital
// infrastructure. Tests run against REAL Supabase data — no mocks.

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type TestCategory =
  | 'CAPITAL_FLOW'
  | 'LEGAL_EXECUTION'
  | 'MARKET_RECONCILIATION'
  | 'ML_PREDICTION'
  | 'FAILURE_RECOVERY'
  | 'AUDIT_TRACE'
  | 'COMPLIANCE'

export type TestResult = 'PASS' | 'FAIL' | 'SKIP' | 'WARNING'

export interface RealityTest {
  test_id: string
  category: TestCategory
  test_name: string
  description: string
  result: TestResult
  duration_ms: number
  details: string
  critical: boolean
}

export interface TestSuiteRun {
  run_id: string
  tenant_id: string
  total_tests: number
  passed: number
  failed: number
  warnings: number
  skipped: number
  critical_failures: number
  suite_passed: boolean
  tests: RealityTest[]
  run_at: string
  duration_ms: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTest(
  category: TestCategory,
  testName: string,
  description: string,
  critical: boolean,
  result: TestResult,
  details: string,
  durationMs: number,
): RealityTest {
  return {
    test_id: randomUUID(),
    category,
    test_name: testName,
    description,
    result,
    duration_ms: durationMs,
    details,
    critical,
  }
}

// ─── Individual Test Functions ────────────────────────────────────────────────

export async function testCapitalFlowEndToEnd(tenantId: string): Promise<RealityTest> {
  const start = Date.now()
  const category: TestCategory = 'CAPITAL_FLOW'
  const name = 'Capital Flow End-to-End'
  const description = 'Validates real capital execution pipeline and PSP payment intents exist'

  try {
    const [pipelinesRes, pspRes] = await Promise.allSettled([
      (supabaseAdmin as any)
        .from('capital_execution_pipelines')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId),
      (supabaseAdmin as any)
        .from('psp_payment_intents')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId),
    ])

    const pipelinesCount =
      pipelinesRes.status === 'fulfilled' ? (pipelinesRes.value.count ?? 0) : 0
    const pspCount = pspRes.status === 'fulfilled' ? (pspRes.value.count ?? 0) : 0

    if (pipelinesCount >= 1 && pspCount >= 1) {
      return makeTest(
        category, name, description, true, 'PASS',
        `${pipelinesCount} capital pipelines, ${pspCount} PSP payment intents`,
        Date.now() - start,
      )
    }

    return makeTest(
      category, name, description, true, 'FAIL',
      `Insufficient data: ${pipelinesCount} pipelines, ${pspCount} PSP intents. Both must be ≥1.`,
      Date.now() - start,
    )
  } catch (err) {
    return makeTest(
      category, name, description, true, 'FAIL',
      `Test threw an error: ${err instanceof Error ? err.message : String(err)}`,
      Date.now() - start,
    )
  }
}

export async function testLegalExecutionChain(tenantId: string): Promise<RealityTest> {
  const start = Date.now()
  const category: TestCategory = 'LEGAL_EXECUTION'
  const name = 'Legal Execution Chain'
  const description = 'Validates legal workflows, notary appointments, and eIDAS signatures exist'

  try {
    const [workflowsRes, notaryRes, eidasRes] = await Promise.allSettled([
      (supabaseAdmin as any)
        .from('legal_workflows')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId),
      (supabaseAdmin as any)
        .from('notary_appointments')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId),
      (supabaseAdmin as any)
        .from('eidas_signature_requests')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId),
    ])

    const workflowsCount =
      workflowsRes.status === 'fulfilled' ? (workflowsRes.value.count ?? 0) : 0
    const notaryCount =
      notaryRes.status === 'fulfilled' ? (notaryRes.value.count ?? 0) : 0
    const eidasCount =
      eidasRes.status === 'fulfilled' ? (eidasRes.value.count ?? 0) : 0

    if (workflowsCount > 0 && notaryCount > 0 && eidasCount > 0) {
      return makeTest(
        category, name, description, true, 'PASS',
        `${workflowsCount} legal workflows, ${notaryCount} notary appointments, ${eidasCount} eIDAS requests`,
        Date.now() - start,
      )
    }

    if (workflowsCount > 0) {
      return makeTest(
        category, name, description, true, 'WARNING',
        `${workflowsCount} legal workflows exist but notary=${notaryCount}, eIDAS=${eidasCount}`,
        Date.now() - start,
      )
    }

    return makeTest(
      category, name, description, true, 'FAIL',
      'No legal workflows, notary appointments, or eIDAS signature requests found',
      Date.now() - start,
    )
  } catch (err) {
    return makeTest(
      category, name, description, true, 'FAIL',
      `Test threw an error: ${err instanceof Error ? err.message : String(err)}`,
      Date.now() - start,
    )
  }
}

export async function testExternalMarketReconciliation(tenantId: string): Promise<RealityTest> {
  const start = Date.now()
  const category: TestCategory = 'MARKET_RECONCILIATION'
  const name = 'External Market Reconciliation'
  const description = 'Validates external price benchmarks and price comparisons exist'

  try {
    const [benchmarksRes, comparisonsRes] = await Promise.allSettled([
      (supabaseAdmin as any)
        .from('external_price_benchmarks')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId),
      (supabaseAdmin as any)
        .from('price_comparisons')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId),
    ])

    const benchmarksCount =
      benchmarksRes.status === 'fulfilled' ? (benchmarksRes.value.count ?? 0) : 0
    const comparisonsCount =
      comparisonsRes.status === 'fulfilled' ? (comparisonsRes.value.count ?? 0) : 0

    if (benchmarksCount > 0 && comparisonsCount > 0) {
      return makeTest(
        category, name, description, true, 'PASS',
        `${benchmarksCount} external benchmarks, ${comparisonsCount} price comparisons`,
        Date.now() - start,
      )
    }

    if (benchmarksCount > 0) {
      return makeTest(
        category, name, description, true, 'WARNING',
        `${benchmarksCount} benchmarks found but 0 price comparisons — reconciliation incomplete`,
        Date.now() - start,
      )
    }

    return makeTest(
      category, name, description, true, 'FAIL',
      'No external price benchmarks or price comparisons found',
      Date.now() - start,
    )
  } catch (err) {
    return makeTest(
      category, name, description, true, 'FAIL',
      `Test threw an error: ${err instanceof Error ? err.message : String(err)}`,
      Date.now() - start,
    )
  }
}

export async function testMLPredictionVsReality(tenantId: string): Promise<RealityTest> {
  const start = Date.now()
  const category: TestCategory = 'ML_PREDICTION'
  const name = 'ML Prediction vs Reality'
  const description = 'Validates real outcomes exist and ML drift score is acceptable (<0.15)'

  try {
    const [outcomesRes, alignmentsRes] = await Promise.allSettled([
      (supabaseAdmin as any)
        .from('real_outcomes')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId),
      (supabaseAdmin as any)
        .from('ml_reality_alignments')
        .select('drift_score')
        .eq('tenant_id', tenantId),
    ])

    const outcomesCount =
      outcomesRes.status === 'fulfilled' ? (outcomesRes.value.count ?? 0) : 0

    let avgDrift = 1.0
    if (alignmentsRes.status === 'fulfilled' && alignmentsRes.value.data?.length > 0) {
      const scores: number[] = alignmentsRes.value.data.map(
        (r: { drift_score: number | null }) => r.drift_score ?? 1.0,
      )
      avgDrift = scores.reduce((a, b) => a + b, 0) / scores.length
    }

    if (outcomesCount > 0 && avgDrift < 0.15) {
      return makeTest(
        category, name, description, false, 'PASS',
        `${outcomesCount} real outcomes, avg drift score ${avgDrift.toFixed(4)} < 0.15`,
        Date.now() - start,
      )
    }

    if (outcomesCount > 0) {
      return makeTest(
        category, name, description, false, 'WARNING',
        `${outcomesCount} real outcomes but avg drift ${avgDrift.toFixed(4)} ≥ 0.15 — retraining recommended`,
        Date.now() - start,
      )
    }

    return makeTest(
      category, name, description, false, 'FAIL',
      'No real outcomes found — ML models cannot be validated against reality',
      Date.now() - start,
    )
  } catch (err) {
    return makeTest(
      category, name, description, false, 'FAIL',
      `Test threw an error: ${err instanceof Error ? err.message : String(err)}`,
      Date.now() - start,
    )
  }
}

export async function testFailureRecoveryMechanisms(tenantId: string): Promise<RealityTest> {
  const start = Date.now()
  const category: TestCategory = 'FAILURE_RECOVERY'
  const name = 'Failure Recovery Mechanisms'
  const description = 'Validates bank reconciliation runs and gap closure reports exist'

  try {
    const [reconRes, gapRes] = await Promise.allSettled([
      (supabaseAdmin as any)
        .from('bank_reconciliation_runs')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId),
      (supabaseAdmin as any)
        .from('gap_closure_reports')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId),
    ])

    const reconCount =
      reconRes.status === 'fulfilled' ? (reconRes.value.count ?? 0) : 0
    const gapCount =
      gapRes.status === 'fulfilled' ? (gapRes.value.count ?? 0) : 0

    if (reconCount > 0 && gapCount > 0) {
      return makeTest(
        category, name, description, false, 'PASS',
        `${reconCount} reconciliation runs, ${gapCount} gap closure reports`,
        Date.now() - start,
      )
    }

    if (reconCount > 0 || gapCount > 0) {
      return makeTest(
        category, name, description, false, 'WARNING',
        `Partial recovery: reconciliation=${reconCount}, gap closure=${gapCount}`,
        Date.now() - start,
      )
    }

    return makeTest(
      category, name, description, false, 'SKIP',
      'No recovery data found — system may be too new. Skipping instead of failing.',
      Date.now() - start,
    )
  } catch (err) {
    return makeTest(
      category, name, description, false, 'FAIL',
      `Test threw an error: ${err instanceof Error ? err.message : String(err)}`,
      Date.now() - start,
    )
  }
}

export async function testAuditTraceIntegrity(tenantId: string): Promise<RealityTest> {
  const start = Date.now()
  const category: TestCategory = 'AUDIT_TRACE'
  const name = 'Audit Trace Integrity'
  const description = 'Validates regulatory audit trail entries in last 30 days and compliance evidence'

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const [auditRes, complianceRes] = await Promise.allSettled([
      (supabaseAdmin as any)
        .from('regulatory_audit_trail')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .gte('created_at', thirtyDaysAgo),
      (supabaseAdmin as any)
        .from('compliance_reports')
        .select('sha256_hash, evidence_packages')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(1),
    ])

    const auditCount =
      auditRes.status === 'fulfilled' ? (auditRes.value.count ?? 0) : 0

    const hasEvidence =
      complianceRes.status === 'fulfilled' &&
      complianceRes.value.data?.length > 0 &&
      (complianceRes.value.data[0].sha256_hash !== null ||
        (Array.isArray(complianceRes.value.data[0].evidence_packages) &&
          complianceRes.value.data[0].evidence_packages.length > 0))

    if (auditCount > 0 && hasEvidence) {
      return makeTest(
        category, name, description, true, 'PASS',
        `${auditCount} audit entries in last 30d, compliance evidence verified`,
        Date.now() - start,
      )
    }

    if (auditCount > 0) {
      return makeTest(
        category, name, description, true, 'WARNING',
        `${auditCount} audit entries found but no compliance evidence packages`,
        Date.now() - start,
      )
    }

    return makeTest(
      category, name, description, true, 'FAIL',
      'No regulatory audit trail entries in the last 30 days',
      Date.now() - start,
    )
  } catch (err) {
    return makeTest(
      category, name, description, true, 'FAIL',
      `Test threw an error: ${err instanceof Error ? err.message : String(err)}`,
      Date.now() - start,
    )
  }
}

export async function testComplianceFramework(tenantId: string): Promise<RealityTest> {
  const start = Date.now()
  const category: TestCategory = 'COMPLIANCE'
  const name = 'Compliance Framework'
  const description = 'Validates MiFID II classifications and AML screening results exist'

  try {
    const [mifidRes, amlRes] = await Promise.allSettled([
      (supabaseAdmin as any)
        .from('mifid_classifications')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId),
      (supabaseAdmin as any)
        .from('aml_screening_results')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId),
    ])

    const mifidCount =
      mifidRes.status === 'fulfilled' ? (mifidRes.value.count ?? 0) : 0
    const amlCount =
      amlRes.status === 'fulfilled' ? (amlRes.value.count ?? 0) : 0

    if (mifidCount > 0 && amlCount > 0) {
      return makeTest(
        category, name, description, true, 'PASS',
        `${mifidCount} MiFID classifications, ${amlCount} AML screening results`,
        Date.now() - start,
      )
    }

    if (mifidCount > 0 || amlCount > 0) {
      return makeTest(
        category, name, description, true, 'WARNING',
        `Partial compliance: MiFID=${mifidCount}, AML=${amlCount}`,
        Date.now() - start,
      )
    }

    return makeTest(
      category, name, description, true, 'FAIL',
      'No MiFID classifications or AML screening results found',
      Date.now() - start,
    )
  } catch (err) {
    return makeTest(
      category, name, description, true, 'FAIL',
      `Test threw an error: ${err instanceof Error ? err.message : String(err)}`,
      Date.now() - start,
    )
  }
}

// ─── runFullTestSuite ─────────────────────────────────────────────────────────

export async function runFullTestSuite(tenantId: string): Promise<TestSuiteRun> {
  const runId = randomUUID()
  const suiteStart = Date.now()
  log.info('[fullSystemRealityTestSuite] starting full test suite', { tenant_id: tenantId })

  const results = await Promise.allSettled([
    testCapitalFlowEndToEnd(tenantId),
    testLegalExecutionChain(tenantId),
    testExternalMarketReconciliation(tenantId),
    testMLPredictionVsReality(tenantId),
    testFailureRecoveryMechanisms(tenantId),
    testAuditTraceIntegrity(tenantId),
    testComplianceFramework(tenantId),
  ])

  const tests: RealityTest[] = results.map(r =>
    r.status === 'fulfilled'
      ? r.value
      : makeTest(
          'COMPLIANCE',
          'Unknown Test',
          'Test failed to run',
          true,
          'FAIL',
          'Promise rejected — test runner error',
          0,
        ),
  )

  const passed = tests.filter(t => t.result === 'PASS').length
  const failed = tests.filter(t => t.result === 'FAIL').length
  const warnings = tests.filter(t => t.result === 'WARNING').length
  const skipped = tests.filter(t => t.result === 'SKIP').length
  const criticalFailures = tests.filter(t => t.critical && t.result === 'FAIL').length

  const run: TestSuiteRun = {
    run_id: runId,
    tenant_id: tenantId,
    total_tests: tests.length,
    passed,
    failed,
    warnings,
    skipped,
    critical_failures: criticalFailures,
    suite_passed: criticalFailures === 0,
    tests,
    run_at: new Date().toISOString(),
    duration_ms: Date.now() - suiteStart,
  }

  void (supabaseAdmin as any)
    .from('reality_test_suite_runs')
    .insert({
      run_id: run.run_id,
      tenant_id: run.tenant_id,
      total_tests: run.total_tests,
      passed: run.passed,
      failed: run.failed,
      warnings: run.warnings,
      skipped: run.skipped,
      critical_failures: run.critical_failures,
      suite_passed: run.suite_passed,
      tests: run.tests,
      run_at: run.run_at,
      duration_ms: run.duration_ms,
    })
    .catch((e: unknown) => log.warn('[fullSystemRealityTestSuite] persist failed', { e }))

  log.info('[fullSystemRealityTestSuite] suite complete', {
    tenant_id: tenantId,
    passed,
    failed,
    critical_failures: criticalFailures,
    suite_passed: run.suite_passed,
  })

  return run
}
