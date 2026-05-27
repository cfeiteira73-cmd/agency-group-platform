// Agency Group — Live Institutional Settlement Core Route
// app/api/banking/settlement-core/route.ts
// Wave 49 Phase 2

import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import log from '@/lib/logger'
import { runLiveSettlementCoreReport } from '@/lib/banking/liveInstitutionalSettlementCore'

export const runtime = 'nodejs'
export const maxDuration = 60

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
    return NextResponse.json(await runLiveSettlementCoreReport(TENANT_ID))
  } catch (e) {
    log.error('[api/banking/settlement-core] GET failed', { e: String(e) })
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  if (!bearerOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const r = await runLiveSettlementCoreReport(TENANT_ID)
    return NextResponse.json({
      report_id: r.report_id, financial_truth_score: r.financial_truth_score,
      financial_truth_grade: r.financial_truth_grade, bank_confirmed_count: r.bank_confirmed_count,
      reconciliation_accuracy_pct: r.reconciliation_accuracy_pct, reconciliation_target_met: r.reconciliation_target_met,
      orphan_capital_critical: r.orphan_capital_critical, duplicate_settlements_detected: r.duplicate_settlements_detected,
      rails_configured: r.rails_configured, settlement_chain_hash: r.settlement_chain_hash, assessed_at: r.assessed_at,
    })
  } catch (e) {
    log.error('[api/banking/settlement-core] POST failed', { e: String(e) })
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
