// =============================================================================
// Agency Group — European Markets API
// GET /api/markets?country=PT&city=Lisbon
//   Returns CountryRegulatoryProfile + live market data from Supabase
// GET /api/markets?country=PT&city=Lisbon&yield_pct=4.5&investor_nationality=US&investor_type=fund
//   Returns HarmonizedYield for a specific investor profile
//
// Auth: Bearer INTERNAL_API_SECRET
// TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { safeCompare } from '@/lib/safeCompare'
import { supabaseAdmin } from '@/lib/supabase'
import {
  COUNTRY_PROFILES,
  computeTransactionCosts,
  checkInvestorEligibility,
  type EUCountry,
} from '@/lib/markets/regulatoryAbstraction'
import { harmonizeYield } from '@/lib/markets/yieldHarmonization'

export const dynamic = 'force-dynamic'

// ─── Auth ─────────────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '')
  const secret = process.env.INTERNAL_API_SECRET
  return !!secret && safeCompare(token, secret)
}

// ─── Valid countries ──────────────────────────────────────────────────────────

const VALID_COUNTRIES = new Set<string>(['PT', 'ES', 'FR', 'DE', 'NL', 'IT', 'BE', 'AT'])

// ─── GET handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sp = req.nextUrl.searchParams
  const country = (sp.get('country') ?? '').toUpperCase()
  const city = sp.get('city') ?? undefined

  // Validate country
  if (!VALID_COUNTRIES.has(country)) {
    return NextResponse.json(
      {
        error: 'Invalid country. Must be one of: PT, ES, FR, DE, NL, IT, BE, AT',
        supported: Array.from(VALID_COUNTRIES),
      },
      { status: 400 },
    )
  }

  const euCountry = country as EUCountry
  const profile = COUNTRY_PROFILES[euCountry]

  // ── Optional: yield harmonization mode ───────────────────────────────────
  const yieldPctRaw = sp.get('yield_pct')
  const investorNationality = sp.get('investor_nationality') ?? undefined
  const investorTypeRaw = sp.get('investor_type') ?? undefined
  const investorType = ['individual', 'fund', 'reit'].includes(investorTypeRaw ?? '')
    ? (investorTypeRaw as 'individual' | 'fund' | 'reit')
    : undefined

  // ── Load live market data from Supabase ───────────────────────────────────
  const db = supabaseAdmin as any
  let marketDataQuery = db
    .from('country_market_data')
    .select('city, metric_type, value, currency, period, source, recorded_at')
    .eq('country', country)
    .order('period', { ascending: false })
    .limit(100)

  if (city) {
    marketDataQuery = marketDataQuery.or(`city.eq.${city},city.is.null`)
  }

  const { data: marketRows, error: marketError } = await marketDataQuery

  const liveMarketData: Record<string, unknown>[] = marketError ? [] : (marketRows ?? [])

  // ── Transaction cost examples ─────────────────────────────────────────────
  const costExamples = [250_000, 500_000, 1_000_000, 3_000_000].map(price => ({
    property_price_eur: price,
    costs: computeTransactionCosts(price, euCountry, investorNationality),
  }))

  // ── Eligibility check (if nationality provided) ───────────────────────────
  let eligibilityCheck: ReturnType<typeof checkInvestorEligibility> | undefined
  if (investorNationality) {
    const invType = investorTypeRaw === 'company' ? 'company'
      : investorTypeRaw === 'fund' ? 'fund'
      : investorTypeRaw === 'reit' ? 'reit'
      : 'individual'
    eligibilityCheck = checkInvestorEligibility(
      investorNationality,
      euCountry,
      1_000_000, // default check at €1M
      invType,
    )
  }

  // ── Yield harmonization (if yield_pct provided) ───────────────────────────
  let harmonizedYield: ReturnType<typeof harmonizeYield> | undefined
  if (yieldPctRaw) {
    const yieldPct = parseFloat(yieldPctRaw)
    if (!isNaN(yieldPct) && yieldPct > 0) {
      const investorCountry =
        investorNationality && VALID_COUNTRIES.has(investorNationality.toUpperCase())
          ? (investorNationality.toUpperCase() as EUCountry)
          : undefined

      harmonizedYield = harmonizeYield(
        yieldPct,
        euCountry,
        city ?? Object.keys(profile.avg_price_per_m2_eur)[0] ?? '',
        'residential',
        investorCountry,
        investorType,
      )
    }
  }

  // ── Build response ────────────────────────────────────────────────────────
  return NextResponse.json({
    country: euCountry,
    regulatory_profile: profile,
    live_market_data: liveMarketData,
    transaction_cost_examples: costExamples,
    ...(eligibilityCheck && { eligibility: eligibilityCheck }),
    ...(harmonizedYield && { harmonized_yield: harmonizedYield }),
    fetched_at: new Date().toISOString(),
  })
}
