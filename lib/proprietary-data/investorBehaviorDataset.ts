// Agency Group — Investor Behavior Proprietary Dataset
// lib/proprietary-data/investorBehaviorDataset.ts
// Proprietary investor behavior analytics — who buys what, when, at what price.
// TypeScript strict — 0 errors

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InvestorBehaviorProfile {
  profile_id: string
  tenant_id: string
  investor_id: string

  // Behavioral patterns
  avg_time_to_decision_days: number | null
  preferred_opportunity_types: string[]   // ranked by bid count
  preferred_markets: string[]             // ranked by bid count
  preferred_price_bands: string[]

  // Performance
  total_opportunities_viewed: number
  total_bids_placed: number
  total_deals_closed: number
  bid_to_view_ratio: number               // bids / views
  close_to_bid_ratio: number              // closes / bids
  avg_bid_vs_asking_pct: number           // bid / asking * 100

  // Capital behavior
  avg_deal_size_eur_cents: number | null
  total_capital_deployed_eur_cents: number
  avg_roi_realized_pct: number | null

  // Segments
  is_price_sensitive: boolean             // typically bids < 95% of asking
  is_speed_buyer: boolean                 // closes in < 30 days avg
  is_distressed_specialist: boolean       // > 50% of bids on distressed assets

  computed_at: string
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function rankByFrequency(items: string[]): string[] {
  const freq = new Map<string, number>()
  for (const item of items) {
    freq.set(item, (freq.get(item) ?? 0) + 1)
  }
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([item]) => item)
}

// ─── computeInvestorBehaviorProfile ──────────────────────────────────────────

/**
 * Reads `asset_interaction_events` (views, bids), `feedback_signals`,
 * `real_outcomes`, `opportunity_investor_matches`.
 * Persists to `investor_behavior_profiles`.
 * Source: Observed (interaction events) + Inferred (derived ratios).
 */
