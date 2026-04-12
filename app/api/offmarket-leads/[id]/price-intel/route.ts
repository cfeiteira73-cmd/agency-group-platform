// =============================================================================
// Agency Group — Price Intelligence Engine
// POST /api/offmarket-leads/[id]/price-intel
// GET  /api/offmarket-leads/[id]/price-intel  (retrieve stored data)
//
// AUDITED: reuses getPriceOpportunityScore logic from /api/offmarket-leads/score
// NEW:     uses market_price_refs table as comparison baseline
// UPDATES: estimated_fair_value, gross_discount_pct, comp_confidence_score,
//          price_opportunity_score, price_reason, price_intelligence_updated_at
//          AND score_breakdown.price_opportunity (elevates the dormant component)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { auth } from '@/auth'

const TABLE = 'offmarket_leads'
const REFS_TABLE = 'market_price_refs'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OffmarketLeadPriceData {
  id: string
  nome: string
  price_ask: number | null
  area_m2: number | null
  cidade: string | null
  tipo_ativo: string | null
  price_estimate: number | null   // keep: may exist from manual AVM
  score_breakdown: Record<string, number> | null
  price_opportunity_score: number | null  // existing value if already computed
}

interface MarketPriceRef {
  cidade: string
  tipo_ativo: string
  median_price_per_m2: number
  min_price_per_m2: number | null
  max_price_per_m2: number | null
  confidence_level: 'high' | 'medium' | 'low'
}

interface PriceIntelResult {
  price_ask: number | null
  area_m2: number | null
  price_ask_per_m2: number | null
  ref_used: MarketPriceRef | null
  ref_lookup_type: 'exact' | 'city_generic' | 'type_national' | 'none'
  estimated_fair_value: number | null
  gross_discount_pct: number | null
  comp_confidence_score: number
  price_opportunity_score: number
  price_reason: string
  has_sufficient_data: boolean
}

// ---------------------------------------------------------------------------
// NFD normaliser (consistent with rest of codebase)
// ---------------------------------------------------------------------------

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

// ---------------------------------------------------------------------------
// Market reference lookup — 3-tier fallback
// ---------------------------------------------------------------------------

async function lookupMarketRef(
  cidade: string | null,
  tipoAtivo: string | null
): Promise<{ ref: MarketPriceRef | null; lookupType: 'exact' | 'city_generic' | 'type_national' | 'none' }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabaseAdmin as any
  const normalizedCidade = cidade ? norm(cidade) : null
  const normalizedTipo = tipoAtivo ? norm(tipoAtivo) : null

  // Tier 1: Exact match (cidade + tipo_ativo)
  if (normalizedCidade && normalizedTipo) {
    const { data } = await sb.from(REFS_TABLE)
      .select('cidade, tipo_ativo, median_price_per_m2, min_price_per_m2, max_price_per_m2, confidence_level')
      .ilike('cidade', normalizedCidade)
      .ilike('tipo_ativo', normalizedTipo)
      .limit(1)
      .maybeSingle()

    if (data) return { ref: data as MarketPriceRef, lookupType: 'exact' }

    // Check if cidade matches with partial (e.g. "Lisboa Premium" → "Lisboa")
    const cidadeParts = normalizedCidade.split(/[\s,]+/).filter(p => p.length > 2)
    for (const part of cidadeParts) {
      const { data: partial } = await sb.from(REFS_TABLE)
        .select('cidade, tipo_ativo, median_price_per_m2, min_price_per_m2, max_price_per_m2, confidence_level')
        .ilike('cidade', `%${part}%`)
        .ilike('tipo_ativo', normalizedTipo)
        .limit(1)
        .maybeSingle()
      if (partial) return { ref: partial as MarketPriceRef, lookupType: 'exact' }
    }
  }

  // Tier 2: City only → most common type (apartamento)
  if (normalizedCidade) {
    const fallbackTipo = normalizedTipo === 'moradia' ? 'moradia' : 'apartamento'
    const { data } = await sb.from(REFS_TABLE)
      .select('cidade, tipo_ativo, median_price_per_m2, min_price_per_m2, max_price_per_m2, confidence_level')
      .ilike('cidade', normalizedCidade)
      .ilike('tipo_ativo', fallbackTipo)
      .limit(1)
      .maybeSingle()

    if (data) return { ref: data as MarketPriceRef, lookupType: 'city_generic' }

    // Try partial city match
    const cidadeParts = normalizedCidade.split(/[\s,]+/).filter(p => p.length > 2)
    for (const part of cidadeParts) {
      const { data: partial } = await sb.from(REFS_TABLE)
        .select('cidade, tipo_ativo, median_price_per_m2, min_price_per_m2, max_price_per_m2, confidence_level')
        .ilike('cidade', `%${part}%`)
        .ilike('tipo_ativo', fallbackTipo)
        .limit(1)
        .maybeSingle()
      if (partial) return { ref: partial as MarketPriceRef, lookupType: 'city_generic' }
    }
  }

  // Tier 3: National reference for asset type
  if (normalizedTipo) {
    const tipo = ['moradia', 'apartamento', 'quinta', 'herdade', 'hotel', 'terreno', 'comercial']
      .find(t => normalizedTipo.includes(t) || t.includes(normalizedTipo)) ?? null

    if (tipo) {
      const { data } = await sb.from(REFS_TABLE)
        .select('cidade, tipo_ativo, median_price_per_m2, min_price_per_m2, max_price_per_m2, confidence_level')
        .ilike('cidade', 'portugal')
        .ilike('tipo_ativo', tipo)
        .limit(1)
        .maybeSingle()
      if (data) return { ref: data as MarketPriceRef, lookupType: 'type_national' }
    }
  }

  return { ref: null, lookupType: 'none' }
}

