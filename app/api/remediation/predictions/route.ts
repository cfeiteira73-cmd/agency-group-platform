// =============================================================================
// Agency Group — Failure Predictions
// GET /api/remediation/predictions?tenant_id=xxx
//
// Returns PredictionReport from the predictive failure engine.
// Includes predictions derived from drift analysis + incident history.
//
// Auth : Bearer INTERNAL_API_SECRET | ADMIN_SECRET
// TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse }    from 'next/server'
import { generatePredictionReport }      from '@/lib/remediation/predictiveFailureEngine'
import { safeCompare }                   from '@/lib/safeCompare'

export const dynamic = 'force-dynamic'

// ─── Auth ─────────────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const auth     = req.headers.get('authorization') ?? ''
  const internal = process.env.INTERNAL_API_SECRET
  const admin    = process.env.ADMIN_SECRET
  if (internal && !!auth && safeCompare(auth, `Bearer ${internal}`)) return true
  if (admin    && !!auth && safeCompare(auth, `Bearer ${admin}`))    return true
  return false
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const tenantId = searchParams.get('tenant_id')?.trim() ?? ''

  if (!tenantId) {
    return NextResponse.json({ error: 'tenant_id query param required' }, { status: 400 })
  }

  try {
    const report = await generatePredictionReport(tenantId)
    return NextResponse.json(report)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Prediction engine error'
    console.error('[/api/remediation/predictions] error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
