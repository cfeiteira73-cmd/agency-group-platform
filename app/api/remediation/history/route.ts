// =============================================================================
// Agency Group — Remediation History
// GET /api/remediation/history?tenant_id=xxx&limit=50
//
// Returns past remediation actions for a tenant from the Redis stream.
//
// Auth : Bearer INTERNAL_API_SECRET | ADMIN_SECRET
// TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse }  from 'next/server'
import { getRemediationHistory }       from '@/lib/remediation/autonomousRemediator'
import { safeCompare }                 from '@/lib/safeCompare'

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
  const limitRaw = searchParams.get('limit') ?? '50'
  const limit    = Math.min(Math.max(parseInt(limitRaw, 10) || 50, 1), 200)

  if (!tenantId) {
    return NextResponse.json({ error: 'tenant_id query param required' }, { status: 400 })
  }

  const history = await getRemediationHistory(tenantId, limit)

  return NextResponse.json({
    tenant_id:  tenantId,
    fetched_at: new Date().toISOString(),
    count:      history.length,
    actions:    history,
  })
}
