// Agency Group — Worker Management API
// app/api/workers/route.ts
//
// GET  /api/workers         → get health of all workers
// POST /api/workers         → body { action: 'start' | 'stop', tenant_id?, worker_name? }
// GET  /api/workers?health  → alias for health check (monitoring systems)
//
// Auth: requireServiceAuth (CRON_SECRET or INTERNAL_API_TOKEN).
// TypeScript strict — 0 errors

import { NextRequest, NextResponse } from 'next/server'
import { requireServiceAuth } from '@/lib/auth/serviceAuth'
import { WorkerOrchestrator, createOrchestrator } from '@/lib/workers/workerOrchestrator'
import log from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ─── Singleton orchestrator per process ──────────────────────────────────────

let orchestratorInstance: WorkerOrchestrator | null = null

function getOrchestrator(tenantId: string): WorkerOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = createOrchestrator(tenantId)
  }
  return orchestratorInstance
}

// ─── GET /api/workers ────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await requireServiceAuth(req)
  if (!auth.ok) return auth.response

  const tenantId = req.headers.get('x-tenant-id')
    ?? process.env.DEFAULT_TENANT_ID
    ?? process.env.SYSTEM_ORG_ID
    ?? '00000000-0000-0000-0000-000000000001'

  const orchestrator = getOrchestrator(tenantId)
  const health       = orchestrator.getAllHealth()

  const overall = health.length === 0
    ? 'no_workers'
    : health.every(h => h.status === 'stopped')
      ? 'stopped'
      : health.some(h => h.status === 'error')
        ? 'degraded'
        : health.every(h => h.status === 'idle' || h.status === 'running')
          ? 'healthy'
          : 'partial'

  return NextResponse.json({
    ok:         true,
    overall,
    workers:    health,
    worker_count: health.length,
    fetched_at: new Date().toISOString(),
  })
}

// ─── POST /api/workers ───────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = await requireServiceAuth(req)
  if (!auth.ok) return auth.response

  let body: { action?: string; tenant_id?: string; worker_name?: string }

  try {
    body = await req.json() as { action?: string; tenant_id?: string; worker_name?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const tenantId = body.tenant_id
    ?? req.headers.get('x-tenant-id')
    ?? process.env.DEFAULT_TENANT_ID
    ?? process.env.SYSTEM_ORG_ID
    ?? '00000000-0000-0000-0000-000000000001'

  const orchestrator = getOrchestrator(tenantId)
  const action       = body.action

  // ── start all ───────────────────────────────────────────────────────────────
  if (action === 'start') {
    if (body.worker_name) {
      const ok = orchestrator.startWorker(body.worker_name)
      if (!ok) {
        return NextResponse.json(
          { error: `Cannot start worker: ${body.worker_name} (unknown or already running)` },
          { status: 400 },
        )
      }
      log.info('[workers/route] startWorker', { worker_name: body.worker_name, tenant_id: tenantId })
      return NextResponse.json({ ok: true, action: 'start', worker_name: body.worker_name })
    }

    orchestrator.startAll()
    log.info('[workers/route] startAll', { tenant_id: tenantId })
    return NextResponse.json({ ok: true, action: 'start_all', tenant_id: tenantId })
  }

  // ── stop all (or one) ────────────────────────────────────────────────────────
  if (action === 'stop') {
    if (body.worker_name) {
      const ok = orchestrator.stopWorker(body.worker_name)
      if (!ok) {
        return NextResponse.json(
          { error: `Cannot stop worker: ${body.worker_name} (not found)` },
          { status: 400 },
        )
      }
      log.info('[workers/route] stopWorker', { worker_name: body.worker_name, tenant_id: tenantId })
      return NextResponse.json({ ok: true, action: 'stop', worker_name: body.worker_name })
    }

    orchestrator.stopAll()
    // Drop the singleton so the next startAll creates fresh instances
    orchestratorInstance = null
    log.info('[workers/route] stopAll', { tenant_id: tenantId })
    return NextResponse.json({ ok: true, action: 'stop_all', tenant_id: tenantId })
  }

  // ── health (explicit POST health-check) ──────────────────────────────────────
  if (action === 'health') {
    const health = orchestrator.getAllHealth()
    return NextResponse.json({ ok: true, workers: health })
  }

  return NextResponse.json(
    { error: `Unknown action: ${String(action)}. Valid: start | stop | health` },
    { status: 400 },
  )
}
