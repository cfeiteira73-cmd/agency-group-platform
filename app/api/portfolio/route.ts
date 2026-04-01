import { NextRequest, NextResponse } from 'next/server'

// ─── Types ───────────────────────────────────────────────────────────────────

interface PropertyInput {
  zona:      string
  area:      number   // m²
  preco:     number   // €
  tipologia: string   // 'T0','T1','T2','T3','T4','T5+'
  estado:    string   // 'novo','usado_bom','usado_renovar'
  vista?:    boolean  // sea/river/special view
  pool?:     boolean
  garagem?:  boolean
}

interface ZoneData {
  nome:        string
  preco_m2:    number   // €/m² base
  yield_bruto: number   // annual gross yield decimal
  var_h:       number   // annual appreciation decimal
  liquidez:    number   // 1-10 scale (higher = more liquid)
  demanda:     string   // 'alta' | 'media' | 'baixa'
}

// ─── Zone data table (30 zones, Portugal 2026) ────────────────────────────────

const ZONES: Record<string, ZoneData> = {
  'Lisboa':                    { nome: 'Lisboa (média)',               preco_m2: 5000,  yield_bruto: 0.040, var_h: 0.12, liquidez: 9,  demanda: 'alta'  },
  'Lisboa — Chiado/Santos':    { nome: 'Lisboa — Chiado/Santos',       preco_m2: 6800,  yield_bruto: 0.035, var_h: 0.14, liquidez: 10, demanda: 'alta'  },
  'Lisboa — Príncipe Real':    { nome: 'Lisboa — Príncipe Real',       preco_m2: 6500,  yield_bruto: 0.036, var_h: 0.13, liquidez: 9,  demanda: 'alta'  },
  'Lisboa — Parque das Nações':{ nome: 'Lisboa — Parque das Nações',   preco_m2: 4500,  yield_bruto: 0.045, var_h: 0.11, liquidez: 8,  demanda: 'alta'  },
  'Lisboa — Alfama':           { nome: 'Lisboa — Alfama',              preco_m2: 5200,  yield_bruto: 0.042, var_h: 0.10, liquidez: 7,  demanda: 'media' },
  'Lisboa — Belém':            { nome: 'Lisboa — Belém',               preco_m2: 4800,  yield_bruto: 0.043, var_h: 0.11, liquidez: 8,  demanda: 'alta'  },
  'Cascais':                   { nome: 'Cascais',                      preco_m2: 4713,  yield_bruto: 0.042, var_h: 0.13, liquidez: 8,  demanda: 'alta'  },
  'Cascais — Quinta da Marinha':{ nome: 'Cascais — Quinta da Marinha', preco_m2: 5800,  yield_bruto: 0.038, var_h: 0.14, liquidez: 7,  demanda: 'alta'  },
  'Estoril':                   { nome: 'Estoril',                      preco_m2: 5200,  yield_bruto: 0.039, var_h: 0.12, liquidez: 8,  demanda: 'alta'  },
  'Sintra':                    { nome: 'Sintra',                       preco_m2: 2800,  yield_bruto: 0.050, var_h: 0.09, liquidez: 6,  demanda: 'media' },
  'Oeiras':                    { nome: 'Oeiras',                       preco_m2: 3200,  yield_bruto: 0.048, var_h: 0.10, liquidez: 7,  demanda: 'media' },
  'Comporta':                  { nome: 'Comporta',                     preco_m2: 8500,  yield_bruto: 0.055, var_h: 0.18, liquidez: 5,  demanda: 'alta'  },
  'Ericeira':                  { nome: 'Ericeira',                     preco_m2: 3500,  yield_bruto: 0.058, var_h: 0.15, liquidez: 6,  demanda: 'alta'  },
  'Setúbal':                   { nome: 'Setúbal',                      preco_m2: 2200,  yield_bruto: 0.055, var_h: 0.08, liquidez: 5,  demanda: 'media' },
  'Porto':                     { nome: 'Porto',                        preco_m2: 3643,  yield_bruto: 0.050, var_h: 0.13, liquidez: 8,  demanda: 'alta'  },
  'Porto — Foz/Nevogilde':     { nome: 'Porto — Foz/Nevogilde',        preco_m2: 5200,  yield_bruto: 0.040, var_h: 0.15, liquidez: 8,  demanda: 'alta'  },
  'Porto — Boavista':          { nome: 'Porto — Boavista',             preco_m2: 4200,  yield_bruto: 0.044, var_h: 0.13, liquidez: 8,  demanda: 'alta'  },
  'Braga':                     { nome: 'Braga',                        preco_m2: 1950,  yield_bruto: 0.060, var_h: 0.10, liquidez: 6,  demanda: 'media' },
  'Algarve':                   { nome: 'Algarve (média)',              preco_m2: 3941,  yield_bruto: 0.060, var_h: 0.12, liquidez: 7,  demanda: 'alta'  },
  'Quinta do Lago':             { nome: 'Quinta do Lago',              preco_m2: 10000, yield_bruto: 0.045, var_h: 0.16, liquidez: 6,  demanda: 'alta'  },
  'Vale do Lobo':              { nome: 'Vale do Lobo',                 preco_m2: 8500,  yield_bruto: 0.048, var_h: 0.15, liquidez: 6,  demanda: 'alta'  },
  'Albufeira':                 { nome: 'Albufeira',                    preco_m2: 3200,  yield_bruto: 0.070, var_h: 0.10, liquidez: 7,  demanda: 'alta'  },
  'Lagos':                     { nome: 'Lagos',                        preco_m2: 4100,  yield_bruto: 0.062, var_h: 0.12, liquidez: 6,  demanda: 'alta'  },
  'Tavira':                    { nome: 'Tavira',                       preco_m2: 2800,  yield_bruto: 0.058, var_h: 0.10, liquidez: 5,  demanda: 'media' },
  'Madeira / Funchal':         { nome: 'Madeira / Funchal',            preco_m2: 3760,  yield_bruto: 0.055, var_h: 0.14, liquidez: 6,  demanda: 'alta'  },
  'Madeira — Calheta':         { nome: 'Madeira — Calheta',            preco_m2: 4200,  yield_bruto: 0.058, var_h: 0.16, liquidez: 5,  demanda: 'alta'  },
  'Açores':                    { nome: 'Açores',                       preco_m2: 1952,  yield_bruto: 0.065, var_h: 0.08, liquidez: 4,  demanda: 'media' },
  'Évora':                     { nome: 'Évora',                        preco_m2: 1800,  yield_bruto: 0.060, var_h: 0.07, liquidez: 4,  demanda: 'baixa' },
  'Coimbra':                   { nome: 'Coimbra',                      preco_m2: 1950,  yield_bruto: 0.058, var_h: 0.08, liquidez: 5,  demanda: 'media' },
  'Faro':                      { nome: 'Faro',                         preco_m2: 2500,  yield_bruto: 0.062, var_h: 0.09, liquidez: 5,  demanda: 'media' },
}

