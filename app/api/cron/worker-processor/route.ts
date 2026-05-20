// app/api/cron/worker-processor/route.ts
// Cron: every 5 minutes
// Processes pending job_queue items across all worker queues.

import { NextRequest, NextResponse } from 'next/server'
import { processAllQueues } from '@/lib/workers/processor'
import { safeCompare } from '@/lib/safeCompare'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization') ?? req.headers.get('x-cron-secret') ?? ''
  if (!cronSecret || !safeCompare(auth.replace('Bearer ', ''), cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const start = Date.now()
  try {
    await processAllQueues()
    return NextResponse.json({
      ok: true,
      processed: true,
      latency_ms: Date.now() - start,
    })
  } catch (err) {
    console.error('[WorkerProcessor] cron error:', err)
    return NextResponse.json({ ok: false, error: String(err), latency_ms: Date.now() - start }, { status: 500 })
  }
}
