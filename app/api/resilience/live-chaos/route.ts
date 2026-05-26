// Agency Group — Live Institutional Chaos Engine Route
// app/api/resilience/live-chaos/route.ts
// Wave 48 GAP 5 — Production-safe blast radius, rollback validation, RTO/RPO truth

import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import log from '@/lib/logger'
import { runLiveInstitutionalChaosReport } from '@/lib/resilience/liveInstitutionalChaosEngine'
import type { BlastRadius } from '@/lib/resilience/liveInstitutionalChaosEngine'

export const runtime = 'nodejs'
export const maxDuration = 120

const TENANT_ID =
  process.env.DEFAULT_TENANT_ID ??
  process.env.SYSTEM_ORG_ID ??
  '00000000-0000-0000-0000-000000000001'

function bearerOk(req: Request): boolean {
  const secret = process.env.INTERNAL_API_SECRET
  if (!secret) return false
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.replace(/^Bearer\s+/i, '')
  if (!token || token.length !== secret.length) return false
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(secret))
  } catch {
    return false
  }
}

const VALID_BLAST_RADII: BlastRadius[] = [
  'SAFE_DRY_RUN',
  'SINGLE_SERVICE',
  'PARTIAL_SYSTEM',
  'FULL_REGION',
]

// GET — dry-run, no chaos injection
export async function GET(req: Request): Promise<NextResponse> {
  if (!bearerOk(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const report = await runLiveInstitutionalChaosReport(TENANT_ID, false, 'SAFE_DRY_RUN')
    return NextResponse.json(report)
  } catch (e) {
    log.error('[api/resilience/live-chaos] GET failed', { e: String(e) })
    return NextResponse.json({ error: 'Live chaos report failed', detail: String(e) }, { status: 500 })
  }
}

// POST — optional chaos injection (requires CHAOS_TESTING_ENABLED=true)
export async function POST(req: Request): Promise<NextResponse> {
  if (!bearerOk(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    let runChaos = false
    let blastRadius: BlastRadius = 'SAFE_DRY_RUN'

    try {
      const body = (await req.json()) as { run_chaos?: boolean; blast_radius?: string }
      runChaos = body.run_chaos === true
      if (body.blast_radius && VALID_BLAST_RADII.includes(body.blast_radius as BlastRadius)) {
        blastRadius = body.blast_radius as BlastRadius
      }
    } catch {
      // no body — defaults apply
    }

    const report = await runLiveInstitutionalChaosReport(TENANT_ID, runChaos, blastRadius)
    return NextResponse.json({
      report_id: report.report_id,
      institutional_chaos_passed: report.institutional_chaos_passed,
      resilience_grade: report.resilience_grade,
      resilience_score: report.resilience_score,
      rto_hard_limit_met: report.rto_hard_limit_met,
      rpo_verified: report.rpo_validation.rpo_verified,
      blast_radius_used: report.chaos_window.blast_radius,
      rollback_success: report.rollback_success,
      failovers_successful: report.failovers_successful,
      production_dr_ready: report.production_dr_ready,
      assessed_at: report.assessed_at,
    })
  } catch (e) {
    log.error('[api/resilience/live-chaos] POST failed', { e: String(e) })
    return NextResponse.json({ error: 'Live chaos POST failed', detail: String(e) }, { status: 500 })
  }
}
