import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { auth } from '@/auth'
import { getRequestCorrelationId } from '@/lib/observability/correlation'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const corrId = getRequestCorrelationId(req)
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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
    console.error('[stripe/portal]', error, { corrId })
    const message = error instanceof Error ? error.message : 'Erro interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
