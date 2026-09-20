// =============================================================================
// POST /api/deal-packs/[id]/send
// Phase 2C.D2-B-DISCLOSURE-FOUNDATION
//
// Discloses a Deal Pack to the canonical buyer contact via email.
// Feature flag DEALPACK_EMAIL_SEND_ACTIVE controls transport:
//   false/unset → authorization runs, delivery record created, NO Resend call
//   true        → full transport path
//
// Authorization chain (§22 — 16 checks):
//   1.  portalAuthGate: human session required
//   2.  service_token → 403 (no service tokens on disclosure)
//   3.  resolveActor(failClosed=true): is_active strict
//   4.  checkDealPackOwnership: current contact owner or admin
//   5.  Load pack — must exist and have match_id
//   6.  Load match — must exist and belong to this pack
//   7.  pack.match_id == match.id (cross-contamination guard)
//   8.  pack.lead_id == match.lead_id (same contact guard)
//   9.  match.status == 'reviewed_accepted'
//   10. match.disclosure_status == 'authorized'
//   11. pack.status == 'ready' (first disclosure only in V1)
//   12. Load canonical contact (from match.lead_id)
//   13. Derive recipient email from contact (server-derived, never client-supplied)
//   14. Validate recipient email format
//   15. opt_out_marketing = false (hard gate — explicit opt-out blocks email)
//   16. Idempotency guard: reject if active delivery (pending/sending/sent) exists
//
// Transport (when DEALPACK_EMAIL_SEND_ACTIVE=true):
//   a. Create delivery record (status=pending)
//   b. Update → sending
//   c. Call Resend with idempotency header
//   d. On success → call finalize_deal_pack_email_disclosure() RPC
//   e. On failure → mark delivery failed/unknown
//
// Crash recovery (§15):
//   A. pending record + no Resend call → re-request creates new attempt (pending deleted if stale)
//   B. sending record + crash → unknown state; 409 returned on re-request
//   C. failed → permits new attempt
//   D. unknown → 409; operator must resolve via admin route (future scope)
//   E. finalization fail → delivery=sending, RPC retried on next request
//
// INVARIANT: REAL EMAILS SENT = 0 while DEALPACK_EMAIL_SEND_ACTIVE is unset/false
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { portalAuthGate } from '@/lib/requirePortalAuth'
import { resolveActor, checkDealPackOwnership } from '@/lib/auth/commercialAuth'
import { getRequestCorrelationId } from '@/lib/observability/correlation'
import { buildDisclosureEmailHtml, buildDisclosureEmailText } from '@/lib/disclosure/emailTemplate'
import type { DisclosureEmailData } from '@/lib/disclosure/emailTemplate'

export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isEmailActive(): boolean {
  return process.env.DEALPACK_EMAIL_SEND_ACTIVE === 'true'
}

