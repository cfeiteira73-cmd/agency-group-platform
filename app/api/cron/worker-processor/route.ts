// app/api/cron/worker-processor/route.ts
// Cron: every 5 minutes
// Processes pending job_queue items across all worker queues.

import { NextRequest, NextResponse } from 'next/server'
import { processAllQueues } from '@/lib/workers/processor'
import { safeCompare } from '@/lib/safeCompare'
import { withCronLock } from '@/lib/ops/withCronLock'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// P0 SRE: maxDuration MUST be set or Vercel defaults to 60s on Pro (10s on Hobby).
// processAllQueues() is unbounded — without this, any queue backlog kills the function
// mid-execution, orphans the Redis lock for 6 minutes, and halts queue draining.
export const maxDuration = 300

export async function GET(req: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization') ?? req.headers.get('x-cron-secret') ?? ''
  if (!cronSecret || !safeCompare(auth.replace('Bearer ', ''), cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const start = Date.now()

  // Concurrency protection: prevent overlapping 5-minute cron invocations
  const result = await withCronLock('worker-processor', 6, async () => {
    await processAllQueues()
    return NextResponse.json({
      ok: true,
      processed: true,
      latency_ms: Date.now() - start,
    })
  })

  if (result === null) {
    return NextResponse.json({ skipped: true, reason: 'already_running', latency_ms: Date.now() - start })
  }

  return result as NextResponse
}
