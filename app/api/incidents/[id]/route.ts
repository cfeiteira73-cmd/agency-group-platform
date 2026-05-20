// =============================================================================
// Agency Group — Incidents: Detail + Update API
// app/api/incidents/[id]/route.ts
//
// GET   /api/incidents/[id]
//   Returns the full IncidentRow for the given incident_id.
//   Returns 404 if not found.
//
// PATCH /api/incidents/[id]
//   Body: { status: IncidentStatus, resolved_at?: string }
//   Updates status (and optionally resolved_at) for the given incident.
//   Returns the updated IncidentRow, or 404 if not found.
//
// Auth: Bearer token via REALITY_API_SECRET env var on both methods.
//
// TypeScript strict — 0 errors
// =============================================================================

import { type NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin }                  from '@/lib/supabase'
import {
  updateIncidentStatus,
  type IncidentRow,
  type IncidentStatus,
} from '@/lib/incidents/incidentIngestor'
import { safeCompare }                    from '@/lib/safeCompare'

// ─── Auth helpers ─────────────────────────────────────────────────────────────

function unauthorized(): NextResponse {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 })
}

function notFound(): NextResponse {
  return NextResponse.json({ error: 'Incident not found' }, { status: 404 })
}

function verifyBearer(request: NextRequest): boolean {
  const secret = process.env.REALITY_API_SECRET
  if (!secret) return false
  const authHeader = request.headers.get('authorization') ?? ''
  const [scheme, token] = authHeader.split(' ')
  return scheme === 'Bearer' && !!token && safeCompare(token, secret)
}

// ─── Valid IncidentStatus values ──────────────────────────────────────────────

const VALID_STATUSES: ReadonlySet<string> = new Set<IncidentStatus>([
  'open', 'investigating', 'resolved', 'autopsy_complete',
])

// ─── Route params type ────────────────────────────────────────────────────────

type RouteContext = { params: Promise<{ id: string }> }

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  if (!verifyBearer(request)) return unauthorized()

  const { id } = await context.params
  if (!id || id.trim() === '') return badRequest('id parameter is required')

  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('incidents')
      .select('*')
      .eq('incident_id', id.trim())
      .maybeSingle()

    if (error) {
      console.error('[Incidents Detail API] DB error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    if (!data) return notFound()

    return NextResponse.json(data as IncidentRow)
  } catch (err) {
    console.error('[Incidents Detail API] GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── PATCH ────────────────────────────────────────────────────────────────────

interface PatchBody {
  status?:      unknown
  resolved_at?: unknown
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  if (!verifyBearer(request)) return unauthorized()

  const { id } = await context.params
  if (!id || id.trim() === '') return badRequest('id parameter is required')

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: PatchBody
  try {
    body = await request.json() as PatchBody
  } catch {
    return badRequest('Invalid JSON body')
  }

  // ── Validate status ────────────────────────────────────────────────────────
  if (typeof body.status !== 'string' || !VALID_STATUSES.has(body.status)) {
    return badRequest(`status is required and must be one of: ${[...VALID_STATUSES].join(', ')}`)
  }
  const status = body.status as IncidentStatus

  // ── Validate resolved_at (optional) ───────────────────────────────────────
  let resolvedAt: string | undefined
  if (body.resolved_at !== undefined) {
    if (typeof body.resolved_at !== 'string') {
      return badRequest('resolved_at must be an ISO-8601 string when provided')
    }
    if (isNaN(Date.parse(body.resolved_at))) {
      return badRequest('resolved_at must be a valid ISO-8601 date string')
    }
    resolvedAt = body.resolved_at
  }

  try {
    // Confirm the incident exists before patching
    const { data: existing, error: fetchError } = await (supabaseAdmin as any)
      .from('incidents')
      .select('incident_id')
      .eq('incident_id', id.trim())
      .maybeSingle()

    if (fetchError) {
      console.error('[Incidents Detail API] PATCH fetch error:', fetchError)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
    if (!existing) return notFound()

    // Build the extra patch payload (resolved_at only)
    const extra: Partial<IncidentRow> = resolvedAt !== undefined
      ? { resolved_at: resolvedAt }
      : {}
    await updateIncidentStatus(id.trim(), status, extra)

    // Re-fetch to return the fresh row
    const { data: updated, error: refetchError } = await (supabaseAdmin as any)
      .from('incidents')
      .select('*')
      .eq('incident_id', id.trim())
      .maybeSingle()

    if (refetchError || !updated) {
      console.error('[Incidents Detail API] PATCH refetch error:', refetchError)
      return NextResponse.json(
        { error: 'Update applied but failed to retrieve updated row' },
        { status: 500 },
      )
    }

    return NextResponse.json(updated as IncidentRow)
  } catch (err) {
    console.error('[Incidents Detail API] PATCH error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
