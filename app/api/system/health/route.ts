// GET /api/system/health
// Wave 53 — Critical Health Monitor endpoint
// Returns real-time health state of all critical providers
// Auth: Bearer INTERNAL_API_SECRET

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { runCriticalHealthMonitor } from '@/lib/system/criticalHealthMonitor'

export const runtime     = 'nodejs'
export const dynamic     = 'force-dynamic'
export const maxDuration = 30

function authorized(req: NextRequest): boolean {
  const secret = process.env.INTERNAL_API_SECRET
  if (!secret) return false
  const header = req.headers.get('authorization') ?? ''
  const token  = header.replace(/^Bearer\s+/i, '')
  try { return timingSafeEqual(Buffer.from(token), Buffer.from(secret)) }
  catch { return false }
}

export async function GET(req: NextRequest) {
  // Public lightweight check (no auth needed — returns only pass/fail)
  const isInternal = authorized(req)
  const report     = await runCriticalHealthMonitor({ sendAlert: false })

  if (isInternal) {
    // Full report with all issue details
    return NextResponse.json(report, {
      status: report.healthy ? 200 : 503,
    })
  }

  // Public: minimal status only
  return NextResponse.json({
    status:      report.healthy ? 'HEALTHY' : 'DEGRADED',
    stripe_mode: report.stripe_mode,
    checked_at:  report.checked_at,
  }, {
    status: report.healthy ? 200 : 503,
  })
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // Full check with email alert
  const report = await runCriticalHealthMonitor({ sendAlert: true })
  return NextResponse.json(report, { status: report.healthy ? 200 : 503 })
}
