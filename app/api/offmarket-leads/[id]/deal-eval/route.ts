// =============================================================================
// Agency Group — Deal Evaluation Engine
// POST /api/offmarket-leads/[id]/deal-eval
// GET  /api/offmarket-leads/[id]/deal-eval
//
// Computes 8-layer elite deal evaluation model:
//   1. Adjusted Discount Score  (0-100) — desconto bruto × confiança
//   2. Liquidity Score          (0-100) — liquidez real do ativo
//   3. Execution Probability    (0-100) — fechabilidade do deal
//   4. Buyer Execution Score    (0-100) — buyer primário × actividade
//   5. Risk-Adjusted Upside     (0-100) — upside bruto − fricção
//   6. Asset Quality Score      (0-100) — qualidade intrínseca do ativo
//   7. Source Quality Score     (0-100) — fiabilidade da origem
//   8. Deal Evaluation Score    (0-100) — composite das 7 camadas
//   +  Master Attack Rank       (0-100) — DealEval + DPS + ExecProb
//
// AUDITORIA: NÃO duplica score engine, buyer matching, price-intel, DPS.
// Usa campos existentes (gross_discount_pct, comp_confidence_score,
// deal_priority_score, buyer_score) como inputs.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { auth } from '@/auth'

const TABLE = 'offmarket_leads'

// ---------------------------------------------------------------------------
// Geo tier (mirrored from score/route.ts — same data, self-contained)
// ---------------------------------------------------------------------------

const GEO_TIER_1 = [
  'lisboa', 'lisbon', 'cascais', 'estoril', 'sintra', 'comporta',
  'chiado', 'príncipe real', 'lapa', 'santos', 'bairro alto',
  'parque das nações', 'expo', 'belém', 'restelo', 'campo de ourique',
  'vilamoura', 'quinta do lago', 'vale do lobo',
  'faro premium', 'albufeira', 'lagos', 'luz', 'meia praia',
  'foz do douro', 'boavista', 'porto premium', 'matosinhos', 'leça',
  'algarve', 'ericeira', 'óbidos', 'aroeira', 'azeitão',
]
const GEO_TIER_2 = [
  'braga', 'guimarães', 'aveiro', 'coimbra', 'setúbal', 'setubal',
  'santarém', 'leiria', 'évora', 'portimão', 'lagoa', 'silves',
  'mafra', 'torres vedras', 'caldas da rainha', 'peniche',
  'alcobaça', 'nazaré', 'tomar', 'abrantes',
  'douro', 'trás-os-montes', 'minho', 'alentejo litoral',
  'beja', 'sines', 'grândola', 'alcácer do sal',
]
const GEO_TIER_MADEIRA_AZORES = [
  'madeira', 'funchal', 'câmara de lobos', 'caniço', 'machico',
  'açores', 'azores', 'ponta delgada', 'angra do heroísmo', 'horta',
]

