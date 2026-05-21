// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — Event Integrity API
// app/api/validation/events/route.ts
//
// GET  /api/validation/events                              → latest report (portal auth)
// POST /api/validation/events                              → run tests (service auth)
// GET  /api/validation/events?mode=simulate&scenario=...  → simulations (portal auth)
//
// Simulation scenarios: event_loss | replay_from_zero | duplicate
//
// TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { requirePortalAuth } from '@/lib/requirePortalAuth'
import { requireServiceAuth } from '@/lib/auth/serviceAuth'
import {
  runEventIntegrityTests,
  getLatestEventReport,
  simulateEventLoss,
  simulateDuplicateEvents,
  simulateReplayFromZero,
} from '@/lib/validation/eventIntegrityTester'
import { CANONICAL_TENANT_UUID } from '@/lib/constants/pipeline'
import { getRequestCorrelationId } from '@/lib/observability/correlation'

export const runtime = 'nodejs'

// ─── Tenant resolver ──────────────────────────────────────────────────────────

function resolveTenantId(req: NextRequest): string {
  return (
    req.nextUrl.searchParams.get('tenant_id') ??
    req.headers.get('x-tenant-id') ??
    process.env.DEFAULT_TENANT_ID ??
    process.env.SYSTEM_ORG_ID ??
    CANONICAL_TENANT_UUID
  )
}

// ─── Valid simulation scenarios ───────────────────────────────────────────────

const VALID_SCENARIOS = ['event_loss', 'replay_from_zero', 'duplicate'] as const
type SimulationScenario = (typeof VALID_SCENARIOS)[number]

function isValidScenario(s: string): s is SimulationScenario {
  return (VALID_SCENARIOS as readonly string[]).includes(s)
}

// ─── GET /api/validation/events ───────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const corrId = getRequestCorrelationId(req)

  const auth = await requirePortalAuth(req)
  if (!auth.ok) return auth.response

  const tenantId = resolveTenantId(req)
  const mode     = req.nextUrl.searchParams.get('mode')

  // ── Simulation mode ──────────────────────────────────────────────────────
  if (mode === 'simulate') {
    const scenarioParam = req.nextUrl.searchParams.get('scenario') ?? ''

    if (!isValidScenario(scenarioParam)) {
      return NextResponse.json(
        {
          error:             'Invalid scenario',
          valid_scenarios:   VALID_SCENARIOS,
          example:           '/api/validation/events?mode=simulate&scenario=event_loss',
        },
        { status: 400, headers: { 'x-correlation-id': corrId } },
      )
    }

    try {
      let simulationResult: Record<string, unknown>

      if (scenarioParam === 'event_loss') {
        simulationResult = await simulateEventLoss(tenantId) as unknown as Record<string, unknown>
      } else if (scenarioParam === 'replay_from_zero') {
        simulationResult = await simulateReplayFromZero(tenantId) as unknown as Record<string, unknown>
      } else {
        // duplicate
        simulationResult = await simulateDuplicateEvents(tenantId) as unknown as Record<string, unknown>
      }

      return NextResponse.json(
        {
          scenario:  scenarioParam,
          result:    simulationResult,
          tenant_id: tenantId,
          note:      'Measurement-based simulation only — no real failures injected',
        },
        { headers: { 'x-correlation-id': corrId } },
      )
    } catch (err) {
      console.error('[GET /api/validation/events simulate]', err, { corrId, tenant_id: tenantId })
      return NextResponse.json(
        { error: 'Simulation error' },
        { status: 500, headers: { 'x-correlation-id': corrId } },
      )
    }
  }

  // ── Latest report mode ────────────────────────────────────────────────────
  try {
    const latest = await getLatestEventReport(tenantId)
    if (!latest) {
      return NextResponse.json(
        {
          message:   'No event integrity reports found — POST to run the first test',
          tenant_id: tenantId,
        },
        { status: 404, headers: { 'x-correlation-id': corrId } },
      )
    }

    return NextResponse.json(
      { report: latest, tenant_id: tenantId },
      { headers: { 'x-correlation-id': corrId } },
    )
  } catch (err) {
    console.error('[GET /api/validation/events]', err, { corrId, tenant_id: tenantId })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: { 'x-correlation-id': corrId } },
    )
  }
}

// ─── POST /api/validation/events ─────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const corrId = getRequestCorrelationId(req)

  const auth = await requireServiceAuth(req)
  if (!auth.ok) return auth.response

  const tenantId = resolveTenantId(req)

  try {
    const report = await runEventIntegrityTests(tenantId)

    return NextResponse.json(
      {
        report,
        tenant_id:    tenantId,
        triggered_by: auth.identity,
      },
      { headers: { 'x-correlation-id': corrId } },
    )
  } catch (err) {
    console.error('[POST /api/validation/events]', err, { corrId, tenant_id: tenantId })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: { 'x-correlation-id': corrId } },
    )
  }
}
