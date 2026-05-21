// =============================================================================
// Agency Group — Market Bids API
// app/api/market/bids/route.ts
//
// GET    /api/market/bids?property_id=... → BidBook
// POST   /api/market/bids                 → submit bid
// DELETE /api/market/bids?id=...&investor_id=... → withdraw bid
//
// TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { isPortalAuth } from '@/lib/portalAuth'
import { bidsEngine } from '@/lib/market/bidsEngine'
import { getTenantId } from '@/lib/tenant'
import log from '@/lib/logger'

export const runtime  = 'nodejs'
export const maxDuration = 30

// ─── GET /api/market/bids?property_id=... ────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!(await isPortalAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const propertyId = searchParams.get('property_id')

    if (!propertyId) {
      return NextResponse.json({ error: 'Missing required param: property_id' }, { status: 400 })
    }

    const tenantId = await getTenantId(req)
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not resolved' }, { status: 400 })
    }

    const bidBook = await bidsEngine.getBidBook(tenantId, propertyId)
    return NextResponse.json({ success: true, data: bidBook })
  } catch (err) {
    log.warn('[API /market/bids GET] error', {
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── POST /api/market/bids ────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!(await isPortalAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json() as Record<string, unknown>
    const { property_id, investor_id, max_price_eur, yield_target_pct, urgency_level, risk_tolerance } = body

    if (!property_id || typeof property_id !== 'string') {
      return NextResponse.json({ error: 'Missing required field: property_id' }, { status: 400 })
    }
    if (!investor_id || typeof investor_id !== 'string') {
      return NextResponse.json({ error: 'Missing required field: investor_id' }, { status: 400 })
    }
    if (!max_price_eur || typeof max_price_eur !== 'number' || max_price_eur <= 0) {
      return NextResponse.json({ error: 'Missing or invalid field: max_price_eur' }, { status: 400 })
    }
    if (!yield_target_pct || typeof yield_target_pct !== 'number') {
      return NextResponse.json({ error: 'Missing required field: yield_target_pct' }, { status: 400 })
    }

    const validUrgency   = ['immediate', 'within_30d', 'within_90d', 'flexible']
    const validRisk      = ['low', 'medium', 'high', 'opportunistic']

    if (!urgency_level || !validUrgency.includes(urgency_level as string)) {
      return NextResponse.json({ error: `urgency_level must be one of: ${validUrgency.join(', ')}` }, { status: 400 })
    }
    if (!risk_tolerance || !validRisk.includes(risk_tolerance as string)) {
      return NextResponse.json({ error: `risk_tolerance must be one of: ${validRisk.join(', ')}` }, { status: 400 })
    }

    const tenantId = await getTenantId(req)
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not resolved' }, { status: 400 })
    }

    const bid = await bidsEngine.submitBid(tenantId, property_id, investor_id, {
      max_price_eur,
      yield_target_pct: yield_target_pct as number,
      urgency_level:    urgency_level as 'immediate' | 'within_30d' | 'within_90d' | 'flexible',
      risk_tolerance:   risk_tolerance as 'low' | 'medium' | 'high' | 'opportunistic',
    })

    if (!bid) {
      return NextResponse.json({ error: 'Failed to submit bid' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: bid }, { status: 201 })
  } catch (err) {
    log.warn('[API /market/bids POST] error', {
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── DELETE /api/market/bids?id=...&investor_id=... ──────────────────────────

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  if (!(await isPortalAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const bidId     = searchParams.get('id')
    const investorId = searchParams.get('investor_id')

    if (!bidId) {
      return NextResponse.json({ error: 'Missing required param: id' }, { status: 400 })
    }
    if (!investorId) {
      return NextResponse.json({ error: 'Missing required param: investor_id' }, { status: 400 })
    }

    const tenantId = await getTenantId(req)
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not resolved' }, { status: 400 })
    }

    const ok = await bidsEngine.withdrawBid(tenantId, bidId, investorId)

    if (!ok) {
      return NextResponse.json({ error: 'Bid not found or cannot be withdrawn' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    log.warn('[API /market/bids DELETE] error', {
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
