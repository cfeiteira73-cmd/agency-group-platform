// =============================================================================
// Agency Group — Market Liquidity API
// app/api/market/liquidity/route.ts
//
// GET /api/market/liquidity?property_id=... → LiquidityFormationResult
//
// TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { isPortalAuth } from '@/lib/portalAuth'
import { computeLiquidityFormation } from '@/lib/market/liquidityFormation'
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

    if (!propertyId) {
      return NextResponse.json(
        { error: 'Missing required param: property_id' },
        { status: 400 },
      )
    }

    const tenantId = await getTenantId(req)
    const result   = await computeLiquidityFormation(tenantId, propertyId)

    return NextResponse.json({ success: true, data: result })
  } catch (err) {
    log.warn('[API /market/liquidity GET] error', {
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
