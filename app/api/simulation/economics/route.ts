// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — Economics Collapse Simulation API Route
// app/api/simulation/economics/route.ts
//
// POST /api/simulation/economics
// Body: { scenario: 'explosion'|'margin'|'leak'|'saturation', tenant_id?: string, multiplier?: number }
//
// Auth      : Bearer token (ECONOMICS_API_SECRET env var)
// Safety    : All tenant IDs default to sim_econ_001 (synthetic only)
// Fail-open : simulation errors return 500 with details
// TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import {
  simulateCostExplosion,
  simulateMarginCollapse,
  simulateRevenueLeak,
  simulateBudgetGovernorSaturation,
} from '@/lib/simulation/economicsCollapse'
import { type SimulationResult } from '@/lib/simulation/loadSimulator'

export const dynamic = 'force-dynamic'

// ─── Auth ─────────────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.ECONOMICS_API_SECRET
  if (!secret) return false

  const auth = req.headers.get('authorization') ?? ''
  const [scheme, token] = auth.split(' ')
  return scheme === 'Bearer' && token === secret
}

// ─── POST handler ─────────────────────────────────────────────────────────────

type Scenario = 'explosion' | 'margin' | 'leak' | 'saturation'

interface RequestBody {
  scenario:   Scenario
  tenant_id?: string
  multiplier?: number
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: RequestBody
  try {
    body = (await req.json()) as RequestBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { scenario, tenant_id, multiplier } = body

  const VALID_SCENARIOS: Scenario[] = ['explosion', 'margin', 'leak', 'saturation']
  if (!scenario || !VALID_SCENARIOS.includes(scenario)) {
    return NextResponse.json(
      { error: `Invalid scenario. Must be one of: ${VALID_SCENARIOS.join(', ')}` },
      { status: 400 },
    )
  }

  // Default to synthetic tenant — never allow real tenant IDs
  const tenantId = (typeof tenant_id === 'string' && tenant_id.startsWith('sim_'))
    ? tenant_id
    : 'sim_econ_001'

  let result: SimulationResult

  try {
    switch (scenario) {
      case 'explosion':
        result = await simulateCostExplosion(tenantId, multiplier ?? 20)
        break
      case 'margin':
        result = await simulateMarginCollapse(tenantId)
        break
      case 'leak':
        result = await simulateRevenueLeak(tenantId)
        break
      case 'saturation':
        result = await simulateBudgetGovernorSaturation(tenantId)
        break
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: 'Simulation failed', details: message },
      { status: 500 },
    )
  }

  return NextResponse.json(result, {
    status: 200,
    headers: { 'Cache-Control': 'no-store' },
  })
}
