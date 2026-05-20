// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — Economics Simulation Report API Route
// app/api/simulation/report/route.ts
//
// GET /api/simulation/report?tenant_id=xxx
//
// Runs all 4 economics collapse scenarios in parallel and returns a
// combined stability report with score + classification.
//
// Auth      : Bearer token (ECONOMICS_API_SECRET env var)
// Safety    : tenant_id must be a synthetic sim_* ID
// Fail-open : individual scenario failures are reported; report still completes
// TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { safeCompare } from '@/lib/safeCompare'
import {
  simulateCostExplosion,
  simulateMarginCollapse,
  simulateRevenueLeak,
  simulateBudgetGovernorSaturation,
  computeEconomicStabilityScore,
} from '@/lib/simulation/economicsCollapse'
import {
  type SimulationResult,
} from '@/lib/simulation/loadSimulator'

export const dynamic = 'force-dynamic'

// ─── Auth ─────────────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.ECONOMICS_API_SECRET
  if (!secret) return false

  const auth = req.headers.get('authorization') ?? ''
  const [scheme, token] = auth.split(' ')
  return scheme === 'Bearer' && !!token && safeCompare(token, secret)
}

// ─── GET handler ──────────────────────────────────────────────────────────────

interface ReportResponse {
  results:       SimulationResult[]
  score:         number
  classification: 'STRIPE_LEVEL' | 'ENTERPRISE_READY' | 'SCALABLE_FRAGILE' | 'NOT_PRODUCTION_SAFE'
  details:       string[]
  generated_at:  string
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const rawTenantId = searchParams.get('tenant_id')

  // Default to synthetic tenant — enforce sim_ prefix for safety
  const tenantId = (typeof rawTenantId === 'string' && rawTenantId.startsWith('sim_'))
    ? rawTenantId
    : 'sim_econ_001'

  // Run all 4 economics scenarios in parallel (fail-open per scenario)
  const [explosionResult, marginResult, leakResult, saturationResult] = await Promise.allSettled([
    simulateCostExplosion(tenantId, 20),
    simulateMarginCollapse(tenantId),
    simulateRevenueLeak(tenantId),
    simulateBudgetGovernorSaturation(tenantId),
  ])

  // Build results array — use a FAIL placeholder for any scenario that threw
  const results: SimulationResult[] = [
    explosionResult.status  === 'fulfilled' ? explosionResult.value   : makeFailed('explosion',  tenantId, explosionResult.reason),
    marginResult.status     === 'fulfilled' ? marginResult.value      : makeFailed('margin',     tenantId, marginResult.reason),
    leakResult.status       === 'fulfilled' ? leakResult.value        : makeFailed('leak',       tenantId, leakResult.reason),
    saturationResult.status === 'fulfilled' ? saturationResult.value  : makeFailed('saturation', tenantId, saturationResult.reason),
  ]

  const stability = computeEconomicStabilityScore(results)

  const response: ReportResponse = {
    results,
    score:          stability.score,
    classification: stability.classification,
    details:        stability.details,
    generated_at:   new Date().toISOString(),
  }

  return NextResponse.json(response, {
    status: 200,
    headers: { 'Cache-Control': 'no-store' },
  })
}

// ─── Fallback result for failed scenarios ─────────────────────────────────────

function makeFailed(
  scenario: string,
  tenantId: string,
  reason: unknown,
): SimulationResult {
  const now = new Date().toISOString()
  const message = reason instanceof Error ? reason.message : String(reason)
  return {
    simulation_id:    `sim_econ_run_${scenario}_failed_${Date.now()}`,
    simulation_type:  'economics_collapse',
    scenario,
    tenant_count:     1,
    duration_ms:      0,
    started_at:       now,
    completed_at:     now,
    metrics: {
      p50_latency_ms:  0,
      p95_latency_ms:  0,
      p99_latency_ms:  0,
      error_rate:      1,
      success_count:   0,
      failure_count:   1,
      throughput_rps:  0,
    },
    per_tenant_sample: [
      {
        tenant_id:        tenantId,
        latency_ms:       0,
        status:           'failed',
        load_mode:        'ECONOMICS_SIMULATION',
        cost_per_request: 0,
        error:            message,
      },
    ],
    verdict:        'FAIL',
    verdict_reason: `Scenario threw during execution: ${message}`,
    global_ready:   false,
  }
}
