// =============================================================================
// POST /api/matches/[id]/disclose/manual
// Phase 2C.D2-B-DISCLOSURE-FOUNDATION
//
// Records that a Deal Pack was disclosed to the buyer through an offline or
// verbal channel (in-person meeting, physical print, phone presentation, etc.)
// WITHOUT sending any digital message from this system.
//
// This is NOT the same as an email disclosure (that is /api/deal-packs/[id]/send).
// Manual disclosure does NOT:
//   ✗ Send any email, WhatsApp, SMS, or digital communication
//   ✗ Change deal_packs.status (manual channel ≠ electronic transport)
//   ✗ Infer buyer interest or create a deal
//
// Manual disclosure DOES:
//   ✓ Insert an audit activity (deal_pack_disclosed_email NOT used — type='note')
//   ✓ Set matches.first_disclosed_at (COALESCE — once-set)
//   ✓ Require the same authorization chain as email disclosure
//   ✓ Require explicit confirmation from the actor (confirmation_text field)
//
// Authorization chain:
//   1. portalAuthGate → reject service_token
//   2. resolveActor(failClosed=true)
//   3. checkMatchOwnership (via match.lead_id)
//   4. match.status == 'reviewed_accepted'
//   5. match.disclosure_status == 'authorized'
//
// Request body:
//   { pack_id: string, method: 'in_person' | 'phone' | 'physical_print' | 'other',
//     notes: string, confirmation_text: 'I confirm this pack was disclosed offline' }
//
// INVARIANT: ZERO digital sends — this records an offline fact only.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { portalAuthGate } from '@/lib/requirePortalAuth'
import { resolveActor, checkMatchOwnership } from '@/lib/auth/commercialAuth'
import { getRequestCorrelationId } from '@/lib/observability/correlation'

export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const VALID_METHODS = ['in_person', 'phone', 'physical_print', 'other'] as const
type ManualMethod = typeof VALID_METHODS[number]

const REQUIRED_CONFIRMATION = 'I confirm this pack was disclosed offline'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const corrId = getRequestCorrelationId(req)

  // ── 1. Portal auth ─────────────────────────────────────────────────────────
  const gate = await portalAuthGate(req)
  if (!gate.authed) return gate.response

  // ── 2. Reject service tokens ───────────────────────────────────────────────
  if (gate.via === 'service_token') {
    return NextResponse.json(
      { error: 'Service tokens cannot record manual disclosures — human actor required' },
      { status: 403 },
    )
  }

  // ── 3. Resolve actor ───────────────────────────────────────────────────────
  const actorResult = await resolveActor(gate.email, supabase, { failClosed: true })
  if (!actorResult.ok) {
    return NextResponse.json({ error: actorResult.error }, { status: actorResult.status })
  }
  const actor = actorResult.actor

  // ── Parse + validate body ─────────────────────────────────────────────────
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { pack_id, method, notes, confirmation_text } = body as {
    pack_id?: string
    method?: string
    notes?: string
    confirmation_text?: string
  }

  if (!pack_id || typeof pack_id !== 'string') {
    return NextResponse.json({ error: 'pack_id is required' }, { status: 400 })
  }

  if (!method || !VALID_METHODS.includes(method as ManualMethod)) {
    return NextResponse.json(
      { error: `method must be one of: ${VALID_METHODS.join(', ')}` },
      { status: 400 },
    )
  }

  if (!notes || typeof notes !== 'string' || notes.trim().length < 10) {
    return NextResponse.json(
      { error: 'notes is required (minimum 10 characters) — describe how the pack was disclosed' },
      { status: 400 },
    )
  }

  // Explicit confirmation required (§46: "confirmation required")
  if (confirmation_text !== REQUIRED_CONFIRMATION) {
    return NextResponse.json(
      {
        error: 'confirmation_text is required',
        required: REQUIRED_CONFIRMATION,
        hint: 'Set confirmation_text to the exact string above to confirm offline disclosure',
      },
      { status: 400 },
    )
  }

  const { id: matchId } = await params

  // ── Load match ─────────────────────────────────────────────────────────────
  const { data: match, error: matchErr } = await supabase
    .from('matches')
    .select('id, status, disclosure_status, lead_id')
    .eq('id', matchId)
    .single()

  if (matchErr || !match) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 })
  }

  // ── Match ownership ────────────────────────────────────────────────────────
  const ownershipResult = await checkMatchOwnership(actor, match.lead_id, supabase)
  if (!ownershipResult.ok) {
    return NextResponse.json({ error: ownershipResult.error }, { status: ownershipResult.status })
  }

  // ── Match status gate ──────────────────────────────────────────────────────
  if (match.status !== 'reviewed_accepted') {
    return NextResponse.json(
      { error: `Match is not in reviewed_accepted status (current: ${match.status})` },
      { status: 422 },
    )
  }

  // ── Disclosure authorization gate ──────────────────────────────────────────
  if (match.disclosure_status !== 'authorized') {
    return NextResponse.json(
      { error: `Match disclosure is not authorized (current: ${match.disclosure_status ?? 'null'})` },
      { status: 422 },
    )
  }

  // ── Verify pack belongs to this match ──────────────────────────────────────
  const { data: pack, error: packErr } = await supabase
    .from('deal_packs')
    .select('id, match_id, lead_id, status')
    .eq('id', pack_id)
    .single()

  if (packErr || !pack) {
    return NextResponse.json({ error: 'Deal pack not found' }, { status: 404 })
  }

  if (pack.match_id !== matchId) {
    return NextResponse.json(
      { error: 'Deal pack is not linked to this match' },
      { status: 422 },
    )
  }

  if (pack.lead_id !== match.lead_id) {
    return NextResponse.json(
      { error: 'Deal pack contact and match contact are inconsistent' },
      { status: 422 },
    )
  }

  // ── Set first_disclosed_* on matches (COALESCE guard — once-set) ──────────
  const now = new Date().toISOString()

  // Only update if first_disclosed_at is not yet set (COALESCE semantics via .is filter)
  const { error: matchUpdateErr } = await supabase
    .from('matches')
    .update({
      first_disclosed_at:      now,
      first_disclosed_by:      actor.id,
      first_disclosed_channel: 'manual',
      updated_at:              now,
    })
    .eq('id', matchId)
    .is('first_disclosed_at', null)

  if (matchUpdateErr) {
    console.error('[manual disclose] match update error', { matchUpdateErr, corrId })
    // Non-fatal: activity insert is the primary record
  }

  // Insert activity (type='note' for manual offline disclosure)
  const { data: activity, error: activityErr } = await supabase
    .from('activities')
    .insert({
      contact_id:   match.lead_id,
      agent_id:     actor.id,
      type:         'note',
      match_id:     matchId,
      subject:      `Divulgação manual — ${method}`,
      body:         `Pack ${pack_id} divulgado offline via ${method}. Notas: ${notes.trim()}`,
      is_automated: false,
      occurred_at:  now,
      created_at:   now,
    })
    .select('id')
    .single()

  if (activityErr || !activity) {
    console.error('[manual disclose] activity insert error', { activityErr, corrId })
    return NextResponse.json({ error: 'Failed to record manual disclosure activity' }, { status: 500 })
  }

  console.info('[manual disclose] recorded', {
    matchId, packId: pack_id, method, activityId: activity.id, actorId: actor.id, corrId,
  })

  return NextResponse.json({
    ok: true,
    activity_id: activity.id,
    match_id: matchId,
    pack_id,
    method,
    recorded_at: now,
    message: 'Manual offline disclosure recorded. No digital communication was sent.',
  })
}
