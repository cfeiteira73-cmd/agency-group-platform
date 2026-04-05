import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const FinancingSchema = z.object({
  country_code:     z.string().toUpperCase().default('OTHER'),
  montante:         z.coerce.number().min(50_000, 'Montante mínimo €50.000'),
  rendimento_anual: z.coerce.number().min(0).optional().default(0),
  prazo:            z.coerce.number().int().min(5).max(40).optional().default(25),
})

// ─── Country-specific mortgage criteria for Portugal property ─────────────────
// Based on Portuguese bank underwriting guidelines for non-resident buyers (2026)
// Sources: BdP circular 3/2019, major PT bank published criteria

interface CountryProfile {
  ltv_max: number           // Maximum Loan-to-Value
  dsti_max: number          // Max Debt-Service-to-Income (%)
  prazo_max: number         // Max term (years)
  spread_typical: number    // Typical spread above Euribor (%)
  spread_range: [number, number]
  notes: string[]
  islamic_finance: boolean  // Murabaha/Ijara available
  special_regime: boolean   // Special visa-linked advantages
  banks_recommended: string[]
  difficulty: 'Fácil' | 'Moderado' | 'Difícil' | 'Complexo'
  flag: string
}

const COUNTRY_PROFILES: Record<string, CountryProfile> = {
  // ── EU/EEA — treated near-identically to PT residents ──────────────────────
  FR: {
    ltv_max: 0.80, dsti_max: 35, prazo_max: 30, spread_typical: 1.5, spread_range: [1.2, 2.0],
    notes: [
      'Tratamento equivalente a residente UE — LTV até 80%',
      'Rendimentos franceses aceites com declaração fiscale + 3 últimos recibos',
      'IAS francês (CAF) não conta no DSTI',
      'NHR/IFICI pode reduzir imposto a 20% sobre rendimentos PT',
    ],
    islamic_finance: false, special_regime: true,
    banks_recommended: ['Millennium BCP', 'BPI', 'Santander Portugal'],
    difficulty: 'Fácil', flag: '🇫🇷',
  },
  DE: {
    ltv_max: 0.80, dsti_max: 35, prazo_max: 30, spread_typical: 1.5, spread_range: [1.2, 2.0],
    notes: [
      'Rendimentos alemães documentados com Lohnzettel + Steuererklärung',
      'LTV até 80% para residência secundária',
      'CDT Portugal-Alemanha — sem dupla tributação sobre rendas',
      'Avaliação pelo banco obrigatória (custo €400–800)',
    ],
    islamic_finance: false, special_regime: true,
    banks_recommended: ['Millennium BCP', 'CGD', 'BPI'],
    difficulty: 'Fácil', flag: '🇩🇪',
  },
  GB: {
    ltv_max: 0.70, dsti_max: 35, prazo_max: 30, spread_typical: 1.8, spread_range: [1.4, 2.5],
    notes: [
      'Post-Brexit: tratado como não-UE — LTV reduzido para 70%',
      'Rendimentos em GBP aceites com conversão BCE do dia',
      'SDLT (Stamp Duty Land Tax) britânico não impacta crédito PT',
      'Contas offshore em PT facilitam aprovação bancária',
      'Recomendado: conta bancária PT antes do pedido de crédito',
    ],
    islamic_finance: false, special_regime: false,
    banks_recommended: ['Millennium BCP', 'Santander Portugal', 'Novo Banco'],
    difficulty: 'Moderado', flag: '🇬🇧',
  },
  US: {
    ltv_max: 0.65, dsti_max: 33, prazo_max: 25, spread_typical: 2.0, spread_range: [1.6, 2.8],
    notes: [
      'FATCA compliance obrigatório — banco reporta à IRS americana',
      'LTV máximo 65% — bancos PT mais cautelosos com americanos',
      'Rendimentos em USD: conversão + 10% safety margin aplicado',
      'Recomendado: financiamento em Portugal + conta bancária PT prévia',
      'Alternativa: financiamento via private bank (HSBC, Citi) com colateral',
      'FBAR filing obrigatório para contas PT > $10.000 USD',
    ],
    islamic_finance: false, special_regime: false,
    banks_recommended: ['Millennium BCP', 'Santander Portugal'],
    difficulty: 'Difícil', flag: '🇺🇸',
  },
  CN: {
    ltv_max: 0.60, dsti_max: 30, prazo_max: 20, spread_typical: 2.2, spread_range: [1.8, 3.0],
    notes: [
      'Controlo de capitais chinês: limite anual USD 50.000/pessoa saída',
      'Transferência > €50K exige declaração SAFE e justificação',
      'Recomendado: estruturação via empresa offshore (HK/BVI) para transferência',
      'LTV 60% — risco cambial CNY/EUR penalizado pelos bancos PT',
      'Prova de fonte de fundos rigorosa: 6 meses de extractos bancários',
      'Golden Visa encerrado mas D8 Digital Nomad disponível',
    ],
    islamic_finance: false, special_regime: false,
    banks_recommended: ['BPI (parceria BCP/ABSA)', 'Millennium BCP'],
    difficulty: 'Complexo', flag: '🇨🇳',
  },
  AE: {
    ltv_max: 0.65, dsti_max: 35, prazo_max: 25, spread_typical: 1.9, spread_range: [1.5, 2.6],
    notes: [
      'Islamic finance disponível em alguns bancos PT (Murabaha estruturado)',
      'Rendimentos isentos de imposto nos EAU — bonus: sem IR a comprovar',
      'Prova de rendimento via payslips + employer letter autenticado',
      'Transferência UAE: sem controlo de capitais — processo mais simples',
      'Residência Dourada PT disponível com imóvel > €500K',
    ],
    islamic_finance: true, special_regime: false,
    banks_recommended: ['Millennium BCP', 'BPI', 'CGD'],
    difficulty: 'Moderado', flag: '🇦🇪',
  },
  BR: {
    ltv_max: 0.75, dsti_max: 35, prazo_max: 30, spread_typical: 1.6, spread_range: [1.3, 2.2],
    notes: [
      'CPLP: cidadãos brasileiros têm estatuto equiparado a residente UE em PT',
      'LTV até 75% — tratamento próximo a residente',
      'Rendimentos em BRL: conversão + volatilidade cambial considerada',
      'Conta bancária PT facilita muito o processo — recomendado abrir antes',
      'DSTI calculado sobre rendimento bruto declarado em IR brasileiro',
    ],
    islamic_finance: false, special_regime: true,
    banks_recommended: ['Millennium BCP', 'BPI', 'Santander', 'CGD'],
    difficulty: 'Fácil', flag: '🇧🇷',
  },
  SA: {
    ltv_max: 0.65, dsti_max: 35, prazo_max: 25, spread_typical: 1.9, spread_range: [1.5, 2.6],
    notes: [
      'Islamic finance disponível (Murabaha/Ijara) — contactar BPI ou Millennium BCP',
      'Rendimentos isentos de imposto na KSA — documentação patronal rigorosa',
      'Transferência internacional saudita: SAMA compliance necessário',
      'Vision 2030: crescente interesse saudita em imóveis europeus',
    ],
    islamic_finance: true, special_regime: false,
    banks_recommended: ['Millennium BCP', 'BPI'],
    difficulty: 'Moderado', flag: '🇸🇦',
  },
  CA: {
    ltv_max: 0.70, dsti_max: 35, prazo_max: 25, spread_typical: 1.9, spread_range: [1.5, 2.5],
    notes: [
      'Rendimentos em CAD: conversão BCE aplicada',
      'FINTRAC (canadiano) não afecta processo bancário PT',
      'D7/NHR disponível para reformados canadianos',
      'Processo similar ao americano mas ligeiramente mais simples',
    ],
    islamic_finance: false, special_regime: false,
    banks_recommended: ['Millennium BCP', 'Santander Portugal'],
    difficulty: 'Moderado', flag: '🇨🇦',
  },
  AU: {
    ltv_max: 0.70, dsti_max: 35, prazo_max: 25, spread_typical: 1.9, spread_range: [1.5, 2.5],
    notes: [
      'Rendimentos em AUD: conversão BCE aplicada com margem 5%',
      'FIRB (Foreign Investment Review Board) não se aplica a PT',
      'Popularidade crescente de PT entre profissionais australianos',
      'D8 Digital Nomad: ideal para trabalhadores remotos',
    ],
    islamic_finance: false, special_regime: false,
    banks_recommended: ['Millennium BCP', 'BPI'],
    difficulty: 'Moderado', flag: '🇦🇺',
  },
  // Generic fallback
  OTHER: {
    ltv_max: 0.60, dsti_max: 30, prazo_max: 20, spread_typical: 2.5, spread_range: [2.0, 3.5],
    notes: [
      'Não-residente de país terceiro: critérios conservadores aplicados',
      'LTV 60% como ponto de partida — negociável com mais entrada',
      'Conta bancária PT e NIF obrigatórios antes do pedido',
      'Recomendado contactar advogado especializado em direito imobiliário PT',
    ],
    islamic_finance: false, special_regime: false,
    banks_recommended: ['Millennium BCP', 'BPI'],
    difficulty: 'Complexo', flag: '🌍',
  },
}

