// =============================================================================
// Agency Group — Investor Watchlist API
// GET    /api/investors/watchlist?investor_id=UUID  — get watchlist
// POST   /api/investors/watchlist                   — add to watchlist
// DELETE /api/investors/watchlist?investor_id=UUID&property_id=UUID — remove
//
// Auth: requirePortalAuth
// Tenant: DEFAULT_TENANT_ID → SYSTEM_ORG_ID → CANONICAL_TENANT_UUID
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { requirePortalAuth } from '@/lib/requirePortalAuth'
import {
  addToWatchlist,
  removeFromWatchlist,
  getInvestorWatchlist,
} from '@/lib/investors/watchlistService'

export const runtime = 'nodejs'

// ---------------------------------------------------------------------------
// Tenant helper
// ---------------------------------------------------------------------------

function resolveTenantId(): string {
  return (
    process.env.DEFAULT_TENANT_ID ??
    process.env.SYSTEM_ORG_ID ??
    '00000000-0000-0000-0000-000000000001'
  )
}

// ---------------------------------------------------------------------------
// GET /api/investors/watchlist?investor_id=UUID
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await requirePortalAuth(req)
  if (!auth.ok) return auth.response

  const tenantId = resolveTenantId()

  try {
    const { searchParams } = new URL(req.url)
    const investorId = searchParams.get('investor_id')

    if (!investorId) {
      return NextResponse.json(
        { error: 'investor_id query parameter is required' },
        { status: 400 },
      )
    }

    const watchlist = await getInvestorWatchlist(investorId, tenantId)

    return NextResponse.json({
      investor_id: investorId,
      watchlist,
      count: watchlist.length,
    })
  } catch (err) {
    console.error('[GET /api/investors/watchlist]', err, { tenant_id: tenantId })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// POST /api/investors/watchlist
// Body: { investor_id, property_id, priority?, notes? }
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = await requirePortalAuth(req)
  if (!auth.ok) return auth.response

  const tenantId = resolveTenantId()

  try {
    const body = await req.json() as Record<string, unknown>

    const investorId = typeof body.investor_id === 'string' ? body.investor_id.trim() : null
    const propertyId = typeof body.property_id === 'string' ? body.property_id.trim() : null

    if (!investorId) {
      return NextResponse.json({ error: 'investor_id is required' }, { status: 400 })
    }
    if (!propertyId) {
      return NextResponse.json({ error: 'property_id is required' }, { status: 400 })
    }

    const VALID_PRIORITIES = ['urgent', 'high', 'normal', 'low'] as const
    type Priority = typeof VALID_PRIORITIES[number]

    const priority: Priority | undefined =
      typeof body.priority === 'string' && (VALID_PRIORITIES as readonly string[]).includes(body.priority)
        ? (body.priority as Priority)
        : undefined

    const notes = typeof body.notes === 'string' ? body.notes.trim() : undefined

    await addToWatchlist(investorId, propertyId, tenantId, priority, notes)

    return NextResponse.json(
      { message: 'Property added to watchlist', investor_id: investorId, property_id: propertyId },
      { status: 201 },
    )
  } catch (err) {
    console.error('[POST /api/investors/watchlist]', err, { tenant_id: tenantId })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/investors/watchlist?investor_id=UUID&property_id=UUID
// ---------------------------------------------------------------------------

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const auth = await requirePortalAuth(req)
  if (!auth.ok) return auth.response

  const tenantId = resolveTenantId()

  try {
    const { searchParams } = new URL(req.url)
    const investorId = searchParams.get('investor_id')
    const propertyId = searchParams.get('property_id')

    if (!investorId) {
      return NextResponse.json({ error: 'investor_id query parameter is required' }, { status: 400 })
    }
    if (!propertyId) {
      return NextResponse.json({ error: 'property_id query parameter is required' }, { status: 400 })
    }

    await removeFromWatchlist(investorId, propertyId, tenantId)

    return NextResponse.json(
      { message: 'Property removed from watchlist', investor_id: investorId, property_id: propertyId },
      { status: 200 },
    )
  } catch (err) {
    console.error('[DELETE /api/investors/watchlist]', err, { tenant_id: tenantId })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
