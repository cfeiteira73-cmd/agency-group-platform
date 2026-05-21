// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — Economic Consistency Validation API
// app/api/validation/economic/route.ts
//
// GET  /api/validation/economic             → getLatestEconomicReport (portal auth)
// POST /api/validation/economic             → runEconomicConsistencyTests (service auth)
// GET  /api/validation/economic?mode=mae    → MAE/RMSE from roi_tracking only
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { isPortalAuth } from '@/lib/portalAuth'
import { getTenantId } from '@/lib/tenant'
import log from '@/lib/logger'
import {
  runEconomicConsistencyTests,
  persistEconomicReport,
  getLatestEconomicReport,
  computeMAE,
  computeRMSE,
  computeBias,
} from '@/lib/validation/economicConsistencyEngine'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'
export const maxDuration = 60

// ─── Service auth helper ───────────────────────────────────────────────────────

function isServiceAuth(req: NextRequest): boolean {
  const cronSecret    = process.env.CRON_SECRET
  const internalToken = process.env.INTERNAL_API_TOKEN
  const incoming      = req.headers.get('x-cron-secret')
    ?? req.headers.get('authorization')?.replace('Bearer ', '')

  if (!incoming) return false

  function timingSafeMatch(a: string, b: string): boolean {
    const bufA = Buffer.from(a)
    const bufB = Buffer.from(b)
    if (bufA.length !== bufB.length) return false
    let diff = 0
    for (let i = 0; i < bufA.length; i++) diff |= bufA[i] ^ bufB[i]
    return diff === 0
  }

  if (cronSecret    && timingSafeMatch(incoming, cronSecret))    return true
  if (internalToken && timingSafeMatch(incoming, internalToken)) return true
  return false
}

// ─── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('mode')

  // All GET modes require portal auth
  const authed = await isPortalAuth(req)
  if (!authed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenantId = await getTenantId(req)

  try {
    // mode=mae — return just MAE/RMSE/Bias from roi_tracking
    if (mode === 'mae') {
      const { data, error } = await (supabaseAdmin as any)
        .from('roi_tracking')
        .select('actual_roi_pct, predicted_roi_pct')
        .eq('tenant_id', tenantId)
        .not('actual_roi_pct', 'is', null)
        .not('predicted_roi_pct', 'is', null)
        .order('tracked_at', { ascending: false })
        .limit(500)

      if (error) {
        log.warn('[validation/economic] GET mae: query failed', { tenant_id: tenantId, error: error.message })
        return NextResponse.json(
          { error: 'roi_tracking query failed', detail: error.message },
          { status: 500 }
        )
      }

      const rows = (data ?? []) as Array<{ actual_roi_pct: number; predicted_roi_pct: number }>
      const pairs = rows.map(r => ({
        actual: Number(r.actual_roi_pct),
        predicted: Number(r.predicted_roi_pct),
      }))

      const mae  = computeMAE(pairs)
      const rmse = computeRMSE(pairs)
      const bias = computeBias(pairs)

      return NextResponse.json({
        ok: true,
        sample_count: pairs.length,
        mae_pct: mae,
        rmse_pct: rmse,
        bias_pct: bias,
      }, { headers: { 'Cache-Control': 'no-store' } })
    }

    // Default GET — return latest persisted report
    const report = await getLatestEconomicReport(tenantId)
    if (!report) {
      return NextResponse.json(
        { ok: false, message: 'No economic validation report found. POST to run a new report.' },
        { status: 404 }
      )
    }

    return NextResponse.json({ ok: true, report }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    log.error('[validation/economic] GET failed', err instanceof Error ? err : undefined, { tenant_id: tenantId })
    return NextResponse.json(
      { error: 'Internal server error', detail: String(err) },
      { status: 500 }
    )
  }
}

// ─── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // POST requires service auth (cron / internal)
  if (!isServiceAuth(req)) {
    // Fall back to portal auth
    const authed = await isPortalAuth(req)
    if (!authed) {
      return NextResponse.json({ error: 'Unauthorized — service token required' }, { status: 401 })
    }
  }

  const tenantId =
    process.env.DEFAULT_TENANT_ID
    ?? process.env.SYSTEM_ORG_ID
    ?? '00000000-0000-0000-0000-000000000001'

  try {
    log.info('[validation/economic] POST: running economic consistency tests', { tenant_id: tenantId })

    const report = await runEconomicConsistencyTests(tenantId)

    // Fire-and-forget persist
    void persistEconomicReport(report).catch((e: unknown) => {
      log.warn('[validation/economic] POST: persist failed', {
        tenant_id: tenantId,
        error: e instanceof Error ? e.message : String(e),
      })
    })

    return NextResponse.json({ ok: true, report }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    log.error('[validation/economic] POST failed', err instanceof Error ? err : undefined, { tenant_id: tenantId })
    return NextResponse.json(
      { error: 'Internal server error', detail: String(err) },
      { status: 500 }
    )
  }
}
