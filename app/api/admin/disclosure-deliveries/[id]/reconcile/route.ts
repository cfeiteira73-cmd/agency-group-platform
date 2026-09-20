// =============================================================================
// Agency Group — PATCH /api/admin/disclosure-deliveries/[id]/reconcile
// Phase 2C.D2-B-DISCLOSURE-SAFETY-SR
//
// Admin-only manual reconciliation for disclosure deliveries stuck in
// 'sending' or 'unknown' states where transport truth is ambiguous.
//
// Auth:    human actor only (admin role required, service_token rejected)
// Body:    { resolution: 'confirmed_sent' | 'confirmed_failed', reason: string,
//            provider_message_id?: string }
//
// confirmed_sent  → calls finalize_deal_pack_email_disclosure RPC (atomic)
//                   Does NOT re-send. Records who confirmed and why.
// confirmed_failed→ marks delivery as 'failed' (retryable). Records audit note.
//                   Does NOT erase history. Does NOT modify consent.
//
// Invariants (permanent):
//   Only 'sending' and 'unknown' deliveries may be reconciled.
//   confirmed_sent requires provider_message_id (in body or already on delivery).
//   Reconciliation does NOT send email. DEALPACK_EMAIL_SEND_ACTIVE irrelevant.
//   Audit note recorded in provider_response JSONB.
// =============================================================================

import { NextRequest, NextResponse }           from 'next/server'
import { createClient }                        from '@supabase/supabase-js'
import { portalAuthGate }                      from '@/lib/requirePortalAuth'
import { resolveActor }                        from '@/lib/auth/commercialAuth'
import { getRequestCorrelationId }             from '@/lib/observability/correlation'

export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

type Resolution = 'confirmed_sent' | 'confirmed_failed'

interface ReconcileBody {
  resolution:           Resolution
  reason:               string
  provider_message_id?: string
}

