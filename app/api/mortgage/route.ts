import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const MortgageSchema = z.object({
  montante:         z.coerce.number().min(10_000, 'Montante mínimo €10.000'),
  entrada_pct:      z.coerce.number().min(0).max(100).optional().default(20),
  prazo:            z.coerce.number().int().min(5).max(40).optional().default(30),
  spread:           z.coerce.number().min(0).max(10, 'Spread inválido: máximo 10%').optional().default(1.4),
  uso:              z.string().optional().default('habitacao_propria'),
  rendimento_anual: z.coerce.number().min(0).optional().default(0),
})

// ─── Fallback rates (used only if live fetch fails) ───────────────────────────
const EURIBOR_6M_FALLBACK  = 0.0295
const EURIBOR_12M_FALLBACK = 0.0278

// ─── Fetch live Euribor from our /api/rates endpoint ─────────────────────────
async function fetchLiveEuribor(): Promise<{ euribor_6m: number; euribor_12m: number; source: string }> {
  try {
    const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.agencygroup.pt'
    const res = await fetch(`${base}/api/rates`, {
      next: { revalidate: 14400 },
      headers: { 'Content-Type': 'application/json' },
    })
    if (!res.ok) throw new Error(`/api/rates HTTP ${res.status}`)
    const data = await res.json()
    if (typeof data.euribor_6m !== 'number') throw new Error('invalid rates payload')
    return {
      euribor_6m:  data.euribor_6m,
      euribor_12m: data.euribor_12m ?? EURIBOR_12M_FALLBACK,
      source: data.sources?.join(', ') ?? 'live',
    }
  } catch {
    return { euribor_6m: EURIBOR_6M_FALLBACK, euribor_12m: EURIBOR_12M_FALLBACK, source: 'fallback' }
  }
}

// Portuguese IRS mortgage deduction (artigo 85º CIRS)
const DEDUCAO_IRS_RATE = 0.15
const DEDUCAO_IRS_MAX  = 296  // €296/year max for primary residence

// IMI rates (urban property, typical municipal average)
const IMI_URBANO = 0.003  // 0.3%

// ─── Financial helpers ──────────────────────────────────────────────────────

/** Standard annuity (PMT) formula */
function calcPMT(principal: number, annualRate: number, months: number): number {
  if (annualRate === 0) return principal / months
  const r = annualRate / 12
  return principal * (r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1)
}

/** Newton-Raphson TAEG (APR) calculation — converges in <50 iterations typically */
function calcTAEG(pmt: number, principal: number, months: number, processingFees: number): number {
  let r = 0.005
  const netPrincipal = principal - processingFees
  for (let i = 0; i < 500; i++) {
    let pv = 0
    let dpv = 0
    for (let k = 1; k <= months; k++) {
      const disc = Math.pow(1 + r, k)
      pv  +=  pmt / disc
      dpv -= (k * pmt) / (disc * (1 + r))
    }
    const f = pv - netPrincipal
    const rNew = r - f / dpv
    if (Math.abs(rNew - r) < 1e-10) { r = rNew; break }
    r = rNew > 0 ? rNew : 0.001
  }
  return Math.pow(1 + r, 12) - 1
}

/** Portuguese IRS progressive scale 2026 */
function calcIRS(rendimento: number): number {
  const brackets = [
    { ate: 7703,     taxa: 0.1325 },
    { ate: 11623,    taxa: 0.18   },
    { ate: 16472,    taxa: 0.23   },
    { ate: 22218,    taxa: 0.26   },
    { ate: 28400,    taxa: 0.3275 },
    { ate: 40524,    taxa: 0.37   },
    { ate: 80000,    taxa: 0.435  },
    { ate: Infinity, taxa: 0.48   },
  ]
  let tax = 0
  let prev = 0
  for (const b of brackets) {
    if (rendimento <= prev) break
    tax += (Math.min(rendimento, b.ate) - prev) * b.taxa
    prev = b.ate
    if (b.ate === Infinity) break
  }
  return tax
}

/** IMT calculation — Portuguese property transfer tax (2026 brackets) */
function calcIMT(p: number, habitPropria: boolean): number {
  if (habitPropria) {
    // Primary residence brackets 2026 (Portaria 306-A/2025)
    if (p <= 97064)   return 0
    if (p <= 132774)  return p * 0.02  - 1941.28
    if (p <= 182349)  return p * 0.05  - 5924.50
    if (p <= 316772)  return p * 0.07  - 9561.46
    if (p <= 633453)  return p * 0.08  - 16729.20
    if (p <= 1_050_400) return p * 0.06
    return p * 0.075
  } else {
    // Investment / secondary home — no exemption bracket
    if (p <= 97064)   return p * 0.01
    if (p <= 132774)  return p * 0.02  - 971.64
    if (p <= 182349)  return p * 0.05  - 4953.87
    if (p <= 316772)  return p * 0.07  - 8599.91
    if (p <= 633453)  return p * 0.08  - 16768.08
    if (p <= 1_050_400) return p * 0.06
    return p * 0.075
  }
}

