// =============================================================================
// Agency Group — Safe Auto Learning Engine
// lib/intelligence/autoLearning.ts
//
// Phase 3: Safe Autonomous Learning System
//
// Controls WHEN the model is allowed to auto-update and handles the
// promotion lifecycle from draft → shadow → staged → production with
// automatic rollback if degradation is detected.
//
// SAFETY GATES (all must pass before auto-update triggers):
//   1. drift_threshold exceeded  (default: 5%)
//   2. min_sample_size reached   (default: 50 outcomes)
//   3. statistical_significance  (σ ≥ 2.0 from baseline)
//   4. backtest passed           (grade_accuracy_pct ≥ 70%)
//
// ROLLBACK TRIGGER:
//   If post-promotion accuracy drops > 8% from baseline, auto-rollback fires.
//
// PURE FUNCTIONS:
//   computeDriftSignificance, shouldTriggerAutoUpdate,
//   shouldTriggerRollback, buildAutoUpdateRecord, computePromotionReadiness
//
// DB FUNCTIONS:
//   recordAutoUpdate, triggerRollback, getActiveAutoUpdates
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LearningMetrics {
  drift_pct:              number     // observed drift from baseline (%)
  sample_size:            number     // number of new outcomes since last update
  sigma_from_baseline:    number     // standard deviations from baseline
  backtest_accuracy_pct:  number     // grade accuracy in backtest (%)
  backtest_mae:           number     // mean absolute error in backtest
}

export type PromotionStage = 'draft' | 'shadow' | 'staged' | 'production' | 'archived' | 'rolled_back'

export interface TriggerDecision {
  should_trigger:     boolean
  reason:             string
  blocking_gates:     string[]       // gates that failed
  passed_gates:       string[]
}

export interface RollbackDecision {
  should_rollback:    boolean
  reason:             string
  severity:           'none' | 'warning' | 'critical'
  accuracy_drop_pct:  number
}

export interface PromotionReadiness {
  can_promote_to:     PromotionStage | null
  current_stage:      PromotionStage
  blockers:           string[]
  confidence:         number        // 0-1
}

export interface AutoUpdateRecord {
  model_name:         string
  from_version:       string
  to_version:         string
  trigger_reason:     string
  metrics_snapshot:   LearningMetrics
  initiated_at:       string
  status:             'initiated' | 'promoted' | 'rolled_back' | 'aborted'
}

// ---------------------------------------------------------------------------
// PURE: Compute statistical drift significance
// Returns sigma (standard deviations) from baseline
// ---------------------------------------------------------------------------

export function computeDriftSignificance(
  baseline: number[],
  current:  number[],
): { sigma: number; drift_pct: number; is_significant: boolean } {
  if (baseline.length < 2 || current.length < 2) {
    return { sigma: 0, drift_pct: 0, is_significant: false }
  }

  const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length
  const std  = (arr: number[], m: number) =>
    Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / (arr.length - 1))

  const baselineMean = mean(baseline)
  const baselineStd  = std(baseline, baselineMean)
  const currentMean  = mean(current)

  const sigma    = baselineStd > 0 ? Math.abs(currentMean - baselineMean) / baselineStd : 0
  const driftPct = baselineMean > 0 ? Math.abs(currentMean - baselineMean) / baselineMean * 100 : 0

  return {
    sigma,
    drift_pct:      Math.round(driftPct * 100) / 100,
    is_significant: sigma >= 2.0,
  }
}

// ---------------------------------------------------------------------------
// PURE: Determine if auto-update should trigger
// ALL 4 safety gates must pass
// ---------------------------------------------------------------------------

