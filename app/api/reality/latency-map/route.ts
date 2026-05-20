// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — Global Latency Map API
// GET /api/reality/latency-map?fresh=false
//
// Returns the GlobalLatencyTruthMap: real measured latency for all live
// infrastructure probes (Supabase, Redis, internal API routes).
//
// Auth    : Bearer INTERNAL_API_SECRET or ADMIN_SECRET
// Cache   : Redis ex=300 (5 min). Pass ?fresh=true to force a new probe run.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { safeCompare } from '@/lib/safeCompare'
import { getLatencyTruthMap } from '@/lib/reality/globalLatencyProfiler'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ─── Auth ─────────────────────────────────────────────────────────────────────

function isBearerAuthorized(req: NextRequest): boolean {
  const auth     = req.headers.get('authorization') ?? ''
  const internal = process.env.INTERNAL_API_SECRET ?? ''
  const admin    = process.env.ADMIN_SECRET         ?? ''

  if (internal && safeCompare(auth, `Bearer ${internal}`)) return true
  if (admin    && safeCompare(auth, `Bearer ${admin}`))    return true

  return false
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isBearerAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const fresh = req.nextUrl.searchParams.get('fresh') === 'true'

  try {
    const map = await getLatencyTruthMap(!fresh)

    return NextResponse.json(map, {
      status:  200,
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    return NextResponse.json(
      {
        error:   'Latency probe failed',
        detail:  err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    )
  }
}
