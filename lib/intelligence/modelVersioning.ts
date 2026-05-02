// =============================================================================
// Agency Group — Model Versioning + Scoring Simulation Engine
// lib/intelligence/modelVersioning.ts
//
// Phase 2: Advanced Calibration / Simulation Engine
//
// Tracks scoring model versions and provides a simulation sandbox to
// compare candidate model changes against production behavior before
// any production deployment.
//
// Simulation is READ-ONLY against the historical data — never modifies
// production scores. All changes require explicit admin promotion.
//
// PURE FUNCTIONS:
//   buildModelVersion, compareScoreDistributions, computeBacktestMetrics,
//   computeGradeDistribution, computeModelDelta
//
// DB FUNCTIONS:
//   createModelVersion, getModelVersions, getProductionVersion,
//   runSimulation, promoteModelVersion, archiveModelVersion
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ModelStatus = 'draft' | 'staging' | 'production' | 'archived'

export interface ModelVersionConfig {
  version:   string
  weights?:  Record<string, number>
  thresholds?: {
    grade_A_plus?: number
    grade_A?:      number
    grade_B?:      number
    grade_C?:      number
  }
  notes?:    string
}

export interface ModelVersionPayload {
  version_name:   string
  scorer_version: string
  description?:   string
  config:         ModelVersionConfig
  created_by?:    string
}

export interface GradeDistribution {
  'A+': number
  'A':  number
  'B':  number
  'C':  number
  'D':  number
  total: number
}

export interface BacktestMetrics {
  grade_accuracy_pct:     number    // % of grades that matched actual close
  mean_absolute_error:    number    // MAE on raw score vs outcome
  grade_distribution:     GradeDistribution
  upgrades_vs_production: number    // properties that would score higher
  downgrades_vs_production: number  // properties that would score lower
  net_change_count:       number
  avg_score_delta:        number    // mean(newScore - oldScore)
}

export interface SimulationResult {
  property_id:     string
  current_score:   number
  simulated_score: number
  delta:           number
  current_grade:   string
  simulated_grade: string
  grade_changed:   boolean
}

export interface ModelVersion {
  id:             string
  version_name:   string
  scorer_version: string
  description:    string | null
  config:         ModelVersionConfig
  status:         ModelStatus
  backtest_score: number | null
  promoted_at:    string | null
  promoted_by:    string | null
  archived_at:    string | null
  created_at:     string
  created_by:     string | null
}

// ---------------------------------------------------------------------------
// PURE: Build a model version payload
// ---------------------------------------------------------------------------

export function buildModelVersion(
  versionName:   string,
  scorerVersion: string,
  config:        ModelVersionConfig,
  opts: {
    description?: string
    createdBy?:   string
  } = {},
): ModelVersionPayload {
  return {
    version_name:   versionName,
    scorer_version: scorerVersion,
    description:    opts.description,
    config,
    created_by:     opts.createdBy,
  }
}

// ---------------------------------------------------------------------------
// PURE: Compute grade from score using configurable thresholds
// ---------------------------------------------------------------------------

export function scoreToGrade(
  score:      number,
  thresholds: NonNullable<ModelVersionConfig['thresholds']> = {},
): string {
  const { grade_A_plus = 85, grade_A = 70, grade_B = 55, grade_C = 40 } = thresholds
  if (score >= grade_A_plus) return 'A+'
  if (score >= grade_A)      return 'A'
  if (score >= grade_B)      return 'B'
  if (score >= grade_C)      return 'C'
  return 'D'
}

// ---------------------------------------------------------------------------
// PURE: Compute grade distribution from a list of scores
// ---------------------------------------------------------------------------

export function computeGradeDistribution(
  scores:     number[],
  thresholds: NonNullable<ModelVersionConfig['thresholds']> = {},
): GradeDistribution {
  const dist: GradeDistribution = { 'A+': 0, 'A': 0, 'B': 0, 'C': 0, 'D': 0, total: scores.length }
  for (const s of scores) {
    const g = scoreToGrade(s, thresholds)
    dist[g as keyof Omit<GradeDistribution, 'total'>]++
  }
  return dist
}

