// Agency Group — Financial Pipeline Status API
// app/api/financial/pipeline-status/route.ts
// Unified financial intelligence endpoint for the SH-ROS.
// Supports pipeline, latency, leak, ROI, forecast, and full modes.

export const runtime = 'nodejs'
export const maxDuration = 120

import { type NextRequest, NextResponse } from 'next/server'
import { requirePortalAuth } from '@/lib/requirePortalAuth'
import { getRevenuePipelineReport } from '@/lib/financial/revenuePipelineMonitor'
import { computeCapitalLatency } from '@/lib/financial/capitalLatencyTracker'
import { detectRevenueLeak } from '@/lib/financial/leakDetector'
import { computeROI } from '@/lib/financial/roiEngine'
import { forecastCashflow } from '@/lib/financial/cashflowForecaster'
import log from '@/lib/logger'

// ─── Tenant resolution ───────────────────────────────────────────────────────

function resolveTenantId(): string {
  return (
    process.env.DEFAULT_TENANT_ID ??
    process.env.SYSTEM_ORG_ID ??
    '00000000-0000-0000-0000-000000000001'
  )
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Auth guard
  const authCheck = await requirePortalAuth(req)
  if (!authCheck.ok) return authCheck.response

  const tenantId = resolveTenantId()
  const mode = req.nextUrl.searchParams.get('mode') ?? 'pipeline'

  log.info('[financial/pipeline-status] request', {
    mode,
    tenantId,
    via: authCheck.via,
  })

  try {
    switch (mode) {
      // ── Pipeline report ─────────────────────────────────────────────────
      case 'pipeline':
      default: {
        const report = await getRevenuePipelineReport(tenantId)
        return NextResponse.json({ ok: true, mode: 'pipeline', data: report })
      }

      // ── Capital latency ─────────────────────────────────────────────────
      case 'latency': {
        const metrics = await computeCapitalLatency(tenantId)
        return NextResponse.json({ ok: true, mode: 'latency', data: metrics })
      }

      // ── Revenue leak ────────────────────────────────────────────────────
      case 'leak': {
        const leakReport = await detectRevenueLeak(tenantId)
        return NextResponse.json({ ok: true, mode: 'leak', data: leakReport })
      }

      // ── ROI ─────────────────────────────────────────────────────────────
      case 'roi': {
        const roiReport = await computeROI(tenantId)
        return NextResponse.json({ ok: true, mode: 'roi', data: roiReport })
      }

      // ── Cashflow forecast ───────────────────────────────────────────────
      case 'forecast': {
        const forecast = await forecastCashflow(tenantId)
        return NextResponse.json({ ok: true, mode: 'forecast', data: forecast })
      }

      // ── Full report — all 5 in parallel ─────────────────────────────────
      case 'full': {
        const [pipelineResult, latencyResult, leakResult, roiResult, forecastResult] =
          await Promise.allSettled([
            getRevenuePipelineReport(tenantId),
            computeCapitalLatency(tenantId),
            detectRevenueLeak(tenantId),
            computeROI(tenantId),
            forecastCashflow(tenantId),
          ])

        const full = {
          pipeline:
            pipelineResult.status === 'fulfilled'
              ? { ok: true, data: pipelineResult.value }
              : { ok: false, error: String((pipelineResult as PromiseRejectedResult).reason) },
          latency:
            latencyResult.status === 'fulfilled'
              ? { ok: true, data: latencyResult.value }
              : { ok: false, error: String((latencyResult as PromiseRejectedResult).reason) },
          leak:
            leakResult.status === 'fulfilled'
              ? { ok: true, data: leakResult.value }
              : { ok: false, error: String((leakResult as PromiseRejectedResult).reason) },
          roi:
            roiResult.status === 'fulfilled'
              ? { ok: true, data: roiResult.value }
              : { ok: false, error: String((roiResult as PromiseRejectedResult).reason) },
          forecast:
            forecastResult.status === 'fulfilled'
              ? { ok: true, data: forecastResult.value }
              : { ok: false, error: String((forecastResult as PromiseRejectedResult).reason) },
          generated_at: new Date().toISOString(),
          tenant_id: tenantId,
        }

        const allOk =
          pipelineResult.status === 'fulfilled' &&
          latencyResult.status === 'fulfilled' &&
          leakResult.status === 'fulfilled' &&
          roiResult.status === 'fulfilled' &&
          forecastResult.status === 'fulfilled'

        log.info('[financial/pipeline-status] full report complete', {
          tenantId,
          allOk,
        })

        return NextResponse.json({ ok: true, mode: 'full', data: full })
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log.info('[financial/pipeline-status] unhandled error', {
      mode,
      tenantId,
      error: message,
    })
    return NextResponse.json(
      { ok: false, error: 'internal_error', message },
      { status: 500 },
    )
  }
}
