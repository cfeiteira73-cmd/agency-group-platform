// =============================================================================
// Agency Group — Market Externalization Engine
// lib/market-external/marketExternalizationEngine.ts
//
// Compares internal system pricing vs external market reality to detect
// arbitrage and overfitting.
//
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { randomUUID } from 'crypto'
import { getLatestBenchmark } from '@/lib/market-external/externalMarketDataEngine'

// ─── Types ────────────────────────────────────────────────────────────────────

export type PriceGapDirection =
  | 'SYSTEM_OVERPRICED'
  | 'SYSTEM_UNDERPRICED'
  | 'ALIGNED'
  | 'INSUFFICIENT_DATA'

export interface PriceComparison {
  comparison_id: string
  tenant_id: string
  asset_id: string | null
  country: string
  city: string
  system_price_per_sqm_eur_cents: number // from internal bids/valuations
  external_price_per_sqm_eur_cents: number // from external_price_benchmarks
  gap_pct: number // (system - external) / external * 100
  gap_direction: PriceGapDirection
  arbitrage_opportunity: boolean // gap > 5%
  arbitrage_eur_cents: number | null // estimated gain per transaction
  compared_at: string
}

export interface ExternalizationReport {
  report_id: string
  tenant_id: string
  total_comparisons: number
  aligned_count: number
  overpriced_count: number
  underpriced_count: number
  arbitrage_opportunities: number
  avg_gap_pct: number
  max_gap_pct: number
  recommendations: string[]
  generated_at: string
}

// ─── Internal row shapes ──────────────────────────────────────────────────────

interface PropertyRow {
  id: string
  city: string | null
  country: string | null
  price_eur_cents: number | null
  area_sqm: number | null
  status: string | null
}

// ─── DB helpers (type-safe escape) ───────────────────────────────────────────

type SupabaseAny = {
  from: (table: string) => SupabaseQueryBuilder
}

interface SupabaseQueryBuilder {
  select: (cols: string) => SupabaseQueryBuilder
  eq: (col: string, val: string | boolean) => SupabaseQueryBuilder
  in: (col: string, vals: string[]) => SupabaseQueryBuilder
  insert: (data: unknown) => Promise<{ error: unknown }>
  upsert: (data: unknown, opts: unknown) => Promise<{ error: unknown }>
  order: (col: string, opts: unknown) => SupabaseQueryBuilder
  limit: (n: number) => SupabaseQueryBuilder
  single: () => Promise<{ data: unknown; error: unknown }>
  then: (resolve: (result: { data: unknown; error: unknown }) => void) => void
}

function db(): SupabaseAny {
  return supabaseAdmin as unknown as SupabaseAny
}

// ─── compareAssetPriceToMarket ────────────────────────────────────────────────

/**
 * Reads asset from `properties` table, gets latest bid/valuation for system
 * price, fetches external benchmark, computes gap.
 * Persists to price_comparisons.
 */
export async function compareAssetPriceToMarket(
  assetId: string,
  tenantId: string,
): Promise<PriceComparison> {
  // Fetch property
  const propertyResult = await (db().from('properties').select('id,city,country,price_eur_cents,area_sqm,status') as unknown as Promise<{ data: PropertyRow[] | null; error: unknown }>)

  const properties = propertyResult.data ?? []
  const property = properties.find((p) => p.id === assetId)

  const now = new Date().toISOString()

  if (!property) {
    const comparison: PriceComparison = {
      comparison_id: randomUUID(),
      tenant_id: tenantId,
      asset_id: assetId,
      country: 'PT',
      city: 'Unknown',
      system_price_per_sqm_eur_cents: 0,
      external_price_per_sqm_eur_cents: 0,
      gap_pct: 0,
      gap_direction: 'INSUFFICIENT_DATA',
      arbitrage_opportunity: false,
      arbitrage_eur_cents: null,
      compared_at: now,
    }
    return comparison
  }

  const city = property.city ?? 'Lisboa'
  const country = property.country ?? 'PT'
  const priceEurCents = property.price_eur_cents ?? 0
  const areaSqm = property.area_sqm ?? 100

  // System price per sqm
  const systemPricePerSqm = areaSqm > 0 ? Math.round(priceEurCents / areaSqm) : 0

  // External benchmark
  const benchmark = await getLatestBenchmark(country, city, tenantId)
  const externalPricePerSqm = benchmark?.price_per_sqm_eur_cents ?? 0

  if (systemPricePerSqm === 0 || externalPricePerSqm === 0) {
    const comparison: PriceComparison = {
      comparison_id: randomUUID(),
      tenant_id: tenantId,
      asset_id: assetId,
      country,
      city,
      system_price_per_sqm_eur_cents: systemPricePerSqm,
      external_price_per_sqm_eur_cents: externalPricePerSqm,
      gap_pct: 0,
      gap_direction: 'INSUFFICIENT_DATA',
      arbitrage_opportunity: false,
      arbitrage_eur_cents: null,
      compared_at: now,
    }
    await persistComparison(comparison)
    return comparison
  }

  const gapPct = ((systemPricePerSqm - externalPricePerSqm) / externalPricePerSqm) * 100
  const absGapPct = Math.abs(gapPct)

  let gapDirection: PriceGapDirection = 'ALIGNED'
  if (absGapPct > 5) {
    gapDirection = gapPct > 0 ? 'SYSTEM_OVERPRICED' : 'SYSTEM_UNDERPRICED'
  }

  const arbitrageOpportunity = absGapPct > 5
  const medianTx = benchmark?.median_transaction_eur_cents ?? priceEurCents
  const arbitrageEurCents = arbitrageOpportunity
    ? Math.round((absGapPct / 100) * medianTx * 0.95)
    : null

  const comparison: PriceComparison = {
    comparison_id: randomUUID(),
    tenant_id: tenantId,
    asset_id: assetId,
    country,
    city,
    system_price_per_sqm_eur_cents: systemPricePerSqm,
    external_price_per_sqm_eur_cents: externalPricePerSqm,
    gap_pct: Math.round(gapPct * 10000) / 10000,
    gap_direction: gapDirection,
    arbitrage_opportunity: arbitrageOpportunity,
    arbitrage_eur_cents: arbitrageEurCents,
    compared_at: now,
  }

  await persistComparison(comparison)
  return comparison
}

