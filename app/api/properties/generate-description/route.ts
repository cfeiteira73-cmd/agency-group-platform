import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { isPortalAuth } from '@/lib/portalAuth'

export const runtime = 'nodejs'
export const maxDuration = 90

const client = new Anthropic()

// Zone market data for context
const ZONE_DATA: Record<string, { avgPriceM2: number; appreciation5y: number; demandLevel: string; topBuyers: string }> = {
  'Lisboa':       { avgPriceM2: 5000,  appreciation5y: 68, demandLevel: 'Muito Alta', topBuyers: 'Americanos (16%), Franceses (13%), Britânicos (9%)' },
  'Cascais':      { avgPriceM2: 4713,  appreciation5y: 54, demandLevel: 'Alta',       topBuyers: 'Britânicos, Americanos, Franceses' },
  'Comporta':     { avgPriceM2: 4200,  appreciation5y: 89, demandLevel: 'Muito Alta', topBuyers: 'Portugueses HNWI, Franceses, Brasileiros' },
  'Algarve':      { avgPriceM2: 3941,  appreciation5y: 48, demandLevel: 'Alta',       topBuyers: 'Britânicos, Alemães, Nórdicos' },
  'Porto':        { avgPriceM2: 3643,  appreciation5y: 61, demandLevel: 'Alta',       topBuyers: 'Americanos, Brasileiros, Franceses' },
  'Madeira':      { avgPriceM2: 3760,  appreciation5y: 72, demandLevel: 'Muito Alta', topBuyers: 'HNWI globais, Britânicos, Alemães' },
  'Sintra':       { avgPriceM2: 3200,  appreciation5y: 38, demandLevel: 'Média-Alta', topBuyers: 'Portugueses, Britânicos, Americanos' },
  'Ericeira':     { avgPriceM2: 2800,  appreciation5y: 55, demandLevel: 'Alta',       topBuyers: 'Portugueses, Britânicos, Surfistas internacionais' },
}

