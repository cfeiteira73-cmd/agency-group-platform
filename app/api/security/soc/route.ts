// Agency Group — Security Operations Center Route
// app/api/security/soc/route.ts
// Wave 47 GAP 3 — GET: SOC report | POST: run OWASP simulations

import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import log from '@/lib/logger'
import { runSocReport } from '@/lib/security/securityOperationsCenterLayer'

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
    const report = await runSocReport(TENANT_ID)
    return NextResponse.json(report)
  } catch (e) {
    log.error('[api/security/soc] GET failed', { e: String(e) })
    return NextResponse.json({ error: 'SOC report failed', detail: String(e) }, { status: 500 })
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  if (!bearerOk(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    // POST re-runs the SOC report with fresh OWASP simulations
    const report = await runSocReport(TENANT_ID)
    return NextResponse.json({ message: 'SOC report generated', report_id: report.report_id, soc_readiness_score: report.soc_readiness_score, attack_detection_rate_pct: report.attack_detection_rate_pct })
  } catch (e) {
    log.error('[api/security/soc] POST failed', { e: String(e) })
    return NextResponse.json({ error: 'SOC simulation failed', detail: String(e) }, { status: 500 })
  }
}
