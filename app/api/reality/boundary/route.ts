// Agency Group — Live Reality Boundary Route
// app/api/reality/boundary/route.ts
// Wave 48 GAP 1 — Provider heartbeat, trust decay, SLA verification

import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import log from '@/lib/logger'
import { runLiveRealityBoundaryReport } from '@/lib/reality/liveRealityBoundaryEngine'

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
    const report = await runLiveRealityBoundaryReport(TENANT_ID)
    return NextResponse.json(report)
  } catch (e) {
    log.error('[api/reality/boundary] GET failed', { e: String(e) })
    return NextResponse.json({ error: 'Reality boundary report failed', detail: String(e) }, { status: 500 })
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  if (!bearerOk(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const report = await runLiveRealityBoundaryReport(TENANT_ID)
    return NextResponse.json({
      report_id: report.report_id,
      system_reality_index: report.system_reality_index,
      providers_alive: report.system_reality_index.providers_alive,
      providers_warning: report.system_reality_index.providers_warning,
      providers_critical: report.system_reality_index.providers_critical,
      providers_unconfigured: report.system_reality_index.providers_unconfigured,
      stale_feed_alerts: report.stale_feed_alerts.length,
      fallback_events: report.fallback_events.length,
      reality_label: report.system_reality_index.label,
      assessed_at: report.assessed_at,
    })
  } catch (e) {
    log.error('[api/reality/boundary] POST failed', { e: String(e) })
    return NextResponse.json({ error: 'Reality boundary POST failed', detail: String(e) }, { status: 500 })
  }
}