// ─── Euribor 6M (fallback) ───────────────────────────────────────────────────
const EURIBOR_6M = 0.0295

function calcPMT(principal: number, annualRate: number, months: number): number {
  if (annualRate === 0) return principal / months
  const r = annualRate / 12
  return principal * (r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1)
}

// ─── POST /api/financing ─────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const raw = await req.json()
    const parsed = FinancingSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }
    const { country_code, montante, rendimento_anual: rendimento, prazo } = parsed.data

    const profile = COUNTRY_PROFILES[country_code] ?? COUNTRY_PROFILES.OTHER

    // ── Calculate scenarios ──────────────────────────────────────────────────
    const euribor = EURIBOR_6M
    const spreadMin = profile.spread_range[0] / 100
    const spreadTyp = profile.spread_typical / 100
    const spreadMax = profile.spread_range[1] / 100

    const entrada_min  = montante * (1 - profile.ltv_max)
    const capital_max  = montante * profile.ltv_max
    const prazoMeses   = Math.min(prazo, profile.prazo_max) * 12

    const tan_min = euribor + spreadMin
    const tan_typ = euribor + spreadTyp
    const tan_max = euribor + spreadMax

    const pmt_best = calcPMT(capital_max, tan_min, prazoMeses)
    const pmt_typ  = calcPMT(capital_max, tan_typ, prazoMeses)
    const pmt_worst= calcPMT(capital_max, tan_max, prazoMeses)

    // ── DSTI check ───────────────────────────────────────────────────────────
    const dsti_typ  = rendimento > 0 ? (pmt_typ / (rendimento / 12)) * 100 : null
    const dsti_ok   = dsti_typ !== null ? dsti_typ <= profile.dsti_max : null
    const max_loan_dsti = rendimento > 0
      ? (() => {
          const maxPmt = (rendimento / 12) * (profile.dsti_max / 100)
          const r = tan_typ / 12
          return Math.round(maxPmt * (1 - Math.pow(1 + r, -prazoMeses)) / r)
        })()
      : null

    // ── Acquisition costs ────────────────────────────────────────────────────
    const imt_est = montante > 633453 ? montante * 0.075
      : montante > 316772 ? montante * 0.08 - 16728
      : montante > 182349 ? montante * 0.07 - 9561
      : montante > 132774 ? montante * 0.05 - 5924
      : montante > 97064  ? montante * 0.02 - 1941
      : 0
    const is_est     = montante * 0.008
    const total_acq  = Math.round(montante + imt_est + is_est + 2500)

    return NextResponse.json({
      ok: true,
      country: {
        code:  country_code,
        flag:  profile.flag,
        difficulty: profile.difficulty,
      },
      financiamento: {
        ltv_max_pct:      Math.round(profile.ltv_max * 100),
        entrada_minima:   Math.round(entrada_min),
        capital_maximo:   Math.round(capital_max),
        prazo_max_anos:   profile.prazo_max,
        dsti_max_pct:     profile.dsti_max,
        spread_tipico_pct: profile.spread_typical,
        spread_range:     profile.spread_range,
        euribor_6m_pct:   parseFloat((euribor * 100).toFixed(2)),
        tan_tipico_pct:   parseFloat((tan_typ * 100).toFixed(3)),
      },
      prestacoes: {
        melhor_cenario:   Math.round(pmt_best),
        cenario_tipico:   Math.round(pmt_typ),
        pior_cenario:     Math.round(pmt_worst),
      },
      acessibilidade: rendimento > 0 ? {
        dsti_pct:         dsti_typ !== null ? parseFloat(dsti_typ.toFixed(1)) : null,
        dsti_ok,
        capital_maximo_dsti: max_loan_dsti,
        nota: dsti_ok === false
          ? `DSTI estimado de ${dsti_typ?.toFixed(1)}% excede o limite bancário de ${profile.dsti_max}% para compradores de ${country_code}. Máximo financiamento pelo DSTI: €${max_loan_dsti?.toLocaleString('pt-PT')}.`
          : `Rendimento compatível com financiamento de €${capital_max.toLocaleString('pt-PT')}.`,
      } : null,
      custos_aquisicao: {
        imt_estimado:  Math.round(imt_est),
        is_estimado:   Math.round(is_est),
        total_estimado: total_acq,
      },
      notas: profile.notes,
      islamic_finance: profile.islamic_finance,
      special_regime: profile.special_regime,
      bancos_recomendados: profile.banks_recommended,
      info: {
        nota_legal: 'Simulação indicativa. Critérios sujeitos a alteração. Confirme com banco e advogado especializado.',
        fonte_euribor: 'BCE — Março 2026 (fallback)',
        agencia: 'Agency Group — geral@agencygroup.pt — AMI 22506',
      },
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
