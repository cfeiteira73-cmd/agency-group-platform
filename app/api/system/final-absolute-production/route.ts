// GET|POST /api/system/final-absolute-production
// Wave 52 Phase 9 — Final Absolute Production Certification (39 gates)
// Target: FULLY_OPERATIONAL_GLOBAL_INSTITUTIONAL_REAL_ESTATE_CAPITAL_OPERATING_SYSTEM

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { runFinalAbsoluteProductionCertification } from '@/lib/certification/finalAbsoluteProductionCertification'

export const runtime     = 'nodejs'
export const maxDuration = 300

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
  const report = await runFinalAbsoluteProductionCertification()
  return NextResponse.json({
    status:               'FINAL_ABSOLUTE_PRODUCTION_CERTIFICATION',
    final_status:         report.final_status,
    overall_blended_score: report.overall_blended_score,
    total_gates:          report.certificate.total_gates,
    gates_passed:         report.certificate.gates_passed,
    gates_failed:         report.certificate.gates_failed,
    gate_pass_pct:        report.certificate.gate_pass_pct,
    w52_gates_passed:     report.certificate.w52_gates_passed,
    go_live_authorized:   report.certificate.go_live_authorized,
    blockers:             report.blockers,
    warnings:             report.warnings,
    production_hash:      report.production_hash,
    cert_valid_until:     report.certificate.valid_until,
    generated_at:         report.generated_at,
  })
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* body optional */ }
  const tenantId = typeof body['tenant_id'] === 'string' ? body['tenant_id'] : undefined
  const report   = await runFinalAbsoluteProductionCertification(tenantId)
  return NextResponse.json(report)
}
