// =============================================================================
// Agency Group — Investors API — Collection
// GET  /api/investors — list investors with optional filters
// POST /api/investors — create a new investor
//
// Auth: requirePortalAuth (NextAuth session | magic-link | service token)
// Tenant: DEFAULT_TENANT_ID → SYSTEM_ORG_ID → CANONICAL_TENANT_UUID
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { requirePortalAuth } from '@/lib/requirePortalAuth'
import { getRequestCorrelationId } from '@/lib/observability/correlation'
import { CANONICAL_TENANT_UUID } from '@/lib/constants/pipeline'
import { createInvestor, getInvestors } from '@/lib/investors/investorService'
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
// GET /api/investors
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  const corrId = getRequestCorrelationId(req)

  const auth = await requirePortalAuth(req)
  if (!auth.ok) return auth.response

  const tenantId = resolveTenantId()

  try {
    const { searchParams } = new URL(req.url)

    const status        = searchParams.get('status') as InvestorStatus | null
    const risk_tolerance = searchParams.get('risk_tolerance') as RiskTolerance | null
    const limit         = Math.min(200, Math.max(1, parseInt(searchParams.get('limit')  ?? '100', 10)))
    const offset        = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10))

    const investors = await getInvestors(tenantId, {
      ...(status         ? { status }         : {}),
      ...(risk_tolerance ? { risk_tolerance } : {}),
      limit,
      offset,
    })

    return NextResponse.json({
      investors,
      count:  investors.length,
      limit,
      offset,
    })
  } catch (err) {
    console.error('[GET /api/investors]', err, { corrId, tenant_id: tenantId })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// POST /api/investors
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  const corrId = getRequestCorrelationId(req)

  const auth = await requirePortalAuth(req)
  if (!auth.ok) return auth.response

  const tenantId = resolveTenantId()

  try {
    const body = await req.json() as Record<string, unknown>

    // ── Required field validation ─────────────────────────────────────────
    const full_name = typeof body.full_name === 'string' ? body.full_name.trim() : null
    if (!full_name || full_name.length < 2) {
      return NextResponse.json(
        { error: 'full_name is required (min 2 characters)' },
        { status: 400 },
      )
    }

    // ── Optional field coercion ───────────────────────────────────────────
    const email               = typeof body.email               === 'string' ? body.email.trim()    : null
    const phone               = typeof body.phone               === 'string' ? body.phone.trim()    : null
    const company             = typeof body.company             === 'string' ? body.company.trim()  : null
    const nationality         = typeof body.nationality         === 'string' ? body.nationality.trim() : null
    const notes               = typeof body.notes               === 'string' ? body.notes.trim()   : null
    const source              = typeof body.source              === 'string' ? body.source.trim()  : null
    const assigned_agent      = typeof body.assigned_agent      === 'string' ? body.assigned_agent.trim() : null

    const capital_min_eur     = typeof body.capital_min_eur     === 'number' && body.capital_min_eur > 0
      ? Math.round(body.capital_min_eur) : null
    const capital_max_eur     = typeof body.capital_max_eur     === 'number' && body.capital_max_eur > 0
      ? Math.round(body.capital_max_eur) : null
    const yield_target_pct    = typeof body.yield_target_pct    === 'number' && body.yield_target_pct >= 0
      ? body.yield_target_pct : null

    // Validate capital range ordering
    if (capital_min_eur !== null && capital_max_eur !== null && capital_min_eur > capital_max_eur) {
      return NextResponse.json(
        { error: 'capital_min_eur must be less than or equal to capital_max_eur' },
        { status: 400 },
      )
    }

    // Validate enums
    const VALID_RISK: RiskTolerance[]  = ['conservative', 'moderate', 'aggressive']
    const VALID_STATUS: InvestorStatus[] = ['active', 'inactive', 'archived']

    const risk_tolerance = typeof body.risk_tolerance === 'string' && VALID_RISK.includes(body.risk_tolerance as RiskTolerance)
      ? (body.risk_tolerance as RiskTolerance) : null

    const status = typeof body.status === 'string' && VALID_STATUS.includes(body.status as InvestorStatus)
      ? (body.status as InvestorStatus) : 'active'

    // Arrays
    const geography_preference = Array.isArray(body.geography_preference)
      ? (body.geography_preference as unknown[]).map(v => String(v).trim()).filter(Boolean)
      : null

    const property_type_preference = Array.isArray(body.property_type_preference)
      ? (body.property_type_preference as unknown[]).map(v => String(v).trim().toLowerCase()).filter(Boolean)
      : null

    const investor = await createInvestor(
      {
        full_name,
        email,
        phone,
        company,
        nationality,
        capital_min_eur,
        capital_max_eur,
        yield_target_pct,
        risk_tolerance,
        geography_preference,
        property_type_preference,
        status,
        notes,
        source,
        assigned_agent,
      },
      tenantId,
    )

    console.log(`[POST /api/investors] created investor ${investor.id} — "${investor.full_name}" | tenant=${tenantId}`, { corrId })

    return NextResponse.json({ investor }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/investors]', err, { corrId, tenant_id: tenantId })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
