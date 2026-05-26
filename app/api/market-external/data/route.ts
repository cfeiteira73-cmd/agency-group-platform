// =============================================================================
// Agency Group — Market External Data API Route
// app/api/market-external/data/route.ts
//
// GET modes (requireAuth):
//   default               — latest externalization report
//   ?mode=benchmarks&country=PT&city=Lisboa — latest benchmark for city
//   ?mode=arbitrage       — active arbitrage opportunities
//   ?mode=rates           — latest credit rate data
//   ?mode=overfitting     — detectSystemOverfitting
//   ?mode=refresh         — run runDataRefresh (GET trigger for cron)
//
// POST actions (admin Bearer):
//   { action: 'ingest-benchmark', ...benchmark_data }
//   { action: 'inject-closing', closing_data: [...] }
//   { action: 'run-comparison' }
//   { action: 'capture-arbitrage', opportunity_id }
//
// TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware/portalAuthGuard'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import {
  fetchINEPriceData,
  fetchBancoDPortugalRates,
  getLatestBenchmark,
  ingestManualBenchmark,
  runDataRefresh,
  type MarketDataSource,
} from '@/lib/market-external/externalMarketDataEngine'
import {
  runMarketExternalizationReport,
  detectSystemOverfitting,
  injectExternalClosingData,
} from '@/lib/market-external/marketExternalizationEngine'
import {
  detectArbitrageOpportunities,
  captureArbitrage,
  getActiveOpportunities,
} from '@/lib/market-external/arbitrageDetector'

export const runtime = 'nodejs'
export const maxDuration = 120

// ─── DB helper ────────────────────────────────────────────────────────────────

type SupabaseAny = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        order: (col: string, opts: unknown) => {
          limit: (n: number) => Promise<{ data: unknown; error: unknown }>
        }
      }
    }
  }
}

function db() {
  return supabaseAdmin as unknown as SupabaseAny
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req)
  if (authResult instanceof Response) return authResult

  const tenantId = authResult.tenant_id
  const url = new URL(req.url)
  const mode = url.searchParams.get('mode') ?? 'report'
  const country = url.searchParams.get('country') ?? 'PT'
  const city = url.searchParams.get('city') ?? 'Lisboa'

  try {
    switch (mode) {
      case 'benchmarks': {
        const benchmark = await getLatestBenchmark(country, city, tenantId)
        if (!benchmark) {
          // Try fetching fresh data
          const fresh = await fetchINEPriceData(country, city)
          return NextResponse.json({ success: true, benchmark: fresh })
        }
        return NextResponse.json({ success: true, benchmark })
      }

      case 'arbitrage': {
        const opportunities = await getActiveOpportunities(tenantId)
        return NextResponse.json({
          success: true,
          opportunities,
          count: opportunities.length,
        })
      }

      case 'rates': {
        const rates = await fetchBancoDPortugalRates()
        return NextResponse.json({ success: true, rates, count: rates.length })
      }

      case 'overfitting': {
        const result = await detectSystemOverfitting(tenantId)
        return NextResponse.json({ success: true, ...result })
      }

      case 'refresh': {
        const result = await runDataRefresh(tenantId)
        return NextResponse.json({ success: true, ...result })
      }

      default: {
        // Latest externalization report
        const { data: reports } = await db()
          .from('market_externalization_reports')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('generated_at', { ascending: false })
          .limit(1)

        const latest = Array.isArray(reports) && reports.length > 0 ? reports[0] : null

        return NextResponse.json({
          success: true,
          report: latest,
          has_data: latest !== null,
        })
      }
    }
  } catch (err) {
    log.error('[market-external/data] GET error', err as Error, { mode, tenantId })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req)
  if (authResult instanceof Response) return authResult

  const tenantId = authResult.tenant_id

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const action = body.action as string | undefined
  if (!action) {
    return NextResponse.json({ error: 'Missing action field' }, { status: 400 })
  }

  try {
    switch (action) {
      case 'ingest-benchmark': {
        const {
          country,
          city,
          district,
          property_type,
          price_per_sqm_eur_cents,
          median_transaction_eur_cents,
          transaction_volume,
          period_start,
          period_end,
          source,
          source_url,
          is_official,
        } = body as {
          country: string
          city: string
          district: string | null
          property_type: 'RESIDENTIAL' | 'COMMERCIAL' | 'LAND' | 'MIXED'
          price_per_sqm_eur_cents: number
          median_transaction_eur_cents: number
          transaction_volume: number
          period_start: string
          period_end: string
          source: MarketDataSource
          source_url: string | null
          is_official: boolean
        }

        if (!country || !city || !price_per_sqm_eur_cents) {
          return NextResponse.json(
            { error: 'Missing required fields: country, city, price_per_sqm_eur_cents' },
            { status: 400 },
          )
        }

        const benchmark = await ingestManualBenchmark(
          {
            tenant_id: tenantId,
            country,
            city,
            district: district ?? null,
            property_type: property_type ?? 'RESIDENTIAL',
            price_per_sqm_eur_cents,
            median_transaction_eur_cents: median_transaction_eur_cents ?? 0,
            transaction_volume: transaction_volume ?? 0,
            period_start: period_start ?? new Date().toISOString(),
            period_end: period_end ?? new Date().toISOString(),
            source: source ?? 'MANUAL_IMPORT',
            source_url: source_url ?? null,
            is_official: is_official ?? false,
          },
          tenantId,
        )

        return NextResponse.json({ success: true, benchmark })
      }

      case 'inject-closing': {
        const closingData = body.closing_data as Array<{
          asset_id: string
          actual_price_eur_cents: number
          actual_sqm: number
          closed_at: string
          source: string
        }>

        if (!Array.isArray(closingData) || closingData.length === 0) {
          return NextResponse.json(
            { error: 'closing_data must be a non-empty array' },
            { status: 400 },
          )
        }

        const result = await injectExternalClosingData(tenantId, closingData)
        return NextResponse.json({ success: true, ...result })
      }

      case 'run-comparison': {
        const report = await runMarketExternalizationReport(tenantId)
        // Also detect arbitrage from fresh comparisons
        void detectArbitrageOpportunities(tenantId).catch((e: unknown) =>
          log.warn('[market-external/data] Arbitrage detection failed', { error: String(e) }),
        )
        return NextResponse.json({ success: true, report })
      }

      case 'capture-arbitrage': {
        const opportunityId = body.opportunity_id as string | undefined
        if (!opportunityId) {
          return NextResponse.json({ error: 'Missing opportunity_id' }, { status: 400 })
        }

        await captureArbitrage(opportunityId, tenantId)
        return NextResponse.json({ success: true, opportunity_id: opportunityId, status: 'CAPTURED' })
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (err) {
    log.error('[market-external/data] POST error', err as Error, { action, tenantId })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
