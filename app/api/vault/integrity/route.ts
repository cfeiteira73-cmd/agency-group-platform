// app/api/vault/integrity/route.ts
// GET /api/vault/integrity — returns current vault integrity scores
// Auth: Bearer INTERNAL_API_SECRET or valid NextAuth session with manage_vault permission

import { NextRequest, NextResponse } from 'next/server'
import { computeIntegrityScores } from '@/lib/vault/integrityChecker'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Auth: check Bearer token
  const auth = req.headers.get('authorization') ?? ''
  const secret = process.env.INTERNAL_API_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    // Also allow cron calls via CRON_SECRET
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const scores = await computeIntegrityScores()
    const status = scores.overall >= 95 ? 'healthy' : scores.overall >= 80 ? 'warning' : 'critical'

    return NextResponse.json({
      status,
      scores,
      threshold: 95,
      breach: scores.overall < 95,
    }, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    return NextResponse.json({ error: 'Integrity check failed', detail: String(err) }, { status: 500 })
  }
}
