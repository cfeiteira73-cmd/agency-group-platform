// Agency Group — Feedback Flywheel Engine
// lib/flywheel/feedbackFlywheelEngine.ts
//
// The complete feedback flywheel:
//   Supply → Scoring → Capital Match → Execution → Outcome → Learning → Optimization
//
// TypeScript strict — 0 errors

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type FlywheelStage =
  | 'SUPPLY'
  | 'SCORING'
  | 'CAPITAL_MATCH'
  | 'EXECUTION'
  | 'OUTCOME'
  | 'LEARNING'
  | 'OPTIMIZATION'

export interface FlywheelMetrics {
  flywheel_id: string
  tenant_id: string

  // Stage health (0–100 each)
  supply_score: number
  scoring_score: number
  capital_match_score: number
  execution_score: number
  outcome_score: number
  learning_score: number
  optimization_score: number

  // Flywheel velocity
  overall_velocity: number
  velocity_trend: 'ACCELERATING' | 'STABLE' | 'DECELERATING' | 'STALLED'
  bottleneck_stage: FlywheelStage | null

  // The moat
  moat_strength: number // 0–100

  computed_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(v: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, v))
}

function round2(v: number): number {
  return Math.round(v * 100) / 100
}

function bottleneckStage(metrics: {
  supply_score: number
  scoring_score: number
  capital_match_score: number
  execution_score: number
  outcome_score: number
  learning_score: number
  optimization_score: number
}): FlywheelStage | null {
  const entries: Array<[FlywheelStage, number]> = [
    ['SUPPLY', metrics.supply_score],
    ['SCORING', metrics.scoring_score],
    ['CAPITAL_MATCH', metrics.capital_match_score],
    ['EXECUTION', metrics.execution_score],
    ['OUTCOME', metrics.outcome_score],
    ['LEARNING', metrics.learning_score],
    ['OPTIMIZATION', metrics.optimization_score],
  ]
  entries.sort((a, b) => a[1] - b[1])
  const [stage, score] = entries[0]
  return score < 50 ? stage : null
}

function velocityTrend(
  current: number,
  previous: number,
): FlywheelMetrics['velocity_trend'] {
  if (previous === 0) return 'STABLE'
  const delta = current - previous
  if (current < 10) return 'STALLED'
  if (delta >= 5) return 'ACCELERATING'
  if (delta <= -5) return 'DECELERATING'
  return 'STABLE'
}

// ─── computeFlywheelMetrics ───────────────────────────────────────────────────