export async function POST(req: NextRequest) {
  if (!(await isPortalAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const { property, photoAnalyses, persona, formats } = await req.json()

    const zoneData = ZONE_DATA[property.zona] || { avgPriceM2: 4000, appreciation5y: 50, demandLevel: 'Alta', topBuyers: 'Internacionais' }
    const pricePerM2 = property.area > 0 ? Math.round(property.preco / property.area) : 0
    const priceVsAvg = pricePerM2 > 0 ? Math.round((pricePerM2 / zoneData.avgPriceM2 - 1) * 100) : 0
    const pricePositioning = priceVsAvg > 20 ? 'premium de mercado' : priceVsAvg > 0 ? 'acima da média da zona' : priceVsAvg > -15 ? 'competitivo para a zona' : 'excelente valor para a zona'

    const luxuryIndicators = photoAnalyses?.flatMap((a: Record<string,unknown>) => a.luxuryIndicators as string[] || []).filter(Boolean) || []
    const uniqueLuxury = [...new Set(luxuryIndicators)].slice(0, 6)
    const avgPhotoQuality = photoAnalyses?.length > 0
      ? (photoAnalyses.reduce((s: number, a: Record<string,unknown>) => s + (Number(a.qualityScore) || 0), 0) / photoAnalyses.length).toFixed(1)
      : null

    const photosContext = photoAnalyses?.length > 0
      ? `\nFOTOS ANALISADAS (${photoAnalyses.length} fotos, qualidade média ${avgPhotoQuality}/10):\n${
          photoAnalyses.slice(0, 8).map((a: Record<string,unknown>, i: number) =>
            `• ${a.roomType}: ${(a.highlights as string[])?.join(', ')} | ${a.descriptionPt}`
          ).join('\n')
        }${uniqueLuxury.length > 0 ? `\nINDICADORES DE LUXO DETECTADOS: ${uniqueLuxury.join(', ')}` : ''}`
      : ''

    const personaContext = persona ? `\nPERFIL COMPRADOR ALVO: ${persona}` : ''

    const prompt = `És o director criativo de copy da Sotheby's International Realty e Knight Frank combinados. Tens 20 anos de experiência a vender as propriedades mais exclusivas do mundo. Dominas neuromarketing, storytelling emocional, FOMO de luxo, e copy de conversão para compradores HNWI.

DADOS DO IMÓVEL:
— Nome: ${property.nome}
— Tipo: ${property.tipo} | Zona: ${property.zona}${property.bairro ? `, ${property.bairro}` : ''}
— Preço: €${Number(property.preco).toLocaleString('pt-PT')} (${pricePositioning})
— Área: ${property.area}m² | €${pricePerM2.toLocaleString('pt-PT')}/m²
— Quartos: T${property.quartos} | Casas de Banho: ${property.casasBanho}
— Comodidades: ${[property.piscina && 'Piscina Privada', property.jardim && 'Jardim', property.terraco && 'Terraço Privativo', property.garagem && 'Garagem', property.condominio && 'Condomínio Fechado'].filter(Boolean).join(' · ') || 'N/D'}
— Vista: ${property.vista || 'N/D'} | Energia: ${property.energia || 'N/D'}${photosContext}

CONTEXTO DE MERCADO — ${property.zona}:
— Preço médio: €${zoneData.avgPriceM2.toLocaleString('pt-PT')}/m² | Este imóvel: €${pricePerM2.toLocaleString('pt-PT')}/m²
— Valorização 5 anos: +${zoneData.appreciation5y}%
— Procura: ${zoneData.demandLevel}
— Compradores dominantes: ${zoneData.topBuyers}${personaContext}

REGRAS DE COPYWRITING DE ELITE:
1. NUNCA uses clichés: "espaço luminoso", "excelente localização", "imóvel único", "não perca"
2. USA sensações específicas: o som das ondas às 6h, a luz dourada da tarde no Douro, o cheiro de pinheiros na Serra
3. CRIA escassez real: dado concreto de mercado, não vago
4. PINTA quadros mentais: o comprador deve ver-se a viver aqui
5. USA prova social implícita: "zona preferida por family offices europeus", não "muito procurado"
6. VARIA a estrutura por formato — Instagram é sensorial, LinkedIn é ROI, WhatsApp é pessoal
7. INCLUI sempre o ângulo fiscal/legal mais relevante para o perfil

Gera copy completo. Responde APENAS com JSON válido sem markdown:

{
  "headline": "Headline principal — máx 12 palavras, evocativo, específico, nenhum clichê",
  "subheadline": "Subtítulo — máx 22 palavras, benefício emocional + racional concreto",
  "descriptionMain": "Descrição premium — exactamente 4 parágrafos distintos: (1) abertura sensorial que pinta a experiência, (2) os espaços e a sua qualidade arquitectónica, (3) o lifestyle que este imóvel proporciona, (4) o ângulo estratégico (investimento/lifestyle/fiscal) com dado concreto de mercado. Total 350-500 palavras.",
  "descriptionShort": "Versão Idealista/portal — máx 180 palavras, inclui todos os dados-chave + posicionamento de preço + 1 dado de mercado",
  "lifestyleStory": "Micro-história de 80-100 palavras: um momento específico da vida do proprietário neste imóvel — sensorial, imersivo, desejável",
  "keyFeatures": ["8-10 características únicas e específicas deste imóvel exato — NUNCA genéricas. Usa dados concretos."],
  "investmentAngle": "Parágrafo de 100-120 palavras sobre investimento: valorização da zona (+${zoneData.appreciation5y}% em 5 anos), posicionamento do preço, perfil de comprador, yield potencial, liquidez",
  "ctaText": "CTA exclusivo — 1 frase urgente, máx 12 palavras, específico para este imóvel",
  "seoTitle": "Título SEO — máx 65 caracteres, inclui zona + tipo + ano",
  "seoDescription": "Meta description — exactamente 150-155 caracteres, inclui preço e zona",
  "instagram": "Caption Instagram — 180-220 palavras, abertura sensorial impactante, 2-3 emojis discretos, termina com questão ou statement poderoso, sem hashtags no body",
  "instagramHashtags": ["12-15 hashtags relevantes misturando PT/EN/mercado"],
  "linkedin": "Post LinkedIn — 200-250 palavras, ângulo de investimento + market intel + lifestyle. Tom: executivo sofisticado, não vendedor",
  "whatsapp": "Mensagem WhatsApp — 120-150 palavras, pessoal como de um amigo, inclui 2-3 emojis, termina com convite à visita",
  "emailSubject": "Subject line email — máx 60 caracteres, alta taxa de abertura",
  "emailBody": "Email completo — 300-350 palavras, estrutura: abertura personalizada > imóvel > mercado > próximo passo",
  "marketContext": "Parágrafo de 60-80 palavras sobre contexto de mercado desta zona em 2026 — específico e baseado nos dados fornecidos",
  "buyerPersonaMatch": "Para o perfil ${persona || 'HNWI Global'}: 60-80 palavras sobre porque este imóvel é perfeito para este perfil específico, incluindo ângulo fiscal/legal relevante"
}`

    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
    const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    try {
      const description = JSON.parse(cleanText)
      return NextResponse.json({
        description,
        meta: {
          persona: persona || 'HNWI Global',
          zoneData,
          pricePositioning,
          pricePerM2,
          avgPhotoQuality,
          luxuryIndicatorsDetected: uniqueLuxury,
        }
      })
    } catch {
      return NextResponse.json({ error: 'Failed to parse description', raw: text }, { status: 500 })
    }
  } catch (error) {
    console.error('generate-description error:', error)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
