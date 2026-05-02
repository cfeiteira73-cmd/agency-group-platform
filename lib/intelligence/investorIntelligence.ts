// =============================================================================
// Agency Group — Investor Intelligence Engine
// lib/intelligence/investorIntelligence.ts
//
// Builds a behavioral profile for each investor/buyer from their engagement
// history, then re-ranks matches dynamically based on live signals.
//
// ENGAGEMENT SCORE (0-100):
//   open_rate_score       (0-25)  — opens / surfaced
//   reply_rate_score      (0-30)  — replies / surfaced
//   meeting_rate_score    (0-25)  — meetings / surfaced
//   conversion_rate_score (0-20)  — deals / surfaced
//
// PREFERENCE INFERENCE:
//   preferred_asset_types  — from types of properties they replied/met on
//   preferred_zones        — from zones of properties they engaged with
//   inferred_yield_target  — avg yield % of properties they offered on
//   inferred_risk_tolerance — (0-1) from property type mix
//   budget_adherence       — ratio of offers within stated budget
//
// PURE FUNCTIONS:
//   computeInvestorEngagementScore, reRankInvestorMatches
//
// DB FUNCTIONS:
//   computeAndPersistInvestorIntelligence, batchUpdateAllInvestorIntelligence
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InvestorEngagementData {
  investor_id:      string
  total_surfaced:   number
  total_opened:     number
  total_replied:    number
  total_meetings:   number
  total_offers:     number
  total_deals:      number
}

export interface InvestorEngagementScore {
  open_rate_score:        number   // 0-25
  reply_rate_score:       number   // 0-30
  meeting_rate_score:     number   // 0-25
  conversion_rate_score:  number   // 0-20
  total:                  number   // 0-100
  // Rates (0-1)
  open_rate:        number
  reply_rate:       number
  meeting_rate:     number
  conversion_rate:  number
}

export interface InvestorPreferences {
  preferred_asset_types:   string[]
  preferred_zones:         string[]
  inferred_yield_target:   number | null   // %
  inferred_risk_tolerance: number | null   // 0-1
  budget_adherence:        number | null   // 0-1
  fit_confidence:          number          // 0-1 (how confident we are in the inferred prefs)
}

export interface InvestorProfile {
  investor_id:       string
  engagement:        InvestorEngagementScore
  preferences:       InvestorPreferences
}

export interface PropertyForInvestorMatch {
  id:        string
  type:      string
  zone_key:  string
  price:     number
  fit_score: number   // existing 0-1 match score from match engine
}

export interface RankedInvestorMatch {
  investor_id:      string
  original_rank:    number
  new_rank:         number
  composite_score:  number   // 0-100
  engagement_score: number
  fit_score_pct:    number   // fit_score * 100
  rank_change:      number   // positive = moved up
  reason:           string
}

// ---------------------------------------------------------------------------
// PURE: Score open rate (0-25)
// ---------------------------------------------------------------------------

function scoreOpenRate(rate: number): number {
  if (rate >= 0.80) return 25
  if (rate >= 0.65) return 21
  if (rate >= 0.50) return 17
  if (rate >= 0.35) return 12
  if (rate >= 0.20) return 7
  if (rate >  0.00) return 3
  return 0
}

// ---------------------------------------------------------------------------
// PURE: Score reply rate (0-30)
// ---------------------------------------------------------------------------

function scoreReplyRate(rate: number): number {
  if (rate >= 0.40) return 30
  if (rate >= 0.25) return 24
  if (rate >= 0.15) return 18
  if (rate >= 0.08) return 12
  if (rate >= 0.03) return 6
  if (rate >  0.00) return 2
  return 0
}

// ---------------------------------------------------------------------------
// PURE: Score meeting rate (0-25)
// ---------------------------------------------------------------------------

function scoreMeetingRate(rate: number): number {
  if (rate >= 0.25) return 25
  if (rate >= 0.15) return 20
  if (rate >= 0.08) return 15
  if (rate >= 0.04) return 9
  if (rate >= 0.01) return 4
  if (rate >  0.00) return 1
  return 0
}

// ---------------------------------------------------------------------------
// PURE: Score conversion rate (0-20)
// ---------------------------------------------------------------------------

function scoreConversionRate(rate: number): number {
  if (rate >= 0.15) return 20
  if (rate >= 0.10) return 17
  if (rate >= 0.06) return 13
  if (rate >= 0.03) return 8
  if (rate >= 0.01) return 4
  if (rate >  0.00) return 1
  return 0
}

// ---------------------------------------------------------------------------
// PURE: Compute investor engagement score
// ---------------------------------------------------------------------------