export async function computeFlywheelMetrics(
  tenantId: string,
): Promise<FlywheelMetrics> {
  // ── 1. supply_score: ingestion_runs success rate + providers active / 6
  const { data: ingestionRows } = await (supabaseAdmin as any)
    .from('ingestion_runs')
    .select('providers_attempted, providers_succeeded')
    .eq('tenant_id', tenantId)
    .order('run_at', { ascending: false })
    .limit(10)

  type IngestionRow = {
    providers_attempted: string[]
    providers_succeeded: string[]
  }
  const ingestions = (ingestionRows ?? []) as IngestionRow[]
  let supplyScore = 0
  if (ingestions.length > 0) {
    const totalAttempted = ingestions.reduce(
      (s, r) => s + (r.providers_attempted?.length ?? 0),
      0,
    )
    const totalSucceeded = ingestions.reduce(
      (s, r) => s + (r.providers_succeeded?.length ?? 0),
      0,
    )
    const successRate = totalAttempted > 0 ? totalSucceeded / totalAttempted : 0
    const lastRun = ingestions[0]
    const providersActive = lastRun.providers_succeeded?.length ?? 0
    supplyScore = clamp(((successRate * 0.6) + (Math.min(6, providersActive) / 6 * 0.4)) * 100)
  }

  // ── 2. scoring_score: detection_accuracy_reports close_rate * 100
  const { data: accuracyRows } = await (supabaseAdmin as any)
    .from('detection_accuracy_reports')
    .select('close_rate')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(1)

  type AccuracyRow = { close_rate: number }
  const accuracyData = (accuracyRows ?? []) as AccuracyRow[]
  const scoringScore = clamp(
    accuracyData.length > 0 ? (accuracyData[0].close_rate ?? 0) * 100 : 0,
  )

  // ── 3. capital_match_score: opportunity_investor_matches avg match_score * 100
  const { data: matchRows } = await (supabaseAdmin as any)
    .from('opportunity_investor_matches')
    .select('match_score')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(100)

  type MatchRow = { match_score: number }
  const matches = (matchRows ?? []) as MatchRow[]
  const capitalMatchScore = clamp(
    matches.length > 0
      ? (matches.reduce((s, r) => s + (r.match_score ?? 0), 0) / matches.length) * 100
      : 0,
  )

  // ── 4. execution_score: capital_execution_pipelines COMPLETED / total * 100
  const { count: totalPipelines } = await (supabaseAdmin as any)
    .from('capital_execution_pipelines')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)

  const { count: completedPipelines } = await (supabaseAdmin as any)
    .from('capital_execution_pipelines')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('overall_status', 'COMPLETED')

  const executionScore = clamp(
    (totalPipelines ?? 0) > 0
      ? ((completedPipelines ?? 0) / (totalPipelines ?? 1)) * 100
      : 0,
  )

  // ── 5. outcome_score: real_outcomes count → min(100, count * 5)
  const { count: outcomeCount } = await (supabaseAdmin as any)
    .from('real_outcomes')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)

  const outcomeScore = clamp(Math.min(100, (outcomeCount ?? 0) * 5))

  // ── 6. learning_score: ml_reality_alignments — (1 - drift_score) * 100
  const { data: driftRows } = await (supabaseAdmin as any)
    .from('ml_reality_alignments')
    .select('drift_score')
    .eq('tenant_id', tenantId)
    .order('assessed_at', { ascending: false })
    .limit(5)

  type DriftRow = { drift_score: number }
  const drifts = (driftRows ?? []) as DriftRow[]
  const learningScore = clamp(
    drifts.length > 0
      ? (1 - drifts.reduce((s, r) => s + (r.drift_score ?? 0), 0) / drifts.length) * 100
      : 0,
  )

  // ── 7. optimization_score: ml_optimization_cycles accuracy_after > accuracy_before
  const { data: cycleRows } = await (supabaseAdmin as any)
    .from('ml_optimization_cycles')
    .select('accuracy_before, accuracy_after')
    .eq('tenant_id', tenantId)
    .order('ran_at', { ascending: false })
    .limit(20)

  type CycleRow = { accuracy_before: number; accuracy_after: number }
  const cycles = (cycleRows ?? []) as CycleRow[]
  const improvingCycles = cycles.filter(
    (r) => (r.accuracy_after ?? 0) > (r.accuracy_before ?? 0),
  ).length
  const optimizationScore = clamp(
    cycles.length > 0 ? (improvingCycles / cycles.length) * 100 : 0,
  )

  // ── 8. Overall velocity
  const stageScores = [
    supplyScore,
    scoringScore,
    capitalMatchScore,
    executionScore,
    outcomeScore,
    learningScore,
    optimizationScore,
  ]
  const overallVelocity = round2(
    stageScores.reduce((s, v) => s + v, 0) / stageScores.length,
  )

  // ── 9. Velocity trend: compare with last stored metrics
  const { data: prevMetricsRows } = await (supabaseAdmin as any)
    .from('flywheel_metrics')
    .select('overall_velocity')
    .eq('tenant_id', tenantId)
    .order('computed_at', { ascending: false })
    .limit(1)

  type PrevMetricsRow = { overall_velocity: number }
  const prevData = (prevMetricsRows ?? []) as PrevMetricsRow[]
  const prevVelocity = prevData.length > 0 ? (prevData[0].overall_velocity ?? 0) : 0
  const trend = velocityTrend(overallVelocity, prevVelocity)

  // ── 10. Bottleneck
  const stagePerfMap = {
    supply_score: round2(supplyScore),
    scoring_score: round2(scoringScore),
    capital_match_score: round2(capitalMatchScore),
    execution_score: round2(executionScore),
    outcome_score: round2(outcomeScore),
    learning_score: round2(learningScore),
    optimization_score: round2(optimizationScore),
  }
  const bottleneck = bottleneckStage(stagePerfMap)

  // ── 11. Moat strength
  //    lock_in from investor_lock_in_scores avg, supply dominance avg, proprietary data count
  const { data: lockInRows } = await (supabaseAdmin as any)
    .from('investor_lock_in_scores')
    .select('lock_in_score')
    .eq('tenant_id', tenantId)
    .order('assessed_at', { ascending: false })
    .limit(50)

  type LockInRow = { lock_in_score: number }
  const lockIns = (lockInRows ?? []) as LockInRow[]
  const avgLockIn =
    lockIns.length > 0
      ? lockIns.reduce((s, r) => s + (r.lock_in_score ?? 0), 0) / lockIns.length
      : 0

  const { data: domRows } = await (supabaseAdmin as any)
    .from('supply_dominance_snapshots')
    .select('dominance_score')
    .eq('tenant_id', tenantId)
    .order('computed_at', { ascending: false })
    .limit(7)

  type DomRow = { dominance_score: number }
  const doms = (domRows ?? []) as DomRow[]
  const avgDomScore =
    doms.length > 0
      ? doms.reduce((s, r) => s + (r.dominance_score ?? 0), 0) / doms.length
      : 0

  const { count: realOutcomeCount } = await (supabaseAdmin as any)
    .from('real_outcomes')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)

  const proprietaryDataScore = clamp(Math.min(100, (realOutcomeCount ?? 0) * 2))
  const moatStrength = round2(
    clamp(avgLockIn * 0.40 + avgDomScore * 0.35 + proprietaryDataScore * 0.25),
  )

  const metrics: FlywheelMetrics = {
    flywheel_id: randomUUID(),
    tenant_id: tenantId,
    supply_score: round2(supplyScore),
    scoring_score: round2(scoringScore),
    capital_match_score: round2(capitalMatchScore),
    execution_score: round2(executionScore),
    outcome_score: round2(outcomeScore),
    learning_score: round2(learningScore),
    optimization_score: round2(optimizationScore),
    overall_velocity: overallVelocity,
    velocity_trend: trend,
    bottleneck_stage: bottleneck,
    moat_strength: moatStrength,
    computed_at: new Date().toISOString(),
  }

  // Persist
  void (supabaseAdmin as any)
    .from('flywheel_metrics')
    .insert({
      flywheel_id: metrics.flywheel_id,
      tenant_id: metrics.tenant_id,
      supply_score: metrics.supply_score,
      scoring_score: metrics.scoring_score,
      capital_match_score: metrics.capital_match_score,
      execution_score: metrics.execution_score,
      outcome_score: metrics.outcome_score,
      learning_score: metrics.learning_score,
      optimization_score: metrics.optimization_score,
      overall_velocity: metrics.overall_velocity,
      velocity_trend: metrics.velocity_trend,
      bottleneck_stage: metrics.bottleneck_stage,
      moat_strength: metrics.moat_strength,
      computed_at: metrics.computed_at,
    })
    .catch((e: unknown) =>
      log.warn('[feedbackFlywheelEngine] persist error', { e }),
    )

  log.info('[feedbackFlywheelEngine] computed', {
    tenantId,
    overall_velocity: metrics.overall_velocity,
    velocity_trend: metrics.velocity_trend,
    bottleneck_stage: metrics.bottleneck_stage,
  })

  return metrics
}

