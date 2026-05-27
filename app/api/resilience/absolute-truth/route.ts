// GET|POST /api/resilience/absolute-truth
// Wave 52 Phase 6 — Absolute Resilience Truth (11 chaos scenarios)

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { runAbsoluteResilienceTruth } from '@/lib/resilience/absoluteResilienceTruth'

export const runtime     = 'nodejs'
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
  const report = await runAbsoluteResilienceTruth()
  return NextResponse.json({
    status:              'ABSOLUTE_RESILIENCE_TRUTH',
    resilience_grade:    report.resilience_grade,
    overall_score:       report.overall_score,
    total_scenarios:     report.summary.total_scenarios,
    proven_count:        report.summary.proven_count,
    rto_compliant_count: report.summary.rto_compliant_count,
    rpo_compliant_count: report.summary.rpo_compliant_count,
    chaos_env_required:  report.chaos_env_required,
    multi_region_ready:  report.multi_region_ready,
    backup_chain_valid:  report.backup_chain_valid,
    blockers:            report.blockers,
    resilience_hash:     report.resilience_hash,
    generated_at:        report.generated_at,
  })
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* body optional */ }
  const tenantId = typeof body['tenant_id'] === 'string' ? body['tenant_id'] : undefined
  const report   = await runAbsoluteResilienceTruth(tenantId)
  return NextResponse.json(report)
}
