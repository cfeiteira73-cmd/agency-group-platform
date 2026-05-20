// =============================================================================
// Agency Group — Cron: Process All Worker Queues
// app/api/cron/process-workers/route.ts
//
// Runs all enabled workers, respecting a 45 s hard budget (Vercel cron limit
// is 60 s; we stop at 45 s to give Vercel time to flush the response).
//
// Cron schedule (vercel.json): every 2 minutes
// Auth: Authorization: Bearer ${CRON_SECRET}  OR  x-cron-secret: ${CRON_SECRET}
//
// TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { safeCompare }               from '@/lib/safeCompare'
import { withCronLock }              from '@/lib/ops/withCronLock'
import { processQueue }              from '@/lib/workers/processor'
import { WORKER_REGISTRY }           from '@/lib/workers/types'
import type { WorkerName }           from '@/lib/workers/types'
import { cronCorrelationId }         from '@/lib/observability/correlation'

export const runtime     = 'nodejs'
export const maxDuration = 60

// ── Hard budget: stop enqueueing new workers after 45 s ─────────────────────
const BUDGET_MS = 45_000
// ── Jobs per worker per invocation ───────────────────────────────────────────
const LIMIT_PER_WORKER = 20

// ─── GET /api/cron/process-workers ───────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  // ── Auth ─────────────────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET
  const incoming   = req.headers.get('authorization')?.replace('Bearer ', '')
    ?? req.headers.get('x-cron-secret')
    ?? ''

  if (!cronSecret || !incoming || !safeCompare(incoming, cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const corrId = cronCorrelationId('process-workers')
  const start  = Date.now()

  // ── Concurrency lock: prevent overlapping cron invocations ────────────────
  const result = await withCronLock('process-workers', 4, async () => {
    const enabledWorkers = (Object.keys(WORKER_REGISTRY) as WorkerName[]).filter(
      name => WORKER_REGISTRY[name].enabled,
    )

    type WorkerSummary = {
      processed: number
      succeeded: number
      failed:    number
      skipped:   boolean
      durationMs: number
    }

    const summary: Record<string, WorkerSummary> = {}

    // Process workers sequentially to stay within the budget.
    // Parallel processing risks blowing the 45 s budget unpredictably.
    for (const name of enabledWorkers) {
      const elapsed = Date.now() - start

      if (elapsed >= BUDGET_MS) {
        // Budget exhausted — mark remaining workers as skipped.
        summary[name] = {
          processed:  0,
          succeeded:  0,
          failed:     0,
          skipped:    true,
          durationMs: 0,
        }
        console.warn(
          `[cron/process-workers] Budget exhausted at ${elapsed}ms — skipping worker="${name}"`,
        )
        continue
      }

      const workerStart = Date.now()

      try {
        const res = await processQueue(name, LIMIT_PER_WORKER)
        summary[name] = {
          processed:  res.processed,
          succeeded:  res.succeeded,
          failed:     res.failed,
          skipped:    false,
          durationMs: Date.now() - workerStart,
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
        console.error(`[cron/process-workers] Worker "${name}" threw: ${errMsg}`)
        summary[name] = {
          processed:  0,
          succeeded:  0,
          failed:     0,
          skipped:    false,
          durationMs: Date.now() - workerStart,
        }
      }
    }

    const totalProcessed = Object.values(summary).reduce((n, s) => n + s.processed, 0)
    const totalSucceeded = Object.values(summary).reduce((n, s) => n + s.succeeded, 0)
    const totalFailed    = Object.values(summary).reduce((n, s) => n + s.failed,    0)

    const res = NextResponse.json({
      ok:             true,
      total_processed: totalProcessed,
      total_succeeded: totalSucceeded,
      total_failed:    totalFailed,
      workers:         summary,
      budget_ms:       BUDGET_MS,
      elapsed_ms:      Date.now() - start,
      correlation_id:  corrId,
    })
    res.headers.set('x-correlation-id', corrId)
    return res
  })

  // Lock was held by another invocation — skip gracefully.
  if (result === null) {
    return NextResponse.json(
      {
        skipped:        true,
        reason:         'already_running',
        elapsed_ms:     Date.now() - start,
        correlation_id: corrId,
      },
      { status: 200 },
    )
  }

  return result as NextResponse
}
