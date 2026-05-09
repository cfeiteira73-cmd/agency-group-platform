// =============================================================================
// Agency Group — Win/Loss Analytics API
// GET  /api/analytics/win-loss — aggregated win/loss metrics
// POST /api/analytics/win-loss — record a win/loss event
// Auth: portal auth required
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { requirePortalAuth } from '@/lib/requirePortalAuth'
import { getWinLossAnalytics, recordWinLoss } from '@/lib/commercial/winLoss'
import { getRequestCorrelationId } from '@/lib/observability/correlation'
import log from '@/lib/logger'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const check = await requirePortalAuth(req)
  if (!check.ok) return check.response

  const corrId = getRequestCorrelationId(req)
  const { searchParams } = new URL(req.url)
  const days = Math.min(parseInt(searchParams.get('days') || '90'), 365)
  const agentEmail = searchParams.get('agent') || undefined

  try {
    const analytics = await getWinLossAnalytics(days, agentEmail)

    return NextResponse.json(analytics, {
      headers: { 'x-correlation-id': corrId, 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    log.error('[win-loss] GET error', err instanceof Error ? err : new Error(String(err)), { route: 'api/analytics/win-loss' })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

const VALID_OUTCOMES = ['won', 'lost', 'stalled', 'withdrawn'] as const
type WinLossOutcome = typeof VALID_OUTCOMES[number]

interface WinLossBody {
  deal_id?: string
  contact_id?: string
  agent_id: string
  outcome: WinLossOutcome
  reason_category: string
  reason_detail?: string
  objection_type?: string
  deal_value?: number
  commission_lost?: number
  days_in_pipeline?: number
  stage_lost?: string
  notes?: string
}

export async function POST(req: NextRequest) {
  const check = await requirePortalAuth(req)
  if (!check.ok) return check.response

  const corrId = getRequestCorrelationId(req)

  try {
    const body = await req.json() as WinLossBody

    if (!body.agent_id || !body.outcome || !body.reason_category) {
      return NextResponse.json(
        { error: 'agent_id, outcome, reason_category required' },
        { status: 400 },
      )
    }

    if (!(VALID_OUTCOMES as readonly string[]).includes(body.outcome)) {
      return NextResponse.json(
        { error: `outcome must be one of: ${VALID_OUTCOMES.join(', ')}` },
        { status: 400 },
      )
    }

    await recordWinLoss({
      deal_id:          body.deal_id ?? null,
      contact_id:       body.contact_id ?? null,
      agent_id:         body.agent_id,
      outcome:          body.outcome,
      reason_category:  body.reason_category,
      reason_detail:    body.reason_detail ?? null,
      objection_type:   body.objection_type ?? null,
      deal_value:       body.deal_value ?? null,
      commission_lost:  body.commission_lost ?? null,
      days_in_pipeline: body.days_in_pipeline ?? null,
      stage_lost:       body.stage_lost ?? null,
      notes:            body.notes ?? null,
    })

    log.info('[win-loss] Event recorded', {
      route: 'api/analytics/win-loss',
      outcome: body.outcome,
      agent_email: body.agent_id,
    })

    return NextResponse.json({ success: true }, {
      status: 201,
      headers: { 'x-correlation-id': corrId },
    })
  } catch (err) {
    log.error('[win-loss] POST error', err instanceof Error ? err : new Error(String(err)), { route: 'api/analytics/win-loss' })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