export function shouldTriggerAutoUpdate(
  metrics: LearningMetrics,
  config: {
    min_drift_pct?:         number    // default 5
    min_sample_size?:       number    // default 50
    min_sigma?:             number    // default 2.0
    min_backtest_accuracy?: number    // default 70
  } = {},
): TriggerDecision {
  const minDrift       = config.min_drift_pct         ?? 5
  const minSample      = config.min_sample_size        ?? 50
  const minSigma       = config.min_sigma              ?? 2.0
  const minBacktest    = config.min_backtest_accuracy  ?? 70

  const passed:   string[] = []
  const blocking: string[] = []

  if (metrics.drift_pct >= minDrift) {
    passed.push(`drift ${metrics.drift_pct.toFixed(1)}% ≥ ${minDrift}%`)
  } else {
    blocking.push(`drift ${metrics.drift_pct.toFixed(1)}% < ${minDrift}% required`)
  }

  if (metrics.sample_size >= minSample) {
    passed.push(`sample ${metrics.sample_size} ≥ ${minSample}`)
  } else {
    blocking.push(`sample ${metrics.sample_size} < ${minSample} required`)
  }

  if (metrics.sigma_from_baseline >= minSigma) {
    passed.push(`σ ${metrics.sigma_from_baseline.toFixed(2)} ≥ ${minSigma}`)
  } else {
    blocking.push(`σ ${metrics.sigma_from_baseline.toFixed(2)} < ${minSigma} required`)
  }

  if (metrics.backtest_accuracy_pct >= minBacktest) {
    passed.push(`backtest ${metrics.backtest_accuracy_pct.toFixed(1)}% ≥ ${minBacktest}%`)
  } else {
    blocking.push(`backtest ${metrics.backtest_accuracy_pct.toFixed(1)}% < ${minBacktest}%`)
  }

  const should_trigger = blocking.length === 0
  return {
    should_trigger,
    reason: should_trigger
      ? `All safety gates passed (${passed.length}/4)`
      : `Blocked: ${blocking[0]}`,
    blocking_gates: blocking,
    passed_gates:   passed,
  }
}

// ---------------------------------------------------------------------------
// PURE: Determine if rollback should trigger
// Fires if post-promotion accuracy degrades > 8%
// ---------------------------------------------------------------------------

export function shouldTriggerRollback(
  baselineAccuracyPct:   number,
  postPromotionAccuracyPct: number,
  config: { max_drop_pct?: number } = {},
): RollbackDecision {
  const maxDrop = config.max_drop_pct ?? 8
  const drop    = baselineAccuracyPct - postPromotionAccuracyPct
  const dropPct = baselineAccuracyPct > 0 ? (drop / baselineAccuracyPct) * 100 : 0

  if (drop <= 0) {
    return { should_rollback: false, reason: 'No degradation', severity: 'none', accuracy_drop_pct: 0 }
  }

  if (dropPct < maxDrop / 2) {
    return {
      should_rollback: false,
      reason:          `Minor drop ${dropPct.toFixed(1)}% — within warning threshold`,
      severity:        'warning',
      accuracy_drop_pct: Math.round(dropPct * 100) / 100,
    }
  }

  if (dropPct >= maxDrop) {
    return {
      should_rollback:   true,
      reason:            `Accuracy dropped ${dropPct.toFixed(1)}% (threshold: ${maxDrop}%) — rollback required`,
      severity:          'critical',
      accuracy_drop_pct: Math.round(dropPct * 100) / 100,
    }
  }

  return {
    should_rollback:   false,
    reason:            `Drop ${dropPct.toFixed(1)}% below rollback threshold ${maxDrop}%`,
    severity:          'warning',
    accuracy_drop_pct: Math.round(dropPct * 100) / 100,
  }
}

// ---------------------------------------------------------------------------
// PURE: Compute promotion readiness for staged model
// ---------------------------------------------------------------------------

