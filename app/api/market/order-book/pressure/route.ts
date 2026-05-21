// =============================================================================
// Agency Group — Market Pressure API (Order Book sub-route)
// app/api/market/order-book/pressure/route.ts
//
// GET /api/market/order-book/pressure?property_id=xxx → MarketPressureIndex
//
// Auth: isPortalAuth (NextAuth session | CRON_SECRET | ag-auth-token cookie)
// TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { isPortalAuth } from '@/lib/portalAuth'
import { computePropertyMPI } from '@/lib/market/marketPressureIndex'
import { getTenantId } from '@/lib/tenant'
import log from '@/lib/logger'

export const runtime     = 'nodejs'
export const maxDuration = 30

// ─── GET /api/market/order-book/pressure ─────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!(await isPortalAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const propertyId = searchParams.get('property_id')

    if (!propertyId) {
      return NextResponse.json(
        { error: 'Missing required param: property_id' },
        { status: 400 },
      )
    }

    const tenantId = await getTenantId(req)
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not resolved' }, { status: 400 })
    }

    const mpi = await computePropertyMPI(tenantId, propertyId)
    return NextResponse.json({ success: true, data: mpi })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.warn('[API /market/order-book/pressure GET] error', { error: msg })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
