import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 30

const client = new Anthropic()

// Monetary correction coefficients (Portugal, INE)
const COEFS: Record<number, number> = {
  2010: 1.31, 2011: 1.28, 2012: 1.25, 2013: 1.24, 2014: 1.24,
  2015: 1.23, 2016: 1.22, 2017: 1.21, 2018: 1.18, 2019: 1.15,
  2020: 1.14, 2021: 1.11, 2022: 1.06, 2023: 1.03, 2024: 1.02, 2025: 1.01, 2026: 1.0,
}

function calcMaisValias(purchasePrice: number, salePrice: number, purchaseYear: number, isHPP: boolean): number {
  if (isHPP) return 0
  const coef = COEFS[purchaseYear] || 1.0
  const adjustedCost = purchasePrice * coef + purchasePrice * 0.025 // stamp duty + notary
  const gain = salePrice - adjustedCost
  if (gain <= 0) return 0
  return gain * 0.5 * 0.28 // 50% exclusion × 28% IRS flat rate
}

function calcIRR(cashFlows: number[]): number {
  let irr = 0.08
  for (let i = 0; i < 100; i++) {
    let npv = 0, dnpv = 0
    cashFlows.forEach((cf, t) => {
      const disc = Math.pow(1 + irr, t)
      npv += cf / disc
      dnpv -= t * cf / (disc * (1 + irr))
    })
    if (Math.abs(dnpv) < 1e-10) break
    const newIrr = irr - npv / dnpv
    if (Math.abs(newIrr - irr) < 0.0001) { irr = newIrr; break }
    irr = newIrr
  }
  return irr
}

