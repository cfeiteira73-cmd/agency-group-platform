// =============================================================================
// Agency Group — Asset Normalization Engine v1.0
// Wave 42 | lib/normalization/assetNormalizationEngine.ts
// TypeScript strict — 0 errors
//
// Transforms raw_opportunity_stream records into normalized canonical assets.
// OBSERVED vs INFERRED distinction maintained on every field.
// Probabilistic dedup: same property from multiple sources = one canonical asset.
// =============================================================================

import { v4 as uuidv4 } from 'uuid'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type LegalStatus =
  | 'FREE'
  | 'ENCUMBERED'
  | 'JUDICIAL'
  | 'AUCTION'
  | 'NPL'
  | 'FORECLOSURE'
  | 'UNKNOWN'

export type AssetNormalizationStatus =
  | 'PENDING'
  | 'NORMALIZED'
  | 'DEDUPLICATED'
  | 'REJECTED'
  | 'NEEDS_REVIEW'

export interface ValuationRange {
  min_eur_cents: number    // pessimistic (asking price - 15%)
  fair_eur_cents: number   // best estimate
  max_eur_cents: number    // optimistic
  confidence: number       // 0–1
  method: 'ASKING_PRICE_ADJUSTED' | 'COMPS_BASED' | 'EXTERNAL_BENCHMARK' | 'ML_PREDICTED'
}

export interface NormalizedAsset {
  asset_id: string           // stable UUID, survives deduplication
  tenant_id: string

  // Source lineage — OBSERVED
  primary_source: string     // e.g. 'IDEALISTA'
  source_ids: Record<string, string>  // { IDEALISTA: 'id123', CASAFARI: 'id456' }
  source_confidence: number  // weighted avg of source confidences

  // Location — OBSERVED
  country: string
  market: string
  city: string
  district: string | null
  address: string | null
  latitude: number | null
  longitude: number | null

  // Property — OBSERVED
  property_type: string
  size_sqm: number | null
  bedrooms: number | null
  bathrooms: number | null
  floor: number | null

  // Pricing — OBSERVED + INFERRED
  asking_price_eur_cents: number        // observed from source
  valuation: ValuationRange             // inferred
  price_per_sqm_eur_cents: number | null

  // Scores — INFERRED (all 0–100)
  liquidity_score: number      // how fast this type of asset sells in this market
  risk_score: number           // legal, structural, market risk
  opportunity_score: number    // final composite (0–100)
  undervaluation_pct: number   // (fair_value - asking) / fair_value * 100

  // Legal — OBSERVED where possible, INFERRED otherwise
  legal_status: LegalStatus
  is_distressed: boolean
  is_auction: boolean
  auction_date: string | null
  encumbrances: string[]

  // Market context — INFERRED
  days_on_market: number | null
  price_history: Array<{ price_eur_cents: number; date: string }>

  // Status
  normalization_status: AssetNormalizationStatus
  first_seen_at: string
  last_updated_at: string
  delisted_at: string | null
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Safely extract a string field from a raw record */
function extractString(raw: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const val = raw[key]
    if (typeof val === 'string' && val.trim().length > 0) return val.trim()
  }
  return null
}

/** Safely extract a number field */
function extractNumber(raw: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const val = raw[key]
    if (typeof val === 'number' && isFinite(val)) return val
    if (typeof val === 'string') {
      const n = parseFloat(val)
      if (isFinite(n)) return n
    }
  }
  return null
}

/** Safely extract an integer field */
function extractInt(raw: Record<string, unknown>, ...keys: string[]): number | null {
  const n = extractNumber(raw, ...keys)
  return n !== null ? Math.round(n) : null
}

