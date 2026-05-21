// =============================================================================
// Agency Group — Investor Competition API
// app/api/investors/competition/route.ts
//
// GET /api/investors/competition?property_id=<uuid>
//   Returns cached CompetitionResult for a property (latest stored analysis).
//   Falls back to a fresh computation if no stored result exists.
//
// Auth: Bearer INTERNAL_API_SECRET
// TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { getRequestCorrelationId } from '@/lib/observability/correlation'
import { CANONICAL_TENANT_UUID } from '@/lib/constants/pipeline'
import { rankCompetingInvestors } from '@/lib/investors/competitionLayer'
import { supabaseAdmin } from '@/lib/supabase'

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

// ─── GET /api/investors/competition ──────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const corrId = getRequestCorrelationId(req)

  if (!requireInternalAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenantId         = resolveTenantId()
  const { searchParams } = new URL(req.url)
  const propertyId       = searchParams.get('property_id')

  if (!propertyId) {
    return NextResponse.json(
      { error: 'property_id query parameter is required' },
      { status: 400 },
    )
  }

  try {
    const db = supabaseAdmin as any

    // ── 1. Check for a recent stored result (< 6 hours old) ──────────────────
    const staleAfter = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()

    const { data: stored, error: storeErr } = await db
      .from('competition_results')
      .select('result, computed_at')
      .eq('tenant_id', tenantId)
      .eq('property_id', propertyId)
      .gte('computed_at', staleAfter)
      .order('computed_at', { ascending: false })
      .limit(1)
      .single()

    if (!storeErr && stored?.result) {
      return NextResponse.json({
        ok:          true,
        data:        stored.result,
        cached:      true,
        computed_at: stored.computed_at,
      })
    }

    // ── 2. Compute fresh result ───────────────────────────────────────────────
    const result = await rankCompetingInvestors(propertyId, tenantId)

    // ── 3. Persist to competition_results ─────────────────────────────────────
    void db
      .from('competition_results')
      .insert({
        tenant_id:    tenantId,
        property_id:  propertyId,
        result,
        ranked_count: result.ranked_investors.length,
        strategy:     result.optimal_distribution_strategy,
        computed_at:  result.computed_at,
      })
      .then(({ error }: { error: { message: string } | null }) => {
        if (error) {
          console.error('[GET /api/investors/competition] persist failed:', error.message, { corrId })
        }
      })

    return NextResponse.json({
      ok:          true,
      data:        result,
      cached:      false,
      computed_at: result.computed_at,
    })
  } catch (err) {
    console.error('[GET /api/investors/competition]', err, { corrId, tenant_id: tenantId })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
