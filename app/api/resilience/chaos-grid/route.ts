// Agency Group — Live Production Chaos Grid Route
// app/api/resilience/chaos-grid/route.ts
// Wave 49 Phase 5

import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import log from '@/lib/logger'
import { runLiveProductionChaosGrid } from '@/lib/resilience/liveProductionChaosGrid'
import type { BlastRadius } from '@/lib/resilience/liveInstitutionalChaosEngine'

export const runtime = 'nodejs'
export const maxDuration = 120

const TENANT_ID = process.env.DEFAULT_TENANT_ID ?? process.env.SYSTEM_ORG_ID ?? '00000000-0000-0000-0000-000000000001'
const VALID_BLAST: BlastRadius[] = ['SAFE_DRY_RUN', 'SINGLE_SERVICE', 'PARTIAL_SYSTEM', 'FULL_REGION']

function bearerOk(req: Request): boolean {
  const secret = process.env.INTERNAL_API_SECRET
  if (!secret) return false
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token || token.length !== secret.length) return false
  try { return timingSafeEqual(Buffer.from(token), Buffer.from(secret)) } catch { return false }
}

export async function GET(req: Request): Promise<NextResponse> {
  if (!bearerOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    return NextResponse.json(await runLiveProductionChaosGrid(TENANT_ID, false, 'SAFE_DRY_RUN'))
  } catch (e) {
    log.error('[api/resilience/chaos-grid] GET failed', { e: String(e) })
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  if (!bearerOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    let runChaos = false
    let blastRadius: BlastRadius = 'SAFE_DRY_RUN'
    try {
      const body = (await req.json()) as { run_chaos?: boolean; blast_radius?: string }
      runChaos = body.run_chaos === true
      if (body.blast_radius && VALID_BLAST.includes(body.blast_radius as BlastRadius)) {
        blastRadius = body.blast_radius as BlastRadius
      }
    } catch { /* no body */ }
    const r = await runLiveProductionChaosGrid(TENANT_ID, runChaos, blastRadius)
    return NextResponse.json({
      report_id: r.report_id, chaos_grid_status: r.chaos_grid_status, resilience_score: r.resilience_score,
      scenarios_passed: r.scenarios_passed, scenarios_failed: r.scenarios_failed, scenarios_dry_run: r.scenarios_dry_run,
      rto_hard_limit_met: r.rto_hard_limit_met, rpo_verified: r.rpo_verified,
      chaos_certification_hash: r.chaos_certification_hash, assessed_at: r.assessed_at,
    })
  } catch (e) {
    log.error('[api/resilience/chaos-grid] POST failed', { e: String(e) })
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
