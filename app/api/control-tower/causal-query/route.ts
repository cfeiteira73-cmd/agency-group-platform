// =============================================================================
// Agency Group — Causal Query Engine API
// app/api/control-tower/causal-query/route.ts
//
// Exposes the 4 causal query functions as a single POST endpoint.
// Auth: CRON_SECRET or INTERNAL_API_TOKEN (service-only route).
//
// POST body: { type: QueryType; params: Record<string, string> }
//
// TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import {
  whyDidDealClose,
  findRevenueLeak,
  traceAgentDecision,
  reconstructCausalChain,
} from '@/lib/causal/queryEngine'
import { safeCompare } from '@/lib/safeCompare'

export const runtime = 'nodejs'

type QueryType =
  | 'why_deal_close'
  | 'revenue_leak'
  | 'trace_agent_decision'
  | 'reconstruct_chain'

interface QueryBody {
  type: QueryType
  params: Record<string, string>
}

export async function POST(req: NextRequest) {
  const token       = (req.headers.get('authorization') ?? '').replace('Bearer ', '')
  const cronSecret  = process.env.CRON_SECRET
  const internalTok = process.env.INTERNAL_API_TOKEN
  const isAuthorized =
    (!!cronSecret  && safeCompare(token, cronSecret)) ||
    (!!internalTok && safeCompare(token, internalTok))

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: QueryBody
  try {
    body = (await req.json()) as QueryBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { type, params } = body

  try {
    switch (type) {
      case 'why_deal_close': {
        const { dealId } = params
        if (!dealId) return NextResponse.json({ error: 'dealId required' }, { status: 400 })
        const result = await whyDidDealClose(dealId)
        return NextResponse.json({ type, result })
      }
      case 'revenue_leak': {
        const tenantId = params.tenantId ?? 'agency-group'
        const result = await findRevenueLeak(tenantId)
        return NextResponse.json({ type, result })
      }
      case 'trace_agent_decision': {
        const { correlationId } = params
        if (!correlationId) return NextResponse.json({ error: 'correlationId required' }, { status: 400 })
        const result = await traceAgentDecision(correlationId)
        return NextResponse.json({ type, result })
      }
      case 'reconstruct_chain': {
        const { correlationId } = params
        if (!correlationId) return NextResponse.json({ error: 'correlationId required' }, { status: 400 })
        const result = await reconstructCausalChain(correlationId)
        return NextResponse.json({ type, result })
      }
      default:
        return NextResponse.json({ error: `Unknown query type: ${String(type)}` }, { status: 400 })
    }
  } catch (error) {
    console.error('[causal-query] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    supportedQueries: [
      { type: 'why_deal_close',       params: ['dealId']        },
      { type: 'revenue_leak',         params: ['tenantId']      },
      { type: 'trace_agent_decision', params: ['correlationId'] },
      { type: 'reconstruct_chain',    params: ['correlationId'] },
    ],
  })
}
