// =============================================================================
// Agency Group — SH-ROS | AMI: 22506
// app/api/simulation/region-failure/route.ts
//
// POST /api/simulation/region-failure
// Runs cross-region failure simulations and returns a SimulationResult.
//
// Auth: Bearer token — INTERNAL_API_TOKEN or CRON_SECRET
// Body: { scenario: RegionScenario, tenant_id?: string }
//
// IMPORTANT: always wraps execution in try/finally to restore load mode.
// TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { safeCompare } from '@/lib/safeCompare'
import {
  simulateRegionDrop,
  simulateLatencyInjection,
  simulatePartialDegradation,
} from '@/lib/simulation/regionFailure'
import type { RegionScenario, SimulationResult } from '@/lib/simulation/regionFailure'

export const runtime    = 'nodejs'
export const maxDuration = 30   // region simulations may take up to 10–15 s

// ─── Auth helper ──────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) return false

  const internalToken = process.env.INTERNAL_API_TOKEN
  const cronSecret    = process.env.CRON_SECRET

  if (internalToken && safeCompare(token, internalToken)) return true
  if (cronSecret    && safeCompare(token, cronSecret))    return true
  return false
}

// ─── Valid scenarios ──────────────────────────────────────────────────────────

const VALID_SCENARIOS = new Set<RegionScenario>([
  'region_drop',
  'latency_200ms',
  'latency_800ms',
  'packet_loss_50pct',
])

function isValidScenario(v: unknown): v is RegionScenario {
  return typeof v === 'string' && VALID_SCENARIOS.has(v as RegionScenario)
}

// ─── POST /api/simulation/region-failure ─────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json() as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { scenario, tenant_id } = body

  if (!isValidScenario(scenario)) {
    return NextResponse.json(
      {
        error:   `scenario must be one of: ${[...VALID_SCENARIOS].join(', ')}`,
        received: scenario,
      },
      { status: 400 },
    )
  }

  const tenantId = typeof tenant_id === 'string' && tenant_id
    ? tenant_id
    : 'sim_region_test_001'

  let result: SimulationResult

  try {
    switch (scenario) {
      case 'region_drop':
        result = await simulateRegionDrop(tenantId)
        break

      case 'latency_200ms':
        result = await simulateLatencyInjection(200, tenantId)
        break

      case 'latency_800ms':
        result = await simulateLatencyInjection(800, tenantId)
        break

      case 'packet_loss_50pct':
        result = await simulatePartialDegradation(tenantId)
        break
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[POST /api/simulation/region-failure]', message)
    // Load mode restore is handled inside each simulation function's finally block.
    // This catch only triggers for unexpected errors outside those boundaries.
    return NextResponse.json(
      { error: 'Simulation failed', detail: message },
      { status: 500 },
    )
  }

  const status = result.verdict === 'PASS' ? 200 : result.verdict === 'DEGRADED' ? 207 : 500

  return NextResponse.json(result, { status })
}
