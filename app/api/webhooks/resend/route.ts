// =============================================================================
// Agency Group — POST /api/webhooks/resend
// Phase 2C.D2-B-DISCLOSURE-SAFETY-SR
//
// Receives verified Resend webhook events and updates transport truth.
// Uses svix signature verification via resend.webhooks.verify().
//
// Events handled:
//   email.delivered → delivery_status = 'delivered', delivered_at = event timestamp
//   email.bounced   → delivery_status = 'bounced',   bounced_at   = event timestamp
//   email.complained→ contacts.opt_out_marketing = TRUE (suppression signal)
//
// Invariants (permanent):
//   BOUNCE ≠ CONSENT WITHDRAWAL — never sets gdpr_consent = false
//   COMPLAINT → opt_out_marketing suppression only (not gdpr_consent)
//   delivered/bounced/complained ≠ buyer interest — no deal/visit/offer mutation
//   Duplicate events: idempotent (status already set → no-op)
//   Unknown provider_message_id → log + 200 (fail safe, no mutation)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import { getRequestCorrelationId } from '@/lib/observability/correlation'

export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest): Promise<NextResponse> {
  const corrId = getRequestCorrelationId(req)

  // ── Webhook secret ─────────────────────────────────────────────────────────
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('[resend-webhook] RESEND_WEBHOOK_SECRET not configured', { corrId })
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  // ── Read raw body ──────────────────────────────────────────────────────────
  const rawBody = await req.text()
  if (!rawBody) {
    return NextResponse.json({ error: 'Empty body' }, { status: 400 })
  }

  // ── Signature verification ─────────────────────────────────────────────────
  // resend.webhooks.verify() expects { id, timestamp, signature } (svix headers).
  // Extract them from the incoming request headers.
  const svixHeaders = {
    id:        req.headers.get('svix-id')        ?? '',
    timestamp: req.headers.get('svix-timestamp') ?? '',
    signature: req.headers.get('svix-signature') ?? '',
  }

  if (!svixHeaders.id || !svixHeaders.timestamp || !svixHeaders.signature) {
    console.warn('[resend-webhook] missing svix signature headers', { corrId })
    return NextResponse.json({ error: 'Missing webhook signature headers' }, { status: 401 })
  }

  const resend = new Resend(process.env.RESEND_API_KEY!)
  let event
  try {
    event = resend.webhooks.verify({
      payload:       rawBody,
      headers:       svixHeaders,
      webhookSecret,
    })
  } catch (err) {
    console.warn('[resend-webhook] signature verification failed', {
      corrId,
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 })
  }

  const eventType = event.type
  const now = new Date().toISOString()

  // ── email.delivered ────────────────────────────────────────────────────────
  if (eventType === 'email.delivered') {
    const emailId = event.data.email_id
    const deliveredAt = event.data.created_at ?? now

    const { data: delivery } = await supabase
      .from('disclosure_deliveries')
      .select('id, delivery_status')
      .eq('provider_message_id', emailId)
      .maybeSingle()

    if (!delivery) {
      console.info('[resend-webhook] delivered: no matching delivery (non-disclosure email or already unknown)', { emailId, corrId })
      return NextResponse.json({ ok: true, event: eventType, matched: false })
    }

    // Idempotent — already delivered
    if (delivery.delivery_status === 'delivered') {
      return NextResponse.json({ ok: true, event: eventType, idempotent: true })
    }

    await supabase
      .from('disclosure_deliveries')
      .update({
        delivery_status: 'delivered',
        delivered_at:    deliveredAt,
        updated_at:      now,
      })
      .eq('id', delivery.id)

    console.info('[resend-webhook] delivery confirmed', { deliveryId: delivery.id, emailId, corrId })
    return NextResponse.json({ ok: true, event: eventType, delivery_id: delivery.id })
  }

  // ── email.bounced ──────────────────────────────────────────────────────────
  if (eventType === 'email.bounced') {
    const emailId = event.data.email_id
    const bouncedAt = event.data.created_at ?? now

    const { data: delivery } = await supabase
      .from('disclosure_deliveries')
      .select('id, delivery_status')
      .eq('provider_message_id', emailId)
      .maybeSingle()

    if (!delivery) {
      console.info('[resend-webhook] bounced: no matching delivery', { emailId, corrId })
      return NextResponse.json({ ok: true, event: eventType, matched: false })
    }

    // Idempotent — already bounced
    if (delivery.delivery_status === 'bounced') {
      return NextResponse.json({ ok: true, event: eventType, idempotent: true })
    }

    // BOUNCE ≠ CONSENT WITHDRAWAL — only update transport status.
    // Do NOT set gdpr_consent = false. Historical first_disclosed_at remains.
    await supabase
      .from('disclosure_deliveries')
      .update({
        delivery_status:  'bounced',
        bounced_at:        bouncedAt,
        provider_response: {
          ...(delivery as Record<string, unknown>),
          bounce: 'email.bounced' in event.data ? (event.data as { bounce?: unknown }).bounce : undefined,
        },
        updated_at: now,
      })
      .eq('id', delivery.id)

    console.warn('[resend-webhook] delivery bounced — transport truth updated, consent NOT modified', {
      deliveryId: delivery.id, emailId, corrId,
    })
    return NextResponse.json({ ok: true, event: eventType, delivery_id: delivery.id })
  }

  // ── email.complained ───────────────────────────────────────────────────────
  if (eventType === 'email.complained') {
    const emailId = event.data.email_id
    const complainedAt = event.data.created_at ?? now

    // Correlate delivery to get contact_id
    const { data: delivery } = await supabase
      .from('disclosure_deliveries')
      .select('id, contact_id, delivery_status')
      .eq('provider_message_id', emailId)
      .maybeSingle()

    if (!delivery) {
      console.warn('[resend-webhook] complained: no matching delivery — recording timestamp only', { emailId, corrId })
      return NextResponse.json({ ok: true, event: eventType, matched: false })
    }

    // Idempotent — already complained
    if (delivery.delivery_status === 'bounced') {
      // Keep bounced if already there; update complained_at
    }

    // Update delivery with complaint timestamp
    await supabase
      .from('disclosure_deliveries')
      .update({ complained_at: complainedAt, updated_at: now })
      .eq('id', delivery.id)

    // COMPLAINT → opt_out_marketing suppression (explicit suppression signal)
    // Do NOT set gdpr_consent = false (complaint ≠ consent withdrawal)
    if (delivery.contact_id) {
      // Idempotent: if already true, no harm in setting again
      await supabase
        .from('contacts')
        .update({ opt_out_marketing: true, updated_at: now })
        .eq('id', delivery.contact_id)

      console.warn('[resend-webhook] spam complaint received — contact suppressed via opt_out_marketing=true', {
        deliveryId: delivery.id, contactId: delivery.contact_id, emailId, corrId,
      })
    }

    return NextResponse.json({ ok: true, event: eventType, delivery_id: delivery.id })
  }

  // ── Unhandled event type ───────────────────────────────────────────────────
  console.info('[resend-webhook] unhandled event type (no mutation)', { eventType, corrId })
  return NextResponse.json({ ok: true, event: eventType, handled: false })
}
