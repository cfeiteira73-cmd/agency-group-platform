// =============================================================================
// Agency Group — Idealista Provider Adapter
// lib/ingestion/providers/idealista.ts
//
// Wraps existing lib/idealista-api.ts into the unified ProviderAdapter interface.
// Handles multi-city pagination and type normalization.
//
// Confidence: 0.95 (commercial portal, professional listings, trusted data)
// Auth: IDEALISTA_API_KEY + IDEALISTA_API_SECRET (OAuth2)
// =============================================================================

import {
  searchProperties,
  isConfigured as idealistaIsConfigured,
  type IdealistaProperty,
} from '@/lib/idealista-api'
import {
  type ProviderAdapter,
  type ProviderListing,
  type ProviderFetchParams,
  type NormalizedPropertyType,
  type NormalizedCondition,
  PROVIDER_CONFIDENCE,
} from '@/lib/ingestion/types'

// ---------------------------------------------------------------------------
// City centers for Portugal's main markets (lat,lon)
// ---------------------------------------------------------------------------

const CITY_CENTERS: Record<string, string> = {
  'Lisboa':    '38.7167,-9.1333',
  'Porto':     '41.1579,-8.6291',
  'Cascais':   '38.6979,-9.4215',
  'Algarve':   '37.0179,-7.9305',
  'Madeira':   '32.6669,-16.9241',
  'Braga':     '41.5518,-8.4229',
  'Coimbra':   '40.2033,-8.4103',
  'Setúbal':   '38.5245,-8.8882',
}

const DEFAULT_CITIES = ['Lisboa', 'Porto', 'Cascais', 'Algarve']

// ---------------------------------------------------------------------------
// Type mapping: Idealista propertyType → our NormalizedPropertyType
// ---------------------------------------------------------------------------

function normalizeType(idealistaType: string): NormalizedPropertyType {
  const t = idealistaType.toLowerCase()
  if (t === 'flat' || t === 'apartment' || t === 'home') return 'apartment'
  if (t === 'penthouse') return 'penthouse'
  if (t === 'villa' || t === 'chalet') return 'villa'
  if (t === 'townhouse' || t === 'semi-detached') return 'townhouse'
  if (t === 'land' || t === 'plot') return 'land'
  if (t === 'office') return 'office'
  if (t === 'premises' || t === 'commercial') return 'commercial'
  if (t === 'garage') return 'commercial'
  if (t === 'building' || t === 'development') return 'development_plot'
  return 'other'
}

// ---------------------------------------------------------------------------
// Condition mapping
// ---------------------------------------------------------------------------

function normalizeCondition(status: string): NormalizedCondition {
  const s = status.toLowerCase()
  if (s === 'new' || s === 'newly_built') return 'new'
  if (s === 'good' || s === 'very_good') return 'good'
  if (s === 'for_renovation' || s === 'needs_renovation') return 'needs_renovation'
  if (s === 'ruin') return 'ruin'
  return 'good'  // default
}

// ---------------------------------------------------------------------------
// Map IdealistaProperty → ProviderListing
// ---------------------------------------------------------------------------

function normalize(p: IdealistaProperty): ProviderListing {
  const features: string[] = []
  if (p.hasLift)       features.push('lift')
  if (p.hasPlan)       features.push('floorplan')
  if (p.has3DTour)     features.push('3d_tour')
  if (p.has360)        features.push('360_view')
  if (p.exterior)      features.push('exterior')
  if (p.parkingSpace?.hasParkingSpace) features.push('parking')

  const city = p.municipality || p.province || 'Portugal'

  return {
    provider:            'idealista',
    provider_listing_id: p.propertyCode,
    source_confidence:   PROVIDER_CONFIDENCE.idealista,
    source_url:          p.url,

    title:       p.suggestedTexts?.title
                   ?? `${p.rooms > 0 ? `T${p.rooms} ` : ''}${p.propertyType} em ${p.neighborhood || city}`.trim(),
    price:       p.price,
    area_m2:     p.size > 0 ? p.size : null,
    bedrooms:    p.rooms > 0 ? p.rooms : null,
    bathrooms:   p.bathrooms > 0 ? p.bathrooms : null,
    type:        normalizeType(p.propertyType),
    condition:   normalizeCondition(p.status),
    status:      'active',

    address:     p.showAddress ? p.address : null,
    zone:        p.neighborhood || p.district || null,
    city,
    latitude:    p.latitude  || null,
    longitude:   p.longitude || null,

    description: p.description,
    photos:      p.thumbnail ? [p.thumbnail] : [],
    features,
    has_floorplan: p.hasPlan,
    has_video:     p.hasVideo,
    num_photos:    p.numPhotos,

    listed_at:   null,  // Idealista API doesn't expose listing date
    scraped_at:  new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Idealista Provider Adapter
// ---------------------------------------------------------------------------

export const idealistaAdapter: ProviderAdapter = {
  name:       'idealista',
  confidence: PROVIDER_CONFIDENCE.idealista,

  isConfigured: idealistaIsConfigured,

  async fetchListings(params: ProviderFetchParams = {}): Promise<ProviderListing[]> {
    const all: ProviderListing[] = []

    const citiesToSearch = params.city
      ? [params.city]
      : DEFAULT_CITIES

    const limit = params.limit ?? 200

    for (const city of citiesToSearch) {
      if (all.length >= limit) break

      const center = CITY_CENTERS[city]
      if (!center) continue

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await searchProperties({
        operation:    params.operation ?? 'sale',
        propertyType: 'homes',
        center,
        distance:     30000,
        minPrice:     params.minPrice,
        maxPrice:     params.maxPrice,
        maxItems:     Math.min(50, limit - all.length),
        order:        'updatedAt',
        sort:         'desc',
      })

      if (!result?.elementList) continue

      for (const p of result.elementList) {
        // Skip mock data (only present when API not configured)
        if (p.propertyCode?.startsWith('MOCK-')) continue
        all.push(normalize(p))
      }
    }

    return all
  },
}