export function computeInvestorEngagementScore(
  data: InvestorEngagementData,
): InvestorEngagementScore {
  const { total_surfaced, total_opened, total_replied, total_meetings, total_deals } = data

  const open_rate       = total_surfaced > 0 ? total_opened  / total_surfaced : 0
  const reply_rate      = total_surfaced > 0 ? total_replied / total_surfaced : 0
  const meeting_rate    = total_surfaced > 0 ? total_meetings / total_surfaced : 0
  const conversion_rate = total_surfaced > 0 ? total_deals   / total_surfaced : 0

  const open_rate_score       = scoreOpenRate(open_rate)
  const reply_rate_score      = scoreReplyRate(reply_rate)
  const meeting_rate_score    = scoreMeetingRate(meeting_rate)
  const conversion_rate_score = scoreConversionRate(conversion_rate)

  const total = Math.min(100, Math.round(
    open_rate_score + reply_rate_score + meeting_rate_score + conversion_rate_score,
  ))

  return {
    open_rate_score,
    reply_rate_score,
    meeting_rate_score,
    conversion_rate_score,
    total,
    open_rate:        parseFloat(open_rate.toFixed(4)),
    reply_rate:       parseFloat(reply_rate.toFixed(4)),
    meeting_rate:     parseFloat(meeting_rate.toFixed(4)),
    conversion_rate:  parseFloat(conversion_rate.toFixed(4)),
  }
}

// ---------------------------------------------------------------------------
// PURE: Infer fit confidence from data completeness
// ---------------------------------------------------------------------------

export function computeFitConfidence(prefs: Omit<InvestorPreferences, 'fit_confidence'>): number {
  let confidence = 0.50   // base — we always have some signal

  if (prefs.preferred_asset_types.length >= 2) confidence += 0.15
  else if (prefs.preferred_asset_types.length >= 1) confidence += 0.07

  if (prefs.preferred_zones.length >= 2) confidence += 0.10
  else if (prefs.preferred_zones.length >= 1) confidence += 0.05

  if (prefs.inferred_yield_target != null)   confidence += 0.10
  if (prefs.inferred_risk_tolerance != null) confidence += 0.08
  if (prefs.budget_adherence != null)        confidence += 0.07

  return Math.min(1.0, parseFloat(confidence.toFixed(3)))
}

// ---------------------------------------------------------------------------
// PURE: Re-rank investor matches by composite score
// ---------------------------------------------------------------------------

export function reRankInvestorMatches(
  property:  PropertyForInvestorMatch,
  investors: Array<{
    investor_id:      string
    fit_score:        number   // 0-1 from match engine
    engagement_score: number   // 0-100 from this module
    preferred_asset_types: string[]
    preferred_zones:       string[]
  }>,
): RankedInvestorMatch[] {
  // Compute composite score for each investor
  const scored = investors.map((inv, idx) => {
    const fitContrib        = inv.fit_score * 60              // 0-60
    const engagementContrib = (inv.engagement_score / 100) * 40   // 0-40

    let composite = fitContrib + engagementContrib

    // Type match bonus
    if (inv.preferred_asset_types.includes(property.type)) composite += 5
    // Zone match bonus
    if (inv.preferred_zones.includes(property.zone_key))   composite += 5

    composite = Math.min(100, Math.round(composite))

    const reasons: string[] = []
    if (inv.preferred_asset_types.includes(property.type)) reasons.push(`${property.type} preference`)
    if (inv.preferred_zones.includes(property.zone_key))   reasons.push(`${property.zone_key} zone`)
    reasons.push(`engagement ${Math.round(inv.engagement_score)}/100`)

    return {
      investor_id:      inv.investor_id,
      original_rank:    idx + 1,
      composite_score:  composite,
      engagement_score: inv.engagement_score,
      fit_score_pct:    Math.round(inv.fit_score * 100),
      reason:           reasons.join(' · '),
    }
  })

  // Sort by composite score descending
  scored.sort((a, b) => b.composite_score - a.composite_score)

  return scored.map((item, idx) => ({
    ...item,
    new_rank:    idx + 1,
    rank_change: item.original_rank - (idx + 1),  // positive = moved up
  }))
}

// ---------------------------------------------------------------------------
// DB: Fetch raw engagement events for an investor
// ---------------------------------------------------------------------------

interface EngagementRow {
  investor_id:   string | null
  event_type:    string | null   // 'surfaced','opened','replied','meeting','offer','deal'
  property_type: string | null
  zone_key:      string | null
  yield_pct:     number | null
  offer_price:   number | null
  budget:        number | null
}

