// AGENCY GROUP — SH-ROS | AMI: 22506

import { randomUUID } from 'crypto'
import { COMMISSION_RATE } from '@/lib/constants/pipeline'

export type SimulableAction =
  | 'adjust_price'
  | 'boost_homepage'
  | 'trigger_campaign'
  | 'outreach_contact'
  | 'flag_listing'
  | 'generate_deal_pack'

export interface ActionSimulationInput {
  action: SimulableAction
  property_id: string
  property_value_eur: number
  current_close_probability: number
  days_on_market: number
  demand_score: number
  params: Record<string, unknown>
}

export interface ActionSimulationResult {
  simulation_id: string
  action: SimulableAction
  property_id: string

  before: {
    close_probability: number
    estimated_days_to_close: number
    expected_commission_eur: number
  }

  after: {
    close_probability: number
    estimated_days_to_close: number
    expected_commission_eur: number
  }

  delta: {
    probability_gain: number
    days_saved: number
    commission_gain_eur: number
    roi_multiple: number
  }

  safety_level: 'safe' | 'review_required' | 'human_approval_required'
  reversible: boolean
  confidence: number

  recommendation: string
  should_execute: boolean
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface ActionModel {
  probability_gain: number
  days_saved: number
  safety_level: 'safe' | 'review_required' | 'human_approval_required'
  reversible: boolean
  confidence: number
}

function resolveActionModel(
  action: SimulableAction,
  params: Record<string, unknown>,
): ActionModel {
  switch (action) {
    case 'adjust_price': {
      const pct = typeof params['price_reduction_pct'] === 'number'
        ? (params['price_reduction_pct'] as number)
        : 5
      if (pct >= 10) {
        return {
          probability_gain: 0.28,
          days_saved: 60,
          safety_level: 'human_approval_required',
          reversible: true,
          confidence: 0.78,
        }
      }
      return {
        probability_gain: 0.18,
        days_saved: 45,
        safety_level: 'review_required',
        reversible: true,
        confidence: 0.82,
      }
    }
    case 'boost_homepage':
      return {
        probability_gain: 0.08,
        days_saved: 15,
        safety_level: 'safe',
        reversible: true,
        confidence: 0.88,
      }
    case 'trigger_campaign':
      return {
        probability_gain: 0.06,
        days_saved: 10,
        safety_level: 'safe',
        reversible: false,
        confidence: 0.75,
      }
    case 'outreach_contact':
      return {
        probability_gain: 0.20,
        days_saved: 30,
        safety_level: 'safe',
        reversible: false,
        confidence: 0.80,
      }
    case 'flag_listing':
      return {
        probability_gain: 0,
        days_saved: 0,
        safety_level: 'safe',
        reversible: true,
        confidence: 0.99,
      }
    case 'generate_deal_pack':
      return {
        probability_gain: 0.12,
        days_saved: 20,
        safety_level: 'safe',
        reversible: false,
        confidence: 0.85,
      }
  }
}

const BASE_DAYS_TO_CLOSE = 210 // Portugal 2026 median

function estimatedDaysToClose(closeProbability: number): number {
  // Higher probability → fewer days remaining
  const clampedP = Math.max(0.01, Math.min(0.99, closeProbability))
  return Math.round(BASE_DAYS_TO_CLOSE * (1 - clampedP * 0.7))
}

function expectedCommission(
  propertyValueEur: number,
  closeProbability: number,
): number {
  return propertyValueEur * COMMISSION_RATE * closeProbability
}

function buildRecommendation(
  action: SimulableAction,
  params: Record<string, unknown>,
  delta: ActionSimulationResult['delta'],
  before: ActionSimulationResult['before'],
  after: ActionSimulationResult['after'],
): string {
  const commissionGain = delta.commission_gain_eur.toLocaleString('pt-PT', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
  const daysSaved = delta.days_saved

  switch (action) {
    case 'adjust_price': {
      const pct = typeof params['price_reduction_pct'] === 'number'
        ? params['price_reduction_pct']
        : 5
      return `Reduzir o preço em ${pct}% pode poupar ${daysSaved} dias no mercado e gerar €${commissionGain} adicional de comissão (probabilidade de fecho: ${Math.round(before.close_probability * 100)}% → ${Math.round(after.close_probability * 100)}%).`
    }
    case 'boost_homepage':
      return `Destacar o imóvel na homepage pode acelerar o fecho em ${daysSaved} dias e gerar €${commissionGain} adicional de comissão.`
    case 'trigger_campaign':
      return `Activar campanha de marketing pode reduzir o tempo de venda em ${daysSaved} dias e gerar €${commissionGain} adicional de comissão.`
    case 'outreach_contact':
      return `Contacto proactivo com lead pode encurtar o ciclo de venda em ${daysSaved} dias e gerar €${commissionGain} adicional de comissão.`
    case 'flag_listing':
      return `Sinalizar a listagem como underperforming para revisão interna. Nenhum impacto directo de comissão esperado.`
    case 'generate_deal_pack':
      return `Gerar deal pack profissional pode reduzir o tempo de decisão em ${daysSaved} dias e gerar €${commissionGain} adicional de comissão.`
  }
}

// ---------------------------------------------------------------------------
// Core exports
// ---------------------------------------------------------------------------

export function simulateAction(
  input: ActionSimulationInput,
): ActionSimulationResult {
  const model = resolveActionModel(input.action, input.params)

  const beforeProbability = Math.max(0, Math.min(1, input.current_close_probability))
  const afterProbability = Math.max(0, Math.min(1, beforeProbability + model.probability_gain))

  const beforeDays = estimatedDaysToClose(beforeProbability)
  const afterDays = Math.max(1, beforeDays - model.days_saved)

  const beforeCommission = expectedCommission(input.property_value_eur, beforeProbability)
  const afterCommission = expectedCommission(input.property_value_eur, afterProbability)

  const commissionGain = afterCommission - beforeCommission

  const actionCostEur =
    typeof input.params['action_cost_eur'] === 'number'
      ? (input.params['action_cost_eur'] as number)
      : 0

  const roiMultiple =
    actionCostEur > 0
      ? commissionGain / actionCostEur
      : commissionGain > 0
        ? Infinity
        : 0

  const before = {
    close_probability: beforeProbability,
    estimated_days_to_close: beforeDays,
    expected_commission_eur: Math.round(beforeCommission),
  }

  const after = {
    close_probability: afterProbability,
    estimated_days_to_close: afterDays,
    expected_commission_eur: Math.round(afterCommission),
  }

  const delta = {
    probability_gain: Math.round((afterProbability - beforeProbability) * 1000) / 1000,
    days_saved: beforeDays - afterDays,
    commission_gain_eur: Math.round(commissionGain),
    roi_multiple: isFinite(roiMultiple) ? Math.round(roiMultiple * 100) / 100 : 0,
  }

  const should_execute =
    delta.commission_gain_eur > 1000 && model.safety_level === 'safe'

  return {
    simulation_id: randomUUID(),
    action: input.action,
    property_id: input.property_id,
    before,
    after,
    delta,
    safety_level: model.safety_level,
    reversible: model.reversible,
    confidence: model.confidence,
    recommendation: buildRecommendation(input.action, input.params, delta, before, after),
    should_execute,
  }
}

export function simulateActionBatch(
  inputs: ActionSimulationInput[],
): ActionSimulationResult[] {
  return inputs.map(simulateAction)
}

const ALL_ACTIONS: SimulableAction[] = [
  'adjust_price',
  'boost_homepage',
  'trigger_campaign',
  'outreach_contact',
  'flag_listing',
  'generate_deal_pack',
]

export function getRecommendedActions(
  propertyValueEur: number,
  closeProbability: number,
  daysOnMarket: number,
  demandScore: number,
): ActionSimulationResult[] {
  const inputs: ActionSimulationInput[] = ALL_ACTIONS.map((action) => ({
    action,
    property_id: 'auto',
    property_value_eur: propertyValueEur,
    current_close_probability: closeProbability,
    days_on_market: daysOnMarket,
    demand_score: demandScore,
    params:
      action === 'adjust_price'
        ? { price_reduction_pct: daysOnMarket > 180 ? 10 : 5 }
        : {},
  }))

  return simulateActionBatch(inputs)
    .filter((r) => r.should_execute)
    .sort((a, b) => b.delta.commission_gain_eur - a.delta.commission_gain_eur)
}

export const agentAutonomyV2 = {
  simulateAction,
  simulateActionBatch,
  getRecommendedActions,
}
