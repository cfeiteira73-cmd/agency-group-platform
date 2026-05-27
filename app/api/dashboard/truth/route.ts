// GET|POST /api/dashboard/truth
// Wave 52 Phase 2 — Institutional Dashboard Truth

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { runInstitutionalDashboardTruth } from '@/lib/dashboard/institutionalDashboardTruth'

export const runtime     = 'nodejs'
export const maxDuration = 60

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
  const report = await runInstitutionalDashboardTruth()
  return NextResponse.json({
    status:              'DASHBOARD_TRUTH',
    truth_grade:         report.truth_grade,
    overall_score:       report.overall_score,
    total_panels:        report.coverage.total_panels,
    full_coverage_pct:   report.coverage.full_coverage_pct,
    stale_panels:        report.stale_panels.length,
    critical_stale:      report.critical_stale_panels.length,
    blockers:            report.blockers,
    truth_hash:          report.truth_hash,
    generated_at:        report.generated_at,
  })
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* body optional */ }
  const tenantId = typeof body['tenant_id'] === 'string' ? body['tenant_id'] : undefined
  const report   = await runInstitutionalDashboardTruth(tenantId)
  return NextResponse.json(report)
}
