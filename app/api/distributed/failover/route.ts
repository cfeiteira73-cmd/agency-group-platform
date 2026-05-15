// AGENCY GROUP — Distributed API: Failover | AMI: 22506
// POST /api/distributed/failover — manual regional failover (admin only)
// GET  /api/distributed/failover — list active failovers
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { globalFailoverController } from '@/lib/runtime/distributed'
import type { Region } from '@/lib/runtime/distributed'
import { getRequestCorrelationId } from '@/lib/observability/correlation'

export const runtime = 'nodejs'

const VALID_REGIONS: Region[] = ['eu-west', 'us-east', 'ap-south']

export async function GET(req: NextRequest) {
  const correlation_id = getRequestCorrelationId(req)

  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({
      active_failovers:  globalFailoverController.getActiveFailovers(),
      circuit_breakers:  globalFailoverController.getCircuitBreakerState(),
      correlation_id,
    }, {
      headers: { 'X-Correlation-ID': correlation_id, 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    return NextResponse.json(
      { error: 'Failover query failed', detail: String(err), correlation_id },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  const correlation_id = getRequestCorrelationId(req)

  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json() as {
      region:   string
      reason:   string
      operator?: string
    }

    if (!body.region || !body.reason) {
      return NextResponse.json(
        { error: 'region and reason are required' },
        { status: 400 }
      )
    }

    if (!VALID_REGIONS.includes(body.region as Region)) {
      return NextResponse.json(
        { error: `Invalid region. Must be one of: ${VALID_REGIONS.join(', ')}` },
        { status: 400 }
      )
    }

    const failover = await globalFailoverController.manualFailover(
      body.region as Region,
      body.operator ?? (session as { user?: { email?: string } }).user?.email ?? 'operator',
      body.reason
    )

    return NextResponse.json({ failover, triggered: true, correlation_id }, {
      status: 201,
      headers: { 'X-Correlation-ID': correlation_id },
    })
  } catch (err) {
    return NextResponse.json(
      { error: 'Failover trigger failed', detail: String(err), correlation_id },
      { status: 500 }
    )
  }
}