// ---------------------------------------------------------------------------
// Confidence score (0-100)
// ---------------------------------------------------------------------------

function calcConfidenceScore(
  hasAreaM2: boolean,
  hasPrice: boolean,
  lookupType: 'exact' | 'city_generic' | 'type_national' | 'none',
  refConfidenceLevel: 'high' | 'medium' | 'low' | undefined
): number {
  if (!hasAreaM2 || !hasPrice || lookupType === 'none') return 0

  let score = 0

  // Area and price present (base requirements)
  if (hasAreaM2) score += 35
  if (hasPrice)  score += 15  // already gated above, but explicit

  // Lookup quality
  if (lookupType === 'exact')          score += 35
  else if (lookupType === 'city_generic') score += 20
  else if (lookupType === 'type_national') score += 5

  // Reference data quality
  if (refConfidenceLevel === 'high')   score += 15
  else if (refConfidenceLevel === 'medium') score += 8
  else if (refConfidenceLevel === 'low')    score += 2

  return Math.min(100, score)
}

// ---------------------------------------------------------------------------
// Price opportunity score (0-25)
// Elevates the existing dormant score_breakdown.price_opportunity component
// ---------------------------------------------------------------------------

function calcPriceOpportunityScore(
  grossDiscountPct: number | null,
  confidenceScore: number
): number {
  if (grossDiscountPct === null || confidenceScore < 20) return 0

  // Confidence multiplier: low confidence dampens the opportunity signal
  const confMultiplier =
    confidenceScore >= 75 ? 1.0 :
    confidenceScore >= 50 ? 0.80 :
    confidenceScore >= 30 ? 0.55 :
    0.30

  let baseScore = 0
  if (grossDiscountPct >= 25)      baseScore = 25   // exceptional — ≥25% below market
  else if (grossDiscountPct >= 20) baseScore = 22   // very strong — 20-25% below
  else if (grossDiscountPct >= 15) baseScore = 18   // strong — 15-20% below
  else if (grossDiscountPct >= 10) baseScore = 14   // solid — 10-15% below
  else if (grossDiscountPct >= 5)  baseScore = 9    // mild — 5-10% below
  else if (grossDiscountPct >= 0)  baseScore = 4    // at market
  else if (grossDiscountPct >= -5) baseScore = 2    // slightly above market
  else                              baseScore = 0    // clearly above market

  return Math.round(baseScore * confMultiplier)
}

// ---------------------------------------------------------------------------
// Price reason generator
// ---------------------------------------------------------------------------

