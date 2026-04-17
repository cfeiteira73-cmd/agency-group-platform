import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { customerId } = await req.json() as { customerId: string }

    if (!customerId) {
      return NextResponse.json({ error: 'customerId obrigatório' }, { status: 400 })
    }

    const origin = req.headers.get('origin') || 'https://agencygroup.pt'

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/investor-intelligence`,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('[stripe/portal]', error)
    const message = error instanceof Error ? error.message : 'Erro interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
