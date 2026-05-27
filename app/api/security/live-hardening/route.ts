// GET|POST /api/security/live-hardening
// Wave 51 Phase 5 — Live Security Hardening

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { runLiveSecurityHardening } from '@/lib/security/liveSecurityHardening'

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
  const report = await runLiveSecurityHardening()
  return NextResponse.json({
    status:                   'LIVE_SECURITY_HARDENING',
    security_status:          report.security_status,
    security_score:           report.security_score,
    owasp_pass_count:         report.owasp_pass_count,
    owasp_fail_count:         report.owasp_fail_count,
    zero_critical_vulns:      report.zero_critical_vulns,
    zero_open_sev1:           report.zero_open_sev1,
    incident_chain_length:    report.incident_chain.length,
    incident_chain_head_hash: report.incident_chain_head_hash,
    blocker_count:            report.blockers.length,
    security_hash:            report.security_hash,
    generated_at:             report.generated_at,
  })
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* body optional */ }
  const tenantId = typeof body['tenant_id'] === 'string' ? body['tenant_id'] : undefined
  const report   = await runLiveSecurityHardening(tenantId)
  return NextResponse.json(report)
}
