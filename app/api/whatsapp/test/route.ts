// =============================================================================
// AGENCY GROUP — WhatsApp Test Message API
// POST /api/whatsapp/test — send a test WhatsApp message
// AUTH: requires ADMIN_SECRET (Bearer or x-admin-secret header)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { safeCompare } from '@/lib/safeCompare'

export const runtime = 'nodejs'

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET ?? process.env.CRON_SECRET
  if (!secret) return false
  const incoming =
    req.headers.get('x-admin-secret') ??
    req.headers.get('authorization')?.replace('Bearer ', '') ??
    ''
  return safeCompare(incoming, secret)
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { to, message } = body as { to: string; message?: string }

    if (!to) {
      return NextResponse.json({ error: 'to (phone number) is required' }, { status: 400 })
    }

    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID
    const token = process.env.WHATSAPP_ACCESS_TOKEN
    const active = process.env.WHATSAPP_ACTIVE === 'true'

    if (!active || !phoneId || !token || token === 'PREENCHER') {
      return NextResponse.json({
        ok: false,
        error: 'WhatsApp not configured',
        config: {
          WHATSAPP_ACTIVE: process.env.WHATSAPP_ACTIVE,
          WHATSAPP_PHONE_NUMBER_ID: phoneId ? `${phoneId.slice(0, 6)}...` : 'missing',
          WHATSAPP_ACCESS_TOKEN: token === 'PREENCHER' ? 'NOT SET' : token ? 'SET' : 'missing',
        }
      }, { status: 503 })
    }

    const testMsg = message || `🏡 Agency Group — Teste de integração WhatsApp. Sistema operacional! ${new Date().toLocaleTimeString('pt-PT')}`

    const res = await fetch(`https://graph.facebook.com/v18.0/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: to.replace(/[^0-9]/g, ''),
        type: 'text',
        text: { body: testMsg }
      })
    })

    const data = await res.json()

    if (res.ok) {
      return NextResponse.json({
        ok: true,
        message_id: data.messages?.[0]?.id,
        to,
        sent_at: new Date().toISOString(),
      })
    } else {
      return NextResponse.json({
        ok: false,
        error: data.error?.message || 'Meta API error',
        meta_error: data.error,
      }, { status: res.status })
    }
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const token = process.env.WHATSAPP_ACCESS_TOKEN
  const active = process.env.WHATSAPP_ACTIVE

  return NextResponse.json({
    configured: active === 'true' && !!phoneId && !!token && token !== 'PREENCHER',
    WHATSAPP_ACTIVE: active || 'false',
    phone_id: phoneId ? `${phoneId.slice(0, 4)}...` : 'NOT SET',
    token_set: token && token !== 'PREENCHER' ? true : false,
    webhook_url: `${process.env.NEXTAUTH_URL || 'https://your-domain.com'}/api/whatsapp/webhook`,
    verify_token_configured: !!process.env.WHATSAPP_VERIFY_TOKEN,
    test_with: 'POST /api/whatsapp/test { "to": "+351912345678", "message": "Test" }',
  })
}
