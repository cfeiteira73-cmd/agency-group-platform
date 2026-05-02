// =============================================================================
// Agency Group — Conversion Propensity Scoring
// lib/intelligence/conversionPropensity.ts
//
// Phase 4: Distribution / Network Effect Intelligence
//
// Computes per-recipient, per-property conversion propensity scores and
// generates human-readable ranking explanations.
//
// Model:
//   propensity = weighted sum of:
//     - engagement_score   (decay-adjusted ROI, 0-100)  weight 0.30
//     - property_fit_score (zone/type/budget match, 0-100) weight 0.35
//     - tier_multiplier    (ELITE=1.0, PREMIUM=0.85, STANDARD=0.70, BASIC=0.55)
//     - response_speed     (historical reply-time score, 0-100) weight 0.20
//     - capacity_score     (not fatigued, under monthly limit) weight 0.15
//
// PURE FUNCTIONS:
//   computePropertyFitScore, computeResponseSpeedScore,
//   computeCapacityScore, computePropensityScore,
//   rankRecipientsByPropensity, explainRanking
//
// DB FUNCTIONS:
//   getPropensityScores, persistPropensityRankings
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RecipientTier = 'ELITE' | 'PREMIUM' | 'STANDARD' | 'BASIC'

export interface RecipientSignals {
  recipient_email:          string
  recipient_type:           'agent' | 'investor'
  tier:                     RecipientTier
  adjusted_roi_score:       number       // decay-adjusted
  avg_time_to_reply_hours:  number | null
  distributions_last_7d:   number
  distributions_last_30d:  number
  is_fatigued:              boolean
  preferred_zones:          string[]
  preferred_property_types: string[]
  budget_min:               number | null
  budget_max:               number | null
}

export interface PropertySignals {
  zone_key:             string
  property_type:        string
  asking_price:         number
  estimated_yield_pct:  number | null
}

export interface RankingFactor {
  name:   string
  score:  number          // 0-100 contribution
  weight: number          // 0-1
  reason: string          // human-readable explanation
}

export interface PropensityScore {
  recipient_email:    string
  propensity_score:   number               // 0-100 final
  property_fit:       number
  engagement:         number
  response_speed:     number
  capacity:           number
  tier_multiplier:    number
  is_eligible:        boolean
  ineligibility_reason?: string
  factors:            RankingFactor[]
}

export interface RankedRecipient extends PropensityScore {
  rank: number
}

// ---------------------------------------------------------------------------
// PURE: Tier multiplier (ELITE → 1.0, BASIC → 0.55)
// ---------------------------------------------------------------------------

export function getTierMultiplier(tier: RecipientTier): number {
  const map: Record<RecipientTier, number> = {
    ELITE:    1.00,
    PREMIUM:  0.85,
    STANDARD: 0.70,
    BASIC:    0.55,
  }
  return map[tier] ?? 0.55
}

// ---------------------------------------------------------------------------
// PURE: Property fit score (0-100)
//
// How well does this property match what the recipient historically buys?
// ---------------------------------------------------------------------------

export function computePropertyFitScore(
  recipient: RecipientSignals,
  property:  PropertySignals,
): { score: number; reasons: string[] } {
  const reasons: string[] = []
  let score = 50    // base: neutral

  // Zone fit
  if (recipient.preferred_zones.length > 0) {
    if (recipient.preferred_zones.includes(property.zone_key)) {
      score += 25
      reasons.push(`Zone match (${property.zone_key})`)
    } else {
      score -= 15
      reasons.push(`Zone outside preferences`)
    }
  }

  // Property type fit
  if (recipient.preferred_property_types.length > 0) {
    if (recipient.preferred_property_types.includes(property.property_type)) {
      score += 15
      reasons.push(`Property type match (${property.property_type})`)
    } else {
      score -= 10
      reasons.push(`Property type outside preferences`)
    }
  }

  // Budget fit
  if (recipient.budget_min != null && recipient.budget_max != null) {
    if (property.asking_price >= recipient.budget_min && property.asking_price <= recipient.budget_max) {
      score += 15
      reasons.push(`Price within budget range`)
    } else if (property.asking_price > recipient.budget_max * 1.2) {
      score -= 20
      reasons.push(`Price significantly above budget`)
    } else if (property.asking_price < recipient.budget_min * 0.7) {
      score -= 10
      reasons.push(`Price below typical range`)
    }
  }

  return { score: Math.max(0, Math.min(100, score)), reasons }
}

