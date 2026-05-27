// GET|POST /api/system/absolute-gate
// Wave 50 Phase 7 — Absolute Institutional Reality Gate

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { runAbsoluteInstitutionalRealityGate } from '@/lib/certification/absoluteInstitutionalRealityGate'

export const runtime    = 'nodejs'
export const maxDuration = 120

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
  const cert = await runAbsoluteInstitutionalRealityGate()
  return NextResponse.json({
    status: 'ABSOLUTE_INSTITUTIONAL_REALITY_GATE',
    absolute_status: cert.absolute_status,
    go_live_authorized: cert.go_live_authorized,
    gates_passed: cert.gates_passed,
    gates_total: cert.gates_total,
    combined_score: cert.combined_score,
    final_go_live_hash: cert.final_go_live_hash,
    generated_at: cert.generated_at,
  })
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* body optional */ }
  const tenantId = typeof body.tenant_id === 'string' ? body.tenant_id : undefined

  const cert = await runAbsoluteInstitutionalRealityGate(tenantId)
  return NextResponse.json({
    report_id: cert.report_id,
    tenant_id: cert.tenant_id,
    generated_at: cert.generated_at,
    absolute_status: cert.absolute_status,
    go_live_authorized: cert.go_live_authorized,
    institutional_capital_authorized: cert.institutional_capital_authorized,
    external_audit_authorized: cert.external_audit_authorized,
    gates_passed: cert.gates_passed,
    gates_total: cert.gates_total,
    gates_blocking_failed: cert.gates_blocking_failed,
    gates_warning: cert.gates_warning,
    combined_score: cert.combined_score,
    global_reality_score: cert.global_reality_score,
    wave49_final_status: cert.wave49_final_status,
    wave49_gates_passed: cert.wave49_gates_passed,
    final_go_live_hash: cert.final_go_live_hash,
    absolute_reality_hash: cert.absolute_reality_hash,
    absolute_reality_certificate: cert.absolute_reality_certificate,
    blockers: cert.blockers,
    warnings: cert.warnings,
    activation_checklist: cert.activation_checklist,
  })
}
