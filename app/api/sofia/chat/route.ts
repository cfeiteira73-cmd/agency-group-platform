import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

// ─── Rate limiting (in-memory, edge-compatible) ───────────────────────────────
// Edge runtime: per-instance, not global — good enough for abuse protection
const ipHits = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 30          // requests
const RATE_WINDOW_MS = 3_600_000 // 1 hour

function checkRateLimit(ip: string): boolean {
  const now   = Date.now()
  const entry = ipHits.get(ip)

  if (!entry || now > entry.resetAt) {
    ipHits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}

// ─── System Prompts ───────────────────────────────────────────────────────────

const SYSTEM_PROMPTS: Record<string, string> = {
  deal_assistant: `Você é Sofia, assistente de negócios imobiliários da Agency Group (AMI 22506).
Especialista em: avaliações de imóveis em Portugal, análise de compradores, negociação, CPCV, escritura.
Mercado 2026: Lisboa €5.000/m², Cascais €4.713, Algarve €3.941, Porto €3.643, Madeira €3.760, Açores €1.952.
Comissão AG: 5% (50% CPCV + 50% Escritura). Segmento core: €500K–€3M.
Compradores top: Norte-americanos 16%, Franceses 13%, Britânicos 9%, Chineses 8%, Brasileiros 6%.
Seja concisa, profissional, use dados reais. Responda em PT por padrão, adapte ao idioma do utilizador.`,

  market_expert: `Você é Sofia, especialista de mercado imobiliário português 2026.
Dados 2026: €3.076/m² mediana nacional, +17.6% YoY, 169.812 transações, 210 dias DOM médio.
Preços: Lisboa €5.000/m², Cascais €4.713, Algarve €3.941, Porto €3.643, Madeira €3.760, Açores €1.952.
Lisboa top 5 mundial luxo. Euribor 6M: 3.15%. DSTI máximo BdP: 50%.
NHR/IFICI disponível para residentes não-habituais. Mais-valias: 50% sobre ganho, coeficientes AT aplicados.
Seja analítica, use números, cite fontes quando relevante. Adapte idioma ao utilizador.`,

  legal_guide: `Você é Sofia, guia jurídico imobiliário (não substitui advogado).
Áreas: CPCV (sinal 10-20%), IMT (0-8% consoante preço), IMI (0.3-0.45%), IS (0.8%),
IRS mais-valias (Art.10 CIRS), NHR 2024/IFICI, licenças AL, ARU.
Prazos: promessa→escritura 30-90 dias típico. Sinal dobrado se vendedor incumprir.
Golden Visa: encerrado para imóveis residenciais. Fundos imobiliários ainda elegíveis.
Sempre recomende consultar advogado para casos específicos. Adapte idioma ao utilizador.`,

  investor_matcher: `Você é Sofia, especialista em investimento imobiliário Portugal.
Yields típicos: Lisboa 3.5-5%, Porto 4-6%, Algarve 5-8% (sazonal), Madeira 6-9%.
ROI médio mercado 2020-2026: +67% Lisboa, +45% Porto.
Perfis: income (yield), value-add (renovação), capital appreciation (prime), distressed (insolvências).
NHR: 20% flat tax rendimentos PT. DSTI BdP: 50%.
Segmentos: family offices, HNWI globais, Médio Oriente, asiáticos para €3M+.
Seja direta com números, riscos, ROI projections. Adapte idioma ao utilizador.`,
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ChatRequestBody {
  messages: ChatMessage[]
  mode?: string
  context?: Record<string, unknown> | null
  systemHint?: string
  lang?: string
}

// ─── POST Handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── Rate limiting ─────────────────────────────────────────────────────────
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
           ?? req.headers.get('x-real-ip')
           ?? 'unknown'

  if (!checkRateLimit(ip)) {
    return new Response(
      JSON.stringify({ error: 'Limite de pedidos excedido. Tente novamente em 1 hora.' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: ChatRequestBody
  try {
    body = await req.json() as ChatRequestBody
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const { messages, mode, context, systemHint, lang } = body

  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response(
      JSON.stringify({ error: 'messages array is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // ── Build system prompt ───────────────────────────────────────────────────
  // Map legacy AssistantMode keys (deal/market/legal/investor) to API keys
  const modeMap: Record<string, string> = {
    deal: 'deal_assistant',
    market: 'market_expert',
    legal: 'legal_guide',
    investor: 'investor_matcher',
  }
  const resolvedMode = mode ? (modeMap[mode] ?? mode) : 'deal_assistant'
  let systemPrompt = SYSTEM_PROMPTS[resolvedMode] ?? SYSTEM_PROMPTS['deal_assistant']

  // Append lang hint if provided by client
  if (lang && lang !== 'PT') {
    const langNames: Record<string, string> = { EN: 'English', FR: 'French', AR: 'Arabic' }
    const langName = langNames[lang] ?? lang
    systemPrompt += `\nRespond in ${langName}.`
  }

  // Append additional system hint from PortalSofia (mode-specific)
  if (systemHint) {
    systemPrompt += `\n\nFoco adicional: ${systemHint}`
  }

  // Append deal/property context if provided
  if (context && Object.keys(context).length > 0) {
    systemPrompt += `\n\nContexto do imóvel/negócio actual: ${JSON.stringify(context)}`
  }

  // ── Validate messages ─────────────────────────────────────────────────────
  const validMessages = messages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .filter(m => typeof m.content === 'string' && m.content.trim().length > 0)
    // Cap history at last 20 messages to control token usage
    .slice(-20)
    .map(m => ({ role: m.role, content: m.content }))

  if (validMessages.length === 0) {
    return new Response(
      JSON.stringify({ error: 'No valid messages provided' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // ── Anthropic streaming ───────────────────────────────────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    // Return a graceful SSE mock response so the UI renders instead of crashing
    const mockText =
      'Olá! Sou a Sofia, assistente IA da Agency Group. ' +
      'Neste momento o serviço de IA não está configurado (ANTHROPIC_API_KEY em falta). ' +
      'Contacte o administrador para activar o assistente completo.'
    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      start(controller) {
        // Send the mock message as a single SSE chunk so the client renders it normally
        const payload = JSON.stringify({ text: mockText })
        controller.enqueue(encoder.encode(`data: ${payload}\n\n`))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })
    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  }

  const client = new Anthropic({ apiKey })

  try {
    // Use create() with stream:true — AsyncIterable approach works in edge runtime
    const stream = await client.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1024,
      stream: true,
      system: systemPrompt,
      messages: validMessages,
    })

    const encoder = new TextEncoder()

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (
              chunk.type === 'content_block_delta' &&
              chunk.delta.type === 'text_delta'
            ) {
              const payload = JSON.stringify({ text: chunk.delta.text })
              controller.enqueue(encoder.encode(`data: ${payload}\n\n`))
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        } catch (streamError) {
          console.error('[Sofia] Stream error:', streamError)
          const errPayload = JSON.stringify({ error: 'Erro durante geração de resposta.' })
          controller.enqueue(encoder.encode(`data: ${errPayload}\n\n`))
        } finally {
          controller.close()
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable Nginx buffering for SSE
      },
    })
  } catch (error) {
    console.error('[Sofia] Anthropic API error:', error)
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    return new Response(
      JSON.stringify({ error: `Erro IA: ${message}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
