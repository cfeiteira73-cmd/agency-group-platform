import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { AGENT_REGISTRY } from '@/lib/ai/agentRegistry'
import { getRequestCorrelationId } from '@/lib/observability/correlation'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const corrId = getRequestCorrelationId(req)
  const tenantId = req.headers.get('x-tenant-id') ?? 'agency-group'
  const month = new Date().toISOString().slice(0, 7)

  const UPSTASH_URL   = process.env.UPSTASH_REDIS_REST_URL
  const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN

  try {
    const agentIds = Object.keys(AGENT_REGISTRY).filter(id => AGENT_REGISTRY[id].monthlyTokenBudget)

    const budgets = await Promise.all(agentIds.map(async (agentId) => {
      const agent = AGENT_REGISTRY[agentId]
      let used = 0

      if (UPSTASH_URL && UPSTASH_TOKEN) {
        try {
          const key = `agent:budget:${tenantId}:${agentId}:${month}`
          const res = await fetch(`${UPSTASH_URL}/get/${key}`, {
            headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
            signal: AbortSignal.timeout(2000),
          })
          if (res.ok) {
            const { result } = await res.json() as { result: string | null }
            used = result ? parseInt(result, 10) : 0
          }
        } catch { /* fail open */ }
      }

      const budget = agent.monthlyTokenBudget ?? 0
      return {
        agentId,
        displayName: agent.displayName,
        monthlyBudget: budget,
        tokensUsed: used,
        utilizationPct: budget > 0 ? Math.round((used / budget) * 100) : 0,
        withinBudget: used <= budget,
        remainingTokens: Math.max(0, budget - used),
      }
    }))

    return NextResponse.json({ budgets, month, tenantId })
  } catch (error) {
    console.error('[control-tower/budget] Error:', error, { corrId })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
