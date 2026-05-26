// Agency Group — Institutional Audit Reality Layer Route
// app/api/compliance/audit/route.ts
// Wave 48 GAP 4 — OWASP coverage, pentest readiness, signed evidence chain with chain-of-custody

import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import log from '@/lib/logger'
import { runInstitutionalAuditReport } from '@/lib/compliance/institutionalAuditRealityLayer'

export const runtime = 'nodejs'
export const maxDuration = 60

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

export async function GET(req: Request): Promise<NextResponse> {
  if (!bearerOk(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const report = await runInstitutionalAuditReport(TENANT_ID)
    return NextResponse.json(report)
  } catch (e) {
    log.error('[api/compliance/audit] GET failed', { e: String(e) })
    return NextResponse.json({ error: 'Institutional audit report failed', detail: String(e) }, { status: 500 })
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  if (!bearerOk(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const report = await runInstitutionalAuditReport(TENANT_ID)
    return NextResponse.json({
      report_id: report.report_id,
      audit_readiness_score: report.audit_readiness_score,
      institutional_audit_ready: report.institutional_audit_ready,
      owasp_coverage_pct: report.owasp_coverage_pct,
      open_critical_count: report.open_critical_count,
      open_high_count: report.open_high_count,
      sla_breached_count: report.sla_breached_count,
      chain_of_custody_hash: report.signed_audit_bundle.chain_of_custody_hash,
      evidence_items: report.signed_audit_bundle.evidence_chain.length,
      assessed_at: report.assessed_at,
    })
  } catch (e) {
    log.error('[api/compliance/audit] POST failed', { e: String(e) })
    return NextResponse.json({ error: 'Institutional audit POST failed', detail: String(e) }, { status: 500 })
  }
}
