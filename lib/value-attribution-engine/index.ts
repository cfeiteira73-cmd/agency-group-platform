// AGENCY GROUP — SH-ROS | AMI: 22506
// Value Attribution Engine — Predictive real-time € impact per agent/system action
// The existing system does retrospective attribution; this computes PREDICTIVE impact.
// Pure TypeScript — no DB writes, no external dependencies. Caller handles persistence.
// =============================================================================

import { randomUUID } from 'crypto'

// ─── Action Types ─────────────────────────────────────────────────────────────

export type ActionType =
  | 'price_reduction'
  | 'photo_upgrade'
  | 'homepage_boost'
  | 'campaign_send'
  | 'inquiry_response'
  | 'visit_booking'
  | 'offer_submission'
  | 'negotiation_move'
  | 'listing_refresh'
  | 'deal_pack_send'
  | 'follow_up_call'

// ─── Revenue Impact Card ──────────────────────────────────────────────────────

export interface RevenueImpactCard {
  action_id: string
  action_type: ActionType
  property_id: string
  /** Expected revenue impact in EUR — E[commission × probability] */
  expected_value_eur: number
  /** Confidence in the impact estimate (0–1) */
  confidence: number
  /** How much this action causally drives the outcome (0–1) */
  causal_strength: number
  /** Percentage improvement in conversion probability */
  conversion_lift_pct: number
  /** Negative = faster close */
  time_to_close_delta_days: number
  /** Absolute change in close probability */
  probability_shift: number
  /** Incremental € if action taken vs not taken */
  revenue_marginal_gain: number
  urgency: 'critical' | 'high' | 'medium' | 'low'
  /** When this action opportunity expires */
  expires_at: Date
  /** Plain Portuguese business language explanation */
  reasoning: string
}

// ─── Action Impact Models (Portugal 2026 market benchmarks) ──────────────────

interface ActionModel {
  conversion_lift_pct: number
  time_to_close_delta_days: number
  causal_strength: number
  confidence: number
  urgency: RevenueImpactCard['urgency']
  /** Time in hours until the opportunity expires */
  expires_in_hours: number
  reasoning_pt: (
    actionType: ActionType,
    propertyValueEur: number,
    marginalGain: number,
    timeDelta: number,
  ) => string
}

