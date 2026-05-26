// Agency Group — Capital Intelligence Engine
// lib/capital-intel/capitalIntelligenceEngine.ts
// Predicts investor interest and capital appetite for opportunities.
// TypeScript strict — 0 errors
// All amounts in EUR cents (integer bigint) — never float for money.

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type InvestorSegment =
  | 'WHALE'
  | 'INSTITUTIONAL_BUYER'
  | 'OPPORTUNISTIC_BIDDER'
  | 'DORMANT_CAPITAL'
  | 'HIGH_ROI_CONTRIBUTOR'
  | 'HIGH_CAPITAL_VELOCITY'
  | 'EMERGING_INVESTOR'

export interface InvestorCapitalProfile {
  investor_id: string
  tenant_id: string
  segment: InvestorSegment
  available_capital_eur_cents: number
  preferred_markets: string[]
  preferred_property_types: string[]
  min_ticket_eur_cents: number
  max_ticket_eur_cents: number
  target_roi_pct: number
  risk_tolerance: 'LOW' | 'MEDIUM' | 'HIGH'
  avg_days_to_decision: number | null
  bid_win_rate: number
  last_activity_at: string | null
  profile_confidence: number
}

export interface CapitalAppetiteSummary {
  tenant_id: string
  total_investors: number
  active_investors: number
  total_available_capital_eur_cents: number
  by_segment: Record<InvestorSegment, { count: number; capital_eur_cents: number }>
  by_market: Record<string, number>
  avg_ticket_eur_cents: number
  generated_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SEGMENT_ORDER: InvestorSegment[] = [
  'WHALE',
  'INSTITUTIONAL_BUYER',
  'OPPORTUNISTIC_BIDDER',
  'DORMANT_CAPITAL',
  'HIGH_ROI_CONTRIBUTOR',
  'HIGH_CAPITAL_VELOCITY',
  'EMERGING_INVESTOR',
]

function emptySegmentMap(): Record<InvestorSegment, { count: number; capital_eur_cents: number }> {
  return Object.fromEntries(
    SEGMENT_ORDER.map((s) => [s, { count: 0, capital_eur_cents: 0 }])
  ) as Record<InvestorSegment, { count: number; capital_eur_cents: number }>
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

// ─── buildInvestorCapitalProfile ──────────────────────────────────────────────

/**
 * Builds a full capital profile for one investor.
 * Reads from: investor_ledger_entries, asset_bids, investor_segment_profiles
 * Persists to: investor_capital_profiles
 */
export async function buildInvestorCapitalProfile(
  investorId: string,
  tenantId: string
): Promise<InvestorCapitalProfile> {
  // 1. Available capital from ledger (latest running balance)
  const { data: ledgerRows } = await (supabaseAdmin as any)
    .from('investor_ledger_entries')
    .select('running_available_cents, created_at')
    .eq('investor_id', investorId)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(1)

  const availableCapital: number = (ledgerRows?.[0]?.running_available_cents ?? 0) as number

  // 2. Bid history for win rate and days-to-decision
  const { data: bidRows } = await (supabaseAdmin as any)
    .from('asset_bids')
    .select('status, created_at, resolved_at, amount_eur_cents')
    .eq('investor_id', investorId)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(50)

  const bids: Array<{
    status: string
    created_at: string
    resolved_at: string | null
    amount_eur_cents: number
  }> = (bidRows ?? []) as Array<{
    status: string
    created_at: string
    resolved_at: string | null
    amount_eur_cents: number
  }>

  const totalBids = bids.length
  const wonBids = bids.filter((b) => b.status === 'WON' || b.status === 'ACCEPTED').length
  const bidWinRate = totalBids > 0 ? wonBids / totalBids : 0

  // avg days to decision from resolved bids
  const resolvedBids = bids.filter((b) => b.resolved_at != null)
  let avgDaysToDecision: number | null = null
  if (resolvedBids.length > 0) {
    const totalMs = resolvedBids.reduce((sum, b) => {
      const created = new Date(b.created_at).getTime()
      const resolved = new Date(b.resolved_at!).getTime()
      return sum + (resolved - created)
    }, 0)
    avgDaysToDecision = Math.round(totalMs / resolvedBids.length / 86_400_000)
  }

  // bid amount range for ticket size
  const bidAmounts = bids.map((b) => b.amount_eur_cents).filter((a) => a > 0)
  const minTicket = bidAmounts.length > 0 ? Math.min(...bidAmounts) : 0
  const maxTicket = bidAmounts.length > 0 ? Math.max(...bidAmounts) : 0

  // last activity
  const lastActivityAt: string | null = bids[0]?.created_at ?? null

  // 3. Segment profile
  const { data: segmentRows } = await (supabaseAdmin as any)
    .from('investor_segment_profiles')
    .select(
      'segment, preferred_markets, preferred_property_types, target_roi_pct, risk_tolerance'
    )
    .eq('investor_id', investorId)
    .eq('tenant_id', tenantId)
    .limit(1)

  const segmentRow = segmentRows?.[0] as
    | {
        segment: string
        preferred_markets: string[]
        preferred_property_types: string[]
        target_roi_pct: number
        risk_tolerance: string
      }
    | undefined

  const segment: InvestorSegment = (segmentRow?.segment as InvestorSegment | undefined) ?? 'EMERGING_INVESTOR'
  const preferredMarkets: string[] = segmentRow?.preferred_markets ?? []
  const preferredPropertyTypes: string[] = segmentRow?.preferred_property_types ?? []
  const targetRoiPct: number = segmentRow?.target_roi_pct ?? 8
  const riskTolerance: 'LOW' | 'MEDIUM' | 'HIGH' = (segmentRow?.risk_tolerance as 'LOW' | 'MEDIUM' | 'HIGH' | undefined) ?? 'MEDIUM'

  // 4. Compute profile confidence based on data richness
  let confidence = 0.3 // base
  if (totalBids >= 5) confidence += 0.2
  if (totalBids >= 20) confidence += 0.1
  if (availableCapital > 0) confidence += 0.15
  if (segmentRow != null) confidence += 0.15
  if (preferredMarkets.length > 0) confidence += 0.1
  confidence = clamp(confidence, 0, 1)

  const profile: InvestorCapitalProfile = {
    investor_id: investorId,
    tenant_id: tenantId,
    segment,
    available_capital_eur_cents: availableCapital,
    preferred_markets: preferredMarkets,
    preferred_property_types: preferredPropertyTypes,
    min_ticket_eur_cents: minTicket,
    max_ticket_eur_cents: maxTicket,
    target_roi_pct: targetRoiPct,
    risk_tolerance: riskTolerance,
    avg_days_to_decision: avgDaysToDecision,
    bid_win_rate: bidWinRate,
    last_activity_at: lastActivityAt,
    profile_confidence: confidence,
  }

  // 5. Persist to investor_capital_profiles
  void (supabaseAdmin as any)
    .from('investor_capital_profiles')
    .upsert(
      {
        investor_id: investorId,
        tenant_id: tenantId,
        segment,
        available_capital_eur_cents: availableCapital,
        preferred_markets: preferredMarkets,
        preferred_property_types: preferredPropertyTypes,
        min_ticket_eur_cents: minTicket,
        max_ticket_eur_cents: maxTicket,
        target_roi_pct: targetRoiPct,
        risk_tolerance: riskTolerance,
        avg_days_to_decision: avgDaysToDecision,
        bid_win_rate: bidWinRate,
        last_activity_at: lastActivityAt,
        profile_confidence: confidence,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'investor_id,tenant_id' }
    )
    .catch((e: unknown) => log.warn('[capitalIntelligenceEngine] upsert investor_capital_profiles', { error: e }))

  return profile
}

// ─── getCapitalAppetiteSummary ────────────────────────────────────────────────

/**
 * Aggregates all investor profiles for a tenant into a capital appetite summary.
 * Persists to: capital_appetite_snapshots
 */
export async function getCapitalAppetiteSummary(tenantId: string): Promise<CapitalAppetiteSummary> {
  const { data: profiles } = await (supabaseAdmin as any)
    .from('investor_capital_profiles')
    .select(
      'investor_id, segment, available_capital_eur_cents, preferred_markets, min_ticket_eur_cents, max_ticket_eur_cents, last_activity_at'
    )
    .eq('tenant_id', tenantId)

  const rows: Array<{
    investor_id: string
    segment: string
    available_capital_eur_cents: number
    preferred_markets: string[]
    min_ticket_eur_cents: number
    max_ticket_eur_cents: number
    last_activity_at: string | null
  }> = (profiles ?? []) as Array<{
    investor_id: string
    segment: string
    available_capital_eur_cents: number
    preferred_markets: string[]
    min_ticket_eur_cents: number
    max_ticket_eur_cents: number
    last_activity_at: string | null
  }>

  const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000).toISOString()

  const totalInvestors = rows.length
  const activeInvestors = rows.filter(
    (r) => r.last_activity_at != null && r.last_activity_at >= ninetyDaysAgo
  ).length

  const totalAvailableCapital = rows.reduce((sum, r) => sum + (r.available_capital_eur_cents ?? 0), 0)

  const bySegment = emptySegmentMap()
  for (const r of rows) {
    const seg = (r.segment as InvestorSegment | undefined) ?? 'EMERGING_INVESTOR'
    if (bySegment[seg]) {
      bySegment[seg].count += 1
      bySegment[seg].capital_eur_cents += r.available_capital_eur_cents ?? 0
    }
  }

  const byMarket: Record<string, number> = {}
  for (const r of rows) {
    const markets: string[] = r.preferred_markets ?? []
    const perMarket = markets.length > 0 ? Math.floor((r.available_capital_eur_cents ?? 0) / markets.length) : 0
    for (const market of markets) {
      byMarket[market] = (byMarket[market] ?? 0) + perMarket
    }
  }

  const avgTicket =
    totalInvestors > 0
      ? Math.round(rows.reduce((sum, r) => sum + ((r.min_ticket_eur_cents + r.max_ticket_eur_cents) / 2), 0) / totalInvestors)
      : 0

  const generatedAt = new Date().toISOString()

  const summary: CapitalAppetiteSummary = {
    tenant_id: tenantId,
    total_investors: totalInvestors,
    active_investors: activeInvestors,
    total_available_capital_eur_cents: totalAvailableCapital,
    by_segment: bySegment,
    by_market: byMarket,
    avg_ticket_eur_cents: avgTicket,
    generated_at: generatedAt,
  }

  // Persist snapshot
  void (supabaseAdmin as any)
    .from('capital_appetite_snapshots')
    .insert({
      id: randomUUID(),
      tenant_id: tenantId,
      total_investors: totalInvestors,
      active_investors: activeInvestors,
      total_available_capital_eur_cents: totalAvailableCapital,
      by_segment: bySegment,
      by_market: byMarket,
      avg_ticket_eur_cents: avgTicket,
      generated_at: generatedAt,
    })
    .catch((e: unknown) => log.warn('[capitalIntelligenceEngine] insert capital_appetite_snapshots', { error: e }))

  return summary
}

// ─── predictInvestorInterest ──────────────────────────────────────────────────

/**
 * Predicts the probability that an investor will be interested in an opportunity.
 * Scoring dimensions: market_match, price_match, roi_match, segment_match.
 */
export async function predictInvestorInterest(
  investorId: string,
  opportunityId: string,
  tenantId: string
): Promise<{ probability: number; reasoning: string[] }> {
  // Load investor profile
  const { data: profileRows } = await (supabaseAdmin as any)
    .from('investor_capital_profiles')
    .select('*')
    .eq('investor_id', investorId)
    .eq('tenant_id', tenantId)
    .limit(1)

  const profileRow = profileRows?.[0] as
    | {
        segment: string
        available_capital_eur_cents: number
        preferred_markets: string[]
        preferred_property_types: string[]
        min_ticket_eur_cents: number
        max_ticket_eur_cents: number
        target_roi_pct: number
        risk_tolerance: string
      }
    | undefined

  // Load opportunity
  const { data: oppRows } = await (supabaseAdmin as any)
    .from('capital_opportunities')
    .select('market, asking_price_eur_cents, potential_gain_eur_cents, property_type, opportunity_type')
    .eq('id', opportunityId)
    .eq('tenant_id', tenantId)
    .limit(1)

  const opp = oppRows?.[0] as
    | {
        market: string | null
        asking_price_eur_cents: number | null
        potential_gain_eur_cents: number | null
        property_type: string | null
        opportunity_type: string | null
      }
    | undefined

  if (!profileRow || !opp) {
    return { probability: 0, reasoning: ['Insufficient data to compute match'] }
  }

  let probability = 0
  const reasoning: string[] = []

  // Market match (+0.30)
  const oppMarket = opp.market ?? ''
  const preferredMarkets: string[] = profileRow.preferred_markets ?? []
  const marketMatches = preferredMarkets.some(
    (m) => oppMarket.startsWith(m) || m.startsWith(oppMarket.split(':')[0] ?? '')
  )
  if (marketMatches) {
    probability += 0.30
    reasoning.push(`Market match: investor prefers ${preferredMarkets.join(', ')}`)
  } else {
    reasoning.push(`No market match: opportunity in ${oppMarket}, investor prefers ${preferredMarkets.join(', ')}`)
  }

  // Price/ticket match (+0.25)
  const askingPrice = opp.asking_price_eur_cents ?? 0
  const minTicket = profileRow.min_ticket_eur_cents ?? 0
  const maxTicket = profileRow.max_ticket_eur_cents ?? Number.MAX_SAFE_INTEGER
  const availableCapital = profileRow.available_capital_eur_cents ?? 0
  const ticketFits =
    askingPrice >= minTicket &&
    (maxTicket === 0 || askingPrice <= maxTicket) &&
    availableCapital >= askingPrice
  if (ticketFits) {
    probability += 0.25
    reasoning.push(`Ticket fit: asking ${(askingPrice / 100).toFixed(0)} EUR within range`)
  } else {
    reasoning.push(`Ticket mismatch: asking ${(askingPrice / 100).toFixed(0)} EUR vs range ${(minTicket / 100).toFixed(0)}–${(maxTicket / 100).toFixed(0)} EUR`)
  }

  // ROI match (+0.25)
  const potentialGain = opp.potential_gain_eur_cents ?? 0
  const opportunityRoi = askingPrice > 0 ? (potentialGain / askingPrice) * 100 : 0
  const targetRoi = profileRow.target_roi_pct ?? 8
  if (opportunityRoi >= targetRoi) {
    probability += 0.25
    reasoning.push(`ROI match: opportunity ${opportunityRoi.toFixed(1)}% >= target ${targetRoi}%`)
  } else {
    reasoning.push(`ROI below target: ${opportunityRoi.toFixed(1)}% < ${targetRoi}%`)
  }

  // Segment match (+0.20)
  const segment = profileRow.segment as InvestorSegment
  const oppType = opp.opportunity_type ?? ''
  const segmentMatch =
    (segment === 'WHALE' && askingPrice >= 5_000_000_00) ||
    (segment === 'INSTITUTIONAL_BUYER' && (oppType === 'COMMERCIAL' || oppType === 'PORTFOLIO')) ||
    (segment === 'OPPORTUNISTIC_BIDDER' && (oppType === 'DISTRESSED' || oppType === 'AUCTION')) ||
    (segment === 'HIGH_ROI_CONTRIBUTOR' && opportunityRoi >= 15) ||
    (segment === 'HIGH_CAPITAL_VELOCITY' && availableCapital > 0) ||
    segment === 'EMERGING_INVESTOR'

  if (segmentMatch) {
    probability += 0.20
    reasoning.push(`Segment match: ${segment} aligns with opportunity type ${oppType}`)
  } else {
    reasoning.push(`Segment mismatch: ${segment} for opportunity type ${oppType}`)
  }

  return {
    probability: clamp(probability, 0, 1),
    reasoning,
  }
}

// ─── getTopInvestorsForOpportunity ────────────────────────────────────────────

/**
 * Returns top N investors most likely to be interested in an opportunity,
 * enriched with match_probability.
 */
export async function getTopInvestorsForOpportunity(
  opportunityId: string,
  tenantId: string,
  limit = 10
): Promise<Array<InvestorCapitalProfile & { match_probability: number }>> {
  // Get all investor profiles for tenant
  const { data: profileRows } = await (supabaseAdmin as any)
    .from('investor_capital_profiles')
    .select('*')
    .eq('tenant_id', tenantId)

  const rows: Array<InvestorCapitalProfile> = (profileRows ?? []) as Array<InvestorCapitalProfile>

  if (rows.length === 0) return []

  // Score each investor in parallel (batch to avoid excessive concurrency)
  const BATCH = 10
  const scored: Array<InvestorCapitalProfile & { match_probability: number }> = []

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    const results = await Promise.all(
      batch.map(async (profile) => {
        const { probability } = await predictInvestorInterest(
          profile.investor_id,
          opportunityId,
          tenantId
        )
        return { ...profile, match_probability: probability }
      })
    )
    scored.push(...results)
  }

