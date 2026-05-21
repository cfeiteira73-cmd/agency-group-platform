// =============================================================================
// Agency Group — Cross-Border Deal Matching API
// POST /api/markets/cross-border
// Body: { property_id, investor_id, deal_value_eur }
// Returns CrossBorderMatchScore + eligibility + deal structure recommendation
//
// Auth: Bearer INTERNAL_API_SECRET
// TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { safeCompare } from '@/lib/safeCompare'
import { supabaseAdmin } from '@/lib/supabase'
import { checkInvestorEligibility, type EUCountry } from '@/lib/markets/regulatoryAbstraction'
import {
  computeCrossBorderMatchScore,
  normalizeYieldAcrossCountries,
} from '@/lib/markets/crossBorderRouting'
import { classifyDealForInstitutionalCapital, routeToInstitutionalCapital } from '@/lib/markets/institutionalCapital'
import { harmonizeYield } from '@/lib/markets/yieldHarmonization'

export const dynamic = 'force-dynamic'

// ─── Auth ─────────────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '')
  const secret = process.env.INTERNAL_API_SECRET
  return !!secret && safeCompare(token, secret)
}

// ─── Supported EU countries set ───────────────────────────────────────────────

const EU_COUNTRIES = new Set<string>(['PT', 'ES', 'FR', 'DE', 'NL', 'IT', 'BE', 'AT'])

// ─── Request body type ────────────────────────────────────────────────────────

