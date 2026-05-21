// Agency Group — Chaos Engine + Resilience Orchestrator API
// app/api/sre/chaos-engine/route.ts
//
// Routes (dispatched via ?action= query param):
//   GET  /api/sre/chaos-engine?action=status     — latest chaos gauntlet result
//   POST /api/sre/chaos-engine?action=run        — run full chaos gauntlet
//   GET  /api/sre/chaos-engine?action=resilience — latest resilience report
//   POST /api/sre/chaos-engine?action=feedback-loop — run liquidity feedback loop
//
// Auth: Authorization: Bearer <CRON_SECRET>  OR  x-service-auth: <INTERNAL_API_SECRET>
//
// TypeScript strict — 0 errors

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin }             from '@/lib/supabase'
import log                           from '@/lib/logger'
import { runChaosGauntlet, persistChaosResult } from '@/lib/sre/chaosEngine'
import { generateResilienceReport, persistResilienceReport } from '@/lib/sre/resilienceOrchestrator'
import { runFeedbackLoop, persistFeedbackLoopResult }         from '@/lib/market/liquidityFeedbackLoop'
import { CANONICAL_TENANT_UUID }     from '@/lib/constants/pipeline'
import { getRequestCorrelationId }   from '@/lib/observability/correlation'

export const runtime     = 'nodejs'
export const maxDuration = 120

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

function resolveTenantId(): string {
  return (
    process.env.DEFAULT_TENANT_ID ??
    process.env.SYSTEM_ORG_ID     ??
    CANONICAL_TENANT_UUID
  )
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const corrId  = getRequestCorrelationId(req)
  const action  = new URL(req.url).searchParams.get('action') ?? 'status'

  if (!requireServiceAuth(req)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: { 'x-correlation-id': corrId } },
    )
  }

  const tenantId = resolveTenantId()

  try {
    // ── GET status ────────────────────────────────────────────────────────────
    if (action === 'status') {
      const { data, error } = await (supabaseAdmin as any)
        .from('chaos_gauntlet_results')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('ran_at', { ascending: false })
        .limit(1)

      if (error) {
        log.warn('[GET /api/sre/chaos-engine] status query failed', {
          error: error.message,
          corr_id: corrId,
        })
        return NextResponse.json(
          { error: 'Failed to fetch chaos gauntlet status', detail: error.message },
          { status: 500, headers: { 'x-correlation-id': corrId } },
        )
      }

      const latest = Array.isArray(data) && data.length > 0 ? data[0] : null

      return NextResponse.json(
        {
          latest_result:   latest,
          has_data:        latest != null,
          tenant_id:       tenantId,
        },
        { headers: { 'x-correlation-id': corrId } },
      )
    }

    // ── GET resilience ────────────────────────────────────────────────────────
    if (action === 'resilience') {
      const { data, error } = await (supabaseAdmin as any)
        .from('resilience_reports')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('generated_at', { ascending: false })
        .limit(1)

      if (error) {
        log.warn('[GET /api/sre/chaos-engine] resilience query failed', {
          error: error.message,
          corr_id: corrId,
        })
        return NextResponse.json(
          { error: 'Failed to fetch resilience report', detail: error.message },
          { status: 500, headers: { 'x-correlation-id': corrId } },
        )
      }

      const latest = Array.isArray(data) && data.length > 0 ? data[0] : null

      return NextResponse.json(
        {
          latest_report:  latest,
          has_data:       latest != null,
          tenant_id:      tenantId,
        },
        { headers: { 'x-correlation-id': corrId } },
      )
    }

    return NextResponse.json(
      { error: `Unknown action: ${action}. Valid GET actions: status, resilience` },
      { status: 400, headers: { 'x-correlation-id': corrId } },
    )
  } catch (err) {
    log.error('[GET /api/sre/chaos-engine] unhandled error', err instanceof Error ? err : undefined, {
      action,
      corr_id: corrId,
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: { 'x-correlation-id': corrId } },
    )
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const corrId  = getRequestCorrelationId(req)
  const action  = new URL(req.url).searchParams.get('action') ?? 'run'

  if (!requireServiceAuth(req)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: { 'x-correlation-id': corrId } },
    )
  }

  const tenantId = resolveTenantId()

  try {
    // ── POST run — full chaos gauntlet ────────────────────────────────────────
    if (action === 'run') {
      log.info('[POST /api/sre/chaos-engine] starting chaos gauntlet', {
        tenant_id: tenantId,
        corr_id:   corrId,
      })

      const result = await runChaosGauntlet(tenantId)
      void persistChaosResult(result)

      log.info('[POST /api/sre/chaos-engine] gauntlet complete', {
        tenant_id:               tenantId,
        system_readiness:        result.system_readiness,
        overall_resilience_score: result.overall_resilience_score,
        passed:                  result.passed,
        degraded:                result.degraded,
        failed:                  result.failed,
        corr_id:                 corrId,
      })

      return NextResponse.json(result, {
        status: result.system_readiness === 'critical_gaps' ? 207 : 200,
        headers: { 'x-correlation-id': corrId },
      })
    }

    // ── POST feedback-loop — liquidity feedback loop ───────────────────────────
    if (action === 'feedback-loop') {
      // Optional: parse maxIterations from body
      let maxIterations = 5
      try {
        const body = (await req.json()) as { max_iterations?: number }
        if (typeof body.max_iterations === 'number' && body.max_iterations > 0) {
          maxIterations = Math.min(body.max_iterations, 10) // cap at 10 for safety
        }
      } catch { /* empty body — use defaults */ }

      log.info('[POST /api/sre/chaos-engine] starting feedback loop', {
        tenant_id:      tenantId,
        max_iterations: maxIterations,
        corr_id:        corrId,
      })

      const result = await runFeedbackLoop(tenantId, maxIterations)
      void persistFeedbackLoopResult(result)

      log.info('[POST /api/sre/chaos-engine] feedback loop complete', {
        tenant_id:                          tenantId,
        total_iterations:                   result.total_iterations,
        converged:                          result.converged,
        convergence_iteration:              result.convergence_iteration,
        cumulative_price_adjustment_pct:    result.cumulative_price_adjustment_pct,
        cumulative_capital_reallocation_eur: result.cumulative_capital_reallocation_eur,
        corr_id:                            corrId,
      })

      return NextResponse.json(result, {
        headers: { 'x-correlation-id': corrId },
      })
    }

    // ── POST resilience — generate fresh resilience report ────────────────────
    if (action === 'resilience') {
      log.info('[POST /api/sre/chaos-engine] generating resilience report', {
        tenant_id: tenantId,
        corr_id:   corrId,
      })

      const report = await generateResilienceReport(tenantId)
      void persistResilienceReport(report)

      log.info('[POST /api/sre/chaos-engine] resilience report complete', {
        tenant_id:               tenantId,
        sre_grade:               report.sre_grade,
        overall_resilience_score: report.overall_resilience_score,
        critical_actions_count:  report.critical_actions.length,
        corr_id:                 corrId,
      })

      return NextResponse.json(report, {
        status: report.sre_grade === 'D' ? 207 : 200,
        headers: { 'x-correlation-id': corrId },
      })
    }

    return NextResponse.json(
      { error: `Unknown action: ${action}. Valid POST actions: run, feedback-loop, resilience` },
      { status: 400, headers: { 'x-correlation-id': corrId } },
    )
  } catch (err) {
    log.error('[POST /api/sre/chaos-engine] unhandled error', err instanceof Error ? err : undefined, {
      action,
      corr_id: corrId,
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: { 'x-correlation-id': corrId } },
    )
  }
}