export function computePromotionReadiness(
  currentStage:    PromotionStage,
  metrics:         LearningMetrics,
  shadowRunHours?: number,
): PromotionReadiness {
  const blockers: string[] = []
  const stageOrder: PromotionStage[] = ['draft', 'shadow', 'staged', 'production']
  const currentIdx = stageOrder.indexOf(currentStage)

  if (currentStage === 'production') {
    return { can_promote_to: null, current_stage: currentStage, blockers: ['Already in production'], confidence: 1 }
  }
  if (currentStage === 'archived' || currentStage === 'rolled_back') {
    return { can_promote_to: null, current_stage: currentStage, blockers: ['Cannot promote archived/rolled-back model'], confidence: 0 }
  }

  // Shadow stage: need ≥24h shadow run
  if (currentStage === 'draft') {
    if ((shadowRunHours ?? 0) < 24) {
      blockers.push(`Shadow run only ${shadowRunHours ?? 0}h (need ≥24h)`)
    }
  }

  // Staging: need good backtest + sample
  if (currentStage === 'shadow') {
    if (metrics.backtest_accuracy_pct < 70) {
      blockers.push(`Backtest accuracy ${metrics.backtest_accuracy_pct.toFixed(1)}% < 70%`)
    }
    if (metrics.sample_size < 50) {
      blockers.push(`Sample size ${metrics.sample_size} < 50`)
    }
  }

  // Production: need all gates
  if (currentStage === 'staged') {
    const trigger = shouldTriggerAutoUpdate(metrics)
    if (!trigger.should_trigger) {
      blockers.push(...trigger.blocking_gates)
    }
  }

  const nextStage = blockers.length === 0 && currentIdx >= 0
    ? stageOrder[currentIdx + 1] ?? null
    : null

  const confidence = blockers.length === 0
    ? Math.min(1, metrics.backtest_accuracy_pct / 100)
    : 0

  return {
    can_promote_to: nextStage,
    current_stage:  currentStage,
    blockers,
    confidence,
  }
}

// ---------------------------------------------------------------------------
// PURE: Build auto update record for persistence
// ---------------------------------------------------------------------------

export function buildAutoUpdateRecord(
  modelName:   string,
  fromVersion: string,
  toVersion:   string,
  metrics:     LearningMetrics,
  reason:      string,
): AutoUpdateRecord {
  return {
    model_name:       modelName,
    from_version:     fromVersion,
    to_version:       toVersion,
    trigger_reason:   reason,
    metrics_snapshot: metrics,
    initiated_at:     new Date().toISOString(),
    status:           'initiated',
  }
}

// ---------------------------------------------------------------------------
// DB: Record auto update
// ---------------------------------------------------------------------------

export async function recordAutoUpdate(record: AutoUpdateRecord): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from('auto_model_updates')
    .insert({
      model_name:       record.model_name,
      from_version:     record.from_version,
      to_version:       record.to_version,
      trigger_reason:   record.trigger_reason,
      metrics_snapshot: record.metrics_snapshot,
      initiated_at:     record.initiated_at,
      status:           record.status,
    })
    .select('id')
    .single()
  if (error) throw new Error(`recordAutoUpdate: ${error.message}`)
  return data.id
}

// ---------------------------------------------------------------------------
// DB: Trigger rollback and record event
// ---------------------------------------------------------------------------

export async function triggerRollback(
  modelName:    string,
  fromVersion:  string,
  toVersion:    string,
  decision:     RollbackDecision,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabaseAdmin as any)
    .from('rollback_events')
    .insert({
      model_name:       modelName,
      from_version:     fromVersion,    // the promoted version being rolled back
      to_version:       toVersion,      // reverting to this version
      reason:           decision.reason,
      accuracy_drop_pct: decision.accuracy_drop_pct,
      severity:         decision.severity,
      triggered_at:     new Date().toISOString(),
    })
  if (error) throw new Error(`triggerRollback: ${error.message}`)
}

// ---------------------------------------------------------------------------
// DB: Get active auto updates (initiated but not completed)
// ---------------------------------------------------------------------------

export async function getActiveAutoUpdates(): Promise<AutoUpdateRecord[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from('auto_model_updates')
    .select('*')
    .eq('status', 'initiated')
    .order('initiated_at', { ascending: false })
  if (error) throw new Error(`getActiveAutoUpdates: ${error.message}`)
  return data ?? []
}
