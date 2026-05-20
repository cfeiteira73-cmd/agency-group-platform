// =============================================================================
// Agency Group — Real Traffic Load Profile API
// app/api/reality/load-profile/route.ts
//
// GET /api/reality/load-profile?tenant_id=xxx&window_seconds=3600
// GET /api/reality/load-profile?tenant_id=all&window_seconds=3600
//
// Returns real-traffic load profiles computed from live Redis Stream data.
// Bearer auth required.
// TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import {
  getRealWorldLoadProfile,
  getSystemLoadProfile,
  type RealWorldLoadProfile,
} from '@/lib/reality/humanTrafficRouter'

export const dynamic = 'force-dynamic'

// ─── Auth ─────────────────────────────────────────────────────────────────────

function authenticate(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) return false
  const token = authHeader.slice(7)
  const expected = process.env.INTERNAL_API_SECRET
  if (!expected) return false
  return token === expected
}

// ─── GET handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!authenticate(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const tenantId      = searchParams.get('tenant_id')     ?? ''
  const windowRaw     = searchParams.get('window_seconds')
  const windowSeconds = windowRaw ? Math.max(1, parseInt(windowRaw, 10)) : 3600

  if (!tenantId) {
    return NextResponse.json(
      { error: 'tenant_id query parameter is required' },
      { status: 400 },
    )
  }

  try {
    if (tenantId === 'all') {
      const profiles: RealWorldLoadProfile[] = await getSystemLoadProfile(windowSeconds)
      return NextResponse.json(profiles)
    }

    const profile: RealWorldLoadProfile = await getRealWorldLoadProfile(tenantId, windowSeconds)
    return NextResponse.json(profile)
  } catch {
    return NextResponse.json(
      { error: 'Failed to compute load profile' },
      { status: 500 },
    )
  }
}
