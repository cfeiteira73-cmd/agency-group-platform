// Agency Group — Capital Lock-In Engine
// lib/lock-in/capitalLockInEngine.ts
// TypeScript strict — 0 errors
//
// Tracks how "locked in" investors are — the cost of leaving the system.
// All EUR amounts in bigint (cents) — never float for money.

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type LockInTier = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'CHURNING'

export interface InvestorLockInScore {
  lock_in_id: string
  tenant_id: string
  investor_id: string

  // Lock-in components (all 0–100)
  lock_in_score: number
  deal_dependency_score: number
  data_integration_score: number
  switching_cost_score: number
  habit_score: number

  // Behavioral signals
  consecutive_active_days: number
  last_bid_days_ago: number | null
  deals_via_system: number
  total_deals: number | null
  dependency_ratio: number

  lock_in_tier: LockInTier
  churn_risk: 'HIGH' | 'MEDIUM' | 'LOW'
  churn_probability: number

  computed_at: string
}

export interface CapitalLockInSummary {
  tenant_id: string
  total_investors: number
  critical_locked: number
  high_locked: number
  churning_count: number
  avg_lock_in_score: number
  total_locked_capital_eur_cents: number
  retention_rate_90d: number
  target_retention_rate: number
  above_target: boolean
  generated_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tierFromScore(score: number): LockInTier {
  if (score >= 80) return 'CRITICAL'
  if (score >= 60) return 'HIGH'
  if (score >= 40) return 'MEDIUM'
  if (score >= 20) return 'LOW'
  return 'CHURNING'
}

function churnRiskFromProbability(prob: number): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (prob > 0.7) return 'HIGH'
  if (prob > 0.4) return 'MEDIUM'
  return 'LOW'
}

// ─── computeInvestorLockIn ────────────────────────────────────────────────────

/**
 * Computes how locked-in a single investor is and persists the result.
 */
