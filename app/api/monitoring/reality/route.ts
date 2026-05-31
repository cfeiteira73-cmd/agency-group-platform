// GET|POST /api/monitoring/reality
// Wave 54 Phase 1 — Autonomous Reality Monitor

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { runRealityMonitor } from '@/lib/monitoring/realityMonitor'

export const runtime     = 'nodejs'
export const dynamic     = 'force-dynamic'
export const maxDuration = 30

function authorized(req: NextRequest): boolean {
  const secret = process.env.INTERNAL_API_SECRET
  if (!secret) return false
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  try { return timingSafeEqual(Buffer.from(token), Buffer.from(secret)) }
  catch { return false }
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const report = await runRealityMonitor()
  return NextResponse.json({
    status:                       'REALITY_MONITOR',
    reality_score:                report.reality_score,
    system_health_score:          report.system_health_score,
    operational_readiness_score:  report.operational_readiness_score,
    pass_count:   report.pass_count,
    warn_count:   report.warn_count,
    fail_count:   report.fail_count,
    total_checks: report.total_checks,
    blockers:     report.blockers,
    monitor_hash: report.monitor_hash,
    generated_at: report.generated_at,
  }, { status: report.fail_count > 0 ? 503 : 200 })
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /**/ }
  const tenantId = typeof body['tenant_id'] === 'string' ? body['tenant_id'] : undefined
  const report   = await runRealityMonitor(tenantId)
  return NextResponse.json(report, { status: report.fail_count > 0 ? 503 : 200 })
}
