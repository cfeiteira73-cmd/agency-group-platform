// GET|POST /api/resilience/failure-grid
// Wave 50 Phase 5 — Live Failure Reality Grid

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { runLiveFailureRealityGrid, type BlastRadius } from '@/lib/resilience/liveFailureRealityGrid'

export const runtime    = 'nodejs'
export const maxDuration = 120

function authorized(req: NextRequest): boolean {
  const secret = process.env.INTERNAL_API_SECRET
  if (!secret) return false
  const header = req.headers.get('authorization') ?? ''
  const token = header.replace(/^Bearer\s+/i, '')
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(secret))
  } catch { return false }
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // GET = dry-run only
  const report = await runLiveFailureRealityGrid(undefined, false, 'SAFE_DRY_RUN')
  return NextResponse.json({
    status: 'LIVE_FAILURE_REALITY_GRID',
    failure_reality_grade: report.failure_reality_grade,
    resilience_score: report.resilience_score,
    rto_hard_limit_met: report.rto_hard_limit_met,
    rpo_verified: report.rpo_verified,
    blast_radius: report.blast_radius,
    blockers_count: report.blockers.length,
    assessed_at: report.assessed_at,
  })
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* body optional */ }

  const tenantId  = typeof body.tenant_id    === 'string'  ? body.tenant_id : undefined
  const runFailures = body.run_failures === true
  const validRadii: BlastRadius[] = ['SAFE_DRY_RUN', 'SINGLE_SERVICE', 'PARTIAL_SYSTEM', 'FULL_REGION']
  const blastRadius: BlastRadius  = validRadii.includes(body.blast_radius as BlastRadius)
    ? (body.blast_radius as BlastRadius)
    : 'SAFE_DRY_RUN'

  const report = await runLiveFailureRealityGrid(tenantId, runFailures, blastRadius)
  return NextResponse.json({
    report_id: report.report_id,
    tenant_id: report.tenant_id,
    assessed_at: report.assessed_at,
    failure_reality_grade: report.failure_reality_grade,
    failure_ready: report.failure_ready,
    resilience_score: report.resilience_score,
    recovery_coverage_pct: report.recovery_coverage_pct,
    scenarios_proven: report.scenarios_proven,
    scenarios_dry_run: report.scenarios_dry_run,
    scenarios_failed: report.scenarios_failed,
    rto_hard_limit_met: report.rto_hard_limit_met,
    rto_worst_case_seconds: report.rto_worst_case_seconds,
    rpo_verified: report.rpo_verified,
    blast_radius: report.blast_radius,
    blast_radius_contained: report.blast_radius_contained,
    region_failover_proven: report.region_failover_proven,
    rollback_verified: report.rollback_verification.verified,
    event_replay_total: report.event_replay_proof.total_events,
    wave49_chaos_grid_status: report.wave49_chaos_grid_status,
    failure_reality_hash: report.failure_reality_hash,
    blockers: report.blockers,
    issues: report.issues,
    recommendations: report.recommendations,
  })
}
