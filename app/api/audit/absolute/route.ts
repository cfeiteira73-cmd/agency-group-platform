// GET|POST /api/audit/absolute
// Wave 52 Phase 1 — Absolute System Audit (64 dimensions)

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { runAbsoluteSystemAudit } from '@/lib/audit/absoluteSystemAudit'

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
  const report = await runAbsoluteSystemAudit()
  return NextResponse.json({
    status:               'ABSOLUTE_SYSTEM_AUDIT',
    audit_grade:          report.audit_grade,
    overall_score:        report.overall_score,
    dimensions_checked:   report.dimensions_checked,
    dimensions_passed:    report.dimensions_passed,
    dimensions_failed:    report.dimensions_failed,
    total_findings:       report.total_findings,
    critical_findings:    report.critical_findings.length,
    high_findings:        report.high_findings.length,
    blockers:             report.blockers,
    reality_coverage_pct: report.reality_coverage_pct,
    system_truth_score:   report.system_truth_score,
    w51_system_score:     report.w51_system_score,
    audit_hash:           report.audit_hash,
    generated_at:         report.generated_at,
  })
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* body optional */ }
  const tenantId = typeof body['tenant_id'] === 'string' ? body['tenant_id'] : undefined
  const report   = await runAbsoluteSystemAudit(tenantId)
  return NextResponse.json(report)
}
