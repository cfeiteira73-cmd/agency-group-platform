// =============================================================================
// Agency Group — Property Scoring Intelligence API
// GET /api/intelligence/scoring
// Returns top-scored properties + scoring distribution for the tenant.
// Auth: portal auth
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { requirePortalAuth }         from '@/lib/requirePortalAuth'
import { supabaseAdmin }             from '@/lib/supabase'
import { getRequestCorrelationId }   from '@/lib/observability/correlation'
import log                           from '@/lib/logger'

export const runtime = 'nodejs'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const check = await requirePortalAuth(req)
  if (!check.ok) return check.response

  const corrId   = getRequestCorrelationId(req)
  const tenantId = req.headers.get('x-tenant-id')
    ?? process.env.DEFAULT_TENANT_ID
    ?? process.env.SYSTEM_ORG_ID
    ?? '00000000-0000-0000-0000-000000000001'

  const { searchParams } = new URL(req.url)
  const grade = searchParams.get('grade')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100)

  try {
    const db = supabaseAdmin as any

    // Top scored properties
    let query = db
      .from('property_scores')
      .select('property_id, investment_score, opportunity_score, risk_score, yield_score, grade, confidence, scored_at')
      .eq('tenant_id', tenantId)
      .order('investment_score', { ascending: false })
      .limit(limit)

    if (grade) query = query.eq('grade', grade)

    const { data: topProperties = [] } = await query

    // Grade distribution
    const { data: allScores = [] } = await db
      .from('property_scores')
      .select('grade, investment_score')
      .eq('tenant_id', tenantId)

    const gradeDist: Record<string, number> = {}
    let totalScore = 0
    for (const s of (allScores as { grade: string | null; investment_score: number | null }[])) {
      const g = s.grade ?? 'ungraded'
      gradeDist[g] = (gradeDist[g] ?? 0) + 1
      totalScore   += s.investment_score ?? 0
    }

    const avgInvestmentScore = allScores.length > 0
      ? Math.round((totalScore / allScores.length) * 100) / 100
      : null

    return NextResponse.json(
      {
        tenant_id:            tenantId,
        top_properties:       topProperties,
        grade_distribution:   gradeDist,
        total_scored:         allScores.length,
        avg_investment_score: avgInvestmentScore,
        meta: {
          correlation_id: corrId,
          generated_at:   new Date().toISOString(),
          grade_filter:   grade ?? null,
        },
      },
      { headers: { 'x-correlation-id': corrId, 'Cache-Control': 'no-store' } },
    )
  } catch (err) {
    log.error('[intelligence/scoring] GET error', err instanceof Error ? err : new Error(String(err)))
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
