// GET|POST /api/capital/execution-hardening
// Wave 51 Phase 3 — Capital Execution Hardening

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { runCapitalExecutionHardening } from '@/lib/capital/capitalExecutionHardening'

export const runtime    = 'nodejs'
export const maxDuration = 60

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
  const report = await runCapitalExecutionHardening()
  return NextResponse.json({
    status:                    'CAPITAL_EXECUTION_HARDENING',
    certification_status:      report.certification_status,
    capital_execution_score:   report.capital_execution_score,
    reconciliation_accuracy:   report.reconciliation_accuracy_pct,
    idempotency_coverage_pct:  report.idempotency_coverage_pct,
    zero_orphan_capital:       report.zero_orphan_capital,
    zero_duplicate_payments:   report.zero_duplicate_payments,
    blocker_count:             report.blockers.length,
    capital_integrity_hash:    report.capital_integrity_hash,
    generated_at:              report.generated_at,
  })
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* body optional */ }
  const tenantId = typeof body['tenant_id'] === 'string' ? body['tenant_id'] : undefined
  const report   = await runCapitalExecutionHardening(tenantId)
  return NextResponse.json(report)
}
