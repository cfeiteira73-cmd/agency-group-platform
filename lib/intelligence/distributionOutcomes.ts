// =============================================================================
// Agency Group — Distribution Outcomes & Recipient Intelligence
// lib/intelligence/distributionOutcomes.ts
//
// Phase 4: Distribution Intelligence Maximization
//
// Tracks per-recipient distribution results: opens, replies, meetings,
// offers, closes. Computes ROI per recipient and enforces fatigue/cooldown
// controls to prevent over-saturation of high-value contacts.
//
// FATIGUE MODEL:
//   fatigue_score = (distributions_7d * 15) + (distributions_30d * 3)
//   Fatigued when fatigue_score > 60 OR distributions_7d > 4
//   Cooldown: 48h after fatigue threshold crossed
//
// PURE FUNCTIONS:
//   computeRecipientROI, computeFatigueScore, isRecipientFatigued,
//   computeCooldownUntil, buildDistributionOutcome
//
// DB FUNCTIONS:
//   recordDistributionOutcome, refreshRecipientProfile,
//   getRecipientFatigueStatus, batchRefreshAllProfiles
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DistributionOutcome {
  distribution_event_id: string
  property_id:           string
  recipient_email:       string
  recipient_type:        'agent' | 'investor'
  recipient_tier?:       string
  distribution_rank?:    number
  opened_at?:            string
  replied_at?:           string
  meeting_booked_at?:    string
  offer_submitted_at?:   string
  closed_at?:            string
  outcome?:              DistributionOutcomeStatus
  rejection_reason?:     string
  time_to_reply_hours?:  number
  time_to_close_days?:   number
}

export type DistributionOutcomeStatus =
  | 'no_response'
  | 'opened'
  | 'replied'
  | 'meeting'
  | 'offer'
  | 'won'
  | 'lost'

export interface RecipientPerformanceProfile {
  recipient_email:       string
  recipient_type:        'agent' | 'investor'
  current_tier?:         string
  total_distributions:   number
  total_opens:           number
  total_replies:         number
  total_meetings:        number
  total_offers:          number
  total_won:             number
  open_rate?:            number | null
  reply_rate?:           number | null
  meeting_rate?:         number | null
  offer_rate?:           number | null
  close_rate?:           number | null
  avg_commission?:       number | null
  total_commission?:     number | null
  roi_score?:            number | null
  distributions_last_7d:  number
  distributions_last_30d: number
  last_distributed_at?:   string | null
  fatigue_score:          number
  is_fatigued:            boolean
  cooldown_until?:        string | null
  last_computed_at:       string
}

export interface FatigueStatus {
  recipient_email:       string
  is_fatigued:           boolean
  fatigue_score:         number
  cooldown_until?:       string | null
  distributions_last_7d: number
}

// ---------------------------------------------------------------------------
// PURE: Compute recipient ROI score (0-100)
// Combines close_rate (weight 60%) + reply_rate efficiency (weight 40%)
// ---------------------------------------------------------------------------

export function computeRecipientROI(profile: Pick<
  RecipientPerformanceProfile,
  'close_rate' | 'reply_rate' | 'total_distributions' | 'total_commission'
>): number {
  if (profile.total_distributions === 0) return 0

  const closeScore = ((profile.close_rate ?? 0) * 100) * 0.60
  const replyScore = ((profile.reply_rate ?? 0) * 100) * 0.40

  return Math.min(100, parseFloat((closeScore + replyScore).toFixed(2)))
}

// ---------------------------------------------------------------------------
// PURE: Compute fatigue score from distribution counts
// Max possible = 4*15 + 30*3 = 150, capped at 100
// ---------------------------------------------------------------------------

export function computeFatigueScore(
  distributions7d:  number,
  distributions30d: number,
): number {
  const raw = (distributions7d * 15) + (distributions30d * 3)
  return Math.min(100, raw)
}

// ---------------------------------------------------------------------------
// PURE: Determine if a recipient is fatigued and should enter cooldown
// ---------------------------------------------------------------------------

export function isRecipientFatigued(profile: Pick<
  RecipientPerformanceProfile,
  'fatigue_score' | 'distributions_last_7d' | 'cooldown_until'
>): boolean {
  // Still in active cooldown
  if (profile.cooldown_until && new Date(profile.cooldown_until) > new Date()) {
    return true
  }
  return profile.fatigue_score > 60 || profile.distributions_last_7d > 4
}

// ---------------------------------------------------------------------------
// PURE: Compute cooldown_until (48h from now) when fatigue kicks in
// ---------------------------------------------------------------------------

export function computeCooldownUntil(fromDate = new Date()): string {
  const cooldown = new Date(fromDate.getTime() + 48 * 60 * 60 * 1000)
  return cooldown.toISOString()
}

// ---------------------------------------------------------------------------
// PURE: Build a distribution outcome record
// ---------------------------------------------------------------------------

export function buildDistributionOutcome(
  distributionEventId: string,
  propertyId:          string,
  recipientEmail:      string,
  recipientType:       'agent' | 'investor',
  opts: {
    tier?:              string
    rank?:              number
    outcome?:           DistributionOutcomeStatus
    openedAt?:          string
    repliedAt?:         string
    meetingAt?:         string
    offerAt?:           string
    closedAt?:          string
    rejectionReason?:   string
    timeToReplyHours?:  number
    timeToCloseDays?:   number
  } = {},
): DistributionOutcome {
  return {
    distribution_event_id: distributionEventId,
    property_id:           propertyId,
    recipient_email:       recipientEmail,
    recipient_type:        recipientType,
    recipient_tier:        opts.tier,
    distribution_rank:     opts.rank,
    opened_at:             opts.openedAt,
    replied_at:            opts.repliedAt,
    meeting_booked_at:     opts.meetingAt,
    offer_submitted_at:    opts.offerAt,
    closed_at:             opts.closedAt,
    outcome:               opts.outcome,
    rejection_reason:      opts.rejectionReason,
    time_to_reply_hours:   opts.timeToReplyHours,
    time_to_close_days:    opts.timeToCloseDays,
  }
}

