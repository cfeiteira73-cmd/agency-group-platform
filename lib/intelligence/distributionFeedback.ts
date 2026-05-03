// =============================================================================
// Agency Group — Distribution Feedback & Reinforcement Engine
// lib/intelligence/distributionFeedback.ts
//
// Phase 5: Distribution / Market Feedback Reinforcement
//
// Closes the learning loop from real distribution outcomes:
//   - Acceptance rates → reweight recipient scoring
//   - Response speed → adjust routing priority
//   - Conversion → strengthen positive weights
//   - Fatigue signals → decay weights proactively
//
// REINFORCEMENT LOGIC:
//   positive outcomes → multiply weight by (1 + reward_rate)
//   negative outcomes → multiply weight by (1 - penalty_rate)
//   weights clamped to [0.1, 2.0] to prevent extremes
//
// PURE FUNCTIONS:
//   computeAcceptanceWeight, computeFatigueRisk, computeResponseWeight,
//   buildFeedbackWeightAdjustment, applyWeightReinforcement,
//   classifyDistributionOutcome, computeNetworkFeedbackScore
//
// DB FUNCTIONS:
//   persistFeedbackWeights, getFeedbackWeightsForRecipient
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DistributionOutcomeSummary {
  recipient_email:      string
  total_sent:           number
  total_accepted:       number     // replied positively / opened + engaged
  total_converted:      number     // became a deal
  total_rejected:       number
  avg_response_hours:   number | null
  distributions_7d:     number
  distributions_30d:    number
  is_fatigued:          boolean
}

export type OutcomeClass = 'excellent' | 'good' | 'neutral' | 'poor' | 'negative'

export interface WeightAdjustment {
  recipient_email:      string
  dimension:            'acceptance' | 'conversion' | 'speed' | 'fatigue'
  current_weight:       number     // 0.1-2.0
  new_weight:           number
  direction:            'strengthen' | 'decay' | 'neutral'
  reason:               string
}

export interface FeedbackReinforcement {
  recipient_email:      string
  adjustments:          WeightAdjustment[]
  composite_weight:     number      // geometric mean of all adjustments
  outcome_class:        OutcomeClass
  recommended_action:   'prioritize' | 'maintain' | 'reduce' | 'suppress'
}

// ---------------------------------------------------------------------------
// PURE: Compute acceptance weight (0.1-2.0)
// acceptance_rate = accepted / total_sent
// ---------------------------------------------------------------------------

export function computeAcceptanceWeight(
  totalSent: number,
  accepted:  number,
): number {
  if (totalSent === 0) return 1.0          // no data → neutral
  const rate = accepted / totalSent
  if (rate >= 0.5) return 2.0
  if (rate >= 0.3) return 1.6
  if (rate >= 0.2) return 1.3
  if (rate >= 0.1) return 1.0
  if (rate >= 0.05) return 0.7
  return 0.4
}

// ---------------------------------------------------------------------------
// PURE: Compute conversion weight (0.1-2.0)
// conversion_rate = converted / accepted
// ---------------------------------------------------------------------------

export function computeConversionWeight(
  accepted:  number,
  converted: number,
): number {
  if (accepted === 0) return 1.0
  const rate = converted / accepted
  if (rate >= 0.4) return 2.0
  if (rate >= 0.25) return 1.7
  if (rate >= 0.15) return 1.4
  if (rate >= 0.08) return 1.1
  if (rate >= 0.03) return 0.8
  return 0.5
}

// ---------------------------------------------------------------------------
// PURE: Compute response speed weight (0.1-2.0)
// Fast responders get boosted; slow ones are down-weighted
// ---------------------------------------------------------------------------

export function computeResponseWeight(
  avgResponseHours: number | null,
): number {
  if (avgResponseHours == null) return 1.0      // unknown → neutral
  if (avgResponseHours <= 2)   return 1.8
  if (avgResponseHours <= 6)   return 1.5
  if (avgResponseHours <= 12)  return 1.2
  if (avgResponseHours <= 24)  return 1.0
  if (avgResponseHours <= 48)  return 0.8
  if (avgResponseHours <= 96)  return 0.5
  return 0.3
}

// ---------------------------------------------------------------------------
// PURE: Compute fatigue risk score (0-100)
// Higher = more fatigue risk
// ---------------------------------------------------------------------------

