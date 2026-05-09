// =============================================================================
// AGENCY GROUP — SH-ROS Runtime Event Ingestion API v1.0
// POST /api/runtime/events — Ingest and dispatch a RuntimeEvent
// GET  /api/runtime/events — Retrieve recent events for an org (short-term memory)
// AMI: 22506 | SH-ROS Runtime Core
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { isPortalAuth } from '@/lib/portalAuth'
import { orchestrator } from '@/lib/runtime'
import { shortTermMemory } from '@/lib/runtime'
import type { RuntimeEvent, RuntimeEventType } from '@/lib/runtime'

export const runtime = 'nodejs'

// ─── Valid source systems ─────────────────────────────────────────────────────

const VALID_SOURCES = new Set<RuntimeEvent['source_system']>([
  'api', 'n8n', 'cron', 'agent', 'engine', 'portal',
])

// ─── POST /api/runtime/events ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // 1. Auth
  if (!(await isPortalAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // 2. Validate required fields
  const { org_id, type, source_system, payload, correlation_id: incomingCorrelation } = body

  if (!org_id || typeof org_id !== 'string') {
    return NextResponse.json({ error: 'org_id is required' }, { status: 400 })
  }
  if (!type || typeof type !== 'string') {
    return NextResponse.json({ error: 'type is required' }, { status: 400 })
  }
  if (!source_system || typeof source_system !== 'string' || !VALID_SOURCES.has(source_system as RuntimeEvent['source_system'])) {
    return NextResponse.json(
      { error: `source_system is required and must be one of: ${[...VALID_SOURCES].join(', ')}` },
      { status: 400 },
    )
  }
  if (payload === undefined || payload === null || typeof payload !== 'object') {
    return NextResponse.json({ error: 'payload is required and must be an object' }, { status: 400 })
  }

  // 3. Generate server-side fields
  const event: RuntimeEvent = {
    event_id:       randomUUID(),
    org_id:         org_id as string,
    type:           type as RuntimeEventType,
    timestamp:      new Date().toISOString(),
    correlation_id: typeof incomingCorrelation === 'string' && incomingCorrelation
      ? incomingCorrelation
      : randomUUID(),
    source_system:  source_system as RuntimeEvent['source_system'],
    payload:        payload as RuntimeEvent['payload'],
  }

  // 4. Dispatch through orchestrator
  try {
    const trace = await orchestrator.dispatch(event)
    return NextResponse.json(trace, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const isValidationError = err instanceof Error && err.name === 'RuntimeValidationError'
    console.error('[POST /api/runtime/events] dispatch error', { message, event_id: event.event_id })
    return NextResponse.json(
      { error: message },
      { status: isValidationError ? 400 : 500 },
    )
  }
}

// ─── GET /api/runtime/events ──────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // Auth
  if (!(await isPortalAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const org_id = searchParams.get('org_id')
  const limitParam = searchParams.get('limit')

  if (!org_id) {
    return NextResponse.json({ error: 'org_id query parameter is required' }, { status: 400 })
  }

  const limit = limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10) || 50), 200) : 50

  try {
    const events = shortTermMemory.getRecent(org_id, limit)
    return NextResponse.json({ org_id, limit, count: events.length, events }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[GET /api/runtime/events] error', { message, org_id })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
