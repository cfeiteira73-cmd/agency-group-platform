// =============================================================================
// Agency Group — Idealista API Adapter (v3.5)
// lib/ingestion/idealistaAdapter.ts
//
// Real Idealista API v3.5 integration with OAuth 2.0 client_credentials.
// Auth: IDEALISTA_API_KEY (Base64 of client_id:client_secret)
// Base URL: https://api.idealista.com/3.5 (or IDEALISTA_API_URL)
//
// Token cache: Idealista tokens are valid for ~7 days.
// Rate limit: enforced per Idealista fair-use policy (1 req/s conservative).
//
// TypeScript strict — 0 errors
// =============================================================================

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IdealistaSearchParams {
  country: 'es' | 'pt' | 'it'
  operation: 'sale' | 'rent'
  propertyType: 'homes' | 'offices' | 'premises' | 'garages' | 'bedrooms' | 'newDevelopments'
  center?: string             // lat,lon  e.g. '38.7167,-9.1333'
  distance?: number           // meters
  locationId?: string         // Idealista location ID
  maxPrice?: number
  minPrice?: number
  minSize?: number
  maxSize?: number
  numPage?: number
  maxItems?: number           // max 50
  sort?: 'asc' | 'desc'
  order?: 'price' | 'distance' | 'updated'
  sinceDate?: 'W' | 'M' | 'T' | 'Y'  // W=week, M=month, T=today, Y=yesterday
}

export interface IdealistaProperty {
  propertyCode: string
  thumbnail: string
  price: number
  priceInfo: { amount: number; currencySuffix: string }
  propertyType: string
  operation: string
  size: number
  exterior: boolean
  rooms: number | null
  bathrooms: number | null
  address: string
  province: string
  municipality: string
  district: string | null
  country: string
  latitude: number
  longitude: number
  showAddress: boolean
  url: string
  description: string
  hasVideo: boolean
  hasPlan: boolean
  has3DTour: boolean
  has360: boolean
  photos: Array<{ url: string }>
  modificationDate: number    // Unix timestamp
  publishDate: number         // Unix timestamp
  floor: string | null
  priceByArea: number
  suggestedTexts: { subtitle: string; title: string }
  energy: {
    greenhouseEmissions: { rating: string } | null
    energyConsumption: { rating: string } | null
  }
}

export interface IdealistaResponse {
  total: number
  totalPages: number
  actualPage: number
  itemsPerPage: number
  country: string
  summary: string[]
  paginable: boolean
  elementList: IdealistaProperty[]
}

// ─── OAuth token shape ────────────────────────────────────────────────────────

interface OAuthTokenResponse {
  access_token: string
  token_type: string
  expires_in: number  // seconds
  scope: string
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

export class IdealistaAdapter {
  private readonly baseUrl: string
  private readonly apiKey: string   // Base64(client_id:client_secret)
  private readonly oauthUrl = 'https://api.idealista.com/oauth/token'

  private accessToken: string | null = null
  private tokenExpiresAt = 0

  constructor() {
    this.baseUrl = process.env.IDEALISTA_API_URL ?? 'https://api.idealista.com/3.5'
    this.apiKey  = process.env.IDEALISTA_API_KEY  ?? ''
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Search properties via Idealista v3.5.
   * POST /{country}/search with form-encoded params.
   * AbortSignal timeout 10s.
   */
  async search(params: IdealistaSearchParams): Promise<IdealistaResponse> {
    await this.refreshTokenIfNeeded()

    const form = new URLSearchParams()
    form.set('operation',    params.operation)
    form.set('propertyType', params.propertyType)

    if (params.center)     form.set('center',     params.center)
    if (params.distance)   form.set('distance',   String(params.distance))
    if (params.locationId) form.set('locationId', params.locationId)
    if (params.maxPrice)   form.set('maxPrice',   String(params.maxPrice))
    if (params.minPrice)   form.set('minPrice',   String(params.minPrice))
    if (params.minSize)    form.set('minSize',    String(params.minSize))
    if (params.maxSize)    form.set('maxSize',    String(params.maxSize))
    if (params.numPage)    form.set('numPage',    String(params.numPage))
    if (params.maxItems)   form.set('maxItems',   String(Math.min(params.maxItems, 50)))
    if (params.sort)       form.set('sort',       params.sort)
    if (params.order)      form.set('order',      params.order)
    if (params.sinceDate)  form.set('sinceDate',  params.sinceDate)

    const url = `${this.baseUrl}/${params.country}/search`
    const res = await fetch(url, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type':  'application/x-www-form-urlencoded',
        'Accept':        'application/json',
      },
      body:   form.toString(),
      signal: AbortSignal.timeout(10_000),
    })

