// Agency Group — Regulatory Assurance Route
// app/api/compliance/regulatory/route.ts
// Wave 47 GAP 4 — GET: SOC2 + ISO27001 readiness report + compliance gates

import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import log from '@/lib/logger'
import { runRegulatoryAssuranceReport } from '@/lib/compliance/regulatoryAssuranceEngine'

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
    const report = await runRegulatoryAssuranceReport(TENANT_ID)
    return NextResponse.json(report)
  } catch (e) {
    log.error('[api/compliance/regulatory] GET failed', { e: String(e) })
    return NextResponse.json({ error: 'Regulatory report failed', detail: String(e) }, { status: 500 })
  }
}
