// AGENCY GROUP — SH-ROS | AMI: 22506
// lib/buyer-to-conversion/index.ts
// Predicts conversion funnel probabilities and commission value from a BuyerIntentProfile.
// PURE: no IO, no DB calls.
// =============================================================================

import type { BuyerIntentProfile, BuyerIntent, UrgencyLevel } from '@/lib/buyer-intelligence/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConversionFunnelPrediction {
  session_id: string
  profile_intent: BuyerIntent
  urgency: UrgencyLevel

  // Stage probabilities (0–1)
  p_inquiry: number         // probability they submit an inquiry
  p_visit: number           // probability they schedule a visit
  p_offer: number           // probability they make an offer
  p_close: number           // probability of deal close

  // Economic
  estimated_budget_eur: number
  estimated_commission_eur: number  // at 5%
  expected_value_eur: number        // p_close × commission

  // Recommended agent action
  next_best_action:
    | 'send_curated_listing'
    | 'schedule_call'
    | 'send_deal_pack'
    | 'urgent_callback'
    | 'nurture_sequence'
    | 'none'
  action_rationale: string  // plain Portuguese

  // Meta
  confidence: number  // 0–1
  computed_at: Date
}

// ---------------------------------------------------------------------------
// Base conversion probabilities — Portugal 2026 luxury market
// ---------------------------------------------------------------------------

interface BaseProbabilities {
  p_inquiry: number
  p_visit: number
  p_offer: number
  p_close: number
}

const BASE_PROBS: Record<BuyerIntent, BaseProbabilities> = {
  investor:      { p_inquiry: 0.28, p_visit: 0.18, p_offer: 0.12, p_close: 0.08 },
  luxury_buyer:  { p_inquiry: 0.22, p_visit: 0.15, p_offer: 0.10, p_close: 0.06 },
  family:        { p_inquiry: 0.35, p_visit: 0.25, p_offer: 0.16, p_close: 0.10 },
  relocating:    { p_inquiry: 0.40, p_visit: 0.30, p_offer: 0.20, p_close: 0.14 },
  retirement:    { p_inquiry: 0.25, p_visit: 0.18, p_offer: 0.12, p_close: 0.07 },
  international: { p_inquiry: 0.20, p_visit: 0.12, p_offer: 0.08, p_close: 0.05 },
  rental_yield:  { p_inquiry: 0.30, p_visit: 0.20, p_offer: 0.13, p_close: 0.09 },
  unknown:       { p_inquiry: 0.10, p_visit: 0.06, p_offer: 0.04, p_close: 0.02 },
}

// ---------------------------------------------------------------------------
// Urgency multipliers
// ---------------------------------------------------------------------------

const URGENCY_MULTIPLIERS: Record<UrgencyLevel, number> = {
  hot:      2.5,
  warm:     1.5,
  browsing: 1.0,
  unknown:  0.7,
}

// ---------------------------------------------------------------------------
// Budget defaults by intent (EUR)
// ---------------------------------------------------------------------------

const BUDGET_DEFAULTS: Record<BuyerIntent, number> = {
  investor:      800_000,
  luxury_buyer:  1_500_000,
  family:        600_000,
  relocating:    500_000,
  retirement:    700_000,
  international: 1_200_000,
  rental_yield:  400_000,
  unknown:       500_000,
}

// ---------------------------------------------------------------------------
// Action rationale strings — Portuguese
// ---------------------------------------------------------------------------

const ACTION_RATIONALE: Record<ConversionFunnelPrediction['next_best_action'], string> = {
  urgent_callback:       'Lead com alta urgência — contacto imediato pode converter numa proposta esta semana.',
  send_deal_pack:        'Perfil quente mas ainda em fase de avaliação — envio de deal pack acelera a decisão.',
  send_curated_listing:  'Interesse sólido identificado — listagem curada alinhada ao perfil aumenta a probabilidade de visita.',
  schedule_call:         'Lead morno com bom potencial — chamada de qualificação ajuda a afinar necessidades e avançar no funil.',
  nurture_sequence:      'Comprador em fase de pesquisa — sequência de nurturing mantém o contacto e educa até estar pronto.',
  none:                  'Perfil com sinal fraco — monitorizar sem acção directa por agora.',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function applyUrgencyMultiplier(base: BaseProbabilities, urgency: UrgencyLevel): BaseProbabilities {
  const m = URGENCY_MULTIPLIERS[urgency]
  return {
    p_inquiry: clamp(base.p_inquiry * m, 0, 1),
    p_visit:   clamp(base.p_visit   * m, 0, 1),
    p_offer:   clamp(base.p_offer   * m, 0, 1),
    p_close:   clamp(base.p_close   * m, 0, 1),
  }
}

// ---------------------------------------------------------------------------
// Public: estimateBudget
// ---------------------------------------------------------------------------

export function estimateBudget(profile: BuyerIntentProfile): number {
  if (profile.budget_max_estimate && profile.budget_max_estimate > 0) {
    return profile.budget_max_estimate
  }
  return BUDGET_DEFAULTS[profile.primary_intent]
}

// ---------------------------------------------------------------------------
// Public: getNextBestAction
// ---------------------------------------------------------------------------

export function getNextBestAction(
  profile: BuyerIntentProfile,
): ConversionFunnelPrediction['next_best_action'] {
  const base = BASE_PROBS[profile.primary_intent]
  const probs = applyUrgencyMultiplier(base, profile.urgency)
  const { urgency, primary_intent } = profile

  if (urgency === 'hot' && probs.p_close > 0.15) return 'urgent_callback'
  if (urgency === 'hot')                           return 'send_deal_pack'
  if (urgency === 'warm' && probs.p_inquiry > 0.25) return 'send_curated_listing'
  if (urgency === 'warm')                           return 'schedule_call'
  if (primary_intent === 'investor' || primary_intent === 'rental_yield') return 'send_curated_listing'
  if (urgency === 'browsing')                       return 'nurture_sequence'
  return 'none'
}

// ---------------------------------------------------------------------------
// Public: predictConversionFunnel
// ---------------------------------------------------------------------------

export function predictConversionFunnel(profile: BuyerIntentProfile): ConversionFunnelPrediction {
  const base = BASE_PROBS[profile.primary_intent]
  const probs = applyUrgencyMultiplier(base, profile.urgency)

  const estimated_budget_eur = estimateBudget(profile)
  const estimated_commission_eur = Math.round(estimated_budget_eur * 0.05)
  const expected_value_eur = Math.round(probs.p_close * estimated_commission_eur)

  const next_best_action = getNextBestAction(profile)
  const action_rationale = ACTION_RATIONALE[next_best_action]

  // Normalise profile confidence from 0–100 to 0–1
  const confidence = clamp(profile.confidence / 100, 0, 1)

  return {
    session_id:              profile.session_id,
    profile_intent:          profile.primary_intent,
    urgency:                 profile.urgency,
    p_inquiry:               probs.p_inquiry,
    p_visit:                 probs.p_visit,
    p_offer:                 probs.p_offer,
    p_close:                 probs.p_close,
    estimated_budget_eur,
    estimated_commission_eur,
    expected_value_eur,
    next_best_action,
    action_rationale,
    confidence,
    computed_at:             new Date(),
  }
}

// ---------------------------------------------------------------------------
// Namespace export
// ---------------------------------------------------------------------------

export const buyerToConversion = {
  predictConversionFunnel,
  getNextBestAction,
  estimateBudget,
} as const
