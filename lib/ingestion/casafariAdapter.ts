// =============================================================================
// Agency Group — Casafari API Adapter (v3)
// lib/ingestion/casafariAdapter.ts
//
// Real Casafari API v3 REST integration.
// Auth: Bearer token via CASAFARI_API_KEY env var
// Base URL: https://api.casafari.com/v3 (or CASAFARI_API_URL)
//
// Rate limit: 60 requests/min → enforced via rateLimitedFetch()
// Timeout: 10s per request via AbortSignal
//
// TypeScript strict — 0 errors
// =============================================================================

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CasafariSearchParams {
  country?: string          // 'PT' | 'ES' | 'FR' | 'DE'
  city?: string
  property_type?: string
  min_price?: number
  max_price?: number
  min_area?: number
  max_area?: number
  page?: number
  per_page?: number         // max 100
  updated_since?: string    // ISO 8601 — for delta ingestion
}

export interface CasafariProperty {
  id: string
  typology: string
  gross_area: number | null
  useful_area: number | null
  price: number | null
  currency: string
  latitude: number | null
  longitude: number | null
  parish: string | null
  municipality: string
  district: string | null
  country: string
  energy_certificate: string | null
  photos: Array<{ url: string; main: boolean }>
  description: string | null
  title: string | null
  url: string | null
  published_at: string
  updated_at: string
  rooms: number | null
  bathrooms: number | null
  floor: number | null
  status: string
}

export interface CasafariResponse {
  data: CasafariProperty[]
  meta: {
    total: number
    page: number
    per_page: number
    pages: number
  }
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

export class CasafariAdapter {
  private readonly baseUrl: string
  private readonly apiKey: string
  private readonly rateLimitPerMin = 60  // Casafari documented rate limit
  private lastRequestAt = 0

  constructor() {
    this.baseUrl = process.env.CASAFARI_API_URL ?? 'https://api.casafari.com/v3'
    this.apiKey  = process.env.CASAFARI_API_KEY  ?? ''
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Search for properties using Casafari's v3 search endpoint.
   * GET /properties with query params.
   * Handles 401, 429, and 5xx gracefully.
   */
  async search(params: CasafariSearchParams): Promise<CasafariResponse> {
    this.assertConfigured()

    const qs = new URLSearchParams()
    if (params.country)       qs.set('country',       params.country)
    if (params.city)          qs.set('city',           params.city)
    if (params.property_type) qs.set('property_type',  params.property_type)
    if (params.min_price)     qs.set('min_price',      String(params.min_price))
    if (params.max_price)     qs.set('max_price',      String(params.max_price))
    if (params.min_area)      qs.set('min_area',       String(params.min_area))
    if (params.max_area)      qs.set('max_area',       String(params.max_area))
    if (params.page)          qs.set('page',           String(params.page))
    if (params.per_page)      qs.set('per_page',       String(Math.min(params.per_page, 100)))
    if (params.updated_since) qs.set('updated_since',  params.updated_since)

    const url = `${this.baseUrl}/properties?${qs.toString()}`
    const res = await this.rateLimitedFetch(url, {
      headers: this.authHeaders(),
      signal:  AbortSignal.timeout(10_000),
    })

    await this.assertOk(res, 'search')
    return res.json() as Promise<CasafariResponse>
  }

  /**
   * Fetch a single property by Casafari ID.
   * GET /properties/{id}
   * Returns null if not found (404).
   */
  async getProperty(id: string): Promise<CasafariProperty | null> {
    this.assertConfigured()

    const url = `${this.baseUrl}/properties/${encodeURIComponent(id)}`
    const res = await this.rateLimitedFetch(url, {
      headers: this.authHeaders(),
      signal:  AbortSignal.timeout(10_000),
    })

    if (res.status === 404) return null
    await this.assertOk(res, `getProperty(${id})`)

    const body = await res.json() as { data: CasafariProperty }
    return body.data
  }

  /**
   * Fetches ALL properties updated since `sinceTimestamp` via automatic pagination.
   * Enforces 1s minimum between requests to stay well within 60 req/min.
   *
   * @param sinceTimestamp - ISO 8601 datetime string
   * @param country        - optional country filter ('PT' | 'ES' | 'FR' | 'DE')
   */
  async fetchDelta(
    sinceTimestamp: string,
    country?: string,
  ): Promise<CasafariProperty[]> {
    this.assertConfigured()

    const all: CasafariProperty[] = []
    let page = 1
    let totalPages = 1  // discovered on first response

    do {
      const response = await this.search({
        updated_since: sinceTimestamp,
        country:       country ?? 'PT',
        per_page:      100,
        page,
      })

      const { data, meta } = response
      totalPages = meta.pages ?? 1

      for (const prop of data) {
        // Only ingest active listings
        if (prop.status && prop.status.toLowerCase() !== 'active') continue
        if (!prop.id || prop.price == null) continue
        all.push(prop)
      }

      page++

      // Enforce minimum 1s between paginated requests (safety margin on 60/min)
      if (page <= totalPages) {
        await this.sleep(1_050)
      }
    } while (page <= totalPages)

    return all
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  /**
   * Enforces rate limiting: ensures at least `intervalMs` between requests.
   * Calculated from rateLimitPerMin: 60/min → 1000ms interval with 50ms safety buffer.
   */
  private async rateLimitedFetch(url: string, init?: RequestInit): Promise<Response> {
    const intervalMs = Math.ceil(60_000 / this.rateLimitPerMin) + 50  // 1050ms

    const now = Date.now()
    const elapsed = now - this.lastRequestAt

    if (elapsed < intervalMs) {
      await this.sleep(intervalMs - elapsed)
    }

    this.lastRequestAt = Date.now()
    return fetch(url, init)
  }

  private authHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type':  'application/json',
      'Accept':        'application/json',
    }
  }

  private assertConfigured(): void {
    if (!this.apiKey) {
      throw new Error('[CasafariAdapter] CASAFARI_API_KEY is not configured')
    }
  }

  /**
   * Asserts HTTP response is OK, throwing structured errors for known status codes.
   */
  private async assertOk(res: Response, context: string): Promise<void> {
    if (res.ok) return

    const body = await res.text().catch(() => '')

    switch (res.status) {
      case 401:
        throw new Error(`[CasafariAdapter] ${context}: 401 Unauthorized — check CASAFARI_API_KEY`)
      case 403:
        throw new Error(`[CasafariAdapter] ${context}: 403 Forbidden — API key lacks permission`)
      case 429:
        throw new Error(`[CasafariAdapter] ${context}: 429 Rate Limited — slow down requests`)
      case 500:
      case 502:
      case 503:
        throw new Error(`[CasafariAdapter] ${context}: ${res.status} Server Error — ${body.slice(0, 200)}`)
      default:
        throw new Error(`[CasafariAdapter] ${context}: HTTP ${res.status} — ${body.slice(0, 200)}`)
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

// Singleton export
export const casafariAdapter = new CasafariAdapter()
