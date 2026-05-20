// =============================================================================
// Agency Group — Drift Report API
// GET /api/reality/drift-report?tenant_id=xxx
//
// Returns a LongTermDriftReport for the requested tenant.
// Requires Bearer token authorization (portal auth or service token).
//
// TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { analyzeDrift }              from '@/lib/reality/stabilityDriftEngine'
import { requirePortalAuth }         from '@/lib/requirePortalAuth'

export const runtime     = 'nodejs'
export const maxDuration = 30

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Portal auth — returns 401 JSON response if unauthorized
  const authResult = await requirePortalAuth(req)
  if (!authResult.ok) return authResult.response

  const { searchParams } = new URL(req.url)
  const tenantId = searchParams.get('tenant_id')?.trim()

  if (!tenantId) {
    return NextResponse.json(
      { error: 'Missing required query parameter: tenant_id' },
      { status: 400 },
    )
  }

  try {
    const report = await analyzeDrift(tenantId)
    return NextResponse.json(report)
  } catch (err) {
    console.error('[drift-report] Unexpected error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