export async function PATCH(
  req:     NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const corrId     = getRequestCorrelationId(req)
  const deliveryId = params.id

  // ── Auth gate ──────────────────────────────────────────────────────────────
  const gate = await portalAuthGate(req)
  if (!gate.authed) return gate.response

  // Service tokens must not reconcile — requires a human admin
  if (gate.via === 'service_token') {
    return NextResponse.json(
      { error: 'Service tokens cannot reconcile deliveries — human admin actor required' },
      { status: 403 },
    )
  }

  // Resolve actor (fail-closed: is_active=NULL → denied)
  const actorResult = await resolveActor(gate.email, supabase, { failClosed: true })
  if (!actorResult.ok) {
    return NextResponse.json({ error: actorResult.error }, { status: actorResult.status })
  }
  const actor = actorResult.actor

  // Admin only
  if (!actor.isAdmin) {
    return NextResponse.json(
      { error: 'Delivery reconciliation requires admin role' },
      { status: 403 },
    )
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: ReconcileBody
  try {
    body = await req.json() as ReconcileBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { resolution, reason, provider_message_id: bodyProviderId } = body

  if (resolution !== 'confirmed_sent' && resolution !== 'confirmed_failed') {
    return NextResponse.json(
      { error: "resolution must be 'confirmed_sent' or 'confirmed_failed'" },
      { status: 400 },
    )
  }
  if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
    return NextResponse.json(
      { error: 'reason is required (min 5 characters) — describe the evidence for this reconciliation' },
      { status: 400 },
    )
  }

  // ── Load delivery ──────────────────────────────────────────────────────────
  const { data: delivery, error: fetchErr } = await supabase
    .from('disclosure_deliveries')
    .select('id, delivery_status, pack_id, match_id, contact_id, recipient_email, provider_message_id, initiated_by, provider_response')
    .eq('id', deliveryId)
    .maybeSingle()

  if (fetchErr) {
    console.error('[reconcile] delivery fetch error', { deliveryId, error: fetchErr, corrId })
    return NextResponse.json({ error: 'Delivery lookup failed' }, { status: 500 })
  }
  if (!delivery) {
    return NextResponse.json({ error: 'Delivery not found' }, { status: 404 })
  }

  // Only 'sending' and 'unknown' can be reconciled
  if (delivery.delivery_status !== 'sending' && delivery.delivery_status !== 'unknown') {
    return NextResponse.json(
      {
        error: `Delivery is in '${delivery.delivery_status}' state — only 'sending' and 'unknown' deliveries can be reconciled`,
        delivery_status: delivery.delivery_status,
      },
      { status: 409 },
    )
  }

  const now = new Date().toISOString()

  // ── Audit payload ──────────────────────────────────────────────────────────
  // Appended to provider_response JSONB — preserves full audit trail
  const auditNote = {
    reconciled_by:      actor.id,
    reconciled_email:   actor.email,
    reconciled_at:      now,
    resolution,
    reason:             reason.trim(),
    prior_status:       delivery.delivery_status,
  }

  // ── confirmed_sent ─────────────────────────────────────────────────────────
  if (resolution === 'confirmed_sent') {
    const providerMessageId = bodyProviderId?.trim() || delivery.provider_message_id

    if (!providerMessageId) {
      return NextResponse.json(
        { error: 'confirmed_sent requires provider_message_id (supply in body or ensure it is already on the delivery)' },
        { status: 400 },
      )
    }

    // Atomic commercial finalization (same RPC as successful send path)
    // Does NOT re-send. Admin is confirming the provider already accepted the email.
    const { data: finalizeResult, error: finalizeErr } = await supabase
      .rpc('finalize_deal_pack_email_disclosure', {
        p_delivery_id:       delivery.id,
        p_pack_id:           delivery.pack_id,
        p_match_id:          delivery.match_id,
        p_contact_id:        delivery.contact_id,
        p_actor_id:          actor.id,
        p_recipient_email:   delivery.recipient_email,
        p_provider_msg_id:   providerMessageId,
      })

    if (finalizeErr) {
      console.error('[reconcile] finalization RPC failed', {
        deliveryId,
        finalizeErr,
        providerMessageId,
        corrId,
      })
      return NextResponse.json(
        { error: 'Finalization RPC failed — delivery state unchanged', detail: finalizeErr.message },
        { status: 500 },
      )
    }

    // Append audit note to provider_response
    const existingResponse = (delivery.provider_response as Record<string, unknown>) ?? {}
    await supabase
      .from('disclosure_deliveries')
      .update({
        provider_message_id: providerMessageId,
        provider_response:   { ...existingResponse, reconciliation: auditNote },
        updated_at:          now,
      })
      .eq('id', delivery.id)

    console.info('[reconcile] confirmed_sent finalized', {
      deliveryId, providerMessageId, adminId: actor.id, corrId,
    })

    return NextResponse.json({
      ok:         true,
      resolution: 'confirmed_sent',
      delivery_id: delivery.id,
      provider_message_id: providerMessageId,
      activity_id: (finalizeResult as { activity_id?: string })?.activity_id ?? null,
    })
  }

  // ── confirmed_failed ───────────────────────────────────────────────────────
  // Evidence confirms provider did NOT accept/send. Delivery becomes retryable.
  // Does NOT erase history, does NOT modify consent.
  const existingResponse = (delivery.provider_response as Record<string, unknown>) ?? {}
  const { error: updateErr } = await supabase
    .from('disclosure_deliveries')
    .update({
      delivery_status:  'failed',
      failed_at:         now,
      provider_response: { ...existingResponse, reconciliation: auditNote },
      updated_at:        now,
    })
    .eq('id', delivery.id)

  if (updateErr) {
    console.error('[reconcile] confirmed_failed update error', { deliveryId, updateErr, corrId })
    return NextResponse.json({ error: 'Delivery update failed' }, { status: 500 })
  }

  console.info('[reconcile] confirmed_failed recorded', {
    deliveryId, adminId: actor.id, corrId,
  })

  return NextResponse.json({
    ok:          true,
    resolution:  'confirmed_failed',
    delivery_id: delivery.id,
    retryable:   true,
  })
}