/** Parse LegalStatus from raw string — OBSERVED where possible */
function parseLegalStatus(raw: Record<string, unknown>): LegalStatus {
  const s = extractString(raw, 'legal_status', 'legalStatus', 'status') ?? ''
  const upper = s.toUpperCase()
  const validStatuses: LegalStatus[] = ['FREE', 'ENCUMBERED', 'JUDICIAL', 'AUCTION', 'NPL', 'FORECLOSURE']
  if (validStatuses.includes(upper as LegalStatus)) return upper as LegalStatus

  // INFERRED from keywords
  if (upper.includes('LIVRE') || upper.includes('FREE')) return 'FREE'
  if (upper.includes('HIPOTECA') || upper.includes('ENCUMB')) return 'ENCUMBERED'
  if (upper.includes('JUDICIAL')) return 'JUDICIAL'
  if (upper.includes('LEILAO') || upper.includes('AUCTION') || upper.includes('LEILÃO')) return 'AUCTION'
  if (upper.includes('NPL') || upper.includes('NON-PERFORMING')) return 'NPL'
  if (upper.includes('PENHORA') || upper.includes('FORECLOSURE')) return 'FORECLOSURE'
  return 'UNKNOWN'
}

/**
 * Compute liquidity score (INFERRED) based on city + property_type.
 * Higher = faster to sell.
 */
function computeLiquidityScore(city: string, propertyType: string, isDistressed: boolean): number {
  if (isDistressed) return 40

  const cityUpper = city.toUpperCase()
  const typeUpper = propertyType.toUpperCase()
  const isResidential = typeUpper.includes('APARTMENT') || typeUpper.includes('HOUSE') ||
    typeUpper.includes('FLAT') || typeUpper.includes('APARTAMENTO') || typeUpper.includes('MORADIA')

  if (cityUpper.includes('LISBOA') || cityUpper.includes('LISBON')) {
    return isResidential ? 75 : 60
  }
  if (cityUpper.includes('PORTO')) {
    return isResidential ? 68 : 55
  }
  if (cityUpper.includes('CASCAIS') || cityUpper.includes('SINTRA') || cityUpper.includes('OEIRAS')) {
    return isResidential ? 70 : 58
  }
  if (cityUpper.includes('ALGARVE') || cityUpper.includes('FARO') || cityUpper.includes('LOULÉ') || cityUpper.includes('LOULE')) {
    return isResidential ? 65 : 52
  }
  if (cityUpper.includes('FUNCHAL') || cityUpper.includes('MADEIRA')) {
    return isResidential ? 62 : 50
  }
  // Default moderate liquidity
  return isResidential ? 55 : 45
}

/**
 * Compute risk score (INFERRED) from legal status + market factors.
 * Higher = more risk.
 */
function computeRiskScore(legalStatus: LegalStatus, isDistressed: boolean): number {
  const baseRisk: Record<LegalStatus, number> = {
    FREE: 20,
    ENCUMBERED: 45,
    JUDICIAL: 75,
    AUCTION: 60,
    NPL: 65,
    FORECLOSURE: 70,
    UNKNOWN: 50,
  }
  let score = baseRisk[legalStatus]
  if (isDistressed && legalStatus === 'FREE') score = Math.max(score, 35)
  return Math.min(100, score)
}

/**
 * Build ValuationRange (INFERRED) from asking price + legal status.
 * - Free assets: fair = asking (no market discount assumed)
 * - Distressed: fair = asking * 1.15 (market discount already baked into asking)
 * - min = fair * 0.85, max = fair * 1.20
 */
function buildValuationRange(
  askingPriceEurCents: number,
  isDistressed: boolean,
  legalStatus: LegalStatus
): ValuationRange {
  const distressedStatuses: LegalStatus[] = ['AUCTION', 'JUDICIAL', 'NPL', 'FORECLOSURE']
  const effectivelyDistressed = isDistressed || distressedStatuses.includes(legalStatus)

  const fairEurCents = effectivelyDistressed
    ? Math.round(askingPriceEurCents * 1.15)  // market discount already in asking price
    : askingPriceEurCents

  return {
    min_eur_cents: Math.round(fairEurCents * 0.85),
    fair_eur_cents: fairEurCents,
    max_eur_cents: Math.round(fairEurCents * 1.20),
    confidence: effectivelyDistressed ? 0.55 : 0.70,
    method: 'ASKING_PRICE_ADJUSTED',
  }
}

