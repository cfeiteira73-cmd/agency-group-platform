// Agency Group — Market Authority API
// app/api/market-authority/index/route.ts
//
// The Market Authority API — publishable to banks, funds, institutional investors.
// Exposes OLI, Pricing Benchmarks, and ICS as a unified institutional endpoint.
//
// TypeScript strict — 0 errors

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware/portalAuthGuard'
import {
  computeLiquidityIndex,
  getLiquidityIndex,
  getLiquidityComparison,
  publishLiquidityIndexBatch,
  OFFICIAL_MARKETS,
} from '@/lib/market-authority/officialLiquidityIndex'
import {
  computePriceBenchmark,
  getLatestBenchmark,
  publishBenchmarkMatrix,
  deviationFromBenchmark,
  BENCHMARK_PROPERTY_TYPES,
} from '@/lib/market-authority/pricingBenchmarkEngine'
import {
  computeICS,
  getLatestICS,
  publishICSMatrix,
} from '@/lib/market-authority/investmentConfidenceScore'
import log from '@/lib/logger'

export const runtime = 'nodejs'
export const maxDuration = 120

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: Request): Promise<NextResponse> {
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth as NextResponse

  const tenantId = auth.tenant_id
  const { searchParams } = new URL(req.url)
  const market = searchParams.get('market')
  const mode = searchParams.get('mode')
  const assetId = searchParams.get('asset_id')

  try {
    // ?asset_id=... → deviation from benchmark
    if (assetId) {
      const deviation = await deviationFromBenchmark(assetId, tenantId)
      return NextResponse.json({ data: deviation })
    }

    // ?mode=publish → trigger full publish for all markets
    if (mode === 'publish') {
      const [oliEntries, benchmarks, icsEntries] = await Promise.all([
        publishLiquidityIndexBatch(tenantId),
        publishBenchmarkMatrix(tenantId),
        publishICSMatrix(tenantId),
      ])
      return NextResponse.json({
        data: {
          oli_published: oliEntries.length,
          benchmarks_published: benchmarks.length,
          ics_published: icsEntries.length,
          published_at: new Date().toISOString(),
        },
      })
    }

    // ?mode=liquidity-index → all markets ranked
    if (mode === 'liquidity-index') {
      const comparison = await getLiquidityComparison(tenantId)
      return NextResponse.json({ data: comparison })
    }

    // ?mode=pricing-matrix → latest RESIDENTIAL benchmark for all markets
    if (mode === 'pricing-matrix') {
      const benchmarks = await Promise.allSettled(
        OFFICIAL_MARKETS.map(async (m) => {
          const city = m.split(':')[1] ?? m
          return getLatestBenchmark(m, city, 'RESIDENTIAL', tenantId)
        }),
      )
      const data = benchmarks
        .filter((r) => r.status === 'fulfilled' && r.value !== null)
        .map((r) => (r as PromiseFulfilledResult<NonNullable<typeof r extends PromiseFulfilledResult<infer V> ? V : never>>).value)
      return NextResponse.json({ data })
    }

    // ?mode=ics-matrix → ICS for all markets
    if (mode === 'ics-matrix') {
      const icsEntries = await Promise.allSettled(
        OFFICIAL_MARKETS.map((m) => getLatestICS(m, tenantId)),
      )
      const data = icsEntries
        .filter((r) => r.status === 'fulfilled' && r.value !== null)
        .map((r) => (r as PromiseFulfilledResult<NonNullable<typeof r extends PromiseFulfilledResult<infer V> ? V : never>>).value)
      return NextResponse.json({ data })
    }

    // ?market=PT:Lisboa → OLI + ICS + pricing benchmark for specific market
    if (market) {
      const city = market.split(':')[1] ?? market
      const [oliHistory, ics, benchmarkRes, benchmarkComm, benchmarkLand] = await Promise.all([
        getLiquidityIndex(market, tenantId, 6),
        getLatestICS(market, tenantId),
        getLatestBenchmark(market, city, 'RESIDENTIAL', tenantId),
        getLatestBenchmark(market, city, 'COMMERCIAL', tenantId),
        getLatestBenchmark(market, city, 'LAND', tenantId),
      ])
      return NextResponse.json({
        data: {
          market,
          oli_history: oliHistory,
          ics,
          benchmarks: {
            RESIDENTIAL: benchmarkRes,
            COMMERCIAL: benchmarkComm,
            LAND: benchmarkLand,
          },
        },
      })
    }

    // default: full authority snapshot — all markets
    const [oliComparison, icsMatrixResults, pricingResults] = await Promise.all([
      getLiquidityComparison(tenantId),
      Promise.allSettled(OFFICIAL_MARKETS.map((m) => getLatestICS(m, tenantId))),
      Promise.allSettled(
        OFFICIAL_MARKETS.map(async (m) => {
          const city = m.split(':')[1] ?? m
          return {
            market: m,
            benchmarks: await Promise.allSettled(
              BENCHMARK_PROPERTY_TYPES.map((pt) => getLatestBenchmark(m, city, pt, tenantId)),
            ),
          }
        }),
      ),
    ])

    const icsMatrix = icsMatrixResults
      .filter((r) => r.status === 'fulfilled' && r.value !== null)
      .map((r) => (r as PromiseFulfilledResult<NonNullable<typeof r extends PromiseFulfilledResult<infer V> ? V : never>>).value)

    const pricingMatrix = pricingResults
      .filter((r) => r.status === 'fulfilled')
      .map((r) => (r as PromiseFulfilledResult<{ market: string; benchmarks: PromiseSettledResult<unknown>[] }>).value)

    return NextResponse.json({
      data: {
        authority_snapshot_at: new Date().toISOString(),
        liquidity_ranking: oliComparison,
        ics_matrix: icsMatrix,
        pricing_matrix: pricingMatrix,
        markets_covered: OFFICIAL_MARKETS.length,
        methodology: 'AG_MARKET_AUTHORITY_v1.0',
      },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Internal error'
    log.error('[market-authority] GET error', e instanceof Error ? e : new Error(msg))
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<NextResponse> {
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth as NextResponse

  const tenantId = auth.tenant_id

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const action = body['action'] as string | undefined

  try {
    // { action: 'publish-all' } → full publish
    if (action === 'publish-all') {
      const [oliEntries, benchmarks, icsEntries] = await Promise.all([
        publishLiquidityIndexBatch(tenantId),
        publishBenchmarkMatrix(tenantId),
        publishICSMatrix(tenantId),
      ])
      log.info('[market-authority] publish-all completed', { tenantId, oli: oliEntries.length, benchmarks: benchmarks.length, ics: icsEntries.length })
      return NextResponse.json({
        data: {
          action: 'publish-all',
          oli_published: oliEntries.length,
          benchmarks_published: benchmarks.length,
          ics_published: icsEntries.length,
          published_at: new Date().toISOString(),
        },
      })
    }

    // { action: 'compute-ics', market } → single market ICS
    if (action === 'compute-ics') {
      const market = body['market'] as string | undefined
      if (!market) {
        return NextResponse.json({ error: 'Missing required field: market' }, { status: 400 })
      }
      const ics = await computeICS(market, tenantId)
      return NextResponse.json({ data: ics })
    }

    // { action: 'compute-oli', market } → single market OLI
    if (action === 'compute-oli') {
      const market = body['market'] as string | undefined
      if (!market) {
        return NextResponse.json({ error: 'Missing required field: market' }, { status: 400 })
      }
      const oli = await computeLiquidityIndex(market, tenantId)
      return NextResponse.json({ data: oli })
    }

    // { action: 'compute-benchmark', market, city, property_type } → single benchmark
    if (action === 'compute-benchmark') {
      const market = body['market'] as string | undefined
      const city = body['city'] as string | undefined
      const propertyType = body['property_type'] as string | undefined
      if (!market || !city || !propertyType) {
        return NextResponse.json(
          { error: 'Missing required fields: market, city, property_type' },
          { status: 400 },
        )
      }
      const benchmark = await computePriceBenchmark(market, city, propertyType, tenantId)
      return NextResponse.json({ data: benchmark })
    }

    return NextResponse.json({ error: `Unknown action: ${action ?? 'undefined'}` }, { status: 400 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Internal error'
    log.error('[market-authority] POST error', e instanceof Error ? e : new Error(msg))
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