export async function computeInvestorBehaviorProfile(
  investorId: string,
  tenantId: string,
): Promise<InvestorBehaviorProfile> {
  // Fetch all interaction events for this investor
  const { data: interactions, error: interErr } = await (supabaseAdmin as any)
    .from('asset_interaction_events')
    .select('event_type, opportunity_type, market, price_band, bid_amount_eur_cents, asking_price_eur_cents, is_distressed, created_at')
    .eq('investor_id', investorId)
    .eq('tenant_id', tenantId)

  if (interErr) {
    log.warn('[investorBehaviorDataset] interactions fetch error', { investorId, error: interErr.message })
  }

  // Fetch feedback signals (bids, closes)
  const { data: signals, error: sigErr } = await (supabaseAdmin as any)
    .from('feedback_signals')
    .select('signal_type, market, opportunity_type, price_band, is_distressed, created_at, decision_time_hours')
    .eq('investor_id', investorId)
    .eq('tenant_id', tenantId)

  if (sigErr) {
    log.warn('[investorBehaviorDataset] feedback_signals fetch error', { investorId, error: sigErr.message })
  }

  // Fetch real outcomes (closed deals)
  const { data: outcomes, error: outcomeErr } = await (supabaseAdmin as any)
    .from('real_outcomes')
    .select('final_price_eur_cents, days_total_listing_to_close, roi_realized_pct')
    .eq('investor_id', investorId)
    .eq('tenant_id', tenantId)

  if (outcomeErr) {
    log.warn('[investorBehaviorDataset] real_outcomes fetch error', { investorId, error: outcomeErr.message })
  }

  // Fetch opportunity_investor_matches
  const { data: matches, error: matchErr } = await (supabaseAdmin as any)
    .from('opportunity_investor_matches')
    .select('opportunity_type, market, price_band, is_distressed')
    .eq('investor_id', investorId)
    .eq('tenant_id', tenantId)

  if (matchErr) {
    log.warn('[investorBehaviorDataset] matches fetch error', { investorId, error: matchErr.message })
  }

  type InteractionEvent = {
    event_type: string
    opportunity_type?: string
    market?: string
    price_band?: string
    bid_amount_eur_cents?: number
    asking_price_eur_cents?: number
    is_distressed?: boolean
    created_at?: string
  }

  type FeedbackSignal = {
    signal_type: string
    market?: string
    opportunity_type?: string
    price_band?: string
    is_distressed?: boolean
    created_at?: string
    decision_time_hours?: number
  }

  type RealOutcome = {
    final_price_eur_cents?: number
    days_total_listing_to_close?: number
    roi_realized_pct?: number
  }

  type OpportunityMatch = {
    opportunity_type?: string
    market?: string
    price_band?: string
    is_distressed?: boolean
  }

  const allInteractions: InteractionEvent[] = interactions ?? []
  const allSignals: FeedbackSignal[] = signals ?? []
  const allOutcomes: RealOutcome[] = outcomes ?? []
  const allMatches: OpportunityMatch[] = matches ?? []

  // Views
  const views = allInteractions.filter((e: InteractionEvent) => e.event_type === 'VIEW')
  const bidInteractions = allInteractions.filter((e: InteractionEvent) => e.event_type === 'BID')
  const bidSignals = allSignals.filter((s: FeedbackSignal) => s.signal_type === 'BID_SUBMITTED')
  const closeSignals = allSignals.filter((s: FeedbackSignal) => s.signal_type === 'DEAL_CLOSED')

  const totalViews = views.length
  const totalBids = bidInteractions.length + bidSignals.length
  const totalCloses = closeSignals.length + allOutcomes.length

  // Preferred types/markets/bands — merge from bid interactions + matches
  const bidOpportunityTypes = [
    ...bidInteractions.map((e: InteractionEvent) => e.opportunity_type ?? '').filter(Boolean),
    ...bidSignals.map((s: FeedbackSignal) => s.opportunity_type ?? '').filter(Boolean),
    ...allMatches.map((m: OpportunityMatch) => m.opportunity_type ?? '').filter(Boolean),
  ]

  const bidMarkets = [
    ...bidInteractions.map((e: InteractionEvent) => e.market ?? '').filter(Boolean),
    ...bidSignals.map((s: FeedbackSignal) => s.market ?? '').filter(Boolean),
    ...allMatches.map((m: OpportunityMatch) => m.market ?? '').filter(Boolean),
  ]

  const bidPriceBands = [
    ...bidInteractions.map((e: InteractionEvent) => e.price_band ?? '').filter(Boolean),
    ...bidSignals.map((s: FeedbackSignal) => s.price_band ?? '').filter(Boolean),
    ...allMatches.map((m: OpportunityMatch) => m.price_band ?? '').filter(Boolean),
  ]

  // Decision time (observed, in hours → days)
  const decisionTimes = allSignals
    .filter((s: FeedbackSignal) => typeof s.decision_time_hours === 'number')
    .map((s: FeedbackSignal) => (s.decision_time_hours ?? 0) / 24)

  const avgDecisionDays = decisionTimes.length > 0
    ? decisionTimes.reduce((sum: number, d: number) => sum + d, 0) / decisionTimes.length
    : null

  // Bid vs asking (observed data)
  const bidRatios = bidInteractions
    .filter((e: InteractionEvent) => typeof e.bid_amount_eur_cents === 'number' && (e.asking_price_eur_cents ?? 0) > 0)
    .map((e: InteractionEvent) => ((e.bid_amount_eur_cents ?? 0) / (e.asking_price_eur_cents ?? 1)) * 100)

  const avgBidVsAsking = bidRatios.length > 0
    ? bidRatios.reduce((s: number, r: number) => s + r, 0) / bidRatios.length
    : 100

  // Capital behavior (observed)
  const closedPrices = allOutcomes
    .filter((o: RealOutcome) => typeof o.final_price_eur_cents === 'number')
    .map((o: RealOutcome) => o.final_price_eur_cents ?? 0)

  const totalDeployed = closedPrices.reduce((s: number, p: number) => s + p, 0)
  const avgDealSize = closedPrices.length > 0 ? Math.round(totalDeployed / closedPrices.length) : null

  const rois = allOutcomes
    .filter((o: RealOutcome) => typeof o.roi_realized_pct === 'number')
    .map((o: RealOutcome) => o.roi_realized_pct ?? 0)

  const avgRoi = rois.length > 0
    ? rois.reduce((s: number, r: number) => s + r, 0) / rois.length
    : null

  // Avg close time (inferred from outcomes)
  const closeDays = allOutcomes
    .filter((o: RealOutcome) => typeof o.days_total_listing_to_close === 'number')
    .map((o: RealOutcome) => o.days_total_listing_to_close ?? 0)

  const avgCloseDays = closeDays.length > 0
    ? closeDays.reduce((s: number, d: number) => s + d, 0) / closeDays.length
    : null

  // Distressed bids
  const distressedBidCount = [
    ...bidInteractions.filter((e: InteractionEvent) => e.is_distressed === true),
    ...bidSignals.filter((s: FeedbackSignal) => s.is_distressed === true),
    ...allMatches.filter((m: OpportunityMatch) => m.is_distressed === true),
  ].length

  // Segments (inferred from behavioral data)
  const isPriceSensitive = avgBidVsAsking < 95
  const isSpeedBuyer = avgCloseDays !== null && avgCloseDays < 30
  const isDistressedSpecialist = totalBids > 0 && (distressedBidCount / Math.max(totalBids, 1)) > 0.5

  const profile_id = randomUUID()
  const computedAt = new Date().toISOString()

  const profile: InvestorBehaviorProfile = {
    profile_id,
    tenant_id: tenantId,
    investor_id: investorId,
    avg_time_to_decision_days: avgDecisionDays,
    preferred_opportunity_types: rankByFrequency(bidOpportunityTypes).slice(0, 5),
    preferred_markets: rankByFrequency(bidMarkets).slice(0, 5),
    preferred_price_bands: rankByFrequency(bidPriceBands).slice(0, 3),
    total_opportunities_viewed: totalViews,
    total_bids_placed: totalBids,
    total_deals_closed: totalCloses,
    bid_to_view_ratio: totalViews > 0 ? totalBids / totalViews : 0,
    close_to_bid_ratio: totalBids > 0 ? totalCloses / totalBids : 0,
    avg_bid_vs_asking_pct: avgBidVsAsking,
    avg_deal_size_eur_cents: avgDealSize,
    total_capital_deployed_eur_cents: totalDeployed,
    avg_roi_realized_pct: avgRoi,
    is_price_sensitive: isPriceSensitive,
    is_speed_buyer: isSpeedBuyer,
    is_distressed_specialist: isDistressedSpecialist,
    computed_at: computedAt,
  }

  // Persist / upsert
  const row = {
    profile_id,
    tenant_id: tenantId,
    investor_id: investorId,
    avg_time_to_decision_days: avgDecisionDays != null ? Math.round(avgDecisionDays) : null,
    preferred_opportunity_types: profile.preferred_opportunity_types,
    preferred_markets: profile.preferred_markets,
    preferred_price_bands: profile.preferred_price_bands,
    total_opportunities_viewed: totalViews,
    total_bids_placed: totalBids,
    total_deals_closed: totalCloses,
    bid_to_view_ratio: profile.bid_to_view_ratio,
    close_to_bid_ratio: profile.close_to_bid_ratio,
    avg_bid_vs_asking_pct: avgBidVsAsking,
    avg_deal_size_eur_cents: avgDealSize,
    total_capital_deployed_eur_cents: totalDeployed,
    avg_roi_realized_pct: avgRoi,
    is_price_sensitive: isPriceSensitive,
    is_speed_buyer: isSpeedBuyer,
    is_distressed_specialist: isDistressedSpecialist,
    computed_at: computedAt,
  }

  const { error: upsertErr } = await (supabaseAdmin as any)
    .from('investor_behavior_profiles')
    .upsert(row, { onConflict: 'investor_id' })

  if (upsertErr) {
    log.error('[investorBehaviorDataset] upsert error', new Error(upsertErr.message), { investorId })
    throw new Error(`computeInvestorBehaviorProfile: ${upsertErr.message}`)
  }

  log.info('[investorBehaviorDataset] profile computed', { investorId, totalBids, totalCloses })
  return profile
}