const FALLBACK_ZONE: ZoneData = {
  nome:        'Zona Genérica Portugal',
  preco_m2:    3076,
  yield_bruto: 0.050,
  var_h:       0.10,
  liquidez:    5,
  demanda:     'media',
}

// ─── AVM helpers ──────────────────────────────────────────────────────────────

/** Find zone data — fuzzy match on zone name (case-insensitive, partial) */
function findZone(zona: string): ZoneData {
  const lower = zona.toLowerCase().trim()

  // Exact key match first
  for (const [key, data] of Object.entries(ZONES)) {
    if (key.toLowerCase() === lower) return data
  }

  // Partial key match
  for (const [key, data] of Object.entries(ZONES)) {
    if (key.toLowerCase().includes(lower) || lower.includes(key.toLowerCase().split(' — ')[0].toLowerCase())) {
      return data
    }
  }

  // Partial nome match
  for (const [, data] of Object.entries(ZONES)) {
    if (data.nome.toLowerCase().includes(lower)) return data
  }

  return FALLBACK_ZONE
}

/** Tipologia multipliers vs. T2 baseline */
const TIPO_MULT: Record<string, number> = {
  T0: 1.08, T1: 1.04, T2: 1.00, T3: 0.97, T4: 0.94, 'T4+': 0.91, 'T5+': 0.88,
}

/** Estado (condition) multipliers */
const ESTADO_MULT: Record<string, number> = {
  novo:          1.12,
  usado_bom:     1.00,
  usado_renovar: 0.82,
}

/** Feature premium multipliers (applied on top of base) */
const FEATURE_PREMIUMS = {
  vista:   0.12,  // +12% for sea/river/special view
  pool:    0.08,  // +8% for pool
  garagem: 0.04,  // +4% for garage
}

/** Run AVM and return estimated market value + per-m² */
function runAVM(prop: PropertyInput): { valor_justo: number; preco_m2_estimado: number } {
  const zoneData   = findZone(prop.zona)
  const tipoMult   = TIPO_MULT[prop.tipologia] ?? 1.00
  const estadoMult = ESTADO_MULT[prop.estado]  ?? 1.00

  let featureMult = 1.0
  if (prop.vista)    featureMult += FEATURE_PREMIUMS.vista
  if (prop.pool)     featureMult += FEATURE_PREMIUMS.pool
  if (prop.garagem)  featureMult += FEATURE_PREMIUMS.garagem

  const preco_m2_estimado = Math.round(zoneData.preco_m2 * tipoMult * estadoMult * featureMult)
  const valor_justo       = Math.round(preco_m2_estimado * prop.area)

  return { valor_justo, preco_m2_estimado }
}

