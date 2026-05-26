// Agency Group — Live Institutional Truth Gate (Go-Live) Route
// app/api/system/go-live/route.ts
// Wave 48 GAP 6 — 15-condition gate, TRUTH_CERTIFICATION_HASH, INSTITUTIONAL_GO_LIVE_REPORT

import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import log from '@/lib/logger'
import { runLiveInstitutionalTruthGate } from '@/lib/certification/liveInstitutionalTruthGate'

export const runtime = 'nodejs'
export const maxDuration = 120

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
    const report = await runLiveInstitutionalTruthGate(TENANT_ID)
    return NextResponse.json(report)
  } catch (e) {
    log.error('[api/system/go-live] GET failed', { e: String(e) })
    return NextResponse.json({ error: 'Go-live gate failed', detail: String(e) }, { status: 500 })
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  if (!bearerOk(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const report = await runLiveInstitutionalTruthGate(TENANT_ID)
    return NextResponse.json({
      report_id: report.report_id,
      system_live_status: report.system_live_status,
      institutional_go_live: report.institutional_go_live,
      live_gates_passed: report.live_gates_passed,
      live_gates_total: report.live_gates_total,
      wave47_gates_passed: report.wave47_gates_passed,
      wave47_gates_total: report.wave47_gates_total,
      truth_certification_hash: report.truth_certification?.truth_certification_hash ?? null,
      truth_certification: report.truth_certification,
      pre_live_blockers: report.pre_live_blockers,
      pre_live_warnings: report.pre_live_warnings,
      sha256_truth_hash: report.sha256_truth_hash,
      generated_at: report.generated_at,
    })
  } catch (e) {
    log.error('[api/system/go-live] POST failed', { e: String(e) })
    return NextResponse.json({ error: 'Go-live POST failed', detail: String(e) }, { status: 500 })
  }
}