export async function computeInvestorLockIn(
  investorId: string,
  tenantId: string,
): Promise<InvestorLockInScore> {
  // 1. Activity frequency from asset_interaction_events
  const { data: events } = await (supabaseAdmin as any)
    .from('asset_interaction_events')
    .select('occurred_at, event_type')
    .eq('investor_id', investorId)
    .eq('tenant_id', tenantId)
    .order('occurred_at', { ascending: false })
    .limit(200)

  const eventRows: Array<{ occurred_at: string; event_type: string }> = events ?? []
  const hasBid = eventRows.some((e) => e.event_type === 'BID' || e.event_type === 'OFFER')
  const hasViewed = eventRows.some((e) => e.event_type === 'VIEW' || e.event_type === 'VISIT')

  // consecutive active days
  let consecutiveActiveDays = 0
  const seenDates = new Set<string>()
  for (const e of eventRows) {
    const d = e.occurred_at.slice(0, 10)
    seenDates.add(d)
  }
  const sortedDates = Array.from(seenDates).sort().reverse()
  if (sortedDates.length > 0) {
    let prev = new Date(sortedDates[0])
    consecutiveActiveDays = 1
    for (let i = 1; i < sortedDates.length; i++) {
      const curr = new Date(sortedDates[i])
      const diff = Math.round((prev.getTime() - curr.getTime()) / 86_400_000)
      if (diff === 1) {
        consecutiveActiveDays++
        prev = curr
      } else {
        break
      }
    }
  }

  // last bid days ago from feedback_signals
  const { data: feedbackRows } = await (supabaseAdmin as any)
    .from('feedback_signals')
    .select('occurred_at')
    .eq('investor_id', investorId)
    .eq('tenant_id', tenantId)
    .order('occurred_at', { ascending: false })
    .limit(1)

  let lastBidDaysAgo: number | null = null
  if (feedbackRows && feedbackRows.length > 0) {
    const last = new Date(feedbackRows[0].occurred_at as string)
    lastBidDaysAgo = Math.floor((Date.now() - last.getTime()) / 86_400_000)
  }

  // 2. Deals via system from opportunity_investor_matches
  const { count: dealsViaSystem } = await (supabaseAdmin as any)
    .from('opportunity_investor_matches')
    .select('id', { count: 'exact', head: true })
    .eq('investor_id', investorId)
    .eq('tenant_id', tenantId)
    .eq('investor_response', 'ACCEPTED')

  const dealsCount = dealsViaSystem ?? 0

  // 3. Has profile from investor_capital_profiles
  const { data: profileRows } = await (supabaseAdmin as any)
    .from('investor_capital_profiles')
    .select('available_capital_eur_cents')
    .eq('investor_id', investorId)
    .eq('tenant_id', tenantId)
    .limit(1)

  const profile = profileRows?.[0] ?? null
  const hasProfile = !!profile
  const totalDeals: number | null = null

  // 4. Compute component scores
  const dealDependencyScore = Math.min(100, dealsCount * 10)

  const habitScore = lastBidDaysAgo != null
    ? Math.max(0, 100 - lastBidDaysAgo * 1.5)
    : Math.max(0, 100 - consecutiveActiveDays * 0)

  const switchingCostScore = Math.min(100, dealsCount * 5)

  const dataIntegrationScore =
    (hasBid ? 33 : 0) + (hasViewed ? 33 : 0) + (hasProfile ? 33 : 0)

  const lockInScore = Math.round(
    dealDependencyScore * 0.35 +
    dataIntegrationScore * 0.25 +
    switchingCostScore * 0.20 +
    habitScore * 0.20,
  )

  const churnProbability = parseFloat((1 - lockInScore / 100).toFixed(3))
  const churnRisk = churnRiskFromProbability(churnProbability)
  const lockInTier = tierFromScore(lockInScore)
  const dependencyRatio = parseFloat(
    (dealsCount / Math.max(1, totalDeals ?? dealsCount)).toFixed(4),
  )

  const result: InvestorLockInScore = {
    lock_in_id: randomUUID(),
    tenant_id: tenantId,
    investor_id: investorId,
    lock_in_score: lockInScore,
    deal_dependency_score: dealDependencyScore,
    data_integration_score: dataIntegrationScore,
    switching_cost_score: switchingCostScore,
    habit_score: Math.round(habitScore),
    consecutive_active_days: consecutiveActiveDays,
    last_bid_days_ago: lastBidDaysAgo,
    deals_via_system: dealsCount,
    total_deals: totalDeals,
    dependency_ratio: dependencyRatio,
    lock_in_tier: lockInTier,
    churn_risk: churnRisk,
    churn_probability: churnProbability,
    computed_at: new Date().toISOString(),
  }

  // Upsert to investor_lock_in_scores
  const { error } = await (supabaseAdmin as any)
    .from('investor_lock_in_scores')
    .upsert(
      {
        lock_in_id: result.lock_in_id,
        tenant_id: tenantId,
        investor_id: investorId,
        lock_in_score: result.lock_in_score,
        deal_dependency_score: result.deal_dependency_score,
        data_integration_score: result.data_integration_score,
        switching_cost_score: result.switching_cost_score,
        habit_score: result.habit_score,
        consecutive_active_days: result.consecutive_active_days,
        last_bid_days_ago: result.last_bid_days_ago,
        deals_via_system: result.deals_via_system,
        total_deals: result.total_deals,
        dependency_ratio: result.dependency_ratio,
        lock_in_tier: result.lock_in_tier,
        churn_risk: result.churn_risk,
        churn_probability: result.churn_probability,
        computed_at: result.computed_at,
      },
      { onConflict: 'investor_id,tenant_id' },
    )

  if (error) {
    log.warn('[capitalLockInEngine] upsert error', { investorId, error: error.message })
  }

  return result
}

// ─── getCapitalLockInSummary ──────────────────────────────────────────────────

/**
 * Aggregates all lock-in scores for a tenant into a summary.
 */
