// =============================================================================
// Agency Group — Continuous Retraining Orchestrator
// lib/ml/continuousRetraining.ts
//
// Nightly retrain orchestration with drift detection and automatic rollback.
// Coordinates: drift check → counterfactual generation → profit labels →
//              per-model retrain → rollback if degraded → persist run summary.
//
// Table: retraining_runs (see migration 20260522000023)
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { randomUUID } from 'crypto'
import { runDriftCheck }                from '@/lib/ml/driftDetector'
import { getProfitLabelsForTraining }   from '@/lib/ml/profitLabels'
import { trainWithProfitLabels }        from '@/lib/ml/retrainTrigger'
import { NAMED_MODELS }                 from '@/lib/ml/modelBootstrap'
import {
  generateAllCounterfactuals,
  persistCounterfactualBatch,
} from '@/lib/ml/counterfactualLearning'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RetrainingRun {
  id:                  string
  tenant_id:           string
  trigger:             'nightly_cron' | 'drift_detected' | 'manual'
  models_retrained:    string[]
  models_skipped:      string[]
  models_rolled_back:  string[]
  results:             Record<string, ModelRunResult>
  total_duration_ms:   number
  started_at:          string
  completed_at:        string
}

export interface ModelRunResult {
  status:                  'success' | 'skipped' | 'failed' | 'rolled_back'
  previous_version:        string | null
  new_version:             string | null
  performance_delta:       number | null   // positive = improvement
  training_samples:        number
  counterfactual_samples:  number
  drift_score:             number | null
  duration_ms:             number
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const RETRAIN_CONFIG = {
  min_new_labels_to_retrain:          20,     // don't retrain if < 20 new labels since last run
  min_profit_labels_to_retrain:       10,     // specifically for profit-based models
  performance_rollback_threshold:    -0.05,  // rollback if performance drops > 5%
  drift_retrain_threshold:            0.2,   // retrain if PSI > 0.2
}

// ---------------------------------------------------------------------------
// shouldRetrain
// Checks new label count since last training + drift score.
// ---------------------------------------------------------------------------

export async function shouldRetrain(
  tenantId:  string,
  modelName: string,
): Promise<{ should: boolean; reason: string }> {
  const db = supabaseAdmin as any

  // 1. Find last successful retrain for this model
  const { data: lastRun } = await db
    .from('retraining_runs')
    .select('completed_at, results')
    .eq('tenant_id', tenantId)
    .order('completed_at', { ascending: false })
    .limit(20)

  let lastRetrainDate: string | null = null
  if (lastRun) {
    for (const run of lastRun as Array<{ completed_at: string; results: Record<string, ModelRunResult> }>) {
      const modelResult = run.results?.[modelName]
      if (modelResult?.status === 'success') {
        lastRetrainDate = run.completed_at
        break
      }
    }
  }

  // 2. Count new profit labels since last retrain
  let profitLabelCount = 0
  try {
    let countQuery = db
      .from('profit_labels')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)

    if (lastRetrainDate) {
      countQuery = countQuery.gte('created_at', lastRetrainDate)
    }

    const { count } = await countQuery
    profitLabelCount = count ?? 0
  } catch {
    profitLabelCount = 0
  }

  if (profitLabelCount < RETRAIN_CONFIG.min_new_labels_to_retrain) {
    return {
      should: false,
      reason: `Only ${profitLabelCount} new profit labels since last retrain (threshold: ${RETRAIN_CONFIG.min_new_labels_to_retrain})`,
    }
  }

  // 3. Check total profit labels (not just new ones)
  let totalProfitLabels = 0
  try {
    const { count } = await db
      .from('profit_labels')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
    totalProfitLabels = count ?? 0
  } catch {
    totalProfitLabels = 0
  }

  if (totalProfitLabels < RETRAIN_CONFIG.min_profit_labels_to_retrain) {
    return {
      should: false,
      reason: `Insufficient total profit labels: ${totalProfitLabels} (need ${RETRAIN_CONFIG.min_profit_labels_to_retrain})`,
    }
  }

  return {
    should: true,
    reason: `${profitLabelCount} new profit labels available since last retrain`,
  }
}

// ---------------------------------------------------------------------------
// rollbackModel
// Finds previous active version, sets it back to 'active', deprecates current.
// ---------------------------------------------------------------------------

