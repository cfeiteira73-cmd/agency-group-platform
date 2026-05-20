// Agency Group — SLO Status API
// app/api/sre/slo/route.ts
// GET /api/sre/slo?service=api
// Auth: requirePortalAuth
// TypeScript strict — 0 errors

import { NextRequest, NextResponse } from 'next/server'
import { requirePortalAuth } from '@/lib/requirePortalAuth'
import { computeSloStatus } from '@/lib/sre/sloTracker'
import { CANONICAL_TENANT_UUID } from '@/lib/constants/pipeline'
import { getRequestCorrelationId } from '@/lib/observability/correlation'

export const runtime = 'nodejs'

const ALL_SERVICES = ['api', 'database', 'queue', 'ai', 'kafka'] as const

function resolveTenantId(): string {
  return (
    process.env.DEFAULT_TENANT_ID ??
    process.env.SYSTEM_ORG_ID ??
    CANONICAL_TENANT_UUID
  )
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const corrId = getRequestCorrelationId(req)

  const auth = await requirePortalAuth(req)
  if (!auth.ok) return auth.response

  const tenantId = resolveTenantId()

  try {
    const { searchParams } = new URL(req.url)
    const service = searchParams.get('service')

    if (service) {
      // Single service
      const status = await computeSloStatus(tenantId, service)
      return NextResponse.json(
        { slo: status },
        { headers: { 'x-correlation-id': corrId } },
      )
    }

    // All services in parallel
    const results = await Promise.all(
      ALL_SERVICES.map(svc => computeSloStatus(tenantId, svc)),
    )

    return NextResponse.json(
      {
        slos: results,
        services: ALL_SERVICES,
        computed_at: new Date().toISOString(),
      },
      { headers: { 'x-correlation-id': corrId } },
    )
  } catch (err) {
    console.error('[GET /api/sre/slo]', err, { corrId, tenant_id: tenantId })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: { 'x-correlation-id': corrId } },
    )
  }
}
