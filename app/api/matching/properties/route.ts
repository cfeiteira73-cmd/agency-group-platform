// =============================================================================
// Agency Group — CRM Matching Properties
// POST /api/matching/properties
//
// Phase 2C.C1b — CRM Agent Matching Experience
//
// Accepts { contact_id: number } from authenticated portal agents.
// Server fetches the canonical contact and forwards to match-buyer with
// trigger_deal_pack=false always (INVARIANT: no automatic deal-pack).
// Returns enriched DTO with data_readiness for agent consumption.
//
// INVARIANTS:
//   trigger_deal_pack = false always (never auto-triggers deal packs)
//   MATCH FOUND ≠ PROPERTY DISCLOSED (disclosure requires agent decision)
//   Off-market properties are scored (MATCH FOUND ≠ DISCLOSED)
//   PORTAL_API_SECRET never sent to browser (proxy pattern)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { portalAuthGate } from '@/lib/requirePortalAuth'
import { getRequestCorrelationId } from '@/lib/observability/correlation'

export const runtime    = 'nodejs'
export const maxDuration = 30

export async function POST(req: NextRequest): Promise<NextResponse> {
  const corrId = getRequestCorrelationId(req)
  const gate   = await portalAuthGate(req)
  if (!gate.authed) return gate.response

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Request body must be a JSON object' }, { status: 400 })
  }
  const parsed = body as Record<string, unknown>

  const rawId    = parsed.contact_id
  const contactId =
    typeof rawId === 'number' ? rawId
    : typeof rawId === 'string' ? parseInt(rawId, 10)
    : NaN

  if (!contactId || isNaN(contactId) || contactId <= 0) {
    return NextResponse.json(
      { error: 'contact_id is required and must be a positive integer' },
      { status: 400 }
    )
  }

  const secret = process.env.PORTAL_API_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Matching service not configured' }, { status: 503 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.agencygroup.pt'

  try {
    const res = await fetch(`${baseUrl}/api/automation/match-buyer`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${secret}`,
        'x-agent-email': gate.email,
      },
      body: JSON.stringify({
        lead_id:           contactId,
        trigger_deal_pack: false,  // INVARIANT: trigger_deal_pack = false always (Phase 2C.C1b)
      }),
    })

    const matchData = await res.json() as Record<string, unknown>

    if (!res.ok) {
      console.error('[matching/properties] match-buyer error:', {
        corrId, status: res.status, error: matchData.error,
      })
      const status = typeof res.status === 'number' && res.status >= 400 && res.status < 600
        ? res.status : 502
      return NextResponse.json({ error: 'Matching service error' }, { status })
    }

    // ── Build data_readiness from contact_profile_used ─────────────────────
    const profile = (matchData.contact_profile_used ?? {}) as {
      zonas?:      string[] | null
      tipos?:      string[] | null
      budget_min?: number | null
      budget_max?: number | null
      quartos_min?: number | null
    }
    const zonas      = Array.isArray(profile.zonas) ? profile.zonas : []
    const tipos      = Array.isArray(profile.tipos) ? profile.tipos : []
    const hasBudget  = profile.budget_min != null || profile.budget_max != null
    const hasQuartos = profile.quartos_min != null

    const knownCriteria:   string[] = []
    const unknownCriteria: string[] = []

    ;(zonas.length > 0   ? knownCriteria : unknownCriteria).push('Zona')
    ;(tipos.length > 0   ? knownCriteria : unknownCriteria).push('Tipo')
    ;(hasBudget          ? knownCriteria : unknownCriteria).push('Orçamento')
    ;(hasQuartos         ? knownCriteria : unknownCriteria).push('Quartos')

    const total       = knownCriteria.length + unknownCriteria.length
    const knownRatio  = total > 0 ? knownCriteria.length / total : 0
    const completeness: 'high' | 'medium' | 'limited' =
      knownRatio >= 0.75 ? 'high' : knownRatio >= 0.5 ? 'medium' : 'limited'

    return NextResponse.json({
      matches:        Array.isArray(matchData.matches) ? matchData.matches : [],
      data_readiness: {
        known_criteria:   knownCriteria,
        unknown_criteria: unknownCriteria,
        completeness,
      },
      summary: {
        total_evaluated: matchData.total_properties_evaluated ?? 0,
        algorithm:       matchData.algorithm ?? 'v1',
        generated_at:    matchData.generated_at ?? new Date().toISOString(),
        persist_summary: matchData.persist_summary ?? {},
      },
      correlation_id: corrId,
    }, { headers: { 'x-correlation-id': corrId } })

  } catch (err) {
    console.error('[matching/properties] Error:', err, { corrId })
    return NextResponse.json({ error: 'Matching service unavailable' }, { status: 502 })
  }
}