/** Score a property 0–100 */
function scoreProperty(
  prop:              PropertyInput,
  valor_justo:       number,
  zoneData:          ZoneData,
): number {
  // 1. Desconto/oportunidade (30%)
  const desconto = valor_justo > 0 ? (valor_justo - prop.preco) / valor_justo : 0
  const scoreDesconto = Math.min(Math.max((desconto + 0.20) / 0.40 * 100, 0), 100) // maps -20% to +20% onto 0-100

  // 2. Yield bruto ajustado (40%)
  const yieldAtual    = (zoneData.yield_bruto * valor_justo) / prop.preco // yield adjusted for price
  const scoreYield    = Math.min((yieldAtual / 0.10) * 100, 100)  // 10% yield = 100 score

  // 3. Valorização esperada (30%)
  const scoreValorizacao = Math.min((zoneData.var_h / 0.20) * 100, 100)  // 20%/yr = 100 score

  const total = scoreDesconto * 0.30 + scoreYield * 0.40 + scoreValorizacao * 0.30

  return parseFloat(total.toFixed(1))
}

/** Classify score into deal rating */
function classificar(score: number, desconto_pct: number): string {
  if (score >= 75 && desconto_pct >= 5)  return 'COMPRA IMEDIATA'
  if (score >= 60)                        return 'BOA OPORTUNIDADE'
  if (score >= 40 && desconto_pct > -5)   return 'VALOR JUSTO'
  return 'SOBREVALORIZADO'
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    if (!body.properties || !Array.isArray(body.properties)) {
      return NextResponse.json(
        { error: 'Campo obrigatório: properties (array de imóveis)' },
        { status: 400 }
      )
    }
    if (body.properties.length === 0) {
      return NextResponse.json(
        { error: 'Envie pelo menos 1 imóvel para analisar' },
        { status: 400 }
      )
    }
    if (body.properties.length > 20) {
      return NextResponse.json(
        { error: 'Máximo 20 imóveis por análise' },
        { status: 400 }
      )
    }

    // ── Analyse each property ─────────────────────────────────────────────────
    const resultados = body.properties.map((p: PropertyInput, idx: number) => {
      const prop: PropertyInput = {
        zona:      String(p.zona || 'Lisboa'),
        area:      parseFloat(String(p.area)) || 100,
        preco:     parseFloat(String(p.preco)) || 0,
        tipologia: String(p.tipologia || 'T2'),
        estado:    String(p.estado || 'usado_bom'),
        vista:     Boolean(p.vista),
        pool:      Boolean(p.pool),
        garagem:   Boolean(p.garagem),
      }

      if (prop.preco <= 0) {
        return { idx, erro: `Imóvel ${idx + 1}: preço inválido` }
      }
      if (prop.area <= 0 || prop.area > 5000) {
        return { idx, erro: `Imóvel ${idx + 1}: área inválida (1–5000m²)` }
      }

      const zoneData = findZone(prop.zona)
      const { valor_justo, preco_m2_estimado } = runAVM(prop)

      const preco_m2_real       = Math.round(prop.preco / prop.area)
      const desconto_pct        = parseFloat(((valor_justo - prop.preco) / (valor_justo || 1) * 100).toFixed(1))
      const yield_bruto_pct     = parseFloat((zoneData.yield_bruto * 100).toFixed(2))
      const yield_real_pct      = parseFloat(((zoneData.yield_bruto * valor_justo / prop.preco) * 100).toFixed(2))
      const roi_5_anos_pct      = parseFloat(((yield_real_pct * 5) + (zoneData.var_h * 100 * 5)).toFixed(1))

      // Estimated annual rental income
      const renda_anual_est     = Math.round(prop.preco * (yield_real_pct / 100))
      const renda_mensal_est    = Math.round(renda_anual_est / 12)

      // 5-year value projection
      const valor_5_anos        = Math.round(prop.preco * Math.pow(1 + zoneData.var_h, 5))
      const ganho_capital_5_anos = valor_5_anos - prop.preco

      const score          = scoreProperty(prop, valor_justo, zoneData)
      const classificacao  = classificar(score, desconto_pct)

      return {
        idx,
        id:                     idx + 1,
        zona:                   prop.zona,
        zona_match:             zoneData.nome,
        area_m2:                prop.area,
        tipologia:              prop.tipologia,
        estado:                 prop.estado,
        features: {
          vista:   prop.vista,
          pool:    prop.pool,
          garagem: prop.garagem,
        },
        preco_pedido:           prop.preco,
        preco_m2_pedido:        preco_m2_real,
        valor_justo_avm:        valor_justo,
        preco_m2_estimado:      preco_m2_estimado,
        desconto_oportunidade_pct: desconto_pct,
        avaliacao: {
          yield_bruto_zona_pct:  yield_bruto_pct,
          yield_real_ajustado_pct: yield_real_pct,
          renda_mensal_estimada:  renda_mensal_est,
          renda_anual_estimada:   renda_anual_est,
          valorizacao_anual_pct:  parseFloat((zoneData.var_h * 100).toFixed(1)),
          roi_5_anos_pct,
          valor_estimado_5_anos:  valor_5_anos,
          ganho_capital_5_anos,
        },
        mercado: {
          liquidez_score:  zoneData.liquidez,
          demanda:         zoneData.demanda,
          preco_m2_zona:   zoneData.preco_m2,
        },
        score_total:      score,
        classificacao,
      }
    })

    // Separate errors from valid results
    const erros   = resultados.filter((r: { erro?: string }) => r.erro)
    const validos = resultados.filter((r: { erro?: string }) => !r.erro)

    if (validos.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum imóvel válido para analisar', detalhes: erros },
        { status: 400 }
      )
    }

    // ── Sort by score descending ───────────────────────────────────────────────
    const ranking = [...validos].sort((a, b) => b.score_total - a.score_total)

    // Add rank position
    ranking.forEach((r, i) => { r.rank = i + 1 })

    // ── Best pick ─────────────────────────────────────────────────────────────
    const melhor_pick = ranking[0]

    // ── Comparison table (simplified) ─────────────────────────────────────────
    const comparacao_tabela = ranking.map(r => ({
      rank:                   r.rank,
      zona:                   r.zona,
      tipologia:              r.tipologia,
      preco:                  r.preco_pedido,
      valor_justo:            r.valor_justo_avm,
      desconto_pct:           r.desconto_oportunidade_pct,
      yield_real_pct:         r.avaliacao.yield_real_ajustado_pct,
      roi_5_anos_pct:         r.avaliacao.roi_5_anos_pct,
      score:                  r.score_total,
      classificacao:          r.classificacao,
    }))

    // ── Portfolio summary ──────────────────────────────────────────────────────
    const total_investimento  = validos.reduce((s: number, r: { preco_pedido: number }) => s + r.preco_pedido, 0)
    const total_valor_justo   = validos.reduce((s: number, r: { valor_justo_avm: number }) => s + r.valor_justo_avm, 0)
    const renda_anual_total   = validos.reduce((s: number, r: { avaliacao: { renda_anual_estimada: number } }) => s + r.avaliacao.renda_anual_estimada, 0)
    const yield_portfolio     = total_investimento > 0
      ? parseFloat(((renda_anual_total / total_investimento) * 100).toFixed(2))
      : 0

    return NextResponse.json({
      success: true,
      properties_analisadas: validos.length,
      properties_com_erro:   erros.length,
      erros:                 erros.length > 0 ? erros : undefined,
      ranking,
      melhor_pick: {
        rank:           1,
        zona:           melhor_pick.zona,
        tipologia:      melhor_pick.tipologia,
        preco:          melhor_pick.preco_pedido,
        score:          melhor_pick.score_total,
        classificacao:  melhor_pick.classificacao,
        motivo:         `Score ${melhor_pick.score_total}/100. ${melhor_pick.classificacao}. Yield real ${melhor_pick.avaliacao.yield_real_ajustado_pct}% · ROI 5 anos ${melhor_pick.avaliacao.roi_5_anos_pct}% · Desconto ${melhor_pick.desconto_oportunidade_pct}% vs AVM.`,
      },
      comparacao_tabela,
      resumo_portfolio: {
        total_investimento,
        total_valor_justo,
        desconto_portfolio_pct: total_investimento > 0
          ? parseFloat(((total_valor_justo - total_investimento) / total_valor_justo * 100).toFixed(1))
          : 0,
        renda_anual_total,
        renda_mensal_total:  Math.round(renda_anual_total / 12),
        yield_portfolio_pct: yield_portfolio,
      },
      info: {
        metodologia:   'AVM baseado em preços médios por zona, tipologia, estado e features. Estimativas indicativas.',
        nota:          'Valores de referência Março 2026. Consulte Agency Group para avaliação detalhada.',
        contacto:      'geral@agencygroup.pt — AMI 22506',
        zonas_disponiveis: Object.keys(ZONES),
      },
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro interno no servidor' },
      { status: 500 }
    )
  }
}
