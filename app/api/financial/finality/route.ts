// Agency Group — Financial Finality Route
// app/api/financial/finality/route.ts
// Wave 47 GAP 2 — GET: finality report | POST: generate audit package

import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import log from '@/lib/logger'
import {
  runFinalityReport,
  generateAuditPackage,
} from '@/lib/financial/financialFinalityEngine'

export const runtime = 'nodejs'
export const maxDuration = 60

const TENANT_ID =
  process.env.DEFAULT_TENANT_ID ??
  process.env.SYSTEM_ORG_ID ??
  '00000000-0000-0000-0000-000000000001'

function bigintReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? value.toString() : value
}

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
    const report = await runFinalityReport(TENANT_ID)
    return new NextResponse(JSON.stringify(report, bigintReplacer), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    log.error('[api/financial/finality] GET failed', { e: String(e) })
    return NextResponse.json({ error: 'Finality report failed', detail: String(e) }, { status: 500 })
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  if (!bearerOk(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const periodDays = typeof body.period_days === 'number' ? body.period_days : 30
    const pkg = await generateAuditPackage(TENANT_ID, periodDays)
    return new NextResponse(JSON.stringify(pkg, bigintReplacer), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    log.error('[api/financial/finality] POST failed', { e: String(e) })
    return NextResponse.json({ error: 'Audit package generation failed', detail: String(e) }, { status: 500 })
  }
}
