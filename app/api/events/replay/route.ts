// =============================================================================
// AGENCY GROUP — /api/events/replay
// DLQ Replay endpoint for the SH-ROS event bus (v1.0)
//
// GET  /api/events/replay?limit=50&event_type=match_created
//   → Lists DLQ events pending replay (metadata->>'dlq' = 'true')
//   Filters (combinable):
//   ?correlation_id=<uuid>           — replay all events for a request trace
//   ?from=<ISO>&to=<ISO>             — replay events in a time window
//   ?event_type=<type>               — replay events of a specific type
//
// POST /api/events/replay
//   Body: { event_ids: string[] }
//   → Re-publishes the specified events (clears dlq flag, sets replayed_at)
//
// Auth: CRON_SECRET or INTERNAL_API_TOKEN (service_token only)
// AMI: 22506 | SH-ROS Event Bus DLQ
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { requirePortalAuth } from '@/lib/requirePortalAuth'
import { supabaseAdmin } from '@/lib/supabase'
import { randomUUID } from 'crypto'
import type { EventType } from '@/lib/events/types'
import { getRequestCorrelationId } from '@/lib/observability/correlation'

// ---------------------------------------------------------------------------
// Shared: enforce service-token-only auth
// ---------------------------------------------------------------------------

async function enforceServiceAuth(
  req: NextRequest
): Promise<{ ok: false; response: NextResponse } | { ok: true }> {
  const check = await requirePortalAuth(req)
  if (!check.ok) return { ok: false, response: check.response }
  if (check.via !== 'service_token') {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Forbidden — service token required (CRON_SECRET or INTERNAL_API_TOKEN)' },
        { status: 403 }
      ),
    }
  }
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Row shape returned by Supabase for learning_events
// ---------------------------------------------------------------------------

interface LearningEventRow {
  id: string
  event_type: EventType
  correlation_id: string | null
  source_system: 'api' | 'n8n' | 'cron' | 'engine' | 'agent'
  metadata: Record<string, unknown>
  created_at: string
}

// ---------------------------------------------------------------------------
// GET /api/events/replay
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  const corrId = getRequestCorrelationId(req)
  const auth = await enforceServiceAuth(req)
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(req.url)
  const rawLimit     = searchParams.get('limit')
  const eventType    = searchParams.get('event_type')
  const correlationId = searchParams.get('correlation_id')
  const fromDate     = searchParams.get('from')
  const toDate       = searchParams.get('to')

  const limit = Math.min(Math.max(parseInt(rawLimit ?? '50', 10) || 50, 1), 200)

  // Validate ISO date params if provided
  if (fromDate && isNaN(Date.parse(fromDate))) {
    return NextResponse.json({ error: 'Invalid "from" date — must be ISO 8601' }, { status: 400 })
  }
  if (toDate && isNaN(Date.parse(toDate))) {
    return NextResponse.json({ error: 'Invalid "to" date — must be ISO 8601' }, { status: 400 })
  }

  let query = supabaseAdmin
    .from('learning_events')
    .select('id, event_type, correlation_id, source_system, metadata, created_at')
    .eq('metadata->>dlq', 'true')
    .order('created_at', { ascending: true })
    .limit(limit)

  // Mode 1: filter by event_type
  if (eventType) {
    query = query.eq('event_type', eventType)
  }

  // Mode 2: filter by correlation_id (replay all events from a single request trace)
  if (correlationId) {
    query = query.eq('correlation_id', correlationId)
  }

  // Mode 3: filter by time range
  if (fromDate) {
    query = query.gte('created_at', new Date(fromDate).toISOString())
  }
  if (toDate) {
    query = query.lte('created_at', new Date(toDate).toISOString())
  }

  const { data, error } = await query

  if (error) {
    console.error('[EventBus][DLQ] GET /api/events/replay failed', { error: error.message }, { corrId })
    return NextResponse.json({ error: 'Failed to query DLQ events' }, { status: 500 })
  }

  return NextResponse.json({
    ok:     true,
    count:  data?.length ?? 0,
    events: data ?? [],
  })
}

// ---------------------------------------------------------------------------
// POST /api/events/replay
// ---------------------------------------------------------------------------

interface ReplayRequestBody {
  /** Explicit list of event UUIDs to replay */
  event_ids?: string[]
  /** Replay all DLQ events matching a correlation_id */
  correlation_id?: string
  /** Replay DLQ events in a time range (ISO 8601) */
  from?: string
  to?: string
  /** Limit results when using correlation_id or time range modes (max 100) */
  limit?: number
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const corrId = getRequestCorrelationId(req)
  const auth = await enforceServiceAuth(req)
  if (!auth.ok) return auth.response

