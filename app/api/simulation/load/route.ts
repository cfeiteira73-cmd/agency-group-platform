// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — Load Simulation API
// app/api/simulation/load/route.ts
//
// POST /api/simulation/load
// Body: { scenario: 'steady'|'spike'|'chaos'|'sustained', tenant_count: number, options?: {} }
//
// Auth  : Bearer — INTERNAL_API_TOKEN or CRON_SECRET (safeCompare, timing-safe)
// Cap   : tenant_count max 1_000 (prevents runaway cost in dev/staging)
// NO real external API calls — all internals are synthetic-tenant reads.
//
// TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { safeCompare }               from '@/lib/safeCompare'
import {
  simulateSteadyLoad,
  simulateSpikeLoad,
  simulateChaosLoad,
  simulateSustainedMaxLoad,
  getLoadModeForSimulation,
} from '@/lib/simulation/loadSimulator'
import type { SimulationResult }     from '@/lib/simulation/loadSimulator'

export const dynamic    = 'force-dynamic'
export const maxDuration = 60        // Vercel Pro — 60-second timeout
export const runtime    = 'nodejs'

// ─── Auth ─────────────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization') ?? ''
  const token      = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) return false

  const internalToken = process.env.INTERNAL_API_TOKEN
  const cronSecret    = process.env.CRON_SECRET

  if (internalToken && safeCompare(token, internalToken)) return true
  if (cronSecret    && safeCompare(token, cronSecret))    return true
  return false
}

// ─── Valid scenarios ──────────────────────────────────────────────────────────

const VALID_SCENARIOS = new Set(['steady', 'spike', 'chaos', 'sustained'] as const)
type Scenario = 'steady' | 'spike' | 'chaos' | 'sustained'

function isValidScenario(v: unknown): v is Scenario {
  return typeof v === 'string' && VALID_SCENARIOS.has(v as Scenario)
}

// ─── POST /api/simulation/load ────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── Auth ───────────────────────────────────────────────────────────────────
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: Record<string, unknown>
  try {
    body = await req.json() as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { scenario, tenant_count, options } = body

  // ── Validate scenario ──────────────────────────────────────────────────────
  if (!isValidScenario(scenario)) {
    return NextResponse.json(
      {
        error:   'Invalid scenario',
        allowed: [...VALID_SCENARIOS],
      },
      { status: 400 },
    )
  }

  // ── Validate tenant_count ──────────────────────────────────────────────────
  const MAX_TENANT_COUNT = 1_000   // hard cap to prevent runaway cost in dev

  const rawCount = typeof tenant_count === 'number'
    ? tenant_count
    : parseInt(String(tenant_count ?? ''), 10)

  if (!Number.isFinite(rawCount) || rawCount < 1) {
    return NextResponse.json(
      { error: 'tenant_count must be a positive integer' },
      { status: 400 },
    )
  }

  const safeTenantCount = Math.min(rawCount, MAX_TENANT_COUNT)

  // ── Extract optional parameters ────────────────────────────────────────────
  const opts = typeof options === 'object' && options !== null
    ? (options as Record<string, unknown>)
    : {}

  // ── Get current load mode for context ─────────────────────────────────────
  const current_load_mode = await getLoadModeForSimulation()

  // ── Run simulation ─────────────────────────────────────────────────────────
  let result: SimulationResult

  try {
    switch (scenario) {
      case 'steady': {
        const durationSeconds = typeof opts.duration_seconds === 'number'
          ? opts.duration_seconds
          : undefined
        result = await simulateSteadyLoad(safeTenantCount, durationSeconds)
        break
      }

      case 'spike': {
        const spikeMultiplier = typeof opts.spike_multiplier === 'number'
          ? opts.spike_multiplier
          : undefined
        result = await simulateSpikeLoad(safeTenantCount, spikeMultiplier)
        break
      }

      case 'chaos': {
        const iterationCount = typeof opts.iteration_count === 'number'
          ? opts.iteration_count
          : undefined
        result = await simulateChaosLoad(safeTenantCount, iterationCount)
        break
      }

      case 'sustained': {
        const iterationCount = typeof opts.iteration_count === 'number'
          ? opts.iteration_count
          : undefined
        result = await simulateSustainedMaxLoad(safeTenantCount, iterationCount)
        break
      }

      default:
        // exhaustive check — TypeScript will catch unhandled cases at compile time
        scenario satisfies never
        return NextResponse.json({ error: 'Unknown scenario' }, { status: 400 })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[POST /api/simulation/load]', message)
    return NextResponse.json(
      { error: 'Simulation failed', detail: message },
      { status: 500 },
    )
  }

  return NextResponse.json(
    {
      ...result,
      meta: {
        requested_tenant_count: rawCount,
        capped_at:              MAX_TENANT_COUNT,
        was_capped:             rawCount > MAX_TENANT_COUNT,
        current_load_mode,
      },
    },
    { status: 200 },
  )
}
