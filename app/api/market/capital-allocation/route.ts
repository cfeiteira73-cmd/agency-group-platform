// =============================================================================
// Agency Group — Capital Allocation API
// app/api/market/capital-allocation/route.ts
//
// GET  /api/market/capital-allocation?property_id=xxx&strategy=balanced
//      → AllocationDecision for a single property
//
// GET  /api/market/capital-allocation?mode=global
//      → GlobalYieldOptimization (service auth)
//
// POST /api/market/capital-allocation?mode=trigger
//      → autoTriggerAllocations (service auth + CRON_SECRET)
//
// Auth: isPortalAuth (GET property) | CRON_SECRET / service auth (global + trigger)
// TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { isPortalAuth } from '@/lib/portalAuth'
import { getTenantId } from '@/lib/tenant'
import log from '@/lib/logger'
import { timingSafeEqual } from 'crypto'
import {
  computeAllocationDecision,
  computeGlobalYieldOptimization,
  autoTriggerAllocations,
  type AllocationStrategy,
} from '@/lib/market/capitalAllocationEngine'

export const runtime     = 'nodejs'
export const maxDuration = 60

// ─── Valid allocation strategies ─────────────────────────────────────────────

const VALID_STRATEGIES: AllocationStrategy[] = [
  'maximize_yield',
  'maximize_speed',
  'maximize_capital_velocity',
  'balanced',
]

// ─── Service / cron auth ──────────────────────────────────────────────────────

function isServiceOrCronAuth(req: NextRequest): boolean {
  const cronSecret    = process.env.CRON_SECRET
  const internalToken = process.env.INTERNAL_API_TOKEN
  const serviceSecret = process.env.INTERNAL_API_SECRET

  const incoming =
    req.headers.get('x-cron-secret') ??
    req.headers.get('x-service-auth') ??
    req.headers.get('authorization')?.replace('Bearer ', '') ??
    ''

  if (!incoming) return false

  const check = (secret: string | undefined): boolean => {
    if (!secret) return false
    try {
      const a = Buffer.from(incoming)
      const b = Buffer.from(secret)
      if (a.length !== b.length) return false
      return timingSafeEqual(a, b)
    } catch {
      return false
    }
  }

  return check(cronSecret) || check(internalToken) || check(serviceSecret)
}

// ─── GET /api/market/capital-allocation ──────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url)
    const mode        = searchParams.get('mode') ?? 'property'
    const propertyId  = searchParams.get('property_id')
    const strategyRaw = searchParams.get('strategy') ?? 'balanced'

    // ── Global yield optimization (service auth) ─────────────────────────────
    if (mode === 'global') {
      if (!isServiceOrCronAuth(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const tenantId = await getTenantId(req)
      if (!tenantId) {
        return NextResponse.json({ error: 'Tenant not resolved' }, { status: 400 })
      }

      const optimization = await computeGlobalYieldOptimization(tenantId)

      log.info('[API /market/capital-allocation] global yield computed', {
        tenant_id:             tenantId,
        total_properties:      optimization.total_properties_in_play,
        global_yield_pct:      optimization.global_expected_yield_pct,
        allocation_efficiency: optimization.allocation_efficiency,
      } as any)

      return NextResponse.json({ success: true, data: optimization })
    }

    // ── Property allocation decision (portal auth) ───────────────────────────
    if (!(await isPortalAuth(req))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tenantId = await getTenantId(req)
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not resolved' }, { status: 400 })
    }

    if (!propertyId) {
      return NextResponse.json(
        { error: 'Missing required param: property_id' },
        { status: 400 },
      )
    }

    const strategy: AllocationStrategy = VALID_STRATEGIES.includes(strategyRaw as AllocationStrategy)
      ? (strategyRaw as AllocationStrategy)
      : 'balanced'

    const decision = await computeAllocationDecision(tenantId, propertyId, strategy)

    log.info('[API /market/capital-allocation] allocation decision', {
      property_id:  propertyId,
      tenant_id:    tenantId,
      strategy,
      investors:    decision.ranked_investors.length,
      confidence:   decision.allocation_confidence,
    } as any)

    return NextResponse.json({ success: true, data: decision })
  } catch (err) {
    log.warn('[API /market/capital-allocation GET] error', {
      error: err instanceof Error ? err.message : String(err),
    } as any)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── POST /api/market/capital-allocation?mode=trigger ────────────────────────
// Triggers autoTriggerAllocations — requires CRON_SECRET or service auth

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isServiceOrCronAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const tenantId = await getTenantId(req)
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not resolved' }, { status: 400 })
    }

    const { searchParams } = new URL(req.url)
    const mode = searchParams.get('mode') ?? 'trigger'

    if (mode !== 'trigger') {
      return NextResponse.json(
        { error: 'Invalid mode for POST. Use mode=trigger' },
        { status: 400 },
      )
    }

    const startedAt = Date.now()
    const result    = await autoTriggerAllocations(tenantId)
    const elapsed   = Date.now() - startedAt

    log.info('[API /market/capital-allocation POST] trigger completed', {
      tenant_id: tenantId,
      triggered: result.triggered,
      skipped:   result.skipped,
      elapsed_ms: elapsed,
    } as any)

    return NextResponse.json({
      success:   true,
      triggered: result.triggered,
      skipped:   result.skipped,
      elapsed_ms: elapsed,
    })
  } catch (err) {
    log.warn('[API /market/capital-allocation POST] error', {
      error: err instanceof Error ? err.message : String(err),
    } as any)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