const ACTION_MODELS: Record<ActionType, ActionModel> = {
  price_reduction: {
    conversion_lift_pct: 35,
    time_to_close_delta_days: -45,
    causal_strength: 0.82,
    confidence: 0.78,
    urgency: 'high',
    expires_in_hours: 72,
    reasoning_pt: (_a, pv, mg, td) =>
      `Uma redução de preço de 5–8% (imóvel ~€${fmt(pv)}) aumenta a conversão em 35% e acelera o fecho em ${Math.abs(td)} dias. ` +
      `Impacto marginal estimado: +€${fmt(mg)} de comissão incremental. Mercado Portugal 2026 recompensa rapidez de ajuste.`,
  },
  photo_upgrade: {
    conversion_lift_pct: 18,
    time_to_close_delta_days: -20,
    causal_strength: 0.55,
    confidence: 0.70,
    urgency: 'medium',
    expires_in_hours: 168, // 7 days
    reasoning_pt: (_a, pv, mg, td) =>
      `Fotografia profissional para imóvel ~€${fmt(pv)} aumenta a taxa de conversão em 18% e reduz o tempo de venda em ${Math.abs(td)} dias. ` +
      `Ganho marginal estimado: +€${fmt(mg)}. Primeira impressão digital define 70% das visitas marcadas.`,
  },
  homepage_boost: {
    conversion_lift_pct: 12,
    time_to_close_delta_days: -15,
    causal_strength: 0.48,
    confidence: 0.62,
    urgency: 'medium',
    expires_in_hours: 120, // 5 days
    reasoning_pt: (_a, pv, mg, td) =>
      `Destaque na homepage para imóvel ~€${fmt(pv)} gera +12% de conversão e -${Math.abs(td)} dias até ao fecho. ` +
      `Ganho marginal: +€${fmt(mg)}. Exposição premium ao tráfego qualificado da agencygroup.pt.`,
  },
  campaign_send: {
    conversion_lift_pct: 8,
    time_to_close_delta_days: -10,
    causal_strength: 0.35,
    confidence: 0.58,
    urgency: 'medium',
    expires_in_hours: 48,
    reasoning_pt: (_a, pv, mg, td) =>
      `Campanha de email/SMS para base de compradores qualificados (~€${fmt(pv)}) prevê +8% de conversão e -${Math.abs(td)} dias. ` +
      `Impacto marginal: +€${fmt(mg)}. Segmentação por perfil de comprador maximiza ROI.`,
  },
  inquiry_response: {
    conversion_lift_pct: 40,
    time_to_close_delta_days: -30,
    causal_strength: 0.88,
    confidence: 0.85,
    urgency: 'critical',
    expires_in_hours: 2,
    reasoning_pt: (_a, pv, mg, td) =>
      `URGENTE — Resposta em <2h a inquérito sobre imóvel ~€${fmt(pv)}: +40% de conversão, -${Math.abs(td)} dias até fecho. ` +
      `Ganho marginal: +€${fmt(mg)}. Após 2h, probabilidade de conversão cai 60%. Ação imediata obrigatória.`,
  },
  visit_booking: {
    conversion_lift_pct: 55,
    time_to_close_delta_days: -40,
    causal_strength: 0.90,
    confidence: 0.82,
    urgency: 'high',
    expires_in_hours: 24,
    reasoning_pt: (_a, pv, mg, td) =>
      `Marcação de visita ao imóvel ~€${fmt(pv)}: maior alavanca individual com +55% de conversão e -${Math.abs(td)} dias. ` +
      `Ganho marginal: +€${fmt(mg)}. Visitas são o principal preditor de oferta no mercado português.`,
  },
  offer_submission: {
    conversion_lift_pct: 68,
    time_to_close_delta_days: -20,
    causal_strength: 0.92,
    confidence: 0.88,
    urgency: 'critical',
    expires_in_hours: 12,
    reasoning_pt: (_a, pv, mg, td) =>
      `Submissão de proposta para imóvel ~€${fmt(pv)}: +68% de conversão e -${Math.abs(td)} dias. ` +
      `Ganho marginal: +€${fmt(mg)}. Proposta formal activa o processo de negociação — cada hora de delay reduz leverage.`,
  },
  negotiation_move: {
    conversion_lift_pct: 25,
    time_to_close_delta_days: -15,
    causal_strength: 0.75,
    confidence: 0.72,
    urgency: 'high',
    expires_in_hours: 24,
    reasoning_pt: (_a, pv, mg, td) =>
      `Movimento de negociação em imóvel ~€${fmt(pv)}: +25% de conversão e -${Math.abs(td)} dias até escritura. ` +
      `Ganho marginal: +€${fmt(mg)}. Resposta rápida em negociação sinaliza comprometimento e reduz risco de desistência.`,
  },
  listing_refresh: {
    conversion_lift_pct: 6,
    time_to_close_delta_days: -8,
    causal_strength: 0.30,
    confidence: 0.55,
    urgency: 'low',
    expires_in_hours: 240, // 10 days
    reasoning_pt: (_a, pv, mg, td) =>
      `Actualização do anúncio (~€${fmt(pv)}): pequena melhoria de +6% na conversão e -${Math.abs(td)} dias. ` +
      `Ganho marginal: +€${fmt(mg)}. Anúncios recentes têm melhor posicionamento nos portais imobiliários.`,
  },
  deal_pack_send: {
    conversion_lift_pct: 20,
    time_to_close_delta_days: -25,
    causal_strength: 0.62,
    confidence: 0.68,
    urgency: 'high',
    expires_in_hours: 48,
    reasoning_pt: (_a, pv, mg, td) =>
      `Envio de deal pack completo para imóvel ~€${fmt(pv)}: +20% de conversão e -${Math.abs(td)} dias. ` +
      `Ganho marginal: +€${fmt(mg)}. Documentação prévia (certidão, caderneta, planta) elimina fricção na decisão de compra.`,
  },
  follow_up_call: {
    conversion_lift_pct: 15,
    time_to_close_delta_days: -12,
    causal_strength: 0.52,
    confidence: 0.65,
    urgency: 'medium',
    expires_in_hours: 36,
    reasoning_pt: (_a, pv, mg, td) =>
      `Chamada de follow-up a lead do imóvel ~€${fmt(pv)}: +15% de conversão e -${Math.abs(td)} dias. ` +
      `Ganho marginal: +€${fmt(mg)}. Contacto humano directo resolve objecções e mantém engagement no funil.`,
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Format number as integer with thousands separator */
function fmt(n: number): string {
  return Math.round(n).toLocaleString('pt-PT')
}

// ─── Core Computation ─────────────────────────────────────────────────────────

/**
 * Compute a RevenueImpactCard for a given action type.
 *
 * @param actionType              - The agent/system action being evaluated
 * @param propertyValueEur        - Market value of the property
 * @param currentCloseProbability - Current probability to close (0–1)
 * @param commissionRate          - Default 0.05 (5%) per AGENCY GROUP standard
 * @param propertyId              - Optional property identifier
 */
export function computeImpactCard(
  actionType: ActionType,
  propertyValueEur: number,
  currentCloseProbability: number,
  commissionRate: number = 0.05,
  propertyId: string = '',
): RevenueImpactCard {
  const model = ACTION_MODELS[actionType]

  // Probability shift: conversion_lift_pct applied to current close probability
  // Capped at 1.0 so probability never exceeds 100%
  const probability_shift = Math.min(
    1 - currentCloseProbability,
    currentCloseProbability * (model.conversion_lift_pct / 100),
  )

  const new_probability = currentCloseProbability + probability_shift

  // Expected value: commission on the new expected close value
  const expected_value_eur =
    propertyValueEur * commissionRate * new_probability

  // Marginal gain: incremental commission from probability lift × causal strength
  const revenue_marginal_gain =
    propertyValueEur *
    commissionRate *
    (model.conversion_lift_pct / 100) *
    model.causal_strength

  const expires_at = new Date(
    Date.now() + model.expires_in_hours * 3_600_000,
  )

  const reasoning = model.reasoning_pt(
    actionType,
    propertyValueEur,
    revenue_marginal_gain,
    model.time_to_close_delta_days,
  )

  return {
    action_id: randomUUID(),
    action_type: actionType,
    property_id: propertyId,
    expected_value_eur: Math.round(expected_value_eur * 100) / 100,
    confidence: model.confidence,
    causal_strength: model.causal_strength,
    conversion_lift_pct: model.conversion_lift_pct,
    time_to_close_delta_days: model.time_to_close_delta_days,
    probability_shift: Math.round(probability_shift * 10000) / 10000,
    revenue_marginal_gain: Math.round(revenue_marginal_gain * 100) / 100,
    urgency: model.urgency,
    expires_at,
    reasoning,
  }
}

// ─── Ranking ──────────────────────────────────────────────────────────────────

/**
 * Sort RevenueImpactCards by expected_value_eur descending.
 * Critical urgency items are always floated to the top within their value band.
 */
export function rankActionsByImpact(
  cards: RevenueImpactCard[],
): RevenueImpactCard[] {
  return [...cards].sort((a, b) => {
    // Critical items always above non-critical
    if (a.urgency === 'critical' && b.urgency !== 'critical') return -1
    if (b.urgency === 'critical' && a.urgency !== 'critical') return 1
    // Then by expected value descending
    return b.expected_value_eur - a.expected_value_eur
  })
}

// ─── Top Action ───────────────────────────────────────────────────────────────

/**
 * Compute impact cards for all available actions and return the single
 * highest-value action. Returns null if availableActions is empty.
 */
export function getTopAction(
  propertyValueEur: number,
  closeProbability: number,
  availableActions: ActionType[],
  commissionRate: number = 0.05,
  propertyId: string = '',
): RevenueImpactCard | null {
  if (availableActions.length === 0) return null

  const cards = availableActions.map((a) =>
    computeImpactCard(a, propertyValueEur, closeProbability, commissionRate, propertyId),
  )

  const ranked = rankActionsByImpact(cards)
  return ranked[0] ?? null
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const valueAttributionEngine = {
  computeImpactCard,
  rankActionsByImpact,
  getTopAction,
} as const
