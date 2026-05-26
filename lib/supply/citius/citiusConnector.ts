// =============================================================================
// Agency Group — Citius Judicial Auction Connector
// lib/supply/citius/citiusConnector.ts
//
// Citius is Portugal's official judicial auction platform.
// High-alpha distressed opportunities: judicial, insolvency, tax enforcement.
//
// Graceful no-op when CITIUS_API_KEY not configured — NEVER mock data.
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CitiusAuction {
  source_id: string
  source: 'CITIUS'
  market: 'PT'
  auction_type: 'JUDICIAL' | 'INSOLVENCY' | 'TAX_ENFORCEMENT' | 'FORECLOSURE'
  process_number: string       // tribunal process number
  tribunal: string             // e.g. "Tribunal Judicial de Lisboa"
  auction_date: string         // ISO
  auction_end_date: string | null
  minimum_bid_eur_cents: number
  market_value_eur_cents: number | null   // appraised value from tribunal
  discount_pct: number | null  // (market - minimum) / market * 100
  address: string
  city: string
  district: string | null
  property_type: string
  size_sqm: number | null
  legal_status: 'JUDICIAL'
  encumbrances: string[]
  url: string | null
  confidence_score: number     // 0.90 for Citius (official source, high confidence)
  fetched_at: string
  raw_payload: Record<string, unknown>
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CONFIDENCE_SCORE = 0.90
const DEFAULT_TENANT = process.env.DEFAULT_TENANT_ID ?? 'agency-group'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toAuctionType(raw: unknown): CitiusAuction['auction_type'] {
  const s = String(raw ?? '').toUpperCase()
  if (s.includes('INSOLV') || s.includes('FALENC')) return 'INSOLVENCY'
  if (s.includes('TAX') || s.includes('FISC') || s.includes('EXECUCAO_FISCAL')) return 'TAX_ENFORCEMENT'
  if (s.includes('FORECLOS') || s.includes('HIPOTEC') || s.includes('EXECUCAO_HIPOTEC')) return 'FORECLOSURE'
  return 'JUDICIAL'
}

function toEurCents(raw: unknown): number {
  const n = Number(raw ?? 0)
  return Math.round(n * 100)
}

function parseIso(raw: unknown): string {
  if (typeof raw === 'string' && raw.length > 0) {
    try { return new Date(raw).toISOString() } catch { /* fall through */ }
  }
  return new Date().toISOString()
}

function computeDiscount(minBid: number, marketVal: number | null): number | null {
  if (!marketVal || marketVal <= 0) return null
  return Math.round(((marketVal - minBid) / marketVal) * 10000) / 100 // 2 decimal places
}

function mapApiItemToAuction(item: Record<string, unknown>): CitiusAuction {
  const minBidCents = toEurCents(item['minimum_bid'] ?? item['lance_minimo'] ?? 0)
  const marketValCents =
    item['market_value'] != null || item['valor_base'] != null
      ? toEurCents(item['market_value'] ?? item['valor_base'])
      : null

  const encumbrancesRaw = item['encumbrances'] ?? item['onus'] ?? []
  const encumbrances: string[] = Array.isArray(encumbrancesRaw)
    ? (encumbrancesRaw as unknown[])
        .filter((x): x is string => typeof x === 'string')
    : []

  const auctionEndRaw = item['auction_end_date'] ?? item['data_fim_leilao'] ?? null
  const auctionEnd =
    auctionEndRaw != null && String(auctionEndRaw).length > 0
      ? parseIso(auctionEndRaw)
      : null

  const sourceId = String(
    item['id'] ?? item['process_number'] ?? item['numero_processo'] ?? `CITIUS-${Date.now()}`,
  )

  return {
    source_id: sourceId,
    source: 'CITIUS',
    market: 'PT',
    auction_type: toAuctionType(item['auction_type'] ?? item['tipo_processo']),
    process_number: String(item['process_number'] ?? item['numero_processo'] ?? ''),
    tribunal: String(item['tribunal'] ?? item['court'] ?? 'Tribunal Judicial'),
    auction_date: parseIso(item['auction_date'] ?? item['data_leilao']),
    auction_end_date: auctionEnd,
    minimum_bid_eur_cents: minBidCents,
    market_value_eur_cents: marketValCents,
    discount_pct: computeDiscount(minBidCents, marketValCents),
    address: String(item['address'] ?? item['morada'] ?? ''),
    city: String(item['city'] ?? item['cidade'] ?? item['municipio'] ?? ''),
    district: item['district'] != null ? String(item['district'] ?? item['distrito']) : null,
    property_type: String(item['property_type'] ?? item['tipo_imovel'] ?? 'RESIDENTIAL'),
    size_sqm: item['size_sqm'] != null ? Number(item['size_sqm']) : null,
    legal_status: 'JUDICIAL',
    encumbrances,
    url: item['url'] != null ? String(item['url']) : null,
    confidence_score: CONFIDENCE_SCORE,
    fetched_at: new Date().toISOString(),
    raw_payload: item,
  }
}

// ─── Persistence ──────────────────────────────────────────────────────────────

async function persistAuctions(auctions: CitiusAuction[]): Promise<void> {
  if (auctions.length === 0) return

  const now = new Date().toISOString()

  const rows = auctions.map(a => ({
    tenant_id: DEFAULT_TENANT,
    source: a.source,
    source_id: a.source_id,
    market: a.market,
    city: a.city,
    property_type: a.property_type,
    size_sqm: a.size_sqm,
    asking_price_eur_cents: a.minimum_bid_eur_cents,
    price_per_sqm_eur_cents:
      a.size_sqm && a.size_sqm > 0
        ? Math.round(a.minimum_bid_eur_cents / a.size_sqm)
        : null,
    listing_date: a.auction_date,
    days_on_market: null,
    is_distressed: true,
    confidence_score: a.confidence_score,
    data_observed: {
      source_id: a.source_id,
      auction_type: a.auction_type,
      process_number: a.process_number,
      tribunal: a.tribunal,
      auction_date: a.auction_date,
      auction_end_date: a.auction_end_date,
      minimum_bid_eur_cents: a.minimum_bid_eur_cents,
      market_value_eur_cents: a.market_value_eur_cents,
      discount_pct: a.discount_pct,
      address: a.address,
      city: a.city,
      district: a.district,
      property_type: a.property_type,
      size_sqm: a.size_sqm,
      legal_status: a.legal_status,
      encumbrances: a.encumbrances,
      url: a.url,
    },
    data_inferred: {
      legal_status: 'JUDICIAL',
      urgency: 'HIGH', // auctions expire
      discount_pct: a.discount_pct,
    },
    raw_payload: a.raw_payload,
    ingested_at: now,
    last_seen_at: now,
    delisted_at: null,
  }))

  const { error } = await (supabaseAdmin as any)
    .from('raw_opportunity_stream')
    .upsert(rows, { onConflict: 'source,source_id', ignoreDuplicates: false })

  if (error) {
    log.warn('[citiusConnector] persist error', { error: String(error) })
  } else {
    log.info('[citiusConnector] persisted auctions', { count: rows.length })
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch judicial auctions from Citius.
 * Returns empty array when CITIUS_API_KEY not configured — NEVER mocks data.
 */
export async function fetchCitiusAuctions(
  city?: string,
  maxResults = 50,
): Promise<CitiusAuction[]> {
  const apiKey = process.env.CITIUS_API_KEY
  const baseUrl = process.env.CITIUS_BASE_URL ?? 'https://api.citius.mj.pt/v1'

  if (!apiKey) {
    log.info('[citiusConnector] No CITIUS_API_KEY — returning empty array', { city })
    return []
  }

  try {
    const params = new URLSearchParams({
      type: 'property',
      limit: String(Math.min(maxResults, 100)),
      ...(city ? { city } : {}),
    })

    const res = await fetch(`${baseUrl}/auctions?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      log.warn('[citiusConnector] API non-OK', { status: res.status, city })
      return []
    }

    const data = (await res.json()) as Record<string, unknown>
    const items = Array.isArray(data['auctions'])
      ? (data['auctions'] as Record<string, unknown>[])
      : Array.isArray(data['items'])
        ? (data['items'] as Record<string, unknown>[])
        : []

    const auctions = items.map(item => mapApiItemToAuction(item))

    void persistAuctions(auctions).catch(e =>
      console.warn('[citiusConnector] persist error', e),
    )

    log.info('[citiusConnector] fetched auctions', { city, count: auctions.length })
    return auctions
  } catch (e) {
    log.warn('[citiusConnector] fetch error — graceful no-op', { error: String(e), city })
    return []
  }
}

/**
 * Aggregate stats from persisted Citius auctions in raw_opportunity_stream.
 */
export async function getCitiusStats(): Promise<{
  total_active: number
  upcoming_7_days: number
  avg_discount_pct: number
}> {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('raw_opportunity_stream')
      .select('data_observed, data_inferred, listing_date')
      .eq('source', 'CITIUS')
      .is('delisted_at', null)

    if (error) {
      log.warn('[citiusConnector] getCitiusStats error', { error: String(error) })
      return { total_active: 0, upcoming_7_days: 0, avg_discount_pct: 0 }
    }

    const rows =
      (data as Array<{
        data_observed: Record<string, unknown>
        data_inferred: Record<string, unknown>
        listing_date: string
      }>) ?? []

    const now = Date.now()
    const sevenDays = 7 * 24 * 60 * 60 * 1000
    let upcoming7 = 0
    let discountSum = 0
    let discountCount = 0

    for (const row of rows) {
      const auctionDate = new Date(row.listing_date ?? '').getTime()
      if (!isNaN(auctionDate) && auctionDate > now && auctionDate - now <= sevenDays) {
        upcoming7++
      }
      const dp = Number(row.data_observed?.['discount_pct'] ?? 0)
      if (dp > 0) {
        discountSum += dp
        discountCount++
      }
    }

    return {
      total_active: rows.length,
      upcoming_7_days: upcoming7,
      avg_discount_pct:
        discountCount > 0 ? Math.round((discountSum / discountCount) * 100) / 100 : 0,
    }
  } catch (e) {
    log.warn('[citiusConnector] getCitiusStats exception', { error: String(e) })
    return { total_active: 0, upcoming_7_days: 0, avg_discount_pct: 0 }
  }
}
