// =============================================================================
// Agency Group — Investor Liquidity API
// app/api/investors/liquidity/route.ts
//
// GET /api/investors/liquidity?property_id=<uuid>
//   Returns LiquidityScore for a specific property.
//
// GET /api/investors/liquidity?portfolio=true
//   Returns full portfolio liquidity profile for the tenant.
//
// Auth: Bearer INTERNAL_API_SECRET
// TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { getRequestCorrelationId } from '@/lib/observability/correlation'
import { CANONICAL_TENANT_UUID } from '@/lib/constants/pipeline'
import {
  computeLiquidityScore,
  getPortfolioLiquidityProfile,
} from '@/lib/investors/liquidityEngine'

export const runtime = 'nodejs'

// ─── Auth helper ──────────────────────────────────────────────────────────────

function requireInternalAuth(req: NextRequest): boolean {
  const secret = process.env.INTERNAL_API_SECRET
  if (!secret) return false
  const header = req.headers.get('authorization') ?? ''
  return header === `Bearer ${secret}`
}

// ─── Tenant helper ─────────────────────────────────────────────────────────────

function resolveTenantId(): string {
  return (
    process.env.DEFAULT_TENANT_ID ??
    process.env.SYSTEM_ORG_ID     ??
    CANONICAL_TENANT_UUID
  )
}

// ─── GET /api/investors/liquidity ─────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const corrId = getRequestCorrelationId(req)

  if (!requireInternalAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenantId         = resolveTenantId()
  const { searchParams } = new URL(req.url)
  const propertyId       = searchParams.get('property_id')
  const portfolio        = searchParams.get('portfolio')

  try {
    // ── Portfolio profile ──────────────────────────────────────────────────────
    if (portfolio === 'true') {
      const profile = await getPortfolioLiquidityProfile(tenantId)

      return NextResponse.json({
        ok:          true,
        data:        profile,
        computed_at: new Date().toISOString(),
      })
    }

    // ── Single property ────────────────────────────────────────────────────────
    if (!propertyId) {
      return NextResponse.json(
        { error: 'Provide property_id=<uuid> or portfolio=true' },
        { status: 400 },
      )
    }

    const score = await computeLiquidityScore(propertyId, tenantId)

    return NextResponse.json({ ok: true, data: score })
  } catch (err) {
    console.error('[GET /api/investors/liquidity]', err, { corrId, tenant_id: tenantId })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