// ─── runBehaviorDatasetUpdate ─────────────────────────────────────────────────

/**
 * Runs computeInvestorBehaviorProfile for all investors with recent activity (last 90 days).
 */
export async function runBehaviorDatasetUpdate(
  tenantId: string,
): Promise<{ updated: number }> {
  const since = new Date()
  since.setDate(since.getDate() - 90)
  const sinceIso = since.toISOString()

  // Get distinct investor IDs with recent activity
  const { data: recentSignals, error } = await (supabaseAdmin as any)
    .from('feedback_signals')
    .select('investor_id')
    .eq('tenant_id', tenantId)
    .gte('created_at', sinceIso)

  if (error) {
    log.error('[investorBehaviorDataset] runUpdate fetch error', new Error(error.message), { tenantId })
    throw new Error(`runBehaviorDatasetUpdate: ${error.message}`)
  }

  type SignalRow = { investor_id?: string }
  const investorIds = Array.from(
    new Set(
      ((recentSignals ?? []) as SignalRow[])
        .map((r: SignalRow) => r.investor_id)
        .filter((id: string | undefined): id is string => typeof id === 'string' && id.length > 0),
    ),
  )

  if (investorIds.length === 0) return { updated: 0 }

  let updated = 0
  for (const investorId of investorIds) {
    try {
      await computeInvestorBehaviorProfile(investorId, tenantId)
      updated++
    } catch (e) {
      log.warn('[investorBehaviorDataset] profile update failed', { investorId, error: String(e) })
    }
  }

  log.info('[investorBehaviorDataset] dataset updated', { tenantId, updated, total: investorIds.length })
  return { updated }
}

