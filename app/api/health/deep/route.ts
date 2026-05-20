// Agency Group — Deep Health Check Endpoint
// app/api/health/deep/route.ts
// GET /api/health/deep — public, no auth, rate limited by Vercel edge
// Returns 200 healthy, 207 degraded, 503 critical
// TypeScript strict — 0 errors

import { NextRequest, NextResponse } from 'next/server'
import { runDeepHealthCheck } from '@/lib/sre/healthCheck'
import { recordRequest } from '@/lib/sre/sloTracker'
import { CANONICAL_TENANT_UUID } from '@/lib/constants/pipeline'
import { generateCorrelationId } from '@/lib/observability/correlation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const corrId   = req.headers.get('x-correlation-id') ?? generateCorrelationId()
  const tenantId = process.env.DEFAULT_TENANT_ID ?? process.env.SYSTEM_ORG_ID ?? CANONICAL_TENANT_UUID

  const t0 = Date.now()
  const result = await runDeepHealthCheck()
  const latencyMs = Date.now() - t0

  // Fire-and-forget SLO recording — never block the response
  void recordRequest(
    tenantId,
    'api',
    result.summary !== 'critical',
    latencyMs,
  ).catch(err => console.warn('[health/deep] SLO record failed:', err instanceof Error ? err.message : String(err)))

  const status =
    result.summary === 'healthy'  ? 200 :
    result.summary === 'degraded' ? 207 :
    503

  return NextResponse.json(result, {
    status,
    headers: {
      'Cache-Control':    'no-store',
      'x-correlation-id': corrId,
    },
  })
}
