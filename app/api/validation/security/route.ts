// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — Validation Security API
// app/api/validation/security/route.ts
//
// GET  /api/validation/security                                 → latest security report (portal auth)
// GET  /api/validation/security?test=cross_tenant_leakage       → single test (service auth)
// POST /api/validation/security                                 → full security scan (service auth)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { requirePortalAuth }         from '@/lib/requirePortalAuth'
import { requireServiceAuth }        from '@/lib/auth/serviceAuth'
import {
  runSecurityIsolationTests,
  getLatestSecurityReport,
  runSingleSecurityTest,
  type SecurityTestType,
}                                    from '@/lib/validation/securityIsolationTester'
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

const VALID_TEST_TYPES = new Set<SecurityTestType>([
  'cross_tenant_leakage',
  'rls_bypass_detection',
  'unauthorized_event_injection',
  'api_token_misuse',
  'secret_exposure',
])

function isValidTestType(value: string): value is SecurityTestType {
  return VALID_TEST_TYPES.has(value as SecurityTestType)
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const corrId = getRequestCorrelationId(req)

  // Sensitive GETs with ?test= require service auth
  const testParam = new URL(req.url).searchParams.get('test')

  if (testParam) {
    // Service auth required for single-test execution
    const svcAuth = await requireServiceAuth(req)
    if (!svcAuth.ok) return svcAuth.response

    if (!isValidTestType(testParam)) {
      return NextResponse.json(
        {
          error:        'Invalid test type',
          valid_values: [...VALID_TEST_TYPES],
        },
        { status: 400, headers: { 'x-correlation-id': corrId } },
      )
    }

    const tenantId = resolveTenantId()

    try {
      const result = await runSingleSecurityTest(tenantId, testParam)
      return NextResponse.json(
        { result, tenant_id: tenantId },
        { headers: { 'x-correlation-id': corrId } },
      )
    } catch (err) {
      log.error('[GET /api/validation/security] single test error', err instanceof Error ? err : undefined, {
        correlation_id: corrId,
        route: '/api/validation/security',
        test: testParam,
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
    const report = await getLatestSecurityReport(tenantId)

    if (!report) {
      return NextResponse.json(
        { error: 'No security reports found. POST to run first scan.' },
        { status: 404, headers: { 'x-correlation-id': corrId } },
      )
    }

    return NextResponse.json(
      { report },
      { headers: { 'x-correlation-id': corrId } },
    )
  } catch (err) {
    log.error('[GET /api/validation/security] error', err instanceof Error ? err : undefined, {
      correlation_id: corrId,
      route: '/api/validation/security',
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
    const report = await runSecurityIsolationTests(tenantId)

    log.info('[POST /api/validation/security] scan complete', {
      correlation_id:            corrId,
      tenant_id:                 tenantId,
      security_integrity_score:  report.security_integrity_score,
      isolation_breach_detected: report.isolation_breach_detected,
      compliance_ready:          report.compliance_ready,
    })

    return NextResponse.json(
      { report },
      {
        status: 201,
        headers: { 'x-correlation-id': corrId },
      },
    )
  } catch (err) {
    log.error('[POST /api/validation/security] error', err instanceof Error ? err : undefined, {
      correlation_id: corrId,
      route: '/api/validation/security',
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: { 'x-correlation-id': corrId } },
    )
  }
}
