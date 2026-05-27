// GET|POST /api/compliance/institutional-readiness
// Wave 52 Phase 8 — Institutional Readiness Certifier (7 frameworks)

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { runInstitutionalReadinessCertifier } from '@/lib/compliance/institutionalReadinessCertifier'

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
  const report = await runInstitutionalReadinessCertifier()
  return NextResponse.json({
    status:               'INSTITUTIONAL_READINESS',
    readiness_grade:      report.readiness_grade,
    overall_score:        report.overall_score,
    frameworks_compliant: report.frameworks_compliant,
    frameworks_total:     report.frameworks_total,
    big4_ready:           report.big4_ready,
    total_evidence_items: report.total_evidence_items,
    blockers:             report.blockers,
    readiness_hash:       report.readiness_hash,
    cert_valid_until:     report.cert_valid_until,
    generated_at:         report.generated_at,
  })
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* body optional */ }
  const tenantId = typeof body['tenant_id'] === 'string' ? body['tenant_id'] : undefined
  const report   = await runInstitutionalReadinessCertifier(tenantId)
  return NextResponse.json(report)
}
