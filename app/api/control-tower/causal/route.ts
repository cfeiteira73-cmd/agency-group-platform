import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getCausalChain, getRevenueTrace } from '@/lib/observability/causalTrace'
import { getRequestCorrelationId } from '@/lib/observability/correlation'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const corrId = getRequestCorrelationId(req)
  const { searchParams } = new URL(req.url)
  const correlationId = searchParams.get('correlation_id')
  const entityId      = searchParams.get('entity_id')
  const entityType    = searchParams.get('entity_type') ?? 'deal'

  try {
    if (correlationId) {
      const chain = await getCausalChain(correlationId)
      return NextResponse.json({ chain, count: chain.length, correlation_id: correlationId })
    }
    if (entityId) {
      const trace = await getRevenueTrace(entityId, entityType)
      return NextResponse.json({ trace, count: trace.length, entity_id: entityId, entity_type: entityType })
    }
    return NextResponse.json({ error: 'Provide correlation_id or entity_id' }, { status: 400 })
  } catch (error) {
    console.error('[control-tower/causal] Error:', error, { corrId })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
