// Agency Group — Final Institutional Go-Live Gate Route
// app/api/system/final-gate/route.ts
// Wave 49 Phase 7 — Definitive go/no-go

import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import log from '@/lib/logger'
import { runFinalInstitutionalGoLiveGate } from '@/lib/certification/finalInstitutionalGoLiveGate'

export const runtime = 'nodejs'
export const maxDuration = 120

const TENANT_ID = process.env.DEFAULT_TENANT_ID ?? process.env.SYSTEM_ORG_ID ?? '00000000-0000-0000-0000-000000000001'

function bearerOk(req: Request): boolean {
  const secret = process.env.INTERNAL_API_SECRET
  if (!secret) return false
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token || token.length !== secret.length) return false
  try { return timingSafeEqual(Buffer.from(token), Buffer.from(secret)) } catch { return false }
}

export async function GET(req: Request): Promise<NextResponse> {
  if (!bearerOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    return NextResponse.json(await runFinalInstitutionalGoLiveGate(TENANT_ID))
  } catch (e) {
    log.error('[api/system/final-gate] GET failed', { e: String(e) })
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  if (!bearerOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const r = await runFinalInstitutionalGoLiveGate(TENANT_ID)
    return NextResponse.json({
      report_id: r.report_id, final_system_status: r.final_system_status,
      go_live_authorized: r.go_live_authorized, institutional_capital_authorized: r.institutional_capital_authorized,
      gates_passed: r.gates_passed, gates_total: r.gates_total,
      gates_blocking_failed: r.gates_blocking_failed, combined_score: r.combined_score,
      global_operational_score: r.global_operational_score,
      go_live_truth_hash: r.go_live_truth_hash, sha256_certification_hash: r.sha256_certification_hash,
      operational_reality_certificate: r.operational_reality_certificate,
      blockers: r.blockers, activation_steps: r.activation_steps.slice(0, 5),
      generated_at: r.generated_at,
    })
  } catch (e) {
    log.error('[api/system/final-gate] POST failed', { e: String(e) })
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
