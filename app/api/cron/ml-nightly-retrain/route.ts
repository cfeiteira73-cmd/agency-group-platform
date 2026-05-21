// =============================================================================
// Agency Group — ML Nightly Retrain Cron
// app/api/cron/ml-nightly-retrain/route.ts
//
// POST /api/cron/ml-nightly-retrain
// Auth: CRON_SECRET (x-cron-secret header or Authorization Bearer)
// Schedule: 02:00 UTC daily (configured in vercel.json / cron provider)
//
// Orchestrates:
//   1. Drift detection across all 4 named models
//   2. Counterfactual label generation
//   3. Profit-label based retraining
//   4. Automatic rollback on performance regression
//   5. Run summary persistence to retraining_runs table
//
// TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { safeCompare }          from '@/lib/safeCompare'
import { runNightlyRetrain }    from '@/lib/ml/continuousRetraining'
import log                      from '@/lib/logger'

export const runtime     = 'nodejs'
export const maxDuration = 300   // 5 minutes — requires Vercel Pro

// ---------------------------------------------------------------------------
// Auth check — constant-time comparison against CRON_SECRET
// ---------------------------------------------------------------------------

function authCheck(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return false
  const token =
    req.headers.get('x-cron-secret') ??
    req.headers.get('authorization')?.replace('Bearer ', '').trim()
  if (!token) return false
  return safeCompare(token, secret)
}

// ---------------------------------------------------------------------------
// POST /api/cron/ml-nightly-retrain
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!authCheck(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenantId  = process.env.DEFAULT_TENANT_ID ?? process.env.SYSTEM_ORG_ID ?? '00000000-0000-0000-0000-000000000001'
  const startedAt = new Date().toISOString()

  log.info('[cron/ml-nightly-retrain] starting nightly retrain', {
    tenant_id:  tenantId,
    started_at: startedAt,
  } as any)

  try {
    const run = await runNightlyRetrain(tenantId)

    log.info('[cron/ml-nightly-retrain] complete', {
      run_id:            run.id,
      models_retrained:  run.models_retrained,
      models_skipped:    run.models_skipped,
      models_rolled_back: run.models_rolled_back,
      total_duration_ms: run.total_duration_ms,
    } as any)

    return NextResponse.json({
      ok:         true,
      started_at: startedAt,
      run_id:     run.id,
      tenant_id:  run.tenant_id,
      trigger:    run.trigger,
      models_retrained:    run.models_retrained,
      models_skipped:      run.models_skipped,
      models_rolled_back:  run.models_rolled_back,
      total_duration_ms:   run.total_duration_ms,
      started_at_run:      run.started_at,
      completed_at:        run.completed_at,
      results:             run.results,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.error('[cron/ml-nightly-retrain] fatal error', err instanceof Error ? err : undefined, {
      tenant_id:  tenantId,
      started_at: startedAt,
      error:      msg,
    })
    return NextResponse.json(
      { ok: false, error: msg, started_at: startedAt },
      { status: 500 },
    )
  }
}

// Allow GET for manual testing (same auth required)
export { POST as GET }
