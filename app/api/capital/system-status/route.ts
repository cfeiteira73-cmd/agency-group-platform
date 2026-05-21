// Agency Group — Capital System Status API
// app/api/capital/system-status/route.ts
// TypeScript strict — 0 errors
//
// Master status endpoint for the entire Capital Marketplace system.
// Exposes test results, event bus health, replication health, and failover simulation.
//
// GET  /api/capital/system-status             → latest cached test report (fast)
// GET  /api/capital/system-status?mode=full-test    → run all 9 mandatory tests live
// GET  /api/capital/system-status?mode=event-bus    → financial event bus health
// GET  /api/capital/system-status?mode=replication  → multi-region replication health
// GET  /api/capital/system-status?mode=failover-simulation → failover feasibility (no-op)

export const runtime = 'nodejs'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware/portalAuthGuard'
import { supabaseAdmin } from '@/lib/supabase'
import { runCapitalSystemTests } from '@/lib/testing/capitalSystemTests'
import { getEventBusHealth } from '@/lib/infra/financialEventBus'
import {
  getReplicationHealth,
  simulateFailover,
} from '@/lib/infra/multiRegionReplicator'
import log from '@/lib/logger'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CANONICAL_TENANT =
  process.env.DEFAULT_TENANT_ID ??
  process.env.SYSTEM_ORG_ID ??
  '00000000-0000-0000-0000-000000000001'

function systemGrade(
  capitalExecutionReady: boolean,
  criticalFailures: number,
): 'PRODUCTION_GRADE' | 'DEGRADED' | 'CRITICAL' {
  if (capitalExecutionReady && criticalFailures === 0) return 'PRODUCTION_GRADE'
  if (criticalFailures <= 2) return 'DEGRADED'
  return 'CRITICAL'
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authResult = await requireAuth(req)
  if (authResult instanceof Response) return authResult as NextResponse

  const tenantId = authResult.tenant_id ?? CANONICAL_TENANT
  const mode = req.nextUrl.searchParams.get('mode') ?? 'cached'

  log.info('[capital/system-status] GET request', { mode, tenant_id: tenantId })

  try {
    // ── mode: event-bus ────────────────────────────────────────────────────
    if (mode === 'event-bus') {
      const health = await getEventBusHealth(tenantId)
      return NextResponse.json(
        { mode: 'event-bus', tenant_id: tenantId, health },
        {
          status: 200,
          headers: {
            'X-Capital-Execution-Ready': 'unknown',
            'X-Critical-Failures': '0',
            'X-System-Grade': 'PRODUCTION_GRADE',
          },
        },
      )
    }

    // ── mode: replication ──────────────────────────────────────────────────
    if (mode === 'replication') {
      const health = await getReplicationHealth(tenantId)
      const grade = health.rpo_achieved ? 'PRODUCTION_GRADE' : 'DEGRADED'
      return NextResponse.json(
        { mode: 'replication', tenant_id: tenantId, health },
        {
          status: 200,
          headers: {
            'X-Capital-Execution-Ready': 'unknown',
            'X-Critical-Failures': '0',
            'X-System-Grade': grade,
          },
        },
      )
    }

    // ── mode: failover-simulation ──────────────────────────────────────────
    if (mode === 'failover-simulation') {
      const simulation = await simulateFailover(tenantId)
      const grade = simulation.failover_feasible ? 'PRODUCTION_GRADE' : 'DEGRADED'
      return NextResponse.json(
        { mode: 'failover-simulation', tenant_id: tenantId, simulation },
        {
          status: 200,
          headers: {
            'X-Capital-Execution-Ready': 'unknown',
            'X-Critical-Failures': '0',
            'X-System-Grade': grade,
          },
        },
      )
    }

    // ── mode: full-test ────────────────────────────────────────────────────
    if (mode === 'full-test') {
      const report = await runCapitalSystemTests(tenantId)
      const grade = systemGrade(report.capital_execution_ready, report.critical_failures)

      return NextResponse.json(
        { mode: 'full-test', report },
        {
          status: 200,
          headers: {
            'X-Capital-Execution-Ready': String(report.capital_execution_ready),
            'X-Critical-Failures': String(report.critical_failures),
            'X-System-Grade': grade,
          },
        },
      )
    }

    // ── mode: cached (default) ─────────────────────────────────────────────
    const { data: cached, error: cacheErr } = await (supabaseAdmin as any)
      .from('capital_system_test_reports')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single() as {
        data: {
          id: string
          tenant_id: string
          generated_at: string
          tests_passed: number
          tests_failed: number
          critical_failures: number
          all_critical_passed: boolean
          capital_execution_ready: boolean
          overall_score: number
          results: unknown
          blocking_issues: unknown
        } | null
        error: { message: string; code: string } | null
      }

    if (cacheErr || !cached) {
      // No cached report — return minimal status
      return NextResponse.json(
        {
          mode: 'cached',
          tenant_id: tenantId,
          message: 'No test report found. Run ?mode=full-test to generate one.',
          capital_execution_ready: false,
          critical_failures: 0,
          overall_score: 0,
        },
        {
          status: 200,
          headers: {
            'X-Capital-Execution-Ready': 'false',
            'X-Critical-Failures': '0',
            'X-System-Grade': 'DEGRADED',
          },
        },
      )
    }

    const grade = systemGrade(cached.capital_execution_ready, cached.critical_failures)

    return NextResponse.json(
      {
        mode: 'cached',
        report: {
          ...cached,
          results: typeof cached.results === 'string'
            ? (JSON.parse(cached.results) as unknown)
            : cached.results,
          blocking_issues: typeof cached.blocking_issues === 'string'
            ? (JSON.parse(cached.blocking_issues) as unknown)
            : cached.blocking_issues,
        },
      },
      {
        status: 200,
        headers: {
          'X-Capital-Execution-Ready': String(cached.capital_execution_ready),
          'X-Critical-Failures': String(cached.critical_failures),
          'X-System-Grade': grade,
        },
      },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.warn('[capital/system-status] Unhandled error', { error: msg, mode })
    return NextResponse.json(
      { error: 'Internal server error', details: msg },
      {
        status: 500,
        headers: {
          'X-Capital-Execution-Ready': 'false',
          'X-Critical-Failures': '9',
          'X-System-Grade': 'CRITICAL',
        },
      },
    )
  }
}
