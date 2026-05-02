// =============================================================================
// Agency Group — Imovirtual Provider Adapter
// lib/ingestion/providers/imovirtual.ts
//
// Imovirtual is Portugal's largest residential property portal.
// They do NOT have a public API — data is fetched via their public HTML/JSON
// search endpoint (same method as the portal uses).
//
// Confidence: 0.90 (major verified portal, but no official API = scraping)
// Auth: None required — public HTML search
//
// TECHNICAL NOTE:
// Imovirtual serves listing data via a JSON-in-HTML pattern:
//   GET /imoveis-para-venda/portugal/?page=N
//   The page contains a <script type="application/json" data-json="..."> tag
//   with structured listing data. This is the same feed used by their SPA.
//
// Rate limiting: 1 request per 2s, max 5 pages per run.
// If response changes structure, adapter returns [] gracefully (no crashes).
// =============================================================================

import {
  type ProviderAdapter,
  type ProviderListing,
  type ProviderFetchParams,
  type NormalizedPropertyType,
  PROVIDER_CONFIDENCE,
} from '@/lib/ingestion/types'
import { resolvePropertyZone } from '@/lib/market/zones'

const IMOVIRTUAL_BASE = 'https://www.imovirtual.com'

const FETCH_HEADERS = {
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept':          'text/html,application/xhtml+xml',
  'Accept-Language': 'pt-PT,pt;q=0.9',
  'Cache-Control':   'no-cache',
}

// ---------------------------------------------------------------------------
// Imovirtual listing shape (from their internal JSON)
// ---------------------------------------------------------------------------

interface ImovirtualListing {
  id:              string
  title:           string
  price?:          { value: number; currency: string }
  totalArea?:      { value: number; unit: string }
  roomsNumber?:    number
  bathrooms?:      number
  location?: {
    address?: { street?: string; city?: string; province?: string }
    mapDetails?: { lat?: number; lon?: number }
  }
  media?: {
    photos?: Array<{ src: string }>
    hasPlan?: boolean
    hasVideo?: boolean
  }
  description?:    string
  characteristics?: Array<{ key: string; value: string }>
  dateCreated?:    string
  url?:            string
}

// ---------------------------------------------------------------------------
// Type normalization from Imovirtual categories
// ---------------------------------------------------------------------------

function normalizeType(category: string): NormalizedPropertyType {
  const c = (category ?? '').toLowerCase()
  if (c.includes('apartamento') || c.includes('flat')) return 'apartment'
  if (c.includes('moradia') || c.includes('villa') || c.includes('vivenda')) return 'villa'
  if (c.includes('penthouse')) return 'penthouse'
  if (c.includes('terreno') || c.includes('lote')) return 'land'
  if (c.includes('comercial') || c.includes('loja')) return 'commercial'
  if (c.includes('escritório')) return 'office'
  return 'apartment'  // default for residential portal
}

// ---------------------------------------------------------------------------
// Parse Imovirtual page HTML → listings array
// Imovirtual embeds listing data in: <script id="server-app-state" type="application/json">
// ---------------------------------------------------------------------------

