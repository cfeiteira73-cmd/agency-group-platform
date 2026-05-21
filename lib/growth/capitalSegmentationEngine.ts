// Agency Group — Capital-Aware Segmentation Engine
// lib/growth/capitalSegmentationEngine.ts
// Replaces traditional CRM with economic reality segmentation.
// Segments are computed from REAL capital behavior, not demographics.
// TypeScript strict — 0 errors

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type InvestorSegment =
  | 'HIGH_CAPITAL_VELOCITY'
  | 'INSTITUTIONAL_BUYER'
  | 'OPPORTUNISTIC_BIDDER'
  | 'DORMANT_CAPITAL'
  | 'HIGH_ROI_CONTRIBUTOR'
  | 'EMERGING_INVESTOR'
  | 'WHALE'

export interface InvestorSegmentProfile {
  investor_id: string
  tenant_id: string
  segment: InvestorSegment
  capital_size_eur_cents: number
  liquidity_contribution_score: number
  bid_frequency_per_month: number
  conversion_rate_pct: number
  avg_roi_pct: number
  last_activity_at: string | null
  days_since_last_activity: number
  segment_confidence: number
  segment_history: string[]
  computed_at: string
}

export interface SegmentationReport {
  tenant_id: string
  generated_at: string
  total_investors: number
  segment_distribution: Record<InvestorSegment, number>
  high_value_count: number
  at_risk_count: number
  total_capital_by_segment: Record<InvestorSegment, number>
  insights: string[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ALL_SEGMENTS: InvestorSegment[] = [
  'HIGH_CAPITAL_VELOCITY',
  'INSTITUTIONAL_BUYER',
  'OPPORTUNISTIC_BIDDER',
  'DORMANT_CAPITAL',
  'HIGH_ROI_CONTRIBUTOR',
  'EMERGING_INVESTOR',
  'WHALE',
]

function daysSince(dateStr: string | null): number {
  if (!dateStr) return 999
  const diff = Date.now() - new Date(dateStr).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

// ─── computeInvestorSegment ───────────────────────────────────────────────────

/**
 * Reads from investor_ledger_entries, asset_bids, execution_outcomes.
 * Computes segment based on capital behavior and persists to investor_segment_profiles.
 */
export async function computeInvestorSegment(
  investorId: string,
  tenantId: string,
): Promise<InvestorSegmentProfile> {
  const now90d = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const now30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // 1. Capital size from ledger (last 90d)
  const ledgerRes = await (supabaseAdmin as any)
    .from('investor_ledger_entries')
    .select('amount_eur_cents, entry_type, created_at')
    .eq('tenant_id', tenantId)
    .eq('investor_id', investorId)
    .gte('created_at', now90d)

  const ledgerEntries: Array<{
    amount_eur_cents: number
    entry_type: string
    created_at: string
  }> = (ledgerRes.data ?? []) as Array<{
    amount_eur_cents: number
    entry_type: string
    created_at: string
  }>

  let capitalSizeEurCents = 0
  let lastLedgerActivity: string | null = null
  for (const entry of ledgerEntries) {
    if (entry.entry_type === 'DEPOSIT' || entry.entry_type === 'COMMITTED' || entry.entry_type === 'EXECUTED') {
      capitalSizeEurCents += entry.amount_eur_cents ?? 0
    }
    if (!lastLedgerActivity || entry.created_at > lastLedgerActivity) {
      lastLedgerActivity = entry.created_at
    }
  }

  // 2. Bid frequency & conversion rate (last 30d)
  const bidsRes = await (supabaseAdmin as any)
    .from('asset_bids')
    .select('status, submitted_at')
    .eq('tenant_id', tenantId)
    .eq('investor_id', investorId)
    .gte('submitted_at', now30d)

  const bids: Array<{ status: string; submitted_at: string }> = (bidsRes.data ?? []) as Array<{
    status: string
    submitted_at: string
  }>

  const bidFrequencyPerMonth = bids.length
  const acceptedBids = bids.filter(b => b.status === 'ACCEPTED' || b.status === 'accepted').length
  const conversionRatePct =
    bidFrequencyPerMonth > 0 ? (acceptedBids / bidFrequencyPerMonth) * 100 : 0

  let lastBidActivity: string | null = null
  for (const bid of bids) {
    if (!lastBidActivity || bid.submitted_at > lastBidActivity) {
      lastBidActivity = bid.submitted_at
    }
  }

  // 3. Average ROI from execution_outcomes
  const outcomesRes = await (supabaseAdmin as any)
    .from('execution_outcomes')
    .select('roi_pct')
    .eq('tenant_id', tenantId)
    .eq('investor_id', investorId)

  const outcomes: Array<{ roi_pct: number }> = (outcomesRes.data ?? []) as Array<{ roi_pct: number }>

  let avgRoiPct = 0
  if (outcomes.length > 0) {
    const totalRoi = outcomes.reduce((acc, o) => acc + (o.roi_pct ?? 0), 0)
    avgRoiPct = totalRoi / outcomes.length
  }

  // 4. Last activity (most recent across all sources)
  const candidates = [lastLedgerActivity, lastBidActivity].filter(Boolean) as string[]
  const lastActivityAt = candidates.length > 0 ? candidates.sort().reverse()[0] : null
  const daysSinceLastActivity = daysSince(lastActivityAt)

  // 5. Liquidity contribution score (normalized 0-100)
  const liquidityContributionScore = Math.min(100, capitalSizeEurCents / 10_000_00) // €10K = 1 point, €1M = 100

  // 6. Data richness → segment_confidence
  const dataPoints = [
    ledgerEntries.length > 0,
    bids.length > 0,
    outcomes.length > 0,
  ].filter(Boolean).length
  const segmentConfidence = Math.min(1.0, 0.33 + dataPoints * 0.22)

  // 7. Segment decision — ordered by priority
  let segment: InvestorSegment = 'EMERGING_INVESTOR'

  if (capitalSizeEurCents > 5_000_000_00 && bidFrequencyPerMonth > 3) {
    segment = 'WHALE'
  } else if (capitalSizeEurCents > 1_000_000_00 && ledgerEntries.length >= 3) {
    segment = 'INSTITUTIONAL_BUYER'
  } else if (bidFrequencyPerMonth > 5 && conversionRatePct < 30) {
    segment = 'OPPORTUNISTIC_BIDDER'
  } else if (daysSinceLastActivity > 90) {
    segment = 'DORMANT_CAPITAL'
  } else if (avgRoiPct > 8 && conversionRatePct > 50) {
    segment = 'HIGH_ROI_CONTRIBUTOR'
  } else if (bidFrequencyPerMonth > 2 && capitalSizeEurCents > 100_000_00) {
    segment = 'HIGH_CAPITAL_VELOCITY'
  }

  // 8. Fetch existing segment history
  const existingRes = await (supabaseAdmin as any)
    .from('investor_segment_profiles')
    .select('segment, segment_history')
    .eq('tenant_id', tenantId)
    .eq('investor_id', investorId)
    .maybeSingle()

  const prevSegment: string | null = (existingRes.data?.segment as string | null) ?? null
  const prevHistory: string[] = (existingRes.data?.segment_history as string[] | null) ?? []
  const segmentHistory =
    prevSegment && prevSegment !== segment
      ? [...prevHistory, `${prevSegment}@${new Date().toISOString()}`].slice(-10)
      : prevHistory

  const profile: InvestorSegmentProfile = {
    investor_id: investorId,
    tenant_id: tenantId,
    segment,
    capital_size_eur_cents: capitalSizeEurCents,
    liquidity_contribution_score: liquidityContributionScore,
    bid_frequency_per_month: bidFrequencyPerMonth,
    conversion_rate_pct: conversionRatePct,
    avg_roi_pct: avgRoiPct,
    last_activity_at: lastActivityAt,
    days_since_last_activity: daysSinceLastActivity,
    segment_confidence: segmentConfidence,
    segment_history: segmentHistory,
    computed_at: new Date().toISOString(),
  }

  void (supabaseAdmin as any)
    .from('investor_segment_profiles')
    .upsert(
      {
        tenant_id: tenantId,
        investor_id: investorId,
        segment: profile.segment,
        capital_size_eur_cents: profile.capital_size_eur_cents,
        liquidity_contribution_score: profile.liquidity_contribution_score,
        bid_frequency_per_month: profile.bid_frequency_per_month,
        conversion_rate_pct: profile.conversion_rate_pct,
        avg_roi_pct: profile.avg_roi_pct,
        last_activity_at: profile.last_activity_at,
        days_since_last_activity: profile.days_since_last_activity,
        segment_confidence: profile.segment_confidence,
        segment_history: profile.segment_history,
        computed_at: profile.computed_at,
      },
      { onConflict: 'tenant_id,investor_id' },
    )
    .catch((e: unknown) => console.warn('[capitalSegmentation] upsert profile', e))

  log.info('[capitalSegmentationEngine] segment computed', {
    investor_id: investorId,
    segment,
    confidence: segmentConfidence,
  })

  return profile
}

// ─── generateSegmentationReport ──────────────────────────────────────────────

/**
 * Reads all investors, computes segment for each, aggregates into report.
 * Persists to segmentation_reports. Returns SegmentationReport.
 */
export async function generateSegmentationReport(tenantId: string): Promise<SegmentationReport> {
  // Fetch investor IDs from contacts (investor=true) or investor_kyc_records
  const [contactsRes, kycRes] = await Promise.all([
    (supabaseAdmin as any)
      .from('contacts')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('is_investor', true),
    (supabaseAdmin as any)
      .from('investor_kyc_records')
      .select('investor_id')
      .eq('tenant_id', tenantId),
  ])

  const contactIds: string[] = ((contactsRes.data ?? []) as Array<{ id: string }>).map(c => c.id)
  const kycIds: string[] = (
    (kycRes.data ?? []) as Array<{ investor_id: string }>
  ).map(k => k.investor_id)

  const allIds = Array.from(new Set([...contactIds, ...kycIds]))

  // Compute segment for each investor
  const profiles: InvestorSegmentProfile[] = []
  for (const investorId of allIds) {
    try {
      const profile = await computeInvestorSegment(investorId, tenantId)
      profiles.push(profile)
    } catch (err) {
      console.warn('[capitalSegmentation] error computing segment', { investorId, err: String(err) })
    }
  }

  // Aggregate
  const segmentDistribution = Object.fromEntries(
    ALL_SEGMENTS.map(s => [s, 0]),
  ) as Record<InvestorSegment, number>

  const totalCapitalBySegment = Object.fromEntries(
    ALL_SEGMENTS.map(s => [s, 0]),
  ) as Record<InvestorSegment, number>

  let highValueCount = 0
  let atRiskCount = 0

  for (const p of profiles) {
    segmentDistribution[p.segment] = (segmentDistribution[p.segment] ?? 0) + 1
    totalCapitalBySegment[p.segment] = (totalCapitalBySegment[p.segment] ?? 0) + p.capital_size_eur_cents

    if (p.segment === 'WHALE' || p.segment === 'INSTITUTIONAL_BUYER' || p.segment === 'HIGH_ROI_CONTRIBUTOR') {
      highValueCount++
    }
    if (p.segment === 'DORMANT_CAPITAL' || p.days_since_last_activity > 60) {
      atRiskCount++
    }
  }

  // Insights
  const insights: string[] = []
  const dormantCount = segmentDistribution['DORMANT_CAPITAL'] ?? 0
  const dormantPct = profiles.length > 0 ? Math.round((dormantCount / profiles.length) * 100) : 0
  if (dormantPct >= 20) {
    insights.push(`${dormantPct}% dormant capital — run reactivation campaign`)
  }
  const whaleCount = segmentDistribution['WHALE'] ?? 0
  if (whaleCount > 0) {
    insights.push(`${whaleCount} WHALE${whaleCount > 1 ? 's' : ''} detected — high-touch outreach recommended`)
  }
  const velocityCount = segmentDistribution['HIGH_CAPITAL_VELOCITY'] ?? 0
  if (velocityCount > 0) {
    insights.push(`${velocityCount} HIGH_CAPITAL_VELOCITY investors — priority deal flow`)
  }
  if (atRiskCount > 0) {
    insights.push(`${atRiskCount} investors at churn risk — engagement required`)
  }
  if (insights.length === 0) {
    insights.push('Portfolio healthy — continue standard engagement cadence')
  }

  const report: SegmentationReport = {
    tenant_id: tenantId,
    generated_at: new Date().toISOString(),
    total_investors: profiles.length,
    segment_distribution: segmentDistribution,
    high_value_count: highValueCount,
    at_risk_count: atRiskCount,
    total_capital_by_segment: totalCapitalBySegment,
    insights,
  }

  void (supabaseAdmin as any)
    .from('segmentation_reports')
    .insert({
      tenant_id: report.tenant_id,
      generated_at: report.generated_at,
      total_investors: report.total_investors,
      segment_distribution: report.segment_distribution,
      high_value_count: report.high_value_count,
      at_risk_count: report.at_risk_count,
      total_capital_by_segment: report.total_capital_by_segment,
      insights: report.insights,
    })
    .catch((e: unknown) => console.warn('[capitalSegmentation] persist report', e))

  log.info('[capitalSegmentationEngine] report generated', {
    total_investors: report.total_investors,
    high_value_count: highValueCount,
    at_risk_count: atRiskCount,
  })

  return report
}

// ─── getSegmentInvestors ──────────────────────────────────────────────────────

/**
 * Reads from investor_segment_profiles filtered by segment.
 */
export async function getSegmentInvestors(
  segment: InvestorSegment,
  tenantId: string,
): Promise<InvestorSegmentProfile[]> {
  const res = await (supabaseAdmin as any)
    .from('investor_segment_profiles')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('segment', segment)
    .order('capital_size_eur_cents', { ascending: false })

  return (res.data ?? []) as InvestorSegmentProfile[]
}

// ─── detectChurnRisk ──────────────────────────────────────────────────────────

/**
 * Identifies investors trending toward DORMANT.
 * churn_probability = days_inactive / 120 (capped at 0.95).
 */
export async function detectChurnRisk(tenantId: string): Promise<
  Array<{
    investor_id: string
    days_inactive: number
    last_capital_eur_cents: number
    churn_probability: number
    recommended_action: string
  }>
> {
  const res = await (supabaseAdmin as any)
    .from('investor_segment_profiles')
    .select('investor_id, days_since_last_activity, capital_size_eur_cents, segment')
    .eq('tenant_id', tenantId)
    .gte('days_since_last_activity', 30)
    .order('days_since_last_activity', { ascending: false })

  const rows: Array<{
    investor_id: string
    days_since_last_activity: number
    capital_size_eur_cents: number
    segment: string
  }> = (res.data ?? []) as Array<{
    investor_id: string
    days_since_last_activity: number
    capital_size_eur_cents: number
    segment: string
  }>

  return rows.map(row => {
    const daysInactive = row.days_since_last_activity ?? 0
    const churnProbability = Math.min(0.95, daysInactive / 120)

    let recommendedAction = 'Monitor'
    if (churnProbability >= 0.75) {
      recommendedAction = 'Immediate personal outreach — high churn risk'
    } else if (churnProbability >= 0.5) {
      recommendedAction = 'Schedule check-in call — moderate churn risk'
    } else if (churnProbability >= 0.25) {
      recommendedAction = 'Send curated deal alert — early churn signal'
    }

    return {
      investor_id: row.investor_id,
      days_inactive: daysInactive,
      last_capital_eur_cents: row.capital_size_eur_cents ?? 0,
      churn_probability: churnProbability,
      recommended_action: recommendedAction,
    }
  })
}