export async function computeAndPersistInvestorIntelligence(
  investorId: string,
): Promise<InvestorProfile> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from('investor_engagement_events')
    .select('investor_id, event_type, property_type, zone_key, yield_pct, offer_price, budget')
    .eq('investor_id', investorId)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) throw new Error(`computeAndPersistInvestorIntelligence: ${error.message}`)

  const rows: EngagementRow[] = data ?? []

  // Aggregate counts
  const engData: InvestorEngagementData = {
    investor_id:    investorId,
    total_surfaced: rows.filter(r => r.event_type === 'surfaced').length,
    total_opened:   rows.filter(r => r.event_type === 'opened').length,
    total_replied:  rows.filter(r => r.event_type === 'replied').length,
    total_meetings: rows.filter(r => r.event_type === 'meeting').length,
    total_offers:   rows.filter(r => r.event_type === 'offer').length,
    total_deals:    rows.filter(r => r.event_type === 'deal').length,
  }

  const engScore = computeInvestorEngagementScore(engData)

  // Infer preferences from engagement events that resulted in action (replied/meeting/offer)
  const actionRows = rows.filter(r =>
    r.event_type === 'replied' || r.event_type === 'meeting' || r.event_type === 'offer' || r.event_type === 'deal',
  )

  // Top asset types (by action frequency)
  const typeCounts: Record<string, number> = {}
  for (const r of actionRows) {
    if (r.property_type) typeCounts[r.property_type] = (typeCounts[r.property_type] ?? 0) + 1
  }
  const preferred_asset_types = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([t]) => t)

  // Top zones (by action frequency)
  const zoneCounts: Record<string, number> = {}
  for (const r of actionRows) {
    if (r.zone_key) zoneCounts[r.zone_key] = (zoneCounts[r.zone_key] ?? 0) + 1
  }
  const preferred_zones = Object.entries(zoneCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([z]) => z)

  // Yield target — from properties they offered on
  const offerYields = rows
    .filter(r => (r.event_type === 'offer' || r.event_type === 'deal') && r.yield_pct != null)
    .map(r => r.yield_pct!)
  const inferred_yield_target = offerYields.length > 0
    ? parseFloat((offerYields.reduce((s, v) => s + v, 0) / offerYields.length).toFixed(2))
    : null

  // Risk tolerance — based on property type mix (luxury/commercial = higher risk tolerance)
  const highRiskTypes = ['commercial', 'industrial', 'development', 'land']
  const highRiskCount = actionRows.filter(r => r.property_type && highRiskTypes.includes(r.property_type)).length
  const inferred_risk_tolerance = actionRows.length > 0
    ? parseFloat((highRiskCount / actionRows.length).toFixed(3))
    : null

  // Budget adherence — ratio of offers within budget
  const offerRows = rows.filter(r => r.event_type === 'offer' && r.offer_price != null && r.budget != null)
  const withinBudget = offerRows.filter(r => r.offer_price! <= r.budget!)
  const budget_adherence = offerRows.length > 0
    ? parseFloat((withinBudget.length / offerRows.length).toFixed(4))
    : null

  const prefBase = { preferred_asset_types, preferred_zones, inferred_yield_target, inferred_risk_tolerance, budget_adherence }
  const fit_confidence = computeFitConfidence(prefBase)

  const preferences: InvestorPreferences = { ...prefBase, fit_confidence }
  const profile: InvestorProfile = { investor_id: investorId, engagement: engScore, preferences }

  // Persist to investor_intelligence
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: upsertError } = await (supabaseAdmin as any)
    .from('investor_intelligence')
    .upsert({
      investor_id:               investorId,
      total_surfaced:            engData.total_surfaced,
      total_opened:              engData.total_opened,
      total_replied:             engData.total_replied,
      total_meetings:            engData.total_meetings,
      total_offers:              engData.total_offers,
      total_deals:               engData.total_deals,
      open_rate:                 engScore.open_rate,
      reply_rate:                engScore.reply_rate,
      meeting_rate:              engScore.meeting_rate,
      conversion_rate:           engScore.conversion_rate,
      preferred_asset_types,
      preferred_zones,
      inferred_yield_target,
      inferred_risk_tolerance,
      budget_adherence,
      engagement_score:          engScore.total,
      fit_confidence,
      last_computed_at:          new Date().toISOString(),
      updated_at:                new Date().toISOString(),
    }, { onConflict: 'investor_id' })

  if (upsertError) throw new Error(`persistInvestorIntelligence: ${upsertError.message}`)

  return profile
}

// ---------------------------------------------------------------------------
// DB: Batch update all investors with recent engagement activity
// ---------------------------------------------------------------------------

export async function batchUpdateAllInvestorIntelligence(
  since?: Date,
): Promise<{ computed: number; errors: string[] }> {
  const sinceDate = since ?? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)

  // Get distinct investors with recent engagement activity
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: investorRows, error } = await (supabaseAdmin as any)
    .from('investor_engagement_events')
    .select('investor_id')
    .gte('created_at', sinceDate.toISOString())
    .not('investor_id', 'is', null)

  if (error) return { computed: 0, errors: [error.message] }

  const uniqueIds: string[] = [...new Set<string>((investorRows ?? []).map((r: { investor_id: string }) => r.investor_id as string))]

  let computed = 0
  const errors: string[] = []

  for (const investorId of uniqueIds) {
    try {
      await computeAndPersistInvestorIntelligence(investorId)
      computed++
    } catch (err) {
      errors.push(`${investorId}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return { computed, errors }
}
