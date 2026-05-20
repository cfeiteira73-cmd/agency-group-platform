// =============================================================================
// Agency Group — SH-ROS
// POST /api/simulation/ai-burst
//
// Runs an AI burst simulation scenario against the cost stream engine.
// Uses ONLY synthetic tenant IDs — zero real Anthropic calls, zero production
// mutations.
//
// Auth: Bearer INTERNAL_API_SECRET or ADMIN_SECRET
//
// Body:
//   { scenario: 'spike'|'overload'|'fallback', tenant_id?: string, spike_multiplier?: number }
//
// Response: SimulationResult
//
// TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import {
  simulateAISpike,
  simulateModelOverload,
  simulateFallbackRouting,
} from '@/lib/simulation/aiBurstSimulator'
import type { SimulationResult } from '@/lib/simulation/aiBurstSimulator'
import { safeCompare } from '@/lib/safeCompare'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

// ─── Auth ─────────────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const token    = (req.headers.get('authorization') ?? '').replace('Bearer ', '')
  const internal = process.env.INTERNAL_API_SECRET
  const admin    = process.env.ADMIN_SECRET
  if (internal && safeCompare(token, internal)) return true
  if (admin    && safeCompare(token, admin))    return true
  return false
}

// ─── Validate tenant_id is synthetic ─────────────────────────────────────────

function isSyntheticTenantId(tenantId: string): boolean {
  return tenantId.startsWith('sim_ai_burst_')
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── Auth gate ────────────────────────────────────────────────────────────────
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Parse body ───────────────────────────────────────────────────────────────
  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const scenario       = body['scenario']        as string | undefined
  const rawTenantId    = body['tenant_id']        as string | undefined
  const spikeMultiplier = typeof body['spike_multiplier'] === 'number'
    ? body['spike_multiplier']
    : 10

  if (!scenario || !['spike', 'overload', 'fallback'].includes(scenario)) {
    return NextResponse.json(
      { error: 'scenario must be one of: spike, overload, fallback' },
      { status: 400 },
    )
  }

  // ── Enforce synthetic tenant IDs ─────────────────────────────────────────────
  const tenantId = rawTenantId ?? 'sim_ai_burst_001'

  if (!isSyntheticTenantId(tenantId)) {
    return NextResponse.json(
      {
        error:   'tenant_id must start with "sim_ai_burst_" — this endpoint does not mutate production tenants',
        received: tenantId,
      },
      { status: 422 },
    )
  }

  // ── Run simulation ───────────────────────────────────────────────────────────
  let result: SimulationResult

  try {
    switch (scenario) {
      case 'spike':
        result = await simulateAISpike(tenantId, spikeMultiplier)
        break
      case 'overload':
        result = await simulateModelOverload(tenantId)
        break
      case 'fallback':
        result = await simulateFallbackRouting(tenantId)
        break
      default:
        // TypeScript exhaustiveness guard — unreachable
        return NextResponse.json({ error: 'Unknown scenario' }, { status: 400 })
    }
  } catch (err) {
    console.error('[ai-burst simulation] Unexpected error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Simulation error' },
      { status: 500 },
    )
  }

  // ── Return result ────────────────────────────────────────────────────────────
  const status = result.verdict === 'PASS' ? 200
               : result.verdict === 'DEGRADED' ? 206
               : 422  // FAIL → 422 Unprocessable to make CI pick it up easily

  return NextResponse.json(result, { status })
}
