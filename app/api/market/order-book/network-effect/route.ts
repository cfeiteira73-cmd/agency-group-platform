// =============================================================================
// Agency Group — Network Effect API (Order Book sub-route)
// app/api/market/order-book/network-effect/route.ts
//
// GET /api/market/order-book/network-effect → today's NetworkEffect snapshot
// GET /api/market/order-book/network-effect?history=true&days=30 → history
//
// Auth: isPortalAuth (NextAuth session | CRON_SECRET | ag-auth-token cookie)
// TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { isPortalAuth } from '@/lib/portalAuth'
import { computeNetworkEffect, getNetworkEffectHistory } from '@/lib/market/networkEffectEngine'
import { getTenantId } from '@/lib/tenant'
import log from '@/lib/logger'

export const runtime     = 'nodejs'
export const maxDuration = 30

// ─── GET /api/market/order-book/network-effect ────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!(await isPortalAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const history  = searchParams.get('history') === 'true'
    const daysParam = searchParams.get('days')
    const days     = daysParam ? parseInt(daysParam, 10) : 30

    const tenantId = await getTenantId(req)
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not resolved' }, { status: 400 })
    }

    if (history) {
      const data = await getNetworkEffectHistory(tenantId, days)
      return NextResponse.json({ success: true, data })
    }

    // Default: compute and return today's snapshot
    const data = await computeNetworkEffect(tenantId)
    return NextResponse.json({ success: true, data })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.warn('[API /market/order-book/network-effect GET] error', { error: msg })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
