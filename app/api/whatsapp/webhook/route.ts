import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'

export const runtime = 'nodejs'

// ─── Types ────────────────────────────────────────────────────────────────────

interface WAWebhookMessage {
  from: string
  id: string
  timestamp: string
  type: 'text' | 'image' | 'audio' | 'document' | 'location' | 'contacts'
  text?: { body: string }
}

interface WAWebhookEntry {
  id: string
  changes: Array<{
    value: {
      messaging_product: string
      metadata: { display_phone_number: string; phone_number_id: string }
      contacts?: Array<{ profile: { name: string }; wa_id: string }>
      messages?: WAWebhookMessage[]
      statuses?: Array<{ id: string; status: string; timestamp: string; recipient_id: string }>
    }
    field: string
  }>
}

// ─── GET: Webhook Verification ────────────────────────────────────────────────
// Meta calls this endpoint to verify the webhook URL

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log('[WhatsApp] Webhook verified')
    return new NextResponse(challenge, { status: 200 })
  }

  console.warn('[WhatsApp] Webhook verification failed — token mismatch')
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// ─── POST: Incoming Messages & Status Updates ─────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // ── Read raw body (needed for HMAC before parsing) ────────────────────────
    const rawBody = await req.text()

    // ── Validate Meta HMAC signature ─────────────────────────────────────────
    const appSecret = process.env.WHATSAPP_APP_SECRET
    if (appSecret) {
      const sig = req.headers.get('x-hub-signature-256')
      if (!sig) return NextResponse.json({ error: 'Missing signature' }, { status: 403 })
      const expected = 'sha256=' + createHmac('sha256', appSecret).update(rawBody).digest('hex')
      try {
        if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
          console.warn('[WhatsApp] Invalid signature — request rejected')
          return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
        }
      } catch {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
      }
    }

    const body = JSON.parse(rawBody) as { object: string; entry: WAWebhookEntry[] }

    // Validate it's a WhatsApp webhook
    if (body.object !== 'whatsapp_business_account') {
      return NextResponse.json({ error: 'Not a WhatsApp webhook' }, { status: 400 })
    }

    // ── Feature flag: Sofia OFF ───────────────────────────────────────────────
    // Quando WHATSAPP_ACTIVE=false: webhook recebe e regista no CRM, mas Sofia não responde
    const sofiaActive = process.env.WHATSAPP_ACTIVE === 'true'
    if (!sofiaActive) {
      console.log('[WhatsApp] Sofia inactiva (WHATSAPP_ACTIVE=false) — a registar mensagens mas sem resposta automática')
    }

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value

        // ── Handle incoming messages ──────────────────────────────────────────
        if (value.messages?.length) {
          for (const message of value.messages) {
            const from = message.from // Phone in E.164 format
            const senderName = value.contacts?.[0]?.profile?.name ?? 'Unknown'
            const text = message.text?.body ?? ''

            console.log(`[WhatsApp] Incoming from ${senderName} (${from}): ${text}${!sofiaActive ? ' [Sofia inactiva — só CRM]' : ''}`)

            // Auto-lead creation from inbound WhatsApp — sempre activo (independente de sofiaActive)
            // Extracts name + phone and upserts into CRM contacts
            if (message.type === 'text' && text.trim()) {
              await handleIncomingMessage({
                from,
                name: senderName,
                text,
                messageId: message.id,
              })
              // Sofia só responde quando WHATSAPP_ACTIVE=true
              // (resposta IA via sendWhatsApp fica aqui quando activares)
            }
          }
        }

        // ── Handle delivery/read status updates ───────────────────────────────
        if (value.statuses?.length) {
          for (const status of value.statuses) {
            console.log(`[WhatsApp] Message ${status.id} → ${status.status}`)
            // Could update message status in DB here
          }
        }
      }
    }

    // WhatsApp requires a 200 OK — any other response triggers retry storms
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[WhatsApp] Webhook error:', error)
    // Still return 200 to avoid Meta retrying endlessly
    return NextResponse.json({ success: true })
  }
}

// ─── Inbound Message Handler ──────────────────────────────────────────────────

async function handleIncomingMessage(params: {
  from: string
  name: string
  text: string
  messageId: string
}): Promise<void> {
  const { from, name, text } = params

  try {
    // Lazy import to avoid loading supabase on every request
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()

    // Upsert contact — phone is the unique key
    const { data: contact, error } = await supabase
      .from('contacts')
      .upsert({
        phone: from,
        nome: name,
        canal_origem: 'whatsapp_inbound',
        ultimo_contacto: new Date().toISOString(),
        notas: `Mensagem WhatsApp: "${text.slice(0, 500)}"`,
      }, { onConflict: 'phone' })
      .select('id')
      .single()

    if (error) {
      console.error('[WhatsApp] Failed to upsert contact:', error.message)
      return
    }

    console.log(`[WhatsApp] Contact upserted: id=${contact?.id}`)
  } catch (err) {
    console.error('[WhatsApp] handleIncomingMessage error:', err)
  }
}
