// =============================================================================
// Agency Group — Investors API — Single Resource
// GET    /api/investors/[id] — get investor by id
// PATCH  /api/investors/[id] — update investor
// DELETE /api/investors/[id] — soft-delete (status → 'archived')
//
// Auth: requirePortalAuth
// Tenant boundary enforced on every query — tenant_id always in WHERE clause.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { requirePortalAuth } from '@/lib/requirePortalAuth'
import { getRequestCorrelationId } from '@/lib/observability/correlation'
import { CANONICAL_TENANT_UUID } from '@/lib/constants/pipeline'
import {
  getInvestor,
  updateInvestor,
} from '@/lib/investors/investorService'
import type { RiskTolerance, InvestorStatus } from '@/lib/investors/types'

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
// Route params type
// ---------------------------------------------------------------------------

interface RouteParams {
  params: Promise<{ id: string }>
}

// ---------------------------------------------------------------------------
// GET /api/investors/[id]
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const corrId   = getRequestCorrelationId(req)
  const { id }   = await params
  const tenantId = resolveTenantId()

  const auth = await requirePortalAuth(req)
  if (!auth.ok) return auth.response

  try {
    const investor = await getInvestor(id, tenantId)

    if (!investor) {
      return NextResponse.json({ error: 'Investor not found' }, { status: 404 })
    }

    return NextResponse.json({ investor })
  } catch (err) {
    console.error(`[GET /api/investors/${id}]`, err, { corrId, tenant_id: tenantId })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/investors/[id]
// ---------------------------------------------------------------------------

export async function PATCH(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const corrId   = getRequestCorrelationId(req)
  const { id }   = await params
  const tenantId = resolveTenantId()

  const auth = await requirePortalAuth(req)
  if (!auth.ok) return auth.response

  try {
    // Verify exists + tenant boundary before update
    const existing = await getInvestor(id, tenantId)
    if (!existing) {
      return NextResponse.json({ error: 'Investor not found' }, { status: 404 })
    }

    // Archived investors cannot be updated (only un-archived via status field explicitly)
    if (existing.status === 'archived') {
      return NextResponse.json(
        { error: 'Cannot update an archived investor — restore it first by setting status to active' },
        { status: 409 },
      )
    }

    const body = await req.json() as Record<string, unknown>

    // ── Enum validation ───────────────────────────────────────────────────
    const VALID_RISK: RiskTolerance[]  = ['conservative', 'moderate', 'aggressive']
    const VALID_STATUS: InvestorStatus[] = ['active', 'inactive', 'archived']

    const patch: Record<string, unknown> = {}

    if (typeof body.full_name    === 'string') patch.full_name    = body.full_name.trim()
    if (typeof body.email        === 'string') patch.email        = body.email.trim()
    if (typeof body.phone        === 'string') patch.phone        = body.phone.trim()
    if (typeof body.company      === 'string') patch.company      = body.company.trim()
    if (typeof body.nationality  === 'string') patch.nationality  = body.nationality.trim()
    if (typeof body.notes        === 'string') patch.notes        = body.notes.trim()
    if (typeof body.source       === 'string') patch.source       = body.source.trim()
    if (typeof body.assigned_agent === 'string') patch.assigned_agent = body.assigned_agent.trim()

    if (typeof body.capital_min_eur === 'number' && body.capital_min_eur >= 0) {
      patch.capital_min_eur = Math.round(body.capital_min_eur)
    }
    if (typeof body.capital_max_eur === 'number' && body.capital_max_eur >= 0) {
      patch.capital_max_eur = Math.round(body.capital_max_eur)
    }
    if (typeof body.yield_target_pct === 'number' && body.yield_target_pct >= 0) {
      patch.yield_target_pct = body.yield_target_pct
    }

    if (typeof body.risk_tolerance === 'string' && VALID_RISK.includes(body.risk_tolerance as RiskTolerance)) {
      patch.risk_tolerance = body.risk_tolerance
    }
    if (typeof body.status === 'string' && VALID_STATUS.includes(body.status as InvestorStatus)) {
      patch.status = body.status
    }

    if (Array.isArray(body.geography_preference)) {
      patch.geography_preference = (body.geography_preference as unknown[]).map(v => String(v).trim()).filter(Boolean)
    }
    if (Array.isArray(body.property_type_preference)) {
      patch.property_type_preference = (body.property_type_preference as unknown[]).map(v => String(v).trim().toLowerCase()).filter(Boolean)
    }

    // Validate capital ordering if both are being set
    const newMin = (patch.capital_min_eur as number | undefined) ?? existing.capital_min_eur
    const newMax = (patch.capital_max_eur as number | undefined) ?? existing.capital_max_eur
    if (newMin !== null && newMin !== undefined && newMax !== null && newMax !== undefined && newMin > newMax) {
      return NextResponse.json(
        { error: 'capital_min_eur must be less than or equal to capital_max_eur' },
        { status: 400 },
      )
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 })
    }

    const investor = await updateInvestor(id, patch, tenantId)

    console.log(`[PATCH /api/investors/${id}] updated | tenant=${tenantId}`, { corrId })

    return NextResponse.json({ investor })
  } catch (err) {
    console.error(`[PATCH /api/investors/${id}]`, err, { corrId, tenant_id: tenantId })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/investors/[id]  —  soft delete
// ---------------------------------------------------------------------------

export async function DELETE(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const corrId   = getRequestCorrelationId(req)
  const { id }   = await params
  const tenantId = resolveTenantId()

  const auth = await requirePortalAuth(req)
  if (!auth.ok) return auth.response

  try {
    const existing = await getInvestor(id, tenantId)
    if (!existing) {
      return NextResponse.json({ error: 'Investor not found' }, { status: 404 })
    }

    if (existing.status === 'archived') {
      return NextResponse.json({ error: 'Investor is already archived' }, { status: 409 })
    }

    await updateInvestor(id, { status: 'archived' }, tenantId)

    console.log(`[DELETE /api/investors/${id}] archived | tenant=${tenantId}`, { corrId })

    return NextResponse.json({ success: true, id, status: 'archived' })
  } catch (err) {
    console.error(`[DELETE /api/investors/${id}]`, err, { corrId, tenant_id: tenantId })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
