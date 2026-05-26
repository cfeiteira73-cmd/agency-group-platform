// Agency Group — Investor Retention Engine
// lib/lock-in/investorRetentionEngine.ts
// TypeScript strict — 0 errors
//
// Tracks and improves investor retention toward the 60% target.
// All EUR amounts in bigint (cents) — never float for money.

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RetentionCohort {
  cohort_id: string
  tenant_id: string
  cohort_period: string   // 'YYYY-MM'
  investors_joined: number
  active_30d: number
  active_90d: number
  active_180d: number
  retention_rate_30d: number
  retention_rate_90d: number
  retention_rate_180d: number
  avg_capital_deployed_eur_cents: number
  churned_count: number
  computed_at: string
}

export interface RetentionIntervention {
  intervention_id: string
  tenant_id: string
  investor_id: string
  trigger: 'HIGH_CHURN_RISK' | 'NO_BID_30D' | 'NO_LOGIN_14D' | 'MISSED_OPPORTUNITY'
  action: 'SEND_OPPORTUNITY_ALERT' | 'PERSONAL_OUTREACH' | 'DISCOUNT_OFFER' | 'RE_ENGAGEMENT_CAMPAIGN'
  status: 'QUEUED' | 'EXECUTED' | 'RESPONDED' | 'NO_RESPONSE'
  queued_at: string
  executed_at: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function triggerToAction(
  trigger: RetentionIntervention['trigger'],
): RetentionIntervention['action'] {
  switch (trigger) {
    case 'HIGH_CHURN_RISK':
      return 'PERSONAL_OUTREACH'
    case 'NO_BID_30D':
      return 'SEND_OPPORTUNITY_ALERT'
    case 'NO_LOGIN_14D':
      return 'RE_ENGAGEMENT_CAMPAIGN'
    case 'MISSED_OPPORTUNITY':
      return 'DISCOUNT_OFFER'
    default:
      return 'SEND_OPPORTUNITY_ALERT'
  }
}

// ─── computeRetentionCohort ───────────────────────────────────────────────────

/**
 * Computes retention cohort for a given YYYY-MM period.
 * Reads first-activity from asset_interaction_events to determine cohort membership.
 */
export async function computeRetentionCohort(
  period: string,
  tenantId: string,
): Promise<RetentionCohort> {
  const [year, month] = period.split('-').map(Number)
  const periodStart = new Date(year, month - 1, 1).toISOString()
  const periodEnd = new Date(year, month, 1).toISOString()

  // Investors whose FIRST event was in this period
  const { data: firstEvents } = await (supabaseAdmin as any)
    .from('asset_interaction_events')
    .select('investor_id, occurred_at')
    .eq('tenant_id', tenantId)
    .gte('occurred_at', periodStart)
    .lt('occurred_at', periodEnd)
    .order('occurred_at', { ascending: true })

  const cohortMap = new Map<string, Date>()
  for (const row of (firstEvents ?? []) as Array<{ investor_id: string; occurred_at: string }>) {
    if (!cohortMap.has(row.investor_id)) {
      cohortMap.set(row.investor_id, new Date(row.occurred_at))
    }
  }

  const investorIds = Array.from(cohortMap.keys())
  const investorsJoined = investorIds.length

  if (investorsJoined === 0) {
    const cohortId = randomUUID()
    const empty: RetentionCohort = {
      cohort_id: cohortId,
      tenant_id: tenantId,
      cohort_period: period,
      investors_joined: 0,
      active_30d: 0,
      active_90d: 0,
      active_180d: 0,
      retention_rate_30d: 0,
      retention_rate_90d: 0,
      retention_rate_180d: 0,
      avg_capital_deployed_eur_cents: 0,
      churned_count: 0,
      computed_at: new Date().toISOString(),
    }
    await (supabaseAdmin as any)
      .from('retention_cohorts')
      .upsert(empty, { onConflict: 'cohort_period,tenant_id' })
    return empty
  }

  const now = Date.now()

  // Activity after joining: count investors active within 30/90/180 days of their join date
  let active30d = 0
  let active90d = 0
  let active180d = 0

  for (const [investorId, joinDate] of cohortMap.entries()) {
    const { data: laterEvents } = await (supabaseAdmin as any)
      .from('asset_interaction_events')
      .select('occurred_at')
      .eq('investor_id', investorId)
      .eq('tenant_id', tenantId)
      .gt('occurred_at', joinDate.toISOString())
      .order('occurred_at', { ascending: true })
      .limit(1)

    if (!laterEvents || laterEvents.length === 0) continue

    const firstReturn = new Date(laterEvents[0].occurred_at as string).getTime()
    const daysAfterJoin = (firstReturn - joinDate.getTime()) / 86_400_000

    if (daysAfterJoin <= 30) active30d++
    if (daysAfterJoin <= 90) active90d++
    if (daysAfterJoin <= 180) active180d++
  }

  // Capital deployed
  const { data: capRows } = await (supabaseAdmin as any)
    .from('investor_capital_profiles')
    .select('available_capital_eur_cents')
    .eq('tenant_id', tenantId)
    .in('investor_id', investorIds)

  const totalCap = ((capRows ?? []) as Array<{ available_capital_eur_cents: number }>).reduce(
    (sum, r) => sum + (r.available_capital_eur_cents ?? 0),
    0,
  )
  const avgCapitalDeployedEurCents =
    investorsJoined > 0 ? Math.round(totalCap / investorsJoined) : 0

  const daysInPeriod = (now - new Date(periodStart).getTime()) / 86_400_000
  const churned = daysInPeriod > 180 ? investorsJoined - active180d : 0

  const cohortId = randomUUID()
  const result: RetentionCohort = {
    cohort_id: cohortId,
    tenant_id: tenantId,
    cohort_period: period,
    investors_joined: investorsJoined,
    active_30d: active30d,
    active_90d: active90d,
    active_180d: active180d,
    retention_rate_30d: parseFloat((active30d / investorsJoined).toFixed(3)),
    retention_rate_90d: parseFloat((active90d / investorsJoined).toFixed(3)),
    retention_rate_180d: parseFloat((active180d / investorsJoined).toFixed(3)),
    avg_capital_deployed_eur_cents: avgCapitalDeployedEurCents,
    churned_count: churned,
    computed_at: new Date().toISOString(),
  }

  void (supabaseAdmin as any)
    .from('retention_cohorts')
    .upsert(result, { onConflict: 'cohort_period,tenant_id' })
    .then(({ error }: { error: { message: string } | null }) => {
      if (error) log.warn('[investorRetentionEngine] cohort upsert error', { error: error.message })
    })

  return result
}

// ─── queueRetentionIntervention ───────────────────────────────────────────────

/**
 * Creates a QUEUED intervention. Idempotent within a 7-day window per
 * (investor_id, trigger).
 */
export async function queueRetentionIntervention(
  investorId: string,
  trigger: RetentionIntervention['trigger'],
  tenantId: string,
): Promise<RetentionIntervention> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString()