export async function POST(req: NextRequest) {
  try {
    const {
      purchasePrice, zona, tipo, area,
      downPaymentPct, loanRate, loanTermYears,
      monthlyRent, occupancyRate, annualRentGrowth,
      annualAppreciation, condominiumMonthly, imiAnnual,
      maintenancePct, managementFeePct,
      isHPP, exitYears,
    } = await req.json()

    if (!purchasePrice || purchasePrice <= 0) {
      return NextResponse.json({ error: 'Preço de compra inválido' }, { status: 400 })
    }

    const currentYear = new Date().getFullYear()
    const loanAmount = purchasePrice * (1 - downPaymentPct / 100)
    const monthlyRate = loanRate / 100 / 12
    const nPayments = loanTermYears * 12
    const monthlyPayment = loanAmount > 0
      ? loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, nPayments)) / (Math.pow(1 + monthlyRate, nPayments) - 1)
      : 0

    // Acquisition costs
    const imtCalc = (() => {
      if (isHPP) {
        if (purchasePrice <= 97064) return 0
        if (purchasePrice <= 132774) return purchasePrice * 0.02 - 1941.28
        if (purchasePrice <= 181034) return purchasePrice * 0.05 - 5924.50
        if (purchasePrice <= 301688) return purchasePrice * 0.07 - 9545.18
        if (purchasePrice <= 603289) return purchasePrice * 0.08 - 12562.06
        return purchasePrice * 0.06
      } else {
        if (purchasePrice <= 97064) return purchasePrice * 0.01
        if (purchasePrice <= 132774) return purchasePrice * 0.02 - 970.64
        if (purchasePrice <= 181034) return purchasePrice * 0.05 - 4954.50
        if (purchasePrice <= 301688) return purchasePrice * 0.07 - 8573.90
        if (purchasePrice <= 578598) return purchasePrice * 0.08 - 11590.78
        if (purchasePrice <= 1050400) return purchasePrice * 0.06
        return purchasePrice * 0.075
      }
    })()

    const acquisitionCosts = imtCalc + purchasePrice * 0.008 + 750 + purchasePrice * 0.01
    const initialEquity = purchasePrice * downPaymentPct / 100
    const totalInitialInvestment = initialEquity + acquisitionCosts

    const years = exitYears || [3, 5, 7, 10, 15, 20]

    const scenarios = years.map((numYears: number) => {
      let propValue = purchasePrice
      let loanBalance = loanAmount
      let cumCashFlow = -totalInitialInvestment
      let totalRent = 0
      let totalOpEx = 0
      const yearlyFlows: number[] = [-totalInitialInvestment]

      for (let y = 1; y <= numYears; y++) {
        propValue *= (1 + annualAppreciation / 100)
        const yearRent = (monthlyRent * 12) * Math.pow(1 + annualRentGrowth / 100, y - 1) * (occupancyRate / 100)
        const yearOpEx = (condominiumMonthly * 12) + imiAnnual + (propValue * maintenancePct / 100) + (yearRent * managementFeePct / 100)
        const yearMortgage = monthlyPayment * 12

        // Proper amortization
        let yearInterest = 0, yearPrincipal = 0
        for (let m = 0; m < 12; m++) {
          const interest = loanBalance * monthlyRate
          const principal = monthlyPayment - interest
          yearInterest += interest
          yearPrincipal += principal
          loanBalance = Math.max(0, loanBalance - principal)
        }

        const netYearCF = yearRent - yearOpEx - yearMortgage
        cumCashFlow += netYearCF
        totalRent += yearRent
        totalOpEx += yearOpEx + yearMortgage
        yearlyFlows.push(netYearCF)
      }

      const agentFee = propValue * 0.05
      const maisValias = calcMaisValias(purchasePrice, propValue, currentYear, isHPP)
      const netSaleProceeds = propValue - agentFee - maisValias - Math.max(0, loanBalance)
      const totalProfit = cumCashFlow + netSaleProceeds

      // IRR: replace last flow with sale proceeds added
      yearlyFlows[yearlyFlows.length - 1] += netSaleProceeds
      const irr = calcIRR(yearlyFlows)

      const grossYield = (monthlyRent * 12 / purchasePrice) * 100
      const netYield = ((monthlyRent * 12 * occupancyRate / 100) - (condominiumMonthly * 12 + imiAnnual + purchasePrice * maintenancePct / 100)) / purchasePrice * 100
      const cashOnCash = numYears > 0 ? ((totalRent - totalOpEx) / totalInitialInvestment / numYears) * 100 : 0

      return {
        years: numYears,
        exitYear: currentYear + numYears,
        propertyValue: Math.round(propValue),
        loanBalance: Math.round(Math.max(0, loanBalance)),
        equity: Math.round(propValue - Math.max(0, loanBalance)),
        totalRentalIncome: Math.round(totalRent),
        totalExpenses: Math.round(totalOpEx),
        netSaleProceeds: Math.round(netSaleProceeds),
        maisValias: Math.round(maisValias),
        agentFee: Math.round(agentFee),
        totalProfit: Math.round(totalProfit),
        roi: parseFloat(((totalProfit / totalInitialInvestment) * 100).toFixed(2)),
        irr: parseFloat((irr * 100).toFixed(2)),
        cashOnCash: parseFloat(cashOnCash.toFixed(2)),
        grossYield: parseFloat(grossYield.toFixed(2)),
        netYield: parseFloat(netYield.toFixed(2)),
        monthlyPayment: Math.round(monthlyPayment),
        totalInitialInvestment: Math.round(totalInitialInvestment),
        acquisitionCosts: Math.round(acquisitionCosts),
        imt: Math.round(imtCalc),
        breakEven: totalProfit > 0,
      }
    })

    const bestScenario = scenarios.reduce((best: typeof scenarios[0], s: typeof scenarios[0]) => s.irr > best.irr ? s : best, scenarios[0])

    // AI Commentary
    const prompt = `És Carlos Feiteira, especialista em investimento imobiliário da Agency Group (AMI 22506).

SIMULAÇÃO DE SAÍDA — ${tipo || 'Imóvel'} em ${zona || 'Portugal'} · €${(purchasePrice/1e6).toFixed(2)}M · ${area || '—'}m²
Entrada: ${downPaymentPct}% · Taxa: ${loanRate}% · Renda: €${monthlyRent}/mês · Ocupação: ${occupancyRate}%

CENÁRIOS (Top 3 por IRR):
${scenarios.slice(0, 3).map((s: typeof scenarios[0]) => `- Ano ${s.years}: IRR ${s.irr}% · ROI ${s.roi}% · Lucro €${(s.totalProfit/1e3).toFixed(0)}K · Mais-Valias €${(s.maisValias/1e3).toFixed(0)}K`).join('\n')}

MELHOR CENÁRIO: Saída ao Ano ${bestScenario.years} com IRR ${bestScenario.irr}%

Responde em JSON compacto:
{
  "headline": "frase de impacto sobre este investimento (máx 12 palavras)",
  "verdict": "Excelente|Bom|Razoável|Fraco|Negativo",
  "verdictColor": "green|gold|orange|red",
  "reasoning": "análise concisa em 2 frases do potencial real deste investimento",
  "risks": ["risco específico 1", "risco 2"],
  "opportunities": ["oportunidade 1", "oportunidade 2"],
  "optimalExitStrategy": "estratégia de saída óptima em 1-2 frases",
  "taxOptimization": "conselho fiscal específico (NHR/IFICI, residência, timing de venda)",
  "marketContext": "contexto actual do mercado ${zona || 'Portugal'} em 1 frase"
}`

    const aiRes = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    })

    const aiText = aiRes.content[0].type === 'text' ? aiRes.content[0].text : '{}'
    const aiClean = aiText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const aiAnalysis = JSON.parse(aiClean)

    return NextResponse.json({
      success: true,
      scenarios,
      bestScenario,
      summary: {
        totalInitialInvestment: scenarios[0].totalInitialInvestment,
        monthlyPayment: scenarios[0].monthlyPayment,
        acquisitionCosts: scenarios[0].acquisitionCosts,
        imt: scenarios[0].imt,
        loanAmount: Math.round(loanAmount),
        grossYield: scenarios[0].grossYield,
        netYield: scenarios[0].netYield,
      },
      ai: aiAnalysis,
    })
  } catch (error) {
    console.error('[Exit Simulator] Error:', error)
    return NextResponse.json({ error: 'Erro na simulação de saída' }, { status: 500 })
  }
}
