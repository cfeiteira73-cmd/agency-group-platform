import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 45

const client = new Anthropic()

// 6-hour cache
let pulseCache: { data: unknown; ts: number } | null = null
const CACHE_TTL = 6 * 60 * 60 * 1000

const ZONES = {
  Lisboa:   { pm2: 5200, yoy: 8.2,  yield: 3.8, dom: 85,  trend: 'up',     foreign: 42, badge: 'Capital' },
  Cascais:  { pm2: 4950, yoy: 11.3, yield: 3.2, dom: 72,  trend: 'up',     foreign: 55, badge: 'Prime Coast' },
  Comporta: { pm2: 6800, yoy: 18.5, yield: 4.1, dom: 120, trend: 'strong', foreign: 68, badge: 'Ultra Prime' },
  Porto:    { pm2: 3800, yoy: 7.1,  yield: 4.5, dom: 95,  trend: 'up',     foreign: 35, badge: 'North' },
  Algarve:  { pm2: 4100, yoy: 9.8,  yield: 5.2, dom: 110, trend: 'up',     foreign: 61, badge: 'South' },
  Madeira:  { pm2: 3950, yoy: 14.2, yield: 5.8, dom: 130, trend: 'strong', foreign: 44, badge: 'Island' },
  Sintra:   { pm2: 3200, yoy: 6.5,  yield: 4.2, dom: 100, trend: 'stable', foreign: 28, badge: 'Heritage' },
  Ericeira: { pm2: 3600, yoy: 12.1, yield: 4.9, dom: 90,  trend: 'up',     foreign: 38, badge: 'Surf' },
}

const MACRO = {
  euribor6m: 2.85, euribor12m: 2.65, ecbRate: 2.50,
  inflationPT: 2.8, gdpGrowthPT: 2.1, unemploymentPT: 6.4,
  transacoes2025: 169812, medianaPortugal: 3076, foreignBuyersTotal: 44,
  credHabitacao: '+12% YoY', ltvAvg: '70%', spreadAvg: '1.2%',
}

export async function POST(req: NextRequest) {
  try {
    const { zona, force } = await req.json()

    if (!force && pulseCache && Date.now() - pulseCache.ts < CACHE_TTL) {
      return NextResponse.json({ success: true, ...(pulseCache.data as object), cached: true })
    }

    const today = new Date().toLocaleDateString('pt-PT', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    })
    const zonaData = zona ? ZONES[zona as keyof typeof ZONES] : null

    const prompt = `És o Chief Research Officer da Agency Group (AMI 22506), o melhor especialista em mercado imobiliário de luxo em Portugal.

DATA: ${today}

DADOS MACRO (ao vivo):
Euribor 6M: ${MACRO.euribor6m}% | Euribor 12M: ${MACRO.euribor12m}% | BCE: ${MACRO.ecbRate}%
Inflação PT: ${MACRO.inflationPT}% | PIB PT: +${MACRO.gdpGrowthPT}% | Desemprego: ${MACRO.unemploymentPT}%
Transacções 2025: ${MACRO.transacoes2025.toLocaleString('pt-PT')} | Mediana: €${MACRO.medianaPortugal}/m²
Crédito habitação: ${MACRO.credHabitacao} | LTV médio: ${MACRO.ltvAvg} | Spread médio: ${MACRO.spreadAvg}
Compradores estrangeiros: ${MACRO.foreignBuyersTotal}% das transacções

${zonaData ? `FOCO EM ${zona.toUpperCase()}:
€${zonaData.pm2}/m² | YoY: +${zonaData.yoy}% | Yield: ${zonaData.yield}% | DOM: ${zonaData.dom} dias | ${zonaData.foreign}% estrangeiros`
: `TODAS AS ZONAS:
${Object.entries(ZONES).map(([z, d]) => `${z}: €${d.pm2}/m² · +${d.yoy}% · ${d.trend}`).join('\n')}`}

Gera o Market Pulse diário da Agency Group em JSON em português europeu formal. Deve ser informativo, actionable e exclusivo:
{
  "date": "${today}",
  "headline": "manchete de mercado impactante (máx 12 palavras, citar dados reais)",
  "sentiment": "Bullish|Neutral|Cautious|Bearish",
  "sentimentScore": número_1_a_10,
  "executiveSummary": "resumo executivo de 2-3 frases com dados concretos e perspectiva",
  "macroSignals": [
    { "signal": "sinal macro específico com número", "impact": "positivo|negativo|neutro", "relevance": "alta|média|baixa", "detail": "implicação prática para o mercado PT" }
  ],
  "zoneHighlights": [
    { "zona": "nome", "alert": "observação específica e accionável desta zona", "type": "opportunity|warning|info|record" }
  ],
  "buyerActivity": {
    "mostActive": ["nacionalidade1 (% estimado)", "nacionalidade2"],
    "hotZones": ["zona1", "zona2"],
    "insight": "padrão de comportamento dos compradores esta semana",
    "avgDecisionTime": "tempo médio de decisão de compra actual"
  },
  "interestRateOutlook": {
    "current": "${MACRO.euribor6m}%",
    "3months": "previsão Euribor 3 meses",
    "impact": "impacto concreto no crédito habitação — ex: € por €100K"
  },
  "agentActions": [
    { "action": "acção específica para hoje", "priority": "alta|média", "why": "porquê agora" }
  ],
  "weeklyForecast": "previsão específica para esta semana com dados e razão",
  "topOpportunity": {
    "description": "melhor oportunidade de mercado actual com contexto",
    "zona": "zona",
    "urgency": "alta|média",
    "timeWindow": "janela de oportunidade (ex: próximas 2 semanas)"
  },
  "riskAlert": "risco de mercado actual a monitorizar (ou null se não houver)"
}`

    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const pulse = JSON.parse(clean)

    const result = {
      ...pulse,
      macroData: MACRO,
      zonaData: zona ? { zona, ...zonaData } : ZONES,
      generatedAt: new Date().toISOString(),
      nextUpdate: new Date(Date.now() + CACHE_TTL).toISOString(),
    }

    pulseCache = { data: result, ts: Date.now() }
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('[Market Pulse] Error:', error)
    return NextResponse.json({ error: 'Erro ao gerar Market Pulse' }, { status: 500 })
  }
}
