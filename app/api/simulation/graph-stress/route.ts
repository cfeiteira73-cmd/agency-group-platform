// =============================================================================
// Agency Group — Graph Stress Simulation API
// POST /api/simulation/graph-stress
//
// Body: {
//   scenario:    'traversal' | 'concurrent' | 'cache_collapse' | 'recursion'
//   tenant_id?:  string   (default: 'sim_graph_001')
//   concurrency?: number  (default: 20, for 'concurrent' scenario)
//   miss_count?:  number  (default: 50, for 'cache_collapse' scenario)
// }
//
// Auth: Bearer INTERNAL_API_SECRET or ADMIN_SECRET
// CRITICAL: Zero Supabase mutations — all scenarios are read-only.
//
// TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import {
  simulateDeepTraversal,
  simulateConcurrentLoad,
  simulateCacheCollapse,
  simulateRecursionDepth,
  type SimulationResult,
} from '@/lib/simulation/graphStress'
import { safeCompare } from '@/lib/safeCompare'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ─── Auth ─────────────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '')
  const s1 = process.env.INTERNAL_API_SECRET
  const s2 = process.env.ADMIN_SECRET
  return (
    (typeof s1 === 'string' && s1.length > 0 && safeCompare(token, s1)) ||
    (typeof s2 === 'string' && s2.length > 0 && safeCompare(token, s2))
  )
}

// ─── Request body ─────────────────────────────────────────────────────────────

type ScenarioName = 'traversal' | 'concurrent' | 'cache_collapse' | 'recursion'

interface GraphStressBody {
  scenario:     ScenarioName
  tenant_id?:   string
  concurrency?: number
  miss_count?:  number
}

function parseBody(raw: unknown): GraphStressBody | null {
  if (typeof raw !== 'object' || raw === null) return null
  const obj = raw as Record<string, unknown>

  const validScenarios: ScenarioName[] = ['traversal', 'concurrent', 'cache_collapse', 'recursion']
  const scenario = obj['scenario']
  if (!validScenarios.includes(scenario as ScenarioName)) return null

  return {
    scenario:     scenario as ScenarioName,
    tenant_id:    typeof obj['tenant_id']   === 'string' ? obj['tenant_id']   : undefined,
    concurrency:  typeof obj['concurrency'] === 'number' ? obj['concurrency'] : undefined,
    miss_count:   typeof obj['miss_count']  === 'number' ? obj['miss_count']  : undefined,
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 },
    )
  }

  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 },
    )
  }

  const body = parseBody(rawBody)
  if (!body) {
    return NextResponse.json(
      {
        error:    'Invalid request body',
        required: 'scenario: traversal | concurrent | cache_collapse | recursion',
      },
      { status: 400 },
    )
  }

  const tenantId    = body.tenant_id   ?? 'sim_graph_001'
  const concurrency = body.concurrency ?? 20
  const missCount   = body.miss_count  ?? 50

  let result: SimulationResult

  try {
    switch (body.scenario) {
      case 'traversal':
        result = await simulateDeepTraversal(tenantId)
        break

      case 'concurrent':
        result = await simulateConcurrentLoad(tenantId, concurrency)
        break

      case 'cache_collapse':
        result = await simulateCacheCollapse(tenantId, missCount)
        break

      case 'recursion':
        result = await simulateRecursionDepth(tenantId)
        break

      default: {
        const exhaustive: never = body.scenario
        return NextResponse.json(
          { error: `Unknown scenario: ${String(exhaustive)}` },
          { status: 400 },
        )
      }
    }
  } catch (err) {
    console.error('[graph-stress] Simulation error:', err)
    return NextResponse.json(
      { error: 'Simulation failed', detail: String(err) },
      { status: 500 },
    )
  }

  const httpStatus = result.verdict === 'PASS' ? 200 : 422

  return NextResponse.json(result, { status: httpStatus })
}