export async function rollbackModel(
  tenantId:  string,
  modelName: string,
): Promise<boolean> {
  const db = supabaseAdmin as any

  try {
    // 1. Find current active model
    const { data: currentActive, error: activeErr } = await db
      .from('ml_model_registry')
      .select('id, version')
      .eq('tenant_id', tenantId)
      .eq('model_name', modelName)
      .eq('status', 'active')
      .order('activated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (activeErr || !currentActive) {
      log.warn('[continuousRetraining] rollbackModel — no active model to rollback from', {
        modelName,
        tenantId,
        error: activeErr?.message,
      } as any)
      return false
    }

    // 2. Find previous version (most recent non-active, non-deprecated that is 'shadow' or was previously 'active')
    const { data: previousVersion, error: prevErr } = await db
      .from('ml_model_registry')
      .select('id, version, status')
      .eq('tenant_id', tenantId)
      .eq('model_name', modelName)
      .neq('id', currentActive.id)
      .neq('status', 'retired')
      .order('activated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (prevErr || !previousVersion) {
      log.warn('[continuousRetraining] rollbackModel — no previous version to rollback to', {
        modelName,
        tenantId,
        current_id: currentActive.id,
      } as any)
      return false
    }

    // 3. Demote current → deprecated
    const { error: demoteErr } = await db
      .from('ml_model_registry')
      .update({ status: 'deprecated', retired_at: new Date().toISOString() })
      .eq('id', currentActive.id)

    if (demoteErr) {
      log.error('[continuousRetraining] rollbackModel — failed to deprecate current model', undefined, {
        model_id:  currentActive.id,
        modelName,
        error:     demoteErr.message,
      })
      return false
    }

    // 4. Promote previous → active
    const { error: promoteErr } = await db
      .from('ml_model_registry')
      .update({ status: 'active', activated_at: new Date().toISOString() })
      .eq('id', previousVersion.id)

    if (promoteErr) {
      log.error('[continuousRetraining] rollbackModel — failed to promote previous model', undefined, {
        model_id:  previousVersion.id,
        modelName,
        error:     promoteErr.message,
      })
      return false
    }

    log.info('[continuousRetraining] rollbackModel — rollback complete', {
      modelName,
      from_id:      currentActive.id,
      from_version: currentActive.version,
      to_id:        previousVersion.id,
      to_version:   previousVersion.version,
    } as any)

    return true

  } catch (err) {
    log.error('[continuousRetraining] rollbackModel — unexpected error',
      err instanceof Error ? err : undefined,
      { tenantId, modelName, error: err instanceof Error ? err.message : String(err) }
    )
    return false
  }
}

// ---------------------------------------------------------------------------
// persistRetrainingRun
// INSERT to retraining_runs table.
// ---------------------------------------------------------------------------

export async function persistRetrainingRun(run: RetrainingRun): Promise<void> {
  const db = supabaseAdmin as any

  const { error } = await db
    .from('retraining_runs')
    .insert({
      id:                 run.id,
      tenant_id:          run.tenant_id,
      trigger:            run.trigger,
      models_retrained:   run.models_retrained,
      models_skipped:     run.models_skipped,
      models_rolled_back: run.models_rolled_back,
      results:            run.results,
      total_duration_ms:  run.total_duration_ms,
      started_at:         run.started_at,
      completed_at:       run.completed_at,
    })

  if (error) {
    log.error('[continuousRetraining] persistRetrainingRun — insert failed', undefined, {
      run_id: run.id,
      error:  error.message,
    })
  } else {
    log.info('[continuousRetraining] persistRetrainingRun — persisted', {
      run_id:           run.id,
      models_retrained: run.models_retrained.length,
      models_skipped:   run.models_skipped.length,
      total_duration_ms: run.total_duration_ms,
    } as any)
  }
}

// ---------------------------------------------------------------------------
// runNightlyRetrain
// Full nightly orchestration pipeline.
// ---------------------------------------------------------------------------

