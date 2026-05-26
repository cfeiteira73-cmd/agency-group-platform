// lib/providers/idealista/idealistaClient.ts
// Real Idealista REST API v3.5 client
// Docs: https://developers.idealista.com/

import log from '@/lib/logger'

export interface IdealistaConfig {
  apiKey: string
  apiSecret: string
  baseUrl: string
}

export interface IdealistaProperty {
  propertyCode: string
  thumbnail: string
  externalReference?: string
  numPhotos: number
  floor?: string
  price: number
  priceInfo: { amount: number; unitPrice: number; currencySuffix: string }
  propertyType: string
  operation: string
  size: number
  exterior?: boolean
  rooms?: number
  bathrooms?: number
  address?: string
  province: string
  municipality: string
  district?: string
  country: string
  latitude: number
  longitude: number
  showAddress?: boolean
  url: string
  description: string
  hasVideo?: boolean
  status?: string
  newDevelopment?: boolean
  hasLift?: boolean
  parkingSpace?: unknown
}

export interface IdealistaSearchResult {
  total: number
  totalPages: number
  actualPage: number
  itemsPerPage: number
  country: string
  operationList: string[]
  summary: string[]
  elementList: IdealistaProperty[]
}

export type ProviderStatus =
  | { status: 'NOT_CONFIGURED'; provider: string; reason: string; action_required: string }
  | { status: 'ERROR'; provider: string; error: string; http_status?: number }
  | { status: 'OK'; data: unknown }

function getConfig(): IdealistaConfig | null {
  const apiKey = process.env.IDEALISTA_API_KEY
  const apiSecret = process.env.IDEALISTA_API_SECRET
  if (!apiKey || !apiSecret) return null
  return {
    apiKey,
    apiSecret,
    baseUrl: process.env.IDEALISTA_BASE_URL ?? 'https://api.idealista.com/3.5/',
  }
}

async function getOAuthToken(config: IdealistaConfig): Promise<string> {
  const credentials = Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString('base64')
  const response = await fetch('https://api.idealista.com/oauth/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=read',
  })
  if (!response.ok) {
    throw new Error(`Idealista OAuth failed: ${response.status} ${response.statusText}`)
  }
  const data = await response.json() as { access_token: string }
  return data.access_token
}

export async function searchProperties(params: {
  country: 'pt' | 'es'
  operation: 'sale' | 'rent'
  propertyType: 'homes' | 'offices' | 'premises' | 'garages' | 'bedrooms' | 'newDevelopments' | 'rooms'
  center?: string  // lat,lon
  distance?: number
  locationId?: string
  minPrice?: number
  maxPrice?: number
  minSize?: number
  maxSize?: number
  numPage?: number
  maxItems?: number
}): Promise<IdealistaSearchResult | ProviderStatus> {
  const config = getConfig()
  if (!config) {
    return {
      status: 'NOT_CONFIGURED',
      provider: 'Idealista',
      reason: 'IDEALISTA_API_KEY or IDEALISTA_API_SECRET not set',
      action_required: 'Register at https://developers.idealista.com and set IDEALISTA_API_KEY + IDEALISTA_API_SECRET in Vercel environment',
    }
  }

  try {
    const token = await getOAuthToken(config)
    const searchParams = new URLSearchParams()
    if (params.center) searchParams.set('center', params.center)
    if (params.distance) searchParams.set('distance', String(params.distance))
    if (params.locationId) searchParams.set('locationId', params.locationId)
    if (params.minPrice) searchParams.set('minPrice', String(params.minPrice))
    if (params.maxPrice) searchParams.set('maxPrice', String(params.maxPrice))
    if (params.minSize) searchParams.set('minSize', String(params.minSize))
    if (params.maxSize) searchParams.set('maxSize', String(params.maxSize))
    if (params.numPage) searchParams.set('numPage', String(params.numPage))
    if (params.maxItems) searchParams.set('maxItems', String(params.maxItems ?? 50))

    const url = `${config.baseUrl}${params.country}/search?${searchParams.toString()}`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ operation: params.operation, propertyType: params.propertyType }),
    })

    if (!response.ok) {
      log.warn('[idealistaClient] search failed', { status: response.status, url })
      return { status: 'ERROR', provider: 'Idealista', error: `HTTP ${response.status}`, http_status: response.status }
    }

    const data = await response.json() as IdealistaSearchResult
    log.info('[idealistaClient] search complete', { total: data.total, country: params.country })
    return data
  } catch (e) {
    log.warn('[idealistaClient] search error', { e })
    return { status: 'ERROR', provider: 'Idealista', error: e instanceof Error ? e.message : 'unknown' }
  }
}

export async function getPropertyDetail(
  country: 'pt' | 'es',
  propertyCode: string,
): Promise<IdealistaProperty | ProviderStatus> {
  const config = getConfig()
  if (!config) {
    return {
      status: 'NOT_CONFIGURED',
      provider: 'Idealista',
      reason: 'IDEALISTA_API_KEY or IDEALISTA_API_SECRET not set',
      action_required: 'Register at https://developers.idealista.com',
    }
  }

  try {
    const token = await getOAuthToken(config)
    const url = `${config.baseUrl}${country}/detail/${propertyCode}`
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
    if (!response.ok) {
      return { status: 'ERROR', provider: 'Idealista', error: `HTTP ${response.status}`, http_status: response.status }
    }
    return await response.json() as IdealistaProperty
  } catch (e) {
    return { status: 'ERROR', provider: 'Idealista', error: e instanceof Error ? e.message : 'unknown' }
  }
}

export function isConfigured(): boolean {
  return !!(process.env.IDEALISTA_API_KEY && process.env.IDEALISTA_API_SECRET)
}