async function persistComparison(comparison: PriceComparison): Promise<void> {
  const { error } = await db().from('price_comparisons').insert({
    comparison_id: comparison.comparison_id,
    tenant_id: comparison.tenant_id,
    asset_id: comparison.asset_id,
    country: comparison.country,
    city: comparison.city,
    system_price_per_sqm_eur_cents: comparison.system_price_per_sqm_eur_cents,
    external_price_per_sqm_eur_cents: comparison.external_price_per_sqm_eur_cents,
    gap_pct: comparison.gap_pct,
    gap_direction: comparison.gap_direction,
    arbitrage_opportunity: comparison.arbitrage_opportunity,
    arbitrage_eur_cents: comparison.arbitrage_eur_cents,
    compared_at: comparison.compared_at,
  })

  if (error) {
    log.warn('[marketExternalizationEngine] Failed to persist comparison', {
      comparison_id: comparison.comparison_id,
    })
  }
}

// ─── runMarketExternalizationReport ──────────────────────────────────────────

/**
 * Runs comparison for all active properties, aggregates results,
 * generates recommendations. Persists to market_externalization_reports.
 */
export async function runMarketExternalizationReport(
  tenantId: string,
): Promise<ExternalizationReport> {
  log.info('[marketExternalizationEngine] Starting externalization report', { tenantId })

  // Fetch active properties
  const { data: propertiesRaw } = (await (db()
    .from('properties')
    .select('id,city,country,price_eur_cents,area_sqm,status')
    .eq('status', 'ACTIVE') as unknown as Promise<{ data: PropertyRow[] | null; error: unknown }>))

  const properties = propertiesRaw ?? []
  const now = new Date().toISOString()

  const comparisons: PriceComparison[] = []

  for (const prop of properties.slice(0, 100)) {
    // cap at 100 to avoid timeout
    try {
      const cmp = await compareAssetPriceToMarket(prop.id, tenantId)
      comparisons.push(cmp)
    } catch (err) {
      log.warn('[marketExternalizationEngine] Comparison failed for property', {
        property_id: prop.id,
      })
      void Promise.resolve(err).catch(() => {})
    }
  }

  const total = comparisons.length
  const aligned = comparisons.filter((c) => c.gap_direction === 'ALIGNED').length
  const overpriced = comparisons.filter((c) => c.gap_direction === 'SYSTEM_OVERPRICED').length
  const underpriced = comparisons.filter((c) => c.gap_direction === 'SYSTEM_UNDERPRICED').length
  const arbitrage = comparisons.filter((c) => c.arbitrage_opportunity).length

  const validGaps = comparisons
    .filter((c) => c.gap_direction !== 'INSUFFICIENT_DATA')
    .map((c) => c.gap_pct)

  const avgGapPct =
    validGaps.length > 0 ? validGaps.reduce((a, b) => a + b, 0) / validGaps.length : 0
  const maxGapPct = validGaps.length > 0 ? Math.max(...validGaps.map(Math.abs)) : 0

  const recommendations: string[] = []
  if (overpriced > total * 0.3) {
    recommendations.push(
      'Mais de 30% do portfólio está acima do mercado externo — rever pricing strategy.',
    )
  }
  if (underpriced > total * 0.3) {
    recommendations.push(
      'Mais de 30% do portfólio está abaixo do mercado externo — oportunidade de repricing.',
    )
  }
  if (arbitrage > 5) {
    recommendations.push(
      `${arbitrage} oportunidades de arbitragem detectadas — priorizar captura imediata.`,
    )
  }
  if (Math.abs(avgGapPct) > 10) {
    recommendations.push(
      `Gap médio de ${avgGapPct.toFixed(1)}% indica possível overfitting do modelo interno.`,
    )
  }
  if (recommendations.length === 0) {
    recommendations.push('Portfólio alinhado com o mercado externo — manter estratégia actual.')
  }

  const report: ExternalizationReport = {
    report_id: randomUUID(),
    tenant_id: tenantId,
    total_comparisons: total,
    aligned_count: aligned,
    overpriced_count: overpriced,
    underpriced_count: underpriced,
    arbitrage_opportunities: arbitrage,
    avg_gap_pct: Math.round(avgGapPct * 10000) / 10000,
    max_gap_pct: Math.round(maxGapPct * 10000) / 10000,
    recommendations,
    generated_at: now,
  }

  const { error } = await db().from('market_externalization_reports').insert({
    report_id: report.report_id,
    tenant_id: report.tenant_id,
    total_comparisons: report.total_comparisons,
    aligned_count: report.aligned_count,
    overpriced_count: report.overpriced_count,
    underpriced_count: report.underpriced_count,
    arbitrage_opportunities: report.arbitrage_opportunities,
    avg_gap_pct: report.avg_gap_pct,
    max_gap_pct: report.max_gap_pct,
    recommendations: JSON.stringify(report.recommendations),
    generated_at: report.generated_at,
  })

  if (error) {
    log.warn('[marketExternalizationEngine] Failed to persist externalization report', {
      report_id: report.report_id,
    })
  }

  log.info('[marketExternalizationEngine] Externalization report complete', {
    report_id: report.report_id,
    total_comparisons: total,
    arbitrage_opportunities: arbitrage,
  })

  return report
}

