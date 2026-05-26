// lib/providers/citius/citiusClient.ts
// Portugal Ministry of Justice judicial auction client
// Portal: https://www.citius.mj.pt/portal/correio.aspx?misc=consaulta_leiloes.aspx
// Note: Citius does not have a public REST API — this client uses structured HTTP requests
// to the public portal. A formal data-sharing agreement with MJ is required for bulk access.

import log from '@/lib/logger'

export interface CitiusAuction {
  auction_id: string
  process_number: string        // e.g., "1234/2024.8TBMTS"
  court: string
  property_description: string
  property_type: 'apartment' | 'house' | 'land' | 'commercial' | 'other'
  location_municipality: string
  location_district: string
  base_price_eur: number        // minimum bid in EUR
  area_sqm?: number
  auction_date: string          // ISO date
  auction_type: 'electronic' | 'in_person'
  auction_url: string           // direct link to Citius listing
  status: 'open' | 'closed' | 'pending'
  source: 'CITIUS'
  trust_score: 0.92             // from Supply Trust Ladder
}

export interface CitiusSearchParams {
  district?: string
  municipality?: string
  min_price?: number
  max_price?: number
  auction_date_from?: string
  auction_date_to?: string
}

type NotConfigured = { status: 'NOT_CONFIGURED'; provider: 'Citius'; reason: string; action_required: string }
type ProviderError = { status: 'ERROR'; provider: 'Citius'; error: string }

const CITIUS_PORTAL_URL = process.env.CITIUS_BASE_URL ?? 'https://www.citius.mj.pt'
const CITIUS_PARTNER_KEY = process.env.CITIUS_PARTNER_KEY  // MJ data-sharing agreement API key

function notConfigured(): NotConfigured {
  return {
    status: 'NOT_CONFIGURED',
    provider: 'Citius',
    reason: 'CITIUS_PARTNER_KEY not set — formal MJ data-sharing agreement required',
    action_required: 'Contact Ministério da Justiça (DGPJ) at https://www.dgpj.mj.pt to establish a data-sharing protocol and obtain CITIUS_PARTNER_KEY',
  }
}

export async function searchJudicialAuctions(params: CitiusSearchParams): Promise<CitiusAuction[] | NotConfigured | ProviderError> {
  if (!CITIUS_PARTNER_KEY) return notConfigured()

  try {
    const qs = new URLSearchParams()
    if (params.district) qs.set('distrito', params.district)
    if (params.municipality) qs.set('concelho', params.municipality)
    if (params.min_price) qs.set('valorMinimo', String(params.min_price))
    if (params.max_price) qs.set('valorMaximo', String(params.max_price))
    if (params.auction_date_from) qs.set('dataInicio', params.auction_date_from)
    if (params.auction_date_to) qs.set('dataFim', params.auction_date_to)

    // Citius partner API (requires formal MJ agreement)
    const response = await fetch(`${CITIUS_PORTAL_URL}/api/v1/leiloes?${qs.toString()}`, {
      headers: {
        'X-Partner-Key': CITIUS_PARTNER_KEY,
        'Accept': 'application/json',
        'User-Agent': 'AgencyGroup/1.0 (AMI:22506)',
      },
    })

    if (!response.ok) {
      log.warn('[citiusClient] search failed', { status: response.status })
      return { status: 'ERROR', provider: 'Citius', error: `HTTP ${response.status}` }
    }

    const data = await response.json() as CitiusAuction[]
    log.info('[citiusClient] auctions fetched', { count: data.length })
    return data
  } catch (e) {
    log.warn('[citiusClient] error', { e })
    return { status: 'ERROR', provider: 'Citius', error: e instanceof Error ? e.message : 'unknown' }
  }
}

export function isConfigured(): boolean {
  return !!CITIUS_PARTNER_KEY
}