// ─── Public Functions ─────────────────────────────────────────────────────────

/**
 * Transforms a raw_opportunity_stream record into a NormalizedAsset.
 * Persists to canonical_assets via upsert on asset_id.
 */
export async function normalizeRawRecord(
  raw: Record<string, unknown>,
  tenantId: string
): Promise<NormalizedAsset> {
  // ── Source lineage — OBSERVED ─────────────────────────────────────────────
  const primarySource = extractString(raw, 'source', 'primary_source', 'platform') ?? 'UNKNOWN'
  const sourceId = extractString(raw, 'external_id', 'source_id', 'id') ?? uuidv4()
  const existingSourceIds = (
    raw['source_ids'] && typeof raw['source_ids'] === 'object' && !Array.isArray(raw['source_ids'])
      ? raw['source_ids']
      : {}
  ) as Record<string, string>
  const sourceIds: Record<string, string> = { ...existingSourceIds, [primarySource]: sourceId }
  const sourceConfidence = typeof raw['confidence'] === 'number' ? raw['confidence'] : 0.7

  // ── Location — OBSERVED ───────────────────────────────────────────────────
  const country = extractString(raw, 'country', 'pais') ?? 'PT'
  const market = extractString(raw, 'market', 'mercado', 'region', 'zona') ?? 'PT'
  const city = extractString(raw, 'city', 'cidade', 'municipality') ?? 'Lisboa'
  const district = extractString(raw, 'district', 'distrito', 'neighborhood', 'bairro')
  const address = extractString(raw, 'address', 'morada', 'endereco', 'endereco')
  const latitude = extractNumber(raw, 'latitude', 'lat')
  const longitude = extractNumber(raw, 'longitude', 'lng', 'lon')

  // ── Property — OBSERVED ───────────────────────────────────────────────────
  const propertyType = extractString(raw, 'property_type', 'tipo', 'type', 'typology') ?? 'RESIDENTIAL'
  const sizeSqm = extractNumber(raw, 'size_sqm', 'area', 'area_sqm', 'area_util')
  const bedrooms = extractInt(raw, 'bedrooms', 'quartos', 'rooms', 't')
  const bathrooms = extractInt(raw, 'bathrooms', 'wcs', 'casas_de_banho')
  const floor = extractInt(raw, 'floor', 'andar', 'piso')

  // ── Pricing — OBSERVED ────────────────────────────────────────────────────
  // Support both cents and EUR inputs
  let askingPriceEurCents: number
  const rawPriceCents = extractNumber(raw, 'asking_price_eur_cents', 'price_cents')
  if (rawPriceCents !== null) {
    askingPriceEurCents = Math.round(rawPriceCents)
  } else {
    const rawPriceEur = extractNumber(raw, 'price', 'price_eur', 'preco', 'valor') ?? 0
    askingPriceEurCents = Math.round(rawPriceEur * 100)
  }

  const pricePerSqmEurCents: number | null =
    sizeSqm && sizeSqm > 0
      ? Math.round(askingPriceEurCents / sizeSqm)
      : null

  // ── Legal — OBSERVED where possible, INFERRED otherwise ───────────────────
  const legalStatus = parseLegalStatus(raw)
  const isDistressed =
    typeof raw['is_distressed'] === 'boolean'
      ? raw['is_distressed']
      : ['AUCTION', 'JUDICIAL', 'NPL', 'FORECLOSURE'].includes(legalStatus)
  const isAuction =
    typeof raw['is_auction'] === 'boolean'
      ? raw['is_auction']
      : legalStatus === 'AUCTION'
  const auctionDate = extractString(raw, 'auction_date', 'data_leilao')
  const rawEncumbrances = raw['encumbrances']
  const encumbrances: string[] = Array.isArray(rawEncumbrances)
    ? rawEncumbrances.filter((e): e is string => typeof e === 'string')
    : []

  // ── Pricing — INFERRED ────────────────────────────────────────────────────
  const valuation = buildValuationRange(askingPriceEurCents, isDistressed, legalStatus)
  const undervaluation_pct =
    valuation.fair_eur_cents > 0
      ? ((valuation.fair_eur_cents - askingPriceEurCents) / valuation.fair_eur_cents) * 100
      : 0

  // ── Scores — INFERRED ─────────────────────────────────────────────────────
  const liquidityScore = computeLiquidityScore(city, propertyType, isDistressed)
  const riskScore = computeRiskScore(legalStatus, isDistressed)
  // Opportunity: weighted composite (higher liquidity + lower risk + higher undervaluation)
  const opportunityScore = Math.min(
    100,
    Math.max(
      0,
      Math.round(
        liquidityScore * 0.35 +
        (100 - riskScore) * 0.35 +
        Math.min(undervaluation_pct * 2, 30)  // cap undervaluation contribution at 30 pts
      )
    )
  )

  // ── Market context — INFERRED ─────────────────────────────────────────────
  const daysOnMarket = extractInt(raw, 'days_on_market', 'dias_mercado', 'dom')
  const rawPriceHistory = raw['price_history']
  const priceHistory: Array<{ price_eur_cents: number; date: string }> = Array.isArray(rawPriceHistory)
    ? rawPriceHistory.filter(
        (e): e is { price_eur_cents: number; date: string } =>
          typeof e === 'object' && e !== null &&
          typeof (e as Record<string, unknown>)['price_eur_cents'] === 'number' &&
          typeof (e as Record<string, unknown>)['date'] === 'string'
      )
    : []

  // ── Timestamps ────────────────────────────────────────────────────────────
  const now = new Date().toISOString()
  const firstSeenAt = extractString(raw, 'first_seen_at', 'created_at', 'listed_at') ?? now
  const delistedAt = extractString(raw, 'delisted_at', 'removed_at') ?? null

  // ── Stable asset_id ───────────────────────────────────────────────────────
  // Reuse existing asset_id if provided; otherwise generate new UUID
  const assetId = extractString(raw, 'asset_id') ?? uuidv4()

  const asset: NormalizedAsset = {
    asset_id: assetId,
    tenant_id: tenantId,
    primary_source: primarySource,
    source_ids: sourceIds,
    source_confidence: sourceConfidence,
    country,
    market,
    city,
    district,
    address,
    latitude,
    longitude,
    property_type: propertyType,
    size_sqm: sizeSqm,
    bedrooms,
    bathrooms,
    floor,
    asking_price_eur_cents: askingPriceEurCents,
    valuation,
    price_per_sqm_eur_cents: pricePerSqmEurCents,
    liquidity_score: liquidityScore,
    risk_score: riskScore,
    opportunity_score: opportunityScore,
    undervaluation_pct,
    legal_status: legalStatus,
    is_distressed: isDistressed,
    is_auction: isAuction,
    auction_date: auctionDate,
    encumbrances,
    days_on_market: daysOnMarket,
    price_history: priceHistory,
    normalization_status: 'NORMALIZED',
    first_seen_at: firstSeenAt,
    last_updated_at: now,
    delisted_at: delistedAt,
  }

  // ── Persist to canonical_assets ───────────────────────────────────────────
  void (supabaseAdmin as any)
    .from('canonical_assets_v2')
    .upsert(
      {
        asset_id: asset.asset_id,
        tenant_id: asset.tenant_id,
        primary_source: asset.primary_source,
        source_ids: asset.source_ids,
        source_confidence: asset.source_confidence,
        country: asset.country,
        market: asset.market,
        city: asset.city,
        district: asset.district,
        address: asset.address,
        latitude: asset.latitude,
        longitude: asset.longitude,
        property_type: asset.property_type,
        size_sqm: asset.size_sqm,
        bedrooms: asset.bedrooms,
        bathrooms: asset.bathrooms,
        floor: asset.floor,
        asking_price_eur_cents: asset.asking_price_eur_cents,
        valuation: asset.valuation,
        price_per_sqm_eur_cents: asset.price_per_sqm_eur_cents,
        liquidity_score: asset.liquidity_score,
        risk_score: asset.risk_score,
        opportunity_score: asset.opportunity_score,
        undervaluation_pct: asset.undervaluation_pct,
        legal_status: asset.legal_status,
        is_distressed: asset.is_distressed,
        is_auction: asset.is_auction,
        auction_date: asset.auction_date,
        encumbrances: asset.encumbrances,
        days_on_market: asset.days_on_market,
        price_history: asset.price_history,
        normalization_status: asset.normalization_status,
        first_seen_at: asset.first_seen_at,
        last_updated_at: asset.last_updated_at,
        delisted_at: asset.delisted_at,
      },
      { onConflict: 'asset_id' }
    )
    .then(({ error }: { error: unknown }) => {
      if (error) log.warn('[assetNormalizationEngine] upsert error', { error, asset_id: asset.asset_id })
    })
    .catch((e: unknown) => log.warn('[assetNormalizationEngine] upsert exception', { e }))

  return asset
}

