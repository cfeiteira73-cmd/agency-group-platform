// Agency Group — Chaos Gauntlet API
// app/api/sre/chaos-gauntlet/route.ts
//
// POST /api/sre/chaos-gauntlet
//   Body: { dry_run?: boolean }
//   Requires confirmation header: x-confirm: RUN_CHAOS_GAUNTLET
//   Runs the full 7-scenario chaos gauntlet.
//   Auth: CRON_SECRET or INTERNAL_API_TOKEN
//
// TypeScript strict — 0 errors

import { NextRequest, NextResponse } from 'next/server'
import { requireServiceAuth }        from '@/lib/auth/serviceAuth'
import {
  runFullChaosGauntlet,
  CHAOS_SCENARIOS,
}                                    from '@/lib/sre/chaosEnginePro'
import { CANONICAL_TENANT_UUID }     from '@/lib/constants/pipeline'
import { getRequestCorrelationId }   from '@/lib/observability/correlation'

export const runtime     = 'nodejs'
export const maxDuration = 300

const CONFIRM_HEADER = 'RUN_CHAOS_GAUNTLET'

function resolveTenantId(): string {
  return (
    process.env.DEFAULT_TENANT_ID ??
    process.env.SYSTEM_ORG_ID     ??
    CANONICAL_TENANT_UUID
  )
}

// ─── GET /api/sre/chaos-gauntlet ─────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const corrId = getRequestCorrelationId(req)

  const auth = await requireServiceAuth(req)
  if (!auth.ok) return auth.response

  return NextResponse.json(
    {
      scenarios:            CHAOS_SCENARIOS,
      total_scenarios:      CHAOS_SCENARIOS.length,
      chaos_testing_enabled: process.env.CHAOS_TESTING_ENABLED === 'true',
      run_instructions: {
        method: 'POST',
        required_header: `x-confirm: ${CONFIRM_HEADER}`,
        optional_body:   { dry_run: true },
      },
    },
    { headers: { 'x-correlation-id': corrId } },
  )
}

// ─── POST /api/sre/chaos-gauntlet ─────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const corrId = getRequestCorrelationId(req)

  const auth = await requireServiceAuth(req)
  if (!auth.ok) return auth.response

  // Require explicit confirmation header to prevent accidental execution
  const confirm = req.headers.get('x-confirm')
  if (confirm !== CONFIRM_HEADER) {
    return NextResponse.json(
      {
        error:    `Missing required header x-confirm: ${CONFIRM_HEADER}`,
        hint:     'Add the x-confirm header to acknowledge you intend to run the full chaos gauntlet.',
      },
      { status: 400, headers: { 'x-correlation-id': corrId } },
    )
  }

  // Parse body
  let dryRun = false
  try {
    const body = await req.json() as { dry_run?: boolean }
    dryRun = body.dry_run === true
  } catch {
    // empty body — fine
  }

  // Non-dry-run requires CHAOS_TESTING_ENABLED
  if (!dryRun && process.env.CHAOS_TESTING_ENABLED !== 'true') {
    return NextResponse.json(
      {
        error:                 'Chaos testing is disabled. Set CHAOS_TESTING_ENABLED=true or use dry_run: true.',
        chaos_testing_enabled: false,
      },
      { status: 403, headers: { 'x-correlation-id': corrId } },
    )
  }

  const tenantId  = resolveTenantId()
  const startedAt = new Date().toISOString()

  try {
    console.log('[POST /api/sre/chaos-gauntlet] Starting full gauntlet', {
      tenant_id: tenantId,
      dry_run:   dryRun,
      corr_id:   corrId,
    })

    const result = await runFullChaosGauntlet(tenantId, dryRun)

    return NextResponse.json(
      {
        ...result,
        dry_run:     dryRun,
        started_at:  startedAt,
        completed_at: new Date().toISOString(),
      },
      {
        status: result.critical_failures.length > 0 ? 207 : 200,
        headers: { 'x-correlation-id': corrId },
      },
    )
  } catch (err) {
    console.error('[POST /api/sre/chaos-gauntlet]', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: { 'x-correlation-id': corrId } },
    )
  }
}
