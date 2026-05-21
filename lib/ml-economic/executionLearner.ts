// Agency Group — ML Economic Execution Learner
// lib/ml-economic/executionLearner.ts
// Learns from real capital execution outcomes.
// reward = real_profit_eur_cents + liquidity_efficiency_score × 1000 + speed_bonus
// All learning from real Supabase data. No synthetic training data.

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { randomUUID } from 'crypto'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExecutionFeatures {
  price_premium_pct: number
  capital_velocity_score: number
  competition_intensity: number
  investor_type: string
  zone_demand_score: number
  days_on_market: number
  season_quarter: number
}

export interface ExecutionOutcome {
  outcome_id: string
  tenant_id: string
  settlement_id: string
  asset_id: string
  investor_id: string
  zone: string
  asset_class: string
  agreed_price_eur_cents: number
  final_price_eur_cents: number
  commission_eur_cents: number
  days_to_close: number
  competing_bids: number
  liquidity_score_at_close: number
  reward_score: number
  features: ExecutionFeatures
  recorded_at: string
}

export interface LearnedPattern {
  pattern_id: string
  tenant_id: string
  pattern_type: 'HIGH_ROI' | 'FAST_CLOSE' | 'HIGH_LIQUIDITY' | 'LOW_COMPETITION'
  conditions: Record<string, unknown>
  avg_reward: number
  sample_count: number
  confidence: number
  last_updated_at: string
}

// ─── computeRewardScore ───────────────────────────────────────────────────────

/**
 * Computes a normalized 0–1000 reward score from a capital execution outcome.
 * reward = (commission / 100_00) + (liquidity_score × 10) + max(0, (90 - days_to_close) × 5) + (competing_bids × 2)
 * Normalized by dividing by a maximum plausible raw score and scaling to 1000.
 */
export function computeRewardScore(
  outcome: Omit<ExecutionOutcome, 'reward_score' | 'outcome_id' | 'recorded_at'>,
): number {
  const commissionPoints = outcome.commission_eur_cents / 100_00
  const liquidityPoints = outcome.liquidity_score_at_close * 10
  const speedBonus = Math.max(0, (90 - outcome.days_to_close) * 5)
  const competitionBonus = outcome.competing_bids * 2

  const raw = commissionPoints + liquidityPoints + speedBonus + competitionBonus

  // Max plausible raw: commission ~€500K (5_000_000 → 500), liquidity 100→1000, speed 90d→450, bids ~20→40
  // We normalise against 2000 as the practical ceiling so elite deals near 1000
  const MAX_RAW = 2000
  const normalized = Math.min(1000, Math.round((raw / MAX_RAW) * 1000))

  return Math.max(0, normalized)
}

// ─── recordOutcome ────────────────────────────────────────────────────────────

/**
 * Computes the reward score and inserts a new execution outcome into Supabase.
 */
export async function recordOutcome(
  outcome: Omit<ExecutionOutcome, 'outcome_id' | 'recorded_at' | 'reward_score'>,
  tenantId: string,
): Promise<ExecutionOutcome> {
  const reward_score = computeRewardScore(outcome)
  const outcome_id = `eo_${randomUUID()}`
  const recorded_at = new Date().toISOString()

  const row = {
    outcome_id,
    tenant_id: tenantId,
    settlement_id: outcome.settlement_id,
    asset_id: outcome.asset_id,
    investor_id: outcome.investor_id,
    zone: outcome.zone,
    asset_class: outcome.asset_class,
    agreed_price_eur_cents: outcome.agreed_price_eur_cents,
    final_price_eur_cents: outcome.final_price_eur_cents,
    commission_eur_cents: outcome.commission_eur_cents,
    days_to_close: outcome.days_to_close,
    competing_bids: outcome.competing_bids,
    liquidity_score_at_close: outcome.liquidity_score_at_close,
    reward_score,
    features: outcome.features,
    recorded_at,
  }

  const { error } = await (supabaseAdmin as any)
    .from('execution_outcomes')
    .insert(row)

  if (error) {
    log.info('[executionLearner] recordOutcome error', { error: error.message, outcome_id })
    throw new Error(`recordOutcome failed: ${error.message}`)
  }

  log.info('[executionLearner] outcome recorded', { outcome_id, reward_score, tenantId })

  return { ...outcome, outcome_id, recorded_at, reward_score }
}

// ─── extractPatternsFromHistory ───────────────────────────────────────────────

