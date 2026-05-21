// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — Disaster Recovery API
// app/api/sre/disaster-recovery/route.ts
//
// GET  /api/sre/disaster-recovery?run_id=xxx         → getRecoveryRun
// GET  /api/sre/disaster-recovery?mode=history       → getRecoveryHistory
// GET  /api/sre/disaster-recovery?mode=drill         → getDrillHistory
// POST /api/sre/disaster-recovery                    → restoreSystem (service auth)
// POST /api/sre/disaster-recovery?mode=replay        → startDeterministicReplay + executeReplay
// POST /api/sre/disaster-recovery?mode=drill         → runChaosDrill (service auth)
//
// Auth: write ops require x-service-auth: INTERNAL_API_SECRET
//       read ops require requirePortalAuth
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { requirePortalAuth } from '@/lib/requirePortalAuth'
import { safeCompare } from '@/lib/safeCompare'
import {
  restoreSystem,
  getRecoveryRun,
  getRecoveryHistory,
} from '@/lib/sre/disasterRecoveryEngine'
import {
  startDeterministicReplay,
  executeReplay,
  getReplayHistory,
} from '@/lib/sre/deterministicReplayEngine'
import {
  runChaosDrill,
  getDrillHistory,
} from '@/lib/sre/chaosDrillEngine'
import { CANONICAL_TENANT_UUID } from '@/lib/constants/pipeline'

export const runtime = 'nodejs'
export const maxDuration = 120

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveTenantId(): string {
  return process.env.DEFAULT_TENANT_ID ?? process.env.SYSTEM_ORG_ID ?? CANONICAL_TENANT_UUID
}

function isServiceAuth(req: NextRequest): boolean {
  const secret = process.env.INTERNAL_API_SECRET
  if (!secret) return false
  const incoming =
    req.headers.get('x-service-auth') ??
    req.headers.get('authorization')?.replace('Bearer ', '') ??
    ''
  return safeCompare(incoming, secret)
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await requirePortalAuth(req)
  if (!auth.ok) return auth.response

  const sp = req.nextUrl.searchParams
  const mode = sp.get('mode')
  const runId = sp.get('run_id')
  const tenantId = resolveTenantId()

  try {
    // GET ?run_id=xxx → single recovery run
    if (runId) {
      const run = await getRecoveryRun(tenantId, runId)
      if (!run) {
        return NextResponse.json({ error: 'Recovery run not found' }, { status: 404 })
      }
      return NextResponse.json({ run })
    }

    // GET ?mode=history → recovery history
    if (mode === 'history') {
      const limit = sp.get('limit') ? parseInt(sp.get('limit')!, 10) : 20
      const history = await getRecoveryHistory(tenantId, limit)
      return NextResponse.json({ history, count: history.length })
    }

    // GET ?mode=drill → chaos drill history
    if (mode === 'drill') {
      const limit = sp.get('limit') ? parseInt(sp.get('limit')!, 10) : 20
      const history = await getDrillHistory(tenantId, limit)
      return NextResponse.json({ history, count: history.length })
    }

    // GET ?mode=replay → replay session history
    if (mode === 'replay') {
      const history = await getReplayHistory(tenantId)
      return NextResponse.json({ history, count: history.length })
    }

    // Default: recovery history
    const history = await getRecoveryHistory(tenantId, 10)
    return NextResponse.json({
      history,
      count: history.length,
      modes: ['history', 'drill', 'replay'],
      query_params: ['run_id', 'mode', 'limit'],
    })
  } catch (err) {
    console.error('[GET /api/sre/disaster-recovery]', err, { tenant_id: tenantId })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const sp = req.nextUrl.searchParams
  const mode = sp.get('mode')
  const tenantId = resolveTenantId()

  // All POST operations require service auth
  if (!isServiceAuth(req)) {
    return NextResponse.json(
      { error: 'Unauthorized — x-service-auth header required' },
      { status: 401 },
    )
  }

  let body: Record<string, unknown> = {}
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    // Empty body is valid for drill/default
  }

  try {
    // POST ?mode=drill → runChaosDrill
    if (mode === 'drill') {
      const scenarios = Array.isArray(body['scenarios'])
        ? (body['scenarios'] as string[])
        : undefined
      const drill_type = (body['drill_type'] as 'scheduled' | 'manual' | 'triggered' | undefined) ?? 'manual'

      const report = await runChaosDrill(tenantId, {
        scenarios: scenarios as Parameters<typeof runChaosDrill>[1] extends { scenarios?: infer S } ? S : undefined,
        drill_type,
      })

      return NextResponse.json(
        { report },
        { status: report.results.some(r => !r.passed) ? 207 : 200 },
      )
    }

    // POST ?mode=replay → startDeterministicReplay + executeReplay
    if (mode === 'replay') {
      const scope = (body['scope'] as 'full' | 'topic' | 'entity' | 'time_range') ?? 'full'
      const filter_topic = body['filter_topic'] as string | undefined
      const filter_entity_id = body['filter_entity_id'] as string | undefined
      const filter_from = body['filter_from'] as string | undefined
      const filter_to = body['filter_to'] as string | undefined
      const force = body['force'] === true

      const session = await startDeterministicReplay(tenantId, {
        scope,
        filter_topic,
        filter_entity_id,
        filter_from,
        filter_to,
        force,
      })

      // Execute replay immediately if session is new (not already running/completed)
      let finalSession = session
      if (session.status === 'pending') {
        finalSession = await executeReplay(session.id)
      }

      return NextResponse.json(
        { session: finalSession },
        { status: finalSession.status === 'failed' ? 500 : 200 },
      )
    }

    // POST (default) → restoreSystem
    const disaster_type = body['disaster_type'] as string | undefined
    if (!disaster_type) {
      return NextResponse.json(
        { error: 'disaster_type is required in request body' },
        { status: 400 },
      )
    }

    const run = await restoreSystem(tenantId, {
      disaster_type,
      triggered_by: body['triggered_by'] as string | undefined,
      target_pitr_timestamp: body['target_pitr_timestamp'] as string | undefined,
      dry_run: body['dry_run'] === true,
    })

    const statusCode =
      run.status === 'completed' ? 200 :
      run.status === 'partial' ? 207 :
      500

    return NextResponse.json({ run }, { status: statusCode })
  } catch (err) {
    console.error('[POST /api/sre/disaster-recovery]', err, { tenant_id: tenantId, mode })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
