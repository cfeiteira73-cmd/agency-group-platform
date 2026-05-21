// =============================================================================
// Agency Group — Market Clearing API
// app/api/market/clearing/route.ts
//
// GET  /api/market/clearing?property_id=... → MarketClearingResult
// GET  /api/market/clearing?zone=ZONE_NAME  → ZoneClearingSnapshot
// POST /api/market/clearing/run             → run daily zone clearing (service auth only)
//
// TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { isPortalAuth } from '@/lib/portalAuth'
import {
  computeMarketClearing,
  computeZoneClearing,
  runDailyZoneClearing,
} from '@/lib/market/marketClearingEngine'
import { getTenantId } from '@/lib/tenant'
import log from '@/lib/logger'

export const runtime     = 'nodejs'
export const maxDuration = 60

// ─── Service-level authentication for internal jobs ───────────────────────────

function isServiceAuth(req: NextRequest): boolean {
  const auth   = req.headers.get('authorization') ?? ''
  const secret = process.env.CRON_SECRET ?? ''
  if (!secret) return false
  return auth === `Bearer ${secret}`
}

// ─── GET /api/market/clearing ─────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!(await isPortalAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const propertyId = searchParams.get('property_id')
    const zone       = searchParams.get('zone')

    const tenantId = await getTenantId(req)
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not resolved' }, { status: 400 })
    }

    // ── property clearing ──────────────────────────────────────────────────────
    if (propertyId) {
      const result = await computeMarketClearing(tenantId, propertyId)
      return NextResponse.json({ success: true, data: result })
    }

    // ── zone clearing ──────────────────────────────────────────────────────────
    if (zone) {
      const snapshot = await computeZoneClearing(tenantId, zone)
      return NextResponse.json({ success: true, data: snapshot })
    }

    return NextResponse.json(
      { error: 'Missing required param: property_id or zone' },
      { status: 400 },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.warn('[API /market/clearing GET] error', { error: msg })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── POST /api/market/clearing/run ───────────────────────────────────────────
// Triggered by Vercel cron or internal scheduler — service auth required.

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isServiceAuth(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const tenantId = await getTenantId(req)
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not resolved' }, { status: 400 })
    }

    log.info('[API /market/clearing POST] daily zone clearing started', { tenant_id: tenantId })

    const result = await runDailyZoneClearing(tenantId)

    log.info('[API /market/clearing POST] daily zone clearing complete', {
      tenant_id:       tenantId,
      zones_processed: result.zones_processed,
      snapshots_saved: result.snapshots_saved,
    })

    return NextResponse.json({ success: true, data: result })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.warn('[API /market/clearing POST] error', { error: msg })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
