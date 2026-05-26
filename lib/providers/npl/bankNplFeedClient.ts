// lib/providers/npl/bankNplFeedClient.ts
// Bank NPL (Non-Performing Loans) real estate asset feed
// Connects to bank NPL portfolio APIs or secure FTP feeds

import log from '@/lib/logger'

export interface NplAsset {
  asset_id: string
  bank: string                    // e.g., "NOVOBANCO", "BCP", "CGD", "SANTANDER_PT"
  portfolio_id?: string
  property_type: string
  address_municipality: string
  address_district: string
  address_postal?: string
  area_sqm?: number
  year_built?: number
  outstanding_debt_eur: number    // loan outstanding
  market_value_eur: number        // bank's appraisal
  discount_to_market_pct: number  // typical NPL discount (20-60%)
  min_offer_eur: number           // minimum acceptable offer
  occupancy_status: 'vacant' | 'occupied' | 'unknown'
  legal_status: 'clean' | 'pending_execution' | 'execution_complete'
  available_from?: string         // ISO date
  data_date: string               // when this data was extracted
  source: 'BANK_NPL'
  trust_score: 0.90               // from Supply Trust Ladder
}

export interface NplFeedConfig {
  bankId: string
  feedUrl: string
  authType: 'bearer' | 'basic' | 'sftp'
  envKeyName: string
}

// Supported bank NPL feeds
export const SUPPORTED_NPL_FEEDS: NplFeedConfig[] = [
  { bankId: 'NOVOBANCO', feedUrl: process.env.NOVOBANCO_NPL_URL ?? '', authType: 'bearer', envKeyName: 'NOVOBANCO_NPL_API_KEY' },
  { bankId: 'BCP', feedUrl: process.env.BCP_NPL_URL ?? '', authType: 'bearer', envKeyName: 'BCP_NPL_API_KEY' },
  { bankId: 'CGD', feedUrl: process.env.CGD_NPL_URL ?? '', authType: 'bearer', envKeyName: 'CGD_NPL_API_KEY' },
  { bankId: 'SANTANDER_PT', feedUrl: process.env.SANTANDER_NPL_URL ?? '', authType: 'bearer', envKeyName: 'SANTANDER_NPL_API_KEY' },
]

type NotConfigured = { status: 'NOT_CONFIGURED'; provider: string; reason: string; action_required: string }
type ProviderError = { status: 'ERROR'; provider: string; error: string }

export async function fetchNplPortfolio(bankId: string): Promise<NplAsset[] | NotConfigured | ProviderError> {
  const feed = SUPPORTED_NPL_FEEDS.find(f => f.bankId === bankId)
  if (!feed) {
    return { status: 'ERROR', provider: bankId, error: `Unknown bank: ${bankId}. Supported: ${SUPPORTED_NPL_FEEDS.map(f => f.bankId).join(', ')}` }
  }

  const apiKey = process.env[feed.envKeyName]
  if (!apiKey || !feed.feedUrl) {
    return {
      status: 'NOT_CONFIGURED',
      provider: bankId,
      reason: `${feed.envKeyName} or feed URL not configured`,
      action_required: `Contact ${bankId} institutional relations team to establish NPL data-sharing agreement and set ${feed.envKeyName} + ${bankId}_NPL_URL in Vercel environment`,
    }
  }

  try {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'User-Agent': 'AgencyGroup/1.0 (AMI:22506)',
    }
    if (feed.authType === 'bearer') headers['Authorization'] = `Bearer ${apiKey}`
    if (feed.authType === 'basic') headers['Authorization'] = `Basic ${Buffer.from(apiKey).toString('base64')}`

    const response = await fetch(feed.feedUrl, { headers })
    if (!response.ok) {
      log.warn('[bankNplFeedClient] fetch failed', { bankId, status: response.status })
      return { status: 'ERROR', provider: bankId, error: `HTTP ${response.status}` }
    }

    const data = await response.json() as NplAsset[]
    log.info('[bankNplFeedClient] portfolio fetched', { bankId, count: data.length })
    return data
  } catch (e) {
    log.warn('[bankNplFeedClient] error', { bankId, e })
    return { status: 'ERROR', provider: bankId, error: e instanceof Error ? e.message : 'unknown' }
  }
}

export async function fetchAllConfiguredNplFeeds(): Promise<{ bank: string; result: NplAsset[] | NotConfigured | ProviderError }[]> {
  const results = await Promise.allSettled(
    SUPPORTED_NPL_FEEDS.map(async feed => ({
      bank: feed.bankId,
      result: await fetchNplPortfolio(feed.bankId),
    }))
  )
  return results.map(r => r.status === 'fulfilled' ? r.value : { bank: 'UNKNOWN', result: { status: 'ERROR' as const, provider: 'UNKNOWN', error: 'Failed' } })
}

export function getConfiguredBanks(): string[] {
  return SUPPORTED_NPL_FEEDS.filter(f => !!process.env[f.envKeyName]).map(f => f.bankId)
}
