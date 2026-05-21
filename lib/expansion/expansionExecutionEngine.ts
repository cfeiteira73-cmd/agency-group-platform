// Agency Group — Expansion Execution Engine
// lib/expansion/expansionExecutionEngine.ts
// Executes market expansion:
//   activates local campaigns per market
//   creates new investor clusters by country
//   adjusts pricing signals by liquidity level
//   coordinates the full expansion playbook

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { launchMigrationCampaign } from '@/lib/expansion/investorMigrationEngine'

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_TENANT_ID =
  process.env.DEFAULT_TENANT_ID ??
  process.env.SYSTEM_ORG_ID ??
  '00000000-0000-0000-0000-000000000001'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExpansionPhase =
  | 'RESEARCH'
  | 'SOFT_LAUNCH'
  | 'ACTIVE_EXPANSION'
  | 'OPTIMIZATION'
  | 'MATURE'

export interface ExpansionMilestone {
  milestone: string
  target_value: number
  current_value: number
  achieved: boolean
  achieved_at: string | null
}

export interface MarketExpansionPlan {
  plan_id: string
  tenant_id: string
  country: string
  city: string
  phase: ExpansionPhase
  target_investor_count: number
  target_capital_eur_cents: number
  target_liquidity_score: number
  campaigns_launched: string[]
  milestones: ExpansionMilestone[]
  created_at: string
  updated_at: string
}

// ─── _defaultMilestones ───────────────────────────────────────────────────────

function _defaultMilestones(): ExpansionMilestone[] {
  return [
    {
      milestone: 'INVESTOR_COUNT',
      target_value: 5,
      current_value: 0,
      achieved: false,
      achieved_at: null,
    },
    {
      milestone: 'CAPITAL_INFLOW',
      target_value: 50_000_000, // €500K in cents
      current_value: 0,
      achieved: false,
      achieved_at: null,
    },
    {
      milestone: 'LIQUIDITY_SCORE',
      target_value: 40,
      current_value: 0,
      achieved: false,
      achieved_at: null,
    },
    {
      milestone: 'FIRST_DEAL_CLOSED',
      target_value: 1,
      current_value: 0,
      achieved: false,
      achieved_at: null,
    },
  ]
}

// ─── _mapPlanRow ──────────────────────────────────────────────────────────────

function _mapPlanRow(row: Record<string, unknown>): MarketExpansionPlan {
  return {
    plan_id: row.plan_id as string,
    tenant_id: row.tenant_id as string,
    country: row.country as string,
    city: row.city as string,
    phase: row.phase as ExpansionPhase,
    target_investor_count: Number(row.target_investor_count ?? 5),
    target_capital_eur_cents: Number(row.target_capital_eur_cents ?? 0),
    target_liquidity_score: Number(row.target_liquidity_score ?? 40),
    campaigns_launched: (row.campaigns_launched as string[]) ?? [],
    milestones: (row.milestones as ExpansionMilestone[]) ?? _defaultMilestones(),
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }
}

// ─── createExpansionPlan ──────────────────────────────────────────────────────

