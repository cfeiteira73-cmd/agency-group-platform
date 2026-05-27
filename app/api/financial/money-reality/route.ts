// GET|POST /api/financial/money-reality
// Wave 50 Phase 2 — Live Money Reality Engine

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { runLiveMoneyRealityEngine } from '@/lib/financial/liveMoneyRealityEngine'

export const runtime    = 'nodejs'
export const maxDuration = 60

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
  const report = await runLiveMoneyRealityEngine()
  return NextResponse.json({
    status: 'LIVE_MONEY_REALITY_ENGINE',
    money_reality_grade: report.money_reality_grade,
    money_reality_score: report.money_reality_score,
    reconciliation_accuracy_pct: report.reconciliation_accuracy_pct,
    reconciliation_target_met: report.reconciliation_target_met,
    orphan_capital_blocker: report.orphan_capital_blocker,
    simulated_marked_real_violations: report.simulated_marked_real_violations,
    blockers_count: report.blockers.length,
    assessed_at: report.assessed_at,
  })
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* body optional */ }
  const tenantId = typeof body.tenant_id === 'string' ? body.tenant_id : undefined

  const report = await runLiveMoneyRealityEngine(tenantId)
  return NextResponse.json({
    report_id: report.report_id,
    tenant_id: report.tenant_id,
    assessed_at: report.assessed_at,
    money_reality_grade: report.money_reality_grade,
    money_reality_score: report.money_reality_score,
    total_real_money_eur: report.total_real_money_eur,
    bank_confirmed_total_eur: report.bank_confirmed_total_eur,
    simulated_marked_real_violations: report.simulated_marked_real_violations,
    reconciliation_accuracy_pct: report.reconciliation_accuracy_pct,
    reconciliation_target_pct: report.reconciliation_target_pct,
    reconciliation_target_met: report.reconciliation_target_met,
    reconciliation_blockers: report.reconciliation_blockers,
    deposits_verified: report.deposits_verified,
    settlements_verified: report.settlements_verified,
    chargebacks_open: report.chargebacks_open,
    orphan_capital_count: report.orphan_capital_count,
    orphan_capital_total_eur: report.orphan_capital_total_eur,
    orphan_capital_blocker: report.orphan_capital_blocker,
    duplicate_payment_count: report.duplicate_payment_count,
    escrow_active_count: report.escrow_active_count,
    escrow_warning_count: report.escrow_warning_count,
    ledger_balance_status: report.ledger_balance_status,
    ledger_hash: report.ledger_hash,
    replay_total_replayed: report.replay_verification.total_replayed,
    replay_chain_hash: report.replay_verification.replay_chain_hash,
    wave49_financial_truth_score: report.wave49_financial_truth_score,
    blockers: report.blockers,
    issues: report.issues,
    recommendations: report.recommendations,
  })
}
