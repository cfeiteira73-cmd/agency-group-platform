// Agency Group — Live Security Operations Center Route
// app/api/security/live-soc/route.ts
// Wave 48 GAP 3 — PagerDuty/Opsgenie routing, impossible-travel, abnormal capital, key rotation

import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import log from '@/lib/logger'
import { runLiveSocReport } from '@/lib/security/liveSecurityOperationsCenter'

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
    const report = await runLiveSocReport(TENANT_ID)
    return NextResponse.json(report)
  } catch (e) {
    log.error('[api/security/live-soc] GET failed', { e: String(e) })
    return NextResponse.json({ error: 'Live SOC report failed', detail: String(e) }, { status: 500 })
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  if (!bearerOk(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const report = await runLiveSocReport(TENANT_ID)
    return NextResponse.json({
      report_id: report.report_id,
      operational_security_score: report.operational_security_score,
      open_sev1_count: report.open_sev1_count,
      open_sev2_count: report.open_sev2_count,
      impossible_travel_alerts: report.impossible_travel_alerts.length,
      abnormal_capital_alerts: report.abnormal_capital_alerts.length,
      keys_overdue: report.keys_overdue,
      forensic_snapshots: report.forensic_snapshots.length,
      pagerduty_configured: report.pagerduty_configured,
      assessed_at: report.assessed_at,
    })
  } catch (e) {
    log.error('[api/security/live-soc] POST failed', { e: String(e) })
    return NextResponse.json({ error: 'Live SOC POST failed', detail: String(e) }, { status: 500 })
  }
}
