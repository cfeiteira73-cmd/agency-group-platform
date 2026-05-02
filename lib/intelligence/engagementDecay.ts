// =============================================================================
// Agency Group — Engagement Decay Model
// lib/intelligence/engagementDecay.ts
//
// Phase 4: Distribution / Network Effect Intelligence
//
// Models the temporal degradation of recipient engagement.
// A recipient who was highly engaged 6 months ago may have gone cold.
// Without decay, stale engagement scores overstate propensity.
//
// DECAY MODEL:
//   decay_factor = exp(-λ × days)
//   λ = ln(2) / half_life_days       (default half-life: 45 days)
//
//   adjusted_score = raw_score × decay_factor
//
// ENGAGEMENT STATUS:
//   active     (decay > 0.75):  engaged in the last ~18 days
//   warming    (0.5-0.75):      engaged 18-45 days ago
//   cooling    (0.25-0.5):      engaged 45-90 days ago
//   dormant    (0.1-0.25):      engaged 90-180 days ago
//   inactive   (< 0.1):        effectively disengaged (6m+)
//
// PURE FUNCTIONS:
//   computeDecayFactor, applyDecayToScore, classifyEngagementStatus,
//   computeDaysSinceEngagement, buildDecayAdjustedProfile
//
// DB FUNCTIONS:
//   batchComputeDecay, getDecayedRecipients, getDormantRecipients
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EngagementStatus = 'active' | 'warming' | 'cooling' | 'dormant' | 'inactive'

export interface DecayConfig {
  halfLifeDays: number    // default: 45
}

export interface DecayAdjustedProfile {
  recipient_email:       string
  raw_roi_score:         number
  decay_factor:          number      // 0-1
  adjusted_roi_score:    number      // raw × decay
  days_since_engagement: number
  engagement_status:     EngagementStatus
  last_engaged_at:       string | null
  reengagement_priority: number      // 0-100 — how worth it is to re-engage
}

const DEFAULT_HALF_LIFE = 45  // days

// ---------------------------------------------------------------------------
// PURE: Compute decay factor from days since last engagement
//
// Returns 0-1 (1 = fully engaged today, 0 = never)
// ---------------------------------------------------------------------------

export function computeDecayFactor(
  daysSinceEngagement: number,
  config: DecayConfig = { halfLifeDays: DEFAULT_HALF_LIFE },
): number {
  if (daysSinceEngagement <= 0)  return 1.0
  if (daysSinceEngagement > 730) return 0.0  // 2+ years → effectively zero
  const lambda = Math.LN2 / config.halfLifeDays
  return Math.round(Math.exp(-lambda * daysSinceEngagement) * 10000) / 10000
}

// ---------------------------------------------------------------------------
// PURE: Apply decay to a raw engagement score
// ---------------------------------------------------------------------------

export function applyDecayToScore(
  rawScore:            number,
  daysSinceEngagement: number,
  config?:             DecayConfig,
): number {
  const factor  = computeDecayFactor(daysSinceEngagement, config)
  const adjusted = rawScore * factor
  return Math.round(adjusted * 100) / 100
}

// ---------------------------------------------------------------------------
// PURE: Classify engagement status from decay factor
// ---------------------------------------------------------------------------

export function classifyEngagementStatus(decayFactor: number): EngagementStatus {
  if (decayFactor > 0.75) return 'active'
  if (decayFactor > 0.50) return 'warming'
  if (decayFactor > 0.25) return 'cooling'
  if (decayFactor > 0.10) return 'dormant'
  return 'inactive'
}

// ---------------------------------------------------------------------------
// PURE: Compute days since a given ISO timestamp
// ---------------------------------------------------------------------------

export function computeDaysSinceEngagement(
  lastEngagedAt: string | null | undefined,
  asOf: Date = new Date(),
): number {
  if (!lastEngagedAt) return 9999  // never engaged
  const msAgo = asOf.getTime() - new Date(lastEngagedAt).getTime()
  return Math.max(0, Math.floor(msAgo / 86400_000))
}

// ---------------------------------------------------------------------------
// PURE: Compute re-engagement priority score (0-100)
//
// High priority = high historical quality BUT currently dormant/cooling
// Low priority  = either already active (no need) or fully inactive (too cold)
// ---------------------------------------------------------------------------

export function computeReengagementPriority(
  rawRoiScore:    number,    // historical quality (0-100)
  decayFactor:    number,    // current engagement (0-1)
): number {
  // Sweet spot: good score AND some engagement gap (cooling/dormant)
  // active (0.75+): already engaged, priority = 0
  // inactive (<0.1): too far gone, priority = 0
  if (decayFactor > 0.75) return 0    // already active
  if (decayFactor < 0.05) return 0    // too far gone

  // Priority = raw quality × re-engagement potential
  const potential = 1 - decayFactor           // 0 = active, 1 = fully decayed
  const optimal   = Math.min(potential, 0.8)  // peak at 80% decay (cooling/dormant boundary)
  return Math.round(rawRoiScore * optimal)
}

// ---------------------------------------------------------------------------
// PURE: Build a full decay-adjusted profile from raw data
// ---------------------------------------------------------------------------