// ---------------------------------------------------------------------------
// PURE: Response speed score (0-100)
//
// Fast responders get higher scores → distribute to them more to close faster
// ---------------------------------------------------------------------------

export function computeResponseSpeedScore(
  avgTimeToReplyHours: number | null,
): number {
  if (avgTimeToReplyHours == null) return 50    // unknown — neutral
  if (avgTimeToReplyHours <= 1)    return 100
  if (avgTimeToReplyHours <= 4)    return 90
  if (avgTimeToReplyHours <= 12)   return 75
  if (avgTimeToReplyHours <= 24)   return 60
  if (avgTimeToReplyHours <= 48)   return 40
  if (avgTimeToReplyHours <= 96)   return 20
  return 10
}

// ---------------------------------------------------------------------------
// PURE: Capacity score (0-100)
//
// Penalizes recipients who have received too many distributions recently
// ---------------------------------------------------------------------------

export function computeCapacityScore(
  distributions7d:  number,
  distributions30d: number,
  isFatigued:       boolean,
): number {
  if (isFatigued) return 0
  // Perfect score if rarely contacted
  let score = 100
  // Soft penalty for 7d frequency
  if (distributions7d >= 3) score -= 30
  else if (distributions7d >= 2) score -= 15
  else if (distributions7d >= 1) score -= 5
  // Soft penalty for 30d frequency
  if (distributions30d >= 8) score -= 20
  else if (distributions30d >= 5) score -= 10
  return Math.max(0, score)
}

// ---------------------------------------------------------------------------
// PURE: Compute final propensity score (0-100)
// ---------------------------------------------------------------------------

export function computePropensityScore(
  recipient: RecipientSignals,
  property:  PropertySignals,
): PropensityScore {
  // Eligibility gate
  if (recipient.is_fatigued) {
    return {
      recipient_email:    recipient.recipient_email,
      propensity_score:   0,
      property_fit:       0,
      engagement:         0,
      response_speed:     0,
      capacity:           0,
      tier_multiplier:    getTierMultiplier(recipient.tier),
      is_eligible:        false,
      ineligibility_reason: 'Recipient is currently fatigued (cooldown active)',
      factors:            [],
    }
  }

  const { score: fitScore, reasons: fitReasons } = computePropertyFitScore(recipient, property)
  const engagementScore  = Math.min(100, recipient.adjusted_roi_score)
  const speedScore       = computeResponseSpeedScore(recipient.avg_time_to_reply_hours)
  const capacityScore    = computeCapacityScore(
    recipient.distributions_last_7d,
    recipient.distributions_last_30d,
    recipient.is_fatigued,
  )
  const tierMult         = getTierMultiplier(recipient.tier)

  // Weighted sum
  const raw = (
    fitScore       * 0.35 +
    engagementScore * 0.30 +
    speedScore     * 0.20 +
    capacityScore  * 0.15
  )

  // Apply tier multiplier (reduces score for lower tiers)
  const propensity = Math.round(Math.min(100, raw * tierMult))

  const factors: RankingFactor[] = [
    {
      name:   'Property Fit',
      score:  fitScore,
      weight: 0.35,
      reason: fitReasons.length > 0 ? fitReasons.join('; ') : 'No historical preference data',
    },
    {
      name:   'Engagement Quality',
      score:  engagementScore,
      weight: 0.30,
      reason: `Decay-adjusted ROI score: ${engagementScore.toFixed(1)}`,
    },
    {
      name:   'Response Speed',
      score:  speedScore,
      weight: 0.20,
      reason: recipient.avg_time_to_reply_hours != null
        ? `Avg reply time: ${recipient.avg_time_to_reply_hours.toFixed(1)}h`
        : 'No reply time data yet',
    },
    {
      name:   'Capacity',
      score:  capacityScore,
      weight: 0.15,
      reason: `${recipient.distributions_last_7d} distributions in last 7d, ${recipient.distributions_last_30d} in 30d`,
    },
  ]

  return {
    recipient_email:  recipient.recipient_email,
    propensity_score: propensity,
    property_fit:     fitScore,
    engagement:       engagementScore,
    response_speed:   speedScore,
    capacity:         capacityScore,
    tier_multiplier:  tierMult,
    is_eligible:      true,
    factors,
  }
}

