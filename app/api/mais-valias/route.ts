import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const MaisValiasSchema = z.object({
  preco_aquisicao:    z.number().positive('Preço de aquisição deve ser positivo'),
  preco_venda:        z.number().positive('Preço de venda deve ser positivo'),
  ano_aquisicao:      z.number().int().min(1970).max(2026),
  despesas_aquisicao: z.number().min(0).optional().default(0),
  despesas_venda:     z.number().min(0).optional().default(0),
  obras:              z.number().min(0).optional().default(0),
  residente:          z.boolean().optional().default(true),
  habitacao_propria:  z.boolean().optional().default(false),
  reinvestimento:     z.boolean().optional().default(false),
  rendimento_anual:   z.number().min(0).optional().default(40000),
})

// ─── Coeficientes de desvalorização monetária AT (artigo 47º CIRS) ────────────
const COEFICIENTES: Record<number, number> = {
  2000: 1.72, 2001: 1.66, 2002: 1.62, 2003: 1.59, 2004: 1.57,
  2005: 1.54, 2006: 1.51, 2007: 1.47, 2008: 1.42, 2009: 1.42,
  2010: 1.40, 2011: 1.37, 2012: 1.33, 2013: 1.32, 2014: 1.32,
  2015: 1.32, 2016: 1.31, 2017: 1.30, 2018: 1.28, 2019: 1.26,
  2020: 1.25, 2021: 1.23, 2022: 1.15, 2023: 1.05, 2024: 1.02,
  2025: 1.01, 2026: 1.00,
}

