// Agency Group — Resilience Chaos Route
// app/api/resilience/chaos/route.ts
// Wave 47 GAP 5 — GET: resilience truth report | POST: run chaos gauntlet

import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import log from '@/lib/logger'
import { runResilienceTruthReport } from '@/lib/resilience/resilienceTruthEngine'

export const runtime = 'nodejs'
export const maxDuration = 120

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
    // GET: report without running chaos (reads last gauntlet from DB)
    const report = await runResilienceTruthReport(TENANT_ID, false)
    return NextResponse.json(report)
  } catch (e) {
    log.error('[api/resilience/chaos] GET failed', { e: String(e) })
    return NextResponse.json({ error: 'Resilience report failed', detail: String(e) }, { status: 500 })
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  if (!bearerOk(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    // POST: run full chaos gauntlet (dry-run unless CHAOS_TESTING_ENABLED=true)
    const report = await runResilienceTruthReport(TENANT_ID, true)
    return NextResponse.json(report)
  } catch (e) {
    log.error('[api/resilience/chaos] POST failed', { e: String(e) })
    return NextResponse.json({ error: 'Chaos gauntlet failed', detail: String(e) }, { status: 500 })
  }
}