function parseImovirtualPage(html: string): ImovirtualListing[] {
  try {
    // Primary pattern: JSON in script tag with listing data
    const scriptMatch = html.match(
      /<script[^>]+id="server-app-state"[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/i,
    ) ?? html.match(
      /<script[^>]+data-nuxt-data[^>]*>([\s\S]*?)<\/script>/i,
    )

    if (!scriptMatch) return []

    const raw = scriptMatch[1].trim()
    const data = JSON.parse(raw)

    // Navigate the state tree to find listing array
    // Imovirtual stores it at different paths depending on page version
    const listings: ImovirtualListing[] = (
      data?.['search/listing']?.data?.searchAds?.items ??
      data?.searchAds?.items ??
      data?.items ??
      []
    )

    return Array.isArray(listings) ? listings : []
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// Normalize Imovirtual listing → ProviderListing
// ---------------------------------------------------------------------------

function normalize(l: ImovirtualListing, fallbackCity: string): ProviderListing {
  const city = l.location?.address?.city ?? fallbackCity
  const address = [
    l.location?.address?.street,
    city,
    l.location?.address?.province,
  ].filter(Boolean).join(', ')

  const zone = resolvePropertyZone({ address, city })
  const photos = (l.media?.photos ?? []).map(p => p.src).filter(Boolean)

  return {
    provider:            'imovirtual',
    provider_listing_id: l.id,
    source_confidence:   PROVIDER_CONFIDENCE.imovirtual,
    source_url:          l.url ? (l.url.startsWith('http') ? l.url : `${IMOVIRTUAL_BASE}${l.url}`) : IMOVIRTUAL_BASE,

    title:       l.title ?? `Imóvel em ${city}`,
    price:       l.price?.value ?? 0,
    area_m2:     l.totalArea?.value ?? null,
    bedrooms:    l.roomsNumber ?? null,
    bathrooms:   l.bathrooms ?? null,
    type:        normalizeType(l.title ?? ''),
    status:      'active',

    address:     address || null,
    zone,
    city,
    latitude:    l.location?.mapDetails?.lat ?? null,
    longitude:   l.location?.mapDetails?.lon ?? null,

    description: l.description ?? null,
    photos,
    features:    [],
    has_floorplan: l.media?.hasPlan ?? false,
    has_video:     l.media?.hasVideo ?? false,
    num_photos:    photos.length,

    listed_at:  l.dateCreated ?? null,
    scraped_at: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Fetch one page from Imovirtual
// ---------------------------------------------------------------------------

async function fetchPage(citySlug: string, page: number): Promise<ImovirtualListing[]> {
  try {
    const url = `${IMOVIRTUAL_BASE}/imoveis-para-venda/${citySlug}/?page=${page}`
    const res = await fetch(url, {
      headers: FETCH_HEADERS,
      signal:  AbortSignal.timeout(20_000),
    })
    if (!res.ok) return []
    const html = await res.text()
    return parseImovirtualPage(html)
  } catch {
    return []
  }
}

// City slugs used in Imovirtual URLs
const CITY_SLUGS: Record<string, string> = {
  'Lisboa':   'lisboa',
  'Porto':    'porto',
  'Cascais':  'cascais',
  'Algarve':  'algarve',
  'Braga':    'braga',
  'Madeira':  'madeira-ilha',
  'Coimbra':  'coimbra',
}

const DEFAULT_CITIES = ['Lisboa', 'Porto', 'Algarve', 'Cascais']

// ---------------------------------------------------------------------------
// Imovirtual Provider Adapter
// ---------------------------------------------------------------------------

export const imovirtualAdapter: ProviderAdapter = {
  name:       'imovirtual',
  confidence: PROVIDER_CONFIDENCE.imovirtual,

  // Always "configured" — no API key required; scraping public pages
  isConfigured: () => true,

  async fetchListings(params: ProviderFetchParams = {}): Promise<ProviderListing[]> {
    const all: ProviderListing[] = []
    const limit = params.limit ?? 100
    const cities = params.city ? [params.city] : DEFAULT_CITIES

    for (const city of cities) {
      if (all.length >= limit) break
      const slug = CITY_SLUGS[city] ?? city.toLowerCase()
      const maxPages = Math.min(5, Math.ceil((limit - all.length) / 20))

      for (let page = 1; page <= maxPages; page++) {
        if (all.length >= limit) break

        const listings = await fetchPage(slug, page)
        if (listings.length === 0) break

        for (const l of listings) {
          if (!l.id || !l.price?.value) continue  // skip malformed
          if (params.minPrice && l.price.value < params.minPrice) continue
          if (params.maxPrice && l.price.value > params.maxPrice) continue

          all.push(normalize(l, city))
          if (all.length >= limit) break
        }

        // Respectful rate limit between pages
        await new Promise(r => setTimeout(r, 1200))
      }
    }

    return all
  },
}
