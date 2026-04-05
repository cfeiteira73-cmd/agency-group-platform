import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const NHRSchema = z.object({
  pais:              z.string().default('UK'),
  tipo_rendimento:   z.enum(['salario', 'rendas', 'dividendos', 'pensao', 'mais_valias', 'crypto']).default('salario'),
  rendimento_anual:  z.coerce.number().min(1_000, 'Rendimento mínimo €1.000 para simulação relevante'),
  regime:            z.enum(['nhr', 'ifici', 'compare']).default('compare'),
  fonte_estrangeira: z.boolean().default(true),
})

// ─── Types ──────────────────────────────────────────────────────────────────

type Pais =
  | 'UK' | 'USA' | 'France' | 'Germany' | 'Brazil'
  | 'Netherlands' | 'Italy' | 'Spain' | 'Other'

type TipoRendimento =
  | 'salario' | 'rendas' | 'dividendos' | 'pensao' | 'mais_valias' | 'crypto'

type Regime = 'nhr' | 'ifici' | 'compare'

interface CountryProfile {
  name_pt:    string
  income_tax_max:  number // decimal
  income_tax_avg:  number // decimal (effective rate approximation)
  ss_rate:    number // decimal (employee contribution)
  treaty:     boolean // DTA with Portugal
}

// ─── Country tax data (2026) ─────────────────────────────────────────────────

const COUNTRIES: Record<string, CountryProfile> = {
  UK: {
    name_pt:        'Reino Unido',
    income_tax_max:  0.45,
    income_tax_avg:  0.40,
    ss_rate:         0.12,
    treaty:          true,
  },
  USA: {
    name_pt:        'Estados Unidos',
    income_tax_max:  0.37,
    income_tax_avg:  0.28,
    ss_rate:         0.0765,
    treaty:          true,
  },
  France: {
    name_pt:        'França',
    income_tax_max:  0.45,
    income_tax_avg:  0.41,
    ss_rate:         0.22,
    treaty:          true,
  },
  Germany: {
    name_pt:        'Alemanha',
    income_tax_max:  0.42,
    income_tax_avg:  0.37,
    ss_rate:         0.185,
    treaty:          true,
  },
  Brazil: {
    name_pt:        'Brasil',
    income_tax_max:  0.275,
    income_tax_avg:  0.22,
    ss_rate:         0.14,
    treaty:          false,
  },
  Netherlands: {
    name_pt:        'Países Baixos',
    income_tax_max:  0.495,
    income_tax_avg:  0.42,
    ss_rate:         0.179,
    treaty:          true,
  },
  Italy: {
    name_pt:        'Itália',
    income_tax_max:  0.43,
    income_tax_avg:  0.38,
    ss_rate:         0.0919,
    treaty:          true,
  },
  Spain: {
    name_pt:        'Espanha',
    income_tax_max:  0.47,
    income_tax_avg:  0.40,
    ss_rate:         0.0635,
    treaty:          true,
  },
  Other: {
    name_pt:        'Outro País',
    income_tax_max:  0.40,
    income_tax_avg:  0.33,
    ss_rate:         0.10,
    treaty:          false,
  },
}

// ─── Portuguese IRS progressive scale 2026 ──────────────────────────────────

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

// ─── Tax calculation per regime ──────────────────────────────────────────────

interface TaxResult {
  regime:          string
  imposto:         number
  taxa_efetiva_pct: number
  ss_contribuicao: number
  rendimento_liquido: number
}

function calcOrigemTax(rendimento: number, pais: string): TaxResult {
  const country = COUNTRIES[pais] ?? COUNTRIES['Other']
  const taxRate = rendimento > 150_000 ? country.income_tax_max : country.income_tax_avg
  const imposto = rendimento * taxRate
  const ss      = rendimento * country.ss_rate
  return {
    regime:              country.name_pt,
    imposto:             Math.round(imposto),
    taxa_efetiva_pct:    parseFloat((taxRate * 100).toFixed(1)),
    ss_contribuicao:     Math.round(ss),
    rendimento_liquido:  Math.round(rendimento - imposto - ss),
  }
}

