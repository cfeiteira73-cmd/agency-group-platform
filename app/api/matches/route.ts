// =============================================================================
// Agency Group — Matches API
// GET /api/matches — list matches (portal auth required)
// GET /api/matches?lead_id=X — matches for a specific lead
// GET /api/matches?status=interested — filter by status
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { portalAuthGate } from '@/lib/requirePortalAuth'

export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ---------------------------------------------------------------------------
// GET /api/matches
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  const gate = await portalAuthGate(req)
  if (!gate.authed) return gate.response

  const { searchParams } = new URL(req.url)
  const leadId    = searchParams.get('lead_id')
  const status    = searchParams.get('status')
  const limit     = Math.min(Number(searchParams.get('limit') ?? '50'), 100)
  const page      = Math.max(Number(searchParams.get('page') ?? '1'), 1)
  const offset    = (page - 1) * limit

  let query = supabase
    .from('matches')
    .select(`
      id, lead_id, property_id, match_score, match_reasons,
      status, agent_email, created_at, updated_at,
      metadata
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (leadId) query = query.eq('lead_id', leadId)
  if (status) query = query.eq('status', status)

  const { data, error, count } = await query

  if (error) {
    // Table may not exist in older deployments
    if (error.code === '42P01') {
      return NextResponse.json({ matches: [], total: 0, page, limit })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    matches: data ?? [],
    total:   count ?? 0,
    page,
    limit,
  })
}