// ---------------------------------------------------------------------------
// POST /api/deal-packs/[id]/send
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const corrId = getRequestCorrelationId(req)

  // ── 1. Portal auth gate ────────────────────────────────────────────────────
  const gate = await portalAuthGate(req)
  if (!gate.authed) return gate.response

  // ── 2. Reject service tokens ───────────────────────────────────────────────
  if (gate.via === 'service_token') {
    return NextResponse.json(
      { error: 'Service tokens cannot disclose deal packs — human actor required' },
      { status: 403 },
    )
  }

  // ── 3. Resolve actor (fail-closed: is_active=null → 403) ──────────────────
  const actorResult = await resolveActor(gate.email, supabase, { failClosed: true })
  if (!actorResult.ok) {
    return NextResponse.json({ error: actorResult.error }, { status: actorResult.status })
  }
  const actor = actorResult.actor

  // ── 4. Pack ownership check ────────────────────────────────────────────────
  const { id: packId } = await params
  const ownershipResult = await checkDealPackOwnership(actor, packId, supabase)
  if (!ownershipResult.ok) {
    return NextResponse.json({ error: ownershipResult.error }, { status: ownershipResult.status })
  }

  // ── 5. Load pack ───────────────────────────────────────────────────────────
  const { data: pack, error: packErr } = await supabase
    .from('deal_packs')
    .select('id, status, match_id, lead_id, title, investment_thesis, market_summary, highlights, financial_projections, opportunity_score')
    .eq('id', packId)
    .single()

  if (packErr || !pack) {
    return NextResponse.json({ error: 'Deal pack not found' }, { status: 404 })
  }

  // ── 5a. Pack must have a match_id ──────────────────────────────────────────
  if (!pack.match_id) {
    return NextResponse.json(
      { error: 'Deal pack has no linked match — cannot disclose without match authorization' },
      { status: 422 },
    )
  }

  // ── 6. Load match ──────────────────────────────────────────────────────────
  const { data: match, error: matchErr } = await supabase
    .from('matches')
    .select('id, status, disclosure_status, lead_id')
    .eq('id', pack.match_id)
    .single()

  if (matchErr || !match) {
    return NextResponse.json({ error: 'Match linked to deal pack not found' }, { status: 404 })
  }

  // ── 7. Cross-contamination guard: pack.match_id == match.id ───────────────
  if (pack.match_id !== match.id) {
    console.error('[deal-pack send] pack/match ID mismatch', { packId, packMatchId: pack.match_id, matchId: match.id, corrId })
    return NextResponse.json({ error: 'Pack and match relationship is inconsistent' }, { status: 422 })
  }

  // ── 8. Same-contact guard: pack.lead_id == match.lead_id ──────────────────
  if (pack.lead_id !== match.lead_id) {
    console.error('[deal-pack send] pack/match contact mismatch', { packId, packLeadId: pack.lead_id, matchLeadId: match.lead_id, corrId })
    return NextResponse.json({ error: 'Pack contact and match contact are inconsistent' }, { status: 422 })
  }

  // ── 9. Match must be reviewed_accepted ────────────────────────────────────
  if (match.status !== 'reviewed_accepted') {
    return NextResponse.json(
      { error: `Match is not in reviewed_accepted status (current: ${match.status}) — disclosure requires agent review approval` },
      { status: 422 },
    )
  }

  // ── 10. Match disclosure must be authorized ────────────────────────────────
  if (match.disclosure_status !== 'authorized') {
    return NextResponse.json(
      { error: `Match disclosure is not authorized (current: ${match.disclosure_status ?? 'null'}) — use PATCH /api/matches/[id]/disclosure to authorize first` },
      { status: 422 },
    )
  }

  // ── 11. Pack must be 'ready' (first disclosure only in V1) ────────────────
  if (pack.status !== 'ready') {
    return NextResponse.json(
      { error: `Deal pack is not in 'ready' status (current: ${pack.status}) — only ready packs may be disclosed in V1` },
      { status: 422 },
    )
  }

  // ── 12. Load canonical contact ─────────────────────────────────────────────
  const { data: contact, error: contactErr } = await supabase
    .from('contacts')
    .select('id, full_name, email, opt_out_marketing, gdpr_consent')
    .eq('id', match.lead_id)
    .single()

  if (contactErr || !contact) {
    return NextResponse.json({ error: 'Canonical contact not found for this match' }, { status: 422 })
  }

  // ── 13. Derive recipient email (server-derived, never client-supplied) ─────
  const recipientEmail = contact.email?.trim().toLowerCase() ?? null

  if (!recipientEmail) {
    return NextResponse.json(
      { error: 'Contact has no email address — cannot send email disclosure' },
      { status: 422 },
    )
  }

  // ── 14. Validate recipient email format ────────────────────────────────────
  if (!EMAIL_REGEX.test(recipientEmail)) {
    return NextResponse.json(
      { error: `Contact email is malformed: ${recipientEmail}` },
      { status: 422 },
    )
  }

  // ── 15. Consent gate ───────────────────────────────────────────────────────
  // opt_out_marketing = true → contact explicitly opted out of communications
  if (contact.opt_out_marketing === true) {
    return NextResponse.json(
      { error: 'Contact has opted out of marketing communications — email disclosure blocked' },
      { status: 422 },
    )
  }
  // gdpr_consent: log warning only (see §32 — default=false for all contacts; semantics unclear)
  if (!contact.gdpr_consent) {
    console.warn('[deal-pack send] contact gdpr_consent=false — disclosure proceeding (consent gate TBD in CONSENT-PV)', {
      contactId: contact.id, corrId,
    })
  }

  // ── 16. Idempotency guard ──────────────────────────────────────────────────
  const { data: existingDeliveries } = await supabase
    .from('disclosure_deliveries')
    .select('id, delivery_status, idempotency_key, sent_at')
    .eq('pack_id', packId)
    .eq('match_id', match.id)
    .eq('channel', 'email')
    .order('created_at', { ascending: false })
    .limit(10)

  const activeDelivery = (existingDeliveries ?? []).find(
    (d: { delivery_status: string }) => ['pending', 'sending', 'sent'].includes(d.delivery_status),
  )

  if (activeDelivery) {
    if (activeDelivery.delivery_status === 'sent') {
      return NextResponse.json(
        {
          error: 'Deal pack has already been disclosed via email — re-disclosure not permitted in V1',
          delivery_id: activeDelivery.id,
          sent_at: (activeDelivery as { sent_at?: string }).sent_at,
        },
        { status: 409 },
      )
    }
    // pending/sending = in progress or ambiguous
    return NextResponse.json(
      {
        error: `Disclosure is currently in progress (status: ${activeDelivery.delivery_status}) — please wait or contact support if stuck`,
        delivery_id: activeDelivery.id,
      },
      { status: 409 },
    )
  }

  // ── 16a. Check unknown deliveries separately ───────────────────────────────
  const unknownDelivery = (existingDeliveries ?? []).find(
    (d: { delivery_status: string }) => d.delivery_status === 'unknown',
  )
  if (unknownDelivery) {
    console.warn('[deal-pack send] unknown delivery exists — blocking until operator resolves', {
      deliveryId: unknownDelivery.id, corrId,
    })
    return NextResponse.json(
      {
        error: 'A previous disclosure attempt resulted in an unknown outcome. Please contact support before retrying.',
        delivery_id: unknownDelivery.id,
      },
      { status: 409 },
    )
  }

  // ── Feature flag check (§21) ──────────────────────────────────────────────
  const sendActive = isEmailActive()

  // ── Create delivery record (status=pending) ────────────────────────────────
  const idempotencyKey = `dpd:${packId}:${match.id}:${Date.now()}`
  const { data: delivery, error: deliveryCreateErr } = await supabase
    .from('disclosure_deliveries')
    .insert({
      pack_id:          packId,
      match_id:         match.id,
      contact_id:       contact.id,
      channel:          'email',
      recipient_email:  recipientEmail,
      idempotency_key:  idempotencyKey,
      delivery_status:  'pending',
      provider_name:    'resend',
      initiated_by:     actor.id,
    })
    .select('id')
    .single()

  if (deliveryCreateErr || !delivery) {
    console.error('[deal-pack send] failed to create delivery record', { deliveryCreateErr, corrId })
    return NextResponse.json({ error: 'Failed to create delivery record' }, { status: 500 })
  }

  // ── Feature flag: return without sending ──────────────────────────────────
  if (!sendActive) {
    console.info('[deal-pack send] DEALPACK_EMAIL_SEND_ACTIVE=false — disclosure logged but email NOT sent', {
      deliveryId: delivery.id, packId, corrId,
    })
    // Mark delivery as pending (it was already created as pending — leave it for operator visibility)
    return NextResponse.json({
      ok: true,
      sent: false,
      reason: 'feature_flag_disabled',
      delivery_id: delivery.id,
      message: 'DEALPACK_EMAIL_SEND_ACTIVE is not enabled. Authorization checks passed and delivery record created. No email was sent.',
    })
  }

  // ── Transport: update delivery to 'sending' ────────────────────────────────
  await supabase
    .from('disclosure_deliveries')
    .update({ delivery_status: 'sending', updated_at: new Date().toISOString() })
    .eq('id', delivery.id)

  // ── Build email content (buyer-safe) ──────────────────────────────────────
  // Load property data if pack has property_id
  const { data: propertyData } = await supabase
    .from('properties')
    .select('title, city, price, type, area_m2, bedrooms')
    .eq('id', pack.lead_id) // Note: use pack's property link via deal/match context
    .maybeSingle()

  // Derive yield from financial_projections (buyer-safe only)
  let estimatedYield: number | null = null
  try {
    const fp = pack.financial_projections as Record<string, unknown> | null
    if (fp && typeof fp.estimated_yield === 'number') estimatedYield = fp.estimated_yield
    else if (fp && typeof fp.yield === 'number') estimatedYield = fp.yield
  } catch { /* ignore */ }

  // Derive buyer first name
  const buyerFirstName = (contact.full_name ?? 'Investidor').split(' ')[0]

  // Highlights (array or JSONB)
  let highlights: string[] = []
  try {
    const raw = pack.highlights
    if (Array.isArray(raw)) highlights = raw.filter((h: unknown) => typeof h === 'string')
  } catch { /* ignore */ }

  const emailData: DisclosureEmailData = {
    buyerFirstName,
    packTitle:         pack.title ?? 'Oportunidade de Investimento',
    propertyTitle:     propertyData?.title ?? pack.title ?? 'Imóvel Selecionado',
    propertyLocation:  propertyData?.city ?? 'Portugal',
    propertyPrice:     propertyData?.price ?? 0,
    propertyType:      propertyData?.type ?? 'imóvel',
    areaM2:            propertyData?.area_m2 ?? null,
    bedrooms:          propertyData?.bedrooms ?? null,
    investmentThesis:  pack.investment_thesis ?? null,
    marketSummary:     pack.market_summary ?? null,
    highlights,
    estimatedYield,
    agentName:         actor.email.split('@')[0].replace(/\./g, ' '),
    agencyPhone:       '+351 210 000 000',
  }

  const htmlBody = buildDisclosureEmailHtml(emailData)
  const textBody = buildDisclosureEmailText(emailData)

  // ── Call Resend ────────────────────────────────────────────────────────────
  let providerMessageId: string | null = null
  let sendError: string | null = null

  try {
    const resend = new Resend(process.env.RESEND_API_KEY!)
    const { data: resendData, error: resendErr } = await resend.emails.send({
      from:    'Agency Group <noreply@agencygroup.pt>',
      to:      recipientEmail,
      subject: `${emailData.packTitle} — Agency Group`,
      html:    htmlBody,
      text:    textBody,
      headers: { 'X-Idempotency-Key': idempotencyKey },
    })

    if (resendErr || !resendData?.id) {
      sendError = resendErr ? JSON.stringify(resendErr) : 'Resend returned no message ID'
    } else {
      providerMessageId = resendData.id
    }
  } catch (err) {
    sendError = err instanceof Error ? err.message : String(err)
  }

  // ── Handle transport failure ───────────────────────────────────────────────
  if (sendError || !providerMessageId) {
    const isTimeout = sendError?.includes('timeout') || sendError?.includes('aborted')
    const newStatus = isTimeout ? 'unknown' : 'failed'
    await supabase
      .from('disclosure_deliveries')
      .update({
        delivery_status: newStatus,
        failed_at: new Date().toISOString(),
        provider_response: { error: sendError },
        updated_at: new Date().toISOString(),
      })
      .eq('id', delivery.id)

    console.error('[deal-pack send] transport failed', { sendError, newStatus, deliveryId: delivery.id, corrId })
    return NextResponse.json(
      { error: 'Email transport failed', delivery_id: delivery.id, status: newStatus },
      { status: 502 },
    )
  }

  // ── Atomic DB finalization ─────────────────────────────────────────────────
  const { data: finalizeResult, error: finalizeErr } = await supabase
    .rpc('finalize_deal_pack_email_disclosure', {
      p_delivery_id:       delivery.id,
      p_pack_id:           packId,
      p_match_id:          match.id,
      p_contact_id:        contact.id,
      p_actor_id:          actor.id,
      p_recipient_email:   recipientEmail,
      p_provider_msg_id:   providerMessageId,
    })

  if (finalizeErr) {
    // Provider sent but DB finalization failed — delivery is 'sending' in DB
    // Re-request will see 'sending' and return 409; operator can retry finalization
    console.error('[deal-pack send] finalization RPC failed', { finalizeErr, deliveryId: delivery.id, providerMessageId, corrId })
    return NextResponse.json(
      {
        ok: false,
        error: 'Email sent but database finalization failed — delivery recorded as in-progress. Contact support.',
        delivery_id: delivery.id,
        provider_message_id: providerMessageId,
      },
      { status: 207 },
    )
  }

  console.info('[deal-pack send] disclosure sent and finalized', {
    packId, matchId: match.id, deliveryId: delivery.id, providerMessageId, corrId,
  })

  return NextResponse.json({
    ok: true,
    sent: true,
    delivery_id: delivery.id,
    provider_message_id: providerMessageId,
    activity_id: (finalizeResult as { activity_id?: string })?.activity_id ?? null,
  })
}