function calcNHRTax(
  rendimento:     number,
  tipo:           TipoRendimento,
  fonteEstrangeira: boolean
): TaxResult {
  // NHR (original, pre-2024 applicants): flat 20% on PT-source, 0% on foreign source
  let imposto = 0
  let taxa    = 0

  if (fonteEstrangeira) {
    // Foreign source: most income exempt under NHR
    switch (tipo) {
      case 'salario':
        // 0% if from high-value activity or treaty country
        taxa    = 0
        imposto = 0
        break
      case 'dividendos':
        // Foreign dividends: 0% under NHR
        taxa    = 0
        imposto = 0
        break
      case 'rendas':
        // Foreign rental income: 0% if from treaty country, else 28%
        taxa    = 0
        imposto = 0
        break
      case 'pensao':
        // Pensions: 10% flat under NHR (post-2020 reform)
        taxa    = 0.10
        imposto = rendimento * taxa
        break
      case 'mais_valias':
        // Capital gains foreign: 0%
        taxa    = 0
        imposto = 0
        break
      case 'crypto':
        // Crypto: taxed at 28% in PT regardless (since 2023)
        taxa    = 0.28
        imposto = rendimento * taxa
        break
      default:
        taxa    = 0
        imposto = 0
    }
  } else {
    // PT-source income: flat 20% for high-value activities
    switch (tipo) {
      case 'salario':
        taxa    = 0.20
        imposto = rendimento * taxa
        break
      case 'dividendos':
        taxa    = 0.28
        imposto = rendimento * taxa
        break
      case 'rendas':
        taxa    = 0.28
        imposto = rendimento * taxa
        break
      case 'pensao':
        taxa    = 0.10
        imposto = rendimento * taxa
        break
      case 'mais_valias':
        taxa    = 0.28
        imposto = rendimento * taxa
        break
      case 'crypto':
        taxa    = 0.28
        imposto = rendimento * taxa
        break
      default:
        taxa    = 0.20
        imposto = rendimento * taxa
    }
  }

  // SS in Portugal: employee ~11% (capped at ~€5.400/mo base)
  const ss = tipo === 'salario' ? Math.min(rendimento * 0.11, 5_400 * 12 * 0.11) : 0

  return {
    regime:              'NHR (Residente Não Habitual)',
    imposto:             Math.round(imposto),
    taxa_efetiva_pct:    parseFloat((taxa * 100).toFixed(1)),
    ss_contribuicao:     Math.round(ss),
    rendimento_liquido:  Math.round(rendimento - imposto - ss),
  }
}

function calcIFICITax(rendimento: number, tipo: TipoRendimento): TaxResult {
  // IFICI (2024+): 20% flat on all qualified income; tech/research/arts/teachers
  let imposto = 0
  let taxa    = 0

  switch (tipo) {
    case 'salario':
      taxa    = 0.20
      imposto = rendimento * taxa
      break
    case 'dividendos':
      taxa    = 0.20
      imposto = rendimento * taxa
      break
    case 'rendas':
      taxa    = 0.20
      imposto = rendimento * taxa
      break
    case 'pensao':
      taxa    = 0.20
      imposto = rendimento * taxa
      break
    case 'mais_valias':
      taxa    = 0.20
      imposto = rendimento * taxa
      break
    case 'crypto':
      // Crypto remains 28% even under IFICI
      taxa    = 0.28
      imposto = rendimento * taxa
      break
    default:
      taxa    = 0.20
      imposto = rendimento * taxa
  }

  const ss = tipo === 'salario' ? Math.min(rendimento * 0.11, 5_400 * 12 * 0.11) : 0

  return {
    regime:              'IFICI (Incentivo Fiscal à Investigação Científica e Inovação)',
    imposto:             Math.round(imposto),
    taxa_efetiva_pct:    parseFloat((taxa * 100).toFixed(1)),
    ss_contribuicao:     Math.round(ss),
    rendimento_liquido:  Math.round(rendimento - imposto - ss),
  }
}