    await this.assertOk(res, `search(${params.country})`)
    return res.json() as Promise<IdealistaResponse>
  }

  /**
   * Fetches ALL properties in a region updated since `sinceDate`, with automatic pagination.
   * Enforces 1s between pages to respect Idealista fair-use policy.
   *
   * @param country    - 'es' | 'pt' | 'it'
   * @param locationId - Idealista location ID for the region
   * @param sinceDate  - 'T'=today | 'Y'=yesterday | 'W'=week | 'M'=month
   */
  async fetchDeltaByRegion(
    country: 'es' | 'pt' | 'it',
    locationId: string,
    sinceDate: 'W' | 'M' | 'T' | 'Y' = 'T',
  ): Promise<IdealistaProperty[]> {
    const all: IdealistaProperty[] = []
    let page = 1
    let totalPages = 1

    do {
      const response = await this.search({
        country,
        operation:    'sale',
        propertyType: 'homes',
        locationId,
        sinceDate,
        maxItems:     50,
        numPage:      page,
        order:        'updated',
        sort:         'desc',
      })

      totalPages = response.totalPages ?? 1

      for (const item of response.elementList ?? []) {
        if (!item.propertyCode || !item.price) continue
        all.push(item)
      }

      page++

      // 1s delay between pages — conservative rate control
      if (page <= totalPages) {
        await this.sleep(1_000)
      }
    } while (page <= totalPages)

    return all
  }

  // ─── Token management ──────────────────────────────────────────────────────

  /**
   * Gets a valid access token, fetching a new one only if expired or missing.
   */
  private async getAccessToken(): Promise<string> {
    await this.refreshTokenIfNeeded()
    return this.accessToken!
  }

  /**
   * Refreshes the OAuth token if it has expired or is within 60s of expiry.
   * Idealista tokens use client_credentials grant.
   * Authorization: Basic base64(IDEALISTA_API_KEY)
   */
  private async refreshTokenIfNeeded(): Promise<void> {
    const now = Date.now()
    // Refresh if expired or within 60s of expiry
    if (this.accessToken && now < this.tokenExpiresAt - 60_000) return

    if (!this.apiKey) {
      throw new Error('[IdealistaAdapter] IDEALISTA_API_KEY is not configured')
    }

    const form = new URLSearchParams()
    form.set('grant_type', 'client_credentials')
    form.set('scope', 'read')

    const res = await fetch(this.oauthUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${this.apiKey}`,
        'Content-Type':  'application/x-www-form-urlencoded',
        'Accept':        'application/json',
      },
      body:   form.toString(),
      signal: AbortSignal.timeout(10_000),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      if (res.status === 401) {
        throw new Error('[IdealistaAdapter] OAuth 401 — check IDEALISTA_API_KEY (must be Base64 of client_id:client_secret)')
      }
      throw new Error(`[IdealistaAdapter] OAuth token request failed: HTTP ${res.status} — ${body.slice(0, 200)}`)
    }

    const token = await res.json() as OAuthTokenResponse
    this.accessToken    = token.access_token
    this.tokenExpiresAt = now + token.expires_in * 1_000
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  private async assertOk(res: Response, context: string): Promise<void> {
    if (res.ok) return

    const body = await res.text().catch(() => '')

    switch (res.status) {
      case 401:
        // Token expired mid-request — clear so next call re-fetches
        this.accessToken    = null
        this.tokenExpiresAt = 0
        throw new Error(`[IdealistaAdapter] ${context}: 401 Unauthorized — token expired or invalid`)
      case 403:
        throw new Error(`[IdealistaAdapter] ${context}: 403 Forbidden — subscription may not cover this resource`)
      case 429:
        throw new Error(`[IdealistaAdapter] ${context}: 429 Too Many Requests — reduce request rate`)
      case 400:
        throw new Error(`[IdealistaAdapter] ${context}: 400 Bad Request — ${body.slice(0, 300)}`)
      case 500:
      case 502:
      case 503:
        throw new Error(`[IdealistaAdapter] ${context}: ${res.status} Server Error — ${body.slice(0, 200)}`)
      default:
        throw new Error(`[IdealistaAdapter] ${context}: HTTP ${res.status} — ${body.slice(0, 200)}`)
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

// Singleton export
export const idealistaAdapter = new IdealistaAdapter()
