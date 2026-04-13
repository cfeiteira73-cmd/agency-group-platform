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
//   8. Deal Evaluation Score    (0-100) — ASSET+PRICE quality composite (5 layers)
//                                         adjusted_discount(35%) + liquidity(20%)
//                                         + risk_adj_upside(20%) + asset_quality(15%)
//                                         + source_quality(10%)
//                                         NOTE: NÃO inclui execution/buyer (evitar double-count)
//   +  Master Attack Rank       (0-100) — deal_eval(35%) + execution_prob(25%)
//                                         + deal_priority_score(25%) + buyer_execution(15%)
//
// AUDITORIA: NÃO duplica score engine, buyer matching, price-intel, DPS.
// Usa campos existentes (gross_discount_pct, comp_confidence_score,
// deal_priority_score, buyer_score) como inputs.
// Calibração v2 (2026-04-13): eliminado double-counting de execution_probability
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
// 8. Deal Evaluation Score (0-100) — ASSET+PRICE quality composite (5 layers)
//    Deliberadamente EXCLUI execution_probability e buyer_execution_score
//    para evitar double-counting no Master Attack Rank.
//    adjusted_discount(35%) + liquidity(20%) + risk_adj_upside(20%)
//    + asset_quality(15%) + source_quality(10%)
// ---------------------------------------------------------------------------

function calcDealEvaluationScore(
  adjustedDiscountScore: number,
  liquidityScore: number,
  riskAdjustedUpsideScore: number,
  assetQualityScore: number,
  sourceQualityScore: number
): number {
  return clamp(Math.round(
    adjustedDiscountScore   * 0.35 +
    liquidityScore          * 0.20 +
    riskAdjustedUpsideScore * 0.20 +
    assetQualityScore       * 0.15 +
    sourceQualityScore      * 0.10
  ), 0, 100)
}

// ---------------------------------------------------------------------------
// Master Attack Rank (0-100) — v2
//    deal_eval(35%) + execution_probability(25%) + deal_priority_score(25%)
//    + buyer_execution_score(15%)
//    Combina qualidade do activo + fechabilidade + compradores + match AI
// ---------------------------------------------------------------------------

function calcMasterAttackRank(
  dealEvaluationScore: number,
  executionProbability: number,
  dealPriorityScore: number | null,
  bestBuyerExecutionScore: number
): number {
  return clamp(Math.round(
    dealEvaluationScore       * 0.35 +
    executionProbability      * 0.25 +
    (dealPriorityScore ?? 0)  * 0.25 +
    bestBuyerExecutionScore   * 0.15
  ), 0, 100)
}

// ---------------------------------------------------------------------------
// Classification label — negative signals checked FIRST (fix ordering bug v1)
// ---------------------------------------------------------------------------

function classifyDeal(
  masterAttackRank: number,
  executionProbability: number,
  adjustedDiscountScore: number
): string {
  // Negative signals — must be checked before positive thresholds
  if (adjustedDiscountScore <= 5 && masterAttackRank < 40) return 'Preço acima do mercado'
  if (executionProbability < 15 && masterAttackRank < 40)  return 'Dados insuficientes'
  // Positive classifications — ordered by strength
  if (masterAttackRank >= 80 && executionProbability >= 70)           return 'Ataque imediato'
  if (masterAttackRank >= 65 && adjustedDiscountScore >= 40)          return 'Oportunidade forte'
  if (adjustedDiscountScore >= 40 && executionProbability < 40)       return 'Produto bom, deal fraco'
  if (masterAttackRank >= 50)                                         return 'Boa mas não prioritária'
  return 'Dados insuficientes'
}

// ---------------------------------------------------------------------------
// Next action — explicit operator instruction per classification
// ---------------------------------------------------------------------------

function getNextAction(classification: string): string {
  switch (classification) {
    case 'Ataque imediato':
      return 'Contactar proprietário hoje. Agendar visita nas próximas 48h. Preparar proposta.'
    case 'Oportunidade forte':
      return 'Validar dados com visita. Confirmar motivação do vendedor. Apresentar ao buyer primário.'
    case 'Produto bom, deal fraco':
      return 'Renegociar preço ou aguardar evento (herança, divórcio). Qualificar melhor o vendedor.'
    case 'Boa mas não prioritária':
      return 'Manter contacto mensal. Reactivar se surgir urgência ou nova oferta de buyer.'
    case 'Preço acima do mercado':
      return 'Arquivar ou propor preço alinhado com mercado. Revisitar em 90 dias.'
    default:
      return 'Completar dados: preço de mercado, contacto directo e matching de compradores.'
  }
}

// ---------------------------------------------------------------------------
// Data Completeness Score (0-100) — FASE 18
//   contacto(30) + area_m2(20) + price_intel(20) + buyer_match(15) + source(15)
// ---------------------------------------------------------------------------

function calcDataCompletenessScore(
  contacto: string | null,
  areaM2: number | null,
  grossDiscountPct: number | null,
  matchedBuyersCount: number | null,
  sourceQualityScore: number
): { score: number; missing: string[] } {
  const missing: string[] = []

  const c = contacto?.trim() ?? ''
  const contactPts = (!c)
    ? (missing.push('contacto'), 0)
    : (/^(\+?[0-9\s\-().]{7,20})$/.test(c) || c.includes('@')) ? 30 : 15

  const areaPts = areaM2 ? 20 : (missing.push('area_m2'), 0)

  const pricePts = grossDiscountPct !== null ? 20 : (missing.push('price_intel'), 0)

  const buyerPts = (matchedBuyersCount ?? 0) > 0 ? 15 : (missing.push('buyer_match'), 0)

  // source_quality contributes 15pts — normalize from 0-100 score to 0-15
  const sourcePts = Math.round((sourceQualityScore / 100) * 15)

  const score = clamp(contactPts + areaPts + pricePts + buyerPts + sourcePts, 0, 100)
  return { score, missing }
}

// ---------------------------------------------------------------------------
// Execution Blocker — FASE 18
//   Priority: no_contact > no_price_intel > no_buyer > sla_breach
//             > insufficient_data > ready_to_attack
// ---------------------------------------------------------------------------

type ExecutionBlocker =
  | 'no_contact'
  | 'no_price_intel'
  | 'no_buyer'
  | 'no_meeting'
  | 'sla_breach'
  | 'insufficient_data'
  | 'deal_kill'
  | 'cpcv_trigger'
  | 'ready_to_attack'