function calcPTNormalTax(rendimento: number, tipo: TipoRendimento): TaxResult {
  let imposto = 0
  let taxa    = 0

  if (tipo === 'dividendos' || tipo === 'mais_valias') {
    taxa    = 0.28
    imposto = rendimento * taxa
  } else if (tipo === 'rendas') {
    taxa    = 0.25
    imposto = rendimento * taxa
  } else if (tipo === 'crypto') {
    taxa    = 0.28
    imposto = rendimento * taxa
  } else {
    // Englobamento (progressive scale)
    imposto = calcIRS(rendimento)
    taxa    = rendimento > 0 ? imposto / rendimento : 0
  }

  const ss = tipo === 'salario' ? Math.min(rendimento * 0.11, 5_400 * 12 * 0.11) : 0

  return {
    regime:              'IRS Portugal (Regime Normal)',
    imposto:             Math.round(imposto),
    taxa_efetiva_pct:    parseFloat((taxa * 100).toFixed(2)),
    ss_contribuicao:     Math.round(ss),
    rendimento_liquido:  Math.round(rendimento - imposto - ss),
  }
}

/** Project 10-year savings with 3% annual income growth */
function calcPoupanca10Anos(
  base_rendimento: number,
  imposto_origem:  number,
  imposto_pt:      number,
  ss_origem:       number,
  ss_pt:           number,
  crescimento:     number = 0.03
): number {
  let total = 0
  for (let y = 1; y <= 10; y++) {
    const fator    = Math.pow(1 + crescimento, y - 1)
    const rend_y   = base_rendimento * fator
    const ratio_i  = base_rendimento > 0 ? imposto_origem / base_rendimento : 0
    const ratio_s  = base_rendimento > 0 ? ss_origem / base_rendimento : 0
    const ratio_ip = base_rendimento > 0 ? imposto_pt / base_rendimento : 0
    const ratio_sp = base_rendimento > 0 ? ss_pt / base_rendimento : 0
    total += rend_y * ((ratio_i + ratio_s) - (ratio_ip + ratio_sp))
  }
  return Math.round(total)
}