// ─── IRS progressivo 2026 (artigo 68º CIRS) ──────────────────────────────────
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
  let tax = 0, prev = 0
  for (const b of brackets) {
    if (rendimento <= prev) break
    tax += (Math.min(rendimento, b.ate) - prev) * b.taxa
    prev = b.ate
  }
  return tax
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json()
    const parsed = MaisValiasSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }
    const {
      preco_aquisicao,
      preco_venda,
      ano_aquisicao,
      despesas_aquisicao,
      despesas_venda,
      obras,
      residente,
      habitacao_propria,
      reinvestimento,
      rendimento_anual,
    } = parsed.data

    const coef = COEFICIENTES[ano_aquisicao] ?? 1.00

    // ─── Cálculo da mais-valia bruta ─────────────────────────────────────────
    const valorAquisicaoCorrigido = preco_aquisicao * coef
    const totalDespesas = (despesas_aquisicao ?? 0) + (despesas_venda ?? 0) + (obras ?? 0)
    const maisValiaBruta = preco_venda - valorAquisicaoCorrigido - totalDespesas

    if (maisValiaBruta <= 0) {
      return NextResponse.json({
        ganho_bruto: 0,
        ganho_liquido_tributavel: 0,
        imposto_estimado: 0,
        taxa_efetiva: 0,
        liquido_apos_imposto: preco_venda - totalDespesas,
        poupanca_reinvestimento: 0,
        prejuizo: Math.abs(maisValiaBruta),
        mensagem: 'Não existe mais-valia tributável. Ocorreu uma menos-valia.',
        breakdown: buildBreakdown(preco_aquisicao, coef, ano_aquisicao, despesas_aquisicao, despesas_venda, obras, maisValiaBruta, 0, 0, 0),
      })
    }

    let impostoEstimado = 0
    let ganhoTributavel = 0
    let poupancaReinvestimento = 0
    let mensagem = ''

    if (!residente) {
      // ─── Não-residente: taxa liberatória 28% sobre 100% da mais-valia ────
      ganhoTributavel = maisValiaBruta
      impostoEstimado = maisValiaBruta * 0.28
      mensagem = 'Não-residente: taxa liberatória de 28% sobre a totalidade da mais-valia (artigo 72º CIRS).'

    } else if (habitacao_propria && reinvestimento) {
      // ─── Habitação própria com reinvestimento: isenção total (artigo 10º/5 CIRS) ─
      ganhoTributavel = 0
      impostoEstimado = 0
      poupancaReinvestimento = calcIRS((rendimento_anual ?? 40000) + maisValiaBruta * 0.5) - calcIRS(rendimento_anual ?? 40000)
      mensagem = 'Isenção total por reinvestimento em habitação própria e permanente (artigo 10º nº5 CIRS). Reinvestimento obrigatório nos 36 meses seguintes.'

    } else if (habitacao_propria && !reinvestimento) {
      // ─── Habitação própria sem reinvestimento: 50% englobado ─────────────
      ganhoTributavel = maisValiaBruta * 0.5
      const rendimentoComMaisValia = (rendimento_anual ?? 40000) + ganhoTributavel
      const irsTotal = calcIRS(rendimentoComMaisValia)
      const irsSemMaisValia = calcIRS(rendimento_anual ?? 40000)
      impostoEstimado = irsTotal - irsSemMaisValia
      poupancaReinvestimento = impostoEstimado // quanto pouparia se reinvestisse
      mensagem = 'Residente em HPP sem reinvestimento: 50% da mais-valia englobada no IRS à taxa marginal (artigo 43º CIRS).'

    } else {
      // ─── Residente, imóvel não HPP: 50% englobado ────────────────────────
      ganhoTributavel = maisValiaBruta * 0.5
      const rendimentoComMaisValia = (rendimento_anual ?? 40000) + ganhoTributavel
      const irsTotal = calcIRS(rendimentoComMaisValia)
      const irsSemMaisValia = calcIRS(rendimento_anual ?? 40000)
      impostoEstimado = irsTotal - irsSemMaisValia
      mensagem = 'Residente: 50% da mais-valia englobada no IRS à taxa marginal (artigo 43º CIRS).'
    }

    const taxaEfetiva = maisValiaBruta > 0 ? impostoEstimado / maisValiaBruta : 0
    const liquidoAposImposto = preco_venda - totalDespesas - impostoEstimado

    return NextResponse.json({
      ganho_bruto: Math.round(maisValiaBruta),
      ganho_liquido_tributavel: Math.round(ganhoTributavel),
      imposto_estimado: Math.round(impostoEstimado),
      taxa_efetiva: Math.round(taxaEfetiva * 10000) / 100, // percentagem
      liquido_apos_imposto: Math.round(liquidoAposImposto),
      poupanca_reinvestimento: Math.round(poupancaReinvestimento),
      coeficiente_aplicado: coef,
      mensagem,
      breakdown: buildBreakdown(preco_aquisicao, coef, ano_aquisicao, despesas_aquisicao, despesas_venda, obras, maisValiaBruta, ganhoTributavel, impostoEstimado, liquidoAposImposto),
    })

  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

function buildBreakdown(
  preco_aquisicao: number, coef: number, ano: number,
  desp_aq: number, desp_vd: number, obras: number,
  mais_valia: number, tributavel: number, imposto: number, liquido: number
) {
  return [
    { label: `Preço de aquisição (${ano})`, valor: preco_aquisicao, tipo: 'neutro' },
    { label: `Coef. desvalorização (×${coef})`, valor: preco_aquisicao * coef - preco_aquisicao, tipo: 'dedução' },
    { label: 'Despesas de aquisição (IMT, IS, notário)', valor: -(desp_aq ?? 0), tipo: 'dedução' },
    { label: 'Despesas de venda (comissão, notário)', valor: -(desp_vd ?? 0), tipo: 'dedução' },
    { label: 'Obras com factura', valor: -(obras ?? 0), tipo: 'dedução' },
    { label: 'Mais-valia bruta', valor: Math.round(mais_valia), tipo: mais_valia > 0 ? 'positivo' : 'negativo' },
    { label: 'Valor tributável', valor: Math.round(tributavel), tipo: 'neutro' },
    { label: 'Imposto estimado', valor: -Math.round(imposto), tipo: 'imposto' },
    { label: 'Líquido após imposto', valor: Math.round(liquido), tipo: 'resultado' },
  ]
}