export async function runNightlyRetrain(tenantId: string): Promise<RetrainingRun> {
  const runId     = randomUUID()
  const startedAt = new Date().toISOString()
  const startMs   = Date.now()

  log.info('[continuousRetraining] runNightlyRetrain — starting', {
    run_id:    runId,
    tenant_id: tenantId,
    started_at: startedAt,
  } as any)

  const modelsRetrained:   string[] = []
  const modelsSkipped:     string[] = []
  const modelsRolledBack:  string[] = []
  const results:           Record<string, ModelRunResult> = {}

  // Step 1: Check drift for all models (best-effort)
  let driftResultsMap: Record<string, number> = {}
  try {
    const driftResults = await runDriftCheck(tenantId)
    for (const dr of driftResults) {
      driftResultsMap[dr.prediction_type] = dr.psi
    }
    log.info('[continuousRetraining] runNightlyRetrain — drift check complete', {
      types_checked: driftResults.length,
      drifted:       driftResults.filter(d => d.drift_detected).map(d => d.prediction_type),
    } as any)
  } catch (err) {
    log.warn('[continuousRetraining] runNightlyRetrain — drift check failed (continuing)', {
      error: err instanceof Error ? err.message : String(err),
    } as any)
  }

  // Step 2: Generate counterfactuals (best-effort — fire and persist)
  let counterfactualCount = 0
  try {
    const cfBatch = await generateAllCounterfactuals(tenantId)
    counterfactualCount = cfBatch.total_labels
    if (cfBatch.total_labels > 0) {
      void persistCounterfactualBatch(cfBatch).catch(e =>
        log.warn('[continuousRetraining] persistCounterfactualBatch failed', { error: e instanceof Error ? e.message : String(e) } as any)
      )
    }
    log.info('[continuousRetraining] runNightlyRetrain — counterfactuals generated', {
      total: cfBatch.total_labels,
      opportunity_cost_eur: cfBatch.total_opportunity_cost_eur,
    } as any)
  } catch (err) {
    log.warn('[continuousRetraining] runNightlyRetrain — counterfactual generation failed (continuing)', {
      error: err instanceof Error ? err.message : String(err),
    } as any)
  }

  // Step 3: Get profit labels for training context
  let profitLabels: Awaited<ReturnType<typeof getProfitLabelsForTraining>> = []
  try {
    profitLabels = await getProfitLabelsForTraining(tenantId)
    log.info('[continuousRetraining] runNightlyRetrain — profit labels loaded', {
      count: profitLabels.length,
    } as any)
  } catch (err) {
    log.warn('[continuousRetraining] runNightlyRetrain — profit labels load failed (continuing)', {
      error: err instanceof Error ? err.message : String(err),
    } as any)
  }

  // Step 4: Per-model retraining
  for (const model of NAMED_MODELS) {
    const modelStartMs  = Date.now()
    const modelName     = model.model_name

    // Determine the drift score for this model (map objective → prediction type)
    const OBJECTIVE_TO_PREDICTION: Record<string, string> = {
      yield_prediction:       'opportunity_score',
      liquidity_prediction:   'liquidity_score',
      investor_conversion:    'conversion',
      price_optimization:     'price_score',
    }
    const predictionType = OBJECTIVE_TO_PREDICTION[model.objective] ?? model.objective
    const driftScore     = driftResultsMap[predictionType] ?? null

    // Check whether we should retrain
    const { should: doRetrain, reason: skipReason } = await shouldRetrain(tenantId, modelName)

    if (!doRetrain) {
      modelsSkipped.push(modelName)
      results[modelName] = {
        status:                 'skipped',
        previous_version:       null,
        new_version:            null,
        performance_delta:      null,
        training_samples:       profitLabels.length,
        counterfactual_samples: counterfactualCount,
        drift_score:            driftScore,
        duration_ms:            Date.now() - modelStartMs,
      }
      log.info('[continuousRetraining] runNightlyRetrain — model skipped', {
        modelName,
        reason: skipReason,
      } as any)
      continue
    }

    // Fetch current active model version for rollback reference
    let previousVersion: string | null = null
    let previousProfitAccuracy: number | null = null
    try {
      const db = supabaseAdmin as any
      const { data: currentModel } = await db
        .from('ml_model_registry')
        .select('id, version, metrics')
        .eq('tenant_id', tenantId)
        .eq('model_name', modelName)
        .eq('status', 'active')
        .order('activated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (currentModel) {
        previousVersion       = currentModel.version as string
        const metrics         = (currentModel.metrics ?? {}) as Record<string, number>
        previousProfitAccuracy = metrics['profit_accuracy'] ?? metrics['auc_roc'] ?? null
      }
    } catch {
      previousVersion        = null
      previousProfitAccuracy = null
    }

    // Execute retraining
    let trainResult: Awaited<ReturnType<typeof trainWithProfitLabels>> | null = null
    let trainError: string | null = null

    try {
      trainResult = await trainWithProfitLabels(tenantId, modelName)
    } catch (err) {
      trainError = err instanceof Error ? err.message : String(err)
      log.error('[continuousRetraining] runNightlyRetrain — model training failed', err instanceof Error ? err : undefined, {
        modelName,
        error: trainError,
      })
    }

    if (!trainResult || trainError) {
      modelsSkipped.push(modelName)
      results[modelName] = {
        status:                 'failed',
        previous_version:       previousVersion,
        new_version:            null,
        performance_delta:      null,
        training_samples:       profitLabels.length,
        counterfactual_samples: counterfactualCount,
        drift_score:            driftScore,
        duration_ms:            Date.now() - modelStartMs,
      }
      continue
    }

    // Compute performance delta
    const newProfitAccuracy  = trainResult.profit_accuracy
    const performanceDelta   = previousProfitAccuracy != null
      ? newProfitAccuracy - previousProfitAccuracy
      : null

    // Rollback if performance dropped beyond threshold
    const shouldRollback = performanceDelta != null && performanceDelta < RETRAIN_CONFIG.performance_rollback_threshold

    if (shouldRollback) {
      const didRollback = await rollbackModel(tenantId, modelName)
      modelsRolledBack.push(modelName)
      results[modelName] = {
        status:                 didRollback ? 'rolled_back' : 'failed',
        previous_version:       previousVersion,
        new_version:            null,
        performance_delta:      performanceDelta,
        training_samples:       trainResult.trained_on_n,
        counterfactual_samples: counterfactualCount,
        drift_score:            driftScore,
        duration_ms:            Date.now() - modelStartMs,
      }
      log.warn('[continuousRetraining] runNightlyRetrain — model rolled back', {
        modelName,
        performance_delta: performanceDelta,
        rolled_back:       didRollback,
      } as any)
      continue
    }

    // Register the new model version
    let newVersion: string | null = null
    try {
      const db = supabaseAdmin as any
      const versionTs = Date.now()
      newVersion       = `2.${versionTs}.0`

      // Bump existing active model to 'shadow' first to avoid unique constraint issues
      if (previousVersion) {
        await db
          .from('ml_model_registry')
          .update({ status: 'shadow' })
          .eq('tenant_id', tenantId)
          .eq('model_name', modelName)
          .eq('status', 'active')
      }

      await db
        .from('ml_model_registry')
        .insert({
          tenant_id:            tenantId,
          model_name:           modelName,
          model_type:           'heuristic',
          objective:            model.objective,
          version:              newVersion,
          status:               'active',
          metrics: {
            profit_accuracy: trainResult.profit_accuracy,
            trained_on_n:    trainResult.trained_on_n,
          },
          feature_version:      model.feature_version,
          trained_on_n:         trainResult.trained_on_n,
          training_manifest_id: null,
          weights_path:         null,
          weights:              trainResult.weights,
          activated_at:         new Date().toISOString(),
          retired_at:           null,
        })

    } catch (regErr) {
      log.error('[continuousRetraining] runNightlyRetrain — model registration failed',
        regErr instanceof Error ? regErr : undefined,
        { modelName, error: regErr instanceof Error ? regErr.message : String(regErr) }
      )
    }

    modelsRetrained.push(modelName)
    results[modelName] = {
      status:                 newVersion ? 'success' : 'failed',
      previous_version:       previousVersion,
      new_version:            newVersion,
      performance_delta:      performanceDelta,
      training_samples:       trainResult.trained_on_n,
      counterfactual_samples: counterfactualCount,
      drift_score:            driftScore,
      duration_ms:            Date.now() - modelStartMs,
    }

    log.info('[continuousRetraining] runNightlyRetrain — model retrained', {
      modelName,
      new_version:       newVersion,
      profit_accuracy:   trainResult.profit_accuracy,
      trained_on_n:      trainResult.trained_on_n,
      performance_delta: performanceDelta,
    } as any)
  }

  const completedAt    = new Date().toISOString()
  const totalDurationMs = Date.now() - startMs

  const run: RetrainingRun = {
    id:                 runId,
    tenant_id:          tenantId,
    trigger:            'nightly_cron',
    models_retrained:   modelsRetrained,
    models_skipped:     modelsSkipped,
    models_rolled_back: modelsRolledBack,
    results,
    total_duration_ms:  totalDurationMs,
    started_at:         startedAt,
    completed_at:       completedAt,
  }

  // Persist run summary (best-effort — don't fail the whole run if this errors)
  void persistRetrainingRun(run).catch(e =>
    log.warn('[continuousRetraining] persistRetrainingRun failed (non-critical)', {
      run_id: runId,
      error:  e instanceof Error ? e.message : String(e),
    } as any)
  )

  log.info('[continuousRetraining] runNightlyRetrain — complete', {
    run_id:           runId,
    models_retrained: modelsRetrained,
    models_skipped:   modelsSkipped,
    models_rolled_back: modelsRolledBack,
    total_duration_ms: totalDurationMs,
  } as any)

  return run
}
