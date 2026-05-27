// Agency Group — Live Institutional SOC Grid Route
// app/api/security/soc-grid/route.ts
// Wave 49 Phase 3

import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import log from '@/lib/logger'
import { runLiveSocGridReport } from '@/lib/security/liveInstitutionalSocGrid'

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
    return NextResponse.json(await runLiveSocGridReport(TENANT_ID))
  } catch (e) {
    log.error('[api/security/soc-grid] GET failed', { e: String(e) })
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  if (!bearerOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const r = await runLiveSocGridReport(TENANT_ID)
    return NextResponse.json({
      report_id: r.report_id, soc_grid_status: r.soc_grid_status, soc_grid_score: r.soc_grid_score,
      siem_platforms_configured: r.siem_platforms_configured, escalation_chains_active: r.escalation_chains_active,
      unresolved_sev1: r.unresolved_sev1, secrets_overdue: r.secrets_overdue,
      certification_hash: r.soc_certification.certification_hash, assessed_at: r.assessed_at,
    })
  } catch (e) {
    log.error('[api/security/soc-grid] POST failed', { e: String(e) })
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
