// Agency Group — Live Provider Operations Mesh Route
// app/api/providers/mesh/route.ts
// Wave 49 Phase 1

import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import log from '@/lib/logger'
import { runLiveProviderMeshReport } from '@/lib/providers/liveProviderOperationsMesh'

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
    return NextResponse.json(await runLiveProviderMeshReport(TENANT_ID))
  } catch (e) {
    log.error('[api/providers/mesh] GET failed', { e: String(e) })
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  if (!bearerOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const report = await runLiveProviderMeshReport(TENANT_ID)
    return NextResponse.json({
      report_id: report.report_id,
      provider_truth_index: report.provider_truth_index,
      provider_truth_label: report.provider_truth_label,
      providers_healthy: report.providers_healthy,
      providers_unconfigured: report.providers_unconfigured,
      active_fallbacks: report.active_fallbacks.length,
      stale_alerts: report.stale_alerts.length,
      base_provider_health_score: report.base_provider_health_score,
      assessed_at: report.assessed_at,
    })
  } catch (e) {
    log.error('[api/providers/mesh] POST failed', { e: String(e) })
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