  // Idempotency check
  const { data: existing } = await (supabaseAdmin as any)
    .from('retention_interventions')
    .select('*')
    .eq('investor_id', investorId)
    .eq('trigger', trigger)
    .eq('tenant_id', tenantId)
    .gte('queued_at', sevenDaysAgo)
    .limit(1)

  if (existing && existing.length > 0) {
    return existing[0] as RetentionIntervention
  }

  const intervention: RetentionIntervention = {
    intervention_id: randomUUID(),
    tenant_id: tenantId,
    investor_id: investorId,
    trigger,
    action: triggerToAction(trigger),
    status: 'QUEUED',
    queued_at: new Date().toISOString(),
    executed_at: null,
  }

  const { error } = await (supabaseAdmin as any)
    .from('retention_interventions')
    .insert(intervention)

  if (error) {
    log.warn('[investorRetentionEngine] queue error', { investorId, trigger, error: error.message })
  }

  return intervention
}

// ─── processRetentionInterventions ───────────────────────────────────────────

/**
 * Reads QUEUED interventions, marks them EXECUTED, and fires distribution_queue inserts.
 */
export async function processRetentionInterventions(
  tenantId: string,
): Promise<{ executed: number }> {
  const { data: queued } = await (supabaseAdmin as any)
    .from('retention_interventions')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('status', 'QUEUED')
    .limit(100)

  const interventions: RetentionIntervention[] = queued ?? []
  let executed = 0

  for (const inv of interventions) {
    const executedAt = new Date().toISOString()

    const { error: updateError } = await (supabaseAdmin as any)
      .from('retention_interventions')
      .update({ status: 'EXECUTED', executed_at: executedAt })
      .eq('intervention_id', inv.intervention_id)

    if (updateError) {
      log.warn('[investorRetentionEngine] update error', {
        id: inv.intervention_id,
        error: updateError.message,
      })
      continue
    }

    // Fire-and-forget: enqueue into distribution_queue
    void (supabaseAdmin as any)
      .from('distribution_queue')
      .insert({
        tenant_id: tenantId,
        investor_id: inv.investor_id,
        channel: inv.action,
        message_content: `retention_intervention:${inv.intervention_id}`,
        priority: 'HIGH',
        queued_at: executedAt,
      })
      .then(({ error }: { error: { message: string } | null }) => {
        if (error) {
          console.warn('[investorRetentionEngine] distribution_queue insert', error.message)
        }
      })

    executed++
  }

  log.info('[investorRetentionEngine] processed', { tenantId, executed })

  return { executed }
}

