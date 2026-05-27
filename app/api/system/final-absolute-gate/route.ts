// GET|POST /api/system/final-absolute-gate
// Wave 51 Phase 10 — Final Absolute Certification Gate
// 30-gate system: Wave 50 (24) + Wave 51 (6)
// Target: FULLY_HARDENED_INSTITUTIONAL_REAL_ESTATE_CAPITAL_OPERATING_SYSTEM

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { runFinalAbsoluteCertificationGate } from '@/lib/certification/finalAbsoluteCertificationGate'

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
  const report = await runFinalAbsoluteCertificationGate()
  return NextResponse.json({
    status:                          'FINAL_ABSOLUTE_CERTIFICATION_GATE',
    final_system_status:             report.final_system_status,
    go_live_authorized:              report.go_live_authorized,
    institutional_capital_authorized: report.institutional_capital_authorized,
    total_gates_passed:              report.total_gates_passed,
    total_gates:                     report.total_gates,
    gate_pass_pct:                   report.gate_pass_pct,
    blended_system_score:            report.blended_system_score,
    w50_absolute_status:             report.w50_absolute_status,
    w51_hardening_status:            report.w51_hardening_status,
    blocker_count:                   report.blockers.length,
    final_truth_hash:                report.final_truth_hash,
    generated_at:                    report.generated_at,
  })
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* body optional */ }
  const tenantId = typeof body['tenant_id'] === 'string' ? body['tenant_id'] : undefined
  const report   = await runFinalAbsoluteCertificationGate(tenantId)
  return NextResponse.json(report)
}