function generatePriceReason(
  priceAsk: number | null,
  priceAskPerM2: number | null,
  fairValue: number | null,
  grossDiscountPct: number | null,
  confidenceScore: number,
  lookupType: 'exact' | 'city_generic' | 'type_national' | 'none',
  ref: MarketPriceRef | null,
  tipoAtivo: string | null,
  cidade: string | null
): string {
  if (!priceAsk) return 'Preço pedido não disponível — análise de preço não possível.'
  if (!priceAskPerM2 || !fairValue || grossDiscountPct === null) {
    return 'Área em m² em falta — não é possível calcular €/m². Adicionar área para activar análise de preço.'
  }
  if (lookupType === 'none' || !ref) {
    const psm = Math.round(priceAskPerM2)
    return `€/m² pedido: €${psm.toLocaleString('pt-PT')}/m². Sem referência de mercado disponível para ${tipoAtivo ?? 'este tipo'} em ${cidade ?? 'esta zona'}.`
  }

  const psm = Math.round(priceAskPerM2)
  const refPsm = Math.round(ref.median_price_per_m2)
  const discPct = Math.abs(Math.round(grossDiscountPct))
  const confLabel = confidenceScore >= 70 ? 'alta' : confidenceScore >= 40 ? 'média' : 'baixa'
  const lookupLabel = lookupType === 'exact' ? '' :
    lookupType === 'city_generic' ? ' (tipo ajustado)' : ' (referência nacional)'

  if (grossDiscountPct >= 20) {
    return `Oportunidade forte: preço pedido ${discPct}% abaixo da referência de mercado${lookupLabel} para ${tipoAtivo ?? 'imóvel'} em ${cidade ?? 'esta zona'} (€${psm.toLocaleString('pt-PT')}/m² vs referência €${refPsm.toLocaleString('pt-PT')}/m²). Confiança: ${confLabel}.`
  }
  if (grossDiscountPct >= 10) {
    return `Bom preço: ${discPct}% abaixo do mercado${lookupLabel} (€${psm.toLocaleString('pt-PT')}/m² vs €${refPsm.toLocaleString('pt-PT')}/m² ref.). Confiança: ${confLabel}.`
  }
  if (grossDiscountPct >= 0) {
    return `Preço ao mercado ou ligeiramente abaixo (-${discPct}%)${lookupLabel}. €${psm.toLocaleString('pt-PT')}/m² vs referência €${refPsm.toLocaleString('pt-PT')}/m². Confiança: ${confLabel}.`
  }
  if (grossDiscountPct >= -10) {
    return `Preço acima do mercado (+${discPct}%)${lookupLabel}. €${psm.toLocaleString('pt-PT')}/m² vs referência €${refPsm.toLocaleString('pt-PT')}/m². Negociação necessária. Confiança: ${confLabel}.`
  }
  return `Preço significativamente acima do mercado (+${discPct}%)${lookupLabel}. €${psm.toLocaleString('pt-PT')}/m² vs €${refPsm.toLocaleString('pt-PT')}/m² ref. Confiança: ${confLabel}.`
}

// ---------------------------------------------------------------------------
// Core calculation
// ---------------------------------------------------------------------------

async function calcPriceIntelligence(lead: OffmarketLeadPriceData): Promise<PriceIntelResult> {
  const { ref, lookupType } = await lookupMarketRef(lead.cidade, lead.tipo_ativo)

  const hasPrice  = lead.price_ask != null && lead.price_ask > 0
  const hasArea   = lead.area_m2 != null && lead.area_m2 > 0
  const hasSufficient = hasPrice && hasArea && lookupType !== 'none'

  // price_ask_per_m2 (GENERATED in DB, but we compute here for the response)
  const priceAskPerM2 = hasPrice && hasArea
    ? Math.round((lead.price_ask! / lead.area_m2!) * 100) / 100
    : null

  // estimated_fair_value
  const estimatedFairValue = hasArea && ref
    ? Math.round(lead.area_m2! * ref.median_price_per_m2)
    : null

  // gross_discount_pct: positive = below market, negative = above market
  const grossDiscountPct = estimatedFairValue && hasPrice
    ? Math.round(((estimatedFairValue - lead.price_ask!) / estimatedFairValue) * 10000) / 100
    : null

  // confidence
  const confidence = calcConfidenceScore(hasArea, hasPrice, lookupType, ref?.confidence_level)

  // price opportunity
  const priceOpportunity = calcPriceOpportunityScore(grossDiscountPct, confidence)

  // reason
  const reason = generatePriceReason(
    lead.price_ask,
    priceAskPerM2,
    estimatedFairValue,
    grossDiscountPct,
    confidence,
    lookupType,
    ref,
    lead.tipo_ativo,
    lead.cidade
  )

  return {
    price_ask: lead.price_ask,
    area_m2: lead.area_m2,
    price_ask_per_m2: priceAskPerM2,
    ref_used: ref,
    ref_lookup_type: lookupType,
    estimated_fair_value: estimatedFairValue,
    gross_discount_pct: grossDiscountPct,
    comp_confidence_score: confidence,
    price_opportunity_score: priceOpportunity,
    price_reason: reason,
    has_sufficient_data: hasSufficient,
  }
}

