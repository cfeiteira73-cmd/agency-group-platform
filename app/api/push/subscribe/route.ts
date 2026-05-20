import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getRequestCorrelationId } from '@/lib/observability/correlation'
import { requirePortalAuth } from '@/lib/requirePortalAuth'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const corrId = getRequestCorrelationId(req)
  const auth = await requirePortalAuth(req)
  if (!auth.ok) return auth.response
  try {
    const subscription = await req.json()

    if (!subscription?.endpoint) {
      return NextResponse.json({ error: 'Invalid subscription object' }, { status: 400 })
    }

    const supabase = await createClient()

    // Get user from session cookie — portal uses ag_portal cookie auth
    // Store subscription linked to endpoint (unique per browser)
    const { error } = await supabase.from('push_tokens').upsert({
      token: JSON.stringify(subscription),
      platform: 'web',
      endpoint: subscription.endpoint,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'endpoint' })

    if (error) {
      console.error('[Push] Subscribe error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Push] Subscribe route error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requirePortalAuth(req)
  if (!auth.ok) return auth.response
  try {
    const { endpoint } = await req.json()
    if (!endpoint) return NextResponse.json({ error: 'Endpoint required' }, { status: 400 })

    const supabase = await createClient()
    await supabase.from('push_tokens').delete().eq('endpoint', endpoint)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Push] Unsubscribe error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
