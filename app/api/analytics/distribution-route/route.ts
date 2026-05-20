// POST /api/analytics/distribution-route
// Runs the distribution router for a given property and returns the
// recommended agent/investor recipients. Does NOT send — just recommends.
// Optionally persists the distribution event for audit trail.

import { NextRequest, NextResponse } from 'next/server'
import { requireServiceAuth }        from '@/lib/auth/serviceAuth'
import { getToken }                  from 'next-auth/jwt'
import { routeDeal, persistDistributionEvent } from '@/lib/intelligence/distributionRouter'
import type {
  PropertyForRouting,
  AgentForRouting,
  InvestorForRouting,
} from '@/lib/intelligence/distributionRouter'
import { getRequestCorrelationId } from '@/lib/observability/correlation'

export const runtime = 'nodejs'

interface RouteBody {
  property:  PropertyForRouting
  agents:    AgentForRouting[]
  investors: InvestorForRouting[]
  persist?:  boolean   // default false — set true to write distribution_events row
}

export async function POST(req: NextRequest) {
  const corrId = getRequestCorrelationId(req)
  // Auth: session or internal token
  const serviceCheck = await requireServiceAuth(req)
  const isInternal   = serviceCheck.ok

  if (!isInternal) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: RouteBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { property, agents, investors, persist = false } = body

  if (!property?.id || !Array.isArray(agents) || !Array.isArray(investors)) {
    return NextResponse.json(
      { error: 'property, agents[], investors[] are required' },
      { status: 400 },
    )
  }

  try {
    const decision = routeDeal(property, agents, investors)

    let event_id: string | null = null
    if (persist && decision.tier !== 'skip') {
      event_id = await persistDistributionEvent(property, decision)
    }

    return NextResponse.json({
      decision,
      event_id,
      generated_at: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[distribution-route] error:', err, { corrId })
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    )
  }
}
