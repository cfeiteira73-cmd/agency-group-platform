import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

export const runtime = 'nodejs'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 })
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret || webhookSecret === 'whsec_PLACEHOLDER') {
    console.warn('[webhook] STRIPE_WEBHOOK_SECRET not configured — skipping verification')
    return NextResponse.json({ received: true })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    console.error('[webhook] Signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode === 'subscription' && session.payment_status === 'paid') {
          await activateSubscription(session)
        }
        // trial started — also activate access
        if (session.mode === 'subscription' && session.status === 'complete') {
          await activateSubscription(session)
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
    console.error('[webhook] Handler error:', err)
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 })
  }

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
