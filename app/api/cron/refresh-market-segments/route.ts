// GET /api/cron/refresh-market-segments
// Daily 04:30 — Refresh all multi-period market segment trends (7d/30d/90d)

import { NextRequest, NextResponse } from 'next/server'
import { withCronLock }              from '@/lib/ops/cronLock'
import { batchRefreshAllSegments }   from '@/lib/intelligence/marketSegments'
import { supabaseAdmin }             from '@/lib/supabase'

export const runtime   = 'nodejs'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const start = Date.now()

  const result = await withCronLock('refresh-market-segments', 45, async () => {
    const { refreshed, errors } = await batchRefreshAllSegments()

    // Log to automations_log
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin as any)
      .from('automations_log')
      .insert({
        workflow_name: 'refresh-market-segments',
        status:        errors > 0 ? 'partial' : 'success',
        result:        { refreshed, errors, duration_ms: Date.now() - start },
        created_at:    new Date().toISOString(),
      })

    return { refreshed, errors }
  }, {
    onSkip: () => console.log('[refresh-market-segments] skipped — lock held'),
  })

  if (result === null) {
    return NextResponse.json({ skipped: true, reason: 'lock_held' })
  }

  return NextResponse.json({
    ok:       true,
    ...result,
    duration_ms: Date.now() - start,
  })
}