export function computeFatigueRisk(
  distributions7d:  number,
  avgResponseRate:  number,    // 0-1
): number {
  let risk = 0
  if (distributions7d >= 5) risk += 40
  else if (distributions7d >= 3) risk += 25
  else if (distributions7d >= 2) risk += 10
  // Low response rate amplifies fatigue signal
  if (avgResponseRate < 0.05) risk += 30
  else if (avgResponseRate < 0.1) risk += 15
  return Math.min(100, risk)
}

// ---------------------------------------------------------------------------
// PURE: Classify distribution outcome from summary
// ---------------------------------------------------------------------------

export function classifyDistributionOutcome(
  summary: DistributionOutcomeSummary,
): OutcomeClass {
  if (summary.is_fatigued) return 'negative'
  const convRate = summary.total_accepted > 0
    ? summary.total_converted / summary.total_accepted
    : 0
  const acceptRate = summary.total_sent > 0
    ? summary.total_accepted / summary.total_sent
    : 0

  if (convRate >= 0.3 && acceptRate >= 0.3) return 'excellent'
  if (convRate >= 0.1 && acceptRate >= 0.15) return 'good'
  if (acceptRate < 0.05 && summary.total_sent >= 5) return 'poor'
  if (convRate === 0 && summary.total_sent >= 10) return 'negative'
  return 'neutral'
}

// ---------------------------------------------------------------------------
// PURE: Apply reinforcement to a weight given an outcome class
// ---------------------------------------------------------------------------

export function applyWeightReinforcement(
  currentWeight:   number,
  outcomeClass:    OutcomeClass,
  config: { reward_rate?: number; penalty_rate?: number } = {},
): number {
  const reward  = config.reward_rate  ?? 0.1    // +10% for positive
  const penalty = config.penalty_rate ?? 0.15   // -15% for negative

  let newWeight = currentWeight
  if (outcomeClass === 'excellent') newWeight *= (1 + reward * 1.5)
  else if (outcomeClass === 'good') newWeight *= (1 + reward)
  else if (outcomeClass === 'poor') newWeight *= (1 - penalty)
  else if (outcomeClass === 'negative') newWeight *= (1 - penalty * 1.5)
  // neutral → no change

  return Math.round(Math.max(0.1, Math.min(2.0, newWeight)) * 100) / 100
}

// ---------------------------------------------------------------------------
// PURE: Build full feedback weight adjustment for a recipient
// ---------------------------------------------------------------------------

export function buildFeedbackWeightAdjustment(
  summary:         DistributionOutcomeSummary,
  currentWeights:  { acceptance: number; conversion: number; speed: number },
): FeedbackReinforcement {
  const outcomeClass = classifyDistributionOutcome(summary)

  const newAcceptance = applyWeightReinforcement(
    currentWeights.acceptance,
    outcomeClass,
  )
  const newConversion = applyWeightReinforcement(
    currentWeights.conversion,
    outcomeClass,
  )
  const newSpeed = computeResponseWeight(summary.avg_response_hours)

  const adjustments: WeightAdjustment[] = [
    {
      recipient_email: summary.recipient_email,
      dimension:       'acceptance',
      current_weight:  currentWeights.acceptance,
      new_weight:      newAcceptance,
      direction:       newAcceptance > currentWeights.acceptance ? 'strengthen' : newAcceptance < currentWeights.acceptance ? 'decay' : 'neutral',
      reason:          `acceptance rate ${summary.total_sent > 0 ? (summary.total_accepted / summary.total_sent * 100).toFixed(1) : 0}%`,
    },
    {
      recipient_email: summary.recipient_email,
      dimension:       'conversion',
      current_weight:  currentWeights.conversion,
      new_weight:      newConversion,
      direction:       newConversion > currentWeights.conversion ? 'strengthen' : newConversion < currentWeights.conversion ? 'decay' : 'neutral',
      reason:          `conversion ${summary.total_accepted > 0 ? (summary.total_converted / summary.total_accepted * 100).toFixed(1) : 0}%`,
    },
    {
      recipient_email: summary.recipient_email,
      dimension:       'speed',
      current_weight:  currentWeights.speed,
      new_weight:      newSpeed,
      direction:       newSpeed > currentWeights.speed ? 'strengthen' : newSpeed < currentWeights.speed ? 'decay' : 'neutral',
      reason:          `avg response ${summary.avg_response_hours != null ? summary.avg_response_hours.toFixed(1) + 'h' : 'unknown'}`,
    },
  ]

  // Geometric mean of 3 weights
  const composite = Math.round(
    Math.pow(newAcceptance * newConversion * newSpeed, 1 / 3) * 100,
  ) / 100

  const recommended: FeedbackReinforcement['recommended_action'] =
    summary.is_fatigued ? 'suppress'
    : outcomeClass === 'excellent' ? 'prioritize'
    : outcomeClass === 'good' ? 'maintain'
    : outcomeClass === 'poor' ? 'reduce'
    : outcomeClass === 'negative' ? 'suppress'
    : 'maintain'

  return {
    recipient_email:    summary.recipient_email,
    adjustments,
    composite_weight:   composite,
    outcome_class:      outcomeClass,
    recommended_action: recommended,
  }
}

