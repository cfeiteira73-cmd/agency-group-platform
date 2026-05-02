// GET /api/cron/refresh-engagement-decay
// Daily 04:00 — Recompute decay-adjusted ROI scores for all recipient profiles

import { NextRequest, NextResponse } from 'next/server'
import { withCronLock }              from '@/lib/ops/cronLock'
import { batchComputeDecay }         from '@/lib/intelligence/engagementDecay'
import { supabaseAdmin }             from '@/lib/supabase'

export const runtime   = 'nodejs'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const start = Date.now()

  const result = await withCronLock('refresh-engagement-decay', 30, async () => {
    const { processed, updated } = await batchComputeDecay({ onlyStale: true })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin as any)
      .from('automations_log')
      .insert({
        workflow_name: 'refresh-engagement-decay',
        status:        'success',
        result:        { processed, updated, duration_ms: Date.now() - start },
        created_at:    new Date().toISOString(),
      })

    return { processed, updated }
  }, {
    onSkip: () => console.log('[refresh-engagement-decay] skipped — lock held'),
  })

  if (result === null) {
    return NextResponse.json({ skipped: true, reason: 'lock_held' })
  }

  return NextResponse.json({
    ok:          true,
    ...result,
    duration_ms: Date.now() - start,
  })
}
