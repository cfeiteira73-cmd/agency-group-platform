// Agency Group — Supply Ingestion API Route
// app/api/supply/ingest/route.ts
// TypeScript strict — 0 errors

import { NextResponse } from 'next/server'
import {
  requireAuth,
  extractBearerToken,
  safeCompare,
} from '@/lib/middleware/portalAuthGuard'
import {
  runIngestionCycle,
  getIngestionHistory,
  getRawOpportunityStream,
  getSupplyStats,
  type SupplyProvider,
} from '@/lib/supply/supplyIngestionOrchestrator'
import {
  fetchIdealistaListings,
  getIdealistaStats,
  type IdealistaMarket,
} from '@/lib/supply/idealista/idealistaConnector'
import {
  fetchCasafariListings,
  getCasafariStats,
  type CasafariMarket,
} from '@/lib/supply/casafari/casafariConnector'
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

    // ?mode=history → ingestion run history
    if (mode === 'history') {
      const limit = parseInt(searchParams.get('limit') ?? '20', 10)
      const history = await getIngestionHistory(tenantId, isNaN(limit) ? 20 : limit)
      return NextResponse.json({ history, count: history.length })
    }

    // ?mode=stream → raw opportunity stream with optional filters
    if (mode === 'stream') {
      const source = searchParams.get('source') as SupplyProvider | null
      const market = searchParams.get('market')
      const minPrice = searchParams.get('min_price')
      const maxPrice = searchParams.get('max_price')
      const isDistressed = searchParams.get('is_distressed')
      const limitParam = searchParams.get('limit')

      const records = await getRawOpportunityStream(tenantId, {
        ...(source ? { source } : {}),
        ...(market ? { market } : {}),
        ...(minPrice ? { min_price: parseInt(minPrice, 10) } : {}),
        ...(maxPrice ? { max_price: parseInt(maxPrice, 10) } : {}),
        ...(isDistressed != null ? { is_distressed: isDistressed === 'true' } : {}),
        ...(limitParam ? { limit: parseInt(limitParam, 10) } : {}),
      })
      return NextResponse.json({ records, count: records.length })
    }

    // ?mode=idealista-stats → Idealista-specific stats
    if (mode === 'idealista-stats') {
      const stats = await getIdealistaStats(tenantId)
      return NextResponse.json({ source: 'IDEALISTA', ...stats })
    }

    // ?mode=casafari-stats → Casafari-specific stats
    if (mode === 'casafari-stats') {
      const stats = await getCasafariStats(tenantId)
      return NextResponse.json({ source: 'CASAFARI', ...stats })
    }

    // default → supply stats overview
    const stats = await getSupplyStats(tenantId)
    return NextResponse.json({ tenant_id: tenantId, ...stats })
  } catch (e) {
    log.error('[supply/ingest] GET error', e instanceof Error ? e : new Error(String(e)))
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  try {
    if (!isAdminAuthorized(req)) {
      return NextResponse.json({ error: 'Unauthorized — admin Bearer required' }, { status: 401 })
    }

    const body = (await req.json()) as Record<string, unknown>
    const action = body['action'] as string | undefined
    const tenantId = (body['tenant_id'] as string | undefined) ?? DEFAULT_TENANT

    if (!action) {
      return NextResponse.json({ error: 'Missing action' }, { status: 400 })
    }

    // action: run-ingestion
    if (action === 'run-ingestion') {
      const markets = Array.isArray(body['markets'])
        ? (body['markets'] as string[])
        : undefined
      const run = await runIngestionCycle(tenantId, markets)
      return NextResponse.json({ success: true, run })
    }

    // action: fetch-idealista
    if (action === 'fetch-idealista') {
      const market = body['market'] as IdealistaMarket | undefined
      if (!market || !['PT', 'ES', 'IT'].includes(market)) {
        return NextResponse.json(
          { error: 'Invalid market — must be PT | ES | IT' },
          { status: 400 },
        )
      }
      const city = body['city'] as string | undefined
      const maxResults = typeof body['max_results'] === 'number' ? body['max_results'] : 50
      const listings = await fetchIdealistaListings(market, city, maxResults)
      return NextResponse.json({ success: true, market, count: listings.length, listings })
    }

    // action: fetch-casafari
    if (action === 'fetch-casafari') {
      const market = body['market'] as CasafariMarket | undefined
      if (!market || !['PT', 'ES', 'FR', 'IT', 'DE'].includes(market)) {
        return NextResponse.json(
          { error: 'Invalid market — must be PT | ES | FR | IT | DE' },
          { status: 400 },
        )
      }
      const city = body['city'] as string | undefined
      const maxResults = typeof body['max_results'] === 'number' ? body['max_results'] : 50
      const listings = await fetchCasafariListings(market, city, maxResults)
      return NextResponse.json({ success: true, market, count: listings.length, listings })
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  } catch (e) {
    log.error('[supply/ingest] POST error', e instanceof Error ? e : new Error(String(e)))
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
