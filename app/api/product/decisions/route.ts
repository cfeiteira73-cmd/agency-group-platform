// AGENCY GROUP — Product API: Decisions | AMI: 22506
// GET  /api/product/decisions?org_id=xxx&context=daily_review
// POST /api/product/decisions/quick — quick binary decision for an entity
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { isPortalAuth } from '@/lib/portalAuth'
import { simplifiedDecisionInterface } from '@/lib/product'
import type { AgentDecisionRequest } from '@/lib/product'
import { getRequestCorrelationId } from '@/lib/observability/correlation'

export const runtime = 'nodejs'
export const revalidate = 0

const VALID_CONTEXTS = [
  'daily_review', 'lead_followup', 'deal_closing', 'pipeline_health', 'revenue_forecast',
] as const

export async function GET(req: NextRequest) {
  const correlation_id = getRequestCorrelationId(req)

  try {
    const session = await auth()
    const portal  = await isPortalAuth(req)
    if (!session && !portal) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const org_id  = searchParams.get('org_id') ?? 'default'
    const context = searchParams.get('context') ?? 'daily_review'

    if (!VALID_CONTEXTS.includes(context as AgentDecisionRequest['context_type'])) {
      return NextResponse.json(
        { error: `Invalid context. Must be one of: ${VALID_CONTEXTS.join(', ')}` },
        { status: 400 }
      )
    }

    const decisions = await simplifiedDecisionInterface.getDecisions({
      org_id,
      context_type: context as AgentDecisionRequest['context_type'],
      urgency:      (searchParams.get('urgency') as 'now' | 'today' | 'this_week') ?? undefined,
    })

    return NextResponse.json(decisions, {
      headers: { 'X-Correlation-ID': correlation_id, 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    return NextResponse.json(
      { error: 'Decisions failed', detail: String(err), correlation_id },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  const correlation_id = getRequestCorrelationId(req)

  try {
    const session = await auth()
    const portal  = await isPortalAuth(req)
    if (!session && !portal) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json() as {
      entity_id:    string
      org_id:       string
      score:        number
      days_active?: number
      value?:       number
    }

    if (!body.entity_id || !body.org_id || typeof body.score !== 'number') {
      return NextResponse.json(
        { error: 'entity_id, org_id, and score are required' },
        { status: 400 }
      )
    }

    const decision = simplifiedDecisionInterface.quickDecide({
      entity_id:   body.entity_id,
      score:       body.score,
      days_active: body.days_active ?? 0,
      value:       body.value ?? 500_000,
      org_id:      body.org_id,
    })

    return NextResponse.json(decision, {
      headers: { 'X-Correlation-ID': correlation_id },
    })
  } catch (err) {
    return NextResponse.json(
      { error: 'Quick decision failed', detail: String(err), correlation_id },
      { status: 500 }
    )
  }
}
