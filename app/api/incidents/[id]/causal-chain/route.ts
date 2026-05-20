// =============================================================================
// Agency Group — Incident Causal Chain API Route
// app/api/incidents/[id]/causal-chain/route.ts
//
// GET /api/incidents/:id/causal-chain?window_minutes=15
//
// Returns the full CausalChain for the given incident, reconstructed live
// from audit_log, runtime_events, and the graph engine.
//
// Auth: Bearer INTERNAL_API_SECRET or Bearer ADMIN_SECRET
//
// TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin }             from '@/lib/supabase'
import { reconstructCausalChain }    from '@/lib/incidents/causalReconstructor'
import type { IncidentRow }          from '@/lib/incidents/incidentIngestor'
import { safeCompare }               from '@/lib/safeCompare'

export const dynamic = 'force-dynamic'

// ─── Auth ─────────────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const token    = (req.headers.get('authorization') ?? '').replace('Bearer ', '')
  const internal = process.env.INTERNAL_API_SECRET
  const admin    = process.env.ADMIN_SECRET
  if (internal && safeCompare(token, internal)) return true
  if (admin    && safeCompare(token, admin))    return true
  return false
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(
  req:     NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Await params (Next.js 15 dynamic route params are async)
  const { id } = await context.params

  if (!id || id.trim() === '') {
    return NextResponse.json({ error: 'incident id is required' }, { status: 400 })
  }

  // ── Parse optional query params ────────────────────────────────────────────

  const sp              = req.nextUrl.searchParams
  const windowParam     = sp.get('window_minutes')
  const windowMinutes   = windowParam !== null ? parseInt(windowParam, 10) : 15

  if (isNaN(windowMinutes) || windowMinutes < 1 || windowMinutes > 1440) {
    return NextResponse.json(
      { error: 'window_minutes must be an integer between 1 and 1440' },
      { status: 400 },
    )
  }

  // ── Fetch incident from DB ─────────────────────────────────────────────────

  let incident: IncidentRow

  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('incidents')
      .select('*')
      .eq('incident_id', id)
      .single()

    if (error || !data) {
      const message = error?.message ?? 'Incident not found'
      return NextResponse.json({ error: message }, { status: 404 })
    }

    incident = data as IncidentRow
  } catch (err) {
    const message = err instanceof Error ? err.message : 'DB error'
    console.error('[incidents/causal-chain] DB fetch failed:', message)
    return NextResponse.json({ error: 'Failed to retrieve incident' }, { status: 500 })
  }

  // ── Reconstruct causal chain ───────────────────────────────────────────────

  // reconstructCausalChain never throws — fail-open by design
  const chain = await reconstructCausalChain(incident, windowMinutes)

  return NextResponse.json(chain)
}