// ---------------------------------------------------------------------------
// PURE: Rank recipients by propensity for a given property
// ---------------------------------------------------------------------------

export function rankRecipientsByPropensity(
  recipients: RecipientSignals[],
  property:   PropertySignals,
): RankedRecipient[] {
  return recipients
    .map(r => computePropensityScore(r, property))
    .sort((a, b) => b.propensity_score - a.propensity_score)
    .map((r, i) => ({ ...r, rank: i + 1 }))
}

// ---------------------------------------------------------------------------
// PURE: Generate a human-readable ranking explanation for the top factor
// ---------------------------------------------------------------------------

export function explainRanking(ranked: RankedRecipient): string {
  if (!ranked.is_eligible) {
    return `Not eligible: ${ranked.ineligibility_reason}`
  }
  const topFactor = [...ranked.factors]
    .sort((a, b) => (b.score * b.weight) - (a.score * a.weight))[0]

  return `Ranked #${ranked.rank} (score: ${ranked.propensity_score}/100). `
    + `Strongest signal: ${topFactor?.name} — ${topFactor?.reason}.`
}

// ---------------------------------------------------------------------------
// DB: Fetch recipient signals for propensity computation
// ---------------------------------------------------------------------------

export async function getRecipientSignalsForProperty(opts: {
  propertyId:     string
  recipientType?: 'agent' | 'investor' | 'all'
  limit?:         number
}): Promise<RecipientSignals[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabaseAdmin as any)
    .from('recipient_performance_profiles')
    .select(`
      recipient_email,
      recipient_type,
      roi_score,
      distributions_last_7d,
      distributions_last_30d,
      is_fatigued
    `)
    .eq('is_fatigued', false)
    .order('roi_score', { ascending: false })
    .limit(opts.limit ?? 100)

  if (opts.recipientType && opts.recipientType !== 'all') {
    query = query.eq('recipient_type', opts.recipientType)
  }

  const { data: profiles, error } = await query
  if (error) throw new Error(`getRecipientSignalsForProperty: ${error.message}`)

  // Fetch investor intelligence for preferred zones/types/budget
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: intelligence } = await (supabaseAdmin as any)
    .from('investor_intelligence')
    .select('investor_email, preferred_zones, preferred_asset_types, budget_min, budget_max')

  type IntelRow = {
    investor_email: string;
    preferred_zones: string[] | null;
    preferred_asset_types: string[] | null;
    budget_min: number | null;
    budget_max: number | null;
  }
  const intelMap = new Map<string, IntelRow>(
    (intelligence ?? []).map((r: IntelRow) => [r.investor_email, r] as [string, IntelRow]),
  )

  // Fetch partner tiers
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tiers } = await (supabaseAdmin as any)
    .from('partner_tiers')
    .select('contact_email, tier')

  const tierMap = new Map((tiers ?? []).map((r: { contact_email: string; tier: string }) => [r.contact_email, r.tier]))

  return (profiles ?? []).map((p: {
    recipient_email: string;
    recipient_type: 'agent' | 'investor';
    roi_score: number;
    distributions_last_7d: number;
    distributions_last_30d: number;
    is_fatigued: boolean;
  }) => {
    const intel = intelMap.get(p.recipient_email)
    const tier  = (tierMap.get(p.recipient_email) ?? 'STANDARD') as RecipientTier

    return {
      recipient_email:          p.recipient_email,
      recipient_type:           p.recipient_type,
      tier,
      adjusted_roi_score:       p.roi_score ?? 0,
      avg_time_to_reply_hours:  null,   // populated by distribution_outcomes aggregation
      distributions_last_7d:   p.distributions_last_7d  ?? 0,
      distributions_last_30d:  p.distributions_last_30d ?? 0,
      is_fatigued:              p.is_fatigued ?? false,
      preferred_zones:          intel?.preferred_zones          ?? [],
      preferred_property_types: intel?.preferred_asset_types    ?? [],
      budget_min:               intel?.budget_min               ?? null,
      budget_max:               intel?.budget_max               ?? null,
    } satisfies RecipientSignals
  })
}