// ---------------------------------------------------------------------------
// PURE: Compute network-level feedback score from aggregate distribution data
// Returns a 0-100 network health score
// ---------------------------------------------------------------------------

export function computeNetworkFeedbackScore(
  summaries: DistributionOutcomeSummary[],
): { score: number; avg_acceptance_pct: number; avg_conversion_pct: number; fatigued_pct: number } {
  if (summaries.length === 0) return { score: 50, avg_acceptance_pct: 0, avg_conversion_pct: 0, fatigued_pct: 0 }

  const totalSent     = summaries.reduce((a, s) => a + s.total_sent, 0)
  const totalAccepted = summaries.reduce((a, s) => a + s.total_accepted, 0)
  const totalConverted = summaries.reduce((a, s) => a + s.total_converted, 0)
  const fatiguedCount = summaries.filter(s => s.is_fatigued).length

  const avgAcceptancePct = totalSent > 0 ? totalAccepted / totalSent * 100 : 0
  const avgConversionPct = totalAccepted > 0 ? totalConverted / totalAccepted * 100 : 0
  const fatiguedPct      = summaries.length > 0 ? fatiguedCount / summaries.length * 100 : 0

  // Score: acceptance × 0.4 + conversion × 0.4 + (100 - fatigue) × 0.2
  const score = Math.round(
    Math.min(100, avgAcceptancePct) * 0.4 +
    Math.min(100, avgConversionPct * 3) * 0.4 +    // scale 0-33% conv → 0-100
    (100 - fatiguedPct) * 0.2,
  )

  return {
    score:                 Math.max(0, Math.min(100, score)),
    avg_acceptance_pct:    Math.round(avgAcceptancePct * 100) / 100,
    avg_conversion_pct:    Math.round(avgConversionPct * 100) / 100,
    fatigued_pct:          Math.round(fatiguedPct * 100) / 100,
  }
}

// ---------------------------------------------------------------------------
// DB: Persist feedback weights for a recipient
// ---------------------------------------------------------------------------

export async function persistFeedbackWeights(
  reinforcement: FeedbackReinforcement,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabaseAdmin as any)
    .from('distribution_feedback_weights')
    .upsert({
      recipient_email:    reinforcement.recipient_email,
      acceptance_weight:  reinforcement.adjustments.find(a => a.dimension === 'acceptance')?.new_weight ?? 1.0,
      conversion_weight:  reinforcement.adjustments.find(a => a.dimension === 'conversion')?.new_weight ?? 1.0,
      speed_weight:       reinforcement.adjustments.find(a => a.dimension === 'speed')?.new_weight ?? 1.0,
      composite_weight:   reinforcement.composite_weight,
      outcome_class:      reinforcement.outcome_class,
      recommended_action: reinforcement.recommended_action,
      updated_at:         new Date().toISOString(),
    }, { onConflict: 'recipient_email' })
  if (error) throw new Error(`persistFeedbackWeights: ${error.message}`)
}

// ---------------------------------------------------------------------------
// DB: Get feedback weights for a recipient
// ---------------------------------------------------------------------------

export async function getFeedbackWeightsForRecipient(email: string): Promise<{
  acceptance: number; conversion: number; speed: number
} | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from('distribution_feedback_weights')
    .select('acceptance_weight, conversion_weight, speed_weight')
    .eq('recipient_email', email)
    .maybeSingle()
  if (error) return null
  if (!data) return null
  return {
    acceptance: data.acceptance_weight ?? 1.0,
    conversion: data.conversion_weight ?? 1.0,
    speed:      data.speed_weight      ?? 1.0,
  }
}
