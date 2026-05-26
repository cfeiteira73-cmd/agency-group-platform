// Agency Group — System Final Validation API
// app/api/validation/system-final/route.ts
// TypeScript strict — 0 errors
//
// Wave 41 — Production Readiness Gate for REAL_EUROPEAN_CAPITAL_MARKET_INFRASTRUCTURE
//
// GET modes (requireAuth):
//   default         → latest production readiness report
//   ?mode=fresh     → run a fresh production readiness check
//   ?mode=status-badge → quick status badge
//   ?mode=test-suite → latest reality_test_suite_runs entry
//   ?mode=run-tests → run full reality test suite (cron-safe GET)
//
// POST (admin Bearer):
//   { action: 'run-validation' } → runProductionReadinessCheck
//   { action: 'run-tests' }      → runFullTestSuite

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware/portalAuthGuard'
import log from '@/lib/logger'
import {
  runProductionReadinessCheck,
  getLatestReadinessReport,
  getSystemStatusBadge,
} from '@/lib/validation/systemFinalValidator'
import { runFullTestSuite } from '@/lib/testing/fullSystemRealityTestSuite'
import { supabaseAdmin } from '@/lib/supabase'
import { CANONICAL_TENANT_UUID } from '@/lib/constants/pipeline'

export const runtime = 'nodejs'
export const maxDuration = 120

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveTenantId(authTenantId?: string): string {
  return (
    authTenantId ??
    process.env.DEFAULT_TENANT_ID ??
    process.env.SYSTEM_ORG_ID ??
    CANONICAL_TENANT_UUID
  )
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authResult = await requireAuth(req)
  if (authResult instanceof Response) return authResult as NextResponse

  const tenantId = resolveTenantId(authResult.tenant_id)
  const mode = req.nextUrl.searchParams.get('mode') ?? 'default'

  try {
    // ── status-badge ──────────────────────────────────────────────────────────
    if (mode === 'status-badge') {
      const badge = await getSystemStatusBadge(tenantId)
      return NextResponse.json(badge, {
        headers: { 'Cache-Control': 'no-store' },
      })
    }

    // ── test-suite ────────────────────────────────────────────────────────────
    if (mode === 'test-suite') {
      const { data, error } = await (supabaseAdmin as any)
        .from('reality_test_suite_runs')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('run_at', { ascending: false })
        .limit(1)

      if (error || !data || data.length === 0) {
        return NextResponse.json(
          { error: 'No test suite runs found — use ?mode=run-tests to trigger one' },
          { status: 404 },
        )
      }

      return NextResponse.json(data[0], {
        headers: { 'Cache-Control': 'no-store' },
      })
    }

    // ── run-tests (GET cron-safe) ─────────────────────────────────────────────
    if (mode === 'run-tests') {
      log.info('[GET /api/validation/system-final] triggering test suite run', {
        tenant_id: tenantId,
      })
      const run = await runFullTestSuite(tenantId)
      return NextResponse.json(run, {
        headers: { 'Cache-Control': 'no-store' },
      })
    }

    // ── fresh ─────────────────────────────────────────────────────────────────
    if (mode === 'fresh') {
      log.info('[GET /api/validation/system-final] running fresh readiness check', {
        tenant_id: tenantId,
      })
      const report = await runProductionReadinessCheck(tenantId)
      return NextResponse.json(report, {
        headers: {
          'Cache-Control': 'no-store',
          'X-System-Status': report.system_status,
          'X-Readiness-Score': String(report.readiness_score_pct),
        },
      })
    }

    // ── default: latest report ────────────────────────────────────────────────
    const report = await getLatestReadinessReport(tenantId)
    if (!report) {
      return NextResponse.json(
        {
          error:
            'No production readiness report found — use ?mode=fresh to generate one',
        },
        { status: 404 },
      )
    }

    return NextResponse.json(report, {
      headers: {
        'Cache-Control': 'no-store',
        'X-System-Status': report.system_status,
        'X-Readiness-Score': String(report.readiness_score_pct),
      },
    })
  } catch (err) {
    log.error(
      '[GET /api/validation/system-final] error',
      err instanceof Error ? err : undefined,
      { tenant_id: tenantId, mode },
    )
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const authResult = await requireAuth(req)
  if (authResult instanceof Response) return authResult as NextResponse

  const tenantId = resolveTenantId(authResult.tenant_id)

  let body: { action?: string } = {}
  try {
    body = (await req.json()) as { action?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { action } = body

  try {
    if (action === 'run-validation') {
      log.info('[POST /api/validation/system-final] running production readiness check', {
        tenant_id: tenantId,
      })
      const report = await runProductionReadinessCheck(tenantId)
      return NextResponse.json(report, {
        headers: {
          'Cache-Control': 'no-store',
          'X-System-Status': report.system_status,
          'X-Readiness-Score': String(report.readiness_score_pct),
        },
      })
    }

    if (action === 'run-tests') {
      log.info('[POST /api/validation/system-final] running full test suite', {
        tenant_id: tenantId,
      })
      const run = await runFullTestSuite(tenantId)
      return NextResponse.json(run, {
        headers: { 'Cache-Control': 'no-store' },
      })
    }

    return NextResponse.json(
      { error: `Unknown action: ${action}. Valid actions: run-validation, run-tests` },
      { status: 400 },
    )
  } catch (err) {
    log.error(
      '[POST /api/validation/system-final] error',
      err instanceof Error ? err : undefined,
      { tenant_id: tenantId, action },
    )
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
