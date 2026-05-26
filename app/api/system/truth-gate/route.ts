// Agency Group — Institutional Truth Gate Route
// app/api/system/truth-gate/route.ts
// Wave 47 Final Gate — 9-condition institutional truth verification

import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import log from '@/lib/logger'
import { runInstitutionalTruthGate } from '@/lib/certification/institutionalTruthGate'

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
    const report = await runInstitutionalTruthGate(TENANT_ID)
    return NextResponse.json(report)
  } catch (e) {
    log.error('[api/system/truth-gate] GET failed', { e: String(e) })
    return NextResponse.json({ error: 'Truth gate failed', detail: String(e) }, { status: 500 })
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  if (!bearerOk(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const report = await runInstitutionalTruthGate(TENANT_ID)
    return NextResponse.json({
      system_truth_status: report.system_truth_status,
      overall_score: report.overall_score,
      gates_passed: report.gates_passed,
      gates_total: report.gates_total,
      institutional_access_granted: report.institutional_access_granted,
      fund_access_granted: report.fund_access_granted,
      wave47_complete: report.wave47_complete,
      sha256_truth_hash: report.sha256_truth_hash,
      issues: report.issues,
      report_id: report.report_id,
    })
  } catch (e) {
    log.error('[api/system/truth-gate] POST failed', { e: String(e) })
    return NextResponse.json({ error: 'Truth gate POST failed', detail: String(e) }, { status: 500 })
  }
}
