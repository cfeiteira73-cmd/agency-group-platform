// =============================================================================
// Agency Group — PATCH /api/matches/[id]
// Phase 2C.D1-REVIEW — Human Match Review & Commercial Decision Layer
//
// Mutable fields: status, notes
// Machine-managed (immutable via this endpoint): match_score, breakdown,
//   match_reasons, explanation, similarity, priority_level, next_best_action,
//   match_weaknesses, lead_id, property_id, mandate_id, matched_by
//
// Section 25: SERVICE ROLE ≠ HUMAN AUTHORIZATION — service_token rejected.
// Section 14: AGENT ACCEPTS MATCH ≠ CREATE DEAL — no deal created here.
// Section 15: No email, WhatsApp, SMS, buyer-facing links, deal pack triggers.
// Section 28: contact_id for activity is derived from match.lead_id — not client.
// Section 29: agent_id/reviewed_by derived from authenticated server identity.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { portalAuthGate } from '@/lib/requirePortalAuth'

export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  pending:             ['reviewed_accepted', 'reviewed_rejected'],
  reviewed_accepted:   ['reviewed_rejected'],
  reviewed_rejected:   ['reviewed_accepted'],
}

const ACTIVITY_TYPE: Record<string, string> = {
  reviewed_accepted: 'match_agent_accepted',
  reviewed_rejected: 'match_agent_rejected',
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const gate = await portalAuthGate(req)
  if (!gate.authed) return gate.response

  // Section 25: service tokens are not human reviewers
  if (gate.via === 'service_token') {
    return NextResponse.json(
      { error: 'Service tokens cannot review matches — human actor required' },
      { status: 403 }
    )
  }

  const { id: matchId } = await params
  if (!matchId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(matchId)) {
    return NextResponse.json({ error: 'Invalid match id — must be a UUID' }, { status: 400 })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Body must be a JSON object' }, { status: 400 })
  }

  const rawBody = body as Record<string, unknown>

  // Section 27: only mutable fields accepted — strip everything else
  const newStatus = rawBody.status !== undefined
    ? (typeof rawBody.status === 'string' ? rawBody.status : null)
    : undefined
  const newNotes = rawBody.notes !== undefined
    ? (typeof rawBody.notes === 'string' || rawBody.notes === null ? rawBody.notes as string | null : undefined)
    : undefined

  if (newStatus === undefined && newNotes === undefined) {
    return NextResponse.json(
      { error: 'No mutable fields provided — allowed: status (string), notes (string|null)' },
      { status: 400 }
    )
  }

  if (newStatus !== null && newStatus !== undefined && !Object.keys(VALID_STATUS_TRANSITIONS).includes(newStatus)
    && !Object.values(VALID_STATUS_TRANSITIONS).flat().includes(newStatus)) {
    return NextResponse.json(
      { error: `Unknown status value: '${newStatus}'` },
      { status: 422 }
    )
  }

  // Fetch current match — get lead_id (Section 28) and current status for transition check
  const { data: current, error: fetchErr } = await supabase
    .from('matches')
    .select('id, status, lead_id, notes')
    .eq('id', matchId)
    .single()

  if (fetchErr || !current) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 })
  }

  // Validate status transition
  if (newStatus !== undefined && newStatus !== null) {
    if (newStatus === current.status) {
      // Section 11 idempotency: same status + no notes change = no-op
      if (newNotes === undefined) {
        return NextResponse.json({ match: current, activity: null, idempotent: true })
      }
    } else {
      const allowed = VALID_STATUS_TRANSITIONS[current.status as string]
      if (!allowed || !allowed.includes(newStatus)) {
        return NextResponse.json({
          error: `Invalid status transition: '${current.status}' → '${newStatus}'`,
          allowed_transitions: allowed ?? [],
        }, { status: 422 })
      }
    }
  }

  // Section 29: resolve reviewed_by UUID from authenticated email (never trust client)
  let reviewedBy: string | null = null
  const { data: userRow } = await supabase
    .from('users')
    .select('id')
    .eq('email', gate.email)
    .single()
  reviewedBy = userRow?.id ?? null

  // Build update payload
  const now = new Date().toISOString()
  const updateData: Record<string, unknown> = { updated_at: now }

  const statusChanged = newStatus !== undefined && newStatus !== null && newStatus !== current.status
  if (statusChanged) {
    updateData.status      = newStatus
    updateData.reviewed_at = now
    updateData.reviewed_by = reviewedBy
  }
  if (newNotes !== undefined) {
    updateData.notes = newNotes
  }

  const { data: updated, error: updateErr } = await supabase
    .from('matches')
    .update(updateData)
    .eq('id', matchId)
    .select()
    .single()

  if (updateErr || !updated) {
    return NextResponse.json(
      { error: 'Update failed', detail: updateErr?.message ?? 'Unknown error' },
      { status: 500 }
    )
  }

  // Insert activity event if status changed (Sections 13, 28, 29)
  let activity: Record<string, unknown> | null = null
  if (statusChanged) {
    const actType = ACTIVITY_TYPE[newStatus!]
    if (actType) {
      // Section 28: contact_id derived from match.lead_id — NOT from client
      const { data: act, error: actErr } = await supabase
        .from('activities')
        .insert({
          contact_id:   current.lead_id,
          agent_id:     reviewedBy,
          type:         actType,
          match_id:     matchId,
          subject:      `Match ${newStatus === 'reviewed_accepted' ? 'accepted' : 'rejected'} by agent`,
          is_automated: false,
          occurred_at:  now,
          created_at:   now,
        })
        .select()
        .single()

      if (!actErr && act) {
        activity = act as Record<string, unknown>
      }
    }
  }

  // Section 14: NO deal created. Section 15: NO outbound communications.
  return NextResponse.json({ match: updated, activity })
}
