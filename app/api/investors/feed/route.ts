// =============================================================================
// Agency Group — Investor Feed API
// GET /api/investors/feed?investor_id=UUID&limit=20&offset=0
//
// Returns investor's active matches sorted by engagement-weighted routing score.
// Falls back to raw match_score order if the routing engine fails.
//
// Auth: requirePortalAuth
// Tenant: DEFAULT_TENANT_ID → SYSTEM_ORG_ID → CANONICAL_TENANT_UUID
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { requirePortalAuth } from '@/lib/requirePortalAuth'
import { supabaseAdmin } from '@/lib/supabase'
import { routeProperty } from '@/lib/investors/routingEngine'
import type { InvestorMatchResult } from '@/lib/investors/types'

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
// Internal shapes
// ---------------------------------------------------------------------------

interface StoredMatch {
  id:          string
  investor_id: string
  property_id: string
  match_score: number
  status:      string | null
  computed_at: string | null
  dimensions:  Record<string, number> | null
  properties:  Record<string, unknown> | null
}

interface InvestorRow {
  id:                       string
  tenant_id:                string
  full_name:                string
  email:                    string | null
  phone:                    string | null
  company:                  string | null
  nationality:              string | null
  investor_type:            string | null
  capital_min_eur:          number | null
  capital_max_eur:          number | null
  yield_target_pct:         number | null
  risk_tolerance:           string | null
  geography_preference:     string[] | null
  property_type_preference: string[] | null
  status:                   string
  notes:                    string | null
  source:                   string | null
  assigned_agent:           string | null
  created_at:               string
  updated_at:               string
  last_matched_at:          string | null
}