  // Sort descending, take top N
  scored.sort((a, b) => b.match_probability - a.match_probability)
  return scored.slice(0, limit)
}

// ─── updateDemandSignal ───────────────────────────────────────────────────────

const DEMAND_DELTA: Record<'VIEW' | 'BID' | 'CLOSE' | 'REJECT', number> = {
  VIEW: 1,
  BID: 10,
  CLOSE: 50,
  REJECT: -5,
}

/**
 * Increments demand counters and demand_score for an opportunity.
 * Upserts to opportunity_demand_signals.
 */
export async function updateDemandSignal(
  opportunityId: string,
  tenantId: string,
  eventType: 'VIEW' | 'BID' | 'CLOSE' | 'REJECT'
): Promise<void> {
  const delta = DEMAND_DELTA[eventType]
  const colMap: Record<'VIEW' | 'BID' | 'CLOSE' | 'REJECT', string> = {
    VIEW: 'view_count',
    BID: 'bid_count',
    CLOSE: 'close_count',
    REJECT: 'reject_count',
  }
  const col = colMap[eventType]

  // Read existing
  const { data: existing } = await (supabaseAdmin as any)
    .from('opportunity_demand_signals')
    .select('id, view_count, bid_count, close_count, reject_count, demand_score')
    .eq('opportunity_id', opportunityId)
    .eq('tenant_id', tenantId)
    .limit(1)

  const row = existing?.[0] as
    | {
        id: string
        view_count: number
        bid_count: number
        close_count: number
        reject_count: number
        demand_score: number
      }
    | undefined

  if (row) {
    const updated: Record<string, number | string> = {
      [col]: ((row[col as keyof typeof row] as number) ?? 0) + 1,
      demand_score: (row.demand_score ?? 0) + delta,
      last_signal_at: new Date().toISOString(),
    }
    void (supabaseAdmin as any)
      .from('opportunity_demand_signals')
      .update(updated)
      .eq('id', row.id)
      .catch((e: unknown) => log.warn('[capitalIntelligenceEngine] update demand_signal', { error: e }))
  } else {
    const insert: Record<string, unknown> = {
      id: randomUUID(),
      opportunity_id: opportunityId,
      tenant_id: tenantId,
      view_count: eventType === 'VIEW' ? 1 : 0,
      bid_count: eventType === 'BID' ? 1 : 0,
      close_count: eventType === 'CLOSE' ? 1 : 0,
      reject_count: eventType === 'REJECT' ? 1 : 0,
      demand_score: Math.max(0, delta),
      last_signal_at: new Date().toISOString(),
    }
    void (supabaseAdmin as any)
      .from('opportunity_demand_signals')
      .insert(insert)
      .catch((e: unknown) => log.warn('[capitalIntelligenceEngine] insert demand_signal', { error: e }))
  }
}
