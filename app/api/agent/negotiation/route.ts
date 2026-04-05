// =============================================================================
// AGENCY GROUP — Negotiation Strategy API v1.0
// POST /api/agent/negotiation — AI-powered negotiation playbook for deals
// AMI: 22506 | Claude AI analysis
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'

interface NegotiationResponse {
  strategy: string
  opening_position: string
  concession_plan: string[]
  anchoring_tactics: string[]
  buyer_psychology: string
  red_lines: string[]
  expected_counter: string
  close_signals: string[]
  script_opener: string
}

function fallbackNegotiation(deal: Record<string, unknown>): NegotiationResponse {
  const valor = String(deal.valor || '€0')
  const comprador = String(deal.comprador || deal.contact || 'Comprador')
  const imovel = String(deal.imovel || 'Imóvel')

  return {
    strategy: `Negociação colaborativa baseada em valor — foco nos benefícios únicos de ${imovel} e na timeline do comprador. Evitar guerra de preço.`,
    opening_position: `Manter ${valor} como âncora. Apresentar 3 comparáveis de mercado que justificam o preço pedido. Destacar exclusividade e potencial de valorização.`,
    concession_plan: [
      'Primeira concessão: máximo 2-3% apenas após contra-proposta formal por escrito',
      'Segunda concessão: incluir extras (móveis, obras menores) em vez de reduzir preço',
      'Concessão final: somente se deal ameaçar cair — máximo 5% do preço pedido',
    ],
    anchoring_tactics: [
      `Apresentar o preço €${valor} como já reduzido face ao valor de avaliação`,
      'Mencionar outros interessados (se existirem) para criar urgência legítima',
      'Usar formato "entre X e Y" para criar margem psicológica favorável',
    ],
    buyer_psychology: `${comprador} está em modo de decisão. Validar emocionalmente a escolha antes de entrar em números. A lógica fecha deals, mas a emoção decide.`,
    red_lines: [
      'Não aceitar condicionantes excessivas (financiamento não confirmado)',
      'Não reduzir sinal abaixo de 10% do valor total',
      'Não aceitar prazo de escritura superior a 90 dias sem justificação sólida',
    ],
    expected_counter: `Esperar contra-proposta 5-8% abaixo do pedido. Preparar análise de mercado para fundamentar resposta.`,
    close_signals: [
      'Perguntas sobre logística (mudança, obras, data de entrada)',
      'Pedido de planta/documentação técnica adicional',
      'Envolvimento de advogado/família na conversa',
      'Comparação com outros imóveis que visitou',
    ],
    script_opener: `"${comprador}, com base na nossa conversa e nos imóveis que visitou, este parece ser o match mais forte para o que procura. Quero assegurar-me que encontramos os termos certos para avançarmos."`,
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json()
    const { deal } = body as { deal: Record<string, unknown> }

    if (!deal) {
      return NextResponse.json({ error: 'deal is required' }, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json(fallbackNegotiation(deal))
    }

    try {
      const client = new Anthropic({ apiKey })
      const dealContext = `
Property: ${deal.imovel}
Buyer: ${deal.comprador}
Asking Price: ${deal.valor}
Current Offer: ${deal.offer || 'none'}
Stage: ${deal.fase}
Days in Negotiation: ${deal.days_in_stage || 0}
Notes: ${deal.notas || deal.notes || 'none'}
`.trim()

      const message = await client.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: `You are a master real estate negotiation coach for Agency Group Portugal (AMI 22506).
Create a negotiation playbook for this deal. Respond in JSON:
{
  "strategy": "overall negotiation approach (2-3 sentences in Portuguese)",
  "opening_position": "how to open the negotiation (in Portuguese)",
  "concession_plan": ["step 1", "step 2", "step 3"],
  "anchoring_tactics": ["tactic 1", "tactic 2", "tactic 3"],
  "buyer_psychology": "psychological profile and approach (in Portuguese)",
  "red_lines": ["non-negotiable 1", "non-negotiable 2", "non-negotiable 3"],
  "expected_counter": "expected buyer counter-move (in Portuguese)",
  "close_signals": ["signal 1", "signal 2", "signal 3", "signal 4"],
  "script_opener": "exact words to open negotiation (in Portuguese, use buyer name)"
}

Deal:
${dealContext}`,
          },
        ],
      })

      const content = message.content[0]
      if (content.type === 'text') {
        try {
          const parsed = JSON.parse(content.text) as NegotiationResponse
          return NextResponse.json(parsed)
        } catch {
          return NextResponse.json(fallbackNegotiation(deal))
        }
      }
    } catch (aiErr) {
      console.warn('[negotiation] Claude error:', aiErr instanceof Error ? aiErr.message : aiErr)
    }

    return NextResponse.json(fallbackNegotiation(deal))
  } catch (err) {
    console.error('[negotiation]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