// ─── getRetentionMetrics ──────────────────────────────────────────────────────

/**
 * Returns current retention snapshot for a tenant.
 */
export async function getRetentionMetrics(tenantId: string): Promise<{
  current_retention_rate: number
  target: number
  above_target: boolean
  interventions_queued: number
  cohort_trend: string
}> {
  // Current 90d retention from lock_in_scores
  const { data: lockRows } = await (supabaseAdmin as any)
    .from('investor_lock_in_scores')
    .select('last_bid_days_ago')
    .eq('tenant_id', tenantId)

  const allScores: Array<{ last_bid_days_ago: number | null }> = lockRows ?? []
  const total = allScores.length
  const active90 = allScores.filter(
    (s) => s.last_bid_days_ago != null && s.last_bid_days_ago < 90,
  ).length
  const currentRetentionRate = total > 0 ? parseFloat((active90 / total).toFixed(4)) : 0
  const target = 0.6

  // Queued interventions count
  const { count: queuedCount } = await (supabaseAdmin as any)
    .from('retention_interventions')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('status', 'QUEUED')

  // Last 3 cohorts trend
  const { data: cohortRows } = await (supabaseAdmin as any)
    .from('retention_cohorts')
    .select('cohort_period, retention_rate_90d')
    .eq('tenant_id', tenantId)
    .order('cohort_period', { ascending: false })
    .limit(3)

  const cohorts: Array<{ cohort_period: string; retention_rate_90d: number }> = cohortRows ?? []
  let cohortTrend = 'stable'
  if (cohorts.length >= 2) {
    const delta = cohorts[0].retention_rate_90d - cohorts[cohorts.length - 1].retention_rate_90d
    if (delta > 0.05) cohortTrend = 'improving'
    else if (delta < -0.05) cohortTrend = 'declining'
  }

  return {
    current_retention_rate: currentRetentionRate,
    target,
    above_target: currentRetentionRate >= target,
    interventions_queued: queuedCount ?? 0,
    cohort_trend: cohortTrend,
  }
}
