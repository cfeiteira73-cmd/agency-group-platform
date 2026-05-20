// =============================================================================
// Agency Group — Intelligence: ML Prediction API
// app/api/intelligence/predict/route.ts
//
// GET /api/intelligence/predict?property_id=UUID&investor_id=UUID
// Auth: requirePortalAuth (NextAuth session | magic-link | service token)
// Returns: PipelineOutput with yield prediction, conversion probability, grade
//
// TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { requirePortalAuth } from '@/lib/requirePortalAuth'
import { runScoringPipeline } from '@/lib/ml/scoringPipeline'

export const runtime = 'nodejs'

// ---------------------------------------------------------------------------
// Tenant helper
// ---------------------------------------------------------------------------

function resolveTenantId(): string {
  return (
    process.env.DEFAULT_TENANT_ID ??
    process.env.SYSTEM_ORG_ID ??
    '00000000-0000-0000-0000-000000000001'
  )
}

// ---------------------------------------------------------------------------
// GET /api/intelligence/predict
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await requirePortalAuth(req)
  if (!auth.ok) return auth.response

  const tenantId = resolveTenantId()

  try {
    const { searchParams } = new URL(req.url)

    const propertyId = searchParams.get('property_id')
    const investorId = searchParams.get('investor_id')

    // Validate required parameter
    if (!propertyId || propertyId.trim() === '') {
      return NextResponse.json(
        { error: 'property_id is required' },
        { status: 400 },
      )
    }

    const result = await runScoringPipeline({
      propertyId: propertyId.trim(),
      tenantId,
      ...(investorId && investorId.trim() !== '' ? { investorId: investorId.trim() } : {}),
    })

    return NextResponse.json(result)
  } catch (err) {
    console.error('[GET /api/intelligence/predict]', err instanceof Error ? err.message : String(err), { tenant_id: tenantId })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
