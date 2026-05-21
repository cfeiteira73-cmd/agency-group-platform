// =============================================================================
// Agency Group — Market Order Book API
// app/api/market/order-book/route.ts
//
// GET /api/market/order-book?property_id=xxx         → full OrderBook
// GET /api/market/order-book?property_id=xxx&depth=true → order book depth
//
// Auth: isPortalAuth (NextAuth session | CRON_SECRET | ag-auth-token cookie)
// TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { isPortalAuth } from '@/lib/portalAuth'
import { getOrderBook, getOrderBookDepth } from '@/lib/market/orderBook'
import { getTenantId } from '@/lib/tenant'
import log from '@/lib/logger'

export const runtime     = 'nodejs'
export const maxDuration = 30

// ─── GET /api/market/order-book ───────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!(await isPortalAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const propertyId = searchParams.get('property_id')
    const depth      = searchParams.get('depth') === 'true'
    const levelsParam = searchParams.get('levels')
    const levels     = levelsParam ? parseInt(levelsParam, 10) : undefined

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

    if (depth) {
      // Return aggregated depth buckets
      const data = await getOrderBookDepth(tenantId, propertyId, levels)
      return NextResponse.json({ success: true, data })
    }

    // Return full order book
    const book = await getOrderBook(tenantId, propertyId)
    if (!book) {
      return NextResponse.json(
        { error: `Property ${propertyId} not found` },
        { status: 404 },
      )
    }

    return NextResponse.json({ success: true, data: book })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.warn('[API /market/order-book GET] error', { error: msg })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
