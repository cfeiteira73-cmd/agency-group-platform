// =============================================================================
// Agency Group — Incident Impact API Route
// app/api/incidents/[id]/impact/route.ts
//
// GET /api/incidents/:id/impact
//
// Returns IncidentImpact for the given incident — quantified economic impact
// including revenue loss, cost overruns, AI/infra spikes, and recovery cost.
//
// Auth: Bearer INTERNAL_API_SECRET or Bearer ADMIN_SECRET
//
// TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin }              from '@/lib/supabase'
import { analyzeImpact }              from '@/lib/incidents/impactAnalyzer'
import type { IncidentRow }           from '@/lib/incidents/incidentIngestor'
import { safeCompare }                from '@/lib/safeCompare'

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

  const { id } = await context.params

  if (!id || id.trim() === '') {
    return NextResponse.json({ error: 'incident id is required' }, { status: 400 })
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
    console.error('[incidents/impact] DB fetch failed:', message)
    return NextResponse.json({ error: 'Failed to retrieve incident' }, { status: 500 })
  }

  // ── Analyse impact (fail-open — never throws) ─────────────────────────────

  const impact = await analyzeImpact(incident)

  return NextResponse.json(impact)
}