// ---------------------------------------------------------------------------
// PURE: Compare two score distributions and produce delta metrics
// ---------------------------------------------------------------------------

export function computeModelDelta(
  results: SimulationResult[],
): Pick<BacktestMetrics, 'upgrades_vs_production' | 'downgrades_vs_production' | 'net_change_count' | 'avg_score_delta'> {
  if (results.length === 0) {
    return { upgrades_vs_production: 0, downgrades_vs_production: 0, net_change_count: 0, avg_score_delta: 0 }
  }
  const upgrades   = results.filter(r => r.delta > 2).length
  const downgrades = results.filter(r => r.delta < -2).length
  const changed    = results.filter(r => r.grade_changed).length
  const avgDelta   = results.reduce((s, r) => s + r.delta, 0) / results.length
  return {
    upgrades_vs_production:   upgrades,
    downgrades_vs_production: downgrades,
    net_change_count:         changed,
    avg_score_delta:          Math.round(avgDelta * 100) / 100,
  }
}

// ---------------------------------------------------------------------------
// PURE: Compute backtest metrics from simulation results + outcome data
// ---------------------------------------------------------------------------

export function computeBacktestMetrics(
  results:    SimulationResult[],
  outcomes:   Array<{ property_id: string; won: boolean }>,
  thresholds: NonNullable<ModelVersionConfig['thresholds']> = {},
): BacktestMetrics {
  if (results.length === 0) {
    return {
      grade_accuracy_pct:       0,
      mean_absolute_error:      0,
      grade_distribution:       computeGradeDistribution([]),
      upgrades_vs_production:   0,
      downgrades_vs_production: 0,
      net_change_count:         0,
      avg_score_delta:          0,
    }
  }

  const outcomeMap = new Map(outcomes.map(o => [o.property_id, o.won]))

  // Grade accuracy: high-grade (A+/A) properties that were actually won
  let gradeMatches = 0
  let gradeTotal   = 0
  let maeSum       = 0

  for (const r of results) {
    const won = outcomeMap.get(r.property_id)
    if (won !== undefined) {
      gradeTotal++
      const isHighGrade  = ['A+', 'A'].includes(r.simulated_grade)
      if ((won && isHighGrade) || (!won && !isHighGrade)) gradeMatches++
      // MAE: won=100, lost=0 as outcome proxy
      maeSum += Math.abs(r.simulated_score - (won ? 100 : 0))
    }
  }

  const delta = computeModelDelta(results)

  return {
    grade_accuracy_pct:     gradeTotal > 0 ? Math.round(gradeMatches / gradeTotal * 10000) / 100 : 0,
    mean_absolute_error:    results.length > 0 ? Math.round(maeSum / results.length * 100) / 100 : 0,
    grade_distribution:     computeGradeDistribution(results.map(r => r.simulated_score), thresholds),
    ...delta,
  }
}

// ---------------------------------------------------------------------------
// DB: Create a new model version
// ---------------------------------------------------------------------------

export async function createModelVersion(payload: ModelVersionPayload): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from('model_versions')
    .insert({
      version_name:   payload.version_name,
      scorer_version: payload.scorer_version,
      description:    payload.description   ?? null,
      config:         payload.config,
      status:         'draft',
      created_by:     payload.created_by    ?? null,
      created_at:     new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) throw new Error(`createModelVersion: ${error.message}`)
  return data.id as string
}

// ---------------------------------------------------------------------------
// DB: List model versions
// ---------------------------------------------------------------------------

