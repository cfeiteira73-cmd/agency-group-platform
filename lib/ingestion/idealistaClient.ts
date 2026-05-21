// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — Idealista Client (Wave 32 Layer 1)
// lib/ingestion/idealistaClient.ts
//
// Thin fetch wrapper for the Idealista API used by the canonical ingestion
// pipeline.  If IDEALISTA_API_KEY is absent or equals 'PREENCHER', returns []
// gracefully.
// =============================================================================

import log from '@/lib/logger'

// ─── Public types ─────────────────────────────────────────────────────────────

export interface IdealistaProperty {
  external_id: string
  title: string
  price: number
  area_sqm: number
  typology: string
  zone: string
  province: string
  country: string           // 'PT'|'ES'
  latitude?: number
  longitude?: number
  description?: string
  source: 'idealista'
  listed_at: string
  updated_at: string
}

export interface IdealistaListingsFilters {
  location?: string
  min_price?: number
  max_price?: number
  limit?: number
}

// ─── Internal API types ───────────────────────────────────────────────────────

interface IdealistaApiItem {
  propertyCode?: string
  price?: number
  size?: number
  rooms?: number | null
  propertyType?: string | null
  district?: string | null
  municipality?: string | null
  province?: string | null
  country?: string
  latitude?: number
  longitude?: number
  description?: string
  publishDate?: number      // Unix timestamp
  modificationDate?: number // Unix timestamp
  suggestedTexts?: { title?: string; subtitle?: string }
}

interface IdealistaApiResponse {
  elementList?: IdealistaApiItem[]
  total?: number
  totalPages?: number
}

interface OAuthTokenResponse {
  access_token: string
  expires_in: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isConfigured(key: string): boolean {
  return key.length > 0 && key !== 'PREENCHER'
}

function mapTypology(rooms: number | null | undefined, propertyType: string | null | undefined): string {
  if (propertyType) {
    const pt = propertyType.toLowerCase()
    if (pt === 'studio' || pt === 'studio apartment') return 'T0'
  }
  const r = rooms ?? 0
  if (r === 0) return 'T0'
  if (r === 1) return 'T1'
  if (r === 2) return 'T2'
  if (r === 3) return 'T3'
  if (r === 4) return 'T4'
  return 'T5+'
}

function toIso(unix?: number): string {
  if (!unix) return new Date().toISOString()
  return new Date(unix * 1000).toISOString()
}

function mapItem(item: IdealistaApiItem): IdealistaProperty | null {
  if (!item.propertyCode) return null
  const title = item.suggestedTexts?.title
    ?? `${mapTypology(item.rooms, item.propertyType)} em ${item.municipality ?? ''}`
  return {
    external_id: item.propertyCode,
    title,
    price:       item.price ?? 0,
    area_sqm:    item.size ?? 0,
    typology:    mapTypology(item.rooms, item.propertyType),
    zone:        item.district ?? item.municipality ?? '',
    province:    item.province ?? '',
    country:     (item.country ?? 'ES').toUpperCase() as 'PT' | 'ES',
    latitude:    item.latitude ?? undefined,
    longitude:   item.longitude ?? undefined,
    description: item.description ?? undefined,
    source:      'idealista',
    listed_at:   toIso(item.publishDate),
    updated_at:  toIso(item.modificationDate),
  }
}

// ─── Token cache (module-level singleton) ─────────────────────────────────────

let _accessToken: string | null = null
let _tokenExpiresAt = 0

async function getAccessToken(apiKey: string, apiUrl: string): Promise<string | null> {
  const now = Date.now()
  if (_accessToken && now < _tokenExpiresAt - 60_000) return _accessToken

  const oauthUrl = `${apiUrl}/oauth/token`
  let res: Response
  try {
    res = await fetch(oauthUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials&scope=read',
      signal: AbortSignal.timeout(10_000),
    })
  } catch (err) {
    log.warn('[idealistaClient] OAuth network error', { error: String(err) })
    return null
  }

  if (!res.ok) {
    log.warn('[idealistaClient] OAuth token request failed', { status: res.status })
    return null
  }

  const token = (await res.json()) as OAuthTokenResponse
  _accessToken    = token.access_token
  _tokenExpiresAt = now + (token.expires_in ?? 604800) * 1000
  return _accessToken
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Fetch listings from Idealista REST API.
 * Returns [] if the API key is not configured or equals 'PREENCHER'.
 */
export async function fetchIdealistaListings(
  filters?: IdealistaListingsFilters,
): Promise<IdealistaProperty[]> {
  const apiKey = process.env.IDEALISTA_API_KEY ?? ''
  const apiUrl = process.env.IDEALISTA_API_URL ?? 'https://api.idealista.com/3.5'

  if (!isConfigured(apiKey)) {
    log.warn('[idealistaClient] IDEALISTA_API_KEY not configured — skipping fetch', {})
    return []
  }

  const accessToken = await getAccessToken(apiKey, apiUrl)
  if (!accessToken) return []

  const limit = filters?.limit ?? 50
  const form = new URLSearchParams({
    operation:    'sale',
    propertyType: 'homes',
    maxItems:     String(Math.min(limit, 50)),
    order:        'updated',
    sort:         'desc',
  })
  if (filters?.location)  form.set('locationId', filters.location)
  if (filters?.min_price) form.set('minPrice', String(filters.min_price))
  if (filters?.max_price) form.set('maxPrice', String(filters.max_price))

  const url = `${apiUrl}/pt/search`

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: form.toString(),
      signal: AbortSignal.timeout(15_000),
    })
  } catch (err) {
    log.warn('[idealistaClient] network error', { error: String(err) })
    return []
  }

  if (res.status === 429) {
    log.warn('[idealistaClient] rate limited (429) — returning empty batch', {})
    return []
  }

  if (!res.ok) {
    log.warn('[idealistaClient] non-OK response', { status: res.status })
    return []
  }

  let body: IdealistaApiResponse
  try {
    body = (await res.json()) as IdealistaApiResponse
  } catch (err) {
    log.warn('[idealistaClient] JSON parse error', { error: String(err) })
    return []
  }

  const items = body.elementList ?? []
  const results: IdealistaProperty[] = []
  for (const item of items) {
    const mapped = mapItem(item)
    if (mapped) results.push(mapped)
  }

  log.info('[idealistaClient] fetched listings', { count: results.length })
  return results
}
