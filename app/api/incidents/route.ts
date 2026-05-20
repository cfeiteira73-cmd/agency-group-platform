// =============================================================================
// Agency Group — Incidents: List API
// app/api/incidents/route.ts
//
// GET /api/incidents?tenant_id=xxx&status=open&limit=20&severity=P0
//   Returns a paginated list of incidents for a tenant.
//
// Query params:
//   tenant_id  (required) — tenant to scope query
//   status     (optional) — filter by IncidentStatus
//   severity   (optional) — filter by IncidentSeverity
//   limit      (optional) — 1-100, default 20
//
// Auth: Bearer token via REALITY_API_SECRET env var.
//
// TypeScript strict — 0 errors
// =============================================================================

import { type NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin }                  from '@/lib/supabase'
import type { IncidentRow, IncidentStatus, IncidentSeverity } from '@/lib/incidents/incidentIngestor'

// ─── Auth helpers ─────────────────────────────────────────────────────────────

function unauthorized(): NextResponse {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 })
}

function verifyBearer(request: NextRequest): boolean {
  const secret = process.env.REALITY_API_SECRET
  if (!secret) return false
  const authHeader = request.headers.get('authorization') ?? ''
  const [scheme, token] = authHeader.split(' ')
  return scheme === 'Bearer' && token === secret
}

// ─── Valid enum values ────────────────────────────────────────────────────────

const VALID_STATUSES:    ReadonlySet<string> = new Set<IncidentStatus>(['open', 'investigating', 'resolved', 'autopsy_complete'])
const VALID_SEVERITIES:  ReadonlySet<string> = new Set<IncidentSeverity>(['P0', 'P1', 'P2', 'P3'])

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!verifyBearer(request)) return unauthorized()

  const { searchParams } = request.nextUrl

  const tenantId     = searchParams.get('tenant_id')
  const statusParam  = searchParams.get('status')
  const severityParam = searchParams.get('severity')
  const limitParam   = searchParams.get('limit')

  // ── Validate tenant_id ────────────────────────────────────────────────────
  if (!tenantId || tenantId.trim() === '') {
    return badRequest('tenant_id query parameter is required')
  }

  // ── Validate status ───────────────────────────────────────────────────────
  if (statusParam !== null && !VALID_STATUSES.has(statusParam)) {
    return badRequest(`status must be one of: ${[...VALID_STATUSES].join(', ')}`)
  }

  // ── Validate severity ─────────────────────────────────────────────────────
  if (severityParam !== null && !VALID_SEVERITIES.has(severityParam)) {
    return badRequest(`severity must be one of: ${[...VALID_SEVERITIES].join(', ')}`)
  }

  // ── Validate limit ────────────────────────────────────────────────────────
  let limit = 20
  if (limitParam !== null) {
    const parsed = Number(limitParam)
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
      return badRequest('limit must be an integer between 1 and 100')
    }
    limit = parsed
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabaseAdmin as any)
      .from('incidents')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId.trim())
      .order('detected_at', { ascending: false })
      .limit(limit)

    if (statusParam !== null) {
      query = query.eq('status', statusParam)
    }
    if (severityParam !== null) {
      query = query.eq('severity', severityParam)
    }

    const { data, error, count } = await query

    if (error) {
      console.error('[Incidents List API] DB error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({
      incidents: (data ?? []) as IncidentRow[],
      count:     count ?? 0,
    })
  } catch (err) {
    console.error('[Incidents List API] GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
