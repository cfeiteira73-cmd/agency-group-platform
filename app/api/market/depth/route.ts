// =============================================================================
// Agency Group — Market Depth API
// app/api/market/depth/route.ts
//
// GET /api/market/depth?property_id=... → PricePressureResult
// GET /api/market/depth?zone=ZONE_NAME  → ZoneLiquidityResult
//
// TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { isPortalAuth } from '@/lib/portalAuth'
import { computePricePressure } from '@/lib/market/competingOffersEngine'
import { computeZoneLiquidity } from '@/lib/market/liquidityFormation'
import { getTenantId } from '@/lib/tenant'
import log from '@/lib/logger'

export const runtime     = 'nodejs'
export const maxDuration = 30

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!(await isPortalAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const propertyId = searchParams.get('property_id')
    const zone       = searchParams.get('zone')

    if (!propertyId && !zone) {
      return NextResponse.json(
        { error: 'Provide either property_id or zone query param' },
        { status: 400 },
      )
    }

    const tenantId = await getTenantId(req)

    if (propertyId) {
      const result = await computePricePressure(tenantId, propertyId)
      return NextResponse.json({ success: true, data: result })
    }

    // zone path
    const result = await computeZoneLiquidity(tenantId, zone!)
    return NextResponse.json({ success: true, data: result })
  } catch (err) {
    log.warn('[API /market/depth GET] error', {
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