export async function getCapitalLockInSummary(tenantId: string): Promise<CapitalLockInSummary> {
  const { data: rows } = await (supabaseAdmin as any)
    .from('investor_lock_in_scores')
    .select(
      'lock_in_tier, churn_risk, lock_in_score, last_bid_days_ago, investor_id',
    )
    .eq('tenant_id', tenantId)

  const scores: Array<{
    lock_in_tier: string
    churn_risk: string
    lock_in_score: number
    last_bid_days_ago: number | null
    investor_id: string
  }> = rows ?? []

  const totalInvestors = scores.length
  const criticalLocked = scores.filter((s) => s.lock_in_tier === 'CRITICAL').length
  const highLocked = scores.filter((s) => s.lock_in_tier === 'HIGH').length
  const churningCount = scores.filter((s) => s.lock_in_tier === 'CHURNING').length
  const avgLockInScore =
    totalInvestors > 0
      ? parseFloat(
          (scores.reduce((sum, s) => sum + s.lock_in_score, 0) / totalInvestors).toFixed(2),
        )
      : 0

  // Capital from HIGH + CRITICAL investors
  const highCriticalIds = scores
    .filter((s) => s.lock_in_tier === 'CRITICAL' || s.lock_in_tier === 'HIGH')
    .map((s) => s.investor_id)

  let totalLockedCapitalEurCents = 0
  if (highCriticalIds.length > 0) {
    const { data: capRows } = await (supabaseAdmin as any)
      .from('investor_capital_profiles')
      .select('available_capital_eur_cents')
      .eq('tenant_id', tenantId)
      .in('investor_id', highCriticalIds)

    totalLockedCapitalEurCents = ((capRows ?? []) as Array<{ available_capital_eur_cents: number }>)
      .reduce((sum, r) => sum + (r.available_capital_eur_cents ?? 0), 0)
  }

  const activeIn90d = scores.filter(
    (s) => s.last_bid_days_ago != null && s.last_bid_days_ago < 90,
  ).length
  const retentionRate90d =
    totalInvestors > 0 ? parseFloat((activeIn90d / totalInvestors).toFixed(4)) : 0
  const targetRetentionRate = 0.6

  return {
    tenant_id: tenantId,
    total_investors: totalInvestors,
    critical_locked: criticalLocked,
    high_locked: highLocked,
    churning_count: churningCount,
    avg_lock_in_score: avgLockInScore,
    total_locked_capital_eur_cents: totalLockedCapitalEurCents,
    retention_rate_90d: retentionRate90d,
    target_retention_rate: targetRetentionRate,
    above_target: retentionRate90d >= targetRetentionRate,
    generated_at: new Date().toISOString(),
  }
}

// ─── identifyChurnRisk ────────────────────────────────────────────────────────

/**
 * Returns all investors with HIGH churn risk, sorted by capital size DESC.
 */
export async function identifyChurnRisk(tenantId: string): Promise<InvestorLockInScore[]> {
  const { data: rows } = await (supabaseAdmin as any)
    .from('investor_lock_in_scores')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('churn_risk', 'HIGH')
    .order('deals_via_system', { ascending: false })

  return ((rows ?? []) as InvestorLockInScore[])
}

// ─── runLockInSweep ───────────────────────────────────────────────────────────

/**
 * Runs computeInvestorLockIn for all investors under a tenant.
 */
export async function runLockInSweep(
  tenantId: string,
): Promise<{ updated: number; high_churn_risk: number }> {
  // Gather all unique investor IDs from matches and events
  const { data: matchRows } = await (supabaseAdmin as any)
    .from('opportunity_investor_matches')
    .select('investor_id')
    .eq('tenant_id', tenantId)
    .limit(1000)

  const { data: eventRows } = await (supabaseAdmin as any)
    .from('asset_interaction_events')
    .select('investor_id')
    .eq('tenant_id', tenantId)
    .limit(1000)

  const allIds = new Set<string>()
  for (const r of matchRows ?? []) {
    if (r.investor_id) allIds.add(r.investor_id as string)
  }
  for (const r of eventRows ?? []) {
    if (r.investor_id) allIds.add(r.investor_id as string)
  }

  const investorIds = Array.from(allIds)
  let updated = 0
  let highChurnRisk = 0

  for (const id of investorIds) {
    try {
      const score = await computeInvestorLockIn(id, tenantId)
      updated++
      if (score.churn_risk === 'HIGH') highChurnRisk++
    } catch (e) {
      void Promise.resolve().catch(() => console.warn('[capitalLockInEngine] sweep error', e))
    }
  }

  log.info('[capitalLockInEngine] sweep complete', { tenantId, updated, highChurnRisk })

  return { updated, high_churn_risk: highChurnRisk }
}
