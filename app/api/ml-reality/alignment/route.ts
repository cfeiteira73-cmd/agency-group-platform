// =============================================================================
// Agency Group — ML Reality Alignment API v1.0
// app/api/ml-reality/alignment/route.ts
//
// GET  — alignment sweep, model-specific assessment, drift comparison,
//         retraining queue, liquidity depth
// POST — record-outcome, trigger-retraining, confirm-closing
//
// TypeScript strict — 0 errors
// =============================================================================

export const runtime = 'nodejs'
export const maxDuration = 120

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware/portalAuthGuard'
import log from '@/lib/logger'

import {
  assessModelAlignment,
  recordRealOutcome,
  triggerRetraining,
  runAlignmentSweep,
} from '@/lib/ml-reality/mlRealityAlignmentEngine'

import {
  detectDrift,
  getLatestDriftReport,
  comparePredictionVsReality,
} from '@/lib/ml-reality/driftDetector'

import {
  queueRetraining,
  getRetrainingHistory,
} from '@/lib/ml-reality/retrainingOrchestrator'

import { getLiquidityDepth, confirmExternalClosing } from '@/lib/liquidity/liquidityExecutionEngine'

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: Request): Promise<Response> {
  const authResult = await requireAuth(req)
  if (authResult instanceof Response) return authResult

  const { tenant_id: tenantId } = authResult
  const url = new URL(req.url)
  const mode = url.searchParams.get('mode')
  const modelParam = url.searchParams.get('model')
  const market = url.searchParams.get('market') ?? undefined

  try {
    // ?mode=drift-comparison
    if (mode === 'drift-comparison') {
      const comparison = await comparePredictionVsReality(tenantId)
      return NextResponse.json({ ok: true, data: comparison })
    }

    // ?mode=retraining-queue
    if (mode === 'retraining-queue') {
      const history = await getRetrainingHistory(tenantId)
      return NextResponse.json({ ok: true, data: history })
    }

    // ?mode=liquidity-depth&market=PT:Lisboa
    if (mode === 'liquidity-depth') {
      const depth = await getLiquidityDepth(tenantId, market)
      return NextResponse.json({ ok: true, data: depth })
    }

    // ?model=price_predictor (or other model names)
    if (modelParam) {
      const [alignment, driftReport] = await Promise.all([
        assessModelAlignment(modelParam, tenantId),
        getLatestDriftReport(modelParam, tenantId),
      ])
      return NextResponse.json({ ok: true, data: { alignment, drift_report: driftReport } })
    }

    // Default: runAlignmentSweep
    const alignments = await runAlignmentSweep(tenantId)
    return NextResponse.json({ ok: true, data: alignments })
  } catch (err: unknown) {
    log.error('[ml-reality/alignment] GET error', err instanceof Error ? err : new Error(String(err)), {
      tenantId,
      mode,
    })
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 })
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  const authResult = await requireAuth(req)
  if (authResult instanceof Response) return authResult

  const { tenant_id: tenantId } = authResult

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const action = body.action as string | undefined

  try {
    // record-outcome
    if (action === 'record-outcome') {
      const dealId = body.deal_id as string
      const actualPriceEurCents = body.actual_price_eur_cents as number
      const actualRoiPct = body.actual_roi_pct as number
      const source = body.source as 'INTERNAL_EXECUTION' | 'EXTERNAL_REGISTRY' | 'BANK_CONFIRMATION'
      const predictedPriceEurCents = body.predicted_price_eur_cents as number | undefined
      const predictedRoiPct = body.predicted_roi_pct as number | undefined

      if (!dealId || actualPriceEurCents == null || actualRoiPct == null || !source) {
        return NextResponse.json(
          { ok: false, error: 'Missing required fields: deal_id, actual_price_eur_cents, actual_roi_pct, source' },
          { status: 400 },
        )
      }

      const outcome = await recordRealOutcome(
        dealId,
        actualPriceEurCents,
        actualRoiPct,
        source,
        tenantId,
        predictedPriceEurCents,
        predictedRoiPct,
      )

      return NextResponse.json({ ok: true, data: outcome })
    }

    // trigger-retraining
    if (action === 'trigger-retraining') {
      const modelName = body.model_name as string
      const trigger = body.trigger as string

      if (!modelName || !trigger) {
        return NextResponse.json(
          { ok: false, error: 'Missing required fields: model_name, trigger' },
          { status: 400 },
        )
      }

      const triggerResult = await triggerRetraining(modelName, tenantId, trigger)

      if (!triggerResult.queued) {
        return NextResponse.json({
          ok: false,
          error: 'Insufficient real samples for retraining (minimum 10 required)',
          real_samples: triggerResult.real_samples,
        }, { status: 422 })
      }

      // Also queue via orchestrator
      const job = await queueRetraining(
        modelName,
        tenantId,
        trigger,
        triggerResult.real_samples,
      )

      return NextResponse.json({ ok: true, data: { trigger_result: triggerResult, job } })
    }

    // confirm-closing
    if (action === 'confirm-closing') {
      const assetId = body.asset_id as string
      const actualPriceEurCents = body.actual_price_eur_cents as number
      const buyerRef = body.buyer_ref as string

      if (!assetId || actualPriceEurCents == null || !buyerRef) {
        return NextResponse.json(
          { ok: false, error: 'Missing required fields: asset_id, actual_price_eur_cents, buyer_ref' },
          { status: 400 },
        )
      }

      await confirmExternalClosing(assetId, actualPriceEurCents, buyerRef, tenantId)

      // Also trigger a drift detection pass for all models
      void detectDrift('price_predictor', tenantId).catch((e: unknown) => {
        log.warn('[ml-reality/alignment] post-closing drift detection failed', {
          error: e instanceof Error ? e.message : String(e),
        })
      })

      return NextResponse.json({ ok: true, message: 'External closing confirmed' })
    }

    return NextResponse.json({ ok: false, error: `Unknown action: ${action ?? '(none)'}` }, { status: 400 })
  } catch (err: unknown) {
    log.error('[ml-reality/alignment] POST error', err instanceof Error ? err : new Error(String(err)), {
      tenantId,
      action,
    })
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 })
  }
}
