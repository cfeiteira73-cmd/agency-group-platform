// =============================================================================
// Agency Group — Investor Competition Simulate API
// app/api/investors/competition/simulate/route.ts
//
// POST /api/investors/competition/simulate
//   Body: { property_id: string, max_investors?: number }
//   Triggers a fresh competition ranking computation (bypasses cache),
//   persists the result, and returns it.
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

// ─── POST /api/investors/competition/simulate ─────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const corrId = getRequestCorrelationId(req)

  if (!requireInternalAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenantId = resolveTenantId()

  try {
    const body = await req.json() as Record<string, unknown>

    const property_id = typeof body.property_id === 'string' ? body.property_id.trim() : null
    if (!property_id) {
      return NextResponse.json({ error: 'property_id is required' }, { status: 400 })
    }

    const max_investors = typeof body.max_investors === 'number'
      ? Math.min(Math.max(1, Math.floor(body.max_investors)), 50)
      : undefined

    // ── Fresh competition ranking (always bypasses cache) ─────────────────────
    const result = await rankCompetingInvestors(property_id, tenantId, max_investors)

    console.log(
      `[POST /api/investors/competition/simulate] property=${property_id} ranked=${result.ranked_investors.length} strategy=${result.optimal_distribution_strategy} | tenant=${tenantId}`,
      { corrId },
    )

    // ── Persist to competition_results ─────────────────────────────────────────
    const db = supabaseAdmin as any

    void db
      .from('competition_results')
      .insert({
        tenant_id:    tenantId,
        property_id,
        result,
        ranked_count: result.ranked_investors.length,
        strategy:     result.optimal_distribution_strategy,
        computed_at:  result.computed_at,
      })
      .then(({ error }: { error: { message: string } | null }) => {
        if (error) {
          console.error('[POST /api/investors/competition/simulate] persist failed:', error.message, { corrId })
        }
      })

    return NextResponse.json(
      { ok: true, data: result, computed_at: result.computed_at },
      { status: 201 },
    )
  } catch (err) {
    console.error('[POST /api/investors/competition/simulate]', err, { corrId, tenant_id: tenantId })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