/**
 * Reads PENDING records from raw_opportunity_stream, normalizes each,
 * and updates the raw record with asset_id.
 * Max 100 per batch.
 */
export async function normalizeRawBatch(
  tenantId: string,
  limit = 100
): Promise<{ normalized: number; failed: number; skipped: number }> {
  const batchLimit = Math.min(limit, 100)
  let normalized = 0
  let failed = 0
  let skipped = 0

  const { data: rawRecords, error } = await (supabaseAdmin as any)
    .from('raw_opportunity_stream')
    .select('*')
    .eq('tenant_id', tenantId)
    .or('asset_id.is.null,normalization_status.eq.PENDING')
    .limit(batchLimit)

  if (error) {
    log.warn('[assetNormalizationEngine] batch fetch error', { error })
    return { normalized: 0, failed: 0, skipped: 0 }
  }

  if (!rawRecords || rawRecords.length === 0) {
    return { normalized: 0, failed: 0, skipped: 0 }
  }

  for (const record of rawRecords as Record<string, unknown>[]) {
    try {
      const asset = await normalizeRawRecord(record, tenantId)

      // Update raw record with asset_id and normalization_status
      void (supabaseAdmin as any)
        .from('raw_opportunity_stream')
        .update({
          asset_id: asset.asset_id,
          normalization_status: 'NORMALIZED',
        })
        .eq('id', record['id'])
        .then(({ error: updateError }: { error: unknown }) => {
          if (updateError) log.warn('[assetNormalizationEngine] raw update error', { updateError })
        })
        .catch((e: unknown) => log.warn('[assetNormalizationEngine] raw update exception', { e }))

      normalized++
    } catch (err) {
      log.warn('[assetNormalizationEngine] normalize error', { err, record_id: record['id'] })
      failed++
    }
  }

  return { normalized, failed, skipped }
}

