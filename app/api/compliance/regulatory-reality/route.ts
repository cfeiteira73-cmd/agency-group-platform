// Agency Group — Institutional Regulatory Reality System Route
// app/api/compliance/regulatory-reality/route.ts
// Wave 49 Phase 4 — SOC2 Type II + ISO27001:2022 + Big4 export + pentest governance

import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import log from '@/lib/logger'
import { runRegulatoryRealitySystem } from '@/lib/compliance/institutionalRegulatoryRealitySystem'

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
    return NextResponse.json(await runRegulatoryRealitySystem(TENANT_ID))
  } catch (e) {
    log.error('[api/compliance/regulatory-reality] GET failed', { e: String(e) })
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  if (!bearerOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const r = await runRegulatoryRealitySystem(TENANT_ID)
    return NextResponse.json({
      report_id: r.report_id, regulatory_readiness: r.regulatory_readiness, regulatory_score: r.regulatory_score,
      soc2_score: r.soc2_score, soc2_target_met: r.soc2_target_met,
      iso27001_score: r.iso27001_score, iso27001_target_met: r.iso27001_target_met,
      pentest_blocker: r.pentest_governance.blocker, big4_ready: r.big4_export.big4_ready,
      chain_of_custody_hash: r.chain_of_custody_hash, assessed_at: r.assessed_at,
    })
  } catch (e) {
    log.error('[api/compliance/regulatory-reality] POST failed', { e: String(e) })
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