export async function getModelVersions(opts: {
  status?: ModelStatus
  limit?:  number
} = {}): Promise<ModelVersion[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabaseAdmin as any)
    .from('model_versions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 20)

  if (opts.status) query = query.eq('status', opts.status)

  const { data, error } = await query
  if (error) throw new Error(`getModelVersions: ${error.message}`)
  return (data ?? []) as ModelVersion[]
}

// ---------------------------------------------------------------------------
// DB: Get current production version
// ---------------------------------------------------------------------------

export async function getProductionVersion(): Promise<ModelVersion | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabaseAdmin as any)
    .from('model_versions')
    .select('*')
    .eq('status', 'production')
    .order('promoted_at', { ascending: false })
    .limit(1)
    .single()

  return data as ModelVersion | null
}

// ---------------------------------------------------------------------------
// DB: Run a scoring simulation (create record + mark running)
// ---------------------------------------------------------------------------

export async function createSimulation(opts: {
  modelVersionId: string
  simulationName: string
  description?:   string
  propertyIds?:   string[]
  runBy:          string
}): Promise<string> {
  const now = new Date().toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from('calibration_simulations')
    .insert({
      model_version_id: opts.modelVersionId,
      simulation_name:  opts.simulationName,
      description:      opts.description   ?? null,
      property_count:   opts.propertyIds?.length ?? null,
      property_ids:     opts.propertyIds ?? null,
      status:           'running',
      run_by:           opts.runBy,
      started_at:       now,
      created_at:       now,
    })
    .select('id')
    .single()

  if (error) throw new Error(`createSimulation: ${error.message}`)
  return data.id as string
}

// ---------------------------------------------------------------------------
// DB: Persist simulation results
// ---------------------------------------------------------------------------

export async function completeSimulation(opts: {
  simulationId: string
  results:      SimulationResult[]
  metrics:      BacktestMetrics
  comparison:   Record<string, unknown>
}): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabaseAdmin as any)
    .from('calibration_simulations')
    .update({
      score_results: opts.results,
      metrics:       opts.metrics,
      comparison:    opts.comparison,
      status:        'complete',
      completed_at:  new Date().toISOString(),
    })
    .eq('id', opts.simulationId)

  if (error) throw new Error(`completeSimulation: ${error.message}`)

  // Update backtest_score on the version
  const sim = opts.results
  if (sim.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: simRow } = await (supabaseAdmin as any)
      .from('calibration_simulations')
      .select('model_version_id')
      .eq('id', opts.simulationId)
      .single()

    if (simRow?.model_version_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabaseAdmin as any)
        .from('model_versions')
        .update({ backtest_score: opts.metrics.grade_accuracy_pct })
        .eq('id', simRow.model_version_id)
    }
  }
}

// ---------------------------------------------------------------------------
// DB: Promote a model version to production (demotes current)
// ---------------------------------------------------------------------------

export async function promoteModelVersion(
  versionId:   string,
  promotedBy:  string,
): Promise<void> {
  const now = new Date().toISOString()

  // Archive all current production versions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabaseAdmin as any)
    .from('model_versions')
    .update({ status: 'archived', archived_at: now, archived_by: promotedBy })
    .eq('status', 'production')

  // Promote the new version
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabaseAdmin as any)
    .from('model_versions')
    .update({ status: 'production', promoted_at: now, promoted_by: promotedBy })
    .eq('id', versionId)
    .in('status', ['draft', 'staging'])

  if (error) throw new Error(`promoteModelVersion: ${error.message}`)
}

// ---------------------------------------------------------------------------
// DB: Archive a model version
// ---------------------------------------------------------------------------

export async function archiveModelVersion(
  versionId:  string,
  archivedBy: string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabaseAdmin as any)
    .from('model_versions')
    .update({
      status:      'archived',
      archived_at: new Date().toISOString(),
      archived_by: archivedBy,
    })
    .eq('id', versionId)
    .neq('status', 'production')  // cannot archive production directly — must promote another first

  if (error) throw new Error(`archiveModelVersion: ${error.message}`)
}