/**
 * Reads last 90 days of execution_outcomes, identifies 4 pattern types,
 * persists to learned_patterns, and returns the patterns.
 */
export async function extractPatternsFromHistory(tenantId: string): Promise<LearnedPattern[]> {
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  const { data: outcomes, error } = await (supabaseAdmin as any)
    .from('execution_outcomes')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('recorded_at', since)
    .order('recorded_at', { ascending: false })

  if (error) {
    log.info('[executionLearner] extractPatterns read error', { error: error.message })
    return []
  }

  const rows = (outcomes ?? []) as ExecutionOutcome[]
  if (rows.length === 0) return []

  const avgCommission =
    rows.reduce((s, r) => s + r.commission_eur_cents, 0) / rows.length

  const patterns: LearnedPattern[] = []

  // ── 1. HIGH_ROI: commission > avg × 1.5, grouped by zone + asset_class ──────
  const highRoiRows = rows.filter(r => r.commission_eur_cents > avgCommission * 1.5)
  const highRoiGroups = groupBy(highRoiRows, r => `${r.zone}::${r.asset_class}`)
  for (const [key, group] of Object.entries(highRoiGroups)) {
    const [zone, asset_class] = key.split('::')
    const avgReward = avg(group.map(r => r.reward_score))
    const sample_count = group.length
    patterns.push({
      pattern_id: `pat_hiroi_${tenantId}_${slugify(zone)}_${slugify(asset_class)}`,
      tenant_id: tenantId,
      pattern_type: 'HIGH_ROI',
      conditions: { zone, asset_class, min_commission_multiplier: 1.5 },
      avg_reward: avgReward,
      sample_count,
      confidence: Math.min(1.0, sample_count / 10),
      last_updated_at: new Date().toISOString(),
    })
  }

  // ── 2. FAST_CLOSE: days_to_close < 30, grouped by investor_type + competition
  const fastRows = rows.filter(r => r.days_to_close < 30)
  const fastGroups = groupBy(
    fastRows,
    r => `${r.features.investor_type}::${competitionBand(r.competing_bids)}`,
  )
  for (const [key, group] of Object.entries(fastGroups)) {
    const [investor_type, competition_band] = key.split('::')
    const avgReward = avg(group.map(r => r.reward_score))
    const sample_count = group.length
    patterns.push({
      pattern_id: `pat_fast_${tenantId}_${slugify(investor_type)}_${slugify(competition_band)}`,
      tenant_id: tenantId,
      pattern_type: 'FAST_CLOSE',
      conditions: { investor_type, competition_band, max_days_to_close: 30 },
      avg_reward: avgReward,
      sample_count,
      confidence: Math.min(1.0, sample_count / 10),
      last_updated_at: new Date().toISOString(),
    })
  }

  // ── 3. HIGH_LIQUIDITY: liquidity_score > 60, grouped by zone + season_quarter
  const liqRows = rows.filter(r => r.liquidity_score_at_close > 60)
  const liqGroups = groupBy(
    liqRows,
    r => `${r.zone}::${r.features.season_quarter}`,
  )
  for (const [key, group] of Object.entries(liqGroups)) {
    const [zone, season_quarter] = key.split('::')
    const avgReward = avg(group.map(r => r.reward_score))
    const sample_count = group.length
    patterns.push({
      pattern_id: `pat_liq_${tenantId}_${slugify(zone)}_q${season_quarter}`,
      tenant_id: tenantId,
      pattern_type: 'HIGH_LIQUIDITY',
      conditions: { zone, season_quarter: Number(season_quarter), min_liquidity_score: 60 },
      avg_reward: avgReward,
      sample_count,
      confidence: Math.min(1.0, sample_count / 10),
      last_updated_at: new Date().toISOString(),
    })
  }

  // ── 4. LOW_COMPETITION: competing_bids === 1 (solo win) ─────────────────────
  const soloRows = rows.filter(r => r.competing_bids === 1)
  if (soloRows.length > 0) {
    const avgZoneDemand = avg(soloRows.map(r => r.features.zone_demand_score))
    const avgDaysOnMarket = avg(soloRows.map(r => r.features.days_on_market))
    const avgReward = avg(soloRows.map(r => r.reward_score))
    const sample_count = soloRows.length
    patterns.push({
      pattern_id: `pat_lowcomp_${tenantId}`,
      tenant_id: tenantId,
      pattern_type: 'LOW_COMPETITION',
      conditions: {
        competing_bids: 1,
        avg_zone_demand_score: avgZoneDemand,
        avg_days_on_market: avgDaysOnMarket,
      },
      avg_reward: avgReward,
      sample_count,
      confidence: Math.min(1.0, sample_count / 10),
      last_updated_at: new Date().toISOString(),
    })
  }

  // ── Persist patterns (upsert on pattern_id) ──────────────────────────────────
  for (const pattern of patterns) {
    void (supabaseAdmin as any)
      .from('learned_patterns')
      .upsert(pattern, { onConflict: 'pattern_id' })
      .then(({ error: e }: { error: { message: string } | null }) => {
        if (e) log.info('[executionLearner] pattern upsert error', { error: e.message, pattern_id: pattern.pattern_id })
      })
      .catch((e: unknown) => console.warn('[executionLearner] pattern upsert catch', e))
  }

  log.info('[executionLearner] patterns extracted', { count: patterns.length, tenantId })

  return patterns
}

