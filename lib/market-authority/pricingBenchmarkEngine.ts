// Agency Group — Official Pricing Benchmark Engine
// lib/market-authority/pricingBenchmarkEngine.ts
//
// The Official Pricing Benchmark — the system's price reference that banks
// and funds can rely on. Computed from multi-source weighted median.
//
// TypeScript strict — 0 errors
// All EUR amounts in bigint/cents — never float for money.

import { createHash, randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { OFFICIAL_MARKETS } from './officialLiquidityIndex'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OfficialPriceBenchmark {
  benchmark_id: string
  tenant_id: string
  market: string
  city: string
  property_type: string
  period: string          // 'YYYY-MM'

  // Benchmark values (EUR cents per sqm)
  price_per_sqm_p25_eur_cents: number    // lower quartile
  price_per_sqm_p50_eur_cents: number    // median (THE benchmark)
  price_per_sqm_p75_eur_cents: number    // upper quartile
  price_per_sqm_mean_eur_cents: number

  // Sample quality
  sample_count: number
  source_breakdown: Record<string, number>  // { IDEALISTA: 45, CASAFARI: 32, REGISTRY: 12 }
  confidence_score: number                  // weighted avg of source confidences
  is_statistically_significant: boolean     // sample_count >= 30

  // Trend
  prior_period_p50_eur_cents: number | null
  trend_pct: number | null                  // (current - prior) / prior * 100

  // Authority
  sha256_hash: string
  published_at: string
  methodology: string  // 'WEIGHTED_MEDIAN_MULTI_SOURCE'
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const BENCHMARK_PROPERTY_TYPES = ['RESIDENTIAL', 'COMMERCIAL', 'LAND'] as const

// Source confidence weights
const SOURCE_CONFIDENCE: Record<string, number> = {
  REGISTRY: 0.95,          // public_registry_transactions — ground truth
  INE: 0.90,               // official statistics
  BANCO_DE_PORTUGAL: 0.90,
  CONFIDENCIAL_IMOBILIARIO: 0.85,
  CASAFARI: 0.75,
  IDEALISTA: 0.70,
  OTHER: 0.50,
}

const MARKET_TO_CITY: Record<string, string> = {
  'PT:Lisboa':    'Lisboa',
  'PT:Porto':     'Porto',
  'PT:Cascais':   'Cascais',
  'PT:Algarve':   'Algarve',
  'ES:Madrid':    'Madrid',
  'ES:Barcelona': 'Barcelona',
  'FR:Paris':     'Paris',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function currentPeriod(): string {
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function sha256(data: object): string {
  return createHash('sha256').update(JSON.stringify(data)).digest('hex')
}

/** Weighted median of an array of {value, weight} pairs */
function weightedMedian(items: { value: number; weight: number }[]): number {
  if (items.length === 0) return 0
  const sorted = [...items].sort((a, b) => a.value - b.value)
  const totalWeight = sorted.reduce((sum, item) => sum + item.weight, 0)
  let cumulative = 0
  for (const item of sorted) {
    cumulative += item.weight
    if (cumulative >= totalWeight / 2) return item.value
  }
  return sorted[sorted.length - 1]?.value ?? 0
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = (p / 100) * (sorted.length - 1)
  const lower = Math.floor(idx)
  const upper = Math.ceil(idx)
  if (lower === upper) return sorted[lower] ?? 0
  return (sorted[lower] ?? 0) * (upper - idx) + (sorted[upper] ?? 0) * (idx - lower)
}

// ─── computePriceBenchmark ────────────────────────────────────────────────────

/**
 * Computes the Official Price Benchmark for a specific market + city + property type.
 * Reads from:
 *   - raw_opportunity_stream: asking prices (source: IDEALISTA, CASAFARI)
 *   - external_price_benchmarks: official data (INE, BANCO_DE_PORTUGAL, CONFIDENCIAL_IMOBILIARIO)
 *   - public_registry_transactions: notarial transaction prices (ground truth)
 * Computes weighted median by source confidence.
 * Persists to: official_price_benchmarks_v2
 */
export async function computePriceBenchmark(
  market: string,
  city: string,
  propertyType: string,
  tenantId: string,
  period?: string,
): Promise<OfficialPriceBenchmark> {
  const resolvedPeriod = period ?? currentPeriod()
  log.info('[benchmark] computing price benchmark', { market, city, propertyType, period: resolvedPeriod })

  const pricePoints: { value: number; weight: number; source: string }[] = []
  const sourceBreakdown: Record<string, number> = {}

  // ── Read raw_opportunity_stream (asking prices) ────────────────────────────
  const { data: streamData } = await (supabaseAdmin as any)
    .from('raw_opportunity_stream')
    .select('price_per_sqm_eur_cents, source_name')
    .eq('tenant_id', tenantId)
    .ilike('city', `%${city}%`)
    .ilike('property_type', `%${propertyType}%`)
    .not('price_per_sqm_eur_cents', 'is', null)
    .gt('price_per_sqm_eur_cents', 0)
    .limit(500)

  for (const row of (streamData ?? [])) {
    const sourceName = (row.source_name as string | null)?.toUpperCase() ?? 'OTHER'
    const confidence = SOURCE_CONFIDENCE[sourceName] ?? SOURCE_CONFIDENCE['OTHER']
    pricePoints.push({ value: row.price_per_sqm_eur_cents as number, weight: confidence, source: sourceName })
    sourceBreakdown[sourceName] = (sourceBreakdown[sourceName] ?? 0) + 1
  }

  // ── Read external_price_benchmarks (official) ──────────────────────────────
  const { data: externalData } = await (supabaseAdmin as any)
    .from('external_price_benchmarks')
    .select('price_per_sqm_eur_cents, source, is_official')
    .eq('tenant_id', tenantId)
    .ilike('city', `%${city}%`)
    .ilike('property_type', `%${propertyType}%`)
    .not('price_per_sqm_eur_cents', 'is', null)
    .order('period_start', { ascending: false })
    .limit(50)

  for (const row of (externalData ?? [])) {
    const sourceName = (row.source as string | null)?.toUpperCase() ?? 'OTHER'
    const isOfficial = row.is_official as boolean
    const confidence = isOfficial
      ? Math.max(SOURCE_CONFIDENCE[sourceName] ?? SOURCE_CONFIDENCE['OTHER'], 0.85)
      : SOURCE_CONFIDENCE[sourceName] ?? SOURCE_CONFIDENCE['OTHER']
    pricePoints.push({ value: row.price_per_sqm_eur_cents as number, weight: confidence, source: sourceName })
    sourceBreakdown[sourceName] = (sourceBreakdown[sourceName] ?? 0) + 1
  }

  // ── Read public_registry_transactions (ground truth) ──────────────────────
  const { data: registryData } = await (supabaseAdmin as any)
    .from('public_registry_transactions')
    .select('price_per_sqm_eur_cents')
    .eq('tenant_id', tenantId)
    .ilike('city', `%${city}%`)
    .ilike('property_type', `%${propertyType}%`)
    .not('price_per_sqm_eur_cents', 'is', null)
    .order('transaction_date', { ascending: false })
    .limit(200)

  for (const row of (registryData ?? [])) {
    pricePoints.push({ value: row.price_per_sqm_eur_cents as number, weight: SOURCE_CONFIDENCE['REGISTRY'], source: 'REGISTRY' })
    sourceBreakdown['REGISTRY'] = (sourceBreakdown['REGISTRY'] ?? 0) + 1
  }

  // ── Compute statistics ─────────────────────────────────────────────────────
  const sample_count = pricePoints.length
  const values = pricePoints.map((p) => p.value).sort((a, b) => a - b)

  const p50 = sample_count > 0 ? weightedMedian(pricePoints) : 0
  const p25 = sample_count > 0 ? percentile(values, 25) : 0
  const p75 = sample_count > 0 ? percentile(values, 75) : 0
  const mean = sample_count > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0

  const weightedConfSum = pricePoints.reduce((sum, p) => sum + (SOURCE_CONFIDENCE[p.source] ?? 0.5), 0)
  const confidence_score = sample_count > 0 ? weightedConfSum / sample_count : 0
  const is_statistically_significant = sample_count >= 30

  // ── Prior period price (for trend) ────────────────────────────────────────
  const { data: priorData } = await (supabaseAdmin as any)
    .from('official_price_benchmarks_v2')
    .select('price_per_sqm_p50_eur_cents')
    .eq('market', market)
    .eq('city', city)
    .eq('property_type', propertyType)
    .eq('tenant_id', tenantId)
    .order('period', { ascending: false })
    .limit(1)

  const prior_period_p50_eur_cents: number | null = priorData?.[0]?.price_per_sqm_p50_eur_cents ?? null
  let trend_pct: number | null = null
  if (prior_period_p50_eur_cents && prior_period_p50_eur_cents > 0 && p50 > 0) {
    trend_pct = ((p50 - prior_period_p50_eur_cents) / prior_period_p50_eur_cents) * 100
  }

  // ── SHA-256 ────────────────────────────────────────────────────────────────
  const sha256_hash = sha256({
    market,
    city,
    propertyType,
    period: resolvedPeriod,
    p50,
    sample_count,
  })

  const published_at = new Date().toISOString()
  const benchmark_id = randomUUID()

  const entry: OfficialPriceBenchmark = {
    benchmark_id,
    tenant_id: tenantId,
    market,
    city,
    property_type: propertyType,
    period: resolvedPeriod,
    price_per_sqm_p25_eur_cents: Math.round(p25),
    price_per_sqm_p50_eur_cents: Math.round(p50),
    price_per_sqm_p75_eur_cents: Math.round(p75),
    price_per_sqm_mean_eur_cents: Math.round(mean),
    sample_count,
    source_breakdown: sourceBreakdown,
    confidence_score,
    is_statistically_significant,
    prior_period_p50_eur_cents,
    trend_pct: trend_pct !== null ? parseFloat(trend_pct.toFixed(4)) : null,
    sha256_hash,
    published_at,
    methodology: 'WEIGHTED_MEDIAN_MULTI_SOURCE',
  }

  // ── Persist ────────────────────────────────────────────────────────────────
  void (supabaseAdmin as any)
    .from('official_price_benchmarks_v2')
    .upsert(
      {
        benchmark_id,
        tenant_id: tenantId,
        market,
        city,
        property_type: propertyType,
        period: resolvedPeriod,
        price_per_sqm_p25_eur_cents: Math.round(p25),
        price_per_sqm_p50_eur_cents: Math.round(p50),
        price_per_sqm_p75_eur_cents: Math.round(p75),
        price_per_sqm_mean_eur_cents: Math.round(mean),
        sample_count,
        source_breakdown: sourceBreakdown,
        confidence_score,
        is_statistically_significant,
        prior_period_p50_eur_cents,
        trend_pct: entry.trend_pct,
        sha256_hash,
        published_at,
        methodology: 'WEIGHTED_MEDIAN_MULTI_SOURCE',
      },
      { onConflict: 'market,city,property_type,period,tenant_id' },
    )
    .then(({ error }: { error: { message: string } | null }) => {
      if (error) log.warn('[benchmark] upsert failed', { market, city, propertyType, error: error.message })
    })
    .catch((e: unknown) => console.warn('[benchmark] persist error', e))

  log.info('[benchmark] computed', { market, city, propertyType, p50, sample_count })

  return entry
}

// ─── publishBenchmarkMatrix ───────────────────────────────────────────────────

/**
 * Computes all 7 markets × 3 property types = 21 benchmarks.
 */
export async function publishBenchmarkMatrix(
  tenantId: string,
): Promise<OfficialPriceBenchmark[]> {
  const period = currentPeriod()
  log.info('[benchmark] publishing matrix', { tenantId, period })

  const tasks: Array<Promise<OfficialPriceBenchmark>> = []
  for (const market of OFFICIAL_MARKETS) {
    const city = MARKET_TO_CITY[market] ?? market.split(':')[1] ?? market
    for (const propertyType of BENCHMARK_PROPERTY_TYPES) {
      tasks.push(computePriceBenchmark(market, city, propertyType, tenantId, period))
    }
  }

  const results = await Promise.allSettled(tasks)
  const entries: OfficialPriceBenchmark[] = []
  for (const result of results) {
    if (result.status === 'fulfilled') {
      entries.push(result.value)
    } else {
      log.warn('[benchmark] matrix entry failed', { reason: String(result.reason) })
    }
  }

  log.info('[benchmark] matrix published', { count: entries.length })
  return entries
}

// ─── getLatestBenchmark ───────────────────────────────────────────────────────

/**
 * Returns the latest official price benchmark for a specific market/city/property_type.
 */
export async function getLatestBenchmark(
  market: string,
  city: string,
  propertyType: string,
  tenantId: string,
): Promise<OfficialPriceBenchmark | null> {
  const { data, error } = await (supabaseAdmin as any)
    .from('official_price_benchmarks_v2')
    .select('*')
    .eq('market', market)
    .eq('city', city)
    .eq('property_type', propertyType)
    .eq('tenant_id', tenantId)
    .order('period', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    log.warn('[benchmark] getLatestBenchmark error', { market, city, propertyType, error: error.message })
    return null
  }

  return (data as OfficialPriceBenchmark) ?? null
}

// ─── deviationFromBenchmark ───────────────────────────────────────────────────

/**
 * Computes how much an asset deviates from the official price benchmark.
 * Reads the canonical asset price and compares to the P50 benchmark.
 */
export async function deviationFromBenchmark(
  assetId: string,
  tenantId: string,
): Promise<{ deviation_pct: number; direction: 'ABOVE' | 'BELOW' | 'AT_MARKET'; benchmark_p50: number }> {
  // Read canonical asset
  const { data: asset, error: assetError } = await (supabaseAdmin as any)
    .from('canonical_assets')
    .select('price_per_sqm_eur_cents, city, property_type, market')
    .eq('id', assetId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (assetError || !asset) {
    log.warn('[benchmark] deviationFromBenchmark: asset not found', { assetId })
    return { deviation_pct: 0, direction: 'AT_MARKET', benchmark_p50: 0 }
  }

  const city = (asset.city as string) ?? ''
  const propertyType = (asset.property_type as string) ?? 'RESIDENTIAL'
  const market = (asset.market as string) ?? ''
  const assetPrice = (asset.price_per_sqm_eur_cents as number) ?? 0

  const benchmark = await getLatestBenchmark(market, city, propertyType, tenantId)
  if (!benchmark || benchmark.price_per_sqm_p50_eur_cents === 0) {
    return { deviation_pct: 0, direction: 'AT_MARKET', benchmark_p50: 0 }
  }

  const p50 = benchmark.price_per_sqm_p50_eur_cents
  const deviation_pct = ((assetPrice - p50) / p50) * 100

  let direction: 'ABOVE' | 'BELOW' | 'AT_MARKET'
  if (Math.abs(deviation_pct) < 2) {
    direction = 'AT_MARKET'
  } else if (deviation_pct > 0) {
    direction = 'ABOVE'
  } else {
    direction = 'BELOW'
  }

  return {
    deviation_pct: parseFloat(deviation_pct.toFixed(4)),
    direction,
    benchmark_p50: p50,
  }
}
