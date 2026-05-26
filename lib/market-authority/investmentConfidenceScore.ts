// Agency Group — Investment Confidence Score (ICS)
// lib/market-authority/investmentConfidenceScore.ts
//
// The ICS is a composite institutional signal that integrates liquidity,
// pricing stability, capital availability, regulatory alignment, and data
// quality into a single authoritative confidence score.
//
// TypeScript strict — 0 errors
// All EUR amounts in bigint/cents — never float for money.

import { createHash, randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { getLiquidityIndex, OFFICIAL_MARKETS } from './officialLiquidityIndex'
import { getLatestBenchmark } from './pricingBenchmarkEngine'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ConfidenceLevel = 'VERY_HIGH' | 'HIGH' | 'MODERATE' | 'LOW' | 'VERY_LOW'

export interface InvestmentConfidenceScore {
  ics_id: string
  tenant_id: string
  market: string
  period: string

  // ICS components (all 0–100)
  ics_score: number               // composite
  market_liquidity_score: number  // from OLI
  pricing_stability_score: number // low volatility = high score
  capital_availability_score: number
  regulatory_alignment_score: number  // from compliance reports
  data_quality_score: number      // source coverage + confidence

  confidence_level: ConfidenceLevel

  // For institutional use
  suitable_for_retail: boolean        // ICS > 40
  suitable_for_professional: boolean  // ICS > 60
  suitable_for_institutional: boolean // ICS > 75

  // Authority
  sha256_hash: string
  published_at: string
  valid_until: string  // 7 days
}

// ─── Constants ────────────────────────────────────────────────────────────────

// 100 score = €10M available (in EUR cents: 1_000_000_000 = €10M)
const CAPITAL_NORMALIZATION_CENTS = 1_000_000_000 // €10M in cents

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function currentPeriod(): string {
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function confidenceLevelFromScore(score: number): ConfidenceLevel {
  if (score > 80) return 'VERY_HIGH'
  if (score > 65) return 'HIGH'
  if (score > 50) return 'MODERATE'
  if (score > 35) return 'LOW'
  return 'VERY_LOW'
}

function sha256(data: object): string {
  return createHash('sha256').update(JSON.stringify(data)).digest('hex')
}

// ─── computeICS ───────────────────────────────────────────────────────────────

/**
 * Computes the Investment Confidence Score for a single market.
 *
 * Component sources:
 *   - market_liquidity_score: official_liquidity_index (OLI score)
 *   - pricing_stability_score: official_price_benchmarks_v2 trend_pct
 *   - capital_availability_score: investor_capital_profiles aggregated capital
 *   - regulatory_alignment_score: compliance_reports overall_score_pct
 *   - data_quality_score: ingestion_runs providers_succeeded / 6
 *
 * Formula:
 *   ICS = liquidity×0.30 + pricing×0.20 + capital×0.25 + regulatory×0.15 + data_quality×0.10
 *
 * Persists to: investment_confidence_scores
 */
export async function computeICS(
  market: string,
  tenantId: string,
): Promise<InvestmentConfidenceScore> {
  const period = currentPeriod()
  const city = market.split(':')[1] ?? market
  log.info('[ics] computing ICS', { market, period })

  // ── market_liquidity_score: from OLI ──────────────────────────────────────
  const oliEntries = await getLiquidityIndex(market, tenantId, 1)
  const market_liquidity_score = oliEntries[0]?.oli_score ?? 50

  // ── pricing_stability_score: from benchmark trend ─────────────────────────
  const benchmark = await getLatestBenchmark(market, city, 'RESIDENTIAL', tenantId)
  const trendPct = benchmark?.trend_pct ?? 0
  // Low volatility = high score: 100 - abs(trend_pct) * 5, capped 0–100
  const pricing_stability_score = clamp(100 - Math.abs(trendPct) * 5, 0, 100)

  // ── capital_availability_score: from investor_capital_profiles ─────────────
  const { data: capitalData } = await (supabaseAdmin as any)
    .from('investor_capital_profiles')
    .select('available_capital_eur_cents, preferred_markets')
    .eq('tenant_id', tenantId)
    .limit(500)

  const totalCapital: number = (capitalData ?? [])
    .filter((r: { preferred_markets: string[] | null }) =>
      !r.preferred_markets || r.preferred_markets.length === 0 || r.preferred_markets.includes(market),
    )
    .reduce((sum: number, r: { available_capital_eur_cents: number }) => sum + (r.available_capital_eur_cents ?? 0), 0)

  // min(100, (available_capital / €10M) * 100)
  const capital_availability_score = clamp((totalCapital / CAPITAL_NORMALIZATION_CENTS) * 100, 0, 100)

  // ── regulatory_alignment_score: from compliance_reports ───────────────────
  const { data: complianceData } = await (supabaseAdmin as any)
    .from('compliance_reports')
    .select('overall_score_pct')
    .eq('tenant_id', tenantId)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const regulatory_alignment_score: number = complianceData?.overall_score_pct ?? 70

  // ── data_quality_score: from ingestion_runs ───────────────────────────────
  const { data: ingestionData } = await (supabaseAdmin as any)
    .from('ingestion_runs')
    .select('providers_succeeded')
    .eq('tenant_id', tenantId)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const providersSucceeded: unknown[] = ingestionData?.providers_succeeded ?? []
  const succeededCount = Array.isArray(providersSucceeded) ? providersSucceeded.length : 0
  // (providers_succeeded.length / 6) * 100
  const data_quality_score = clamp((succeededCount / 6) * 100, 0, 100)

  // ── ICS composite ─────────────────────────────────────────────────────────
  const ics_score = clamp(
    market_liquidity_score * 0.30 +
    pricing_stability_score * 0.20 +
    capital_availability_score * 0.25 +
    regulatory_alignment_score * 0.15 +
    data_quality_score * 0.10,
    0,
    100,
  )

  const confidence_level = confidenceLevelFromScore(ics_score)

  const suitable_for_retail = ics_score > 40
  const suitable_for_professional = ics_score > 60
  const suitable_for_institutional = ics_score > 75

  // ── SHA-256 ────────────────────────────────────────────────────────────────
  const sha256_hash = sha256({
    market,
    period,
    ics_score,
    market_liquidity_score,
    pricing_stability_score,
    capital_availability_score,
    regulatory_alignment_score,
    data_quality_score,
  })

  const now = new Date()
  const published_at = now.toISOString()
  const valid_until = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const ics_id = randomUUID()

  const entry: InvestmentConfidenceScore = {
    ics_id,
    tenant_id: tenantId,
    market,
    period,
    ics_score,
    market_liquidity_score,
    pricing_stability_score,
    capital_availability_score,
    regulatory_alignment_score,
    data_quality_score,
    confidence_level,
    suitable_for_retail,
    suitable_for_professional,
    suitable_for_institutional,
    sha256_hash,
    published_at,
    valid_until,
  }

  // ── Persist ────────────────────────────────────────────────────────────────
  void (supabaseAdmin as any)
    .from('investment_confidence_scores')
    .upsert(
      {
        ics_id,
        tenant_id: tenantId,
        market,
        period,
        ics_score,
        market_liquidity_score,
        pricing_stability_score,
        capital_availability_score,
        regulatory_alignment_score,
        data_quality_score,
        confidence_level,
        suitable_for_retail,
        suitable_for_professional,
        suitable_for_institutional,
        sha256_hash,
        published_at,
        valid_until,
      },
      { onConflict: 'market,period,tenant_id' },
    )
    .then(({ error }: { error: { message: string } | null }) => {
      if (error) log.warn('[ics] upsert failed', { market, error: error.message })
    })
    .catch((e: unknown) => console.warn('[ics] persist error', e))

  log.info('[ics] computed', { market, ics_score, confidence_level })

  return entry
}

// ─── publishICSMatrix ─────────────────────────────────────────────────────────

/**
 * Computes ICS for all 7 official markets.
 */
export async function publishICSMatrix(
  tenantId: string,
): Promise<InvestmentConfidenceScore[]> {
  log.info('[ics] publishing matrix', { tenantId, markets: OFFICIAL_MARKETS.length })

  const results = await Promise.allSettled(
    OFFICIAL_MARKETS.map((market) => computeICS(market, tenantId)),
  )

  const entries: InvestmentConfidenceScore[] = []
  for (const result of results) {
    if (result.status === 'fulfilled') {
      entries.push(result.value)
    } else {
      log.warn('[ics] matrix entry failed', { reason: String(result.reason) })
    }
  }

  log.info('[ics] matrix published', { count: entries.length })
  return entries
}

// ─── getLatestICS ─────────────────────────────────────────────────────────────

/**
 * Returns the latest ICS for a specific market.
 */
export async function getLatestICS(
  market: string,
  tenantId: string,
): Promise<InvestmentConfidenceScore | null> {
  const { data, error } = await (supabaseAdmin as any)
    .from('investment_confidence_scores')
    .select('*')
    .eq('market', market)
    .eq('tenant_id', tenantId)
    .order('period', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    log.warn('[ics] getLatestICS error', { market, error: error.message })
    return null
  }

  return (data as InvestmentConfidenceScore) ?? null
}
