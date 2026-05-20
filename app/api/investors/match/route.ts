// =============================================================================
// Agency Group — Investors Match API
// POST /api/investors/match        — { property_id } → run matching, return ranked investors
// GET  /api/investors/match?investor_id=X — all stored matches for an investor
// GET  /api/investors/match?property_id=X — all investors matched to a property
//
// Auth: requirePortalAuth
// Tenant: DEFAULT_TENANT_ID → SYSTEM_ORG_ID → CANONICAL_TENANT_UUID
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { requirePortalAuth } from '@/lib/requirePortalAuth'
import { getRequestCorrelationId } from '@/lib/observability/correlation'
import { CANONICAL_TENANT_UUID } from '@/lib/constants/pipeline'
import {
  runMatchingForProperty,
  getMatchesForInvestor,
  getMatchesForProperty,
} from '@/lib/investors/investorService'

export const runtime = 'nodejs'

// ---------------------------------------------------------------------------
// Tenant helper
// ---------------------------------------------------------------------------

function resolveTenantId(): string {
  return (
    process.env.DEFAULT_TENANT_ID ??
    process.env.SYSTEM_ORG_ID ??
    CANONICAL_TENANT_UUID
  )
}

// ---------------------------------------------------------------------------
// GET /api/investors/match
// ?investor_id=X  → stored matches for an investor (with property data)
// ?property_id=X  → stored matches for a property (with investor data)
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  const corrId   = getRequestCorrelationId(req)
  const tenantId = resolveTenantId()

  const auth = await requirePortalAuth(req)
  if (!auth.ok) return auth.response

  try {
    const { searchParams } = new URL(req.url)
    const investorId  = searchParams.get('investor_id')
    const propertyId  = searchParams.get('property_id')
    const limit       = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)))

    if (!investorId && !propertyId) {
      return NextResponse.json(
        { error: 'Provide investor_id or property_id as query parameter' },
        { status: 400 },
      )
    }

    if (investorId && propertyId) {
      return NextResponse.json(
        { error: 'Provide either investor_id or property_id — not both' },
        { status: 400 },
      )
    }

    if (investorId) {
      const matches = await getMatchesForInvestor(investorId, tenantId, limit)
      return NextResponse.json({
        investor_id: investorId,
        matches,
        count: matches.length,
      })
    }

    // propertyId branch
    const matches = await getMatchesForProperty(propertyId!, tenantId, limit)
    return NextResponse.json({
      property_id: propertyId,
      matches,
      count: matches.length,
    })
  } catch (err) {
    console.error('[GET /api/investors/match]', err, { corrId, tenant_id: tenantId })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// POST /api/investors/match
// Body: { property_id: string }
// Runs the full matching engine, upserts results, returns ranked list
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  const corrId   = getRequestCorrelationId(req)
  const tenantId = resolveTenantId()

  const auth = await requirePortalAuth(req)
  if (!auth.ok) return auth.response

  try {
    const body = await req.json() as Record<string, unknown>

    const property_id = typeof body.property_id === 'string' ? body.property_id.trim() : null
    if (!property_id) {
      return NextResponse.json({ error: 'property_id is required' }, { status: 400 })
    }

    const ranked = await runMatchingForProperty(property_id, tenantId)

    const qualifying = ranked.filter(r => r.match_score >= 50)
    const top        = ranked.slice(0, 20)

    console.log(
      `[POST /api/investors/match] property=${property_id} scored=${ranked.length} qualifying(≥50)=${qualifying.length} | tenant=${tenantId}`,
      { corrId },
    )

    return NextResponse.json({
      property_id,
      total_scored:    ranked.length,
      total_qualifying: qualifying.length,
      top_matches: top.map(r => ({
        investor_id:   r.investor_id,
        investor_name: r.investor.full_name,
        match_score:   r.match_score,
        dimensions:    r.dimensions,
        computed_at:   r.computed_at,
      })),
      computed_at: new Date().toISOString(),
    })
  } catch (err) {
    const message = (err as Error).message ?? String(err)

    // Property not found is a client error
    if (message.includes('not found')) {
      return NextResponse.json({ error: message }, { status: 404 })
    }

    console.error('[POST /api/investors/match]', err, { corrId, tenant_id: tenantId })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
