// Agency Group — Live Settlement Reality Route
// app/api/financial/settlement/route.ts
// Wave 48 GAP 2 — Bank statement ingestion, mismatch detection, orphan capital, chargebacks

import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import log from '@/lib/logger'
import { runLiveSettlementReport } from '@/lib/financial/liveSettlementRealityEngine'

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
    const report = await runLiveSettlementReport(TENANT_ID)
    return NextResponse.json(report)
  } catch (e) {
    log.error('[api/financial/settlement] GET failed', { e: String(e) })
    return NextResponse.json({ error: 'Settlement report failed', detail: String(e) }, { status: 500 })
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  if (!bearerOk(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const report = await runLiveSettlementReport(TENANT_ID)
    return NextResponse.json({
      report_id: report.report_id,
      consistency_grade: report.consistency_grade,
      mismatch_count: report.mismatch_count,
      critical_mismatch_count: report.critical_mismatch_count,
      total_mismatch_eur: report.total_mismatch_eur,
      total_orphan_eur: report.total_orphan_eur,
      chargeback_count: report.chargeback_count,
      reconciliation_accuracy_pct: report.reconciliation_accuracy_pct,
      bank_confirmed_count: report.bank_confirmed_count,
      financial_consistency_score: report.financial_consistency_score,
      assessed_at: report.assessed_at,
    })
  } catch (e) {
    log.error('[api/financial/settlement] POST failed', { e: String(e) })
    return NextResponse.json({ error: 'Settlement POST failed', detail: String(e) }, { status: 500 })
  }
}
