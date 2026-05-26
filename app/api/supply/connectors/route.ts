// =============================================================================
// Agency Group — Supply Connectors API Route
// app/api/supply/connectors/route.ts
//
// GET  — supply stats summary (Citius, Bank NPL, Broker CRM, Registry)
// POST — trigger fetches, ingest broker listings, calibrate assets
//
// TypeScript strict — 0 errors
// =============================================================================

import { NextResponse } from 'next/server'
import {
  requireAuth,
  extractBearerToken,
  safeCompare,
} from '@/lib/middleware/portalAuthGuard'
import { fetchCitiusAuctions, getCitiusStats } from '@/lib/supply/citius/citiusConnector'
import {
  fetchBankNPLListings,
  fetchAllBankProviders,
  getBankNPLStats,
  type BankProvider,
} from '@/lib/supply/banks/bankNplConnector'
import {
  ingestBrokerListing,
  bulkIngestBrokerListings,
  getBrokerFeedStats,
  type BrokerCRMListing,
} from '@/lib/supply/brokers/brokerCrmConnector'
import {
  getMarketTruthPrices,
  calibrateAssetValuation,
} from '@/lib/supply/registries/publicRegistryConnector'
import { getSupplyStats } from '@/lib/supply/supplyIngestionOrchestrator'
import log from '@/lib/logger'

export const runtime = 'nodejs'
export const maxDuration = 120

const DEFAULT_TENANT = process.env.DEFAULT_TENANT_ID ?? 'agency-group'

// ─── Auth helpers ─────────────────────────────────────────────────────────────

function isAdminAuthorized(req: Request): boolean {
  const secret = process.env.INTERNAL_API_SECRET
  if (!secret) return false
  const token = extractBearerToken(req)
  if (!token) return false
  return safeCompare(token, secret)
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: Request): Promise<Response> {
  try {
    const authResult = await requireAuth(req)
    if (authResult instanceof Response) return authResult

    const { searchParams } = new URL(req.url)
    const mode = searchParams.get('mode')
    const tenantId = searchParams.get('tenant_id') ?? authResult.tenant_id ?? DEFAULT_TENANT

    // ?mode=citius — Citius stats + latest auctions
    if (mode === 'citius') {
      const [stats, auctions] = await Promise.all([
        getCitiusStats(),
        fetchCitiusAuctions(
          searchParams.get('city') ?? undefined,
          parseInt(searchParams.get('limit') ?? '20', 10),
        ),
      ])
      return NextResponse.json({ stats, auctions, count: auctions.length })
    }

    // ?mode=bank-npl — Bank NPL stats
    if (mode === 'bank-npl') {
      const stats = await getBankNPLStats()
      return NextResponse.json({ stats })
    }

    // ?mode=broker — Broker CRM stats for tenant
    if (mode === 'broker') {
      const stats = await getBrokerFeedStats(tenantId)
      return NextResponse.json({ stats })
    }

    // ?mode=registry&country=PT&city=Lisboa — market truth prices
    if (mode === 'registry') {
      const country = searchParams.get('country') ?? 'PT'
      const city = searchParams.get('city') ?? 'Lisboa'
      const propertyType = searchParams.get('property_type') ?? 'RESIDENTIAL'

      const prices = await getMarketTruthPrices(country, city, propertyType, tenantId)
      return NextResponse.json({ prices, country, city, property_type: propertyType })
    }

    // Default: supply stats summary (all sources)
    const [generalStats, citiusStats, bankStats, brokerStats] = await Promise.all([
      getSupplyStats(tenantId),
      getCitiusStats(),
      getBankNPLStats(),
      getBrokerFeedStats(tenantId),
    ])

    return NextResponse.json({
      summary: {
        idealista: generalStats.by_source['IDEALISTA'] ?? 0,
        casafari: generalStats.by_source['CASAFARI'] ?? 0,
        citius: citiusStats.total_active,
        bank_npl: bankStats.total,
        broker_crm: brokerStats.total,
        total_all_sources:
          (generalStats.total_active) +
          (citiusStats.total_active) +
          (bankStats.total) +
          (brokerStats.total),
      },
      citius: citiusStats,
      bank_npl: bankStats,
      broker_crm: brokerStats,
      general: generalStats,
    })
  } catch (e) {
    log.warn('[supply/connectors] GET error', { error: String(e) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  try {
    if (!isAdminAuthorized(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await req.json()) as Record<string, unknown>
    const action = String(body['action'] ?? '')
    const tenantId = String(body['tenant_id'] ?? DEFAULT_TENANT)

    // action: fetch-citius
    if (action === 'fetch-citius') {
      const city = body['city'] != null ? String(body['city']) : undefined
      const maxResults = body['max_results'] != null ? Number(body['max_results']) : 50
      const auctions = await fetchCitiusAuctions(city, maxResults)
      return NextResponse.json({
        action,
        city: city ?? null,
        fetched: auctions.length,
        auctions,
      })
    }

    // action: fetch-bank-npl
    if (action === 'fetch-bank-npl') {
      const provider = body['provider'] as BankProvider | undefined
      const maxResults = body['max_results'] != null ? Number(body['max_results']) : 50

      if (provider) {
        const listings = await fetchBankNPLListings(provider, maxResults)
        return NextResponse.json({ action, provider, fetched: listings.length, listings })
      }

      // No provider specified → fetch all
      const results = await fetchAllBankProviders(maxResults)
      const total = results.reduce((sum, r) => sum + r.count, 0)
      return NextResponse.json({ action, results, total })
    }

    // action: ingest-broker
    if (action === 'ingest-broker') {
      const listing = body['listing'] as Omit<BrokerCRMListing, 'fetched_at'> | undefined
      if (!listing) {
        return NextResponse.json(
          { error: 'Missing listing payload' },
          { status: 400 },
        )
      }
      await ingestBrokerListing(listing, tenantId)
      return NextResponse.json({ action, ingested: 1, source_id: listing.source_id })
    }

    // action: bulk-ingest-broker
    if (action === 'bulk-ingest-broker') {
      const listings = body['listings'] as Omit<BrokerCRMListing, 'fetched_at'>[] | undefined
      if (!Array.isArray(listings)) {
        return NextResponse.json(
          { error: 'Missing or invalid listings array' },
          { status: 400 },
        )
      }
      const result = await bulkIngestBrokerListings(listings, tenantId)
      return NextResponse.json({ action, ...result })
    }

    // action: calibrate-asset
    if (action === 'calibrate-asset') {
      const assetId = body['asset_id'] as string | undefined
      if (!assetId) {
        return NextResponse.json({ error: 'Missing asset_id' }, { status: 400 })
      }
      const result = await calibrateAssetValuation(assetId, tenantId)
      return NextResponse.json({ action, asset_id: assetId, ...result })
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  } catch (e) {
    log.warn('[supply/connectors] POST error', { error: String(e) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
