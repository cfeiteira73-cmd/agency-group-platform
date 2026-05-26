// lib/providers/casafari/casafariClient.ts
// Real Casafari API v1 client
// Provides property data, price history, market trends

import log from '@/lib/logger'

export interface CasafariProperty {
  id: string
  external_id?: string
  title: string
  description?: string
  price: number
  price_per_sqm: number
  area_gross?: number
  area_net?: number
  bedrooms?: number
  bathrooms?: number
  property_type: string
  transaction_type: 'sale' | 'rent'
  address: {
    street?: string
    city: string
    municipality: string
    region: string
    country: string
    postal_code?: string
    latitude?: number
    longitude?: number
  }
  listing_date: string
  last_seen: string
  days_on_market: number
  price_history?: Array<{ date: string; price: number }>
  source: string
  url?: string
}

export interface CasafariSearchResult {
  total: number
  page: number
  per_page: number
  properties: CasafariProperty[]
}

export interface CasafariMarketStats {
  location: string
  property_type: string
  transaction_type: string
  avg_price_per_sqm: number
  median_price_per_sqm: number
  avg_days_on_market: number
  total_listings: number
  period: string
}

function getApiKey(): string | null {
  return process.env.CASAFARI_API_KEY ?? null
}

type NotConfigured = { status: 'NOT_CONFIGURED'; provider: 'Casafari'; reason: string; action_required: string }
type ProviderError = { status: 'ERROR'; provider: 'Casafari'; error: string; http_status?: number }

function notConfigured(): NotConfigured {
  return {
    status: 'NOT_CONFIGURED',
    provider: 'Casafari',
    reason: 'CASAFARI_API_KEY environment variable not set',
    action_required: 'Contact Casafari at contact@casafari.com to obtain API access and set CASAFARI_API_KEY in Vercel environment',
  }
}

const BASE_URL = process.env.CASAFARI_BASE_URL ?? 'https://api.casafari.com/v1'

export async function searchProperties(params: {
  country: 'PT' | 'ES'
  city?: string
  municipality?: string
  transaction_type: 'sale' | 'rent'
  property_type?: string
  min_price?: number
  max_price?: number
  min_area?: number
  max_area?: number
  bedrooms?: number
  page?: number
  per_page?: number
}): Promise<CasafariSearchResult | NotConfigured | ProviderError> {
  const apiKey = getApiKey()
  if (!apiKey) return notConfigured()

  try {
    const qs = new URLSearchParams()
    qs.set('country', params.country)
    qs.set('transaction_type', params.transaction_type)
    if (params.city) qs.set('city', params.city)
    if (params.municipality) qs.set('municipality', params.municipality)
    if (params.property_type) qs.set('property_type', params.property_type)
    if (params.min_price) qs.set('min_price', String(params.min_price))
    if (params.max_price) qs.set('max_price', String(params.max_price))
    if (params.min_area) qs.set('min_area', String(params.min_area))
    if (params.max_area) qs.set('max_area', String(params.max_area))
    if (params.bedrooms) qs.set('bedrooms', String(params.bedrooms))
    qs.set('page', String(params.page ?? 1))
    qs.set('per_page', String(params.per_page ?? 50))

    const response = await fetch(`${BASE_URL}/properties?${qs.toString()}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      log.warn('[casafariClient] search failed', { status: response.status })
      return { status: 'ERROR', provider: 'Casafari', error: `HTTP ${response.status}`, http_status: response.status }
    }

    const data = await response.json() as CasafariSearchResult
    log.info('[casafariClient] search complete', { total: data.total, country: params.country })
    return data
  } catch (e) {
    log.warn('[casafariClient] search error', { e })
    return { status: 'ERROR', provider: 'Casafari', error: e instanceof Error ? e.message : 'unknown' }
  }
}

export async function getMarketStats(params: {
  country: 'PT' | 'ES'
  location: string
  property_type?: string
  transaction_type: 'sale' | 'rent'
  period?: '1m' | '3m' | '6m' | '12m'
}): Promise<CasafariMarketStats | NotConfigured | ProviderError> {
  const apiKey = getApiKey()
  if (!apiKey) return notConfigured()

  try {
    const qs = new URLSearchParams({
      country: params.country,
      location: params.location,
      transaction_type: params.transaction_type,
      period: params.period ?? '3m',
    })
    if (params.property_type) qs.set('property_type', params.property_type)

    const response = await fetch(`${BASE_URL}/market-stats?${qs.toString()}`, {
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' },
    })
    if (!response.ok) {
      return { status: 'ERROR', provider: 'Casafari', error: `HTTP ${response.status}`, http_status: response.status }
    }
    return await response.json() as CasafariMarketStats
  } catch (e) {
    return { status: 'ERROR', provider: 'Casafari', error: e instanceof Error ? e.message : 'unknown' }
  }
}

export async function getPriceHistory(propertyId: string): Promise<Array<{ date: string; price: number }> | NotConfigured | ProviderError> {
  const apiKey = getApiKey()
  if (!apiKey) return notConfigured()

  try {
    const response = await fetch(`${BASE_URL}/properties/${encodeURIComponent(propertyId)}/price-history`, {
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' },
    })
    if (!response.ok) {
      return { status: 'ERROR', provider: 'Casafari', error: `HTTP ${response.status}`, http_status: response.status }
    }
    return await response.json() as Array<{ date: string; price: number }>
  } catch (e) {
    return { status: 'ERROR', provider: 'Casafari', error: e instanceof Error ? e.message : 'unknown' }
  }
}

export function isConfigured(): boolean {
  return !!process.env.CASAFARI_API_KEY
}