// ---------------------------------------------------------------------------
// Money Priority Score (0-100) — FASE 20
//   cpcv_probability(50%) + velocity(20%) + buyer_pressure(20%) + ticket(10%)
//   Ordena por receita × velocidade — o que fecha mais depressa com mais €
// ---------------------------------------------------------------------------

function calcMoneyPriorityScore(
  cpcvProbability: number,
  dealVelocityScore: number,
  buyerPressureScore: number,
  priceAsk: number | null
): number {
  const ticketScore = !priceAsk ? 0
    : priceAsk >= 10_000_000 ? 100
    : priceAsk >= 5_000_000 ? 90
    : priceAsk >= 2_000_000 ? 75
    : priceAsk >= 1_000_000 ? 60
    : priceAsk >= 500_000 ? 45
    : priceAsk >= 200_000 ? 30 : 15

  return clamp(Math.round(
    cpcvProbability    * 0.50 +
    dealVelocityScore  * 0.20 +
    buyerPressureScore * 0.20 +
    ticketScore        * 0.10
  ), 0, 100)
}

// ---------------------------------------------------------------------------
// Deal Kill Flag — FASE 20
//   Sinaliza leads que devem ser descartadas para limpar a execution queue
// ---------------------------------------------------------------------------

function calcDealKillFlag(
  contacto: string | null,
  createdAt: string | null,
  score: number | null,
  matchedBuyersCount: number | null,
  areaM2: number | null,
  priceAsk: number | null
): boolean {
  const c = contacto?.trim() ?? ''
  const ageH = createdAt
    ? (Date.now() - new Date(createdAt).getTime()) / 3_600_000
    : 0
  // No contact >72h and low score
  if (!c && ageH > 72 && (score ?? 0) < 70) return true
  // No buyers and score below threshold
  if ((matchedBuyersCount ?? 0) === 0 && (score ?? 0) < 60) return true
  // Price intel permanently impossible and low score (no area + no price_ask)
  if (!areaM2 && !priceAsk && (score ?? 0) < 60) return true
  return false
}

// ---------------------------------------------------------------------------
// Buyer Competition Flag — FASE 20
//   ≥2 matched buyers + high buyer pressure = usar urgência competitiva
// ---------------------------------------------------------------------------

function calcBuyerCompetitionFlag(
  matchedBuyersCount: number | null,
  buyerPressureScore: number
): boolean {
  return (matchedBuyersCount ?? 0) >= 2 && buyerPressureScore >= 70
}

// ---------------------------------------------------------------------------
// Next Contact Channel — FASE 20
//   Sequência: call → whatsapp → email → linkedin → loop
// ---------------------------------------------------------------------------

function getNextContactChannel(
  contactAttempts: number | null,
  lastAttemptChannel: string | null
): string {
  const attempts = contactAttempts ?? 0
  if (attempts === 0) return 'LIGAR — primeiro contacto'
  if (lastAttemptChannel === 'call' || attempts === 1) return 'WHATSAPP — não atendeu chamada'
  if (lastAttemptChannel === 'whatsapp' || attempts === 2) return 'EMAIL — sem resposta WA'
  if (lastAttemptChannel === 'email' || attempts === 3) return 'LINKEDIN — tentar via rede'
  return `LOOP — ${attempts} tentativas. Escalar ou descartar.`
}

// ---------------------------------------------------------------------------
// Execution Blocker v2 — FASE 20
//   Priority (high→low): deal_kill > cpcv_trigger > no_contact > no_price_intel
//   > no_buyer > no_meeting > sla_breach > insufficient_data > ready_to_attack
// ---------------------------------------------------------------------------

function getExecutionBlocker(
  contacto: string | null,
  grossDiscountPct: number | null,
  priceAsk: number | null,
  areaM2: number | null,
  matchedBuyersCount: number | null,
  slaBreached: boolean | null,
  dataCompletenessScore: number,
  // FASE 20 additions
  score: number | null,
  firstMeetingAt: string | null,
  dealReadinessScore: number,
  buyerPressureClass: 'HIGH' | 'MED' | 'LOW',
  cpcvProbability: number,
  dealKillFlag: boolean
): ExecutionBlocker {
  // 1. Kill — remove from active queue
  if (dealKillFlag) return 'deal_kill'
  // 2. CPCV trigger — highest commercial priority
  if (dealReadinessScore >= 80 && buyerPressureClass === 'HIGH' && cpcvProbability >= 65) return 'cpcv_trigger'
  // 3. No contact — pipeline cannot start
  const c = contacto?.trim() ?? ''
  if (!c) return 'no_contact'
  // 4. Price intel missing but possible
  if (grossDiscountPct === null && priceAsk !== null && areaM2 !== null) return 'no_price_intel'
  // 5. No buyer matched
  if ((matchedBuyersCount ?? 0) === 0) return 'no_buyer'
  // 6. Meeting enforcement — FASE 3 hard rule (score≥70 requires meeting)
  if ((score ?? 0) >= 70 && !firstMeetingAt) return 'no_meeting'
  // 7. SLA violation
  if (slaBreached) return 'sla_breach'
  // 8. Insufficient data
  if (dataCompletenessScore < 60) return 'insufficient_data'
  return 'ready_to_attack'
}

// ---------------------------------------------------------------------------
// Effective next action — execution blocker overrides classification action
// ---------------------------------------------------------------------------

function getEffectiveNextAction(
  blocker: ExecutionBlocker,
  classificationAction: string
): string {
  // Kept for backwards compat (GET handler). POST uses buildNextAction3.
  switch (blocker) {
    case 'deal_kill':      return '🚫 DESCARTAR — baixo ROI, sem progressão possível. Arquivar.'
    case 'cpcv_trigger':   return '🔥 PREPARAR CPCV HOJE — todas as condições verificadas.'
    case 'no_contact':     return '🚨 OBTER CONTACTO IMEDIATO — sem telefone/email, execução impossível.'
    case 'no_price_intel': return '⚠️ CORRER PRICE-INTEL — área e preço existem mas desconto desconhecido.'
    case 'no_buyer':       return '⚠️ ENCONTRAR COMPRADOR — correr matching ou activar buyer list.'
    case 'no_meeting':     return '🚨 MARCAR VISITA EM 24H — CRÍTICO. Score alto sem visita = sem CPCV.'
    case 'sla_breach':     return '🚨 CONTACTAR AGORA — SLA em breach. Ligar imediatamente.'
    case 'insufficient_data': return '📋 COMPLETAR DADOS — obter área, contacto e preço de mercado.'
    case 'ready_to_attack': return classificationAction
  }
}

