// Agency Group — RTO/RPO Stats API
// app/api/sre/rto-rpo/route.ts
//
// GET /api/sre/rto-rpo?service=database
//   Returns RTORPOStats for the specified service.
//
// GET /api/sre/rto-rpo
//   Returns RTORPOStats for all tracked services.
//
// Auth: CRON_SECRET or INTERNAL_API_TOKEN
// TypeScript strict — 0 errors

import { NextRequest, NextResponse } from 'next/server'
import { requireServiceAuth }        from '@/lib/auth/serviceAuth'
import {
  computeRTORPOStats,
  computeAllServicesStats,
  RTO_SLA_SECONDS,
}                                    from '@/lib/sre/rtoRpoTracker'
import { CANONICAL_TENANT_UUID }     from '@/lib/constants/pipeline'
import { getRequestCorrelationId }   from '@/lib/observability/correlation'

export const runtime = 'nodejs'

function resolveTenantId(): string {
  return (
    process.env.DEFAULT_TENANT_ID ??
    process.env.SYSTEM_ORG_ID     ??
    CANONICAL_TENANT_UUID
  )
}

// ─── GET /api/sre/rto-rpo ────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const corrId = getRequestCorrelationId(req)

  const auth = await requireServiceAuth(req)
  if (!auth.ok) return auth.response

  const tenantId = resolveTenantId()

  try {
    const { searchParams } = new URL(req.url)
    const service     = searchParams.get('service')
    const lookbackRaw = searchParams.get('lookback_days')
    const lookbackDays = lookbackRaw ? Math.max(1, Math.min(90, parseInt(lookbackRaw, 10))) : 30

    if (service) {
      // Single service
      if (!RTO_SLA_SECONDS[service]) {
        return NextResponse.json(
          {
            error:            `Unknown service: ${service}`,
            known_services:   Object.keys(RTO_SLA_SECONDS),
          },
          { status: 400, headers: { 'x-correlation-id': corrId } },
        )
      }

      const stats = await computeRTORPOStats(service, tenantId, lookbackDays)
      return NextResponse.json(
        {
          stats,
          lookback_days: lookbackDays,
          computed_at:   new Date().toISOString(),
        },
        { headers: { 'x-correlation-id': corrId } },
      )
    }

    // All services
    const allStats = await computeAllServicesStats(tenantId, lookbackDays)

    return NextResponse.json(
      {
        stats:         allStats,
        services:      Object.keys(RTO_SLA_SECONDS),
        lookback_days: lookbackDays,
        computed_at:   new Date().toISOString(),
      },
      { headers: { 'x-correlation-id': corrId } },
    )
  } catch (err) {
    console.error('[GET /api/sre/rto-rpo]', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: { 'x-correlation-id': corrId } },
    )
  }
}