function normGeo(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

const T1N = GEO_TIER_1.map(normGeo)
const T2N = GEO_TIER_2.map(normGeo)
const TMN = GEO_TIER_MADEIRA_AZORES.map(normGeo)

function getGeoTier(cidade?: string | null, loc?: string | null): 0 | 1 | 2 | 3 {
  const raw = `${cidade ?? ''} ${loc ?? ''}`
  const h = normGeo(raw).replace(/,\s*(portugal|espanha|spain|madeira|azores|acores)\s*$/gi, '').trim()
  if (!h) return 0
  if (T1N.some(k => h.includes(k) || k.includes(h.split(/[\s,]+/)[0] ?? ''))) return 1
  if (TMN.some(k => h.includes(k))) return 2
  if (T2N.some(k => h.includes(k))) return 2
  return 3
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function normType(t?: string | null): string {
  if (!t) return ''
  return t.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

// ---------------------------------------------------------------------------
// 1. Adjusted Discount Score (0-100)
//    gross_discount_pct × (comp_confidence_score / 100) × 2.0
//    At-market or above → 0. 50% off at 100% confidence → 100.
// ---------------------------------------------------------------------------

function calcAdjustedDiscountScore(
  grossDiscountPct: number | null,
  compConfidenceScore: number | null
): number {
  if (grossDiscountPct === null || compConfidenceScore === null) return 0
  const adj = Math.max(0, grossDiscountPct) * (compConfidenceScore / 100)
  return clamp(Math.round(adj * 2.0), 0, 100)
}

// ---------------------------------------------------------------------------
// 2. Liquidity Score (0-100)
//    zone(0-30) + asset_type(0-25) + ticket(0-20) + buyer_pool(0-25)
// ---------------------------------------------------------------------------

function calcLiquidityScore(
  cidade: string | null,
  localizacao: string | null,
  tipoAtivo: string | null,
  priceAsk: number | null,
  matchedBuyersCount: number | null,
  bestBuyerMatchScore: number | null
): { score: number; reason: string } {
  const geoTier = getGeoTier(cidade, localizacao)
  const zonePts = geoTier === 1 ? 30 : geoTier === 2 ? 20 : geoTier === 3 ? 8 : 0

  const assetLiq: Record<string, number> = {
    apartamento: 25, moradia: 22, predio: 16, predios: 16, edificio: 16,
    comercial: 15, terreno: 12, quinta: 10, herdade: 8, hotel: 8,
    loja: 10, armazem: 5,
  }
  const assetPts = assetLiq[normType(tipoAtivo)] ?? 10

  const ticketPts = !priceAsk ? 10
    : priceAsk < 500_000 ? 20
    : priceAsk < 1_000_000 ? 18
    : priceAsk < 2_000_000 ? 15
    : priceAsk < 5_000_000 ? 10
    : priceAsk < 10_000_000 ? 6 : 3

  const buyerCount = matchedBuyersCount ?? 0
  const buyerMatchScore = bestBuyerMatchScore ?? 0
  const depthPts = buyerCount >= 5 ? 25 : buyerCount >= 3 ? 20 : buyerCount >= 2 ? 14 : buyerCount >= 1 ? 8 : 2
  const qualMult = buyerMatchScore >= 80 ? 1.0 : buyerMatchScore >= 60 ? 0.85 : buyerMatchScore >= 40 ? 0.65 : 0.40
  const buyerPts = Math.round(depthPts * qualMult)

  const score = clamp(zonePts + assetPts + ticketPts + buyerPts, 0, 100)

  const parts: string[] = []
  if (geoTier === 1) parts.push('zona premium (alta liquidez)')
  else if (geoTier === 2) parts.push('zona secundária (liquidez média)')
  else if (geoTier === 3) parts.push('zona interior (liquidez limitada)')
  if (priceAsk && priceAsk < 1_000_000) parts.push('ticket líquido (<€1M)')
  else if (priceAsk && priceAsk >= 5_000_000) parts.push('ticket institucional (>€5M)')
  if (buyerCount >= 3) parts.push(`${buyerCount} compradores activos`)
  else if (buyerCount === 0) parts.push('sem compradores matched')

  return { score, reason: parts.join(' · ') || `Liquidez ${score}/100` }
}

// ---------------------------------------------------------------------------
// 3. Execution Probability (0-100)
//    owner(0-20) + urgency(0-20) + contact(0-15) + preclose(0-15)
//    + price_realism(0-15) + buyer_depth(0-15) − neg_penalty(0-10)
// ---------------------------------------------------------------------------

function calcExecutionProbability(
  ownerType: string | null,
  urgency: string | null,
  contacto: string | null,
  precloseCandidiate: boolean | null,
  grossDiscountPct: number | null,
  matchedBuyersCount: number | null,
  negotiationStatus: string | null
): { score: number; reason: string } {
  const ownerN = (ownerType ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const ownerPts = ownerN.includes('heranca') || ownerN.includes('herança') ? 20
    : ownerN === 'banco' || ownerN === 'fundo' ? 18
    : ownerN === 'empresa' ? 14
    : ownerN === 'individual' ? 10 : 5

  const urgencyPts = urgency === 'high' ? 20 : urgency === 'medium' ? 13 : urgency === 'low' ? 5 : 3

  const c = contacto?.trim() ?? ''
  const contactPts = !c ? 0
    : /^(\+?[0-9\s\-().]{7,20})$/.test(c) ? 15
    : c.includes('@') ? 10 : 5

  const preclosePts = precloseCandidiate ? 15 : 0

  const pricePts = grossDiscountPct === null ? 5
    : grossDiscountPct >= 0 ? 15
    : grossDiscountPct >= -10 ? 8 : 2

  const buyers = matchedBuyersCount ?? 0
  const depthPts = buyers >= 3 ? 15 : buyers >= 2 ? 10 : buyers >= 1 ? 7 : 2

  const negPenalty = negotiationStatus === 'withdrawn' ? -10
    : negotiationStatus === 'blocked' ? -5 : 0

  const score = clamp(ownerPts + urgencyPts + contactPts + preclosePts + pricePts + depthPts + negPenalty, 0, 100)

  const parts: string[] = []
  if (ownerPts >= 18) parts.push('proprietário altamente motivado')
  else if (ownerPts >= 14) parts.push('motivação média-alta')
  if (urgency === 'high') parts.push('urgência alta')
  if (!c) parts.push('⚠️ sem contacto')
  else if (contactPts === 15) parts.push('contacto directo (telefone)')
  if (preclosePts > 0) parts.push('pré-fecho activo')
  if (grossDiscountPct !== null && grossDiscountPct < -10) parts.push('preço acima de mercado')
  if (buyers === 0) parts.push('sem compradores (risco)')
  if (negotiationStatus === 'withdrawn') parts.push('⚠️ negociação retirada')
  else if (negotiationStatus === 'blocked') parts.push('⚠️ bloqueado')

  return { score, reason: parts.join(' · ') || `Execução ${score}/100` }
}

// ---------------------------------------------------------------------------
// 4. Buyer Execution Score (0-100)
//    buyer_score × active_status_multiplier
//    buyer_score (migration 007) encodes: liquidity + history + speed + reliability + recency
// ---------------------------------------------------------------------------

interface BuyerData {
  buyer_score: number | null
  active_status: string | null
  liquidity_profile: string | null
  deals_closed_count: number | null
  avg_close_days: number | null
  reliability_score: number | null
}

function calcBuyerExecutionScore(buyer: BuyerData | null): { score: number; reason: string } {
  if (!buyer || buyer.buyer_score === null) {
    return { score: 0, reason: 'Sem dados de comprador primário' }
  }

  const activeMult = buyer.active_status === 'active' ? 1.0
    : buyer.active_status === 'dormant' ? 0.70
    : buyer.active_status === 'inactive' ? 0.40 : 0.60

  const score = clamp(Math.round(buyer.buyer_score * activeMult), 0, 100)

  const parts: string[] = []
  if (buyer.liquidity_profile === 'immediate') parts.push('liquidez imediata')
  else if (buyer.liquidity_profile === 'under_30_days') parts.push('liquidez <30 dias')
  else if (buyer.liquidity_profile === 'financed') parts.push('financiado')
  if ((buyer.deals_closed_count ?? 0) >= 3) parts.push(`${buyer.deals_closed_count} deals fechados`)
  if ((buyer.avg_close_days ?? 999) <= 30) parts.push('fecho rápido (<30d)')
  if (buyer.active_status === 'dormant') parts.push('⚠️ comprador dormant')
  else if (buyer.active_status === 'inactive') parts.push('⚠️ comprador inativo')

  return { score, reason: parts.join(' · ') || 'Comprador avaliado' }
}

// ---------------------------------------------------------------------------
// 5. Upside Score + Friction Penalty → Risk-Adjusted Upside (0-100)
//    upside: asset_type(0-35) + zone(0-25) + discount(0-25) + size(0-15)
//    friction: no contact, high risk, low confidence, no buyers, above market, blocked
// ---------------------------------------------------------------------------

function calcUpside(
  tipoAtivo: string | null,
  cidade: string | null,
  localizacao: string | null,
  areaM2: number | null,
  grossDiscountPct: number | null,
  dealRiskLevel: string | null,
  contacto: string | null,
  compConfidenceScore: number | null,
  matchedBuyersCount: number | null,
  docsPending: string[] | null,
  negotiationStatus: string | null
): { upsideScore: number; frictionPenalty: number; riskAdjustedScore: number; reason: string } {
  const geoTier = getGeoTier(cidade, localizacao)
  const typeN = normType(tipoAtivo)

  // Asset type upside potential (0-35)
  const typeUpside: Record<string, number> = {
    herdade: 35, quinta: 33, hotel: 32, predio: 30, predios: 30, edificio: 30,
    moradia: 28, terreno: 25, comercial: 22, apartamento: 18, loja: 15, armazem: 12,
  }
  const assetPts = typeUpside[typeN] ?? 18

  // Zone premium potential (0-25)
  const zonePts = geoTier === 1 ? 25 : geoTier === 2 ? 15 : geoTier === 3 ? 6 : 3

  // Price below market upside (0-25)
  const discountPts = grossDiscountPct === null ? 5
    : grossDiscountPct >= 25 ? 25
    : grossDiscountPct >= 15 ? 20
    : grossDiscountPct >= 10 ? 14
    : grossDiscountPct >= 5 ? 9
    : grossDiscountPct >= 0 ? 5 : 0

  // Size bonus (0-15)
  const sizePts = !areaM2 ? 0 : areaM2 >= 500 ? 15 : areaM2 >= 200 ? 10 : areaM2 >= 100 ? 5 : 2

  const upsideScore = clamp(assetPts + zonePts + discountPts + sizePts, 0, 100)

  // Friction penalty (0-50)
  let penalty = 0
  if (!contacto?.trim()) penalty += 10
  if (dealRiskLevel === 'vermelho') penalty += 15
  else if (dealRiskLevel === 'amarelo') penalty += 8
  if (compConfidenceScore !== null && compConfidenceScore < 40) penalty += 8
  if (!matchedBuyersCount || matchedBuyersCount === 0) penalty += 10
  if (grossDiscountPct !== null && grossDiscountPct < -10) penalty += 12
  if (docsPending && docsPending.length > 3) penalty += 5
  if (negotiationStatus === 'withdrawn') penalty += 12
  else if (negotiationStatus === 'blocked') penalty += 7
  const frictionPenalty = clamp(penalty, 0, 50)

  const riskAdjustedScore = clamp(upsideScore - frictionPenalty, 0, 100)

  const parts: string[] = []
  if (grossDiscountPct !== null && grossDiscountPct >= 15) parts.push('upside de reposicionamento alto')
  if (geoTier === 1) parts.push('zona premium')
  if (typeN === 'herdade' || typeN === 'quinta' || typeN === 'hotel') parts.push('activo estratégico')
  if (frictionPenalty >= 20) parts.push(`fricção: −${frictionPenalty}pts`)
  if (frictionPenalty === 0) parts.push('sem fricção operacional')

  return {
    upsideScore,
    frictionPenalty,
    riskAdjustedScore,
    reason: parts.join(' · ') || `Upside ${upsideScore}/100 → adj. ${riskAdjustedScore}/100`,
  }
}

// ---------------------------------------------------------------------------
// 6. Asset Quality Score (0-100)
//    type(0-40) + zone(0-30) + size(0-20) + data confidence(0-10)
// ---------------------------------------------------------------------------

function calcAssetQualityScore(
  tipoAtivo: string | null,
  cidade: string | null,
  localizacao: string | null,
  areaM2: number | null,
  compConfidenceScore: number | null
): number {
  const geoTier = getGeoTier(cidade, localizacao)
  const typeN = normType(tipoAtivo)

  const typeQual: Record<string, number> = {
    moradia: 40, quinta: 40, herdade: 40, hotel: 38,
    predio: 35, predios: 35, edificio: 35,
    comercial: 28, terreno: 22, apartamento: 20, loja: 15, armazem: 12,
  }
  const typePts = typeQual[typeN] ?? 18

  const zonePts = geoTier === 1 ? 30 : geoTier === 2 ? 20 : geoTier === 3 ? 8 : 3

  const sizePts = !areaM2 ? 5
    : areaM2 >= 500 ? 20 : areaM2 >= 200 ? 15 : areaM2 >= 100 ? 10 : 5

  const confPts = compConfidenceScore !== null && compConfidenceScore >= 70 ? 10
    : compConfidenceScore !== null && compConfidenceScore >= 40 ? 5 : 2

  return clamp(typePts + zonePts + sizePts + confPts, 0, 100)
}

// ---------------------------------------------------------------------------
// 7. Source Quality Score (0-100)
// ---------------------------------------------------------------------------

function calcSourceQualityScore(source: string | null): number {
  if (!source) return 25
  const s = source.toLowerCase()
  if (s.includes('referral') || s.includes('referencia')) return 90
  if (s.includes('banco') || s.includes('leilao') || s.includes('fundo')) return 85
  if (s.includes('linkedin')) return 80
  if (s.includes('casafari')) return 75
  if (s.includes('apify_idealista') || s.includes('idealista')) return 65
  if (s.includes('google_maps')) return 60
  if (s.includes('apify_imovirtual') || s.includes('imovirtual')) return 58
  if (s.includes('apify_olx') || s.includes('olx')) return 48
  if (s.includes('portal')) return 50
  if (s.includes('manual')) return 42
  return 28
}

// ---------------------------------------------------------------------------
// 8. Deal Evaluation Score (0-100) — composite
//    adjusted_discount(25%) + liquidity(15%) + execution(20%)
//    + buyer_execution(20%) + risk_adj_upside(10%)
//    + asset_quality(5%) + source_quality(5%)
// ---------------------------------------------------------------------------

function calcDealEvaluationScore(
  adjustedDiscountScore: number,
  liquidityScore: number,
  executionProbability: number,
  bestBuyerExecutionScore: number,
  riskAdjustedUpsideScore: number,
  assetQualityScore: number,
  sourceQualityScore: number
): number {
  return clamp(Math.round(
    adjustedDiscountScore * 0.25 +
    liquidityScore * 0.15 +
    executionProbability * 0.20 +
    bestBuyerExecutionScore * 0.20 +
    riskAdjustedUpsideScore * 0.10 +
    assetQualityScore * 0.05 +
    sourceQualityScore * 0.05
  ), 0, 100)
}

// ---------------------------------------------------------------------------
// Master Attack Rank (0-100)
//    deal_evaluation_score(50%) + deal_priority_score(30%) + execution_probability(20%)
//    Combina qualidade do deal + matching compradores + fechabilidade
// ---------------------------------------------------------------------------

function calcMasterAttackRank(
  dealEvaluationScore: number,
  dealPriorityScore: number | null,
  executionProbability: number
): number {
  return clamp(Math.round(
    dealEvaluationScore * 0.50 +
    (dealPriorityScore ?? 0) * 0.30 +
    executionProbability * 0.20
  ), 0, 100)
}

// ---------------------------------------------------------------------------
// Classification label
// ---------------------------------------------------------------------------

function classifyDeal(
  masterAttackRank: number,
  executionProbability: number,
  adjustedDiscountScore: number
): string {
  if (masterAttackRank >= 80 && executionProbability >= 70) return 'Ataque imediato'
  if (masterAttackRank >= 65 && adjustedDiscountScore >= 40) return 'Oportunidade forte'
  if (masterAttackRank >= 50) return 'Boa mas não prioritária'
  if (adjustedDiscountScore >= 40 && executionProbability < 40) return 'Produto bom, deal fraco'
  if (adjustedDiscountScore <= 5 && masterAttackRank < 40) return 'Preço acima do mercado'
  return 'Dados insuficientes'
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const cronSecret = process.env.CRON_SECRET
    const incomingSecret = req.headers.get('x-cron-secret')
      ?? req.headers.get('authorization')?.replace('Bearer ', '')
    const isCron = cronSecret && incomingSecret === cronSecret
    if (!isCron) {
      const session = await auth()
      if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: lead, error: fetchError } = await (supabaseAdmin as any)
      .from(TABLE)
      .select(`id, nome, tipo_ativo, cidade, localizacao, area_m2, price_ask,
               owner_type, urgency, contacto, source, score,
               deal_priority_score, matched_buyers_count, best_buyer_match_score,
               matched_to_buyers, preclose_candidate,
               primary_buyer_id,
               estimated_fair_value, gross_discount_pct, comp_confidence_score,
               price_opportunity_score, deal_risk_level, legal_status, docs_pending,
               negotiation_status`)
      .eq('id', id)
      .single()

    if (fetchError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    // Fetch primary buyer data if available
    let primaryBuyer: BuyerData | null = null
    if (lead.primary_buyer_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: buyer } = await (supabaseAdmin as any)
        .from('contacts')
        .select('buyer_score, active_status, liquidity_profile, deals_closed_count, avg_close_days, reliability_score, response_rate')
        .eq('id', lead.primary_buyer_id)
        .single()
      if (buyer) primaryBuyer = buyer as BuyerData
    }

    // ── Compute all 8 layers ─────────────────────────────────────────────────

    const adjustedDiscountScore = calcAdjustedDiscountScore(
      lead.gross_discount_pct, lead.comp_confidence_score
    )

    const { score: liquidityScore, reason: liquidityReason } = calcLiquidityScore(
      lead.cidade, lead.localizacao, lead.tipo_ativo,
      lead.price_ask, lead.matched_buyers_count, lead.best_buyer_match_score
    )

    const { score: executionProbability, reason: executionReason } = calcExecutionProbability(
      lead.owner_type, lead.urgency, lead.contacto,
      lead.preclose_candidate, lead.gross_discount_pct,
      lead.matched_buyers_count, lead.negotiation_status
    )

    const { score: bestBuyerExecutionScore, reason: buyerExecutionReason } =
      calcBuyerExecutionScore(primaryBuyer)

    const {
      upsideScore,
      frictionPenalty,
      riskAdjustedScore: riskAdjustedUpsideScore,
      reason: upsideReason,
    } = calcUpside(
      lead.tipo_ativo, lead.cidade, lead.localizacao, lead.area_m2,
      lead.gross_discount_pct, lead.deal_risk_level, lead.contacto,
      lead.comp_confidence_score, lead.matched_buyers_count,
      lead.docs_pending, lead.negotiation_status
    )

    const assetQualityScore = calcAssetQualityScore(
      lead.tipo_ativo, lead.cidade, lead.localizacao,
      lead.area_m2, lead.comp_confidence_score
    )

    const sourceQualityScore = calcSourceQualityScore(lead.source)

    const dealEvaluationScore = calcDealEvaluationScore(
      adjustedDiscountScore, liquidityScore, executionProbability,
      bestBuyerExecutionScore, riskAdjustedUpsideScore,
      assetQualityScore, sourceQualityScore
    )

    const masterAttackRank = calcMasterAttackRank(
      dealEvaluationScore, lead.deal_priority_score, executionProbability
    )

    const classification = classifyDeal(masterAttackRank, executionProbability, adjustedDiscountScore)

    const dealEvaluationReason = [
      `[${classification}]`,
      `Desconto adj.: ${adjustedDiscountScore}/100`,
      `Liquidez: ${liquidityScore}/100`,
      `Execução: ${executionProbability}/100`,
      `Comprador: ${bestBuyerExecutionScore}/100`,
      `Upside adj.: ${riskAdjustedUpsideScore}/100`,
    ].join(' · ')

    const masterAttackRankReason = `Rank ${masterAttackRank}/100 — ${classification} · DealEval ${dealEvaluationScore} · DPS ${lead.deal_priority_score ?? 0} · Exec ${executionProbability}`

    // ── Persist ──────────────────────────────────────────────────────────────

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabaseAdmin as any)
      .from(TABLE)
      .update({
        adjusted_discount_score: adjustedDiscountScore,
        liquidity_score:         liquidityScore,
        liquidity_reason:        liquidityReason,
        execution_probability:   executionProbability,
        execution_reason:        executionReason,
        best_buyer_execution_score: bestBuyerExecutionScore,
        buyer_execution_reason:  buyerExecutionReason,
        upside_score:            upsideScore,
        friction_penalty:        frictionPenalty,
        risk_adjusted_upside_score: riskAdjustedUpsideScore,
        upside_reason:           upsideReason,
        asset_quality_score:     assetQualityScore,
        source_quality_score:    sourceQualityScore,
        deal_evaluation_score:   dealEvaluationScore,
        deal_evaluation_reason:  dealEvaluationReason,
        master_attack_rank:      masterAttackRank,
        master_attack_reason:    masterAttackRankReason,
        deal_evaluation_updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) throw updateError

    console.log(`[deal-eval] "${lead.nome}" → eval=${dealEvaluationScore}/100 rank=${masterAttackRank}/100 [${classification}]`)

    return NextResponse.json({
      lead_id: id,
      nome: lead.nome,
      classification,
      // 8 layers
      adjusted_discount_score:    adjustedDiscountScore,
      liquidity_score:            liquidityScore,
      liquidity_reason:           liquidityReason,
      execution_probability:      executionProbability,
      execution_reason:           executionReason,
      best_buyer_execution_score: bestBuyerExecutionScore,
      buyer_execution_reason:     buyerExecutionReason,
      upside_score:               upsideScore,
      friction_penalty:           frictionPenalty,
      risk_adjusted_upside_score: riskAdjustedUpsideScore,
      upside_reason:              upsideReason,
      asset_quality_score:        assetQualityScore,
      source_quality_score:       sourceQualityScore,
      // Composite scores
      deal_evaluation_score:   dealEvaluationScore,
      deal_evaluation_reason:  dealEvaluationReason,
      master_attack_rank:      masterAttackRank,
      master_attack_reason:    masterAttackRankReason,
    })
  } catch (err) {
    console.error('[deal-eval POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const cronSecret = process.env.CRON_SECRET
    const incomingSecret = _req.headers.get('x-cron-secret')
      ?? _req.headers.get('authorization')?.replace('Bearer ', '')
    const isCron = cronSecret && incomingSecret === cronSecret
    if (!isCron) {
      const session = await auth()
      if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseAdmin as any)
      .from(TABLE)
      .select(`id, nome, adjusted_discount_score, liquidity_score, liquidity_reason,
               execution_probability, execution_reason, best_buyer_execution_score,
               buyer_execution_reason, upside_score, friction_penalty,
               risk_adjusted_upside_score, upside_reason, asset_quality_score,
               source_quality_score, deal_evaluation_score, deal_evaluation_reason,
               master_attack_rank, master_attack_reason, deal_evaluation_updated_at`)
      .eq('id', id)
      .single()

    if (error) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(data)
  } catch (err) {
    console.error('[deal-eval GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
