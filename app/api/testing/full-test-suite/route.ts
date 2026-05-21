// Agency Group — Full Test Suite API
// app/api/testing/full-test-suite/route.ts
//
// Runs all 4 test suites + returns consolidated result.
// Auth: Authorization: Bearer <CRON_SECRET>  OR  x-service-auth: <INTERNAL_API_SECRET>
//
// TypeScript strict — 0 errors

import { NextRequest, NextResponse } from 'next/server'
import { randomUUID }                from 'crypto'
import { supabaseAdmin }             from '@/lib/supabase'
import log                           from '@/lib/logger'
import { CANONICAL_TENANT_UUID }     from '@/lib/constants/pipeline'
import { getRequestCorrelationId }   from '@/lib/observability/correlation'

// Dynamic imports to avoid circular deps
import type { E2EFlowResult }          from '@/lib/testing/e2eFlowTester'
import type { MarketSimulationResult } from '@/lib/testing/marketSimulationTester'
import type { FailureTestResult }      from '@/lib/testing/failureInjectionTester'
import type { FinancialStressResult }  from '@/lib/testing/financialStressTester'

export const runtime     = 'nodejs'
export const maxDuration = 300

// ─── Auth ─────────────────────────────────────────────────────────────────────

function requireServiceAuth(req: NextRequest): boolean {
  const cronSecret     = process.env.CRON_SECRET
  const internalSecret = process.env.INTERNAL_API_SECRET
  const bearer         = req.headers.get('authorization')?.replace('Bearer ', '')
  const serviceHeader  = req.headers.get('x-service-auth')

  if (cronSecret     && bearer        && bearer        === cronSecret)     return true
  if (internalSecret && serviceHeader && serviceHeader === internalSecret) return true
  return false
}

// ─── Tenant ───────────────────────────────────────────────────────────────────

function resolveTenantId(req: NextRequest): string {
  const fromQuery = new URL(req.url).searchParams.get('tenant_id')
  return (
    fromQuery ??
    process.env.DEFAULT_TENANT_ID ??
    process.env.SYSTEM_ORG_ID ??
    CANONICAL_TENANT_UUID
  )
}

// ─── Scoring helpers ──────────────────────────────────────────────────────────

function scoreE2E(result: E2EFlowResult | null): number {
  if (!result) return 0
  return result.pipeline_completion_pct
}

function scoreMarketSim(result: MarketSimulationResult | null): number {
  if (!result) return 0
  if (result.simulation_grade === 'STABLE')   return 100
  if (result.simulation_grade === 'VOLATILE') return 60
  return 20
}

function scoreFailureInjection(result: FailureTestResult | null): number {
  if (!result) return 0
  return result.overall_resilience_score
}

function scoreFinancialStress(result: FinancialStressResult | null): number {
  if (!result) return 0
  if (result.stress_grade === 'ROBUST')   return 100
  if (result.stress_grade === 'ADEQUATE') return 65
  return 25
}

