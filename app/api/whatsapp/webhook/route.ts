import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import Anthropic from '@anthropic-ai/sdk'
import { sendWhatsApp } from '@/lib/whatsapp/client'
import { withAI } from '@/lib/ops/withAI'
import { recordCausalStep } from '@/lib/observability/causalTrace'

// Normal WhatsApp webhook payloads are <10 KB.
// Reject oversized payloads before req.text() to prevent memory exhaustion.
const MAX_BODY_BYTES = 128 * 1024  // 128 KB — generous headroom, stops payload-flooding

export const runtime = 'nodejs'

// ─── Redis dedup — prevent double-processing Meta retries ────────────────────
// Meta's webhook delivery is at-least-once; the same message.id can arrive
// multiple times if our 200 is delayed.  SET NX EX marks each id as seen for
// 1 h.  Fail-open when Upstash is not configured (dev / CI).

async function isMessageDuplicate(messageId: string): Promise<boolean> {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return false   // fail-open: no Redis → always process

  try {
    const key = `wa:msg:${messageId}`
    const res = await fetch(`${url}/pipeline`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      // SET key 1 NX EX 3600  — "OK" means first write (new), null means already exists
      body:    JSON.stringify([['SET', key, '1', 'EX', '3600', 'NX']]),
    })
    if (!res.ok) return false  // Redis error → fail-open
    const [cmd] = await res.json() as [{ result: string | null }]
    // result === "OK"  → key was just created → NOT a duplicate
    // result === null  → key already existed  → IS  a duplicate
    return cmd?.result !== 'OK'
  } catch {
    return false  // network error → fail-open
  }
}

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
  const challenge = searchParams.get('hub.challenge') ?? ''

  // Guard against oversized challenge (prevents memory amplification)
  if (challenge.length > 512) {
    return new NextResponse('Bad Request', { status: 400 })
  }

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN ?? ''
  const tokenBuf = Buffer.from(token ?? '')
  const expectedBuf = Buffer.from(verifyToken)
  if (mode === 'subscribe' && verifyToken.length > 0 && tokenBuf.length === expectedBuf.length && timingSafeEqual(tokenBuf, expectedBuf)) {
    console.log('[WhatsApp] Webhook verified')
    return new NextResponse(challenge, { status: 200 })
  }

  console.warn('[WhatsApp] Webhook verification failed — token mismatch')
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// ─── POST: Incoming Messages & Status Updates ─────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // ── Payload size guard — BEFORE reading body ──────────────────────────────
    // Content-Length may be omitted by proxies; the guard is best-effort.
    // Without this check, a large payload would be fully buffered into memory
    // before HMAC validation runs, enabling memory-exhaustion attacks.
    const contentLengthHeader = req.headers.get('content-length')
    if (contentLengthHeader !== null) {
      const byteLen = parseInt(contentLengthHeader, 10)
      if (!isNaN(byteLen) && byteLen > MAX_BODY_BYTES) {
        console.warn(`[WhatsApp] Payload too large: ${byteLen} bytes — rejecting before body read`)
        return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
      }
    }

    // ── Read raw body (needed for HMAC before parsing) ────────────────────────
    const rawBody = await req.text()

    // Secondary size check on actual body length (covers missing Content-Length header)
    if (rawBody.length > MAX_BODY_BYTES) {
      console.warn(`[WhatsApp] Body too large after read: ${rawBody.length} bytes — rejecting`)
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
    }

    // ── Validate Meta HMAC signature ─────────────────────────────────────────
    const appSecret = process.env.WHATSAPP_APP_SECRET
    if (!appSecret) {
      console.error('[WhatsApp] WHATSAPP_APP_SECRET not configured — rejecting request')
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 })
    }
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

    const tenantId = req.headers.get('x-tenant-id') ?? 'agency-group'

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value

        // ── Handle incoming messages ──────────────────────────────────────────
        if (value.messages?.length) {
          for (const message of value.messages) {
            const from = message.from // Phone in E.164 format
            const senderName = value.contacts?.[0]?.profile?.name ?? 'Unknown'
            const rawText = message.text?.body ?? ''
            // Sanitize against prompt injection attacks
            const text = rawText
              .slice(0, 2000)
              .replace(/\[INST\]|\[\/INST\]|<\|im_start\|>|<\|im_end\|>|<\|system\|>/gi, '[filtered]')
              .replace(/###\s*(System|Human|Assistant|User):/gi, '[filtered]')
              .trim()

            // GDPR compliant: log only truncated identifier, never full phone/name
            const phoneHash = from ? `***${from.slice(-4)}` : 'unknown'
            console.log(`[WhatsApp] Incoming from contact (${phoneHash})${!sofiaActive ? ' [Sofia inactiva — só CRM]' : ''}`)

            // Dedup: skip if Meta is re-delivering a message we already processed
            if (await isMessageDuplicate(message.id)) {
              console.log(`[WhatsApp] Duplicate message ${message.id} — skipping`)
              continue
            }

            // Auto-lead creation from inbound WhatsApp — sempre activo (independente de sofiaActive)
            // Extracts name + phone and upserts into CRM contacts
            if (message.type === 'text' && text.trim()) {
              // CRM upsert — always active
              await handleIncomingMessage({
                from,
                name: senderName,
                text,
                messageId: message.id,
                tenantId,
              })

              // Sofia auto-response — only when WHATSAPP_ACTIVE=true
              if (sofiaActive) {
                void generateAndSendSofiaReply({ to: from, name: senderName, text, tenantId })
              }
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

// ─── Intent Classification ────────────────────────────────────────────────────

type MessageIntent =
  | 'price_inquiry'
  | 'visit_request'
  | 'document_request'
  | 'offer_inquiry'
  | 'general'

function classifyIntent(text: string): MessageIntent {
  const lower = text.toLowerCase()
  if (/\bpre[çc]o|price|valeur|valor|custo|quanto custa|how much|combien\b/i.test(lower)) {
    return 'price_inquiry'
  }
  if (/\bvisita|visit|visite|ver o im[oó]vel|schedule|agend|marcar\b/i.test(lower)) {
    return 'visit_request'
  }
  if (/\bdocument[ao]s?|docs|certid[aã]o|registr[ao]|caderneta|contrato|cpcv\b/i.test(lower)) {
    return 'document_request'
  }
  if (/\bproposta|offer|offre|oferta|comprar|buy|acheter|negoci\b/i.test(lower)) {
    return 'offer_inquiry'
  }
  return 'general'
}

// ─── Sofia WhatsApp Auto-reply ────────────────────────────────────────────────

async function generateAndSendSofiaReply(params: {
  to: string
  name: string
  text: string
  tenantId: string
}): Promise<void> {
  const { to, name, text, tenantId } = params

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.warn('[WhatsApp/Sofia] ANTHROPIC_API_KEY not set — skipping auto-reply')
    return
  }

  const intent = classifyIntent(text)

  const intentHints: Record<MessageIntent, string> = {
    price_inquiry:    'O utilizador pergunta sobre preço. Pede zona e tipologia antes de responder.',
    visit_request:    'O utilizador quer visitar um imóvel. Pede data e hora disponíveis.',
    document_request: 'O utilizador pede documentos. Explica que irás enviar pelo canal adequado.',
    offer_inquiry:    'O utilizador quer fazer uma proposta. Mostra disponibilidade imediata.',
    general:          'Mensagem geral. Responde com simpatia e oferece ajudar.',
  }

  const systemPrompt = `Você é Sofia, assistente virtual da Agency Group, imobiliária premium portuguesa (AMI 22506).
Responde no WhatsApp: máximo 3 frases curtas, natural, caloroso, profissional.
Detecta automaticamente o idioma e responde no mesmo idioma.
Contexto: ${intentHints[intent]}
Sempre termina a oferecer ligar em 5 minutos se for urgente.
Nome do contacto: ${name}.`

  try {
    const client = new Anthropic({ apiKey })

    // withAI: policy gate + circuit breaker + retry. Sofia replies are non-critical
    // (WhatsApp always returns 200 to Meta). A failed reply does not break the
    // webhook — governance + CB prevent hammering Anthropic when degraded.
    const response = await withAI<Anthropic.Message | null>(
      'anthropic-haiku',
      () => client.messages.create({
        model: 'claude-haiku-3-5-20241022',
        max_tokens: 160,
        system: systemPrompt,
        messages: [{ role: 'user', content: text }],
      }),
      null,  // fallback: circuit OPEN or policy DENY → skip reply (logged below)
      'whatsapp-sofia-reply',
    )

    if (response === null) {
      console.warn('[WhatsApp/Sofia] Anthropic circuit breaker OPEN — skipping auto-reply')
      return
    }

    // response is guaranteed non-null here (we returned early if null above)
    const replyBlock = response.content.find(b => b.type === 'text')
    if (!replyBlock || replyBlock.type !== 'text') {
      console.warn('[WhatsApp/Sofia] No text block in Anthropic response')
      return
    }

    const reply = replyBlock.text.trim()
    if (!reply) return

    const result = await sendWhatsApp({ to, type: 'text', text: reply })

    if (result.success) {
      // GDPR compliant: log only truncated identifier
      const toHash = to ? `***${to.slice(-4)}` : 'unknown'
      console.log(`[WhatsApp/Sofia] Auto-reply sent to ${toHash} (intent: ${intent}) — msgId: ${result.messageId}`)
    } else {
      console.error('[WhatsApp/Sofia] Send failed:', result.error)
    }

    void recordCausalStep({
      correlation_id: to,
      tenant_id: tenantId,
      step_type: 'whatsapp_sent',
      agent_id: 'sofia-whatsapp',
      action: 'auto_reply',
      success: result.success,
      metadata: { intent, messageId: result.messageId },
    })
  } catch (error) {
    console.error('[WhatsApp/Sofia] generateAndSendSofiaReply error:', error)
  }
}

// ─── Inbound Message Handler ──────────────────────────────────────────────────

async function handleIncomingMessage(params: {
  from: string
  name: string
  text: string
  messageId: string
  tenantId: string
}): Promise<void> {
  const { from, name, text, tenantId } = params

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

    void recordCausalStep({
      correlation_id: params.messageId,
      tenant_id: tenantId,
      step_type: 'event_received',
      entity_type: 'contact',
      entity_id: contact?.id ?? from,
      action: 'whatsapp_inbound',
      success: true,
      metadata: { name, channel: 'whatsapp' },
    })
  } catch (err) {
    console.error('[WhatsApp] handleIncomingMessage error:', err)
  }
}
