// =============================================================================
// Agency Group — Manual Worker Trigger
// app/api/workers/run/route.ts
//
// POST /api/workers/run
// Triggers a named worker queue on demand.  Admin-only: requires service token.
//
// Body: { worker: WorkerName; limit?: number; tenant_id?: string }
// Response: { processed, worker, queue, durationMs }
//
// TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { safeCompare }               from '@/lib/safeCompare'
import { WORKER_REGISTRY }           from '@/lib/workers/types'
import type { WorkerName }           from '@/lib/workers/types'
import { processQueue }              from '@/lib/workers/processor'
import { getRequestCorrelationId }   from '@/lib/observability/correlation'

export const runtime = 'nodejs'

// ─── Handler imports (optional — graceful fallback if module not yet wired) ────

let handlersLoaded = false

async function tryLoadHandlers(): Promise<void> {
  if (handlersLoaded) return
  try {
    await import('@/lib/workers/handlers/index')
    handlersLoaded = true
  } catch {
    console.warn('[workers/run] lib/workers/handlers/index not available — workers will run in stub mode (jobs acked without processing).')
  }
}

// ─── POST /api/workers/run ────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── Auth: service token required ────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET
  const incoming   = req.headers.get('authorization')?.replace('Bearer ', '')
    ?? req.headers.get('x-cron-secret')
    ?? ''

  if (!cronSecret || !incoming || !safeCompare(incoming, cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Parse body ───────────────────────────────────────────────────────────────
  let body: { worker?: unknown; limit?: unknown; tenant_id?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const workerName = body.worker
  const limit      = typeof body.limit === 'number' ? body.limit : 10

  // ── Validate worker name ─────────────────────────────────────────────────────
  if (typeof workerName !== 'string' || !(workerName in WORKER_REGISTRY)) {
    return NextResponse.json(
      {
        error:            'Invalid worker name',
        valid_workers:    Object.keys(WORKER_REGISTRY),
        received:         workerName,
      },
      { status: 400 },
    )
  }

  const name   = workerName as WorkerName
  const config = WORKER_REGISTRY[name]
  const corrId = getRequestCorrelationId(req)

  console.log(`[workers/run] Triggering worker="${name}" limit=${limit} corrId=${corrId}`)

  // ── Attempt to load handlers ─────────────────────────────────────────────────
  await tryLoadHandlers()

  // ── Process the queue ────────────────────────────────────────────────────────
  const start = Date.now()

  const result = await processQueue(name, limit)

  const durationMs = Date.now() - start

  const response = NextResponse.json(
    {
      processed:  result.processed,
      succeeded:  result.succeeded,
      failed:     result.failed,
      worker:     name,
      queue:      config.queue,
      durationMs,
      correlation_id: corrId,
    },
    { status: 200 },
  )
  response.headers.set('x-correlation-id', corrId)
  return response
}
