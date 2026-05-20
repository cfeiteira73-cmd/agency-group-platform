// =============================================================================
// Agency Group — Graph Index Store Stats API
// app/api/graph/stats/route.ts
//
// GET /api/graph/stats?tenant_id=xxx&window_seconds=3600
// Auth: Bearer INTERNAL_API_SECRET or ADMIN_SECRET
//
// Returns IndexStoreStats: HOT/WARM/COLD hit rates, avg and p95 latency.
// Data is read from Redis counters written by recordTierHit() in indexStore.ts.
//
// TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { getIndexStoreStats } from '@/lib/graph/indexStore'
import { safeCompare } from '@/lib/safeCompare'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isAuthorized(req: NextRequest): boolean {
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '')
  const s1 = process.env.INTERNAL_API_SECRET
  const s2 = process.env.ADMIN_SECRET
  return (!!s1 && safeCompare(token, s1)) || (!!s2 && safeCompare(token, s2))
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const tenantId = searchParams.get('tenant_id')
  const windowSecondsRaw = searchParams.get('window_seconds')

  if (!tenantId) {
    return NextResponse.json({ error: 'tenant_id query param required' }, { status: 400 })
  }

  const windowSeconds = windowSecondsRaw
    ? Math.max(60, parseInt(windowSecondsRaw, 10) || 3600)
    : 3600

  try {
    const stats = await getIndexStoreStats(tenantId, windowSeconds)
    return NextResponse.json(stats)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
