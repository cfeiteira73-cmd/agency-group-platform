// GET|POST /api/resilience/dr-truth
// Wave 51 Phase 6 — DR/Chaos/Resilience Truth

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { runDrChaosTruth } from '@/lib/resilience/drChaosTruth'

export const runtime    = 'nodejs'
export const maxDuration = 120

function authorized(req: NextRequest): boolean {
  const secret = process.env.INTERNAL_API_SECRET
  if (!secret) return false
  const header = req.headers.get('authorization') ?? ''
  const token  = header.replace(/^Bearer\s+/i, '')
  try { return timingSafeEqual(Buffer.from(token), Buffer.from(secret)) }
  catch { return false }
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const report = await runDrChaosTruth()
  return NextResponse.json({
    status:             'DR_CHAOS_TRUTH',
    dr_status:          report.dr_status,
    resilience_score:   report.resilience_score,
    chaos_enabled:      report.chaos_enabled,
    scenarios_proven:   report.scenarios_proven,
    rto_compliance_pct: report.rto_compliance_pct,
    rpo_compliance_pct: report.rpo_compliance_pct,
    blocker_count:      report.blockers.length,
    dr_truth_hash:      report.dr_truth_hash,
    generated_at:       report.generated_at,
  })
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* body optional */ }
  const tenantId = typeof body['tenant_id'] === 'string' ? body['tenant_id'] : undefined
  const report   = await runDrChaosTruth(tenantId)
  return NextResponse.json(report)
}
