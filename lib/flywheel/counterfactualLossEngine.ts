// Agency Group — Counterfactual Loss Engine
// lib/flywheel/counterfactualLossEngine.ts
//
// Computes the counterfactual loss: what deals were missed,
// what capital was left on the table.
//
// TypeScript strict — 0 errors

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CounterfactualLoss {
  loss_id: string
  tenant_id: string
  period: string

  // Missed opportunities
  opportunities_expired_without_bid: number
  estimated_missed_capital_eur_cents: number
  estimated_missed_commission_eur_cents: number

  // Prediction failures
  high_scored_deals_that_failed: number
  low_scored_deals_that_closed: number

  // Capital loss
  unmatched_investors_capital_eur_cents: number

  // Learning signal
  false_positive_rate: number
  false_negative_rate: number

  improvement_recommendations: string[]
  computed_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPeriod(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000
}

// ─── computeCounterfactualLoss ────────────────────────────────────────────────

export async function computeCounterfactualLoss(
  tenantId: string,
  period?: string,
): Promise<CounterfactualLoss> {
  const usePeriod = period ?? getPeriod()
  const [year, month] = usePeriod.split('-').map(Number)
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0, 23, 59, 59)

  // ── 1. Expired opportunities without any investor bid
  const { data: expiredRows } = await (supabaseAdmin as any)
    .from('detected_opportunities')
    .select('opportunity_id, potential_gain_eur_cents')
    .eq('tenant_id', tenantId)
    .eq('status', 'EXPIRED')
    .gte('detected_at', startDate.toISOString())
    .lte('detected_at', endDate.toISOString())

  type ExpiredRow = {
    opportunity_id: string
    potential_gain_eur_cents: number | null
  }
  const expired = (expiredRows ?? []) as ExpiredRow[]

  // Check which had no bids
  let expiredWithoutBid = 0
  let missedCapitalCents = 0

  for (const opp of expired) {
    const { count: bidCount } = await (supabaseAdmin as any)
      .from('opportunity_investor_matches')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('opportunity_id', opp.opportunity_id)
      .in('investor_response', ['BID'])

    if ((bidCount ?? 0) === 0) {
      expiredWithoutBid++
      missedCapitalCents += opp.potential_gain_eur_cents ?? 0
    }
  }

  const missedCommissionCents = Math.round(missedCapitalCents * 0.05)

  // ── 2. High-scored deals that failed (score > 70, outcome DEAL_FAILED)
  const { data: highScoredRows } = await (supabaseAdmin as any)
    .from('opportunity_outcomes')
    .select('opportunity_id, outcome_type, final_opportunity_score')
    .eq('tenant_id', tenantId)
    .eq('outcome_type', 'DEAL_FAILED')
    .gt('final_opportunity_score', 70)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())

  const highScoredFailed = ((highScoredRows ?? []) as unknown[]).length

  // Total high-scored for false positive denominator
  const { count: totalHighScored } = await (supabaseAdmin as any)
    .from('opportunity_outcomes')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .gt('final_opportunity_score', 70)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())

  // ── 3. Low-scored deals that closed (score < 40, outcome DEAL_CLOSED)
  const { data: lowScoredRows } = await (supabaseAdmin as any)
    .from('opportunity_outcomes')
    .select('opportunity_id, outcome_type, final_opportunity_score')
    .eq('tenant_id', tenantId)
    .eq('outcome_type', 'DEAL_CLOSED')
    .lt('final_opportunity_score', 40)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())

  const lowScoredClosed = ((lowScoredRows ?? []) as unknown[]).length

  // Total low-scored for false negative denominator
  const { count: totalLowScored } = await (supabaseAdmin as any)
    .from('opportunity_outcomes')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .lt('final_opportunity_score', 40)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())

  // ── 4. Unmatched investor capital (DORMANT_CAPITAL segment)
  const { data: dormantRows } = await (supabaseAdmin as any)
    .from('investor_capital_profiles')
    .select('available_capital_eur_cents')
    .eq('tenant_id', tenantId)
    .eq('segment', 'DORMANT_CAPITAL')

  type DormantRow = { available_capital_eur_cents: number }
  const dormant = (dormantRows ?? []) as DormantRow[]
  const unmatchedCapitalCents = dormant.reduce(
    (s, r) => s + (r.available_capital_eur_cents ?? 0),
    0,
  )

  // ── 5. Rates
  const falsePositiveRate = round3(
    (totalHighScored ?? 0) > 0 ? highScoredFailed / (totalHighScored ?? 1) : 0,
  )
  const falseNegativeRate = round3(
    (totalLowScored ?? 0) > 0 ? lowScoredClosed / (totalLowScored ?? 1) : 0,
  )

  // ── 6. Improvement recommendations
  const recommendations: string[] = []

  if (expiredWithoutBid > 5) {
    recommendations.push(
      `${expiredWithoutBid} opportunities expired without a single investor bid — expand active investor pool and improve distribution speed`,
    )
  }
  if (falsePositiveRate > 0.3) {
    recommendations.push(
      `High false positive rate (${(falsePositiveRate * 100).toFixed(1)}%) — review scoring model weights for overconfident signals`,
    )
  }
  if (falseNegativeRate > 0.2) {
    recommendations.push(
      `High false negative rate (${(falseNegativeRate * 100).toFixed(1)}%) — model is missing real opportunities; add more training data`,
    )
  }
  if (unmatchedCapitalCents > 50_000_000_00) {
    // > €50M dormant
    recommendations.push(
      `€${(unmatchedCapitalCents / 100).toLocaleString('pt-PT')} in dormant investor capital — trigger re-engagement campaigns for DORMANT_CAPITAL segment`,
    )
  }
  if (missedCapitalCents > 10_000_000_00) {
    // > €10M missed
    recommendations.push(
      `€${(missedCapitalCents / 100).toLocaleString('pt-PT')} in estimated missed capital — prioritize first-mover listings and reduce time-to-distribution`,
    )
  }
  if (recommendations.length === 0) {
    recommendations.push('Flywheel operating within normal parameters — continue monitoring KPIs')
  }

  const loss: CounterfactualLoss = {
    loss_id: randomUUID(),
    tenant_id: tenantId,
    period: usePeriod,
    opportunities_expired_without_bid: expiredWithoutBid,
    estimated_missed_capital_eur_cents: missedCapitalCents,
    estimated_missed_commission_eur_cents: missedCommissionCents,
    high_scored_deals_that_failed: highScoredFailed,
    low_scored_deals_that_closed: lowScoredClosed,
    unmatched_investors_capital_eur_cents: unmatchedCapitalCents,
    false_positive_rate: falsePositiveRate,
    false_negative_rate: falseNegativeRate,
    improvement_recommendations: recommendations,
    computed_at: new Date().toISOString(),
  }

  // Persist
  void (supabaseAdmin as any)
    .from('counterfactual_losses')
    .insert({
      loss_id: loss.loss_id,
      tenant_id: loss.tenant_id,
      period: loss.period,
      opportunities_expired_without_bid: loss.opportunities_expired_without_bid,
      estimated_missed_capital_eur_cents: loss.estimated_missed_capital_eur_cents,
      estimated_missed_commission_eur_cents: loss.estimated_missed_commission_eur_cents,
      unmatched_investors_capital_eur_cents: loss.unmatched_investors_capital_eur_cents,
      high_scored_deals_that_failed: loss.high_scored_deals_that_failed,
      low_scored_deals_that_closed: loss.low_scored_deals_that_closed,
      false_positive_rate: loss.false_positive_rate,
      false_negative_rate: loss.false_negative_rate,
      improvement_recommendations: loss.improvement_recommendations,
      computed_at: loss.computed_at,
    })
    .catch((e: unknown) =>
      log.warn('[counterfactualLossEngine] persist error', { e }),
    )

  log.info('[counterfactualLossEngine] computed', {
    tenantId,
    period: usePeriod,
    expired_without_bid: loss.opportunities_expired_without_bid,
    missed_capital_eur: loss.estimated_missed_capital_eur_cents / 100,
    false_positive_rate: loss.false_positive_rate,
    false_negative_rate: loss.false_negative_rate,
  })

  return loss
}

// ─── getCounterfactualHistory ─────────────────────────────────────────────────

export async function getCounterfactualHistory(
  tenantId: string,
  limit = 12,
): Promise<CounterfactualLoss[]> {
  const { data, error } = await (supabaseAdmin as any)
    .from('counterfactual_losses')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('computed_at', { ascending: false })
    .limit(limit)

  if (error) {
    log.warn('[counterfactualLossEngine] getCounterfactualHistory error', { error })
    return []
  }

  return (data ?? []) as CounterfactualLoss[]
}