// ─── Route handler ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const [rawBody, liveRates] = await Promise.all([
      req.json(),
      fetchLiveEuribor(),
    ])

    const parsed = MortgageSchema.safeParse(rawBody)
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors
      const firstFieldError = Object.values(fieldErrors).find(msgs => msgs && msgs.length > 0)
      const errorMessage = firstFieldError ? firstFieldError[0] : 'Dados inválidos'
      return NextResponse.json({ error: errorMessage, details: parsed.error.flatten() }, { status: 400 })
    }
    const body = parsed.data

    const EURIBOR_6M  = liveRates.euribor_6m
    const EURIBOR_12M = liveRates.euribor_12m

    const montante   = body.montante
    const entradaPct = body.entrada_pct
    const prazoAnos  = body.prazo
    const spreadPct  = body.spread
    const uso        = body.uso
    const rendimento = body.rendimento_anual

    const habitPropria = uso === 'habitacao_propria'
    const entrada      = montante * (entradaPct / 100)
    const capital      = montante - entrada
    const ltv          = capital / montante
    const ltvMax       = habitPropria ? 0.90 : 0.75

    if (ltv > ltvMax + 0.001) {
      return NextResponse.json(
        {
          error: `LTV máximo ${(ltvMax * 100).toFixed(0)}% para ${habitPropria ? 'habitação própria' : 'investimento'}. Entrada mínima: €${Math.ceil(montante * (1 - ltvMax)).toLocaleString('pt-PT')}.`,
        },
        { status: 400 }
      )
    }

    // ── Core calculations ───────────────────────────────────────────────────
    const spreadDec   = spreadPct / 100
    const tan         = EURIBOR_6M + spreadDec
    const prazoMeses  = prazoAnos * 12

    const pmt         = calcPMT(capital, tan, prazoMeses)
    const totalPago   = pmt * prazoMeses
    const totalJuros  = totalPago - capital

    // ── Acquisition costs ────────────────────────────────────────────────────
    const imt             = calcIMT(montante, habitPropria)
    const is              = montante * 0.008          // Imposto de Selo 0.8%
    const advogado        = 1_500                      // avg legal fees
    const registo         = 500                        // land registry
    const bankProcessing  = montante * 0.003           // bank setup fees ~0.3%
    const processingFees  = advogado + registo + bankProcessing
    const totalAquisicao  = montante + imt + is + processingFees

    // ── TAEG (APR) ───────────────────────────────────────────────────────────
    const taeg = calcTAEG(pmt, capital, prazoMeses, processingFees)

    // ── IRS deduction estimate (year 1 interest) ─────────────────────────────
    // Approximate first-year interest using annuity interest component
    const r = tan / 12
    const juros1oAno = pmt * 12 - (capital * r * 12 * Math.pow(1 + r, 0) / (Math.pow(1 + r, prazoMeses) - 1)) * prazoMeses / prazoAnos
    // Simpler approximation: first year interest ≈ capital * tan (early in loan)
    const juros1oAnoSimple = capital * tan * (1 - 1 / (2 * prazoMeses))
    const deducao_irs = habitPropria
      ? Math.min(juros1oAnoSimple * DEDUCAO_IRS_RATE, DEDUCAO_IRS_MAX)
      : 0

    // ── IMI annual estimate ───────────────────────────────────────────────────
    const imi_anual = Math.round(montante * IMI_URBANO)

    // ── Stress-test scenarios ─────────────────────────────────────────────────
    const cenarios = [
      {
        label:   `Actual (Euribor ${(EURIBOR_6M * 100).toFixed(2)}% + spread ${spreadPct}%)`,
        tan_pct: parseFloat((tan * 100).toFixed(3)),
        pmt:     Math.round(pmt),
      },
      {
        label:   'Euribor +1% (stress test)',
        tan_pct: parseFloat(((tan + 0.01) * 100).toFixed(3)),
        pmt:     Math.round(calcPMT(capital, tan + 0.01, prazoMeses)),
      },
      {
        label:   'Euribor −1% (cenário optimista)',
        tan_pct: parseFloat((Math.max(tan - 0.01, 0.005) * 100).toFixed(3)),
        pmt:     Math.round(calcPMT(capital, Math.max(tan - 0.01, 0.005), prazoMeses)),
      },
      {
        label:   'Euribor 0% (cenário mínimo histórico)',
        tan_pct: parseFloat((spreadDec * 100).toFixed(3)),
        pmt:     Math.round(calcPMT(capital, spreadDec, prazoMeses)),
      },
    ]

    // ── Amortization table (up to 30 years shown) ─────────────────────────────
    const tabela: Array<{
      ano: number
      prestacao_anual: number
      juros: number
      amortizacao: number
      saldo: number
      capital_pago_acum: number
    }> = []

    let saldo           = capital
    let capitalPagoCum  = 0
    const rMes          = tan / 12

    for (let ano = 1; ano <= Math.min(prazoAnos, 30); ano++) {
      let juroAno = 0
      let amorAno = 0
      for (let m = 0; m < 12 && saldo > 0.01; m++) {
        const jMes = saldo * rMes
        const aMes = Math.min(pmt - jMes, saldo)
        juroAno   += jMes
        amorAno   += aMes
        saldo      = Math.max(0, saldo - aMes)
      }
      capitalPagoCum += amorAno
      tabela.push({
        ano,
        prestacao_anual:     Math.round(pmt * 12),
        juros:               Math.round(juroAno),
        amortizacao:         Math.round(amorAno),
        saldo:               Math.round(saldo),
        capital_pago_acum:   Math.round(capitalPagoCum),
      })
    }

    // ── DSTI affordability (Banco de Portugal max 35%) ────────────────────────
    const dsti    = rendimento > 0 ? (pmt / (rendimento / 12)) * 100 : null
    const dsti_ok = dsti !== null ? dsti <= 35 : null

    // ── IRS impact (if rendimento provided) ──────────────────────────────────
    const irs_sem_deducao = rendimento > 0 ? Math.round(calcIRS(rendimento)) : null
    const irs_com_deducao = rendimento > 0 && habitPropria
      ? Math.round(Math.max(0, calcIRS(rendimento) - deducao_irs))
      : irs_sem_deducao

    return NextResponse.json({
      success: true,
      inputs: {
        montante,
        entrada:    Math.round(entrada),
        capital:    Math.round(capital),
        ltv_pct:    parseFloat((ltv * 100).toFixed(1)),
        prazo_anos: prazoAnos,
        spread_pct: spreadPct,
        tan_pct:    parseFloat((tan * 100).toFixed(3)),
        uso,
      },
      resultado: {
        prestacao_mensal:      Math.round(pmt),
        tan_pct:               parseFloat((tan * 100).toFixed(3)),
        taeg_pct:              parseFloat((taeg * 100).toFixed(3)),
        total_capital:         Math.round(capital),
        total_juros:           Math.round(totalJuros),
        total_pago:            Math.round(totalPago),
        custo_total_aquisicao: Math.round(totalAquisicao),
        imt_estimado:          Math.round(imt),
        is_estimado:           Math.round(is),
        custos_legais:         Math.round(advogado + registo),
        imi_anual,
        deducao_irs_ano1:      Math.round(deducao_irs),
        euribor_6m_pct:        parseFloat((EURIBOR_6M * 100).toFixed(2)),
        euribor_12m_pct:       parseFloat((EURIBOR_12M * 100).toFixed(2)),
      },
      acessibilidade: dsti !== null
        ? {
            dsti_pct: parseFloat(dsti.toFixed(1)),
            dsti_ok,
            nota: dsti_ok
              ? `DSTI de ${dsti.toFixed(1)}% está dentro dos limites do Banco de Portugal (≤35%). Aprovação provável.`
              : `DSTI de ${dsti.toFixed(1)}% excede a recomendação BdP de 35%. Considere aumentar o prazo, aumentar a entrada, ou reduzir o montante. Aprovação bancária em risco.`,
            rendimento_anual:     rendimento,
            irs_estimado_sem_ded: irs_sem_deducao,
            irs_estimado_com_ded: irs_com_deducao,
            poupanca_irs_anual:   habitPropria && irs_sem_deducao !== null && irs_com_deducao !== null
              ? irs_sem_deducao - irs_com_deducao
              : 0,
          }
        : null,
      cenarios,
      tabela_amortizacao: tabela,
      info: {
        euribor_fonte:  `BCE — ${new Date().toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })} (${liveRates.source})`,
        imt_tabela:     'Portaria 2025 (habitação própria) — estimativa. Confirme com advogado.',
        nota_legal:     'Simulação indicativa. Não constitui proposta de crédito. Sujeito a aprovação bancária, avaliação do imóvel e condições individuais do cliente. Consulte o seu banco ou intermediário de crédito registado.',
        intermediario:  'Agency Group — geral@agencygroup.pt — AMI 22506',
      },
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro interno no servidor' },
      { status: 500 }
    )
  }
}