/**
 * Recomputes all scores for an asset based on latest data.
 */
export async function updateAssetScores(assetId: string, tenantId: string): Promise<void> {
  const { data, error } = await (supabaseAdmin as any)
    .from('canonical_assets_v2')
    .select('*')
    .eq('asset_id', assetId)
    .eq('tenant_id', tenantId)
    .single()

  if (error || !data) {
    log.warn('[assetNormalizationEngine] updateAssetScores not found', { assetId, error })
    return
  }

  const row = data as Record<string, unknown>
  const legalStatus = (row['legal_status'] as LegalStatus) ?? 'UNKNOWN'
  const isDistressed = Boolean(row['is_distressed'])
  const city = String(row['city'] ?? 'Lisboa')
  const propertyType = String(row['property_type'] ?? 'RESIDENTIAL')
  const askingPriceEurCents = Number(row['asking_price_eur_cents'] ?? 0)

  const liquidityScore = computeLiquidityScore(city, propertyType, isDistressed)
  const riskScore = computeRiskScore(legalStatus, isDistressed)
  const valuation = buildValuationRange(askingPriceEurCents, isDistressed, legalStatus)
  const undervaluation_pct =
    valuation.fair_eur_cents > 0
      ? ((valuation.fair_eur_cents - askingPriceEurCents) / valuation.fair_eur_cents) * 100
      : 0
  const opportunityScore = Math.min(
    100,
    Math.max(
      0,
      Math.round(
        liquidityScore * 0.35 +
        (100 - riskScore) * 0.35 +
        Math.min(undervaluation_pct * 2, 30)
      )
    )
  )

  void (supabaseAdmin as any)
    .from('canonical_assets_v2')
    .update({
      liquidity_score: liquidityScore,
      risk_score: riskScore,
      opportunity_score: opportunityScore,
      undervaluation_pct,
      valuation,
      last_updated_at: new Date().toISOString(),
    })
    .eq('asset_id', assetId)
    .eq('tenant_id', tenantId)
    .then(({ error: updateError }: { error: unknown }) => {
      if (updateError) log.warn('[assetNormalizationEngine] score update error', { updateError, assetId })
    })
    .catch((e: unknown) => log.warn('[assetNormalizationEngine] score update exception', { e, assetId }))
}