export async function createExpansionPlan(
  country: string,
  city: string,
  tenantId: string,
): Promise<MarketExpansionPlan> {
  const now = new Date().toISOString()

  // Read market intelligence for this city
  const { data: intelRows } = await (supabaseAdmin as any)
    .from('market_intelligence_snapshots')
    .select('opportunity_score, liquidity_score, avg_price_eur_cents')
    .eq('tenant_id', tenantId)
    .ilike('city', city)
    .order('captured_at', { ascending: false })
    .limit(1)

  const intel = ((intelRows ?? []) as Array<Record<string, unknown>>)[0] ?? {}
  const baseCapitalTarget = intel.avg_price_eur_cents
    ? Number(intel.avg_price_eur_cents) * 5
    : 50_000_000 // default €500K in cents

  const plan_id = `expplan_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

  const milestones = _defaultMilestones()
  milestones[1]!.target_value = baseCapitalTarget

  const plan: MarketExpansionPlan = {
    plan_id,
    tenant_id: tenantId,
    country,
    city,
    phase: 'RESEARCH',
    target_investor_count: 5,
    target_capital_eur_cents: baseCapitalTarget,
    target_liquidity_score: 40,
    campaigns_launched: [],
    milestones,
    created_at: now,
    updated_at: now,
  }

  const { data, error } = await (supabaseAdmin as any)
    .from('expansion_plans')
    .insert({
      plan_id: plan.plan_id,
      tenant_id: plan.tenant_id,
      country: plan.country,
      city: plan.city,
      phase: plan.phase,
      target_investor_count: plan.target_investor_count,
      target_capital_eur_cents: plan.target_capital_eur_cents,
      target_liquidity_score: plan.target_liquidity_score,
      campaigns_launched: plan.campaigns_launched,
      milestones: plan.milestones,
      created_at: plan.created_at,
      updated_at: plan.updated_at,
    })
    .select()
    .single()

  if (error) {
    log.error('[expansionExecutionEngine] createExpansionPlan insert failed', error, {
      plan_id,
      city,
      country,
      tenant_id: tenantId,
    })
    throw new Error(`createExpansionPlan: ${error.message}`)
  }

  log.info('[expansionExecutionEngine] expansion plan created', {
    plan_id,
    country,
    city,
    phase: 'RESEARCH',
    tenant_id: tenantId,
  })

  return _mapPlanRow(data)
}

// ─── executeExpansionPhase ────────────────────────────────────────────────────

export async function executeExpansionPhase(
  planId: string,
  tenantId: string,
): Promise<MarketExpansionPlan> {
  // Load current plan
  const { data: planRow, error: planErr } = await (supabaseAdmin as any)
    .from('expansion_plans')
    .select('*')
    .eq('plan_id', planId)
    .eq('tenant_id', tenantId)
    .single()

  if (planErr || !planRow) {
    throw new Error(`executeExpansionPhase: plan not found — ${planId}`)
  }

  const plan = _mapPlanRow(planRow as Record<string, unknown>)
  const now = new Date().toISOString()
  const milestones = [...plan.milestones]

  // ─── Compute real milestone current values ────────────────────────────────

  // Milestone 0: INVESTOR_COUNT — from investor_kyc_records
  const { count: investorCount } = await (supabaseAdmin as any)
    .from('investor_kyc_records')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)

  const invCount = Number(investorCount ?? 0)

  // Milestone 1: CAPITAL_INFLOW — from investor_ledger_entries executed
  const { data: ledgerRows } = await (supabaseAdmin as any)
    .from('investor_ledger_entries')
    .select('amount_eur_cents')
    .eq('tenant_id', tenantId)
    .eq('entry_type', 'EXECUTED')

  const capitalInflow = ((ledgerRows ?? []) as Array<{ amount_eur_cents: number }>).reduce(
    (sum, r) => sum + Number(r.amount_eur_cents ?? 0),
    0,
  )

  // Milestone 2: LIQUIDITY_SCORE — from asset_liquidity_scores avg
  const { data: liqRows } = await (supabaseAdmin as any)
    .from('asset_liquidity_scores')
    .select('score')
    .eq('tenant_id', tenantId)
    .order('scored_at', { ascending: false })
    .limit(50)

  const liqScores = ((liqRows ?? []) as Array<{ score: number }>).map((r) => Number(r.score ?? 0))
  const avgLiquidity =
    liqScores.length > 0
      ? liqScores.reduce((sum, s) => sum + s, 0) / liqScores.length
      : 0

  // Milestone 3: FIRST_DEAL_CLOSED — from execution_outcomes
  const { count: dealCount } = await (supabaseAdmin as any)
    .from('execution_outcomes')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('status', 'CLOSED')

  const deals = Number(dealCount ?? 0)

  // Update milestone current values
  const milestoneValues = [invCount, capitalInflow, avgLiquidity, deals]
  for (let i = 0; i < milestones.length; i++) {
    const m = milestones[i]
    if (!m) continue
    m.current_value = milestoneValues[i] ?? 0
    if (!m.achieved && m.current_value >= m.target_value) {
      m.achieved = true
      m.achieved_at = now
    }
  }

  // ─── Phase advancement logic ──────────────────────────────────────────────

  let newPhase: ExpansionPhase = plan.phase
  const campaignsLaunched = [...plan.campaigns_launched]

  const m0 = milestones[0]
  const m1 = milestones[1]
  const m2 = milestones[2]
  const m3 = milestones[3]

  if (
    plan.phase === 'RESEARCH' &&
    m0 && m1 &&
    (m0.current_value / m0.target_value >= 0.5 || m1.current_value / m1.target_value >= 0.5)
  ) {
    newPhase = 'SOFT_LAUNCH'
    // Launch SOFT_LAUNCH campaign
    void launchMigrationCampaign(plan.city, 'HIGH_CAPITAL_VELOCITY', tenantId)
      .then((c) => {
        campaignsLaunched.push(c.campaign_id)
      })
      .catch((e: unknown) =>
        log.warn('[expansionExecutionEngine] SOFT_LAUNCH campaign failed', {
          error: String(e),
          plan_id: planId,
        }),
      )
  } else if (
    plan.phase === 'SOFT_LAUNCH' &&
    m0 && m1 &&
    m0.achieved && m1.achieved
  ) {
    newPhase = 'ACTIVE_EXPANSION'
    void launchMigrationCampaign(plan.city, 'INSTITUTIONAL_BUYER', tenantId)
      .then((c) => {
        campaignsLaunched.push(c.campaign_id)
      })
      .catch((e: unknown) =>
        log.warn('[expansionExecutionEngine] ACTIVE_EXPANSION campaign failed', {
          error: String(e),
          plan_id: planId,
        }),
      )
  } else if (plan.phase === 'ACTIVE_EXPANSION' && m2 && m2.achieved) {
    newPhase = 'OPTIMIZATION'
    void launchMigrationCampaign(plan.city, 'COST_SENSITIVE', tenantId)
      .then((c) => {
        campaignsLaunched.push(c.campaign_id)
      })
      .catch((e: unknown) =>
        log.warn('[expansionExecutionEngine] OPTIMIZATION campaign failed', {
          error: String(e),
          plan_id: planId,
        }),
      )
  } else if (plan.phase === 'OPTIMIZATION' && m3 && m3.achieved) {
    newPhase = 'MATURE'
  }

  // ─── Persist updated plan ─────────────────────────────────────────────────

  const { data: updated, error: updateErr } = await (supabaseAdmin as any)
    .from('expansion_plans')
    .update({
      phase: newPhase,
      milestones,
      campaigns_launched: campaignsLaunched,
      updated_at: now,
    })
    .eq('plan_id', planId)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (updateErr) {
    throw new Error(`executeExpansionPhase: update failed — ${updateErr.message}`)
  }

  if (newPhase !== plan.phase) {
    log.info('[expansionExecutionEngine] phase advanced', {
      plan_id: planId,
      from: plan.phase,
      to: newPhase,
      tenant_id: tenantId,
    })
  }

  return _mapPlanRow(updated as Record<string, unknown>)
}

// ─── getActiveExpansions ──────────────────────────────────────────────────────

export async function getActiveExpansions(
  tenantId: string,
): Promise<MarketExpansionPlan[]> {
  const { data, error } = await (supabaseAdmin as any)
    .from('expansion_plans')
    .select('*')
    .eq('tenant_id', tenantId)
    .neq('phase', 'MATURE')
    .order('updated_at', { ascending: false })

  if (error) {
    log.warn('[expansionExecutionEngine] getActiveExpansions failed', {
      error: error.message,
      tenant_id: tenantId,
    })
    return []
  }

  return ((data ?? []) as Array<Record<string, unknown>>).map(_mapPlanRow)
}

// ─── getExpansionProgress ─────────────────────────────────────────────────────

export async function getExpansionProgress(
  planId: string,
  tenantId: string,
): Promise<{
  plan: MarketExpansionPlan
  current_metrics: Record<string, number>
  next_milestone: ExpansionMilestone | null
}> {
  const { data: planRow, error: planErr } = await (supabaseAdmin as any)
    .from('expansion_plans')
    .select('*')
    .eq('plan_id', planId)
    .eq('tenant_id', tenantId)
    .single()

  if (planErr || !planRow) {
    throw new Error(`getExpansionProgress: plan not found — ${planId}`)
  }

  const plan = _mapPlanRow(planRow as Record<string, unknown>)

  // Compute current metrics from real tables
  const [kycResult, ledgerResult, liqResult, dealResult] = await Promise.all([
    (supabaseAdmin as any)
      .from('investor_kyc_records')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId),
    (supabaseAdmin as any)
      .from('investor_ledger_entries')
      .select('amount_eur_cents')
      .eq('tenant_id', tenantId)
      .eq('entry_type', 'EXECUTED'),
    (supabaseAdmin as any)
      .from('asset_liquidity_scores')
      .select('score')
      .eq('tenant_id', tenantId)
      .order('scored_at', { ascending: false })
      .limit(50),
    (supabaseAdmin as any)
      .from('execution_outcomes')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'CLOSED'),
  ])

  const investor_count = Number(kycResult.count ?? 0)
  const capital_inflow = ((ledgerResult.data ?? []) as Array<{ amount_eur_cents: number }>).reduce(
    (sum, r) => sum + Number(r.amount_eur_cents ?? 0),
    0,
  )
  const liqScores = ((liqResult.data ?? []) as Array<{ score: number }>).map((r) =>
    Number(r.score ?? 0),
  )
  const avg_liquidity_score =
    liqScores.length > 0
      ? liqScores.reduce((sum, s) => sum + s, 0) / liqScores.length
      : 0
  const deals_closed = Number(dealResult.count ?? 0)

  const current_metrics: Record<string, number> = {
    investor_count,
    capital_inflow,
    avg_liquidity_score,
    deals_closed,
  }

  // Find next unachieved milestone
  const next_milestone =
    plan.milestones.find((m) => !m.achieved) ?? null

  return { plan, current_metrics, next_milestone }
}

export { DEFAULT_TENANT_ID as EXPANSION_DEFAULT_TENANT_ID }