// ---------------------------------------------------------------------------
// DB: Record a distribution outcome
// ---------------------------------------------------------------------------

export async function recordDistributionOutcome(
  outcome: DistributionOutcome,
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from('distribution_outcomes')
    .upsert({
      distribution_event_id: outcome.distribution_event_id,
      property_id:           outcome.property_id,
      recipient_email:       outcome.recipient_email,
      recipient_type:        outcome.recipient_type,
      recipient_tier:        outcome.recipient_tier ?? null,
      distribution_rank:     outcome.distribution_rank ?? null,
      opened_at:             outcome.opened_at ?? null,
      replied_at:            outcome.replied_at ?? null,
      meeting_booked_at:     outcome.meeting_booked_at ?? null,
      offer_submitted_at:    outcome.offer_submitted_at ?? null,
      closed_at:             outcome.closed_at ?? null,
      outcome:               outcome.outcome ?? null,
      rejection_reason:      outcome.rejection_reason ?? null,
      time_to_reply_hours:   outcome.time_to_reply_hours ?? null,
      time_to_close_days:    outcome.time_to_close_days ?? null,
    }, { onConflict: 'distribution_event_id, recipient_email' })
    .select('id')
    .single()

  if (error) throw new Error(`recordDistributionOutcome: ${error.message}`)
  return data.id as string
}

// ---------------------------------------------------------------------------
// DB: Refresh a single recipient's performance profile
// ---------------------------------------------------------------------------

export async function refreshRecipientProfile(
  recipientEmail: string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = supabaseAdmin as any

  const { data: outcomes, error: fetchErr } = await admin
    .from('distribution_outcomes')
    .select('outcome, time_to_reply_hours, time_to_close_days, created_at')
    .eq('recipient_email', recipientEmail)

  if (fetchErr) throw new Error(`refreshRecipientProfile fetch: ${fetchErr.message}`)

  const rows   = (outcomes ?? []) as Array<{
    outcome: string | null; created_at: string
  }>
  const now    = new Date()
  const cutoff7  = new Date(now.getTime() - 7  * 86400_000).toISOString()
  const cutoff30 = new Date(now.getTime() - 30 * 86400_000).toISOString()

  const total          = rows.length
  const opens          = rows.filter(r => r.outcome && r.outcome !== 'no_response').length
  const replies        = rows.filter(r => ['replied','meeting','offer','won','lost'].includes(r.outcome ?? '')).length
  const meetings       = rows.filter(r => ['meeting','offer','won'].includes(r.outcome ?? '')).length
  const offers         = rows.filter(r => ['offer','won'].includes(r.outcome ?? '')).length
  const won            = rows.filter(r => r.outcome === 'won').length
  const last7d         = rows.filter(r => r.created_at >= cutoff7).length
  const last30d        = rows.filter(r => r.created_at >= cutoff30).length

  const openRate    = total > 0 ? opens    / total : null
  const replyRate   = total > 0 ? replies  / total : null
  const meetingRate = total > 0 ? meetings / total : null
  const offerRate   = total > 0 ? offers   / total : null
  const closeRate   = total > 0 ? won      / total : null

  const fatigueScore  = computeFatigueScore(last7d, last30d)
  const fatigued      = fatigueScore > 60 || last7d > 4
  const cooldownUntil = fatigued ? computeCooldownUntil(now) : null

  const roi = computeRecipientROI({
    close_rate: closeRate, reply_rate: replyRate,
    total_distributions: total, total_commission: null,
  })

  const { error: upsertErr } = await admin
    .from('recipient_performance_profiles')
    .upsert({
      recipient_email:        recipientEmail,
      recipient_type:         'agent',   // will be overridden if profile row exists
      total_distributions:    total,
      total_opens:            opens,
      total_replies:          replies,
      total_meetings:         meetings,
      total_offers:           offers,
      total_won:              won,
      open_rate:              openRate,
      reply_rate:             replyRate,
      meeting_rate:           meetingRate,
      offer_rate:             offerRate,
      close_rate:             closeRate,
      roi_score:              roi,
      distributions_last_7d:  last7d,
      distributions_last_30d: last30d,
      fatigue_score:          fatigueScore,
      is_fatigued:            fatigued,
      cooldown_until:         cooldownUntil,
      last_computed_at:       now.toISOString(),
    }, { onConflict: 'recipient_email' })

  if (upsertErr) throw new Error(`refreshRecipientProfile upsert: ${upsertErr.message}`)
}

// ---------------------------------------------------------------------------
// DB: Get fatigue status for a list of emails (for pre-distribution check)
// ---------------------------------------------------------------------------

export async function getRecipientFatigueStatus(
  emails: string[],
): Promise<FatigueStatus[]> {
  if (emails.length === 0) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from('recipient_performance_profiles')
    .select('recipient_email, is_fatigued, fatigue_score, cooldown_until, distributions_last_7d')
    .in('recipient_email', emails)

  if (error) throw new Error(`getRecipientFatigueStatus: ${error.message}`)

  const found = new Map(
    ((data ?? []) as FatigueStatus[]).map(r => [r.recipient_email, r])
  )

  // Return status for all requested emails (not-found = not fatigued)
  return emails.map(e => found.get(e) ?? {
    recipient_email:       e,
    is_fatigued:           false,
    fatigue_score:         0,
    cooldown_until:        null,
    distributions_last_7d: 0,
  })
}
