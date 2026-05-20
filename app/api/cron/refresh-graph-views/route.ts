// app/api/cron/refresh-graph-views/route.ts
// Cron: every 30 minutes
// Refreshes graph materialized views for fast intelligence queries.

import { NextRequest, NextResponse } from 'next/server'
import { refreshMaterializedViews } from '@/lib/graph/materializedViews'
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
  const result = await refreshMaterializedViews('agency-group')

  return NextResponse.json({
    ok: result.ok,
    views_refreshed: result.views_refreshed,
    duration_ms: result.duration_ms,
    total_ms: Date.now() - start,
  })
}