// ─── detectSystemOverfitting ──────────────────────────────────────────────────

/**
 * Detects if the internal pricing model is consistently overfitting vs market.
 * overfit_score = clamp(avg_gap_pct / 20, 0, 1)
 */
export async function detectSystemOverfitting(
  tenantId: string,
): Promise<{ overfitting_detected: boolean; overfit_score: number; details: string }> {
  // Fetch recent comparisons
  const { data: comparisonsRaw } = (await (db()
    .from('price_comparisons')
    .select('gap_pct,gap_direction')
    .eq('tenant_id', tenantId)
    .order('compared_at', { ascending: false })
    .limit(50) as unknown as Promise<{
    data: Array<{ gap_pct: number; gap_direction: string }> | null
    error: unknown
  }>))

  const comparisons = comparisonsRaw ?? []

  if (comparisons.length === 0) {
    return {
      overfitting_detected: false,
      overfit_score: 0,
      details: 'Sem dados suficientes para detectar overfitting.',
    }
  }

  const validGaps = comparisons
    .filter((c) => c.gap_direction !== 'INSUFFICIENT_DATA')
    .map((c) => Math.abs(c.gap_pct))

  const avgAbsGap =
    validGaps.length > 0 ? validGaps.reduce((a, b) => a + b, 0) / validGaps.length : 0
  const overfitScore = Math.min(1, avgAbsGap / 20)
  const overfittingDetected = avgAbsGap > 10

  const details = overfittingDetected
    ? `Gap médio absoluto de ${avgAbsGap.toFixed(1)}% superior a 10% — modelo interno consistentemente desalinhado com mercado externo. Recalibração recomendada.`
    : `Gap médio absoluto de ${avgAbsGap.toFixed(1)}% — modelo interno dentro dos limites aceitáveis.`

  return { overfitting_detected: overfittingDetected, overfit_score: overfitScore, details }
}

// ─── injectExternalClosingData ────────────────────────────────────────────────

/**
 * Inserts external closing records for ML recalibration.
 */
export async function injectExternalClosingData(
  tenantId: string,
  closingData: Array<{
    asset_id: string
    actual_price_eur_cents: number
    actual_sqm: number
    closed_at: string
    source: string
  }>,
): Promise<{ injected: number }> {
  let injected = 0

  for (const record of closingData) {
    const { error } = await db().from('external_closing_records').insert({
      tenant_id: tenantId,
      asset_id: record.asset_id,
      actual_price_eur_cents: record.actual_price_eur_cents,
      actual_sqm: record.actual_sqm,
      closed_at: record.closed_at,
      source: record.source,
      injected_at: new Date().toISOString(),
    })

    if (error) {
      log.warn('[marketExternalizationEngine] Failed to inject closing record', {
        asset_id: record.asset_id,
      })
    } else {
      injected++
    }
  }

  log.info('[marketExternalizationEngine] Closing data injected', { tenantId, injected })
  return { injected }
}
