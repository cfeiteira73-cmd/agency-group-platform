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
//   ✓ Record atomic audit via record_manual_disclosure() RPC (match + activity in one TX)
//   ✓ Insert activity with type='match_disclosed_manual' (explicit semantic event — §22)
//   ✓ Set matches.first_disclosed_at via COALESCE (once-set)
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

  // ── Atomic record via RPC (§25 — matches + activity in one transaction) ─────
  // record_manual_disclosure() atomically:
  //   1. COALESCE-updates matches.first_disclosed_at/by/channel (once-set)
  //   2. Inserts activity with type='match_disclosed_manual' (§22 — explicit semantic)
  const now = new Date().toISOString()

  const { data: rpcResult, error: rpcErr } = await supabase
    .rpc('record_manual_disclosure', {
      p_match_id:   matchId,
      p_pack_id:    pack_id,
      p_contact_id: match.lead_id,
      p_actor_id:   actor.id,
      p_method:     method,
      p_notes:      notes.trim(),
      p_now:        now,
    })

  if (rpcErr || !rpcResult) {
    console.error('[manual disclose] record_manual_disclosure RPC failed', { rpcErr, corrId })
    return NextResponse.json({ error: 'Failed to record manual disclosure' }, { status: 500 })
  }

  const { activity_id } = rpcResult as { activity_id: string; recorded_at: string }

  console.info('[manual disclose] recorded via RPC', {
    matchId, packId: pack_id, method, activityId: activity_id, actorId: actor.id, corrId,
  })

  return NextResponse.json({
    ok: true,
    activity_id,
    match_id: matchId,
    pack_id,
    method,
    recorded_at: now,
    message: 'Manual offline disclosure recorded. No digital communication was sent.',
  })
}
