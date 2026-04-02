import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 60

const client = new Anthropic()

export async function POST(req: NextRequest) {
  try {
    const { property, photoAnalyses, persona } = await req.json()

    const photosContext = photoAnalyses && photoAnalyses.length > 0
      ? `\nFOTOS ANALISADAS:\n${photoAnalyses.map((a: Record<string, unknown>, i: number) =>
          `- Foto ${i + 1}: ${a.roomType} | Qualidade ${a.qualityScore}/10 | ${(a.highlights as string[]).join(', ')} | ${a.descriptionPt}`
        ).join('\n')}`
      : ''

    const personaContext = persona ? `\nPERFIL DO COMPRADOR ALVO: ${persona}` : ''

    const prompt = `És o melhor copywriter de imobiliário de luxo do mundo. Dominas neuromarketing, storytelling emocional e copy de conversão. Escreves para as melhores agências — Sotheby's, Christie's, Knight Frank.

DADOS DO IMÓVEL:
- Nome: ${property.nome}
- Tipo: ${property.tipo}
- Zona: ${property.zona}${property.bairro ? `, ${property.bairro}` : ''}
- Preço: €${Number(property.preco).toLocaleString('pt-PT')}
- Área: ${property.area}m²
- Quartos: ${property.quartos} | Casas de Banho: ${property.casasBanho}
- Características: ${[property.piscina && 'Piscina', property.jardim && 'Jardim', property.terraco && 'Terraço', property.garagem && 'Garagem', property.condominio && 'Condomínio'].filter(Boolean).join(', ') || 'N/D'}
- Vista: ${property.vista || 'N/D'}
- Energia: ${property.energia || 'N/D'}${photosContext}${personaContext}

Gera uma descrição usando NEUROMARKETING de elite. Responde APENAS com JSON válido (sem markdown):

{
  "headline": "Título principal poderoso — máx 12 palavras, evocativo, específico, emocional",
  "subheadline": "Subtítulo que cria desejo — máx 20 palavras, benefício emocional + racional",
  "descriptionMain": "Descrição principal em português de luxo — 4-5 parágrafos. Usa: sensações, lifestyle, escassez, exclusividade, pertença. NUNCA uses clichés genéricos. Cada parágrafo deve pintar um quadro mental específico.",
  "descriptionShort": "Versão curta para portais — máx 150 palavras, impactante, inclui os dados-chave",
  "lifestyleStory": "Um parágrafo que conta a história de como é viver neste imóvel — um dia típico do proprietário, sensações, momentos",
  "keyFeatures": ["6-8 características únicas e específicas deste imóvel em bullet points — NÃO genéricos"],
  "investmentAngle": "Parágrafo sobre ângulo de investimento — valorização zona, yield potencial, liquidez, perfil comprador",
  "ctaText": "Call to action exclusivo e urgente — 1 frase, máx 15 palavras",
  "seoTitle": "Título SEO otimizado — máx 65 caracteres",
  "seoDescription": "Meta description SEO — máx 155 caracteres",
  "whatsappText": "Mensagem WhatsApp para partilhar com cliente — máx 100 palavras, informal mas profissional"
}`

    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }]
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
    const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    try {
      const description = JSON.parse(cleanText)
      return NextResponse.json({ description })
    } catch {
      return NextResponse.json({ error: 'Failed to parse description', raw: text }, { status: 500 })
    }
  } catch (error) {
    console.error('generate-description error:', error)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