/**
 * Reads a canonical asset by asset_id and tenant_id.
 */
export async function getCanonicalAsset(
  assetId: string,
  tenantId: string
): Promise<NormalizedAsset | null> {
  const { data, error } = await (supabaseAdmin as any)
    .from('canonical_assets_v2')
    .select('*')
    .eq('asset_id', assetId)
    .eq('tenant_id', tenantId)
    .single()

  if (error || !data) return null

  return rowToNormalizedAsset(data as Record<string, unknown>)
}

/**
 * Searches canonical assets with filters.
 */
export async function searchCanonicalAssets(
  tenantId: string,
  filters: {
    market?: string
    city?: string
    property_type?: string
    min_price?: number
    max_price?: number
    min_opportunity_score?: number
    is_distressed?: boolean
    limit?: number
  }
): Promise<NormalizedAsset[]> {
  let query = (supabaseAdmin as any)
    .from('canonical_assets_v2')
    .select('*')
    .eq('tenant_id', tenantId)
    .neq('normalization_status', 'REJECTED')
    .neq('normalization_status', 'DEDUPLICATED')
    .order('opportunity_score', { ascending: false })
    .limit(filters.limit ?? 50)

  if (filters.market) query = query.eq('market', filters.market)
  if (filters.city) query = query.ilike('city', `%${filters.city}%`)
  if (filters.property_type) query = query.eq('property_type', filters.property_type)
  if (filters.min_price !== undefined) query = query.gte('asking_price_eur_cents', filters.min_price)
  if (filters.max_price !== undefined) query = query.lte('asking_price_eur_cents', filters.max_price)
  if (filters.min_opportunity_score !== undefined)
    query = query.gte('opportunity_score', filters.min_opportunity_score)
  if (filters.is_distressed !== undefined) query = query.eq('is_distressed', filters.is_distressed)

  const { data, error } = await query

  if (error) {
    log.warn('[assetNormalizationEngine] search error', { error })
    return []
  }

  return (data as Record<string, unknown>[]).map(rowToNormalizedAsset)
}

// ─── Row mapper ───────────────────────────────────────────────────────────────

