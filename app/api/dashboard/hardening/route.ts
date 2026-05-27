// GET|POST /api/dashboard/hardening
// Wave 51 Phase 2 — Absolute Dashboard Hardening

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { runAbsoluteDashboardHardening } from '@/lib/dashboard/absoluteDashboardHardening'

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
  const report = await runAbsoluteDashboardHardening()
  return NextResponse.json({
    status:            'DASHBOARD_HARDENING',
    hardening_status:  report.hardening_status,
    overall_score:     report.overall_score,
    panels_operational: report.panels_operational,
    panels_degraded:   report.panels_degraded,
    panels_offline:    report.panels_offline,
    critical_issue_count: report.critical_issues.length,
    hardening_hash:    report.hardening_hash,
    generated_at:      report.generated_at,
  })
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* body optional */ }
  const tenantId = typeof body['tenant_id'] === 'string' ? body['tenant_id'] : undefined
  const report   = await runAbsoluteDashboardHardening(tenantId)
  return NextResponse.json(report)
}
