// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — Validation Resilience API
// app/api/validation/resilience/route.ts
//
// GET  /api/validation/resilience                                              → latest resilience report (portal auth)
// GET  /api/validation/resilience?scenario=db_failure_simulation              → single scenario (service auth)
// POST /api/validation/resilience                                              → full resilience validation (service auth)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { requirePortalAuth }         from '@/lib/requirePortalAuth'
import { requireServiceAuth }        from '@/lib/auth/serviceAuth'
import {
  runResilienceValidation,
  getLatestResilienceReport,
  runSingleResilienceScenario,
  type ResilienceScenario,
}                                    from '@/lib/validation/distributedResilienceTester'
import { CANONICAL_TENANT_UUID }     from '@/lib/constants/pipeline'
import { getRequestCorrelationId }   from '@/lib/observability/correlation'
import log                           from '@/lib/logger'

export const runtime     = 'nodejs'
export const maxDuration = 60

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resolveTenantId(): string {
  return (
    process.env.DEFAULT_TENANT_ID ??
    process.env.SYSTEM_ORG_ID     ??
    CANONICAL_TENANT_UUID
  )
}

const VALID_SCENARIOS = new Set<ResilienceScenario>([
  'db_failure_simulation',
  'kafka_outage_simulation',
  'region_failure_simulation',
  'network_partition_simulation',
  'high_latency_simulation',
])

function isValidScenario(value: string): value is ResilienceScenario {
  return VALID_SCENARIOS.has(value as ResilienceScenario)
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const corrId   = getRequestCorrelationId(req)
  const scenario = new URL(req.url).searchParams.get('scenario')

  if (scenario) {
    // Service auth required for single-scenario execution
    const svcAuth = await requireServiceAuth(req)
    if (!svcAuth.ok) return svcAuth.response

    if (!isValidScenario(scenario)) {
      return NextResponse.json(
        {
          error:        'Invalid scenario',
          valid_values: [...VALID_SCENARIOS],
        },
        { status: 400, headers: { 'x-correlation-id': corrId } },
      )
    }

    const tenantId = resolveTenantId()

    try {
      const result = await runSingleResilienceScenario(tenantId, scenario)
      return NextResponse.json(
        { result, tenant_id: tenantId },
        { headers: { 'x-correlation-id': corrId } },
      )
    } catch (err) {
      log.error('[GET /api/validation/resilience] single scenario error', err instanceof Error ? err : undefined, {
        correlation_id: corrId,
        route: '/api/validation/resilience',
        scenario,
      })
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500, headers: { 'x-correlation-id': corrId } },
      )
    }
  }

  // Default GET: latest report — portal auth sufficient
  const portalAuth = await requirePortalAuth(req)
  if (!portalAuth.ok) return portalAuth.response

  const tenantId = resolveTenantId()

  try {
    const report = await getLatestResilienceReport(tenantId)

    if (!report) {
      return NextResponse.json(
        { error: 'No resilience reports found. POST to run first validation.' },
        { status: 404, headers: { 'x-correlation-id': corrId } },
      )
    }

    return NextResponse.json(
      { report },
      { headers: { 'x-correlation-id': corrId } },
    )
  } catch (err) {
    log.error('[GET /api/validation/resilience] error', err instanceof Error ? err : undefined, {
      correlation_id: corrId,
      route: '/api/validation/resilience',
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: { 'x-correlation-id': corrId } },
    )
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const corrId = getRequestCorrelationId(req)

  const svcAuth = await requireServiceAuth(req)
  if (!svcAuth.ok) return svcAuth.response

  const tenantId = resolveTenantId()

  try {
    const report = await runResilienceValidation(tenantId)

    log.info('[POST /api/validation/resilience] validation complete', {
      correlation_id:            corrId,
      tenant_id:                 tenantId,
      resilience_score:          report.resilience_score,
      failover_validation_score: report.failover_validation_score,
      system_readiness:          report.system_readiness,
      rto_compliant:             report.rto_compliant,
      rpo_compliant:             report.rpo_compliant,
    })

    return NextResponse.json(
      { report },
      {
        status: 201,
        headers: { 'x-correlation-id': corrId },
      },
    )
  } catch (err) {
    log.error('[POST /api/validation/resilience] error', err instanceof Error ? err : undefined, {
      correlation_id: corrId,
      route: '/api/validation/resilience',
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: { 'x-correlation-id': corrId } },
    )
  }
}
