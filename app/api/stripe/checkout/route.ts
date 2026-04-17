import { NextRequest, NextResponse } from 'next/server'
import { stripe, PLANS, PlanKey } from '@/lib/stripe'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { plan, email, name } = body as { plan: PlanKey; email: string; name: string }

    if (!plan || !PLANS[plan]) {
      return NextResponse.json({ error: 'Plano inválido' }, { status: 400 })
    }
    if (!email) {
      return NextResponse.json({ error: 'Email obrigatório' }, { status: 400 })
    }

    const planConfig = PLANS[plan]
    const origin = req.headers.get('origin') || 'https://agencygroup.pt'

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: planConfig.currency,
            product_data: {
              name: planConfig.name,
              description: planConfig.features.join(' · '),
              metadata: { plan },
            },
            unit_amount: planConfig.price,
            recurring: { interval: planConfig.interval },
          },
          quantity: 1,
        },
      ],
      metadata: {
        plan,
        customer_name: name || '',
        customer_email: email,
      },
      subscription_data: {
        metadata: {
          plan,
          customer_email: email,
          customer_name: name || '',
        },
        trial_period_days: 14,
      },
      success_url: `${origin}/investor-intelligence/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/investor-intelligence?cancelled=true`,
      locale: 'pt',
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
    })

    return NextResponse.json({ url: session.url, sessionId: session.id })
  } catch (error) {
    console.error('[stripe/checkout]', error)
    const message = error instanceof Error ? error.message : 'Erro interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
