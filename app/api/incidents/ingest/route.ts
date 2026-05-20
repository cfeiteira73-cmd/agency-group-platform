// =============================================================================
// Agency Group — Incident Ingest API
// POST /api/incidents/ingest
//
// Bearer-authenticated endpoint that accepts an incident payload and persists
// it to Supabase via ingestIncident().
//
// Request body:
//   { tenant_id, severity, subsystem, raw_error?, metrics_snapshot? }
//
// Response:
//   { incident_id }
//
// TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse }         from 'next/server'
import {
  ingestIncident,
  type IncidentSeverity,
  type IncidentSubsystem,
  type IncidentMetricsSnapshot,
} from '@/lib/incidents/incidentIngestor'
import { CURRENT_REGION } from '@/lib/events/globalOrdering'
import { safeCompare }    from '@/lib/safeCompare'

export const runtime = 'nodejs'

// ─── Auth ─────────────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const token = process.env.INTERNAL_API_TOKEN
  if (!token) return false
  const incoming = req.headers.get('authorization')?.replace('Bearer ', '')
  return !!incoming && safeCompare(incoming, token)
}

// ─── Validation helpers ───────────────────────────────────────────────────────

const VALID_SEVERITIES:  Set<string> = new Set(['P0', 'P1', 'P2', 'P3'])
const VALID_SUBSYSTEMS:  Set<string> = new Set([
  'api', 'graph', 'ai', 'queue', 'billing', 'database', 'cache', 'region',
])

function isValidSeverity(s: unknown): s is IncidentSeverity {
  return typeof s === 'string' && VALID_SEVERITIES.has(s)
}

function isValidSubsystem(s: unknown): s is IncidentSubsystem {
  return typeof s === 'string' && VALID_SUBSYSTEMS.has(s)
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { tenant_id, severity, subsystem, raw_error, metrics_snapshot } = body

  if (typeof tenant_id !== 'string' || !tenant_id) {
    return NextResponse.json({ error: 'tenant_id is required' }, { status: 400 })
  }
  if (!isValidSeverity(severity)) {
    return NextResponse.json(
      { error: 'severity must be one of P0, P1, P2, P3' },
      { status: 400 },
    )
  }
  if (!isValidSubsystem(subsystem)) {
    return NextResponse.json(
      { error: 'subsystem must be one of api, graph, ai, queue, billing, database, cache, region' },
      { status: 400 },
    )
  }

  const snapshot: IncidentMetricsSnapshot =
    metrics_snapshot && typeof metrics_snapshot === 'object' && !Array.isArray(metrics_snapshot)
      ? (metrics_snapshot as IncidentMetricsSnapshot)
      : {}

  const incident_id = await ingestIncident({
    tenant_id,
    timestamp:        new Date().toISOString(),
    severity,
    region:           CURRENT_REGION,
    subsystem,
    raw_error:        typeof raw_error === 'string' ? raw_error : null,
    metrics_snapshot: snapshot,
  })

  return NextResponse.json({ incident_id }, { status: 201 })
}
