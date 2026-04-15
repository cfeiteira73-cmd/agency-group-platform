import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { isPortalAuth } from '@/lib/portalAuth'

export const runtime = 'nodejs'
export const maxDuration = 60

const client = new Anthropic()

export async function POST(req: NextRequest) {
  if (!(await isPortalAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const { property, investorType, horizon, irrTarget, language, budget } = await req.json()

    const langInstructions: Record<string, string> = {
      PT: 'Responde em Português europeu formal.',
      EN: 'Respond in formal British English.',
      FR: 'Réponds en français formel.',
      AR: 'الرجاء الرد باللغة العربية الفصحى.',
    }

    const prompt = `És o director de investment banking imobiliário mais sénior do mundo — ex-Goldman Sachs Real Estate, Savills Capital Markets, Knight Frank Global Capital Markets. Especializas-te em imobiliário de luxo em Portugal.

Gera um INVESTOR PITCH MEMORANDUM completo, rigoroso e persuasivo para o seguinte imóvel:

IMÓVEL:
- Nome: ${property.nome}
- Localização: ${property.zona}, ${property.bairro || ''}
- Tipo: ${property.tipo}
- Preço: €${Number(property.preco).toLocaleString('pt-PT')}
- Área: ${property.area}m²
- Quartos: ${property.quartos} | WC: ${property.casasBanho || '—'}
- Piscina: ${property.piscina ? 'Sim' : 'Não'} | Garagem: ${property.garagem ? 'Sim' : 'Não'} | Terraço: ${property.terraco ? 'Sim' : 'Não'}
- Preço/m²: €${property.preco && property.area ? Math.round(property.preco/property.area).toLocaleString('pt-PT') : '—'}/m²
- Badge: ${property.badge || 'Standard'}

PERFIL DO INVESTIDOR:
- Tipo: ${investorType}
- Horizonte: ${horizon} anos
- IRR Target: ${irrTarget}%+
- Budget disponível: €${Number(budget || property.preco).toLocaleString('pt-PT')}

DADOS DE MERCADO PORTUGAL 2026 (usar estes dados reais):
- Mercado: €3.076/m² mediana nacional · +17,6% YoY · 169.812 transacções
- Lisboa: €5.000/m² | Cascais: €4.713/m² | Algarve: €3.941/m² | Porto: €3.643/m²
- Luxo Lisboa: Top 5 mundial (Savills 2026) · 210 dias médio de mercado
- Compradores internacionais: Norte-americanos 16% · Franceses 13% · Britânicos 9% · Chineses 8%
- Previsão 2026–2027: +4% a +5,9% valorização adicional

${langInstructions[language] || langInstructions['EN']}

Gera o pitch em JSON com esta estrutura exacta:
{
  "title": "Título do pitch (máx 10 palavras)",
  "tagline": "Frase de impacto do investimento (máx 15 palavras)",
  "executiveSummary": "Sumário executivo — 3-4 parágrafos densos, específicos e persuasivos",
  "investmentThesis": "Tese de investimento — porque agora, porque esta zona, porque este imóvel — 2-3 parágrafos",
  "marketPosition": {
    "headline": "Posicionamento de mercado (1 frase)",
    "zonePm2": number,
    "imoPm2": number,
    "discount": "% acima ou abaixo mediana da zona",
    "marketMomentum": "Momentum do mercado (1-2 frases)",
    "demandDrivers": ["driver1", "driver2", "driver3", "driver4"]
  },
  "financialModel": {
    "acquisitionCost": number,
    "estimatedRent": number,
    "yieldBruto": number,
    "yieldLiquido": number,
    "cashOnCash": number,
    "projectedValue3Y": number,
    "projectedValue5Y": number,
    "projectedValue${horizon}Y": number,
    "irr": number,
    "totalReturn": number,
    "breakeven": "Período de break-even",
    "exitStrategy": "Estratégia de saída recomendada"
  },
  "riskMatrix": [
    { "risk": "Risco 1", "probability": "Baixa|Média|Alta", "impact": "Baixo|Médio|Alto", "mitigation": "Mitigação" },
    { "risk": "Risco 2", "probability": "Baixa|Média|Alta", "impact": "Baixo|Médio|Alto", "mitigation": "Mitigação" },
    { "risk": "Risco 3", "probability": "Baixa|Média|Alta", "impact": "Baixo|Médio|Alto", "mitigation": "Mitigação" }
  ],
  "taxAdvantages": ["Vantagem fiscal 1", "Vantagem fiscal 2", "Vantagem fiscal 3"],
  "comparables": [
    { "address": "Endereço similar", "area": number, "price": number, "pm2": number, "date": "Q1 2026" },
    { "address": "Endereço similar", "area": number, "price": number, "pm2": number, "date": "Q4 2025" }
  ],
  "recommendation": "COMPRAR | COMPRAR COM PRECAUÇÃO | ANÁLISE ADICIONAL",
  "confidenceScore": number,
  "keyRisks": ["Risco crítico 1", "Risco crítico 2"],
  "uniqueSellingPoints": ["USP1", "USP2", "USP3", "USP4"],
  "actionPlan": ["Passo 1 — prazo", "Passo 2 — prazo", "Passo 3 — prazo", "Passo 4 — prazo"],
  "disclaimer": "Disclaimer legal"
}`

    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }]
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    try {
      const result = JSON.parse(clean)
      return NextResponse.json({ success: true, pitch: result })
    } catch {
      return NextResponse.json({ error: 'Parse failed', raw: text }, { status: 500 })
    }
  } catch (error) {
    console.error('investor-pitch error:', error)
    return NextResponse.json({ error: 'Failed to generate pitch' }, { status: 500 })
  }
}
