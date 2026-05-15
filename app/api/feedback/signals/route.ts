// AGENCY GROUP — Feedback API: Economic Signals | AMI: 22506
// POST /api/feedback/signals — ingest economic signal(s)
// GET  /api/feedback/signals?org_id=xxx — get stats + buffered signals
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { isPortalAuth } from '@/lib/portalAuth'
import { economicSignalIngestor, signalNoiseFilter } from '@/lib/runtime/feedback'
import type { SignalSource } from '@/lib/runtime/feedback'
import { getRequestCorrelationId } from '@/lib/observability/correlation'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const correlation_id = getRequestCorrelationId(req)

  try {
    const session = await auth()
    const portal  = await isPortalAuth(req)
    if (!session && !portal) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const org_id = searchParams.get('org_id') ?? 'default'

    const stats        = economicSignalIngestor.getStats(org_id)
    const buffered     = economicSignalIngestor.peek(org_id)
    const filter_stats = signalNoiseFilter.getStats(org_id)

    return NextResponse.json({
      org_id,
      stats,
      filter_stats,
      buffered_count: buffered.length,
      correlation_id,
    }, {
      headers: { 'X-Correlation-ID': correlation_id, 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    return NextResponse.json(
      { error: 'Signal stats failed', detail: String(err), correlation_id },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  const correlation_id = getRequestCorrelationId(req)

  try {
    const session = await auth()
    const portal  = await isPortalAuth(req)
    if (!session && !portal) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json() as {
      org_id:       string
      source:       SignalSource
      entity_type:  'deal' | 'match' | 'property' | 'contact'
      entity_id:    string
      raw_value:    number
      context?:     Record<string, unknown>
    } | {
      // batch
      signals: Array<{
        org_id:       string
        source:       SignalSource
        entity_type:  'deal' | 'match' | 'property' | 'contact'
        entity_id:    string
        raw_value:    number
        context?:     Record<string, unknown>
      }>
    }

    // Batch or single
    if ('signals' in body) {
      // Ingest + filter batch
      const ingested = economicSignalIngestor.ingestBatch(body.signals)
      const { clean, filtered } = signalNoiseFilter.filterBatch(ingested.signals)

      return NextResponse.json({
        batch_id:  ingested.batch_id,
        ingested:  ingested.signals.length,
        clean:     clean.length,
        filtered:  filtered.length,
        correlation_id,
      }, {
        status: 201,
        headers: { 'X-Correlation-ID': correlation_id },
      })
    } else {
      // Single signal
      const signal    = economicSignalIngestor.ingest(body)
      const filter    = signalNoiseFilter.filter(signal)

      return NextResponse.json({
        signal_id:    signal.signal_id,
        passed_filter: filter.passed,
        noise_score:  filter.noise_score,
        correlation_id,
      }, {
        status: 201,
        headers: { 'X-Correlation-ID': correlation_id },
      })
    }
  } catch (err) {
    return NextResponse.json(
      { error: 'Signal ingest failed', detail: String(err), correlation_id },
      { status: 500 }
    )
  }
}
