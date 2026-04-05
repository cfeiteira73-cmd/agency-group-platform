import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 30

const client = new Anthropic()

const MARKETS: Record<string, {
  country: string; flag: string; pm2: number; yoy: number; grossYield: number
  transferTax: number; annualPropertyTax: number; capitalGainsTax: number
  nhr: boolean; goldenVisa: boolean; language: string; currency: string
  avgDays: number; foreignBuyersPct: number; ltvMax: number; stability: number
}> = {
  'Lisboa':    { country: 'Portugal', flag: '🇵🇹', pm2: 5200, yoy: 8.2,  grossYield: 3.8, transferTax: 6,  annualPropertyTax: 0.3,  capitalGainsTax: 28, nhr: true,  goldenVisa: false, language: 'PT', currency: 'EUR', avgDays: 85,  foreignBuyersPct: 42, ltvMax: 80, stability: 9 },
  'Cascais':   { country: 'Portugal', flag: '🇵🇹', pm2: 4950, yoy: 11.3, grossYield: 3.2, transferTax: 6,  annualPropertyTax: 0.3,  capitalGainsTax: 28, nhr: true,  goldenVisa: false, language: 'PT', currency: 'EUR', avgDays: 72,  foreignBuyersPct: 55, ltvMax: 80, stability: 9 },
  'Comporta':  { country: 'Portugal', flag: '🇵🇹', pm2: 6800, yoy: 18.5, grossYield: 4.1, transferTax: 6,  annualPropertyTax: 0.3,  capitalGainsTax: 28, nhr: true,  goldenVisa: false, language: 'PT', currency: 'EUR', avgDays: 120, foreignBuyersPct: 68, ltvMax: 75, stability: 9 },
  'Algarve':   { country: 'Portugal', flag: '🇵🇹', pm2: 4100, yoy: 9.8,  grossYield: 5.2, transferTax: 6,  annualPropertyTax: 0.3,  capitalGainsTax: 28, nhr: true,  goldenVisa: false, language: 'PT', currency: 'EUR', avgDays: 110, foreignBuyersPct: 61, ltvMax: 75, stability: 9 },
  'Porto':     { country: 'Portugal', flag: '🇵🇹', pm2: 3800, yoy: 7.1,  grossYield: 4.5, transferTax: 6,  annualPropertyTax: 0.3,  capitalGainsTax: 28, nhr: true,  goldenVisa: false, language: 'PT', currency: 'EUR', avgDays: 95,  foreignBuyersPct: 35, ltvMax: 80, stability: 9 },
  'Madeira':   { country: 'Portugal', flag: '🇵🇹', pm2: 3950, yoy: 14.2, grossYield: 5.8, transferTax: 6,  annualPropertyTax: 0.3,  capitalGainsTax: 28, nhr: true,  goldenVisa: false, language: 'PT', currency: 'EUR', avgDays: 130, foreignBuyersPct: 44, ltvMax: 75, stability: 9 },
  'Barcelona': { country: 'Spain',    flag: '🇪🇸', pm2: 4800, yoy: 7.5,  grossYield: 3.5, transferTax: 10, annualPropertyTax: 0.4,  capitalGainsTax: 24, nhr: false, goldenVisa: false, language: 'ES', currency: 'EUR', avgDays: 90,  foreignBuyersPct: 28, ltvMax: 80, stability: 8 },
  'Madrid':    { country: 'Spain',    flag: '🇪🇸', pm2: 4200, yoy: 8.1,  grossYield: 4.0, transferTax: 6,  annualPropertyTax: 0.4,  capitalGainsTax: 24, nhr: false, goldenVisa: false, language: 'ES', currency: 'EUR', avgDays: 85,  foreignBuyersPct: 22, ltvMax: 80, stability: 8 },
  'Milano':    { country: 'Italy',    flag: '🇮🇹', pm2: 4100, yoy: 5.2,  grossYield: 3.0, transferTax: 9,  annualPropertyTax: 0.76, capitalGainsTax: 26, nhr: false, goldenVisa: true,  language: 'IT', currency: 'EUR', avgDays: 120, foreignBuyersPct: 15, ltvMax: 70, stability: 7 },
  'Paris':     { country: 'France',   flag: '🇫🇷', pm2: 9800, yoy: 2.1,  grossYield: 2.5, transferTax: 8,  annualPropertyTax: 0.5,  capitalGainsTax: 30, nhr: false, goldenVisa: false, language: 'FR', currency: 'EUR', avgDays: 95,  foreignBuyersPct: 12, ltvMax: 75, stability: 8 },
  'Dubai':     { country: 'UAE',      flag: '🇦🇪', pm2: 3200, yoy: 12.8, grossYield: 6.5, transferTax: 4,  annualPropertyTax: 0,    capitalGainsTax: 0,  nhr: false, goldenVisa: true,  language: 'EN', currency: 'AED', avgDays: 60,  foreignBuyersPct: 72, ltvMax: 75, stability: 7 },
  'London':    { country: 'UK',       flag: '🇬🇧', pm2: 12500, yoy: 1.8, grossYield: 2.8, transferTax: 12, annualPropertyTax: 1.2,  capitalGainsTax: 28, nhr: false, goldenVisa: false, language: 'EN', currency: 'GBP', avgDays: 100, foreignBuyersPct: 18, ltvMax: 75, stability: 8 },
}

