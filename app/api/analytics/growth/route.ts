// =============================================================================
// Agency Group — Growth Machine Analytics API
// GET  /api/analytics/growth — growth KPIs, referrals, viral coefficient
// POST /api/analytics/growth — record a referral
// Auth: portal auth required
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { requirePortalAuth } from '@/lib/requirePortalAuth'
import { getGrowthAnalytics, recordReferral } from '@/lib/commercial/growth'
import { getRequestCorrelationId } from '@/lib/observability/correlation'
import log from '@/lib/logger'

export const runtime = 'nodejs'

// ─── GET /api/analytics/growth ────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const check = await requirePortalAuth(req)
  if (!check.ok) return check.response

  const corrId = getRequestCorrelationId(req)
  const { searchParams } = new URL(req.url)
  const days = Math.min(parseInt(searchParams.get('days') || '90', 10), 365)

  try {
    const analytics = await getGrowthAnalytics(days)

    return NextResponse.json(analytics, {
      headers: { 'x-correlation-id': corrId, 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    log.error('[growth] GET error', err instanceof Error ? err : new Error(String(err)), { route: 'api/analytics/growth' })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── POST /api/analytics/growth ───────────────────────────────────────────────

interface RecordReferralBody {
  referrerEmail: string
  referredEmail: string
  source: string
  dealId?: string
}

const VALID_SOURCES = ['client', 'agent', 'partner', 'organic', 'paid', 'direct'] as const

export async function POST(req: NextRequest) {
  const check = await requirePortalAuth(req)
  if (!check.ok) return check.response

  const corrId = getRequestCorrelationId(req)

  try {
    const body = (await req.json()) as Partial<RecordReferralBody>

    if (!body.referrerEmail || !body.referredEmail || !body.source) {
      return NextResponse.json(
        { error: 'referrerEmail, referredEmail and source are required' },
        { status: 400, headers: { 'x-correlation-id': corrId } },
      )
    }

    if (!VALID_SOURCES.includes(body.source as typeof VALID_SOURCES[number])) {
      return NextResponse.json(
        { error: `source must be one of: ${VALID_SOURCES.join(', ')}` },
        { status: 400, headers: { 'x-correlation-id': corrId } },
      )
    }

    await recordReferral(body.referrerEmail, body.referredEmail, body.source, body.dealId)

    return NextResponse.json({ ok: true }, {
      headers: { 'x-correlation-id': corrId },
    })
  } catch (err) {
    log.error('[growth] POST error', err instanceof Error ? err : new Error(String(err)), { route: 'api/analytics/growth' })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
