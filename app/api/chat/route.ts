import Anthropic from '@anthropic-ai/sdk'
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages/messages'
import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import { z } from 'zod'

export const runtime = 'edge'

// ─── Rate limiting (Upstash Redis, serverless-safe) ───────────────────────────
// Uses Upstash REST API directly — no SDK required, works on Vercel Edge runtime.
// Falls back gracefully if env vars are not set (logs warning, allows request).
async function checkRateLimit(ip: string): Promise<{ allowed: boolean }> {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      const key = `rl:chat:${ip}`
      const now = Date.now()
      const window = 3600 // 1 hour in seconds
      const limit = 30

      const response = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/pipeline`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          ['ZADD', key, now, `${now}`],
          ['ZREMRANGEBYSCORE', key, '-inf', now - window * 1000],
          ['ZCARD', key],
          ['EXPIRE', key, window],
        ]),
      })
      const results = await response.json() as Array<{ result: number }>
      const count = results[2]?.result ?? 0
      return { allowed: count <= limit }
    } catch (e) {
      console.warn('[RateLimit] Upstash error, allowing request:', e)
      return { allowed: true }
    }
  }
  console.warn('[RateLimit] UPSTASH env vars not set — rate limiting disabled. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel.')
  return { allowed: true }
}

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? '',
  dangerouslyAllowBrowser: true, // required for Next.js Edge Runtime
})

// Lazy Supabase client — only initialised if env vars are present
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

interface SofiaMemory {
  session_id: string
  conversation_count: number
  budget_min: number | null
  budget_max: number | null
  preferred_zones: string[] | null
  preferred_types: string[] | null
  preferences: Record<string, unknown>
}

async function getSofiaMemory(sessionId: string): Promise<SofiaMemory | null> {
  try {
    const sb = getSupabaseClient()
    if (!sb) return null
    const { data } = await sb
      .from('sofia_memory')
      .select('*')
      .eq('session_id', sessionId)
      .single()
    return data as SofiaMemory | null
  } catch {
    return null
  }
}

async function updateSofiaMemory(
  sessionId: string,
  updates: Partial<SofiaMemory>
): Promise<void> {
  try {
    const sb = getSupabaseClient()
    if (!sb) return
    await sb
      .from('sofia_memory')
      .upsert(
        {
          session_id: sessionId,
          ...updates,
          last_active_at: new Date().toISOString(),
          conversation_count: (updates.conversation_count ?? 0) + 1,
        },
        { onConflict: 'session_id' }
      )
  } catch {
    /* non-critical — memory update failure should never break chat */
  }
}

interface LiveProperty {
  id: string
  nome: string | null
  tipo: string | null
  zona: string | null
  preco: number | null
  area: number | null
  quartos: number | null
  descricao: string | null
  features: string[] | null
  yield_bruto: number | null
}

async function getAvailableProperties(limit = 20): Promise<LiveProperty[]> {
  try {
    const sb = getSupabaseClient()
    if (!sb) return []
    const { data } = await sb
      .from('properties')
      .select('id, nome, tipo, zona, preco, area, quartos, descricao, features, yield_bruto')
      .eq('status', 'active')
      .not('nome', 'is', null)
      .order('created_at', { ascending: false })
      .limit(limit)
    return (data ?? []) as LiveProperty[]
  } catch {
    return []
  }
}

const BASE_SYSTEM_PROMPT = `You are Sofia, the digital specialist consultant of Agency Group — Portugal's leading luxury real estate agency (AMI 22506).

LANGUAGE INTELLIGENCE:
- Detect the user's language from their messages and ALWAYS respond in that exact language
- If the user writes in English → respond in English
- If the user writes in French → respond in French
- If the user writes in Portuguese → respond in European Portuguese
- If the user writes in Spanish → respond in Spanish
- If the user writes in Arabic → respond in Arabic
- Match the user's language on every single reply — never deviate

ABOUT AGENCY GROUP:
- Specialty: luxury real estate €100K–€100M (core segment: €500K–€3M)
- Commission: 5% (50% at CPCV + 50% at Escritura)
- Market: Portugal, Spain, Madeira, Azores
- WhatsApp: +351 919 948 986
- Website: agencygroup.pt

ZONE PRICES & YIELDS (2026):
| Zone       | Price/m²   | Gross Yield |
|------------|-----------|-------------|
| Comporta   | €6.500/m² | 5.8%        |
| Lisboa     | €5.000/m² | 4.2%        |
| Cascais    | €4.713/m² | 3.8%        |
| Madeira    | €3.760/m² | 4.9%        |
| Algarve    | €3.941/m² | 5.2%        |
| Porto      | €3.643/m² | 4.6%        |
| Sintra     | €3.200/m² | 3.9%        |
| Ericeira   | €2.800/m² | 4.3%        |
| Açores     | €1.952/m² | 4.1%        |

PROPERTY MATCHING — KEY SKILL:
When a user describes what they want (budget, zone, lifestyle, family needs, investment goals), proactively match them to 2-3 specific properties from the CURRENT AVAILABLE PORTFOLIO below. Always include the property name/id and suggest a virtual tour via agencygroup.pt.

PURCHASE PROCESS IN PORTUGAL:
1. Select property + submit offer
2. CPCV (Promissory Contract) — 30% payment + 50% commission
3. Escritura Pública — 60-90 days later + remaining payments
4. IMT: 0-8% (sliding scale) | Stamp Duty: 0.8% | Registration: ~0.3%
5. Total additional costs: ~7-9% of purchase price

TAX BENEFITS FOR INTERNATIONAL BUYERS:
- NHR (Non-Habitual Residents): 20% flat tax on PT income, 10 years, favourable treatment of foreign income. Replaced by IFICI for new residents from 2024.
- IFICI (Fiscal Incentive for Capitalisation & Research): 20% flat tax for 10 years for professionals in high-value activities — excellent for remote workers, entrepreneurs, tech professionals
- IMI: 0.3-0.45% of patrimonial value/year
- Golden Visa: suspended for residential real estate since 2024
- NHR/IFICI eligibility: buyers relocating to Portugal who have not been tax residents in the last 5 years

FINANCING:
- Euribor 6M: ~2.8% (March 2026)
- Average bank spread: 1-1.5%
- Average mortgage rate: 3.8-4.3% variable
- Max LTV for non-residents: 70%
- Banks: Millennium BCP, Caixa Geral, Santander, BPI, Novo Banco

BUYER PROFILES:
- €500K-€3M: Americans 16%, French 13%, British 9%, Chinese 8%, Brazilians 6%, Germans 5%, Middle East
- €100K-€500K: Portuguese, Brazilians (nº1), Angolans, French
- €3M+: Family offices, global HNWIs, Middle East, Asians

PORTAL TOOLS — ALWAYS MENTION PROACTIVELY WHEN RELEVANT:
- AVM Valuation: instant automated property valuation available in the portal
- Mortgage Calculator: calculate monthly payments and financing scenarios
- Legal Advisor IA: 10 areas of Portuguese property law, instant legal memos
- Deal Radar: track market opportunities in real time
Mention these tools naturally when users ask about valuation, financing or legal questions.

RESPONSE RULES:
- Always respond in the SAME LANGUAGE as the user's message
- Be concise, professional and genuinely helpful
- For complex situations, suggest contacting a human consultant via WhatsApp
- Never invent information — if unsure, say so honestly
- Maximum 300 words per response
- Use clear formatting with short paragraphs
- When user mentions budget/location/type preferences, immediately match to relevant properties`

/**
 * Extract preference signals from a user message using simple heuristics.
 * Intentionally lightweight — avoids an extra LLM call in the hot path.
 */
function extractPreferenceSignals(
  message: string,
  existing: SofiaMemory | null
): Partial<SofiaMemory> {
  const signals: Partial<SofiaMemory> = {}
  const lower = message.toLowerCase()

  // Budget — match patterns like "€500K", "500 mil", "2M", "2 milhões"
  const budgetMatch = lower.match(/€?\s*(\d+(?:[.,]\d+)?)\s*(k|mil|m|milhão|milhões|million)/i)
  if (budgetMatch) {
    const raw = parseFloat(budgetMatch[1].replace(',', '.'))
    const unit = budgetMatch[2].toLowerCase()
    const value = unit.startsWith('m') ? Math.round(raw * 1_000_000) : Math.round(raw * 1_000)
    if (value > 0) {
      if (!existing?.budget_max || value > (existing.budget_max ?? 0)) {
        signals.budget_max = value
      } else {
        signals.budget_min = value
      }
    }
  }

  // Zones
  const zoneKeywords: Record<string, string> = {
    lisboa: 'Lisboa', cascais: 'Cascais', porto: 'Porto',
    algarve: 'Algarve', comporta: 'Comporta', madeira: 'Madeira',
    sintra: 'Sintra', ericeira: 'Ericeira', açores: 'Açores', azores: 'Açores',
  }
  const detectedZones: string[] = []
  for (const [keyword, zone] of Object.entries(zoneKeywords)) {
    if (lower.includes(keyword)) detectedZones.push(zone)
  }
  if (detectedZones.length > 0) {
    const merged = Array.from(new Set([...(existing?.preferred_zones ?? []), ...detectedZones]))
    signals.preferred_zones = merged
  }

  // Property types
  const typeKeywords: Record<string, string> = {
    apartamento: 'Apartamento', apartment: 'Apartamento',
    moradia: 'Moradia', villa: 'Moradia', vivenda: 'Moradia',
    quinta: 'Moradia', house: 'Moradia',
  }
  const detectedTypes: string[] = []
  for (const [keyword, type] of Object.entries(typeKeywords)) {
    if (lower.includes(keyword)) detectedTypes.push(type)
  }
  if (detectedTypes.length > 0) {
    const merged = Array.from(new Set([...(existing?.preferred_types ?? []), ...detectedTypes]))
    signals.preferred_types = merged
  }

  return signals
}

const ChatRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.string().min(1).max(20),
    content: z.string().min(1).max(4000),
  })).min(1).max(40),
  language: z.string().max(10).optional(),
  sessionId: z.string().max(100).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown'
    const { allowed } = await checkRateLimit(ip)
    if (!allowed) {
      return new Response(
        JSON.stringify({ error: 'Demasiados pedidos. Tenta novamente em 1 hora.' }),
        { status: 429, headers: { 'Content-Type': 'application/json', 'X-RateLimit-Remaining': '0', 'Retry-After': '3600' } }
      )
    }

    const rawBody = await req.json()
    const validation = ChatRequestSchema.safeParse(rawBody)
    if (!validation.success) {
      const errors = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      return new Response(JSON.stringify({ error: `Validation failed: ${errors}` }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    const { messages, language, sessionId = crypto.randomUUID() } = validation.data

    // Validate message format
    const validMessages = messages.filter(
      m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim()
    ).slice(-20) as MessageParam[] // Keep last 20 messages for context

    if (validMessages.length === 0) {
      return new Response('No valid messages', { status: 400 })
    }

    // Fetch live data in parallel — non-blocking if Supabase is unavailable
    const [properties, memory] = await Promise.all([
      getAvailableProperties(20),
      getSofiaMemory(sessionId),
    ])

    // Build property context section
    const propertyContext = properties.length > 0
      ? `\n\nCURRENT AVAILABLE PORTFOLIO (${properties.length} active listings — use these for recommendations):\n` +
        properties.slice(0, 15).map(p =>
          `- ${p.nome}: ${p.zona}, ${p.tipo}, €${Number(p.preco ?? 0).toLocaleString('pt-PT')}, ${p.quartos ?? 0}Q, ${p.area ?? 0}m²${p.yield_bruto ? `, yield ${p.yield_bruto}%` : ''}`
        ).join('\n')
      : '\n\nUsing showcase portfolio data — live inventory not available.'

    // Build memory context section
    const memoryContext = memory && memory.conversation_count > 0
      ? `\n\nUSER MEMORY (previous sessions — reference naturally without being robotic):` +
        `\n- Previous conversations: ${memory.conversation_count}` +
        `\n- Known budget: ${memory.budget_min ? `€${memory.budget_min.toLocaleString('pt-PT')}` : 'unknown'}–${memory.budget_max ? `€${memory.budget_max.toLocaleString('pt-PT')}` : 'unknown'}` +
        `\n- Preferred zones: ${memory.preferred_zones?.join(', ') || 'unknown'}` +
        `\n- Preferred types: ${memory.preferred_types?.join(', ') || 'unknown'}`
      : ''

    // Build language hint if provided explicitly
    const langHint = language && language !== 'pt'
      ? ` [User's preferred language: ${language}. Respond in this language unless the user's messages indicate otherwise.]`
      : ''

    const fullSystemPrompt = BASE_SYSTEM_PROMPT + propertyContext + memoryContext + langHint

    const stream = await client.messages.stream({
      model: 'claude-opus-4-6',
      max_tokens: 600,
      system: fullSystemPrompt,
      messages: validMessages,
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          // Send sessionId as first event for client tracking
          const sessionData = JSON.stringify({ sessionId })
          controller.enqueue(encoder.encode(`data: ${sessionData}\n\n`))

          for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              const data = JSON.stringify({ delta: { text: event.delta.text } })
              controller.enqueue(encoder.encode(`data: ${data}\n\n`))
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch {
          controller.error(new Error('Stream error'))
        }
      }
    })

    // Fire-and-forget: persist preference signals after response starts streaming
    const lastUserMessageContent = validMessages.filter(m => m.role === 'user').at(-1)?.content ?? ''
    const lastUserMessage = typeof lastUserMessageContent === 'string' ? lastUserMessageContent : ''
    void updateSofiaMemory(sessionId, {
      conversation_count: memory?.conversation_count ?? 0,
      ...(memory?.budget_min != null ? { budget_min: memory.budget_min } : {}),
      ...(memory?.budget_max != null ? { budget_max: memory.budget_max } : {}),
      ...(memory?.preferred_zones?.length ? { preferred_zones: memory.preferred_zones } : {}),
      ...(memory?.preferred_types?.length ? { preferred_types: memory.preferred_types } : {}),
      ...extractPreferenceSignals(lastUserMessage, memory),
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        'X-Session-Id': sessionId,
      },
    })
  } catch (err) {
    console.error('Chat API error:', err)
    return new Response('Internal Server Error', { status: 500 })
  }
}