function scoreMarket(m: typeof MARKETS[string], profile: string, budget: number): number {
  let score = 0
  if (profile === 'yield_focused') {
    score = m.grossYield * 15 + (10 - m.transferTax) * 3 + m.stability * 2
  } else if (profile === 'appreciation_focused') {
    score = m.yoy * 4 + m.stability * 3 + m.foreignBuyersPct * 0.1
  } else if (profile === 'tax_optimized') {
    score = (m.nhr ? 30 : 0) + (30 - m.capitalGainsTax) + (15 - m.transferTax) * 2 + (m.annualPropertyTax < 0.4 ? 15 : 0)
  } else { // lifestyle
    score = m.stability * 4 + (m.nhr ? 20 : 0) + m.foreignBuyersPct * 0.2 + (m.country === 'Portugal' ? 15 : 0)
  }
  // Budget fit: can buy at least 100m²?
  if (budget && budget / m.pm2 < 80) score -= 10
  return Math.min(100, Math.round(score))
}

export async function POST(req: NextRequest) {
  try {
    const { markets, budget, investorProfile, nationality, purpose } = await req.json()

    const selectedKeys = (markets && markets.length > 0 ? markets : Object.keys(MARKETS)).slice(0, 8)

    const comparisons = selectedKeys.map((key: string) => {
      const m = MARKETS[key]
      if (!m) return null
      const canBuyM2 = budget ? Math.floor(budget / m.pm2) : null
      const annualRent = budget ? Math.round(budget * m.grossYield / 100) : null
      const annualTaxCost = budget ? Math.round(budget * m.annualPropertyTax / 100) : null
      const acquisitionCost = budget ? Math.round(budget * m.transferTax / 100) : null
      const netYield = parseFloat((m.grossYield - m.annualPropertyTax - (acquisitionCost && budget ? acquisitionCost / budget / 10 * 100 : 0)).toFixed(2))
      const score = scoreMarket(m, investorProfile || 'lifestyle', budget || 1000000)

      return {
        market: key,
        country: m.country,
        flag: m.flag,
        pm2: m.pm2,
        yoy: m.yoy,
        grossYield: m.grossYield,
        netYield,
        transferTax: m.transferTax,
        annualPropertyTax: m.annualPropertyTax,
        capitalGainsTax: m.capitalGainsTax,
        nhr: m.nhr,
        goldenVisa: m.goldenVisa,
        currency: m.currency,
        avgDays: m.avgDays,
        foreignBuyersPct: m.foreignBuyersPct,
        ltvMax: m.ltvMax,
        stability: m.stability,
        canBuyM2,
        annualRent,
        annualTaxCost,
        acquisitionCost,
        score,
      }
    }).filter(Boolean)

    comparisons.sort((a: typeof comparisons[0], b: typeof comparisons[0]) => (b?.score || 0) - (a?.score || 0))
    const winner = comparisons[0]

    const prompt = `És Carlos Feiteira, consultor de investimento imobiliário internacional da Agency Group (AMI 22506), especialista em Portugal e mercados europeus.

COMPARAÇÃO INTERNACIONAL para:
- Budget: ${budget ? `€${(budget/1e6).toFixed(1)}M` : 'não definido'}
- Perfil: ${investorProfile || 'não definido'}
- Nacionalidade: ${nationality || 'não definida'}
- Objectivo: ${purpose || 'investimento'}

MERCADOS COMPARADOS (top 5 por score):
${comparisons.slice(0, 5).map((c: typeof comparisons[0]) => c ? `${c.flag} ${c.market} (${c.country}): €${c.pm2}/m² · +${c.yoy}% · Yield ${c.grossYield}% · IMT ${c.transferTax}% · CGT ${c.capitalGainsTax}%${c.nhr ? ' · NHR ✓' : ''}${c.goldenVisa ? ' · Golden Visa ✓' : ''}` : '').join('\n')}

VENCEDOR por score: ${winner?.flag} ${winner?.market} (${winner?.score}/100)

Responde em JSON compacto em português europeu:
{
  "winner": "${winner?.market}",
  "winnerReason": "porque ${winner?.market} é o melhor choice para este perfil (1-2 frases com dados)",
  "agGroupPitch": "argumento de venda para Portugal + Agency Group (mencionar AMI 22506, NHR/IFICI, mercado 2026)",
  "insights": [
    { "market": "nome", "pro": "vantagem específica", "con": "desvantagem concreta", "bestFor": "tipo de investidor" }
  ],
  "taxComparison": "análise fiscal resumida — Portugal vs top alternativa (dados concretos)",
  "yieldLeader": "mercado com melhor yield e porquê",
  "appreciationLeader": "mercado com melhor valorização e porquê",
  "recommendation": "recomendação final personalizada para ${investorProfile || 'este'} investidor (2-3 frases)"
}`

    const aiRes = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    })

    const aiText = aiRes.content[0].type === 'text' ? aiRes.content[0].text : '{}'
    const aiClean = aiText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const ai = JSON.parse(aiClean)

    return NextResponse.json({
      success: true,
      comparisons,
      winner,
      ai,
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Cross Compare] Error:', error)
    return NextResponse.json({ error: 'Erro na comparação de mercados' }, { status: 500 })
  }
}
