import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { getRequestCorrelationId } from '@/lib/observability/correlation'

export const runtime = 'nodejs'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const corrId = getRequestCorrelationId(req)
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 })
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret || webhookSecret === 'whsec_PLACEHOLDER') {
    console.error('[webhook] STRIPE_WEBHOOK_SECRET not configured — rejecting all webhook calls', { corrId })
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    console.error('[webhook] Signature verification failed:', err, { corrId })
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // ── Idempotency guard: reject duplicate Stripe event deliveries ─────────────
  const { data: existing } = await supabaseAdmin
    .from('learning_events')
    .select('id')
    .eq('event_type', `stripe:${event.id}`)
    .maybeSingle()
  if (existing) {
    console.log(`[webhook] Duplicate event ${event.id} — already processed, skipping`)
    return NextResponse.json({ received: true })
  }

  // Process business logic BEFORE recording idempotency key.
  // This ensures: if the handler crashes, the next Stripe retry will retry correctly.
  // Concurrent duplicate deliveries are handled by the SELECT check above (best-effort).
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode === 'subscription') {
          // Activate on paid completion OR trial start — mutually exclusive conditions
          if (session.payment_status === 'paid' || session.status === 'complete') {
            await activateSubscription(session)
          }
        }
        break
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        await updateSubscriptionStatus(sub)
        break
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        await deactivateSubscription(sub)
        break
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        await handlePaymentFailed(invoice)
        break
      }
    }
  } catch (err) {
    console.error('[webhook] Handler error:', err, { corrId })
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 })
  }

  // Record idempotency AFTER successful processing — retry-safe
  await supabaseAdmin
    .from('learning_events')
    .insert({ event_type: `stripe:${event.id}`, source_system: 'api' })

  return NextResponse.json({ received: true })
}

async function activateSubscription(session: Stripe.Checkout.Session) {
  const email = session.metadata?.customer_email || session.customer_email
  const plan = session.metadata?.plan || 'intelligence'
  const name = session.metadata?.customer_name || ''

  if (!email) return

  // Upsert contact com subscrição activa
  const { error } = await supabaseAdmin
    .from('contacts')
    .upsert(
      {
        email,
        name: name || undefined,
        source: 'stripe_subscription',
        intent: 'investor',
        subscription_plan: plan,
        subscription_status: 'active',
        stripe_customer_id: session.customer as string,
        stripe_subscription_id: session.subscription as string,
        subscribed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'email', ignoreDuplicates: false }
    )

  if (error) console.error('[webhook] Supabase upsert error:', error)

  console.log(`[webhook] Subscription activated: ${email} → ${plan}`)
}

async function updateSubscriptionStatus(sub: Stripe.Subscription) {
  const email = sub.metadata?.customer_email
  if (!email) return

  await supabaseAdmin
    .from('contacts')
    .update({
      subscription_status: sub.status,
      updated_at: new Date().toISOString(),
    })
    .eq('email', email)
}

async function deactivateSubscription(sub: Stripe.Subscription) {
  const email = sub.metadata?.customer_email
  if (!email) return

  await supabaseAdmin
    .from('contacts')
    .update({
      subscription_status: 'cancelled',
      subscription_plan: null,
      updated_at: new Date().toISOString(),
    })
    .eq('email', email)

  console.log(`[webhook] Subscription cancelled: ${email}`)
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  console.warn('[webhook] Payment failed for invoice:', invoice.id)
}