// ---------------------------------------------------------------------------
// GET /api/investors/feed
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await requirePortalAuth(req)
  if (!auth.ok) return auth.response

  const tenantId = resolveTenantId()

  try {
    const { searchParams } = new URL(req.url)
    const investorId = searchParams.get('investor_id')
    const limit  = Math.min(100, Math.max(1, parseInt(searchParams.get('limit')  ?? '20', 10)))
    const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10))

    if (!investorId) {
      return NextResponse.json(
        { error: 'investor_id query parameter is required' },
        { status: 400 },
      )
    }

    const db = supabaseAdmin as any

    // ── 1. Fetch active investor_matches for this investor ──────────────────
    const { data: matchData, error: matchErr } = await db
      .from('investor_matches')
      .select('id, investor_id, property_id, match_score, status, computed_at, dimensions, properties(*)')
      .eq('tenant_id',   tenantId)
      .eq('investor_id', investorId)
      .eq('status',      'pending')
      .order('match_score', { ascending: false })
      .limit(200)  // load a wider window for routing engine; paginate after

    if (matchErr) {
      console.error('[GET /api/investors/feed] investor_matches query failed:', matchErr.message)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const storedMatches = (matchData ?? []) as StoredMatch[]

    if (storedMatches.length === 0) {
      return NextResponse.json({
        investor_id: investorId,
        feed:        [],
        count:       0,
        total:       0,
        limit,
        offset,
      })
    }

    // ── 2. Load investor profile ────────────────────────────────────────────
    const { data: invData, error: invErr } = await db
      .from('investors')
      .select('*')
      .eq('id',        investorId)
      .eq('tenant_id', tenantId)
      .single()

    if (invErr || !invData) {
      console.error('[GET /api/investors/feed] investor not found:', invErr?.message)
      return NextResponse.json({ error: 'Investor not found' }, { status: 404 })
    }

    const investorRow = invData as InvestorRow

    // ── 3. Build InvestorMatchResult[] for the routing engine ───────────────
    const baseMatches: InvestorMatchResult[] = storedMatches.map(m => ({
      investor_id:  m.investor_id,
      property_id:  m.property_id,
      match_score:  m.match_score,
      dimensions: {
        capital_fit:   (m.dimensions?.capital_fit   ?? 0) as number,
        yield_fit:     (m.dimensions?.yield_fit     ?? 0) as number,
        geography_fit: (m.dimensions?.geography_fit ?? 0) as number,
        risk_fit:      (m.dimensions?.risk_fit      ?? 0) as number,
        type_fit:      (m.dimensions?.type_fit      ?? 0) as number,
      },
      investor: {
        id:                       investorRow.id,
        tenant_id:                investorRow.tenant_id,
        full_name:                investorRow.full_name,
        email:                    investorRow.email,
        phone:                    investorRow.phone,
        company:                  investorRow.company,
        nationality:              investorRow.nationality,
        investor_type:            (investorRow.investor_type as InvestorMatchResult['investor']['investor_type']) ?? null,
        capital_min_eur:          investorRow.capital_min_eur,
        capital_max_eur:          investorRow.capital_max_eur,
        yield_target_pct:         investorRow.yield_target_pct,
        risk_tolerance:           (investorRow.risk_tolerance as InvestorMatchResult['investor']['risk_tolerance']) ?? null,
        geography_preference:     investorRow.geography_preference,
        property_type_preference: investorRow.property_type_preference,
        status:                   (investorRow.status as InvestorMatchResult['investor']['status']),
        notes:                    investorRow.notes,
        source:                   investorRow.source,
        assigned_agent:           investorRow.assigned_agent,
        created_at:               investorRow.created_at,
        updated_at:               investorRow.updated_at,
        last_matched_at:          investorRow.last_matched_at,
      },
      computed_at: m.computed_at ?? new Date().toISOString(),
    }))

    // ── 4. Route property — use first property_id as anchor ────────────────
    //   The routing engine groups all matches by investor, so we pass all matches
    //   with a synthetic property_id anchor (the first one).
    const anchorPropertyId = storedMatches[0]?.property_id ?? 'unknown'

    let sortedRoutes: { investor_id: string; final_routing_score: number; routing_tier: string; base_match_score: number }[]

    try {
      const routingResult = await routeProperty(anchorPropertyId, tenantId, baseMatches)
      sortedRoutes = routingResult.routes.map(r => ({
        investor_id:          r.investor_id,
        final_routing_score:  r.final_routing_score,
        routing_tier:         r.routing_tier,
        base_match_score:     r.base_match_score,
      }))
    } catch (routingErr) {
      console.error('[GET /api/investors/feed] routing engine failed, using raw scores:', routingErr)
      // Graceful fallback: sort by raw match_score
      sortedRoutes = baseMatches
        .slice()
        .sort((a, b) => b.match_score - a.match_score)
        .map(m => ({
          investor_id:         m.investor_id,
          final_routing_score: m.match_score,
          routing_tier:        m.match_score >= 85 ? 'immediate'
            : m.match_score >= 70 ? 'priority'
            : m.match_score >= 50 ? 'standard'
            : 'low',
          base_match_score:    m.match_score,
        }))
    }

    // ── 5. Merge routing scores back with stored match data ─────────────────
    const matchByInvestorId = new Map(storedMatches.map(m => [m.investor_id, m]))

    const feed = sortedRoutes.map(r => {
      const stored = matchByInvestorId.get(r.investor_id)
      return {
        investor_id:         r.investor_id,
        property_id:         stored?.property_id ?? null,
        base_match_score:    r.base_match_score,
        final_routing_score: r.final_routing_score,
        routing_tier:        r.routing_tier,
        property:            stored?.properties ?? null,
      }
    })

    // ── 6. Paginate ────────────────────────────────────────────────────────
    const total      = feed.length
    const paginated  = feed.slice(offset, offset + limit)

    return NextResponse.json({
      investor_id: investorId,
      feed:        paginated,
      count:       paginated.length,
      total,
      limit,
      offset,
    })
  } catch (err) {
    console.error('[GET /api/investors/feed]', err, { tenant_id: tenantId })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
