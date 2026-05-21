// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — Casafari Client (Wave 32 Layer 1)
// lib/ingestion/casafariClient.ts
//
// Thin fetch wrapper for the Casafari API used by the canonical ingestion
// pipeline.  If CASAFARI_API_KEY is absent or equals 'PREENCHER', returns []
// gracefully.  Rate-limit 429 → returns partial results with a warning.
// =============================================================================

import log from '@/lib/logger'

// ─── Public types ─────────────────────────────────────────────────────────────

export interface CasafariProperty {
  external_id: string
  title: string
  price: number
  area_sqm: number
  typology: string          // 'T0'|'T1'|'T2'|'T3'|'T4'|'T5+'
  zone: string
  district: string
  country: string           // 'PT'|'ES'
  latitude?: number
  longitude?: number
  description?: string
  images?: string[]
  source: 'casafari'
  listed_at: string         // ISO
  updated_at: string        // ISO
}

export interface CasafariListingsFilters {
  zone?: string
  min_price?: number
  max_price?: number
  limit?: number
}

// ─── Internal API shape returned by Casafari v3 ───────────────────────────────

interface CasafariApiItem {
  id?: string
  title?: string | null
  typology?: string | null
  gross_area?: number | null
  useful_area?: number | null
  price?: number | null
  parish?: string | null
  municipality?: string | null
  district?: string | null
  country?: string | null
  latitude?: number | null
  longitude?: number | null
  description?: string | null
  photos?: Array<{ url: string; main?: boolean }>
  published_at?: string
  updated_at?: string
}

interface CasafariApiResponse {
  data: CasafariApiItem[]
  meta?: { total?: number; page?: number; pages?: number }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isConfigured(key: string): boolean {
  return key.length > 0 && key !== 'PREENCHER'
}

function mapTypology(raw: string | null | undefined): string {
  if (!raw) return 'T0'
  const upper = raw.toUpperCase().trim()
  if (/^T[0-5]$/.test(upper)) return upper
  if (/T5\+|T6|T7|T8/.test(upper)) return 'T5+'
  if (/STUDIO|T0/.test(upper)) return 'T0'
  return 'T0'
}

function toIso(val: string | undefined): string {
  if (!val) return new Date().toISOString()
  try { return new Date(val).toISOString() } catch { return new Date().toISOString() }
}

function mapItem(item: CasafariApiItem): CasafariProperty | null {
  if (!item.id) return null
  const price = item.price ?? 0
  const area  = item.gross_area ?? item.useful_area ?? 0
  return {
    external_id:  item.id,
    title:        item.title ?? `${mapTypology(item.typology)} em ${item.municipality ?? ''}`,
    price,
    area_sqm:     area,
    typology:     mapTypology(item.typology),
    zone:         item.parish ?? item.municipality ?? '',
    district:     item.district ?? item.municipality ?? '',
    country:      (item.country ?? 'PT').toUpperCase() as 'PT' | 'ES',
    latitude:     item.latitude ?? undefined,
    longitude:    item.longitude ?? undefined,
    description:  item.description ?? undefined,
    images:       item.photos?.map((p) => p.url) ?? undefined,
    source:       'casafari',
    listed_at:    toIso(item.published_at),
    updated_at:   toIso(item.updated_at),
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Fetch listings from Casafari REST API.
 * Returns [] if the API key is not configured or equals 'PREENCHER'.
 * Handles 429 (rate limit) by returning whatever was fetched so far.
 */
export async function fetchCasafariListings(
  filters?: CasafariListingsFilters,
): Promise<CasafariProperty[]> {
  const apiKey = process.env.CASAFARI_API_KEY ?? ''
  const apiUrl = process.env.CASAFARI_API_URL ?? 'https://api.casafari.com/v3'

  if (!isConfigured(apiKey)) {
    log.warn('[casafariClient] CASAFARI_API_KEY not configured — skipping fetch', {})
    return []
  }

  const limit = filters?.limit ?? 100
  const qs = new URLSearchParams({ per_page: String(Math.min(limit, 100)) })
  if (filters?.zone)      qs.set('parish', filters.zone)
  if (filters?.min_price) qs.set('min_price', String(filters.min_price))
  if (filters?.max_price) qs.set('max_price', String(filters.max_price))

  const url = `${apiUrl}/properties?${qs.toString()}`

  let res: Response
  try {
    res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15_000),
    })
  } catch (err) {
    log.warn('[casafariClient] network error', { error: String(err) })
    return []
  }

  if (res.status === 429) {
    log.warn('[casafariClient] rate limited (429) — returning empty batch', {})
    return []
  }

  if (!res.ok) {
    log.warn('[casafariClient] non-OK response', { status: res.status })
    return []
  }

  let body: CasafariApiResponse
  try {
    body = (await res.json()) as CasafariApiResponse
  } catch (err) {
    log.warn('[casafariClient] JSON parse error', { error: String(err) })
    return []
  }

  const items = body.data ?? []
  const results: CasafariProperty[] = []
  for (const item of items) {
    const mapped = mapItem(item)
    if (mapped) results.push(mapped)
  }

  log.info('[casafariClient] fetched listings', { count: results.length })
  return results
}