// ─── POST /api/testing/full-test-suite ───────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const corrId   = getRequestCorrelationId(req)
  const t0       = Date.now()
  const tenantId = resolveTenantId(req)

  if (!requireServiceAuth(req)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: { 'x-correlation-id': corrId } },
    )
  }

  const suite_run_id = randomUUID()
  const run_at       = new Date().toISOString()

  log.info('[full-test-suite] starting full test suite run', {
    suite_run_id,
    tenant_id: tenantId,
    correlation_id: corrId,
  })

  // Dynamic imports to avoid circular deps at module-load time
  const [
    { runE2EFlowTest },
    { runMarketSimulation },
    { runFailureInjectionTests },
    { runFinancialStressTest },
  ] = await Promise.all([
    import('@/lib/testing/e2eFlowTester'),
    import('@/lib/testing/marketSimulationTester'),
    import('@/lib/testing/failureInjectionTester'),
    import('@/lib/testing/financialStressTester'),
  ])

  // Run all 4 suites concurrently — use allSettled so one failure doesn't block others
  const [r1, r2, r3, r4] = await Promise.allSettled([
    runE2EFlowTest(tenantId),
    runMarketSimulation(tenantId),
    runFailureInjectionTests(tenantId),
    runFinancialStressTest(tenantId),
  ])

  const e2e_flow: E2EFlowResult | null =
    r1.status === 'fulfilled' ? r1.value : null
  const market_simulation: MarketSimulationResult | null =
    r2.status === 'fulfilled' ? r2.value : null
  const failure_injection: FailureTestResult | null =
    r3.status === 'fulfilled' ? r3.value : null
  const financial_stress: FinancialStressResult | null =
    r4.status === 'fulfilled' ? r4.value : null

  // Log any failures
  if (r1.status === 'rejected') log.warn('[full-test-suite] e2eFlowTest failed',        { reason: r1.reason instanceof Error ? r1.reason.message : String(r1.reason) })
  if (r2.status === 'rejected') log.warn('[full-test-suite] marketSimulation failed',    { reason: r2.reason instanceof Error ? r2.reason.message : String(r2.reason) })
  if (r3.status === 'rejected') log.warn('[full-test-suite] failureInjection failed',   { reason: r3.reason instanceof Error ? r3.reason.message : String(r3.reason) })
  if (r4.status === 'rejected') log.warn('[full-test-suite] financialStress failed',    { reason: r4.reason instanceof Error ? r4.reason.message : String(r4.reason) })

  // Weighted overall score: e2e 30% + sim 20% + failure 30% + stress 20%
  const overall_score = Math.round(
    scoreE2E(e2e_flow)            * 0.30 +
    scoreMarketSim(market_simulation)    * 0.20 +
    scoreFailureInjection(failure_injection) * 0.30 +
    scoreFinancialStress(financial_stress)   * 0.20,
  )

  const all_passed =
    e2e_flow?.flow_health === 'healthy' &&
    market_simulation?.simulation_grade === 'STABLE' &&
    (failure_injection?.overall_resilience_score ?? 0) >= 80 &&
    financial_stress?.stress_grade === 'ROBUST'

  const duration_ms = Date.now() - t0

  const payload = {
    suite_run_id,
    tenant_id: tenantId,
    e2e_flow,
    market_simulation,
    failure_injection,
    financial_stress,
    overall_score,
    all_passed,
    duration_ms,
    run_at,
  }

  log.info('[full-test-suite] suite complete', {
    suite_run_id,
    tenant_id: tenantId,
    overall_score,
    all_passed,
    duration_ms,
  })

  // Persist to test_suite_runs (fire-and-forget)
  void (supabaseAdmin as any)
    .from('test_suite_runs')
    .insert({
      id:             suite_run_id,
      tenant_id:      tenantId,
      overall_score,
      all_passed,
      e2e_result:     e2e_flow     ? JSON.stringify(e2e_flow)             : null,
      market_result:  market_simulation ? JSON.stringify(market_simulation) : null,
      failure_result: failure_injection ? JSON.stringify(failure_injection) : null,
      stress_result:  financial_stress  ? JSON.stringify(financial_stress)  : null,
      duration_ms,
      run_at,
    })
    .then(({ error }: { error: { message: string } | null }) => {
      if (error) log.warn('[full-test-suite] persist failed', { error: error.message, suite_run_id })
    })
    .catch((e: unknown) => log.warn('[full-test-suite] persist threw', {
      error: e instanceof Error ? e.message : String(e),
      suite_run_id,
    }))

  return NextResponse.json(payload, {
    status: 200,
    headers: { 'x-correlation-id': corrId },
  })
}

// ─── GET — latest suite run ───────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const corrId   = getRequestCorrelationId(req)
  const tenantId = resolveTenantId(req)

  if (!requireServiceAuth(req)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: { 'x-correlation-id': corrId } },
    )
  }

  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('test_suite_runs')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('run_at', { ascending: false })
      .limit(1)
      .single() as { data: Record<string, unknown> | null; error: { message: string } | null }

    if (error || !data) {
      return NextResponse.json(
        { error: 'No test suite runs found', tenant_id: tenantId },
        { status: 404, headers: { 'x-correlation-id': corrId } },
      )
    }

    return NextResponse.json(data, {
      status: 200,
      headers: { 'x-correlation-id': corrId },
    })
  } catch (err) {
    log.warn('[full-test-suite] GET error', {
      tenant_id: tenantId,
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json(
      { error: 'Internal error' },
      { status: 500, headers: { 'x-correlation-id': corrId } },
    )
  }
}
