// =============================================================================
// Agency Group — Casafari Provider Adapter
// lib/ingestion/providers/casafari.ts
//
// Casafari is a professional B2B real estate data platform that aggregates
// listings from all major Portugal portals (Idealista, Imovirtual, OLX, etc.)
// and adds AVM, comparable sales, and lead generation features.
//
// API type: REST API with Bearer token auth
// Requires a paid B2B contract — contact: sales@casafari.com
//
// ─── SETUP ────────────────────────────────────────────────────────────────────
// 1. Contact Casafari to obtain an API contract (typically B2B subscription)
// 2. After contract: obtain CASAFARI_API_KEY (Bearer token)
// 3. Add to .env.local and Vercel:
//      CASAFARI_API_KEY=<your_api_key>
//
// When CASAFARI_API_KEY is not set, isConfigured() returns false
// and fetchListings() returns [] gracefully (no crashes, no mock data).
//
// Confidence: 1.00 (highest — aggregates all portals + deduplicates natively)
// =============================================================================

import {
  type ProviderAdapter,
  type ProviderListing,
  type ProviderFetchParams,
  type NormalizedPropertyType,
  type NormalizedCondition,
  PROVIDER_CONFIDENCE,
} from '@/lib/ingestion/types'

const CASAFARI_BASE = 'https://api.casafari.com/v1'

// ---------------------------------------------------------------------------
// Casafari API shapes (as documented in their public API spec)
// ---------------------------------------------------------------------------

interface CasafariProperty {
  id:                 string
  title:              string
  price:              number
  previousPrice?:     number
  area?:              number
  bedroomCount?:      number
  bathroomCount?:     number
  type:               string
  condition?:         string
  status?:            string
  address?: {
    street?:       string
    city?:         string
    region?:       string
    neighborhood?: string
    lat?:          number
    lng?:          number
  }
  description?:       string
  photos?:            string[]
  features?:          string[]
  hasFloorplan?:      boolean
  hasVideo?:          boolean
  publishedAt?:       string
  updatedAt?:         string
  portalSource?:      string   // which portal it came from
  portalListingId?:   string
  url?:               string
}

interface CasafariSearchResponse {
  data:       CasafariProperty[]
  total:      number
  page:       number
  totalPages: number
}

// ---------------------------------------------------------------------------
// Type normalization
// ---------------------------------------------------------------------------

function normalizeType(t: string): NormalizedPropertyType {
  const type = (t ?? '').toLowerCase()
  if (type === 'apartment')            return 'apartment'
  if (type === 'penthouse')            return 'penthouse'
  if (type === 'villa' || type === 'detached_house') return 'villa'
  if (type === 'townhouse' || type === 'semi-detached') return 'townhouse'
  if (type === 'land' || type === 'plot') return 'land'
  if (type === 'office')               return 'office'
  if (type === 'commercial')           return 'commercial'
  if (type === 'warehouse')            return 'warehouse'
  if (type === 'hotel')                return 'hotel'
  if (type === 'development' || type === 'building') return 'development_plot'
  return 'other'
}

function normalizeCondition(c?: string): NormalizedCondition {
  const cond = (c ?? '').toLowerCase()
  if (cond === 'new' || cond === 'newly_built') return 'new'
  if (cond === 'excellent' || cond === 'very_good') return 'excellent'
  if (cond === 'good')                              return 'good'
  if (cond === 'needs_renovation' || cond === 'for_renovation') return 'needs_renovation'
  if (cond === 'ruin')                              return 'ruin'
  return 'good'
}

// ---------------------------------------------------------------------------
// Normalize Casafari property → ProviderListing
// ---------------------------------------------------------------------------

function normalize(p: CasafariProperty): ProviderListing {
  return {
    provider:            'casafari',
    provider_listing_id: p.id,
    source_confidence:   PROVIDER_CONFIDENCE.casafari,
    source_url:          p.url ?? CASAFARI_BASE,

    title:       p.title,
    price:       p.price,
    price_previous: p.previousPrice ?? null,
    area_m2:     p.area ?? null,
    bedrooms:    p.bedroomCount ?? null,
    bathrooms:   p.bathroomCount ?? null,
    type:        normalizeType(p.type),
    condition:   normalizeCondition(p.condition),
    status:      'active',

    address:     [p.address?.street, p.address?.city].filter(Boolean).join(', ') || null,
    zone:        p.address?.neighborhood || p.address?.region || null,
    city:        p.address?.city ?? null,
    latitude:    p.address?.lat ?? null,
    longitude:   p.address?.lng ?? null,

    description: p.description ?? null,
    photos:      p.photos ?? [],
    features:    p.features ?? [],
    has_floorplan: p.hasFloorplan ?? false,
    has_video:     p.hasVideo ?? false,
    num_photos:    (p.photos ?? []).length,

    listed_at:  p.publishedAt ?? null,
    scraped_at: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Casafari Provider Adapter
// ---------------------------------------------------------------------------

export const casafariAdapter: ProviderAdapter = {
  name:       'casafari',
  confidence: PROVIDER_CONFIDENCE.casafari,

  isConfigured(): boolean {
    const key = process.env.CASAFARI_API_KEY
    return !!key && key.trim().length > 0
  },

  async fetchListings(params: ProviderFetchParams = {}): Promise<ProviderListing[]> {
    const apiKey = process.env.CASAFARI_API_KEY
    if (!apiKey) return []

    const all: ProviderListing[] = []
    const limit = params.limit ?? 200

    try {
      const searchBody: Record<string, unknown> = {
        transactionType: params.operation === 'rent' ? 'RENT' : 'SELL',
        status:          'ACTIVE',
        country:         'PT',
        pageSize:        Math.min(50, limit),
        page:            params.page ?? 1,
      }

      if (params.city)     searchBody.city = params.city
      if (params.minPrice) searchBody.minPrice = params.minPrice
      if (params.maxPrice) searchBody.maxPrice = params.maxPrice

      const res = await fetch(`${CASAFARI_BASE}/properties/search`, {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type':  'application/json',
          'Accept':        'application/json',
        },
        body:   JSON.stringify(searchBody),
        signal: AbortSignal.timeout(30_000),
      })

      if (!res.ok) {
        console.error(`[casafari] search ${res.status}: ${await res.text()}`)
        return []
      }

      const data = await res.json() as CasafariSearchResponse

      for (const p of (data.data ?? [])) {
        if (all.length >= limit) break
        if (!p.id || !p.price) continue
        all.push(normalize(p))
      }
    } catch (err) {
      console.error('[casafari] fetchListings error:', err instanceof Error ? err.message : err)
    }

    return all
  },
}
