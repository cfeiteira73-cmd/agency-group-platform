// =============================================================================
// AGENCY GROUP — SH-ROS Runtime Event Ingestion API vFINAL
// POST /api/runtime/events — persist + dispatch RuntimeEvent
// GET  /api/runtime/events — HOT memory query (DB-backed, 1000 events/org)
// AMI: 22506 | SH-ROS Production Runtime
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { isPortalAuth } from '@/lib/portalAuth'
import { orchestrator, hotMemory, warmMemory } from '@/lib/runtime'
import type { RuntimeEvent, RuntimeEventType } from '@/lib/runtime'

export const runtime = 'nodejs'

// ─── Valid values ─────────────────────────────────────────────────────────────

const VALID_SOURCES  = new Set(['api','n8n','cron','agent','engine','portal'] as const)
const VALID_PRIORITY = new Set(['low','medium','high','critical'] as const)

// ─── POST /api/runtime/events ─────────────────────────────────────────────────
//
// Performance budget: ingestion < 50ms, routing < 25ms, total < 2000ms

export async function POST(req: NextRequest) {
  const ingestion_start = Date.now()

  // AUTH
  if (!(await isPortalAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // VALIDATE required fields
  const {
    org_id,
    type,
    source_system,
    payload,
    correlation_id: incomingCorrelation,
    priority: incomingPriority,
  } = body

  if (!org_id || typeof org_id !== 'string') {
    return NextResponse.json({ error: 'org_id is required' }, { status: 400 })
  }
  if (!type || typeof type !== 'string') {
    return NextResponse.json({ error: 'type is required' }, { status: 400 })
  }
  if (!source_system || !VALID_SOURCES.has(source_system as typeof VALID_SOURCES extends Set<infer T> ? T : never)) {
    return NextResponse.json(
      { error: `source_system must be one of: ${[...VALID_SOURCES].join(', ')}` },
      { status: 400 },
    )
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return NextResponse.json({ error: 'payload must be a non-null object' }, { status: 400 })
  }

  const priority = (VALID_PRIORITY.has(incomingPriority as typeof VALID_PRIORITY extends Set<infer T> ? T : never)
    ? incomingPriority
    : 'medium') as 'low' | 'medium' | 'high' | 'critical'

  const ingestion_ms = Date.now() - ingestion_start

  // BUILD unified event contract (§3 spec)
  const event: RuntimeEvent = {
    event_id:       randomUUID(),
    org_id:         org_id as string,
    type:           type as RuntimeEventType,
    timestamp:      new Date().toISOString(),
    correlation_id: typeof incomingCorrelation === 'string' && incomingCorrelation
      ? incomingCorrelation
      : randomUUID(),
    priority,
    retry_count:    0,
    payload:        payload as RuntimeEvent['payload'],
    metadata: {
      schema_version: 'vFINAL',
      trace_id:       randomUUID(),
      source_system:  source_system as RuntimeEvent['metadata']['source_system'],
    },
  }

  // DISPATCH — persist → execute → trace
  try {
    const trace = await orchestrator.dispatch(event)

    return NextResponse.json(
      {
        ...trace,
        ingestion_ms,
        performance: {
          ingestion_ms,
          total_ms: trace.total_duration_ms,
          within_budget: trace.total_duration_ms < 2_000,
        },
      },
      { status: 200 },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const isValidation = err instanceof Error && err.name === 'RuntimeValidationError'
    console.error('[POST /api/runtime/events]', { message, event_id: event.event_id })
    return NextResponse.json({ error: message }, { status: isValidation ? 400 : 500 })
  }
}

// ─── GET /api/runtime/events ──────────────────────────────────────────────────
//
// Returns HOT memory (in-process cache + DB fallback)
// ?org_id=  required
// ?limit=   max 500, default 50
// ?source=  'cache' (default) | 'db' (queries Supabase directly)

export async function GET(req: NextRequest) {
  if (!(await isPortalAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const org_id  = searchParams.get('org_id')
  const limitRaw = parseInt(searchParams.get('limit') ?? '50', 10)
  const source  = searchParams.get('source') ?? 'cache'
  const limit   = Math.min(Math.max(1, isNaN(limitRaw) ? 50 : limitRaw), 500)

  if (!org_id) {
    return NextResponse.json({ error: 'org_id query parameter is required' }, { status: 400 })
  }

  try {
    let events: unknown[]

    if (source === 'db') {
      // WARM memory: DB query (90-day window)
      events = await warmMemory.getRecentFromDB(org_id, limit)
    } else {
      // HOT memory: in-process cache
      events = hotMemory.getRecent(org_id, limit)

      // Fallback to DB if cache is empty (e.g. after process restart)
      if (events.length === 0) {
        events = await warmMemory.getRecentFromDB(org_id, limit)
      }
    }

    return NextResponse.json({ org_id, limit, source, count: events.length, events }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[GET /api/runtime/events]', { message, org_id })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
