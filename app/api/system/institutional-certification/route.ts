// app/api/system/institutional-certification/route.ts
// GET  /api/system/institutional-certification — latest Wave 46 institutional cert
// POST /api/system/institutional-certification — Bearer auth required; run full cert
// TypeScript strict — 0 errors

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import log from '@/lib/logger'
import {
  runInstitutionalCertification,
  getLatestInstitutionalCertification,
} from '@/lib/certification/institutionalCertification'

export const runtime = 'nodejs'
export const maxDuration = 60

const TENANT_ID =
  process.env.DEFAULT_TENANT_ID ??
  process.env.SYSTEM_ORG_ID ??
  '00000000-0000-0000-0000-000000000001'

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'))
  } catch {
    return false
  }
}

function requireBearer(req: NextRequest): boolean {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  const expected = process.env.INTERNAL_API_SECRET ?? process.env.CRON_SECRET ?? ''
  if (!expected) return false
  return safeCompare(token, expected)
}

export async function GET(): Promise<NextResponse> {
  try {
    const latest = await getLatestInstitutionalCertification(TENANT_ID)
    return NextResponse.json({
      checked_at: new Date().toISOString(),
      latest,
      system_status: latest?.system_status ?? 'NOT_RUN',
      overall_score: latest?.overall_score ?? 0,
      wave: 46,
    })
  } catch (e) {
    log.warn('[api/system/institutional-certification] GET error', { e: String(e) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!requireBearer(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runInstitutionalCertification(TENANT_ID)
    return NextResponse.json(result)
  } catch (e) {
    log.warn('[api/system/institutional-certification] POST error', { e: String(e) })
    return NextResponse.json({ error: 'Certification failed' }, { status: 500 })
  }
}
