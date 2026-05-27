// Agency Group — Live Institutional Command Center Route
// app/api/operations/command-center/route.ts
// Wave 49 Phase 6

import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import log from '@/lib/logger'
import { runLiveCommandCenter } from '@/lib/operations/liveInstitutionalCommandCenter'

export const runtime = 'nodejs'
export const maxDuration = 120

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
    return NextResponse.json(await runLiveCommandCenter(TENANT_ID))
  } catch (e) {
    log.error('[api/operations/command-center] GET failed', { e: String(e) })
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  if (!bearerOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const r = await runLiveCommandCenter(TENANT_ID)
    return NextResponse.json({
      snapshot_id: r.snapshot_id, global_operational_score: r.global_operational_score,
      operational_readiness: r.operational_readiness, domain_scores: r.domain_scores,
      risk_heatmap: r.risk_heatmap, predictive_alerts: r.predictive_alerts.length,
      investor_confidence_score: r.investor_confidence_score,
      liquidity_confidence_score: r.liquidity_confidence_score,
      snapshot_hash: r.snapshot_hash, captured_at: r.captured_at,
    })
  } catch (e) {
    log.error('[api/operations/command-center] POST failed', { e: String(e) })
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