// ─── Route handler ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json()
    const parsed = NHRSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }
    const { pais, tipo_rendimento, rendimento_anual, regime, fonte_estrangeira } = parsed.data

    // Validate country exists in our dataset
    if (!COUNTRIES[pais]) {
      return NextResponse.json(
        { error: `País não reconhecido. Use: ${Object.keys(COUNTRIES).join(', ')}` },
        { status: 400 }
      )
    }

    // ── Calculations ─────────────────────────────────────────────────────────
    const origemResult = calcOrigemTax(rendimento_anual, pais)
    const nhrResult    = calcNHRTax(rendimento_anual, tipo_rendimento, fonte_estrangeira)
    const ificiResult  = calcIFICITax(rendimento_anual, tipo_rendimento)
    const ptNormal     = calcPTNormalTax(rendimento_anual, tipo_rendimento)

    // Savings vs. origin country
    const poupancaAnualNHR   = origemResult.rendimento_liquido - nhrResult.rendimento_liquido
    const poupancaAnualIFICI = origemResult.rendimento_liquido - ificiResult.rendimento_liquido

    // Note: positive = PT is better (more take-home), negative = PT is worse
    const poupancaNHR_vs_origem = nhrResult.rendimento_liquido - origemResult.rendimento_liquido
    const poupancaIFICI_vs_origem = ificiResult.rendimento_liquido - origemResult.rendimento_liquido

    // 10-year projections (3% growth)
    const proj10NHR = calcPoupanca10Anos(
      rendimento_anual,
      origemResult.imposto,
      nhrResult.imposto,
      origemResult.ss_contribuicao,
      nhrResult.ss_contribuicao,
    )
    const proj10IFICI = calcPoupanca10Anos(
      rendimento_anual,
      origemResult.imposto,
      ificiResult.imposto,
      origemResult.ss_contribuicao,
      ificiResult.ss_contribuicao,
    )

    // ── Best regime recommendation ────────────────────────────────────────────
    const liquidoMap = {
      nhr:       nhrResult.rendimento_liquido,
      ifici:     ificiResult.rendimento_liquido,
      pt_normal: ptNormal.rendimento_liquido,
      origem:    origemResult.rendimento_liquido,
    }
    const melhor = Object.entries(liquidoMap).sort((a, b) => b[1] - a[1])[0][0]

    let recomendacao = ''
    let recomendacao_detalhe = ''

    if (melhor === 'nhr') {
      recomendacao = 'NHR'
      recomendacao_detalhe = `NHR oferece o melhor rendimento líquido para este perfil (${tipo_rendimento} de fonte ${fonte_estrangeira ? 'estrangeira' : 'portuguesa'}). Poupança vs. ${COUNTRIES[pais]?.name_pt}: €${poupancaNHR_vs_origem.toLocaleString('pt-PT')}/ano.`
    } else if (melhor === 'ifici') {
      recomendacao = 'IFICI'
      recomendacao_detalhe = `IFICI (ex-NHR) é o regime mais vantajoso para este perfil. Recomendado para profissionais de tecnologia, investigação, artes ou docência. Poupança vs. ${COUNTRIES[pais]?.name_pt}: €${poupancaIFICI_vs_origem.toLocaleString('pt-PT')}/ano.`
    } else if (melhor === 'origem') {
      recomendacao = 'Manter no país de origem'
      recomendacao_detalhe = `Para este perfil específico, a carga fiscal no país de origem pode ser inferior. Recomendamos análise detalhada com advogado fiscal internacional.`
    } else {
      recomendacao = 'Regime Normal IRS Portugal'
      recomendacao_detalhe = 'O regime normal de IRS português é competitivo para este nível de rendimento.'
    }

    // ── Eligibility assessment ────────────────────────────────────────────────
    const elegibilidade_nhr = {
      elegivel: true,
      condicoes: [
        'Não ter sido residente fiscal em Portugal nos últimos 5 anos',
        'Instalar residência habitual em Portugal (arrendar ou adquirir imóvel)',
        'Requerer estatuto NHR até 31 de março do ano seguinte à instalação',
        'Manter residência fiscal em Portugal durante o período NHR (10 anos)',
      ],
      nota: 'O NHR original encerrou em 31/12/2023. Novos pedidos após essa data seguem o regime IFICI. Consulte advogado para situações específicas.',
      prazo_pedido: 'Até 31 de março do ano seguinte ao estabelecimento de residência',
    }

    const elegibilidade_ifici = {
      elegivel: true,
      atividades_qualificadas: [
        'Investigação científica e desenvolvimento',
        'Tecnologias de informação e software',
        'Indústrias criativas e artes',
        'Docência universitária',
        'Startups e empreendedorismo tecnológico',
        'Gestão de empresas cotadas ou grandes grupos',
      ],
      condicoes: [
        'Não ter sido residente fiscal em Portugal nos últimos 5 anos',
        'Exercer atividade profissional qualificada em Portugal',
        'Contrato de trabalho ou prestação de serviços a entidade portuguesa',
        'Taxa flat de 20% sobre rendimentos de trabalho qualificado',
      ],
      nota: 'IFICI aplica-se a rendimentos auferidos a partir de 2024. É compatível com rendimentos de múltiplas fontes.',
    }

    // ── Application process ────────────────────────────────────────────────────
    const processo = [
      {
        passo: 1,
        titulo: 'Obter NIF Fiscal Português',
        descricao: 'Num serviço de Finanças ou com procurador em Portugal. Pode ser feito remotamente.',
        prazo: '1–3 dias úteis',
        documentos: ['Passaporte válido', 'Prova de morada no país de origem'],
      },
      {
        passo: 2,
        titulo: 'Abrir Conta Bancária Portuguesa',
        descricao: 'Necessária para pagamentos de impostos e despesas correntes em Portugal.',
        prazo: '1–2 semanas',
        documentos: ['NIF', 'Passaporte', 'Prova de morada'],
      },
      {
        passo: 3,
        titulo: 'Estabelecer Residência em Portugal',
        descricao: 'Arrendar ou adquirir imóvel habitacional. O contrato é prova de residência habitual.',
        prazo: '2–8 semanas',
        documentos: ['Contrato de arrendamento ou escritura de compra'],
      },
      {
        passo: 4,
        titulo: 'Registar Residência Fiscal em Portugal',
        descricao: 'Alterar morada fiscal no Portal das Finanças (e.finance.gov.pt) ou presencialmente.',
        prazo: '1–2 dias',
        documentos: ['NIF', 'Prova de residência (contrato)'],
      },
      {
        passo: 5,
        titulo: 'Submeter Candidatura NHR/IFICI',
        descricao: 'No Portal das Finanças: Cidadãos → Serviços → Obter Estatuto → Residente Não Habitual.',
        prazo: 'Até 31 de março do ano seguinte ao da chegada',
        documentos: ['NIF activo', 'Morada fiscal PT', 'Declaração de atividade (IFICI)'],
      },
      {
        passo: 6,
        titulo: 'Validação pela Autoridade Tributária (AT)',
        descricao: 'A AT valida e confirma o estatuto. Emite certidão de RNH.',
        prazo: '4–6 semanas após candidatura',
        documentos: [],
      },
    ]

    // ── Build response ────────────────────────────────────────────────────────
    const responseBase = {
      success: true,
      perfil: {
        pais,
        pais_nome:         COUNTRIES[pais]?.name_pt,
        tipo_rendimento,
        rendimento_anual,
        fonte_estrangeira,
      },
      origem_fiscal: {
        pais:               COUNTRIES[pais]?.name_pt,
        imposto:            origemResult.imposto,
        taxa_efetiva_pct:   origemResult.taxa_efetiva_pct,
        ss_contribuicao:    origemResult.ss_contribuicao,
        rendimento_liquido: origemResult.rendimento_liquido,
        carga_total_pct:    parseFloat(
          (((origemResult.imposto + origemResult.ss_contribuicao) / rendimento_anual) * 100).toFixed(1)
        ),
      },
      nhr_portugal: {
        regime:             nhrResult.regime,
        imposto:            nhrResult.imposto,
        taxa_efetiva_pct:   nhrResult.taxa_efetiva_pct,
        ss_contribuicao:    nhrResult.ss_contribuicao,
        rendimento_liquido: nhrResult.rendimento_liquido,
        poupanca_vs_origem: poupancaNHR_vs_origem,
        poupanca_10_anos:   proj10NHR,
        carga_total_pct:    parseFloat(
          (((nhrResult.imposto + nhrResult.ss_contribuicao) / rendimento_anual) * 100).toFixed(1)
        ),
      },
      ifici_portugal: {
        regime:             ificiResult.regime,
        imposto:            ificiResult.imposto,
        taxa_efetiva_pct:   ificiResult.taxa_efetiva_pct,
        ss_contribuicao:    ificiResult.ss_contribuicao,
        rendimento_liquido: ificiResult.rendimento_liquido,
        poupanca_vs_origem: poupancaIFICI_vs_origem,
        poupanca_10_anos:   proj10IFICI,
        carga_total_pct:    parseFloat(
          (((ificiResult.imposto + ificiResult.ss_contribuicao) / rendimento_anual) * 100).toFixed(1)
        ),
      },
      pt_normal: {
        regime:             ptNormal.regime,
        imposto:            ptNormal.imposto,
        taxa_efetiva_pct:   ptNormal.taxa_efetiva_pct,
        ss_contribuicao:    ptNormal.ss_contribuicao,
        rendimento_liquido: ptNormal.rendimento_liquido,
        carga_total_pct:    parseFloat(
          (((ptNormal.imposto + ptNormal.ss_contribuicao) / rendimento_anual) * 100).toFixed(1)
        ),
      },
      recomendacao: {
        regime_recomendado:   recomendacao,
        detalhe:              recomendacao_detalhe,
        aviso:                'Esta simulação é indicativa. Aconselhe-se com um advogado fiscal antes de tomar decisões.',
      },
      elegibilidade_nhr,
      elegibilidade_ifici,
      processo,
      prazo_decisao:       '4–6 semanas após candidatura completa',
      advogados_parceiros: 'Disponível via Agency Group — geral@agencygroup.pt',
      info: {
        nota_legal: 'Simulação fiscal indicativa baseada nas taxas vigentes em 2026. Não substitui aconselhamento jurídico ou fiscal profissional. As taxas e condições podem variar.',
        fontes:     'AT — Autoridade Tributária e Aduaneira; BCE; INE Portugal 2026.',
      },
    }

    // If regime is not 'compare', filter to relevant regime only
    if (regime === 'nhr') {
      return NextResponse.json({
        ...responseBase,
        ifici_portugal: undefined,
        pt_normal:      undefined,
      })
    }
    if (regime === 'ifici') {
      return NextResponse.json({
        ...responseBase,
        nhr_portugal: undefined,
        pt_normal:    undefined,
      })
    }

    return NextResponse.json(responseBase)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro interno no servidor' },
      { status: 500 }
    )
  }
}
