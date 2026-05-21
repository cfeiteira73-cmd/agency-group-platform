// Agency Group — Closing Price API
// app/api/feedback/closing-price/route.ts
// TypeScript strict — 0 errors
//
// POST /api/feedback/closing-price                      — ingest closing price (service auth)
// POST /api/feedback/closing-price?mode=calibrate       — run market calibration (service auth)
// GET  /api/feedback/closing-price                      — get recent closing prices (portal auth)
// GET  /api/feedback/closing-price?zone=x               — zone median + recent prices (portal auth)

import { NextRequest, NextResponse } from 'next/server'
import { isPortalAuth } from '@/lib/portalAuth'
import { getTenantId } from '@/lib/tenant'
import {
  ingestClosingPrice,
  getRecentClosingPrices,
  computeZoneMedianClosingPrice,
} from '@/lib/feedback/closingPriceIngestion'
import { runMarketCalibration } from '@/lib/feedback/marketFeedbackLoop'
import log from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// Service auth helper
// ---------------------------------------------------------------------------

function isServiceAuth(req: NextRequest): boolean {
  const secret = process.env.INTERNAL_API_SECRET
  if (!secret) return false
  const incoming = req.headers.get('x-service-auth')
  if (!incoming) return false
  // Constant-time compare via Buffer
  const a = Buffer.from(secret)
  const b = Buffer.from(incoming)
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isServiceAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenantId =
    process.env.DEFAULT_TENANT_ID
    ?? process.env.SYSTEM_ORG_ID
    ?? '00000000-0000-0000-0000-000000000001'

  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('mode')

  try {
    // Calibration mode
    if (mode === 'calibrate') {
      const calibrations = await runMarketCalibration(tenantId)
      return NextResponse.json({
        ok: true,
        zones_calibrated: calibrations.length,
        calibrations,
      })
    }

    // Ingest mode
    const body = await req.json() as Record<string, unknown>

    const record = await ingestClosingPrice(tenantId, {
      property_id: (body.property_id as string) ?? null,
      external_asset_id: (body.external_asset_id as string) ?? null,
      closing_price_eur: body.closing_price_eur as number,
      asking_price_eur: (body.asking_price_eur as number) ?? null,
      source: body.source as 'notario' | 'bank_confirmation' | 'manual' | 'registry',
      district: body.district as string,
      zone: (body.zone as string) ?? null,
      typology: (body.typology as string) ?? null,
      area_sqm: (body.area_sqm as number) ?? null,
      closed_at: body.closed_at as string,
      mortgage_amount_eur: (body.mortgage_amount_eur as number) ?? null,
      cash_percentage: (body.cash_percentage as number) ?? null,
      days_on_market: (body.days_on_market as number) ?? null,
    })

    return NextResponse.json({ ok: true, record }, { status: 201 })
  } catch (err) {
    log.error('[closing-price] POST failed', err as Error, { tenant_id: tenantId })
    return NextResponse.json(
      { error: 'Internal server error', detail: String(err) },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authed = await isPortalAuth(req)
  if (!authed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenantId = await getTenantId(req)
  const { searchParams } = new URL(req.url)
  const zone = searchParams.get('zone') ?? undefined
  const district = searchParams.get('district') ?? undefined
  const days = searchParams.has('days') ? parseInt(searchParams.get('days')!, 10) : undefined
  const limit = searchParams.has('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined

  try {
    const records = await getRecentClosingPrices(tenantId, { zone, district, days, limit })

    if (zone) {
      const zoneMedian = await computeZoneMedianClosingPrice(tenantId, zone, days)
      return NextResponse.json({
        zone,
        median: zoneMedian,
        records,
        count: records.length,
      }, {
        headers: { 'Cache-Control': 'no-store' },
      })
    }

    return NextResponse.json({ records, count: records.length }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    log.error('[closing-price] GET failed', err as Error, { tenant_id: tenantId })
    return NextResponse.json(
      { error: 'Internal server error', detail: String(err) },
      { status: 500 }
    )
  }
}
