// app/api/graph/query/route.ts
// POST /api/graph/query — unified graph intelligence endpoint
// Auth: Bearer INTERNAL_API_SECRET

import { NextRequest, NextResponse } from 'next/server'
import { executeGraphQuery, toFormalGraphResult } from '@/lib/graph/graphQueryInterface'
import type { GraphQueryRequest } from '@/lib/graph/graphQueryInterface'
import { safeCompare } from '@/lib/safeCompare'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isAuthorized(req: NextRequest): boolean {
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '')
  const s1 = process.env.INTERNAL_API_SECRET
  const s2 = process.env.ADMIN_SECRET
  return (!!s1 && safeCompare(token, s1)) || (!!s2 && safeCompare(token, s2))
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json() as GraphQueryRequest
    if (!body.type || !body.tenant_id) {
      return NextResponse.json({ error: 'type and tenant_id required' }, { status: 400 })
    }
    const result = await executeGraphQuery(body)
    const formalGraph = toFormalGraphResult(result)
    const status = result.error ? 500 : 200
    return NextResponse.json({ ...result, formal_graph: formalGraph }, { status })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    endpoint: '/api/graph/query',
    method: 'POST',
    query_types: ['WHY_DID_DEAL_CLOSE','REVENUE_LEAK','AGENT_CONTRIBUTION',
                  'FULL_TENANT_PATH','CONVERSION_PATTERNS','ENTITY_ONTOLOGY','BUYER_CLUSTER'],
    required: ['type', 'tenant_id'],
  })
}