// ─── getFlywheelMetrics ───────────────────────────────────────────────────────

/**
 * Returns flywheel velocity metrics from the last 180 days of execution outcomes.
 */
export async function getFlywheelMetrics(tenantId: string): Promise<{
  total_capital_deployed_eur_cents: number
  avg_roi_pct: number
  avg_days_to_close: number
  total_commission_eur_cents: number
  learning_cycles: number
  model_confidence: number
  flywheel_velocity: 'SLOW' | 'BUILDING' | 'FAST' | 'COMPOUNDING'
}> {
  const since = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString()

  const { data: outcomes, error: outErr } = await (supabaseAdmin as any)
    .from('execution_outcomes')
    .select('final_price_eur_cents, commission_eur_cents, days_to_close, reward_score')
    .eq('tenant_id', tenantId)
    .gte('recorded_at', since)

  if (outErr) {
    log.info('[executionLearner] getFlywheelMetrics error', { error: outErr.message })
  }

  const rows = (outcomes ?? []) as Array<{
    final_price_eur_cents: number
    commission_eur_cents: number
    days_to_close: number
    reward_score: number
  }>

  const { data: patternData } = await (supabaseAdmin as any)
    .from('learned_patterns')
    .select('confidence')
    .eq('tenant_id', tenantId)

  const patternRows = (patternData ?? []) as Array<{ confidence: number }>

  const total_capital_deployed_eur_cents = rows.reduce(
    (s, r) => s + r.final_price_eur_cents,
    0,
  )
  const total_commission_eur_cents = rows.reduce(
    (s, r) => s + r.commission_eur_cents,
    0,
  )
  const avg_roi_pct =
    total_capital_deployed_eur_cents > 0
      ? (total_commission_eur_cents / total_capital_deployed_eur_cents) * 100
      : 0
  const avg_days_to_close =
    rows.length > 0
      ? rows.reduce((s, r) => s + (r.days_to_close ?? 0), 0) / rows.length
      : 0

  const learning_cycles = rows.length
  const model_confidence =
    patternRows.length > 0
      ? patternRows.reduce((s, p) => s + p.confidence, 0) / patternRows.length
      : 0

  const flywheel_velocity: 'SLOW' | 'BUILDING' | 'FAST' | 'COMPOUNDING' =
    learning_cycles < 5
      ? 'SLOW'
      : learning_cycles < 20
        ? 'BUILDING'
        : learning_cycles < 50
          ? 'FAST'
          : 'COMPOUNDING'

  return {
    total_capital_deployed_eur_cents,
    avg_roi_pct: Math.round(avg_roi_pct * 100) / 100,
    avg_days_to_close: Math.round(avg_days_to_close * 10) / 10,
    total_commission_eur_cents,
    learning_cycles,
    model_confidence: Math.round(model_confidence * 10000) / 10000,
    flywheel_velocity,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce<Record<string, T[]>>((acc, item) => {
    const k = key(item)
    if (!acc[k]) acc[k] = []
    acc[k].push(item)
    return acc
  }, {})
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0
  return nums.reduce((s, n) => s + n, 0) / nums.length
}

function slugify(s: string): string {
  return (s ?? 'unknown').toLowerCase().replace(/[^a-z0-9]/g, '_')
}

function competitionBand(bids: number): string {
  if (bids <= 1) return 'low'
  if (bids <= 3) return 'medium'
  return 'high'
}