// ─── getFlywheelHistory ───────────────────────────────────────────────────────

export async function getFlywheelHistory(
  tenantId: string,
  limit = 30,
): Promise<FlywheelMetrics[]> {
  const { data, error } = await (supabaseAdmin as any)
    .from('flywheel_metrics')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('computed_at', { ascending: false })
    .limit(limit)

  if (error) {
    log.warn('[feedbackFlywheelEngine] getFlywheelHistory error', { error })
    return []
  }

  return (data ?? []) as FlywheelMetrics[]
}

// ─── identifyFlywheelBottleneck ───────────────────────────────────────────────

export async function identifyFlywheelBottleneck(tenantId: string): Promise<{
  stage: FlywheelStage
  score: number
  recommended_action: string
}> {
  const metrics = await computeFlywheelMetrics(tenantId)

  const entries: Array<[FlywheelStage, number]> = [
    ['SUPPLY', metrics.supply_score],
    ['SCORING', metrics.scoring_score],
    ['CAPITAL_MATCH', metrics.capital_match_score],
    ['EXECUTION', metrics.execution_score],
    ['OUTCOME', metrics.outcome_score],
    ['LEARNING', metrics.learning_score],
    ['OPTIMIZATION', metrics.optimization_score],
  ]

  entries.sort((a, b) => a[1] - b[1])
  const [stage, score] = entries[0]

  const actions: Record<FlywheelStage, string> = {
    SUPPLY:
      'Activate additional supply connectors and increase broker outreach campaigns',
    SCORING:
      'Review opportunity scoring thresholds — add more truth labels from recent closures',
    CAPITAL_MATCH:
      'Expand investor profiles and run targeted capital matching campaigns',
    EXECUTION:
      'Audit pipeline stalls — check legal, notary, and PSP completion rates',
    OUTCOME:
      'Capture more real closing data — integrate registry feeds and bank confirmations',
    LEARNING:
      'Retrain ML models with recent real outcomes to reduce prediction drift',
    OPTIMIZATION:
      'Run ML optimization cycles with expanded feature sets and truth labels',
  }

  return {
    stage,
    score: round2(score),
    recommended_action: actions[stage],
  }
}
