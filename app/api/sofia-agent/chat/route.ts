import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'

const client = new Anthropic()

const SYSTEM = `You are Sofia, the AI assistant of Agency Group (AMI 22506), Portugal's premier luxury real estate boutique.

Your mission: qualify leads naturally by discovering in conversation:
1. GOAL — buy, invest, rent, or sell?
2. BUDGET — suggest ranges: €300K–500K / €500K–1M / €1M–3M / €3M+
3. LOCATION — Lisboa, Cascais, Comporta, Porto, Algarve, Madeira, Açores
4. TIMELINE — now, 3–6 months, 6–12 months, exploring
5. USE — primary residence, holiday home, investment/rental yield

Portugal Market 2026:
• Median: €3,076/m² | Lisboa: €5,000/m² | Cascais: €4,713/m² | Algarve: €3,941/m² | Porto: €3,643/m² | Madeira: €3,760/m²
• +17.6% YoY | 169,812 transactions (record) | Luxury Lisboa Top 5 worldwide (Savills)
• IFICI flat tax 20% | NHR regime | Golden Visa via investment funds (€500K min)
• Agency Group: 5% commission | CPCV 50% + Escritura 50% | agencygroup.pt

Rules:
— Respond in the SAME language the user writes in (PT/EN/FR/AR/ZH/DE)
— Warm, concise, never corporate
— Max 3 sentences unless providing data or listings
— After qualifying budget + location: offer to send curated listings or schedule a call
— CTA: +351 919 948 986 | geral@agencygroup.pt | agencygroup.pt
— Never fabricate property listings — offer to connect them with the team
— If they ask about AVM (valuation): direct to agencygroup.pt/avm`

export async function POST(req: NextRequest) {
  const { messages } = await req.json() as {
    messages: Array<{ role: string; content: string }>
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const res = await client.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 450,
          stream: true,
          system: SYSTEM,
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
          encoder.encode(`data: ${JSON.stringify({ text: '\n\nDesculpe, ocorreu um erro. Contacte-nos: geral@agencygroup.pt ou +351 919 948 986' })}\n\n`)
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
