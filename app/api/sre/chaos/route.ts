// Agency Group — Chaos Test Execution API
// app/api/sre/chaos/route.ts
// POST /api/sre/chaos — execute chaos tests
// GET  /api/sre/chaos — get chaos test history + library
// Auth: requirePortalAuth (CHAOS_TESTING_ENABLED must also be set for POST)
// TypeScript strict — 0 errors

import { NextRequest, NextResponse } from 'next/server'
import { requirePortalAuth } from '@/lib/requirePortalAuth'
import { CHAOS_TEST_LIBRARY, getChaosHistory } from '@/lib/sre/chaosEngine'
import { executeChaosTests } from '@/lib/sre/chaosExecutor'
import { CANONICAL_TENANT_UUID } from '@/lib/constants/pipeline'
import { getRequestCorrelationId } from '@/lib/observability/correlation'

export const runtime = 'nodejs'

function resolveTenantId(): string {
  return (
    process.env.DEFAULT_TENANT_ID ??
    process.env.SYSTEM_ORG_ID ??
    CANONICAL_TENANT_UUID
  )
}

// ─── GET /api/sre/chaos ───────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const corrId = getRequestCorrelationId(req)

  const auth = await requirePortalAuth(req)
  if (!auth.ok) return auth.response

  const tenantId = resolveTenantId()

  try {
    const [recentResults] = await Promise.all([
      getChaosHistory(tenantId, 10),
    ])

    return NextResponse.json(
      {
        library: CHAOS_TEST_LIBRARY,
        chaos_testing_enabled: process.env.CHAOS_TESTING_ENABLED === 'true',
        recent_results: recentResults,
        total_in_library: CHAOS_TEST_LIBRARY.length,
        automatable_count: CHAOS_TEST_LIBRARY.filter(t => t.automatable).length,
      },
      { headers: { 'x-correlation-id': corrId } },
    )
  } catch (err) {
    console.error('[GET /api/sre/chaos]', err, { corrId, tenant_id: tenantId })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: { 'x-correlation-id': corrId } },
    )
  }
}

// ─── POST /api/sre/chaos ──────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const corrId = getRequestCorrelationId(req)

  const auth = await requirePortalAuth(req)
  if (!auth.ok) return auth.response

  // CHAOS_TESTING_ENABLED guard — 403 if not set
  if (process.env.CHAOS_TESTING_ENABLED !== 'true') {
    return NextResponse.json(
      {
        error: 'Chaos testing is disabled. Set CHAOS_TESTING_ENABLED=true to enable.',
        chaos_testing_enabled: false,
      },
      { status: 403, headers: { 'x-correlation-id': corrId } },
    )
  }

  const tenantId = resolveTenantId()

  try {
    let body: { test_name?: string; dry_run?: boolean } = {}
    try {
      body = (await req.json()) as { test_name?: string; dry_run?: boolean }
    } catch {
      // Empty body is valid — run all automatable tests
    }

    const summary = await executeChaosTests({
      tenantId,
      testName: body.test_name,
      dryRun:   body.dry_run ?? false,
    })

    console.info('[POST /api/sre/chaos] execution complete', {
      corrId,
      tenant_id: tenantId,
      tests_run: summary.tests_run,
      tests_passed: summary.tests_passed,
      tests_failed: summary.tests_failed,
      dry_run: body.dry_run ?? false,
      email: auth.email,
    })

    return NextResponse.json(summary, {
      status: summary.tests_failed > 0 ? 207 : 200,
      headers: { 'x-correlation-id': corrId },
    })
  } catch (err) {
    console.error('[POST /api/sre/chaos]', err, { corrId, tenant_id: tenantId })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: { 'x-correlation-id': corrId } },
    )
  }
}
