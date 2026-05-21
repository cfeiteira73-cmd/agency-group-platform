// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — ML Validation API
// app/api/validation/ml/route.ts
//
// GET  /api/validation/ml                         → getLatestMLReport (portal auth)
// POST /api/validation/ml                         → runMLValidationAudit (service auth)
// GET  /api/validation/ml?mode=drift              → run drift check only
// GET  /api/validation/ml?mode=synthetic-drift    → injectSyntheticDrift simulation
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { isPortalAuth } from '@/lib/portalAuth'
import { getTenantId } from '@/lib/tenant'
import log from '@/lib/logger'
import {
  runMLValidationAudit,
  persistMLReport,
  getLatestMLReport,
  injectSyntheticDrift,
} from '@/lib/validation/mlValidationEngine'
import { runDriftCheck } from '@/lib/ml/driftDetector'

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
    // mode=drift — run live drift check (no persist)
    if (mode === 'drift') {
      log.info('[validation/ml] GET drift: running drift check', { tenant_id: tenantId })
      const driftResults = await runDriftCheck(tenantId)
      return NextResponse.json({ ok: true, drift_results: driftResults, count: driftResults.length }, {
        headers: { 'Cache-Control': 'no-store' },
      })
    }

    // mode=synthetic-drift — simulate drift without modifying data
    if (mode === 'synthetic-drift') {
      log.info('[validation/ml] GET synthetic-drift: simulating drift', { tenant_id: tenantId })
      const simulation = await injectSyntheticDrift(tenantId)
      return NextResponse.json({ ok: true, simulation }, {
        headers: { 'Cache-Control': 'no-store' },
      })
    }

    // Default GET — return latest persisted ML report
    const report = await getLatestMLReport(tenantId)
    if (!report) {
      return NextResponse.json(
        { ok: false, message: 'No ML validation report found. POST to run a new audit.' },
        { status: 404 }
      )
    }

    return NextResponse.json({ ok: true, report }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    log.error('[validation/ml] GET failed', err instanceof Error ? err : undefined, { tenant_id: tenantId })
    return NextResponse.json(
      { error: 'Internal server error', detail: String(err) },
      { status: 500 }
    )
  }
}

// ─── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // POST requires service auth; fall back to portal auth
  if (!isServiceAuth(req)) {
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
    log.info('[validation/ml] POST: running ML validation audit', { tenant_id: tenantId })

    const report = await runMLValidationAudit(tenantId)

    // Fire-and-forget persist
    void persistMLReport(report).catch((e: unknown) => {
      log.warn('[validation/ml] POST: persist failed', {
        tenant_id: tenantId,
        error: e instanceof Error ? e.message : String(e),
      })
    })

    return NextResponse.json({ ok: true, report }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    log.error('[validation/ml] POST failed', err instanceof Error ? err : undefined, { tenant_id: tenantId })
    return NextResponse.json(
      { error: 'Internal server error', detail: String(err) },
      { status: 500 }
    )
  }
}
