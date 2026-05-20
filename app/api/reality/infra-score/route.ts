// =============================================================================
// Agency Group — Infrastructure Ownership Score API
// app/api/reality/infra-score/route.ts
//
// GET /api/reality/infra-score?probe=false
//
// Returns an InfraOwnershipScore reflecting the system's resilience to
// external dependency failures.
//
// probe=true  → live-probes Supabase and Upstash Redis (adds latency)
// probe=false → env-var presence checks only (fast, safe, default)
//
// Bearer auth required (INTERNAL_API_SECRET).
// TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { computeInfraOwnershipScore, type InfraOwnershipScore } from '@/lib/reality/infraDependencyGraph'

export const dynamic = 'force-dynamic'

// ─── Auth ─────────────────────────────────────────────────────────────────────

function authenticate(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) return false
  const token    = authHeader.slice(7)
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
  const probeParam = searchParams.get('probe')
  const probe = probeParam === 'true'

  try {
    const result: InfraOwnershipScore = await computeInfraOwnershipScore(probe)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json(
      { error: 'Failed to compute infrastructure ownership score' },
      { status: 500 },
    )
  }
}