// ---------------------------------------------------------------------------
// FASE 19 — Closing Engine
// ---------------------------------------------------------------------------

// Deal Velocity Score (0-100) — FASE 19
//   contacto <2h(25) + visita <24h(25) + proposta <48h(25) + CPCV <7d(25)
// ---------------------------------------------------------------------------

function calcDealVelocityScore(
  createdAt: string | null,
  firstContactAt: string | null,
  slaContactedAt: string | null,
  firstMeetingAt: string | null,
  offerDate: string | null,
  cpcvSignedAt: string | null
): { score: number; velocityReason: string } {
  if (!createdAt) return { score: 0, velocityReason: 'Pipeline não iniciado' }

  const origin = new Date(createdAt).getTime()
  let score = 0
  const parts: string[] = []

  // Contact speed (25pts)
  const contactAt = firstContactAt ?? slaContactedAt
  if (contactAt) {
    const h = (new Date(contactAt).getTime() - origin) / 3_600_000
    if (h <= 2)  { score += 25; parts.push('contacto <2h ⚡') }
    else if (h <= 24) { score += 15; parts.push('contacto <24h') }
    else          { score += 5;  parts.push('contacto tardio') }
  }

  // Meeting speed (25pts)
  if (firstMeetingAt) {
    const h = (new Date(firstMeetingAt).getTime() - origin) / 3_600_000
    if (h <= 24)  { score += 25; parts.push('visita <24h ⚡') }
    else if (h <= 72)  { score += 15; parts.push('visita <72h') }
    else           { score += 5;  parts.push('visita lenta') }
  }

  // Offer speed (25pts)
  if (offerDate) {
    const h = (new Date(offerDate).getTime() - origin) / 3_600_000
    if (h <= 48)  { score += 25; parts.push('proposta <48h ⚡') }
    else if (h <= 168) { score += 15; parts.push('proposta <7d') }
    else           { score += 5;  parts.push('proposta lenta') }
  }

  // CPCV speed (25pts)
  if (cpcvSignedAt) {
    const d = (new Date(cpcvSignedAt).getTime() - origin) / 86_400_000
    if (d <= 7)   { score += 25; parts.push('CPCV <7d ⚡') }
    else if (d <= 30)  { score += 15; parts.push('CPCV <30d') }
    else           { score += 5;  parts.push('CPCV lento') }
  }

  return {
    score: clamp(score, 0, 100),
    velocityReason: parts.join(' · ') || 'Pipeline ainda não iniciado',
  }
}

// ---------------------------------------------------------------------------
// Buyer Pressure Score (0-100) — FASE 19
//   liquidez(30) + histórico(20) + velocidade(20) + response_rate(15) + reliability(15)
//   × active_status multiplier
// ---------------------------------------------------------------------------

interface BuyerPressureData {
  liquidity_profile: string | null
  deals_closed_count: number | null
  avg_close_days: number | null
  response_rate: number | null
  reliability_score: number | null
  active_status: string | null
  name?: string | null
}

function calcBuyerPressureScore(buyer: BuyerPressureData | null): {
  score: number
  pressureClass: 'HIGH' | 'MED' | 'LOW'
  reason: string
} {
  if (!buyer) return { score: 0, pressureClass: 'LOW', reason: 'Sem comprador primário matched' }

  const liqPts = buyer.liquidity_profile === 'immediate' ? 30
    : buyer.liquidity_profile === 'under_30_days' ? 20
    : buyer.liquidity_profile === 'financed' ? 10 : 5

  const closedPts = (buyer.deals_closed_count ?? 0) >= 5 ? 20
    : (buyer.deals_closed_count ?? 0) >= 3 ? 15
    : (buyer.deals_closed_count ?? 0) >= 1 ? 10 : 0

  const speedPts = (buyer.avg_close_days ?? 999) <= 21 ? 20
    : (buyer.avg_close_days ?? 999) <= 45 ? 15
    : (buyer.avg_close_days ?? 999) <= 90 ? 10 : 5

  const responsePts = (buyer.response_rate ?? 0) >= 80 ? 15
    : (buyer.response_rate ?? 0) >= 50 ? 10 : 5

  const reliabilityPts = (buyer.reliability_score ?? 0) >= 80 ? 15
    : (buyer.reliability_score ?? 0) >= 60 ? 10 : 5

  const activeMult = buyer.active_status === 'active' ? 1.0
    : buyer.active_status === 'dormant' ? 0.70
    : buyer.active_status === 'inactive' ? 0.40 : 0.60

  const raw = liqPts + closedPts + speedPts + responsePts + reliabilityPts
  const score = clamp(Math.round(raw * activeMult), 0, 100)
  const pressureClass: 'HIGH' | 'MED' | 'LOW' = score >= 70 ? 'HIGH' : score >= 40 ? 'MED' : 'LOW'

  const parts: string[] = []
  if (buyer.name) parts.push(buyer.name)
  if (buyer.liquidity_profile === 'immediate') parts.push('liquidez imediata')
  else if (buyer.liquidity_profile === 'under_30_days') parts.push('liquidez <30d')
  else if (buyer.liquidity_profile === 'financed') parts.push('financiado')
  if ((buyer.deals_closed_count ?? 0) >= 3) parts.push(`${buyer.deals_closed_count} deals fechados`)
  if ((buyer.avg_close_days ?? 999) <= 30) parts.push(`fecha em ~${buyer.avg_close_days}d`)
  if (buyer.active_status !== 'active') parts.push(`⚠️ ${buyer.active_status}`)

  return { score, pressureClass, reason: parts.join(' · ') || `Buyer pressure ${pressureClass}` }
}

// ---------------------------------------------------------------------------
// Seller Pressure Reason — FASE 19
// ---------------------------------------------------------------------------