export function buildDecayAdjustedProfile(
  recipientEmail:  string,
  rawRoiScore:     number,
  lastEngagedAt:   string | null,
  config?:         DecayConfig,
): DecayAdjustedProfile {
  const days    = computeDaysSinceEngagement(lastEngagedAt)
  const factor  = computeDecayFactor(days, config)
  const status  = classifyEngagementStatus(factor)
  const adjusted = applyDecayToScore(rawRoiScore, days, config)
  const priority = computeReengagementPriority(rawRoiScore, factor)

  return {
    recipient_email:       recipientEmail,
    raw_roi_score:         rawRoiScore,
    decay_factor:          factor,
    adjusted_roi_score:    adjusted,
    days_since_engagement: days,
    engagement_status:     status,
    last_engaged_at:       lastEngagedAt,
    reengagement_priority: priority,
  }
}

// ---------------------------------------------------------------------------
// DB: Batch compute decay for all recipient profiles
//
// Updates roi_score to decay-adjusted value and marks status
// ---------------------------------------------------------------------------

export async function batchComputeDecay(opts: {
  onlyStale?: boolean    // only recompute if last_computed_at > 24h ago
} = {}): Promise<{ processed: number; updated: number }> {
  const staleCutoff = new Date(Date.now() - 24 * 3600_000).toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabaseAdmin as any)
    .from('recipient_performance_profiles')
    .select('recipient_email, roi_score, last_distributed_at, last_computed_at')
    .limit(500)

  if (opts.onlyStale) {
    query = query.lt('last_computed_at', staleCutoff)
  }

  const { data: profiles, error } = await query
  if (error) throw new Error(`batchComputeDecay fetch: ${error.message}`)
  if (!profiles?.length) return { processed: 0, updated: 0 }

  let updated = 0
  for (const profile of profiles) {
    const raw     = profile.roi_score ?? 0
    const days    = computeDaysSinceEngagement(profile.last_distributed_at)
    const factor  = computeDecayFactor(days)
    const status  = classifyEngagementStatus(factor)
    const adjusted = applyDecayToScore(raw, days)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: upErr } = await (supabaseAdmin as any)
      .from('recipient_performance_profiles')
      .update({
        roi_score:          adjusted,
        last_computed_at:   new Date().toISOString(),
      })
      .eq('recipient_email', profile.recipient_email)

    if (!upErr) updated++
    else console.error(`[decay] failed for ${profile.recipient_email}: ${upErr.message}`)

    // Log the status for observability
    void status  // consumed to avoid lint warning
  }

  return { processed: profiles.length, updated }
}

// ---------------------------------------------------------------------------
// DB: Get recipients in a specific decay status
// ---------------------------------------------------------------------------

export async function getRecipientsByDecayStatus(
  status:  EngagementStatus,
  limit = 50,
): Promise<Array<{ recipient_email: string; roi_score: number; last_distributed_at: string | null }>> {
  // We approximate by days_since_engagement from last_distributed_at
  const thresholds: Record<EngagementStatus, { minDays: number; maxDays: number }> = {
    active:   { minDays:  0, maxDays:  18 },
    warming:  { minDays: 18, maxDays:  45 },
    cooling:  { minDays: 45, maxDays:  90 },
    dormant:  { minDays: 90, maxDays: 180 },
    inactive: { minDays: 180, maxDays: 9999 },
  }

  const { minDays, maxDays } = thresholds[status]
  const now      = new Date()
  const maxCutoff = new Date(now.getTime() - minDays * 86400_000).toISOString()
  const minCutoff = maxDays < 9999
    ? new Date(now.getTime() - maxDays * 86400_000).toISOString()
    : null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabaseAdmin as any)
    .from('recipient_performance_profiles')
    .select('recipient_email, roi_score, last_distributed_at')
    .lt('last_distributed_at', maxCutoff)
    .order('roi_score', { ascending: false })
    .limit(limit)

  if (minCutoff) {
    query = query.gte('last_distributed_at', minCutoff)
  }

  const { data, error } = await query
  if (error) throw new Error(`getRecipientsByDecayStatus: ${error.message}`)
  return data ?? []
}

// ---------------------------------------------------------------------------
// DB: Get top re-engagement targets
// ---------------------------------------------------------------------------

export async function getReengagementTargets(limit = 20): Promise<DecayAdjustedProfile[]> {
  // Good ROI historically but cooling/dormant
  const thirtyDaysAgo  = new Date(Date.now() -  30 * 86400_000).toISOString()
  const oneEightyAgo   = new Date(Date.now() - 180 * 86400_000).toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from('recipient_performance_profiles')
    .select('recipient_email, roi_score, last_distributed_at')
    .lt('last_distributed_at', thirtyDaysAgo)
    .gte('last_distributed_at', oneEightyAgo)
    .gte('roi_score', 40)
    .order('roi_score', { ascending: false })
    .limit(limit * 2)   // fetch extra, sort by priority below

  if (error) throw new Error(`getReengagementTargets: ${error.message}`)
  if (!data?.length) return []

  const profiles = (data as Array<{ recipient_email: string; roi_score: number; last_distributed_at: string | null }>)
    .map(p => buildDecayAdjustedProfile(p.recipient_email, p.roi_score, p.last_distributed_at))
    .filter(p => p.reengagement_priority > 0)
    .sort((a, b) => b.reengagement_priority - a.reengagement_priority)
    .slice(0, limit)

  return profiles
}
