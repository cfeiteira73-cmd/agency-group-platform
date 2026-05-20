// Agency Group — DR Readiness Report API
// app/api/sre/dr-readiness/route.ts
// GET /api/sre/dr-readiness
// Auth: requirePortalAuth
// Returns: DrReadinessReport
// TypeScript strict — 0 errors

import { NextRequest, NextResponse } from 'next/server'
import { requirePortalAuth } from '@/lib/requirePortalAuth'
import { generateDrReadinessReport } from '@/lib/sre/drValidator'
import { CANONICAL_TENANT_UUID } from '@/lib/constants/pipeline'
import { getRequestCorrelationId } from '@/lib/observability/correlation'

export const runtime = 'nodejs'

function resolveTenantId(): string {
  return (
    process.env.DEFAULT_TENANT_ID ??
    process.env.SYSTEM_ORG_ID ??
    CANONICAL_TENANT_UUID
  )
}

// ─── GET /api/sre/dr-readiness ────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const corrId   = getRequestCorrelationId(req)
  const tenantId = resolveTenantId()

  const auth = await requirePortalAuth(req)
  if (!auth.ok) return auth.response

  try {
    const report = await generateDrReadinessReport(tenantId)

    console.info('[GET /api/sre/dr-readiness] report generated', {
      corrId,
      tenant_id:         tenantId,
      overall_readiness: report.overall_readiness,
      ready:             report.ready_for_production,
      critical_gaps:     report.critical_gaps.length,
      email:             auth.email,
    })

    return NextResponse.json(report, {
      status: report.ready_for_production ? 200 : 206,
      headers: { 'x-correlation-id': corrId },
    })
  } catch (err) {
    console.error('[GET /api/sre/dr-readiness]', err, { corrId, tenant_id: tenantId })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: { 'x-correlation-id': corrId } },
    )
  }
}