function calcSellerPressureReason(
  ownerType: string | null,
  urgency: string | null,
  grossDiscountPct: number | null,
  negotiationStatus: string | null,
  precloseCandidiate: boolean | null
): string {
  const parts: string[] = []
  const ownerN = (ownerType ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (ownerN.includes('heranca') || ownerN.includes('herança')) parts.push('herança — pressão máxima')
  else if (ownerN === 'banco' || ownerN === 'fundo') parts.push('banco/fundo — motivado para liquidar')
  else if (ownerN === 'empresa') parts.push('empresa — processo racional')
  else if (ownerN === 'individual') parts.push('individual — emocional, negociável')
  if (urgency === 'high') parts.push('urgência alta declarada')
  else if (urgency === 'low') parts.push('sem urgência declarada')
  if (grossDiscountPct !== null && grossDiscountPct >= 20)
    parts.push(`preço ${grossDiscountPct.toFixed(0)}% abaixo mercado`)
  if (precloseCandidiate) parts.push('em processo de pré-fecho')
  if (negotiationStatus && negotiationStatus !== 'idle') parts.push(`negociação: ${negotiationStatus}`)
  return parts.join(' · ') || 'Pressão vendedor não avaliada'
}

// ---------------------------------------------------------------------------
// Deal Readiness Score (0-100) — FASE 19
//   contacto(20) + visita(20) + preclose(20) + buyer alinhado(20) + preço ok(20)
//   ≥80 = READY TO CLOSE
// ---------------------------------------------------------------------------

function calcDealReadinessScore(
  contacto: string | null,
  firstMeetingAt: string | null,
  precloseCandidiate: boolean | null,
  bestBuyerMatchScore: number | null,
  grossDiscountPct: number | null
): { score: number; readinessReason: string } {
  const c = contacto?.trim() ?? ''
  const hasContact = !!(c && (/^(\+?[0-9\s\-().]{7,20})$/.test(c) || c.includes('@')))

  const contactPts  = hasContact ? 20 : 0
  const meetingPts  = firstMeetingAt ? 20 : 0
  const preclosePts = precloseCandidiate ? 20 : 0
  const buyerPts    = (bestBuyerMatchScore ?? 0) >= 70 ? 20 : (bestBuyerMatchScore ?? 0) >= 50 ? 10 : 0
  const pricePts    = grossDiscountPct !== null && grossDiscountPct >= 0 ? 20 : 0

  const score = clamp(contactPts + meetingPts + preclosePts + buyerPts + pricePts, 0, 100)

  const missing: string[] = []
  if (!hasContact) missing.push('contacto directo')
  if (!firstMeetingAt) missing.push('visita/reunião')
  if (!precloseCandidiate) missing.push('pré-fecho formal')
  if ((bestBuyerMatchScore ?? 0) < 70) missing.push('buyer alinhado ≥70%')
  if (grossDiscountPct === null) missing.push('validação de preço')

  const readinessReason = score >= 80
    ? '✅ READY TO CLOSE — todas as condições verificadas'
    : `${score}/100 — em falta: ${missing.join(', ')}`

  return { score, readinessReason }
}

// ---------------------------------------------------------------------------
// CPCV Probability (0-100) — FASE 19
//   deal_eval(30%) + buyer_pressure(25%) + velocity(20%) + readiness(25%)
// ---------------------------------------------------------------------------

function calcCPCVProbability(
  dealEvaluationScore: number,
  buyerPressureScore: number,
  dealVelocityScore: number,
  dealReadinessScore: number
): number {
  return clamp(Math.round(
    dealEvaluationScore  * 0.30 +
    buyerPressureScore   * 0.25 +
    dealVelocityScore    * 0.20 +
    dealReadinessScore   * 0.25
  ), 0, 100)
}

// ---------------------------------------------------------------------------
// Next Action 2.0 — pressão + contexto buyer + objetivo explícito
// ---------------------------------------------------------------------------

function buildNextAction2(
  blocker: ExecutionBlocker,
  classification: string,
  buyerPressureClass: 'HIGH' | 'MED' | 'LOW',
  buyerPressureReason: string,
  sellerPressureReason: string,
  cpcvProbability: number,
  dealReadinessScore: number,
  // FASE 20 additions
  buyerCompetitionFlag: boolean,
  contactAttempts: number | null,
  lastAttemptChannel: string | null,
  moneyPriorityScore: number
): string {
  // ── FASE 20: Kill signal ──────────────────────────────────────────────────
  if (blocker === 'deal_kill') {
    return `🚫 DESCARTAR — baixo ROI sem progressão possível. Arquivar lead e libertar tempo de execução.`
  }

  // ── FASE 7: CPCV Trigger ──────────────────────────────────────────────────
  if (blocker === 'cpcv_trigger') {
    const buyerCtx = buyerPressureClass === 'HIGH'
      ? `${buyerPressureReason}.`
      : 'Buyer em posição.'
    const compCtx = buyerCompetitionFlag ? ' Múltiplos compradores activos — criar urgência.' : ''
    return `🔥 PREPARAR CPCV HOJE — CPCV ${cpcvProbability}%. ${buyerCtx}${compCtx} Vendedor: ${sellerPressureReason}. Objectivo: minuta CPCV esta semana.`
  }

  // ── Hard blockers with contact channel ───────────────────────────────────
  if (blocker === 'no_contact') {
    const channel = getNextContactChannel(contactAttempts, lastAttemptChannel)
    return `🚨 OBTER CONTACTO — ${channel}. Tentar LinkedIn, registo predial, intermediário. Sem contacto = pipeline bloqueado.`
  }

  if (blocker === 'sla_breach') {
    const channel = getNextContactChannel(contactAttempts, lastAttemptChannel)
    const buyerCtx = buyerPressureClass === 'HIGH' ? ` ${buyerPressureReason} à espera.` : ''
    return `🚨 SLA BREACH — ${channel}.${buyerCtx} Registar tentativa. Objectivo: confirmar visita esta semana.`
  }

  if (blocker === 'no_meeting') {
    const compCtx = buyerCompetitionFlag ? ' Múltiplos compradores — usar urgência competitiva.' : ''
    const buyerCtx = buyerPressureClass === 'HIGH' ? ` ${buyerPressureReason}.` : ''
    return `🚨 MARCAR VISITA EM 24H — CRÍTICO (money score: ${moneyPriorityScore}/100).${buyerCtx}${compCtx} Sem visita não há CPCV.`
  }

  if (blocker === 'no_price_intel') {
    return `⚠️ CORRER PRICE-INTEL — preço e área existem mas desconto desconhecido. Sem este dado, deal-eval é cego. Clicar "Analisar Preço".`
  }

  if (blocker === 'no_buyer') {
    return `⚠️ ACTIVAR BUYER LIST — sem compradores matched. Correr matching ou contactar compradores activos para esta zona/tipologia.`
  }

  if (blocker === 'insufficient_data') {
    return `📋 COMPLETAR DADOS — obter: área do imóvel, contacto directo, análise de preço de mercado.`
  }

  // ── Ready to attack — full context Next Action 3.0 ───────────────────────
  const urgencyEmoji = cpcvProbability >= 70 ? '🔥' : cpcvProbability >= 50 ? '⚡' : '📌'
  const readinessLabel = dealReadinessScore >= 80 ? 'READY TO CLOSE' : classification

  const buyerCtx = buyerPressureClass === 'HIGH'
    ? `Buyer HIGH pressure: ${buyerPressureReason}.`
    : buyerPressureClass === 'MED'
    ? `Buyer disponível: ${buyerPressureReason}.`
    : 'Buyer com baixa pressão — qualificar disponibilidade.'

  const compCtx = buyerCompetitionFlag
    ? ' Múltiplos compradores HIGH activos — apresentar proposta com urgência.'
    : ''

  const sellerCtx = sellerPressureReason ? ` Vendedor: ${sellerPressureReason}.` : ''

  const objetivo = dealReadinessScore >= 80
    ? 'Objectivo: fechar CPCV esta semana.'
    : dealReadinessScore >= 60
    ? 'Objectivo: agendar visita e alinhar proposta.'
    : 'Objectivo: validar interesse e marcar visita.'

  return `${urgencyEmoji} ${readinessLabel} (CPCV ${cpcvProbability}%, €${moneyPriorityScore}ROI) — ${buyerCtx}${compCtx}${sellerCtx} ${objetivo}`.trim()
}

// ---------------------------------------------------------------------------
// FASE 21 — Discipline Engine
// ---------------------------------------------------------------------------

// Execution Discipline Score (0-100)
//   Mede disciplina do agente dentro de cada milestone do pipeline:
//   contacto<2h(25) + visita<24h após contacto(25)
//   + follow-up<24h após visita(25) + proposta<48h após visita(25)
// ---------------------------------------------------------------------------

function calcExecutionDisciplineScore(
  createdAt: string | null,
  firstContactAt: string | null,
  slaContactedAt: string | null,
  firstMeetingAt: string | null,
  offerDate: string | null,
  nextFollowupAt: string | null
): { score: number; disciplineReason: string } {
  if (!createdAt) return { score: 0, disciplineReason: 'Lead sem data de criação' }

  const origin = new Date(createdAt).getTime()
  let score = 0
  const parts: string[] = []

  // 1. Contacto vs criação (25pts)
  const contactAt = firstContactAt ?? slaContactedAt
  if (contactAt) {
    const h = (new Date(contactAt).getTime() - origin) / 3_600_000
    if (h <= 2)       { score += 25; parts.push('contacto <2h ✅') }
    else if (h <= 24) { score += 15; parts.push('contacto <24h') }
    else              { score += 5;  parts.push('contacto tardio ⚠️') }
  } else {
    parts.push('sem contacto ❌')
  }

  // 2. Visita vs primeiro contacto (25pts)
  if (firstMeetingAt && contactAt) {
    const h = (new Date(firstMeetingAt).getTime() - new Date(contactAt).getTime()) / 3_600_000
    if (h <= 24)      { score += 25; parts.push('visita <24h ✅') }
    else if (h <= 72) { score += 15; parts.push('visita <72h') }
    else              { score += 5;  parts.push('visita lenta ⚠️') }
  } else if (contactAt && !firstMeetingAt) {
    const hoursSinceContact = (Date.now() - new Date(contactAt).getTime()) / 3_600_000
    if (hoursSinceContact > 48) parts.push('visita não agendada ❌')
  }

  // 3. Follow-up vs visita (25pts)
  //    Proxy: next_followup_at was set within 24h of meeting, OR offer exists
  if (firstMeetingAt) {
    const meetingMs = new Date(firstMeetingAt).getTime()
    if (offerDate) {
      const h = (new Date(offerDate).getTime() - meetingMs) / 3_600_000
      if (h <= 24)      { score += 25; parts.push('proposta <24h pós-visita ✅') }
      else if (h <= 48) { score += 18; parts.push('proposta <48h pós-visita') }
      else              { score += 8;  parts.push('proposta lenta pós-visita ⚠️') }
    } else if (nextFollowupAt) {
      const h = (new Date(nextFollowupAt).getTime() - meetingMs) / 3_600_000
      if (h <= 24)      { score += 20; parts.push('follow-up agendado <24h ✅') }
      else if (h <= 48) { score += 12; parts.push('follow-up agendado <48h') }
      else              { score += 5;  parts.push('follow-up agendado tardio') }
    } else {
      const h = (Date.now() - meetingMs) / 3_600_000
      if (h > 48) parts.push('sem follow-up pós-visita ❌')
    }
  }

  // 4. Proposta <48h após visita (25pts) — só conta se visita feita mas não contado acima
  if (firstMeetingAt && offerDate) {
    const h = (new Date(offerDate).getTime() - new Date(firstMeetingAt).getTime()) / 3_600_000
    // Only add pts if not already counted in step 3
    if (h <= 48 && !offerDate) { score += 25; parts.push('proposta <48h ✅') }
    // (already counted in step 3 if offerDate exists)
  } else if (firstMeetingAt && !offerDate) {
    const h = (Date.now() - new Date(firstMeetingAt).getTime()) / 3_600_000
    if (h > 72) parts.push('sem proposta após visita ❌')
  }

  return {
    score: clamp(score, 0, 100),
    disciplineReason: parts.join(' · ') || `Disciplina ${score}/100`,
  }
}

// Close Window Score (0-100)
//   Janela de fecho AGORA:
//   visita recente <48h(25) + buyer HIGH pressure(25)
//   + seller com pressão alta(25) + desconto >15%(25)
// ---------------------------------------------------------------------------

function calcCloseWindowScore(
  firstMeetingAt: string | null,
  buyerPressureClass: 'HIGH' | 'MED' | 'LOW',
  ownerType: string | null,
  urgency: string | null,
  grossDiscountPct: number | null,
  preclose: boolean | null
): { score: number; windowReason: string } {
  const parts: string[] = []
  let score = 0

  // 1. Visita recente <48h (25pts)
  if (firstMeetingAt) {
    const h = (Date.now() - new Date(firstMeetingAt).getTime()) / 3_600_000
    if (h <= 48)       { score += 25; parts.push('visita recente ⚡') }
    else if (h <= 168) { score += 12; parts.push('visita <7d') }
    else               { score += 3;  parts.push('visita antiga') }
  } else {
    parts.push('sem visita') // no meeting = window not open
  }

  // 2. Buyer HIGH pressure (25pts)
  if (buyerPressureClass === 'HIGH')     { score += 25; parts.push('buyer HIGH pressure') }
  else if (buyerPressureClass === 'MED') { score += 12; parts.push('buyer MED pressure') }
  else                                   { parts.push('buyer LOW — risco perder janela') }

  // 3. Seller com pressão alta (25pts)
  const ownerN = (ownerType ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const highPressureSeller = ownerN.includes('heranca') || ownerN.includes('herança')
    || ownerN === 'banco' || ownerN === 'fundo'
    || urgency === 'high'
    || (preclose === true)
  const medPressureSeller = ownerN === 'empresa' || urgency === 'medium'
  if (highPressureSeller)  { score += 25; parts.push('vendedor motivado') }
  else if (medPressureSeller) { score += 12; parts.push('vendedor parcialmente motivado') }
  else                        { parts.push('vendedor sem urgência') }

  // 4. Desconto forte >15% (25pts)
  if (grossDiscountPct !== null) {
    if (grossDiscountPct >= 25)      { score += 25; parts.push(`desconto ${grossDiscountPct.toFixed(0)}% ⚡`) }
    else if (grossDiscountPct >= 15) { score += 18; parts.push(`desconto ${grossDiscountPct.toFixed(0)}%`) }
    else if (grossDiscountPct >= 5)  { score += 8;  parts.push(`desconto leve ${grossDiscountPct.toFixed(0)}%`) }
    else                             { parts.push('sem desconto real') }
  } else {
    parts.push('sem price-intel')
  }

  return { score: clamp(score, 0, 100), windowReason: parts.join(' · ') || `Janela ${score}/100` }
}

// Deal Momentum Score (0-100)
//   Actividade e progressão dos últimos 7 dias:
//   contacto activo últimos 7d(20) + visita últimos 7d(20)
//   + proposta activa últimos 7d(20) + negociação viva(20)
//   + tentativas contacto ≥2(20)
// ---------------------------------------------------------------------------

function calcDealMomentumScore(
  firstContactAt: string | null,
  slaContactedAt: string | null,
  lastContactAt: string | null,
  firstMeetingAt: string | null,
  offerDate: string | null,
  negotiationStatus: string | null,
  contactAttempts: number | null
): { score: number; momentumReason: string } {
  const SEVEN_DAYS = 7 * 24 * 3_600_000
  const now = Date.now()
  let score = 0
  const parts: string[] = []

  // 1. Contacto activo últimos 7d (20pts)
  const lastC = lastContactAt ?? firstContactAt ?? slaContactedAt
  if (lastC && (now - new Date(lastC).getTime()) <= SEVEN_DAYS) {
    score += 20; parts.push('contacto recente ✅')
  } else if (lastC) {
    parts.push('contacto >7d atrás ⚠️')
  } else {
    parts.push('sem contacto ❌')
  }

  // 2. Visita últimos 7d (20pts)
  if (firstMeetingAt && (now - new Date(firstMeetingAt).getTime()) <= SEVEN_DAYS) {
    score += 20; parts.push('visita recente ✅')
  } else if (firstMeetingAt) {
    score += 8; parts.push('visita feita (>7d)')
  }

  // 3. Proposta activa últimos 7d (20pts)
  if (offerDate && (now - new Date(offerDate).getTime()) <= SEVEN_DAYS) {
    score += 20; parts.push('proposta activa ✅')
  } else if (offerDate) {
    score += 8; parts.push('proposta >7d')
  }

  // 4. Negociação viva (20pts)
  const activeNegot = negotiationStatus && !['idle', 'withdrawn', 'blocked'].includes(negotiationStatus)
  if (activeNegot) { score += 20; parts.push(`negociação: ${negotiationStatus}`) }

  // 5. Tentativas de contacto ≥2 (20pts)
  const attempts = contactAttempts ?? 0
  if (attempts >= 3)      { score += 20; parts.push(`${attempts} tentativas`) }
  else if (attempts >= 2) { score += 12; parts.push(`${attempts} tentativas`) }
  else if (attempts >= 1) { score += 5;  parts.push('1 tentativa') }

  return { score: clamp(score, 0, 100), momentumReason: parts.join(' · ') || 'Pipeline inactivo' }
}

// Human Failure Flag
//   TRUE quando o agente (humano) está a falhar SLAs críticos:
//   sla_breach sem contacto tentado, OU
//   score ≥70 sem visita após 72h, OU
//   contacto feito mas sem follow-up em 48h
// ---------------------------------------------------------------------------

function calcHumanFailureFlag(
  slaBreached: boolean | null,
  contactAttempts: number | null,
  firstContactAt: string | null,
  slaContactedAt: string | null,
  score: number | null,
  firstMeetingAt: string | null,
  createdAt: string | null,
  offerDate: string | null,
  nextFollowupAt: string | null
): boolean {
  // 1. SLA breach + nunca tentou contacto
  if (slaBreached && (contactAttempts ?? 0) === 0) return true

  // 2. Lead de alta qualidade sem visita após 72h de existência
  const ageH = createdAt ? (Date.now() - new Date(createdAt).getTime()) / 3_600_000 : 0
  if ((score ?? 0) >= 70 && !firstMeetingAt && ageH > 72) return true

  // 3. Contacto feito mas sem follow-up 48h depois (nem proposta nem follow-up agendado)
  const contactAt = firstContactAt ?? slaContactedAt
  if (contactAt && !firstMeetingAt && !offerDate && !nextFollowupAt) {
    const h = (Date.now() - new Date(contactAt).getTime()) / 3_600_000
    if (h > 48) return true
  }

  return false
}

// Time Waste Flag
//   TRUE quando o deal consome atenção sem ROI possível AGORA:
//   sem comprador + sem contacto + >72h + score <65
//   OR ≥4 tentativas de contacto sem resposta + sem buyer matched
// ---------------------------------------------------------------------------

function calcTimeWasteFlag(
  contacto: string | null,
  matchedBuyersCount: number | null,
  createdAt: string | null,
  score: number | null,
  contactAttempts: number | null,
  firstMeetingAt: string | null
): boolean {
  const c = contacto?.trim() ?? ''
  const ageH = createdAt ? (Date.now() - new Date(createdAt).getTime()) / 3_600_000 : 0
  const buyers = matchedBuyersCount ?? 0
  const attempts = contactAttempts ?? 0

  // Sem contacto + sem buyer + >72h + score baixo
  if (!c && buyers === 0 && ageH > 72 && (score ?? 0) < 65) return true

  // Muitas tentativas falhadas sem buyer — nenhum caminho para CPCV
  if (attempts >= 4 && buyers === 0 && !firstMeetingAt) return true

  return false
}

// Realistic CPCV Forecast Flag
//   TRUE quando o lead conta para o forecast conservador apresentado à direcção:
//   visita feita + buyer HIGH pressure + deal_readiness_score ≥60
// ---------------------------------------------------------------------------

function calcRealisticCPCVForecastFlag(
  firstMeetingAt: string | null,
  buyerPressureClass: 'HIGH' | 'MED' | 'LOW',
  dealReadinessScore: number
): boolean {
  return !!(firstMeetingAt) && buyerPressureClass === 'HIGH' && dealReadinessScore >= 60
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
               sla_breach, sla_contacted_at, created_at,
               first_contact_at, last_contact_at, first_meeting_at, offer_date, cpcv_signed_at,
               contact_attempts, last_attempt_channel, next_followup_at,
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
    let primaryBuyerPressure: BuyerPressureData | null = null
    if (lead.primary_buyer_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: buyer } = await (supabaseAdmin as any)
        .from('contacts')
        .select('name, buyer_score, active_status, liquidity_profile, deals_closed_count, avg_close_days, reliability_score, response_rate')
        .eq('id', lead.primary_buyer_id)
        .single()
      if (buyer) {
        primaryBuyer = buyer as BuyerData
        primaryBuyerPressure = buyer as BuyerPressureData
      }
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
      adjustedDiscountScore, liquidityScore,
      riskAdjustedUpsideScore, assetQualityScore, sourceQualityScore
    )

    const masterAttackRank = calcMasterAttackRank(
      dealEvaluationScore, executionProbability,
      lead.deal_priority_score, bestBuyerExecutionScore
    )

    const classification = classifyDeal(masterAttackRank, executionProbability, adjustedDiscountScore)
    const classificationNextAction = getNextAction(classification)

    // ── Execution Engine — FASE 18 ────────────────────────────────────────────

    const { score: dataCompletenessScore, missing: dataMissing } = calcDataCompletenessScore(
      lead.contacto, lead.area_m2, lead.gross_discount_pct,
      lead.matched_buyers_count, sourceQualityScore
    )

    const priceIntelBlocked = !lead.area_m2 && lead.gross_discount_pct === null

    // ── Closing Engine — FASE 19+20 ───────────────────────────────────────────

    const { score: dealVelocityScore, velocityReason } = calcDealVelocityScore(
      lead.created_at, lead.first_contact_at, lead.sla_contacted_at,
      lead.first_meeting_at, lead.offer_date, lead.cpcv_signed_at
    )

    const { score: buyerPressureScore, pressureClass: buyerPressureClass, reason: buyerPressureReason } =
      calcBuyerPressureScore(primaryBuyerPressure)

    const sellerPressureReason = calcSellerPressureReason(
      lead.owner_type, lead.urgency, lead.gross_discount_pct,
      lead.negotiation_status, lead.preclose_candidate
    )

    const { score: dealReadinessScore, readinessReason } = calcDealReadinessScore(
      lead.contacto, lead.first_meeting_at, lead.preclose_candidate,
      lead.best_buyer_match_score, lead.gross_discount_pct
    )

    const cpcvProbability = calcCPCVProbability(
      dealEvaluationScore, buyerPressureScore, dealVelocityScore, dealReadinessScore
    )

    // ── Money Engine — FASE 20 ────────────────────────────────────────────────

    const dealKillFlag = calcDealKillFlag(
      lead.contacto, lead.created_at, lead.score,
      lead.matched_buyers_count, lead.area_m2, lead.price_ask
    )

    const buyerCompetitionFlag = calcBuyerCompetitionFlag(
      lead.matched_buyers_count, buyerPressureScore
    )

    const moneyPriorityScore = calcMoneyPriorityScore(
      cpcvProbability, dealVelocityScore, buyerPressureScore, lead.price_ask
    )

    // ── Execution Blocker v2 (FASE 20 — expanded priority chain) ─────────────
    const executionBlocker = getExecutionBlocker(
      lead.contacto, lead.gross_discount_pct, lead.price_ask,
      lead.area_m2, lead.matched_buyers_count,
      lead.sla_breach, dataCompletenessScore,
      lead.score, lead.first_meeting_at,
      dealReadinessScore, buyerPressureClass, cpcvProbability,
      dealKillFlag
    )

    // ── Discipline Engine — FASE 21 ──────────────────────────────────────────

    const { score: executionDisciplineScore, disciplineReason } = calcExecutionDisciplineScore(
      lead.created_at, lead.first_contact_at, lead.sla_contacted_at,
      lead.first_meeting_at, lead.offer_date, lead.next_followup_at ?? null
    )

    const { score: closeWindowScore, windowReason } = calcCloseWindowScore(
      lead.first_meeting_at, buyerPressureClass,
      lead.owner_type, lead.urgency, lead.gross_discount_pct, lead.preclose_candidate
    )

    const { score: dealMomentumScore, momentumReason } = calcDealMomentumScore(
      lead.first_contact_at, lead.sla_contacted_at, lead.last_contact_at ?? null,
      lead.first_meeting_at, lead.offer_date, lead.negotiation_status, lead.contact_attempts
    )

    const humanFailureFlag = calcHumanFailureFlag(
      lead.sla_breach, lead.contact_attempts, lead.first_contact_at, lead.sla_contacted_at,
      lead.score, lead.first_meeting_at, lead.created_at,
      lead.offer_date, lead.next_followup_at ?? null
    )

    const timeWasteFlag = calcTimeWasteFlag(
      lead.contacto, lead.matched_buyers_count, lead.created_at,
      lead.score, lead.contact_attempts, lead.first_meeting_at
    )

    const realisticCPCVForecastFlag = calcRealisticCPCVForecastFlag(
      lead.first_meeting_at, buyerPressureClass, dealReadinessScore
    )

    // ── Micro automation flags ────────────────────────────────────────────────
    const contactAt = lead.first_contact_at ?? lead.sla_contacted_at
    const followUpNeeded = !!(
      contactAt && !lead.first_meeting_at &&
      (Date.now() - new Date(contactAt).getTime()) > 24 * 3_600_000
    )
    const dealStalled = !!(
      lead.offer_date && !lead.cpcv_signed_at &&
      lead.negotiation_status && !['idle', 'withdrawn'].includes(lead.negotiation_status) &&
      (Date.now() - new Date(lead.offer_date).getTime()) > 48 * 3_600_000
    )
    const cpcvReady = dealReadinessScore >= 80

    // ── Next Action 3.0 — full pressure + money context ───────────────────────
    const nextAction = buildNextAction2(
      executionBlocker, classification,
      buyerPressureClass, buyerPressureReason, sellerPressureReason,
      cpcvProbability, dealReadinessScore,
      buyerCompetitionFlag, lead.contact_attempts, lead.last_attempt_channel,
      moneyPriorityScore
    )

    const dealEvaluationReason = [
      `[${classification}]`,
      `CPCV ${cpcvProbability}%`,
      `Desconto adj.: ${adjustedDiscountScore}/100`,
      `Liquidez: ${liquidityScore}/100`,
      `Upside adj.: ${riskAdjustedUpsideScore}/100`,
      `Readiness: ${dealReadinessScore}/100`,
      `Velocity: ${dealVelocityScore}/100`,
      `→ ${nextAction}`,
    ].join(' · ')

    const masterAttackRankReason = `Rank ${masterAttackRank}/100 — ${classification} · CPCV ${cpcvProbability}% · Readiness ${dealReadinessScore} · Buyer ${buyerPressureClass} · ${nextAction}`

    // ── Persist ──────────────────────────────────────────────────────────────

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabaseAdmin as any)
      .from(TABLE)
      .update({
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
        deal_evaluation_score:      dealEvaluationScore,
        deal_evaluation_reason:     dealEvaluationReason,
        master_attack_rank:         masterAttackRank,
        master_attack_reason:       masterAttackRankReason,
        deal_evaluation_updated_at: new Date().toISOString(),
        // FASE 18 — Execution Engine
        data_completeness_score:    dataCompletenessScore,
        execution_blocker_reason:   executionBlocker,
        price_intel_blocked:        priceIntelBlocked,
        // FASE 19 — Closing Engine
        deal_velocity_score:        dealVelocityScore,
        buyer_pressure_score:       buyerPressureScore,
        buyer_pressure_class:       buyerPressureClass,
        seller_pressure_reason:     sellerPressureReason,
        buyer_pressure_reason:      buyerPressureReason,
        deal_readiness_score:       dealReadinessScore,
        cpcv_probability:           cpcvProbability,
        // FASE 20 — Money Engine
        money_priority_score:       moneyPriorityScore,
        buyer_competition_flag:     buyerCompetitionFlag,
        deal_kill_flag:             dealKillFlag,
        // FASE 21 — Discipline Engine
        execution_discipline_score:   executionDisciplineScore,
        close_window_score:           closeWindowScore,
        deal_momentum_score:          dealMomentumScore,
        human_failure_flag:           humanFailureFlag,
        time_waste_flag:              timeWasteFlag,
        realistic_cpcv_forecast_flag: realisticCPCVForecastFlag,
        // Promote to sla_breach if not already set and created >24h ago with no contact
        ...(() => {
          if (lead.sla_breach === true) return {}
          if (lead.sla_contacted_at) return {}
          const ageMs = Date.now() - new Date(lead.created_at ?? 0).getTime()
          return ageMs > 24 * 60 * 60 * 1000 ? { sla_breach: true } : {}
        })(),
      })
      .eq('id', id)

    if (updateError) throw updateError

    console.log(`[deal-eval] "${lead.nome}" rank=${masterAttackRank} CPCV=${cpcvProbability}% ready=${dealReadinessScore} [${classification}] blocker=${executionBlocker}`)

    return NextResponse.json({
      lead_id: id,
      nome: lead.nome,
      classification,
      // FASE 18 — Execution Engine
      execution_blocker_reason:  executionBlocker,
      next_action:               nextAction,
      data_completeness_score:   dataCompletenessScore,
      data_missing:              dataMissing,
      price_intel_blocked:       priceIntelBlocked,
      // FASE 19 — Closing Engine
      deal_velocity_score:       dealVelocityScore,
      velocity_reason:           velocityReason,
      buyer_pressure_score:      buyerPressureScore,
      buyer_pressure_class:      buyerPressureClass,
      buyer_pressure_reason:     buyerPressureReason,
      seller_pressure_reason:    sellerPressureReason,
      deal_readiness_score:      dealReadinessScore,
      readiness_reason:          readinessReason,
      cpcv_probability:          cpcvProbability,
      // FASE 20 — Money Engine
      money_priority_score:      moneyPriorityScore,
      buyer_competition_flag:    buyerCompetitionFlag,
      deal_kill_flag:            dealKillFlag,
      // FASE 21 — Discipline Engine
      execution_discipline_score:   executionDisciplineScore,
      discipline_reason:            disciplineReason,
      close_window_score:           closeWindowScore,
      window_reason:                windowReason,
      deal_momentum_score:          dealMomentumScore,
      momentum_reason:              momentumReason,
      human_failure_flag:           humanFailureFlag,
      time_waste_flag:              timeWasteFlag,
      realistic_cpcv_forecast_flag: realisticCPCVForecastFlag,
      // Micro automation flags
      follow_up_needed:          followUpNeeded,
      deal_stalled:              dealStalled,
      cpcv_ready:                cpcvReady,
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
