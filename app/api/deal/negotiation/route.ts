import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 30

const client = new Anthropic()

export async function POST(req: NextRequest) {
  try {
    const { deal, contact, agentName } = await req.json()

    const prompt = `És ${agentName || 'Carlos Feiteira'}, agente sénior de imobiliário de luxo da Agency Group (AMI 22506).

Estás em fase de negociação. Cria uma estratégia de negociação em português europeu formal.

DEAL:
- Imóvel: ${deal.imovel}
- Valor pedido: ${deal.valor}
- Fase: ${deal.fase}
- Comprador: ${deal.comprador || '—'}
- Notas: ${deal.notas || '—'}

CLIENTE:
- Nome: ${contact?.name || deal.comprador || '—'}
- Perfil: ${contact?.nationality || '—'} · Budget ${contact ? `€${((contact.budgetMin||0)/1e6).toFixed(1)}M–€${((contact.budgetMax||0)/1e6).toFixed(1)}M` : '—'}
- Status: ${contact?.status || '—'}

Responde em JSON:
{
  "strategy": "Nome da estratégia (ex: Ancoragem, BATNA, etc.)",
  "openingPosition": "Como abrir a negociação — 1 frase directa",
  "keyArguments": ["argumento1", "argumento2", "argumento3"],
  "concessions": ["concessão possível 1", "concessão possível 2"],
  "redLines": ["o que nunca ceder 1", "o que nunca ceder 2"],
  "closingScript": "Script de fecho — 2-3 frases para fechar o negócio",
  "alternativeIfFails": "O que fazer se a negociação falhar",
  "priceGuidance": "Preço alvo e margem máxima de desconto em %"
}`

    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }]
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    try {
      const result = JSON.parse(clean)
      return NextResponse.json({ success: true, negotiation: result })
    } catch {
      return NextResponse.json({ error: 'Parse error', raw: text }, { status: 500 })
    }
  } catch (error) {
    console.error('Negotiation error:', error)
    return NextResponse.json({ error: 'Erro ao gerar estratégia' }, { status: 500 })
  }
}