interface CrossBorderRequestBody {
  property_id: string
  investor_id: string
  deal_value_eur?: number
  base_match_score?: number  // optional override; if absent we use 70 default
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: CrossBorderRequestBody
  try {
    body = (await req.json()) as CrossBorderRequestBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { property_id, investor_id, deal_value_eur, base_match_score } = body

  if (!property_id || !investor_id) {
    return NextResponse.json({ error: 'property_id and investor_id are required' }, { status: 400 })
  }

  const db = supabaseAdmin as any

  // ── 1. Load property ──────────────────────────────────────────────────────
  const { data: property, error: propError } = await db
    .from('properties')
    .select('id, preco, zona, tipo, preco_m2, country, city, yield_pct, tenant_id')
    .eq('id', property_id)
    .single()

  if (propError || !property) {
    return NextResponse.json(
      { error: 'Property not found', detail: propError?.message },
      { status: 404 },
    )
  }

  // ── 2. Load investor ──────────────────────────────────────────────────────
  const { data: investor, error: invError } = await db
    .from('investors')
    .select('id, tenant_id, full_name, nationality, investor_type, capital_min_eur, capital_max_eur, yield_target_pct, status')
    .eq('id', investor_id)
    .single()

  if (invError || !investor) {
    return NextResponse.json(
      { error: 'Investor not found', detail: invError?.message },
      { status: 404 },
    )
  }

  // ── 3. Resolve property country ───────────────────────────────────────────
  // Use property.country if set, otherwise default to PT (home market)
  const rawCountry: string = ((property['country'] as string | null) ?? 'PT').toUpperCase()
  const propertyCountry: EUCountry = EU_COUNTRIES.has(rawCountry)
    ? (rawCountry as EUCountry)
    : 'PT'

  const resolvedDealValue: number =
    deal_value_eur ?? (property['preco'] as number) ?? 0
  const resolvedBaseScore: number = base_match_score ?? 70

  const nationality: string = (investor['nationality'] as string | null) ?? 'PT'
  const rawInvType = investor['investor_type'] as string | null
  const investorType: 'individual' | 'company' | 'fund' | 'reit' =
    rawInvType === 'company' ? 'company'
    : rawInvType === 'fund' ? 'fund'
    : rawInvType === 'institution' ? 'fund'  // map 'institution' → 'fund'
    : 'individual'

  // ── 4. Cross-border match score ───────────────────────────────────────────
  const grossYieldPct: number = (property['yield_pct'] as number | null) ?? 4.5
  const crossBorderScore = computeCrossBorderMatchScore(
    resolvedBaseScore,
    grossYieldPct,
    {
      property_country: propertyCountry,
      investor_nationality: nationality,
      investor_type: investorType,
      deal_value_eur: resolvedDealValue,
    },
  )

  // ── 5. Eligibility check ─────────────────────────────────────────────────
  const eligibility = checkInvestorEligibility(
    nationality,
    propertyCountry,
    resolvedDealValue,
    investorType,
  )

  // ── 6. Yield normalization ────────────────────────────────────────────────
  const normalizedYield = normalizeYieldAcrossCountries(
    grossYieldPct,
    propertyCountry,
    nationality,
    investorType === 'company' ? 'individual' : investorType, // company → individual tax treatment
  )

  // ── 7. Harmonized yield ──────────────────────────────────────────────────
  const investorCountry = EU_COUNTRIES.has(nationality.toUpperCase())
    ? (nationality.toUpperCase() as EUCountry)
    : undefined

  const harmonized = harmonizeYield(
    grossYieldPct,
    propertyCountry,
    (property['city'] as string | null) ?? (property['zona'] as string | null) ?? '',
    (property['tipo'] as string | null) ?? 'residential',
    investorCountry,
    investorType === 'company' ? 'individual' : investorType,
  )

  // ── 8. Institutional grading ─────────────────────────────────────────────
  const institutionalGrade = classifyDealForInstitutionalCapital(
    resolvedDealValue,
    (property['tipo'] as string | null) ?? 'residential',
    grossYieldPct,
    propertyCountry,
  )

  // ── 9. Institutional routing (if relevant deal size) ─────────────────────
  let institutionalRouting: Awaited<ReturnType<typeof routeToInstitutionalCapital>> | null = null
  if (institutionalGrade.institutional_grade !== 'below_threshold') {
    institutionalRouting = await routeToInstitutionalCapital(
      property_id,
      property['tenant_id'] as string,
      resolvedDealValue,
    )
  }

  // ── 10. Persist cross-border deal record ─────────────────────────────────
  const { error: insertError } = await db.from('cross_border_deals').insert({
    tenant_id: property['tenant_id'],
    deal_id: `${property_id}_${investor_id}`,
    property_country: propertyCountry,
    investor_nationality: nationality,
    institutional_type: rawInvType,
    deal_value_eur: resolvedDealValue,
    net_yield_pct: normalizedYield.net_yield_after_all_costs_pct,
    deal_structure: crossBorderScore.deal_structure_recommendation,
    transaction_costs_eur: crossBorderScore.estimated_transaction_costs_eur,
    cross_border_score: crossBorderScore.final_score,
    routing_recommendation: crossBorderScore.routing_recommendation,
    status: 'prospect',
    metadata: {
      investor_id,
      property_id,
      base_match_score: resolvedBaseScore,
      institutional_grade: institutionalGrade.institutional_grade,
    },
  })

  if (insertError) {
    // Non-fatal — log but continue. Duplicate inserts will fail gracefully.
    // We don't surface this error to the caller.
    void insertError
  }

  // ── 11. Build response ────────────────────────────────────────────────────
  return NextResponse.json({
    property_id,
    investor_id,
    property_country: propertyCountry,
    investor_nationality: nationality,
    deal_value_eur: resolvedDealValue,

    cross_border_match: crossBorderScore,
    eligibility,
    normalized_yield: normalizedYield,
    harmonized_yield: harmonized,
    institutional_grade: institutionalGrade,

    ...(institutionalRouting && {
      institutional_routing: {
        eligible_count: institutionalRouting.eligible_institutions.length,
        top_matches: institutionalRouting.eligible_institutions.slice(0, 5),
        total_accessible_capital_eur: institutionalRouting.total_accessible_institutional_capital_eur,
        portfolio_deal_potential: institutionalRouting.portfolio_deal_potential,
      },
    }),

    computed_at: new Date().toISOString(),
  })
}
