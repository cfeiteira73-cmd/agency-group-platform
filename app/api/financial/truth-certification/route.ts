// GET|POST /api/financial/truth-certification
// Wave 52 Phase 3 — Financial Truth Certification (10K synthetic PT/ES transactions)

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { runFinancialTruthCertification } from '@/lib/financial/financialTruthCertification'

export const runtime     = 'nodejs'
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
  const report = await runFinancialTruthCertification()
  return NextResponse.json({
    status:                  'FINANCIAL_TRUTH_CERTIFICATION',
    truth_grade:             report.truth_grade,
    overall_score:           report.overall_score,
    synthetic_tx_count:      report.synthetic_tx_count,
    reconciliation_pct:      report.reconciliation_cert.reconciliation_pct,
    reconciliation_certified:report.reconciliation_cert.certified,
    balance_rate_pct:        report.double_entry_proof.balance_rate_pct,
    idempotency_pct:         report.failure_simulation.idempotency_pct,
    mismatch_detection_pct:  report.failure_simulation.mismatch_detection_pct,
    fee_accuracy_pct:        report.fee_accuracy_pct,
    blockers:                report.blockers,
    certification_hash:      report.certification_hash,
    generated_at:            report.generated_at,
  })
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* body optional */ }
  const tenantId = typeof body['tenant_id'] === 'string' ? body['tenant_id'] : undefined
  const report   = await runFinancialTruthCertification(tenantId)
  return NextResponse.json(report)
}
