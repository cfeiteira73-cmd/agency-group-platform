// GET|POST /api/security/absolute-hardening
// Wave 52 Phase 5 — Absolute Security Hardening

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { runAbsoluteSecurityHardening } from '@/lib/security/absoluteSecurityHardening'

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
  const report = await runAbsoluteSecurityHardening()
  return NextResponse.json({
    status:                 'ABSOLUTE_SECURITY_HARDENING',
    security_grade:         report.security_grade,
    overall_score:          report.overall_score,
    owasp_passed:           report.owasp_passed,
    owasp_total:            report.owasp_total,
    owasp_pass_rate_pct:    report.owasp_pass_rate_pct,
    red_team_mitigated:     report.red_team_mitigated,
    red_team_total:         report.red_team_total,
    red_team_coverage_pct:  report.red_team_coverage_pct,
    forensic_chain_valid:   report.forensic_chain_valid,
    open_sev1_count:        report.open_sev1_count,
    blockers:               report.blockers,
    security_hash:          report.security_hash,
    generated_at:           report.generated_at,
  })
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* body optional */ }
  const tenantId = typeof body['tenant_id'] === 'string' ? body['tenant_id'] : undefined
  const report   = await runAbsoluteSecurityHardening(tenantId)
  return NextResponse.json(report)
}
