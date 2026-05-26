// =============================================================================
// Agency Group — Public Registry Connector
// lib/supply/registries/publicRegistryConnector.ts
//
// Official transaction price data from public registries:
//   PT: Autoridade Tributária (AT) / INE / Predial Português
//
// Highest confidence source (0.95) — used as "ground truth" for calibration.
// Graceful no-op when AT_REGISTRY_API_KEY not configured — NEVER mock data.
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PublicRegistryTransaction {
  transaction_id: string
  source: 'PUBLIC_REGISTRY'
  country: string
  city: string
  district: string | null
  property_type: string
  size_sqm: number | null
  transaction_price_eur_cents: number
  price_per_sqm_eur_cents: number | null
  transaction_date: string
  is_official: boolean   // true = from INE/AT/Predial
  confidence_score: number   // 0.95 for official registry (highest confidence)
  raw_payload: Record<string, unknown>
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CONFIDENCE_SCORE = 0.95
const DEFAULT_TENANT = process.env.DEFAULT_TENANT_ID ?? 'agency-group'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toEurCents(raw: unknown): number {
  const n = Number(raw ?? 0)
  return Math.round(n * 100)
}

function parseIso(raw: unknown): string {
  if (typeof raw === 'string' && raw.length > 0) {
    try { return new Date(raw).toISOString() } catch { /* fall through */ }
  }
  return new Date().toISOString()
}

function mapApiItemToTransaction(
  item: Record<string, unknown>,
  country: string,
): PublicRegistryTransaction {
  const priceCents = toEurCents(item['transaction_price'] ?? item['preco_transacao'] ?? 0)
  const sizeSqm = item['size_sqm'] != null ? Number(item['size_sqm'] ?? item['area']) : null
  const pricePerSqm =
    sizeSqm && sizeSqm > 0 ? Math.round(priceCents / sizeSqm) : null

  const transactionId = String(
    item['transaction_id'] ??
    item['id'] ??
    item['referencia'] ??
    `REG-${country}-${Date.now()}`,
  )

  return {
    transaction_id: transactionId,
    source: 'PUBLIC_REGISTRY',
    country,
    city: String(item['city'] ?? item['municipio'] ?? item['concelho'] ?? ''),
    district: item['district'] != null ? String(item['district'] ?? item['distrito']) : null,
    property_type: String(item['property_type'] ?? item['tipo_imovel'] ?? 'RESIDENTIAL'),
    size_sqm: sizeSqm,
    transaction_price_eur_cents: priceCents,
    price_per_sqm_eur_cents: pricePerSqm,
    transaction_date: parseIso(item['transaction_date'] ?? item['data_transacao']),
    is_official: true,
    confidence_score: CONFIDENCE_SCORE,
    raw_payload: item,
  }
}

// ─── Persistence ──────────────────────────────────────────────────────────────

async function persistTransactions(
  transactions: PublicRegistryTransaction[],
): Promise<void> {
  if (transactions.length === 0) return

  const rows = transactions.map(t => ({
    transaction_id: t.transaction_id,
    tenant_id: DEFAULT_TENANT,
    country: t.country,
    city: t.city,
    district: t.district,
    property_type: t.property_type,
    size_sqm: t.size_sqm,
    transaction_price_eur_cents: t.transaction_price_eur_cents,
    price_per_sqm_eur_cents: t.price_per_sqm_eur_cents,
    transaction_date: t.transaction_date,
    is_official: t.is_official,
    confidence_score: t.confidence_score,
    raw_payload: t.raw_payload,
    ingested_at: new Date().toISOString(),
  }))

  const { error } = await (supabaseAdmin as any)
    .from('public_registry_transactions')
    .upsert(rows, { onConflict: 'transaction_id', ignoreDuplicates: false })

  if (error) {
    log.warn('[publicRegistryConnector] persist error', { error: String(error) })
  } else {
    log.info('[publicRegistryConnector] persisted transactions', { count: rows.length })
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch official transaction records from the public registry (AT/INE).
 * Returns empty array when AT_REGISTRY_API_KEY not configured — NEVER mocks data.
 */
export async function fetchRegistryTransactions(
  country: string,
  city: string,
  since?: Date,
): Promise<PublicRegistryTransaction[]> {
  const apiKey = process.env.AT_REGISTRY_API_KEY
  const baseUrl =
    process.env.AT_REGISTRY_BASE_URL ?? 'https://api.portaldasfinancas.gov.pt/registry/v1'

  if (!apiKey) {
    log.info('[publicRegistryConnector] No AT_REGISTRY_API_KEY — returning empty array', {
      country,
      city,
    })
    return []
  }

  try {
    const params = new URLSearchParams({
      country,
      city,
      limit: '100',
      ...(since ? { since: since.toISOString() } : {}),
    })

    const res = await fetch(`${baseUrl}/transactions?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Country': country,
      },
      signal: AbortSignal.timeout(20000),
    })

    if (!res.ok) {
      log.warn('[publicRegistryConnector] API non-OK', { status: res.status, country, city })
      return []
    }

    const data = (await res.json()) as Record<string, unknown>
    const items = Array.isArray(data['transactions'])
      ? (data['transactions'] as Record<string, unknown>[])
      : Array.isArray(data['items'])
        ? (data['items'] as Record<string, unknown>[])
        : []

    const transactions = items.map(item => mapApiItemToTransaction(item, country))

    void persistTransactions(transactions).catch(e =>
      console.warn('[publicRegistryConnector] persist error', e),
    )

    log.info('[publicRegistryConnector] fetched transactions', {
      country,
      city,
      count: transactions.length,
    })
    return transactions
  } catch (e) {
    log.warn('[publicRegistryConnector] fetch error — graceful no-op', {
      error: String(e),
      country,
      city,
    })
    return []
  }
}

/**
 * Aggregate "ground truth" prices from public_registry_transactions +
 * external_price_benchmarks (fallback) for a given city and property type.
 */
export async function getMarketTruthPrices(
  country: string,
  city: string,
  propertyType: string,
  tenantId: string,
): Promise<{
  median_price_per_sqm_eur_cents: number
  sample_count: number
  period: string
} | null> {
  try {
    // Primary: public_registry_transactions
    const { data: regData, error: regError } = await (supabaseAdmin as any)
      .from('public_registry_transactions')
      .select('price_per_sqm_eur_cents, transaction_date')
      .eq('country', country)
      .ilike('city', `%${city}%`)
      .ilike('property_type', `%${propertyType}%`)
      .not('price_per_sqm_eur_cents', 'is', null)
      .order('transaction_date', { ascending: false })
      .limit(200)

    if (!regError && regData && (regData as unknown[]).length > 0) {
      const rows = regData as Array<{
        price_per_sqm_eur_cents: number
        transaction_date: string
      }>

      const prices = rows
        .map(r => Number(r.price_per_sqm_eur_cents))
        .filter(p => p > 0)
        .sort((a, b) => a - b)

      if (prices.length > 0) {
        const mid = Math.floor(prices.length / 2)
        const median =
          prices.length % 2 === 0
            ? Math.round((prices[mid - 1] + prices[mid]) / 2)
            : prices[mid]

        const oldestDate = rows[rows.length - 1]?.transaction_date ?? ''
        const newestDate = rows[0]?.transaction_date ?? ''

        return {
          median_price_per_sqm_eur_cents: median,
          sample_count: prices.length,
          period: `${oldestDate.slice(0, 10)}/${newestDate.slice(0, 10)}`,
        }
      }
    }

    // Fallback: external_price_benchmarks
    const { data: bData, error: bError } = await (supabaseAdmin as any)
      .from('external_price_benchmarks')
      .select('price_per_sqm_eur_cents, period_start, period_end')
      .eq('tenant_id', tenantId)
      .eq('country', country)
      .ilike('city', `%${city}%`)
      .ilike('property_type', `%${propertyType}%`)
      .order('fetched_at', { ascending: false })
      .limit(10)

    if (bError || !bData || (bData as unknown[]).length === 0) {
      return null
    }

    const benchmarks = bData as Array<{
      price_per_sqm_eur_cents: number
      period_start: string
      period_end: string
    }>

    const prices = benchmarks
      .map(r => Number(r.price_per_sqm_eur_cents))
      .filter(p => p > 0)
      .sort((a, b) => a - b)

    if (prices.length === 0) return null

    const mid = Math.floor(prices.length / 2)
    const median =
      prices.length % 2 === 0
        ? Math.round((prices[mid - 1] + prices[mid]) / 2)
        : prices[mid]

    const oldestPeriod = benchmarks[benchmarks.length - 1]?.period_start ?? ''
    const newestPeriod = benchmarks[0]?.period_end ?? ''

    return {
      median_price_per_sqm_eur_cents: median,
      sample_count: prices.length,
      period: `${oldestPeriod.slice(0, 10)}/${newestPeriod.slice(0, 10)}`,
    }
  } catch (e) {
    log.warn('[publicRegistryConnector] getMarketTruthPrices exception', { error: String(e) })
    return null
  }
}

/**
 * Calibrate an asset's fair value against registry market truth prices.
 * Reads canonical_assets, recomputes fair_value based on registry data.
 */
export async function calibrateAssetValuation(
  assetId: string,
  tenantId: string,
): Promise<{
  calibrated: boolean
  old_fair_value: number
  new_fair_value: number
  delta_pct: number
}> {
  const noOp = { calibrated: false, old_fair_value: 0, new_fair_value: 0, delta_pct: 0 }

  try {
    // 1. Read the canonical asset
    const { data: assetData, error: assetError } = await (supabaseAdmin as any)
      .from('canonical_assets')
      .select('id, valuation_eur, price_eur, area_sqm, typology, zone, country')
      .eq('id', assetId)
      .single()

    if (assetError || !assetData) {
      log.warn('[publicRegistryConnector] calibrateAssetValuation — asset not found', {
        assetId,
        error: String(assetError ?? 'no data'),
      })
      return noOp
    }

    const asset = assetData as {
      id: string
      valuation_eur: number | null
      price_eur: number
      area_sqm: number
      typology: string
      zone: string
      country: string
    }

    const oldFairValue = Math.round((Number(asset.valuation_eur ?? asset.price_eur)) * 100)
    const areaSqm = Number(asset.area_sqm ?? 0)

    if (areaSqm <= 0) {
      log.warn('[publicRegistryConnector] calibrateAssetValuation — no area_sqm', { assetId })
      return noOp
    }

    // 2. Get market truth prices
    const city = String(asset.zone ?? '')
    const propertyType = String(asset.typology ?? 'RESIDENTIAL')

    const marketTruth = await getMarketTruthPrices(
      asset.country ?? 'PT',
      city,
      propertyType,
      tenantId,
    )

    if (!marketTruth) {
      log.info('[publicRegistryConnector] calibrateAssetValuation — no market truth', {
        assetId,
        city,
        propertyType,
      })
      return noOp
    }

    // 3. Recompute fair value: median_price_per_sqm * area
    // Registry data is in EUR cents per sqm, price_eur is EUR (not cents)
    const newFairValueCents =
      Math.round(marketTruth.median_price_per_sqm_eur_cents * areaSqm)
    const newFairValueEur = newFairValueCents / 100

    const deltaPct =
      oldFairValue > 0
        ? Math.round(((newFairValueCents - oldFairValue) / oldFairValue) * 10000) / 100
        : 0

    // 4. Update canonical_assets
    const { error: updateError } = await (supabaseAdmin as any)
      .from('canonical_assets')
      .update({
        valuation_eur: newFairValueEur,
        updated_at: new Date().toISOString(),
      })
      .eq('id', assetId)

    if (updateError) {
      log.warn('[publicRegistryConnector] calibrateAssetValuation — update error', {
        assetId,
        error: String(updateError),
      })
      return noOp
    }

    log.info('[publicRegistryConnector] calibrateAssetValuation — done', {
      assetId,
      old_fair_value: oldFairValue,
      new_fair_value: newFairValueCents,
      delta_pct: deltaPct,
    })

    return {
      calibrated: true,
      old_fair_value: oldFairValue,
      new_fair_value: newFairValueCents,
      delta_pct: deltaPct,
    }
  } catch (e) {
    log.warn('[publicRegistryConnector] calibrateAssetValuation exception', {
      error: String(e),
      assetId,
    })
    return noOp
  }
}