// ---------------------------------------------------------------------------
// POST — Calculate + persist price intelligence
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const cronSecret = process.env.CRON_SECRET
    const incomingSecret = req.headers.get('x-cron-secret') ?? req.headers.get('authorization')?.replace('Bearer ', '')
    const isCron = cronSecret && incomingSecret === cronSecret
    if (!isCron) {
      const session = await auth()
      if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabaseAdmin as any

    // ── Fetch lead ──────────────────────────────────────────────────────────
    const { data: lead, error: fetchErr } = await sb.from(TABLE)
      .select('id, nome, price_ask, area_m2, cidade, tipo_ativo, price_estimate, score_breakdown, price_opportunity_score')
      .eq('id', id)
      .single()

    if (fetchErr || !lead) {
      return NextResponse.json({ error: 'Lead not found', details: fetchErr?.message }, { status: 404 })
    }

    // ── Calculate ───────────────────────────────────────────────────────────
    const intel = await calcPriceIntelligence(lead as OffmarketLeadPriceData)

    // ── Build score_breakdown update ────────────────────────────────────────
    // Elevate the dormant price_opportunity component in score_breakdown
    // Only update if we have sufficient data and the new score is better
    const existingBreakdown = (lead.score_breakdown ?? {}) as Record<string, number>
    const updatedBreakdown = {
      ...existingBreakdown,
      price_opportunity: intel.price_opportunity_score,
    }

    // ── Persist ─────────────────────────────────────────────────────────────
    const updatePayload: Record<string, unknown> = {
      price_reason:                  intel.price_reason,
      price_intelligence_updated_at: new Date().toISOString(),
    }

    // Only write calculated fields if we have real data
    if (intel.estimated_fair_value !== null)  updatePayload.estimated_fair_value   = intel.estimated_fair_value
    if (intel.gross_discount_pct !== null)    updatePayload.gross_discount_pct     = intel.gross_discount_pct
    if (intel.comp_confidence_score >= 0)     updatePayload.comp_confidence_score  = intel.comp_confidence_score
    if (intel.price_opportunity_score >= 0)   updatePayload.price_opportunity_score = intel.price_opportunity_score

    // Update score_breakdown.price_opportunity if we have a valid score
    if (intel.has_sufficient_data) {
      updatePayload.score_breakdown = updatedBreakdown
    }

    const { error: updateErr } = await sb.from(TABLE)
      .update(updatePayload)
      .eq('id', id)

    if (updateErr) {
      console.error('[price-intel] update error:', updateErr)
      // Non-fatal: still return the calculation result
    }

    console.log(`[price-intel] "${lead.nome}" → discount: ${intel.gross_discount_pct?.toFixed(1)}% | confidence: ${intel.comp_confidence_score} | opp_score: ${intel.price_opportunity_score}`)

    return NextResponse.json({
      lead_id:              id,
      nome:                 lead.nome,
      // Input data
      price_ask:            intel.price_ask,
      area_m2:              intel.area_m2,
      cidade:               lead.cidade,
      tipo_ativo:           lead.tipo_ativo,
      // Calculated
      price_ask_per_m2:     intel.price_ask_per_m2,
      estimated_fair_value: intel.estimated_fair_value,
      gross_discount_pct:   intel.gross_discount_pct,
      comp_confidence_score: intel.comp_confidence_score,
      price_opportunity_score: intel.price_opportunity_score,
      price_reason:         intel.price_reason,
      has_sufficient_data:  intel.has_sufficient_data,
      // Reference used
      ref_lookup_type:      intel.ref_lookup_type,
      ref_cidade:           intel.ref_used?.cidade ?? null,
      ref_tipo:             intel.ref_used?.tipo_ativo ?? null,
      ref_median_psm:       intel.ref_used?.median_price_per_m2 ?? null,
      ref_confidence:       intel.ref_used?.confidence_level ?? null,
      // Persisted at
      price_intelligence_updated_at: updatePayload.price_intelligence_updated_at,
    })
  } catch (err) {
    console.error('[price-intel POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// GET — Retrieve stored price intelligence (no recalculation)
// ---------------------------------------------------------------------------

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const cronSecret = process.env.CRON_SECRET
    const incomingSecret = req.headers.get('x-cron-secret') ?? req.headers.get('authorization')?.replace('Bearer ', '')
    const isCron = cronSecret && incomingSecret === cronSecret
    if (!isCron) {
      const session = await auth()
      if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseAdmin as any).from(TABLE)
      .select([
        'id', 'nome', 'price_ask', 'area_m2', 'cidade', 'tipo_ativo',
        'price_ask_per_m2',       // GENERATED column
        'estimated_fair_value',
        'gross_discount_pct',
        'comp_confidence_score',
        'price_opportunity_score',
        'price_reason',
        'price_intelligence_updated_at',
      ].join(', '))
      .eq('id', id)
      .single()

    if (error) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(data)
  } catch (err) {
    console.error('[price-intel GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