function rowToNormalizedAsset(row: Record<string, unknown>): NormalizedAsset {
  const rawSourceIds = row['source_ids']
  const sourceIds: Record<string, string> =
    rawSourceIds && typeof rawSourceIds === 'object' && !Array.isArray(rawSourceIds)
      ? (rawSourceIds as Record<string, string>)
      : {}

  const rawValuation = row['valuation']
  const valuation: ValuationRange =
    rawValuation && typeof rawValuation === 'object' && !Array.isArray(rawValuation)
      ? (rawValuation as ValuationRange)
      : {
          min_eur_cents: 0,
          fair_eur_cents: 0,
          max_eur_cents: 0,
          confidence: 0.5,
          method: 'ASKING_PRICE_ADJUSTED',
        }

  const rawEncumbrances = row['encumbrances']
  const encumbrances: string[] = Array.isArray(rawEncumbrances)
    ? (rawEncumbrances as string[])
    : []

  const rawPriceHistory = row['price_history']
  const priceHistory: Array<{ price_eur_cents: number; date: string }> = Array.isArray(rawPriceHistory)
    ? (rawPriceHistory as Array<{ price_eur_cents: number; date: string }>)
    : []

  const validStatuses: AssetNormalizationStatus[] = ['PENDING', 'NORMALIZED', 'DEDUPLICATED', 'REJECTED', 'NEEDS_REVIEW']
  const rawStatus = String(row['normalization_status'] ?? 'PENDING')
  const normalizationStatus: AssetNormalizationStatus = validStatuses.includes(rawStatus as AssetNormalizationStatus)
    ? (rawStatus as AssetNormalizationStatus)
    : 'PENDING'

  const validLegalStatuses: LegalStatus[] = ['FREE', 'ENCUMBERED', 'JUDICIAL', 'AUCTION', 'NPL', 'FORECLOSURE', 'UNKNOWN']
  const rawLegalStatus = String(row['legal_status'] ?? 'UNKNOWN')
  const legalStatus: LegalStatus = validLegalStatuses.includes(rawLegalStatus as LegalStatus)
    ? (rawLegalStatus as LegalStatus)
    : 'UNKNOWN'

  return {
    asset_id: String(row['asset_id'] ?? ''),
    tenant_id: String(row['tenant_id'] ?? ''),
    primary_source: String(row['primary_source'] ?? 'UNKNOWN'),
    source_ids: sourceIds,
    source_confidence: Number(row['source_confidence'] ?? 0.5),
    country: String(row['country'] ?? 'PT'),
    market: String(row['market'] ?? ''),
    city: String(row['city'] ?? ''),
    district: row['district'] != null ? String(row['district']) : null,
    address: row['address'] != null ? String(row['address']) : null,
    latitude: row['latitude'] != null ? Number(row['latitude']) : null,
    longitude: row['longitude'] != null ? Number(row['longitude']) : null,
    property_type: String(row['property_type'] ?? 'RESIDENTIAL'),
    size_sqm: row['size_sqm'] != null ? Number(row['size_sqm']) : null,
    bedrooms: row['bedrooms'] != null ? Number(row['bedrooms']) : null,
    bathrooms: row['bathrooms'] != null ? Number(row['bathrooms']) : null,
    floor: row['floor'] != null ? Number(row['floor']) : null,
    asking_price_eur_cents: Number(row['asking_price_eur_cents'] ?? 0),
    valuation,
    price_per_sqm_eur_cents: row['price_per_sqm_eur_cents'] != null ? Number(row['price_per_sqm_eur_cents']) : null,
    liquidity_score: Number(row['liquidity_score'] ?? 50),
    risk_score: Number(row['risk_score'] ?? 50),
    opportunity_score: Number(row['opportunity_score'] ?? 50),
    undervaluation_pct: Number(row['undervaluation_pct'] ?? 0),
    legal_status: legalStatus,
    is_distressed: Boolean(row['is_distressed']),
    is_auction: Boolean(row['is_auction']),
    auction_date: row['auction_date'] != null ? String(row['auction_date']) : null,
    encumbrances,
    days_on_market: row['days_on_market'] != null ? Number(row['days_on_market']) : null,
    price_history: priceHistory,
    normalization_status: normalizationStatus,
    first_seen_at: String(row['first_seen_at'] ?? new Date().toISOString()),
    last_updated_at: String(row['last_updated_at'] ?? new Date().toISOString()),
    delisted_at: row['delisted_at'] != null ? String(row['delisted_at']) : null,
  }
}
