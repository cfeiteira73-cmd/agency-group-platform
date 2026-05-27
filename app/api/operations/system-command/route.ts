// GET|POST /api/operations/system-command
// Wave 51 Phase 9 — Full System Operational Command Center

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { runFullSystemOperationalCommandCenter } from '@/lib/operations/fullSystemOperationalCommandCenter'

export const runtime    = 'nodejs'
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
  const report = await runFullSystemOperationalCommandCenter()
  return NextResponse.json({
    status:                'FULL_SYSTEM_COMMAND_CENTER',
    command_status:        report.command_status,
    blended_score:         report.blended_score,
    w51_score:             report.w51_score,
    w50_score:             report.w50_score,
    system_hardening:      report.system_hardening_status,
    risk_level:            report.risk_summary.risk_level,
    total_blockers:        report.risk_summary.total_blockers,
    providers_operational: report.providers_operational,
    capital_integrity:     report.capital_integrity_proven,
    security_certified:    report.security_certified,
    resilience_certified:  report.resilience_certified,
    command_hash:          report.command_hash,
    generated_at:          report.generated_at,
  })
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* body optional */ }
  const tenantId = typeof body['tenant_id'] === 'string' ? body['tenant_id'] : undefined
  const report   = await runFullSystemOperationalCommandCenter(tenantId)
  return NextResponse.json(report)
}
