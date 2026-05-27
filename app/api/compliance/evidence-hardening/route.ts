// GET|POST /api/compliance/evidence-hardening
// Wave 51 Phase 8 — Compliance Evidence Hardening

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { runComplianceEvidenceHardening } from '@/lib/compliance/complianceEvidenceHardening'

export const runtime    = 'nodejs'
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
  const report = await runComplianceEvidenceHardening()
  return NextResponse.json({
    status:                    'COMPLIANCE_EVIDENCE_HARDENING',
    evidence_hardening_status: report.evidence_hardening_status,
    compliance_score:          report.compliance_score,
    total_evidence_items:      report.total_evidence_items,
    big4_ready:                report.big4_ready,
    evidence_chain_hash:       report.evidence_chain_hash,
    blocker_count:             report.blockers.length,
    compliance_hash:           report.compliance_hash,
    generated_at:              report.generated_at,
  })
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* body optional */ }
  const tenantId = typeof body['tenant_id'] === 'string' ? body['tenant_id'] : undefined
  const report   = await runComplianceEvidenceHardening(tenantId)
  return NextResponse.json(report)
}
