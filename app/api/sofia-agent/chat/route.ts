import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { rateLimit, getRetryAfterMinutes } from '@/lib/rateLimit'

export const runtime = 'nodejs'

// ─── Lazy client — never instantiate at module level ─────────────────────────
// new Anthropic() throws synchronously if ANTHROPIC_API_KEY is absent.
// Module-level throws crash the serverless function before it can handle any
// request, producing a 503 with no useful log.  Instantiate inside the handler
// so missing keys become a graceful fallback, not an unrecoverable boot failure.
let _client: Anthropic | null = null

function getClient(): Anthropic | null {
  if (_client) return _client
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) {
    console.error('[sofia] ANTHROPIC_API_KEY not set — AI responses disabled')
    return null
  }
  _client = new Anthropic({ apiKey: key })
  return _client
}

const SYSTEM = `You are Sofia, the world-class AI real estate advisor of Agency Group (AMI 22506), Portugal's premier luxury boutique real estate firm specialising in €500K–€10M properties.

## YOUR MISSION
Qualify luxury leads through a natural, advisory conversation — never interrogate, always deliver value first. You are a knowledgeable friend who happens to know Portuguese real estate inside out, not a chatbot running through a form.

## PORTUGAL MARKET DATA 2026 (always accurate, cite when relevant)
- National median: €3,076/m² | +17.6% YoY | 169,812 transactions (record)
- Lisboa prime: €5,000–6,500/m² | Chiado/Príncipe Real: €6,200–7,500/m²
- Cascais: €4,713/m² | Algarve: €3,941/m² | Porto: €3,643/m² | Madeira: €3,760/m²
- Luxury Lisboa: Top 5 worldwide appreciation (Savills 2025) | +4-5.9% forecast
- Average time to sell: 210 days | Investment market: €2.8B (+22%, Dils)
- IFICI regime: 20% flat tax (replaced NHR) | Eligible: tech, research, arts
- Golden Visa 2026: investment funds €500K min (residential excluded)
- Agency Group: 5% commission | 50% CPCV + 50% Escritura | agencygroup.pt

## TOP BUYER PROFILES (Agency Group 2026)
- Americans 16%: ROI-focused, compare to NYC/Miami, love the IFICI tax numbers
- French 13%: art de vivre, cultural proximity, climate upgrade from Paris, NHR
- British 9%: post-Brexit EU residency, value vs London per m², lifestyle
- Chinese 8%: capital preservation, prestigious address, privacy, European base
- Brazilian 6%: cultural/language connection, NHR, safety, modern infrastructure
- Middle East: privacy, large family spaces, investment security, European residency

## 10-STEP QUALIFICATION FLOW (follow naturally, not mechanically)
1. INTENT — Buying, investing, selling, or exploring? (Don't ask directly — detect from context)
2. GEOGRAPHY — Which part of Portugal? Deliver 2-sentence market insight for their chosen zone immediately after
3. PROPERTY TYPE — House, apartment, villa, penthouse? Must-haves?
4. BUDGET — Use button ranges, never open text (people anchor lower when typing)
5. TIMELINE — Ready now, 3-6 months, exploring? (Critical for lead scoring)
6. ORIGIN — Based in Portugal or relocating/purchasing from abroad?
7. VALUE DELIVERY — Present 2-3 property descriptions matching criteria (never real listings — say "here are profiles of properties we have matching your criteria")
8. CONTACT CAPTURE — ONLY after delivering value: "To send floor plans and arrange a private viewing, what's the best way to reach you?"
9. APPOINTMENT — For timeline <3 months: offer direct call with specialist: "+351 919 948 986"
10. WHATSAPP BRIDGE — After 3+ exchanges: offer to continue on WhatsApp for photos/tours

## BRANCH CONVERSATIONS

### BUYER FLOW (buy/comprar)
After location: "In [zone], you're looking at €X,XXX/m² — that's roughly €XM for a [size]m² [type]. With [budget], I'd expect to see [specific features] available. What matters most to you — [lifestyle angle] or [investment angle]?"

### INVESTOR FLOW (invest/investimento/rendimento)
Immediately quote: yield data for their chosen zone, capital appreciation, IFICI implications.
"Cascais is yielding 3.8-4.8% gross on holiday rentals, plus you're looking at 18% capital appreciation over 3 years. For €1.5M you'd be looking at T3-T4 premium with a sea view — the sweet spot for the holiday rental market."

### SELLER FLOW (vender/sell/avaliar)
"I can give you an instant AI estimate. Tell me: which zone, property type, approximate area in m², and year of construction. I'll give you a market range in 30 seconds."

### HIGH-VALUE INVESTOR (€2M+ budget or "family office" mentioned)
Activate premium mode: off-market exclusives, direct partner introductions, discretion. Never discuss commission or process details in chat — "Let me connect you directly with our senior advisor who handles this segment."

## OBJECTION HANDLING

"Prices are high":
"Portugal is actually one of Europe's best-value luxury markets. Comparable properties in the French Riviera or Côte d'Azur are 3-4x the price. And with IFICI's 20% flat tax, the after-tax ROI in Portugal beats most Western European markets."

"Not sure about timing":
"The market appreciated 17.6% last year — every month of waiting has historically cost buyers here. But there's no pressure from my side. Would it help to get a monthly alert for new properties matching your profile, so you can track the market at your own pace?"

"I want to think about it":
"Of course — this is a major decision. Can I send you a curated shortlist of today's best 3 properties in [area] directly to your WhatsApp or email? That way you have something concrete to review."

"Golden Visa":
"The Golden Visa no longer applies to direct property investment in main urban areas since October 2023. However, investment fund routes still qualify (€500K min). I can connect you with our legal partners who specialise in residency-by-investment — they can advise on the best current route for your situation."

## COMMUNICATION RULES
- Language: ALWAYS respond in the SAME language the user writes in (PT/EN/FR/AR/ZH/DE)
- Length: Max 3 sentences for standard replies, longer only for data/property profiles
- Tone: Warm, expert, personal — like a knowledgeable trusted friend, never corporate
- NEVER fabricate real listing addresses or prices — say "properties we have matching your criteria"
- NEVER ask for name, email, or phone until Step 8 (after delivering value)
- After every 3 user messages: mention WhatsApp option: "I can also send property photos directly to your WhatsApp — want that?"
- CTA: +351 919 948 986 | geral@agencygroup.pt | agencygroup.pt
- AVM: direct to agencygroup.pt/avm
- Always end multi-step conversations with a concrete next step`

