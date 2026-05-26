// =============================================================================
// Agency Group — Idealista Supply Connector
// lib/supply/idealista/idealistaConnector.ts
//
// Ingests listings from Idealista (PT/ES/IT) as raw opportunities.
// Graceful no-op when API credentials not configured.
//
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type IdealistaMarket = 'PT' | 'ES' | 'IT'
export type IdealistaPropertyType = 'RESIDENTIAL' | 'COMMERCIAL' | 'LAND' | 'GARAGE' | 'OFFICE'

export interface IdealistaRawListing {
  source_id: string                         // idealistaId from API
  source: 'IDEALISTA'
  market: IdealistaMarket
  url: string
  title: string
  address: string
  city: string
  district: string | null
  property_type: IdealistaPropertyType
  size_sqm: number | null
  bedrooms: number | null
  bathrooms: number | null
  floor: number | null
  asking_price_eur_cents: number            // EUR cents (integer)
  price_per_sqm_eur_cents: number | null    // EUR cents per m²
  listing_date: string                       // ISO 8601
  days_on_market: number | null
  is_bank_owned: boolean
  is_auction: boolean
  description: string | null
  images: string[]
  latitude: number | null
  longitude: number | null
  confidence_score: number                  // 0.85 for Idealista
  fetched_at: string
  raw_payload: Record<string, unknown>      // original API response
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CONFIDENCE_SCORE = 0.85

function toPropertyType(raw: unknown): IdealistaPropertyType {
  const s = String(raw ?? '').toUpperCase()
  if (s.includes('COMMERCIAL') || s.includes('COMERCIAL')) return 'COMMERCIAL'
  if (s.includes('LAND') || s.includes('TERRENO') || s.includes('SOLAR')) return 'LAND'
  if (s.includes('GARAGE') || s.includes('GARAJE') || s.includes('GARAGEM')) return 'GARAGE'
  if (s.includes('OFFICE') || s.includes('OFICINA') || s.includes('ESCRITORIO')) return 'OFFICE'
  return 'RESIDENTIAL'
}

function toEurCents(rawPrice: unknown): number {
  const n = Number(rawPrice ?? 0)
  // Idealista returns prices in EUR (not cents) — multiply by 100
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
  market: IdealistaMarket,
): IdealistaRawListing {
  const priceEur = Number(item['price'] ?? 0)
  const sizeSqm = item['size'] != null ? Number(item['size']) : null
  const priceCents = toEurCents(priceEur)
  const pricePer =
    sizeSqm && sizeSqm > 0 ? Math.round((priceCents / sizeSqm) * 100) / 100 : null

  // observed fields (directly from API)
  const observed: Record<string, unknown> = {
    idealistaId: item['propertyCode'],
    price: item['price'],
    size: item['size'],
    rooms: item['rooms'],
    bathrooms: item['bathrooms'],
    floor: item['floor'],
    address: item['address'],
    municipality: item['municipality'],
    district: item['district'],
    propertyType: item['propertyType'],
    description: item['description'],
    url: item['url'],
    thumbnail: item['thumbnail'],
    images: item['images'],
    showAddress: item['showAddress'],
    exterior: item['exterior'],
    hasLift: item['hasLift'],
    parkingSpace: item['parkingSpace'],
    labels: item['labels'],
    suggestedTexts: item['suggestedTexts'],
    topPlus: item['topPlus'],
    highlight: item['highlight'],
    listingCreatedDate: item['date'],
    latitude: (item['coordinate'] as Record<string, unknown> | undefined)?.['lat'],
    longitude: (item['coordinate'] as Record<string, unknown> | undefined)?.['lon'],
  }

  return {
    source_id: String(item['propertyCode'] ?? `idealista-${Date.now()}`),
    source: 'IDEALISTA',
    market,
    url: String(item['url'] ?? ''),
    title: String(item['suggestedTexts'] != null
      ? (item['suggestedTexts'] as Record<string, unknown>)['title'] ?? item['address'] ?? ''
      : item['address'] ?? ''),
    address: String(item['address'] ?? ''),
    city: String(item['municipality'] ?? ''),
    district: item['district'] != null ? String(item['district']) : null,
    property_type: toPropertyType(item['propertyType']),
    size_sqm: sizeSqm,
    bedrooms: item['rooms'] != null ? Number(item['rooms']) : null,
    bathrooms: item['bathrooms'] != null ? Number(item['bathrooms']) : null,
    floor: item['floor'] != null ? Number(item['floor']) : null,
    asking_price_eur_cents: priceCents,
    price_per_sqm_eur_cents: pricePer != null ? Math.round(pricePer) : null,
    listing_date: parseListingDate(item['date']),
    days_on_market: null, // inferred — not in Idealista raw response
    is_bank_owned: Array.isArray(item['labels']) && (item['labels'] as string[]).some(l => l.toLowerCase().includes('bank')),
    is_auction: Array.isArray(item['labels']) && (item['labels'] as string[]).some(l => l.toLowerCase().includes('auction') || l.toLowerCase().includes('leilao')),
    description: item['description'] != null ? String(item['description']) : null,
    images: Array.isArray(item['images'])
      ? (item['images'] as unknown[]).map(img =>
          typeof img === 'string' ? img : String((img as Record<string, unknown>)['url'] ?? ''))
      : [],
    latitude: (item['coordinate'] as Record<string, unknown> | undefined)?.['lat'] != null
      ? Number((item['coordinate'] as Record<string, unknown>)['lat'])
      : null,
    longitude: (item['coordinate'] as Record<string, unknown> | undefined)?.['lon'] != null
      ? Number((item['coordinate'] as Record<string, unknown>)['lon'])
      : null,
    confidence_score: CONFIDENCE_SCORE,
    fetched_at: new Date().toISOString(),
    raw_payload: { ...observed },
  }
}

async function persistListings(listings: IdealistaRawListing[]): Promise<void> {
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
    is_distressed: l.is_bank_owned || l.is_auction,
    confidence_score: l.confidence_score,
    data_observed: {
      source_id: l.source_id,
      url: l.url,
      title: l.title,
      address: l.address,
      city: l.city,
      district: l.district,
      property_type: l.property_type,
      size_sqm: l.size_sqm,
      bedrooms: l.bedrooms,
      bathrooms: l.bathrooms,
      floor: l.floor,
      asking_price_eur_cents: l.asking_price_eur_cents,
      listing_date: l.listing_date,
      is_bank_owned: l.is_bank_owned,
      is_auction: l.is_auction,
      description: l.description,
      images: l.images,
      latitude: l.latitude,
      longitude: l.longitude,
    },
    data_inferred: {
      price_per_sqm_eur_cents: l.price_per_sqm_eur_cents,
      days_on_market: l.days_on_market,
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
    log.warn('[idealistaConnector] upsert failed', { error: String(error) })
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch Idealista listings for a given market and optional city.
 * Requires IDEALISTA_API_KEY + IDEALISTA_BASE_URL env vars.
 * Returns empty array when credentials not configured.
 */
export async function fetchIdealistaListings(
  market: IdealistaMarket,
  city?: string,
  maxResults = 50,
): Promise<IdealistaRawListing[]> {
  const apiKey = process.env.IDEALISTA_API_KEY
  const baseUrl = process.env.IDEALISTA_BASE_URL

  if (!apiKey || !baseUrl) {
    log.info('[idealistaConnector] No API credentials — returning empty array', { market, city })
    return []
  }

  try {
    const countryCode = market.toLowerCase()
    const params = new URLSearchParams({
      country: countryCode,
      numPage: '1',
      numItems: String(Math.min(maxResults, 50)),
      ...(city ? { locationId: city } : {}),
    })

    const res = await fetch(`${baseUrl}/3.5/${countryCode}/search?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      log.warn('[idealistaConnector] API returned non-OK status', { status: res.status, market })
      return []
    }

    const data = (await res.json()) as Record<string, unknown>
    const items = Array.isArray(data['elementList'])
      ? (data['elementList'] as Record<string, unknown>[])
      : []

    const listings = items.map(item => mapApiItemToListing(item, market))
    void persistListings(listings).catch(e => console.warn('[idealistaConnector] persist error', e))

    log.info('[idealistaConnector] fetched listings', { market, city, count: listings.length })
    return listings
  } catch (e) {
    log.warn('[idealistaConnector] fetch error — graceful no-op', { error: String(e), market })
    return []
  }
}

/**
 * Fetch a single Idealista listing by ID.
 */
export async function fetchIdealistaListing(
  listingId: string,
  market: IdealistaMarket,
): Promise<IdealistaRawListing | null> {
  const apiKey = process.env.IDEALISTA_API_KEY
  const baseUrl = process.env.IDEALISTA_BASE_URL

  if (!apiKey || !baseUrl) {
    log.info('[idealistaConnector] No API credentials for single fetch', { listingId, market })
    return null
  }

  try {
    const countryCode = market.toLowerCase()
    const res = await fetch(`${baseUrl}/3.5/${countryCode}/detail/${listingId}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      log.warn('[idealistaConnector] single listing API non-OK', { status: res.status, listingId })
      return null
    }

    const item = (await res.json()) as Record<string, unknown>
    const listing = mapApiItemToListing(item, market)
    void persistListings([listing]).catch(e => console.warn('[idealistaConnector] persist single error', e))
    return listing
  } catch (e) {
    log.warn('[idealistaConnector] single fetch error', { error: String(e), listingId })
    return null
  }
}

/**
 * Read aggregated stats from raw_opportunity_stream for Idealista source.
 */
export async function getIdealistaStats(
  tenantId: string,
): Promise<{ total_fetched: number; markets: Record<string, number>; last_fetch_at: string | null }> {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('raw_opportunity_stream')
      .select('market, ingested_at')
      .eq('tenant_id', tenantId)
      .eq('source', 'IDEALISTA')

    if (error) {
      log.warn('[idealistaConnector] stats query failed', { error: String(error) })
      return { total_fetched: 0, markets: {}, last_fetch_at: null }
    }

    const rows = (data as Array<{ market: string; ingested_at: string }>) ?? []
    const markets: Record<string, number> = {}
    let last: string | null = null

    for (const row of rows) {
      markets[row.market] = (markets[row.market] ?? 0) + 1
      if (!last || row.ingested_at > last) last = row.ingested_at
    }

    return { total_fetched: rows.length, markets, last_fetch_at: last }
  } catch (e) {
    log.warn('[idealistaConnector] stats error', { error: String(e) })
    return { total_fetched: 0, markets: {}, last_fetch_at: null }
  }
}
