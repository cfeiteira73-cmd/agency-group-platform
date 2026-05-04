// =============================================================================
// Agency Group — National Listings Ingestion Cron
// GET /api/cron/ingest-listings
// Scheduled: daily at 05:00 UTC (before sync-listings at 06:00)
//
// PIPELINE:
//   1. Fetch listings from all configured providers:
//      - Casafari  (if CASAFARI_API_KEY set)
//      - Idealista (if IDEALISTA_API_KEY + IDEALISTA_API_SECRET set)
//      - Imovirtual (always — public scraping)
//      - e-Leilões (always — public judicial auctions)
//   2. Deduplicate cross-provider listings
//   3. Upsert new/updated listings into properties table
//   4. Log execution to automations_log
//
// NOTE: This cron only ingests raw listings.
//       Scoring is handled by sync-listings at 06:00 (reads from properties table).
//       The two-step design keeps ingestion and scoring decoupled.
//
// AUTH: CRON_SECRET
// MAX DURATION: 300s (Vercel Pro)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { runIngestionPipeline }      from '@/lib/ingestion/pipeline'
import type { ProviderFetchParams }  from '@/lib/ingestion/types'
import { cronCorrelationId }         from '@/lib/observability/correlation'

export const runtime    = 'nodejs'
export const maxDuration = 300

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function authCheck(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const token =
    req.headers.get('x-cron-secret') ??
    req.headers.get('authorization')?.replace('Bearer ', '').trim()
  return token === secret
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!authCheck(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const corrId = cronCorrelationId('ingest-listings')

  const { searchParams } = req.nextUrl

  // Optional query params for targeted runs
  const params: ProviderFetchParams = {
    city:     searchParams.get('city')      ?? undefined,
    minPrice: searchParams.get('min_price') ? parseInt(searchParams.get('min_price')!, 10) : undefined,
    maxPrice: searchParams.get('max_price') ? parseInt(searchParams.get('max_price')!, 10) : undefined,
    limit:    searchParams.get('limit')     ? parseInt(searchParams.get('limit')!, 10)     : 200,
  }

  const result = await runIngestionPipeline(params)

  const hasErrors = result.total_errors > 0

  const res = NextResponse.json(
    {
      ok:             !hasErrors,
      run_id:         result.run_id,
      summary: {
        total_fetched:  result.total_fetched,
        total_new:      result.total_new,
        total_updated:  result.total_updated,
        total_errors:   result.total_errors,
        duration_ms:    result.duration_ms,
      },
      providers:      result.providers.map(p => ({
        name:     p.provider,
        fetched:  p.fetched,
        new:      p.new_listings,
        updated:  p.updated,
        skipped:  p.duplicates_skipped,
        errors:   p.errors.length,
      })),
      correlation_id: corrId,
      ...(hasErrors ? { warnings: result.warnings } : {}),
    },
    { status: hasErrors ? 207 : 200 },
  )
  res.headers.set('x-correlation-id', corrId)
  return res
}
