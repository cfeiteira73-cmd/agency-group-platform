// =============================================================================
// Agency Group — Bank NPL / Repossessed Assets Connector
// lib/supply/banks/bankNplConnector.ts
//
// Ingests Non-Performing Loan (NPL) and repossessed assets from Portuguese
// and Spanish banks. High volume, often significant discounts.
//
// Graceful no-op when BANK_NPL_API_KEY not configured — NEVER mock data.
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type BankProvider =
  | 'CGD'
  | 'BCP'
  | 'NOVO_BANCO'
  | 'BPI'
  | 'SANTANDER_PT'
  | 'HAYA_REAL_ESTATE'
  | 'SOLVIA'
  | 'ALTAMIRA'

export interface BankNPLListing {
  source_id: string
  source: 'BANK_NPL'
  bank_provider: BankProvider
  market: string
  asset_type: 'REPOSSESSED' | 'NPL_COLLATERAL' | 'REO' // Real Estate Owned
  asking_price_eur_cents: number
  original_loan_eur_cents: number | null
  discount_vs_loan_pct: number | null
  address: string
  city: string
  property_type: string
  size_sqm: number | null
  bedrooms: number | null
  is_occupied: boolean
  legal_status: 'ENCUMBERED' | 'FREE'
  url: string | null
  confidence_score: number // 0.88 for bank assets (institutional quality data)
  fetched_at: string
  raw_payload: Record<string, unknown>
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CONFIDENCE_SCORE = 0.88
const DEFAULT_TENANT = process.env.DEFAULT_TENANT_ID ?? 'agency-group'

// Provider → endpoint mapping (bank-specific REST or scraping APIs)
const PROVIDER_ENDPOINTS: Record<BankProvider, string> = {
  CGD: process.env.BANK_CGD_BASE_URL ?? 'https://api.cgd.pt/imoveis/v1',
  BCP: process.env.BANK_BCP_BASE_URL ?? 'https://api.millenniumbcp.pt/realestate/v1',
  NOVO_BANCO: process.env.BANK_NOVOBANCO_BASE_URL ?? 'https://api.novobanco.pt/assets/v1',
  BPI: process.env.BANK_BPI_BASE_URL ?? 'https://api.bancobpi.pt/properties/v1',
  SANTANDER_PT: process.env.BANK_SANTANDER_BASE_URL ?? 'https://api.santander.pt/realestate/v1',
  HAYA_REAL_ESTATE: process.env.BANK_HAYA_BASE_URL ?? 'https://api.haya.es/properties/v1',
  SOLVIA: process.env.BANK_SOLVIA_BASE_URL ?? 'https://api.solvia.es/assets/v1',
  ALTAMIRA: process.env.BANK_ALTAMIRA_BASE_URL ?? 'https://api.altamira.es/properties/v1',
}

const ALL_PROVIDERS: BankProvider[] = [
  'CGD',
  'BCP',
  'NOVO_BANCO',
  'BPI',
  'SANTANDER_PT',
  'HAYA_REAL_ESTATE',
  'SOLVIA',
  'ALTAMIRA',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toAssetType(raw: unknown): BankNPLListing['asset_type'] {
  const s = String(raw ?? '').toUpperCase()
  if (s.includes('REO') || s.includes('REAL_ESTATE_OWNED')) return 'REO'
  if (s.includes('NPL') || s.includes('COLLATERAL') || s.includes('COLATERAL')) return 'NPL_COLLATERAL'
  return 'REPOSSESSED'
}

function toLegalStatus(raw: unknown): BankNPLListing['legal_status'] {
  const s = String(raw ?? '').toUpperCase()
  if (s.includes('FREE') || s.includes('LIVRE') || s.includes('LIBRE')) return 'FREE'
  return 'ENCUMBERED'
}

function toEurCents(raw: unknown): number {
  const n = Number(raw ?? 0)
  return Math.round(n * 100)
}

function computeDiscountVsLoan(
  askingCents: number,
  loanCents: number | null,
): number | null {
  if (!loanCents || loanCents <= 0) return null
  return Math.round(((loanCents - askingCents) / loanCents) * 10000) / 100
}

function mapApiItemToListing(
  item: Record<string, unknown>,
  provider: BankProvider,
): BankNPLListing {
  const askingCents = toEurCents(item['asking_price'] ?? item['price'] ?? item['preco'] ?? 0)
  const loanCents =
    item['original_loan'] != null || item['valor_emprestimo'] != null
      ? toEurCents(item['original_loan'] ?? item['valor_emprestimo'])
      : null

  const market = String(
    item['market'] ?? item['country'] ?? item['pais'] ??
    (['CGD', 'BCP', 'NOVO_BANCO', 'BPI', 'SANTANDER_PT'] as BankProvider[]).includes(provider)
      ? 'PT'
      : 'ES',
  )

  const sourceId = String(
    item['id'] ?? item['asset_id'] ?? item['ref'] ?? `${provider}-${Date.now()}`,
  )

  return {
    source_id: `${provider}-${sourceId}`,
    source: 'BANK_NPL',
    bank_provider: provider,
    market,
    asset_type: toAssetType(item['asset_type'] ?? item['tipo_ativo']),
    asking_price_eur_cents: askingCents,
    original_loan_eur_cents: loanCents,
    discount_vs_loan_pct: computeDiscountVsLoan(askingCents, loanCents),
    address: String(item['address'] ?? item['morada'] ?? item['direccion'] ?? ''),
    city: String(item['city'] ?? item['cidade'] ?? item['localidad'] ?? ''),
    property_type: String(item['property_type'] ?? item['tipo_imovel'] ?? item['tipo'] ?? 'RESIDENTIAL'),
    size_sqm: item['size_sqm'] != null ? Number(item['size_sqm']) : null,
    bedrooms: item['bedrooms'] != null ? Number(item['bedrooms'] ?? item['quartos']) : null,
    is_occupied: Boolean(item['is_occupied'] ?? item['ocupado'] ?? false),
    legal_status: toLegalStatus(item['legal_status'] ?? item['estado_legal']),
    url: item['url'] != null ? String(item['url']) : null,
    confidence_score: CONFIDENCE_SCORE,
    fetched_at: new Date().toISOString(),
    raw_payload: item,
  }
}

// ─── Persistence ──────────────────────────────────────────────────────────────

async function persistListings(listings: BankNPLListing[]): Promise<void> {
  if (listings.length === 0) return

  const now = new Date().toISOString()

  const rows = listings.map(l => ({
    tenant_id: DEFAULT_TENANT,
    source: l.source,
    source_id: l.source_id,
    market: l.market,
    city: l.city,
    property_type: l.property_type,
    size_sqm: l.size_sqm,
    asking_price_eur_cents: l.asking_price_eur_cents,
    price_per_sqm_eur_cents:
      l.size_sqm && l.size_sqm > 0
        ? Math.round(l.asking_price_eur_cents / l.size_sqm)
        : null,
    listing_date: now,
    days_on_market: null,
    is_distressed: true,
    confidence_score: l.confidence_score,
    data_observed: {
      source_id: l.source_id,
      bank_provider: l.bank_provider,
      asset_type: l.asset_type,
      asking_price_eur_cents: l.asking_price_eur_cents,
      original_loan_eur_cents: l.original_loan_eur_cents,
      discount_vs_loan_pct: l.discount_vs_loan_pct,
      address: l.address,
      city: l.city,
      property_type: l.property_type,
      size_sqm: l.size_sqm,
      bedrooms: l.bedrooms,
      is_occupied: l.is_occupied,
      legal_status: l.legal_status,
      url: l.url,
    },
    data_inferred: {
      bank_provider: l.bank_provider,
      asset_type: l.asset_type,
      discount_vs_loan_pct: l.discount_vs_loan_pct,
      legal_status: l.legal_status,
    },
    raw_payload: l.raw_payload,
    ingested_at: now,
    last_seen_at: now,
    delisted_at: null,
  }))

  const { error } = await (supabaseAdmin as any)
    .from('raw_opportunity_stream')
    .upsert(rows, { onConflict: 'source,source_id', ignoreDuplicates: false })

  if (error) {
    log.warn('[bankNplConnector] persist error', { error: String(error) })
  } else {
    log.info('[bankNplConnector] persisted listings', { count: rows.length })
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch NPL / repossessed listings from a single bank provider.
 * Returns empty array when BANK_NPL_API_KEY not configured — NEVER mocks data.
 */
export async function fetchBankNPLListings(
  provider: BankProvider,
  maxResults = 50,
): Promise<BankNPLListing[]> {
  const apiKey = process.env.BANK_NPL_API_KEY
  const baseUrl = PROVIDER_ENDPOINTS[provider]

  if (!apiKey) {
    log.info('[bankNplConnector] No BANK_NPL_API_KEY — returning empty array', { provider })
    return []
  }

  try {
    const params = new URLSearchParams({
      limit: String(Math.min(maxResults, 100)),
      type: 'property',
    })

    const res = await fetch(`${baseUrl}/listings?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Bank-Provider': provider,
      },
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      log.warn('[bankNplConnector] API non-OK', { status: res.status, provider })
      return []
    }

    const data = (await res.json()) as Record<string, unknown>
    const items = Array.isArray(data['listings'])
      ? (data['listings'] as Record<string, unknown>[])
      : Array.isArray(data['items'])
        ? (data['items'] as Record<string, unknown>[])
        : Array.isArray(data['properties'])
          ? (data['properties'] as Record<string, unknown>[])
          : []

    const listings = items.map(item => mapApiItemToListing(item, provider))

    void persistListings(listings).catch(e =>
      console.warn('[bankNplConnector] persist error', e),
    )

    log.info('[bankNplConnector] fetched listings', { provider, count: listings.length })
    return listings
  } catch (e) {
    log.warn('[bankNplConnector] fetch error — graceful no-op', {
      error: String(e),
      provider,
    })
    return []
  }
}

/**
 * Fetch listings from all bank providers using Promise.allSettled (non-blocking).
 * Returns array of { provider, count } for each provider.
 */
export async function fetchAllBankProviders(
  maxResults = 50,
): Promise<{ provider: BankProvider; count: number }[]> {
  const results = await Promise.allSettled(
    ALL_PROVIDERS.map(async provider => {
      const listings = await fetchBankNPLListings(provider, maxResults)
      return { provider, count: listings.length }
    }),
  )

  const output: { provider: BankProvider; count: number }[] = []

  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    const provider = ALL_PROVIDERS[i]
    if (result.status === 'fulfilled') {
      output.push(result.value)
    } else {
      log.warn('[bankNplConnector] provider failed', {
        provider,
        error: String(result.reason),
      })
      output.push({ provider, count: 0 })
    }
  }

  return output
}

/**
 * Aggregate stats from persisted Bank NPL listings in raw_opportunity_stream.
 */
export async function getBankNPLStats(): Promise<{
  total: number
  by_provider: Record<BankProvider, number>
  avg_discount_pct: number
}> {
  const emptyByProvider = (): Record<BankProvider, number> =>
    ALL_PROVIDERS.reduce(
      (acc, p) => ({ ...acc, [p]: 0 }),
      {} as Record<BankProvider, number>,
    )

  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('raw_opportunity_stream')
      .select('data_observed')
      .eq('source', 'BANK_NPL')
      .is('delisted_at', null)

    if (error) {
      log.warn('[bankNplConnector] getBankNPLStats error', { error: String(error) })
      return { total: 0, by_provider: emptyByProvider(), avg_discount_pct: 0 }
    }

    const rows =
      (data as Array<{ data_observed: Record<string, unknown> }>) ?? []

    const by_provider = emptyByProvider()
    let discountSum = 0
    let discountCount = 0

    for (const row of rows) {
      const provider = String(row.data_observed?.['bank_provider'] ?? '') as BankProvider
      if (provider in by_provider) {
        by_provider[provider] = (by_provider[provider] ?? 0) + 1
      }
      const dp = Number(row.data_observed?.['discount_vs_loan_pct'] ?? 0)
      if (dp > 0) {
        discountSum += dp
        discountCount++
      }
    }

    return {
      total: rows.length,
      by_provider,
      avg_discount_pct:
        discountCount > 0 ? Math.round((discountSum / discountCount) * 100) / 100 : 0,
    }
  } catch (e) {
    log.warn('[bankNplConnector] getBankNPLStats exception', { error: String(e) })
    return { total: 0, by_provider: emptyByProvider(), avg_discount_pct: 0 }
  }
}
