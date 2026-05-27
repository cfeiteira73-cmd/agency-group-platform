// GET|POST /api/compliance/external-audit
// Wave 50 Phase 4 — External Institutional Audit Engine

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { runExternalInstitutionalAuditEngine } from '@/lib/compliance/externalInstitutionalAuditEngine'

export const runtime    = 'nodejs'
export const maxDuration = 60

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
  const report = await runExternalInstitutionalAuditEngine()
  return NextResponse.json({
    status: 'EXTERNAL_INSTITUTIONAL_AUDIT_ENGINE',
    external_audit_status: report.external_audit_status,
    external_audit_score: report.external_audit_score,
    soc2_score: report.soc2_score,
    iso27001_score: report.iso27001_score,
    big4_ready: report.big4_package.big4_ready,
    pentest_blocker: report.pentest_blocker,
    total_evidence_items: report.total_evidence_items,
    blockers_count: report.blockers.length,
    assessed_at: report.assessed_at,
  })
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* body optional */ }
  const tenantId = typeof body.tenant_id === 'string' ? body.tenant_id : undefined

  const report = await runExternalInstitutionalAuditEngine(tenantId)
  return NextResponse.json({
    report_id: report.report_id,
    tenant_id: report.tenant_id,
    assessed_at: report.assessed_at,
    external_audit_status: report.external_audit_status,
    external_audit_score: report.external_audit_score,
    soc2_score: report.soc2_score,
    soc2_target: report.soc2_target,
    soc2_target_met: report.soc2_target_met,
    soc2_evidence_continuity: report.soc2_evidence_continuity,
    iso27001_score: report.iso27001_score,
    iso27001_target: report.iso27001_target,
    iso27001_target_met: report.iso27001_target_met,
    total_evidence_items: report.total_evidence_items,
    chain_of_custody_hash: report.chain_of_custody_hash,
    open_critical_vulns: report.open_critical_vulns,
    open_high_vulns: report.open_high_vulns,
    owasp_coverage_pct: report.owasp_coverage_pct,
    high_vuln_sla_breached: report.high_vuln_sla_breached,
    pentest_blocker: report.pentest_blocker,
    big4_ready: report.big4_package.big4_ready,
    big4_auditor_export_ref: report.big4_package.auditor_export_ref,
    wave49_regulatory_score: report.wave49_regulatory_score,
    wave49_regulatory_readiness: report.wave49_regulatory_readiness,
    blockers: report.blockers,
    issues: report.issues,
    recommendations: report.recommendations,
  })
}