// ─── getBehaviorInsights ──────────────────────────────────────────────────────

/**
 * Aggregate stats across all investor behavior profiles for a tenant.
 * Source: inferred from stored profiles.
 */
export async function getBehaviorInsights(tenantId: string): Promise<{
  total_profiles: number
  price_sensitive_pct: number
  speed_buyers_pct: number
  distressed_specialists_pct: number
  avg_time_to_decision: number | null
}> {
  const { data, error } = await (supabaseAdmin as any)
    .from('investor_behavior_profiles')
    .select('is_price_sensitive, is_speed_buyer, is_distressed_specialist, avg_time_to_decision_days')
    .eq('tenant_id', tenantId)

  if (error) {
    log.error('[investorBehaviorDataset] insights fetch error', new Error(error.message), { tenantId })
    throw new Error(`getBehaviorInsights: ${error.message}`)
  }

  type ProfileRow = {
    is_price_sensitive: boolean
    is_speed_buyer: boolean
    is_distressed_specialist: boolean
    avg_time_to_decision_days?: number | null
  }

  const profiles: ProfileRow[] = data ?? []
  const total = profiles.length

  if (total === 0) {
    return {
      total_profiles: 0,
      price_sensitive_pct: 0,
      speed_buyers_pct: 0,
      distressed_specialists_pct: 0,
      avg_time_to_decision: null,
    }
  }

  const priceSensitiveCount = profiles.filter((p: ProfileRow) => p.is_price_sensitive).length
  const speedBuyerCount = profiles.filter((p: ProfileRow) => p.is_speed_buyer).length
  const distressedSpecCount = profiles.filter((p: ProfileRow) => p.is_distressed_specialist).length

  const decisionTimes = profiles
    .filter((p: ProfileRow) => typeof p.avg_time_to_decision_days === 'number' && p.avg_time_to_decision_days !== null)
    .map((p: ProfileRow) => p.avg_time_to_decision_days as number)

  const avgDecision = decisionTimes.length > 0
    ? decisionTimes.reduce((s: number, d: number) => s + d, 0) / decisionTimes.length
    : null

  return {
    total_profiles: total,
    price_sensitive_pct: (priceSensitiveCount / total) * 100,
    speed_buyers_pct: (speedBuyerCount / total) * 100,
    distressed_specialists_pct: (distressedSpecCount / total) * 100,
    avg_time_to_decision: avgDecision,
  }
}