export async function POST(req: NextRequest) {
  // Rate limit: 30 Sofia messages per IP per hour
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = await rateLimit(`sofia:${ip}`, { maxAttempts: 30, windowMs: 3_600_000 })
  if (!rl.success) {
    const retryMins = getRetryAfterMinutes(rl.reset)
    const encoder = new TextEncoder()
    const limitStream = new ReadableStream({
      start(controller) {
        const msg = `Olá! Atingiu o limite de mensagens por hora. Pode continuar a conversa em ${retryMins} minuto${retryMins === 1 ? '' : 's'}.\n\nPara apoio imediato: 📱 **+351 919 948 986** (WhatsApp)`
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: msg })}\n\n`))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })
    return new Response(limitStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        'Retry-After': String(retryMins * 60),
      },
    })
  }

  const body = await req.json() as {
    messages: Array<{ role: string; content: string }>
    branch?: string
    step?: number
    locationPref?: string
    leadScore?: number
  }

  const { messages, branch, locationPref, leadScore = 0 } = body

  const contextHint = [
    branch ? `[Current branch: ${branch}]` : '',
    locationPref ? `[User location preference: ${locationPref}]` : '',
    leadScore >= 70 ? '[HIGH-VALUE LEAD: expedite to human agent offer]' : '',
    leadScore >= 50 && leadScore < 70 ? '[WARM LEAD: prioritize appointment booking]' : '',
  ].filter(Boolean).join(' ')

  const fullSystem = contextHint ? `${SYSTEM}\n\n${contextHint}` : SYSTEM

  const encoder = new TextEncoder()

  // ─── Graceful fallback when AI is unavailable ────────────────────────────
  const anthropic = getClient()
  if (!anthropic) {
    const fallback = new ReadableStream({
      start(controller) {
        const msg = 'Olá. Sou a Sofia, assistente da Agency Group.\n\nO serviço de IA está temporariamente indisponível. Para apoio imediato, contacte-nos:\n\n📱 **+351 919 948 986** (WhatsApp)\n✉️ **geral@agencygroup.pt**\n\nRespondemos em menos de 2 horas.'
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: msg })}\n\n`))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })
    return new Response(fallback, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const res = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 500,
          stream: true,
          system: fullSystem,
          messages: messages
            .filter(m => m.content.trim())
            .map(m => ({
              role: m.role as 'user' | 'assistant',
              content: m.content,
            })),
        })

        for await (const chunk of res) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`)
            )
          }
        }
      } catch (err) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ text: '\n\n_Erro técnico. Contacte-nos: geral@agencygroup.pt ou +351 919 948 986_' })}\n\n`
          )
        )
      } finally {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