  let body: ReplayRequestBody
  try {
    body = (await req.json()) as ReplayRequestBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { event_ids, correlation_id: replayCorrelationId, from: fromDate, to: toDate } = body

  // Validate that at least one targeting mode is provided
  const hasEventIds   = Array.isArray(event_ids) && event_ids.length > 0
  const hasCorrId     = typeof replayCorrelationId === 'string' && replayCorrelationId.length > 0
  const hasTimeRange  = typeof fromDate === 'string' || typeof toDate === 'string'

  if (!hasEventIds && !hasCorrId && !hasTimeRange) {
    return NextResponse.json(
      { error: 'Provide at least one of: event_ids, correlation_id, or from/to date range' },
      { status: 400 }
    )
  }

  // Validate date params
  if (fromDate && isNaN(Date.parse(fromDate))) {
    return NextResponse.json({ error: 'Invalid "from" date — must be ISO 8601' }, { status: 400 })
  }
  if (toDate && isNaN(Date.parse(toDate))) {
    return NextResponse.json({ error: 'Invalid "to" date — must be ISO 8601' }, { status: 400 })
  }

  const batchLimit = Math.min(body.limit ?? 100, 100)

  // Build query depending on mode
  let dlqQuery = supabaseAdmin
    .from('learning_events')
    .select('id, event_type, correlation_id, source_system, metadata, created_at')
    .eq('metadata->>dlq', 'true')

  if (hasEventIds) {
    // Cap replay batch size to prevent abuse
    if ((event_ids as string[]).length > 100) {
      return NextResponse.json({ error: 'Maximum 100 event_ids per replay request' }, { status: 400 })
    }
    dlqQuery = dlqQuery.in('id', event_ids as string[])
  }

  if (hasCorrId) {
    dlqQuery = dlqQuery.eq('correlation_id', replayCorrelationId as string)
  }

  if (fromDate) {
    dlqQuery = dlqQuery.gte('created_at', new Date(fromDate).toISOString())
  }
  if (toDate) {
    dlqQuery = dlqQuery.lte('created_at', new Date(toDate).toISOString())
  }

  dlqQuery = dlqQuery.order('created_at', { ascending: true }).limit(batchLimit)

  // Fetch the DLQ events to replay — only events that are actually in DLQ
  const { data: dlqRows, error: fetchError } = await dlqQuery

  if (fetchError) {
    console.error('[EventBus][DLQ] POST /api/events/replay fetch failed', { error: fetchError.message }, { corrId })
    return NextResponse.json({ error: 'Failed to fetch DLQ events' }, { status: 500 })
  }

  if (!dlqRows || dlqRows.length === 0) {
    return NextResponse.json({ ok: true, replayed: 0, skipped: 0, message: 'No matching DLQ events found' })
  }

  const rows = dlqRows as LearningEventRow[]
  const replayedAt = new Date().toISOString()
  let replayed = 0
  const failures: string[] = []

  for (const row of rows) {
    // Build clean metadata — remove dlq flags, add replay provenance
    const { dlq: _dlq, dlq_at: _dlqAt, original_error: _origErr, ...cleanMeta } = row.metadata as {
      dlq?: unknown
      dlq_at?: unknown
      original_error?: unknown
      [key: string]: unknown
    }

    const replayedMeta: Record<string, unknown> = {
      ...cleanMeta,
      dlq:             false,
      replayed_at:     replayedAt,
      replayed_from:   row.id,
    }

    const { error: insertError } = await supabaseAdmin
      .from('learning_events')
      .insert({
        event_type:     row.event_type,
        correlation_id: row.correlation_id,
        source_system:  row.source_system,
        metadata:       replayedMeta,
        created_at:     replayedAt,
      })

    if (insertError) {
      console.error('[EventBus][DLQ] replay insert failed', {
        dlq_id:     row.id,
        event_type: row.event_type,
        error:      insertError.message,
        corrId,
      })
      failures.push(row.id)
      continue
    }

    replayed++
  }

  // skipped = events requested by ID but not found in DLQ (already replayed or non-existent)
  const skipped = hasEventIds ? (event_ids as string[]).length - rows.length : 0

  return NextResponse.json({
    ok:              failures.length === 0,
    replayed,
    skipped,
    failed:          failures.length,
    failed_ids:      failures.length > 0 ? failures : undefined,
    total_found:     rows.length,
  })
}
