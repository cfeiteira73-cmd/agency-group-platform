// app/api/cron/vault-integrity/route.ts
// Cron: daily at 02:00 UTC
// Runs integrity check + snapshot. Alerts via console/Sentry if score < 95.

import { NextRequest, NextResponse } from 'next/server'
import { computeIntegrityScores } from '@/lib/vault/integrityChecker'
import { createSnapshot } from '@/lib/vault/snapshotManager'
import { safeCompare } from '@/lib/safeCompare'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization') ?? req.headers.get('x-cron-secret') ?? ''
  if (!cronSecret || !safeCompare(auth.replace('Bearer ', ''), cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const start = Date.now()
  const results: Record<string, unknown> = {}

  try {
    // 1. Compute integrity scores
    const scores = await computeIntegrityScores()
    results['integrity'] = scores

    // 2. Create daily snapshot
    const manifest = await createSnapshot('agency-group')
    results['snapshot_id'] = manifest.snapshot_id

    // 3. Alert if score < 95
    if (scores.overall < 95) {
      const msg = `[VaultIntegrity] ALERT: overall score ${scores.overall}/100 < threshold 95. Alerts: ${scores.alerts.join('; ')}`
      console.error(msg)

      // Dynamic Sentry import (non-blocking)
      void import('@sentry/nextjs').then(Sentry => {
        Sentry.captureMessage(msg, 'warning')
      }).catch(() => {/* Sentry optional */})
    }

    results['latency_ms'] = Date.now() - start
    results['ok'] = true

    return NextResponse.json(results, { status: 200 })
  } catch (err) {
    console.error('[VaultIntegrity] Cron failed:', err)
    return NextResponse.json({
      ok: false,
      error: String(err),
      latency_ms: Date.now() - start,
    }, { status: 500 })
  }
}
