// AGENCY GROUP — Product API: Revenue | AMI: 22506
// GET /api/product/revenue?org_id=xxx&period=mtd
// Returns revenue snapshot, funnel, daily target, attribution
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { isPortalAuth } from '@/lib/portalAuth'
import { revenueOutcomeMapper, businessPrimitiveEngine } from '@/lib/product'
import { getRequestCorrelationId } from '@/lib/observability/correlation'

export const runtime = 'nodejs'
export const revalidate = 0

export async function GET(req: NextRequest) {
  const correlation_id = getRequestCorrelationId(req)

  try {
    const session = await auth()
    const portal  = await isPortalAuth(req)
    if (!session && !portal) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const org_id = searchParams.get('org_id') ?? 'default'
    const period = (searchParams.get('period') as 'today' | 'mtd' | 'ytd' | 'last_30d') ?? 'mtd'

    const [funnel, daily_target, snapshot] = await Promise.all([
      revenueOutcomeMapper.buildFunnel(org_id, period),
      revenueOutcomeMapper.getDailyTarget(org_id),
      businessPrimitiveEngine.getRevenueSnapshot(org_id, period),
    ])

    return NextResponse.json({ funnel, daily_target, snapshot, period, org_id }, {
      headers: { 'X-Correlation-ID': correlation_id, 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    return NextResponse.json(
      { error: 'Revenue data failed', detail: String(err), correlation_id },
      { status: 500 }
    )
  }
}

// POST — record a deal outcome (close or loss)
export async function POST(req: NextRequest) {
  const correlation_id = getRequestCorrelationId(req)

  try {
    const session = await auth()
    const portal  = await isPortalAuth(req)
    if (!session && !portal) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json() as {
      org_id:        string
      agent_id?:     string
      deal_id:       string
      won:           boolean
      final_value:   number
      days_to_close?: number
    }

    if (!body.org_id || !body.deal_id || typeof body.won !== 'boolean') {
      return NextResponse.json(
        { error: 'org_id, deal_id, and won are required' },
        { status: 400 }
      )
    }

    // Map the revenue event
    const event = revenueOutcomeMapper.mapEvent({
      org_id:      body.org_id,
      event_type:  body.won ? 'deal_closed_won' : 'deal_closed_lost',
      entity_id:   body.deal_id,
      gross_value: body.final_value,
    })

    // Invalidate pipeline cache
    businessPrimitiveEngine.invalidateCache(body.org_id)

    return NextResponse.json({ event, recorded: true }, {
      headers: { 'X-Correlation-ID': correlation_id },
    })
  } catch (err) {
    return NextResponse.json(
      { error: 'Outcome recording failed', detail: String(err), correlation_id },
      { status: 500 }
    )
  }
}
