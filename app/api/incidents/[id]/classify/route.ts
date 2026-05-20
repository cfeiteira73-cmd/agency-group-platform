// =============================================================================
// Agency Group — Incident Failure Classifier API Route
// app/api/incidents/[id]/classify/route.ts
//
// GET /api/incidents/:id/classify?with_causal_chain=true
//
// Returns ClassificationResult for the given incident.
// Optional: pass ?with_causal_chain=true to include propagation_path from the
// stored causal chain (fetched from DB metadata or reconstructed).
//
// Auth: Bearer INTERNAL_API_SECRET or Bearer ADMIN_SECRET
//
// TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse }     from 'next/server'
import { supabaseAdmin }                  from '@/lib/supabase'
import { classifyFailure }                from '@/lib/incidents/failureClassifier'
import type { IncidentRow }               from '@/lib/incidents/incidentIngestor'
import { safeCompare }                    from '@/lib/safeCompare'

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

// ─── Causal chain loader ──────────────────────────────────────────────────────

/**
 * Attempts to load a stored causal chain snapshot from the incident's
 * metadata (key: `causal_chain`).  Returns null when unavailable.
 * Never throws.
 */
function extractCausalChainFromMetadata(
  incident: IncidentRow,
): { propagation_path: string[] } | null {
  try {
    const chain = incident.causal_chain
    if (!chain || typeof chain !== 'object') return null
    const pathRaw = (chain as Record<string, unknown>)['propagation_path']
    if (!Array.isArray(pathRaw)) return null
    const path = pathRaw.filter((v): v is string => typeof v === 'string')
    return { propagation_path: path }
  } catch {
    return null
  }
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
    console.error('[incidents/classify] DB fetch failed:', message)
    return NextResponse.json({ error: 'Failed to retrieve incident' }, { status: 500 })
  }

  // ── Extract causal chain if available ─────────────────────────────────────

  const causalChain = extractCausalChainFromMetadata(incident)

  // ── Classify failure (fail-open — never throws) ───────────────────────────

  const result = await classifyFailure(incident, causalChain ?? undefined)

  return NextResponse.json(result)
}
