// =============================================================================
// Agency Group — Casafari Supply Connector
// lib/supply/casafari/casafariConnector.ts
//
// Ingests listings from Casafari (PT/ES/FR/IT/DE) as raw opportunities.
// Casafari is a European real estate data aggregator.
// Graceful no-op when API credentials not configured.
//
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type CasafariMarket = 'PT' | 'ES' | 'FR' | 'IT' | 'DE'

export interface CasafariRawListing {
  source_id: string               // Casafari internal ID
  source: 'CASAFARI'
  market: CasafariMarket
  url: string | null
  address: string
  city: string
  country: string
  property_type: string
  size_sqm: number | null
  bedrooms: number | null
  asking_price_eur_cents: number
  price_per_sqm_eur_cents: number | null
  listing_date: string
  days_on_market: number | null
  is_aggregated: boolean          // true = Casafari already aggregated from multiple sources
  original_sources: string[]      // e.g. ['Idealista', 'Imovirtual']
  confidence_score: number        // 0.80 for Casafari
  fetched_at: string
  raw_payload: Record<string, unknown>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CONFIDENCE_SCORE = 0.80

const MARKET_TO_COUNTRY: Record<CasafariMarket, string> = {
  PT: 'Portugal',
  ES: 'Spain',
  FR: 'France',
  IT: 'Italy',
  DE: 'Germany',
}

function toEurCents(rawPrice: unknown): number {
  const n = Number(rawPrice ?? 0)
  // Casafari returns prices in EUR — multiply by 100 for cents
  return Math.round(n * 100)
}

function parseListingDate(raw: unknown): string {
  if (typeof raw === 'string' && raw.length > 0) {
    try {
      return new Date(raw).toISOString()
    } catch {
      // fall through
    }
  }
  return new Date().toISOString()
}

function mapApiItemToListing(
  item: Record<string, unknown>,
  market: CasafariMarket,
): CasafariRawListing {
  const priceEur = Number(item['price'] ?? item['asking_price'] ?? 0)
  const sizeSqm = item['size'] != null ? Number(item['size']) : null
  const priceCents = toEurCents(priceEur)
  const pricePerSqm =
    sizeSqm && sizeSqm > 0 ? Math.round(priceCents / sizeSqm) : null

  const originalSources: string[] = []
  const rawSources = item['sources'] ?? item['original_sources'] ?? []
  if (Array.isArray(rawSources)) {
    for (const s of rawSources as unknown[]) {
      if (typeof s === 'string') originalSources.push(s)
      else if (s && typeof (s as Record<string, unknown>)['name'] === 'string') {
        originalSources.push(String((s as Record<string, unknown>)['name']))
      }
    }
  }

  // observed fields (directly from API)
  const observed: Record<string, unknown> = {
    casafariId: item['id'] ?? item['property_id'],
    price: item['price'] ?? item['asking_price'],
    size: item['size'],
    bedrooms: item['bedrooms'] ?? item['rooms'],
    address: item['address'] ?? item['location'],
    city: item['city'] ?? item['municipality'],
    country: item['country'],
    propertyType: item['property_type'] ?? item['type'],
    url: item['url'] ?? item['listing_url'],
    sources: item['sources'] ?? item['original_sources'],
    createdAt: item['created_at'] ?? item['listing_date'] ?? item['date'],
    daysOnMarket: item['days_on_market'],
    latitude: item['latitude'] ?? (item['location'] as Record<string, unknown> | undefined)?.['lat'],
    longitude: item['longitude'] ?? (item['location'] as Record<string, unknown> | undefined)?.['lng'],
  }

  return {
    source_id: String(item['id'] ?? item['property_id'] ?? `casafari-${Date.now()}`),
    source: 'CASAFARI',
    market,
    url: item['url'] != null || item['listing_url'] != null
      ? String(item['url'] ?? item['listing_url'])
      : null,
    address: String(item['address'] ?? item['location'] ?? ''),
    city: String(item['city'] ?? item['municipality'] ?? ''),
    country: MARKET_TO_COUNTRY[market],
    property_type: String(item['property_type'] ?? item['type'] ?? 'RESIDENTIAL'),
    size_sqm: sizeSqm,
    bedrooms: item['bedrooms'] != null ? Number(item['bedrooms']) : null,
    asking_price_eur_cents: priceCents,
    price_per_sqm_eur_cents: pricePerSqm,
    listing_date: parseListingDate(item['created_at'] ?? item['listing_date'] ?? item['date']),
    days_on_market: item['days_on_market'] != null ? Number(item['days_on_market']) : null,
    is_aggregated: originalSources.length > 1,
    original_sources: originalSources,
    confidence_score: CONFIDENCE_SCORE,
    fetched_at: new Date().toISOString(),
    raw_payload: { ...observed },
  }
}

async function persistListings(listings: CasafariRawListing[]): Promise<void> {
  if (listings.length === 0) return

  const rows = listings.map(l => ({
    tenant_id: process.env.DEFAULT_TENANT_ID ?? 'agency-group',
    source: l.source,
    source_id: l.source_id,
    market: l.market,
    city: l.city,
    property_type: l.property_type,
    size_sqm: l.size_sqm,
    asking_price_eur_cents: l.asking_price_eur_cents,
    price_per_sqm_eur_cents: l.price_per_sqm_eur_cents,
    listing_date: l.listing_date,
    days_on_market: l.days_on_market,
    is_distressed: false,
    confidence_score: l.confidence_score,
    data_observed: {
      source_id: l.source_id,
      url: l.url,
      address: l.address,
      city: l.city,
      country: l.country,
      property_type: l.property_type,
      size_sqm: l.size_sqm,
      bedrooms: l.bedrooms,
      asking_price_eur_cents: l.asking_price_eur_cents,
      listing_date: l.listing_date,
      days_on_market: l.days_on_market,
      is_aggregated: l.is_aggregated,
      original_sources: l.original_sources,
    },
    data_inferred: {
      price_per_sqm_eur_cents: l.price_per_sqm_eur_cents,
      is_aggregated: l.is_aggregated,
    },
    raw_payload: l.raw_payload,
    ingested_at: l.fetched_at,
    last_seen_at: l.fetched_at,
    delisted_at: null,
  }))

  const { error } = await (supabaseAdmin as any)
    .from('raw_opportunity_stream')
    .upsert(rows, { onConflict: 'source,source_id', ignoreDuplicates: false })

  if (error) {
    log.warn('[casafariConnector] upsert failed', { error: String(error) })
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch Casafari listings for a given market and optional city.
 * Requires CASAFARI_API_KEY + CASAFARI_BASE_URL env vars.
 * Returns empty array when credentials not configured.
 */
export async function fetchCasafariListings(
  market: CasafariMarket,
  city?: string,
  maxResults = 50,
): Promise<CasafariRawListing[]> {
  const apiKey = process.env.CASAFARI_API_KEY
  const baseUrl = process.env.CASAFARI_BASE_URL

  if (!apiKey || !baseUrl) {
    log.info('[casafariConnector] No API credentials — returning empty array', { market, city })
    return []
  }

  try {
    const params = new URLSearchParams({
      country: market,
      limit: String(Math.min(maxResults, 100)),
      ...(city ? { city } : {}),
    })

    const res = await fetch(`${baseUrl}/v1/properties?${params.toString()}`, {
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      log.warn('[casafariConnector] API returned non-OK status', { status: res.status, market })
      return []
    }

    const data = (await res.json()) as Record<string, unknown>
    const items = Array.isArray(data['properties'])
      ? (data['properties'] as Record<string, unknown>[])
      : Array.isArray(data['data'])
        ? (data['data'] as Record<string, unknown>[])
        : Array.isArray(data)
          ? (data as Record<string, unknown>[])
          : []

    const listings = items.map(item => mapApiItemToListing(item, market))
    void persistListings(listings).catch(e => console.warn('[casafariConnector] persist error', e))

    log.info('[casafariConnector] fetched listings', { market, city, count: listings.length })
    return listings
  } catch (e) {
    log.warn('[casafariConnector] fetch error — graceful no-op', { error: String(e), market })
    return []
  }
}

/**
 * Fetch comparable sales/listings around a specific address from Casafari.
 * Used for AVM and deal pricing validation.
 */
export async function fetchCasafariComps(
  assetAddress: string,
  market: CasafariMarket,
): Promise<CasafariRawListing[]> {
  const apiKey = process.env.CASAFARI_API_KEY
  const baseUrl = process.env.CASAFARI_BASE_URL

  if (!apiKey || !baseUrl) {
    log.info('[casafariConnector] No API credentials for comps', { assetAddress, market })
    return []
  }

  try {
    const params = new URLSearchParams({
      country: market,
      address: assetAddress,
      radius: '500',      // 500m radius
      limit: '20',
    })

    const res = await fetch(`${baseUrl}/v1/comparables?${params.toString()}`, {
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      log.warn('[casafariConnector] comps API non-OK', { status: res.status, assetAddress })
      return []
    }

    const data = (await res.json()) as Record<string, unknown>
    const items = Array.isArray(data['comparables'])
      ? (data['comparables'] as Record<string, unknown>[])
      : Array.isArray(data['data'])
        ? (data['data'] as Record<string, unknown>[])
        : []

    const listings = items.map(item => mapApiItemToListing(item, market))
    void persistListings(listings).catch(e => console.warn('[casafariConnector] comps persist error', e))

    log.info('[casafariConnector] fetched comps', { assetAddress, market, count: listings.length })
    return listings
  } catch (e) {
    log.warn('[casafariConnector] comps fetch error', { error: String(e), assetAddress })
    return []
  }
}

/**
 * Read aggregated stats from raw_opportunity_stream for Casafari source.
 */
export async function getCasafariStats(
  tenantId: string,
): Promise<{ total_fetched: number; markets: Record<string, number> }> {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('raw_opportunity_stream')
      .select('market')
      .eq('tenant_id', tenantId)
      .eq('source', 'CASAFARI')

    if (error) {
      log.warn('[casafariConnector] stats query failed', { error: String(error) })
      return { total_fetched: 0, markets: {} }
    }

    const rows = (data as Array<{ market: string }>) ?? []
    const markets: Record<string, number> = {}
    for (const row of rows) {
      markets[row.market] = (markets[row.market] ?? 0) + 1
    }

    return { total_fetched: rows.length, markets }
  } catch (e) {
    log.warn('[casafariConnector] stats error', { error: String(e) })
    return { total_fetched: 0, markets: {} }
  }
}
