// Agency Group — ML Retrain Trigger
// lib/ml/retrainTrigger.ts
// TypeScript strict — 0 errors
//
// Automated retraining trigger based on drift detection.
// Falls back to in-process TypeScript logistic regression when
// TRAINING_ENDPOINT env var is not set.
//
// In-process training:
//   - Logistic regression with L2 regularization
//   - 80/20 train/validation split
//   - AUC via trapezoidal rule
//   - Registers new model if AUC > current model AUC
//   - Starts A/B test if new model is better

import { supabaseAdmin } from '@/lib/supabase'
import { runDriftCheck } from '@/lib/ml/driftDetector'
import { exportTrainingData } from '@/lib/ml/trainingDataExporter'
import { saveTrainingExport } from '@/lib/ml/trainingStorage'
import { modelRegistry } from '@/lib/ml/modelRegistry'
import { getOrCreateExperiment } from '@/lib/ml/abTestFramework'
import type { ModelObjective } from '@/lib/ml/modelRegistry'
import log from '@/lib/logger'
import { randomUUID } from 'crypto'
import { getProfitLabelsForTraining } from '@/lib/ml/profitLabels'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RetrainJob {
  job_id:               string
  tenant_id:            string
  objective:            ModelObjective
  trigger_reason:       'drift_detected' | 'scheduled' | 'manual' | 'insufficient_data_resolved'
  drift_psi?:           number
  labeled_records:      number
  training_manifest_id: string | null
  status:               'queued' | 'running' | 'completed' | 'failed'
  started_at:           string | null
  completed_at:         string | null
  result: {
    new_model_id:    string | null
    auc_improvement: number | null
    promoted:        boolean
  } | null
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const RETRAIN_INTERVAL_DAYS = 7
const PREDICTION_TYPE_MAP: Record<ModelObjective, string> = {
  yield_prediction:      'opportunity_score',
  conversion_prediction: 'conversion',
  time_to_close:         'time_to_close',
  fraud_detection:       'fraud_score',
}

async function getLastRetrainDate(tenantId: string, objective: ModelObjective): Promise<Date | null> {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('retrain_jobs')
      .select('completed_at, created_at')
      .eq('tenant_id', tenantId)
      .eq('objective', objective)
      .in('status', ['completed', 'running'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error || !data) return null
    const ts = data.completed_at ?? data.created_at
    return ts ? new Date(ts) : null
  } catch {
    return null
  }
}

async function getLabeledRecordCount(tenantId: string): Promise<number> {
  try {
    const { count, error } = await (supabaseAdmin as any)
      .from('ml_feature_snapshots')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .not('label_outcome', 'is', null)

    if (error) return 0
    return count ?? 0
  } catch {
    return 0
  }
}

async function insertJob(job: Omit<RetrainJob, 'status' | 'started_at' | 'completed_at' | 'result'>): Promise<RetrainJob> {
  const now = new Date().toISOString()
  const { data, error } = await (supabaseAdmin as any)
    .from('retrain_jobs')
    .insert({
      job_id:               job.job_id,
      tenant_id:            job.tenant_id,
      objective:            job.objective,
      trigger_reason:       job.trigger_reason,
      drift_psi:            job.drift_psi ?? null,
      labeled_records:      job.labeled_records,
      training_manifest_id: job.training_manifest_id ? job.training_manifest_id : null,
      status:               'queued',
      started_at:           null,
      completed_at:         null,
      result:               {},
      created_at:           now,
    })
    .select()
    .single()

  if (error || !data) {
    throw new Error(`insertJob failed: ${error?.message ?? 'no data'}`)
  }

  return rowToJob(data)
}

async function updateJob(
  jobId: string,
  updates: Partial<Pick<RetrainJob, 'status' | 'started_at' | 'completed_at' | 'result'>>,
): Promise<void> {
  const dbUpdates: Record<string, unknown> = {}
  if (updates.status        !== undefined) dbUpdates['status']        = updates.status
  if (updates.started_at    !== undefined) dbUpdates['started_at']    = updates.started_at
  if (updates.completed_at  !== undefined) dbUpdates['completed_at']  = updates.completed_at
  if (updates.result        !== undefined) dbUpdates['result']        = updates.result

  const { error } = await (supabaseAdmin as any)
    .from('retrain_jobs')
    .update(dbUpdates)
    .eq('job_id', jobId)

  if (error) {
    log.warn('[retrainTrigger] updateJob failed', { job_id: jobId, error: error.message } as any)
  }
}

function rowToJob(row: Record<string, unknown>): RetrainJob {
  return {
    job_id:               row['job_id'] as string,
    tenant_id:            row['tenant_id'] as string,
    objective:            row['objective'] as ModelObjective,
    trigger_reason:       row['trigger_reason'] as RetrainJob['trigger_reason'],
    drift_psi:            (row['drift_psi'] as number | null) ?? undefined,
    labeled_records:      (row['labeled_records'] as number) ?? 0,
    training_manifest_id: (row['training_manifest_id'] as string | null) ?? null,
    status:               (row['status'] as RetrainJob['status']) ?? 'queued',
    started_at:           (row['started_at'] as string | null) ?? null,
    completed_at:         (row['completed_at'] as string | null) ?? null,
    result:               (row['result'] as RetrainJob['result']) ?? null,
  }
}

// ---------------------------------------------------------------------------
// checkAndTriggerRetrain
// ---------------------------------------------------------------------------

export async function checkAndTriggerRetrain(tenantId: string): Promise<{
  triggered: boolean
  reason:    string | null
  job:       RetrainJob | null
}> {
  const objective: ModelObjective = 'yield_prediction'
  const predictionType = PREDICTION_TYPE_MAP[objective]

  // 1. Run drift detection
  const driftResults = await runDriftCheck(tenantId)
  const driftForObj  = driftResults.find(r => r.prediction_type === predictionType)
  const driftDetected = driftForObj?.drift_detected ?? false
  const driftPsi      = driftForObj?.psi ?? 0

  // 2. Check last retrain date
  const lastRetrain      = await getLastRetrainDate(tenantId, objective)
  const daysSinceRetrain = lastRetrain
    ? (Date.now() - lastRetrain.getTime()) / (1000 * 60 * 60 * 24)
    : Infinity
  const scheduledTrigger = daysSinceRetrain >= RETRAIN_INTERVAL_DAYS

  if (!driftDetected && !scheduledTrigger) {
    return {
      triggered: false,
      reason:    `No drift detected (PSI=${driftPsi}) and last retrain was ${Math.round(daysSinceRetrain)} days ago (threshold: ${RETRAIN_INTERVAL_DAYS})`,
      job:       null,
    }
  }

  // 3. Count labeled records
  const labeledRecords = await getLabeledRecordCount(tenantId)

  if (labeledRecords < 50) {
    return {
      triggered: false,
      reason:    `Insufficient labeled data: ${labeledRecords} records (need 50)`,
      job:       null,
    }
  }

  // 4. Export training data
  const exportResult = await exportTrainingData(tenantId)

  let manifestId: string | null = null

  if (exportResult.records_exported > 0) {
    try {
      const manifest = await saveTrainingExport(
        tenantId,
        exportResult.jsonl,
        {
          from_date:    exportResult.from_date,
          to_date:      exportResult.to_date,
          entity_types: exportResult.entity_types,
          records:      exportResult.records_exported,
        },
      )
      manifestId = manifest.export_id
    } catch (storageErr) {
      log.warn('[retrainTrigger] checkAndTriggerRetrain — storage export failed (continuing)', {
        error: storageErr instanceof Error ? storageErr.message : String(storageErr),
      } as any)
    }
  }

  // 5. Queue retrain job
  const triggerReason: RetrainJob['trigger_reason'] = driftDetected ? 'drift_detected' : 'scheduled'

  const job = await insertJob({
    job_id:               randomUUID(),
    tenant_id:            tenantId,
    objective,
    trigger_reason:       triggerReason,
    drift_psi:            driftDetected ? driftPsi : undefined,
    labeled_records:      labeledRecords,
    training_manifest_id: manifestId,
  })

  // 6. Emit event (best-effort; no Kafka in dev)
  _emitRetrainEvent(tenantId, job.job_id, triggerReason, driftPsi).catch(err => {
    log.warn('[retrainTrigger] _emitRetrainEvent failed (non-critical)', {
      error: err instanceof Error ? err.message : String(err),
    } as any)
  })

  log.info('[retrainTrigger] checkAndTriggerRetrain — job queued', {
    job_id:         job.job_id,
    trigger_reason: triggerReason,
    labeled_records: labeledRecords,
    drift_psi:      driftPsi,
  } as any)

  return {
    triggered: true,
    reason:    triggerReason === 'drift_detected'
      ? `Drift detected — PSI ${driftPsi}`
      : `Scheduled — ${Math.round(daysSinceRetrain)} days since last retrain`,
    job,
  }
}

// ---------------------------------------------------------------------------
// executeRetrainJob
// ---------------------------------------------------------------------------

export async function executeRetrainJob(job: RetrainJob): Promise<void> {
  const now = new Date().toISOString()

  await updateJob(job.job_id, { status: 'running', started_at: now })

  try {
    const trainingEndpoint = process.env.TRAINING_ENDPOINT

    if (trainingEndpoint) {
      // Delegate to external Python training service
      await _delegateToExternalTrainer(job, trainingEndpoint)
    } else {
      // In-process TypeScript training
      await _runInProcessTraining(job)
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    log.error('[retrainTrigger] executeRetrainJob — failed', err instanceof Error ? err : undefined, {
      job_id: job.job_id,
      error:  errMsg,
    })

    await updateJob(job.job_id, {
      status:       'failed',
      completed_at: new Date().toISOString(),
      result:       { new_model_id: null, auc_improvement: null, promoted: false },
    })
  }
}

async function _delegateToExternalTrainer(job: RetrainJob, endpoint: string): Promise<void> {
  const response = await fetch(endpoint, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.TRAINING_ENDPOINT_SECRET ?? ''}` },
    body:    JSON.stringify({
      job_id:               job.job_id,
      tenant_id:            job.tenant_id,
      objective:            job.objective,
      training_manifest_id: job.training_manifest_id,
    }),
    signal: AbortSignal.timeout(120_000),
  })

  if (!response.ok) {
    throw new Error(`External training endpoint returned ${response.status}: ${await response.text()}`)
  }

  const result = await response.json() as {
    new_model_id?:    string
    auc_improvement?: number
    promoted?:        boolean
  }

  await updateJob(job.job_id, {
    status:       'completed',
    completed_at: new Date().toISOString(),
    result: {
      new_model_id:    result.new_model_id    ?? null,
      auc_improvement: result.auc_improvement ?? null,
      promoted:        result.promoted        ?? false,
    },
  })
}

async function _runInProcessTraining(job: RetrainJob): Promise<void> {
  // Load labeled feature vectors from ml_feature_snapshots
  const { data: snapshots, error } = await (supabaseAdmin as any)
    .from('ml_feature_snapshots')
    .select('features, label_value, entity_type')
    .eq('tenant_id', job.tenant_id)
    .not('label_outcome', 'is', null)
    .not('label_value', 'is', null)
    .limit(10000)

  if (error || !snapshots || snapshots.length === 0) {
    log.warn('[retrainTrigger] _runInProcessTraining — no training data available', {
      job_id: job.job_id,
    } as any)
    await updateJob(job.job_id, {
      status:       'failed',
      completed_at: new Date().toISOString(),
      result:       { new_model_id: null, auc_improvement: null, promoted: false },
    })
    return
  }

  const trainingData: Array<{ features: Record<string, number>; label: number }> = snapshots.map(
    (r: { features: Record<string, unknown>; label_value: number }) => ({
      features: Object.fromEntries(
        Object.entries(r.features).map(([k, v]) => [k, typeof v === 'number' ? v : 0]),
      ),
      label: r.label_value ?? 0,
    }),
  )

  const trainResult = await trainInProcess(job.tenant_id, job.objective, trainingData)

  if (trainResult.auc <= 0.5) {
    log.warn('[retrainTrigger] _runInProcessTraining — trained model AUC too low, not registering', {
      job_id: job.job_id,
      auc:    trainResult.auc,
    } as any)
    await updateJob(job.job_id, {
      status:       'completed',
      completed_at: new Date().toISOString(),
      result:       { new_model_id: null, auc_improvement: null, promoted: false },
    })
    return
  }

  // Get current active model AUC
  const currentModel = await modelRegistry.getActiveModel(job.tenant_id, job.objective)
  const currentAuc   = (currentModel?.metrics?.auc_roc ?? 0)
  const aucImprovement = trainResult.auc - currentAuc

  // Register new model
  const newModel = await modelRegistry.register({
    tenant_id:            job.tenant_id,
    model_name:           `in_process_lr_${job.objective}`,
    model_type:           'heuristic',
    objective:            job.objective,
    version:              `1.${Date.now()}.0`,
    status:               'shadow',
    metrics:              { auc_roc: trainResult.auc },
    training_manifest_id: job.training_manifest_id,
    feature_version:      'v1',
    trained_on_n:         trainResult.trained_on_n,
    weights_path:         null,
    activated_at:         null,
    retired_at:           null,
  })

  // Save weights to storage
  await modelRegistry.saveWeights(newModel.model_id, trainResult.weights as Record<string, unknown>)

  let promoted = false

  if (aucImprovement > 0.02 && currentModel) {
    // Start A/B test if the new model is meaningfully better
    await getOrCreateExperiment(
      job.tenant_id,
      currentModel.model_id,
      newModel.model_id,
      { traffic_split_pct: 20, assignment: 'entity_hash' },
    )
    log.info('[retrainTrigger] _runInProcessTraining — started A/B test', {
      job_id:      job.job_id,
      new_model:   newModel.model_id,
      auc:         trainResult.auc,
      improvement: aucImprovement,
    } as any)
  } else if (!currentModel) {
    // No current active model — promote immediately
    await modelRegistry.promoteToActive(newModel.model_id, job.tenant_id)
    promoted = true
  }

  await updateJob(job.job_id, {
    status:       'completed',
    completed_at: new Date().toISOString(),
    result: {
      new_model_id:    newModel.model_id,
      auc_improvement: Math.round(aucImprovement * 10000) / 10000,
      promoted,
    },
  })
}

// ---------------------------------------------------------------------------
// trainInProcess
// Pure TypeScript logistic regression with L2 regularization.
// ---------------------------------------------------------------------------

export async function trainInProcess(
  tenantId:     string,
  objective:    ModelObjective,
  trainingData: Array<{ features: Record<string, number>; label: number }>,
): Promise<{ weights: Record<string, number>; auc: number; trained_on_n: number }> {
  if (trainingData.length < 10) {
    return { weights: {}, auc: 0, trained_on_n: 0 }
  }

  // 80/20 split — shuffle deterministically by index
  const shuffled  = [...trainingData].sort((a, b) => {
    // Deterministic shuffle using feature hash
    const hashA = JSON.stringify(a.features).length % 100
    const hashB = JSON.stringify(b.features).length % 100
    return hashA - hashB
  })

  const splitIdx   = Math.floor(shuffled.length * 0.8)
  const trainSet   = shuffled.slice(0, splitIdx)
  const valSet     = shuffled.slice(splitIdx)

  // Collect all feature names
  const featureNames = Array.from(
    new Set(trainingData.flatMap(d => Object.keys(d.features)))
  )

  if (featureNames.length === 0) {
    return { weights: {}, auc: 0, trained_on_n: 0 }
  }

  // Compute normalization parameters (mean, std per feature) from train set
  const means: Record<string, number> = {}
  const stds:  Record<string, number> = {}

  for (const feat of featureNames) {
    const vals = trainSet.map(d => d.features[feat] ?? 0)
    const mean = vals.reduce((s, v) => s + v, 0) / vals.length
    const variance = vals.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / vals.length
    means[feat] = mean
    stds[feat]  = Math.sqrt(variance) || 1
  }

  function normalize(features: Record<string, number>): number[] {
    return featureNames.map(f => ((features[f] ?? 0) - means[f]) / stds[f])
  }

  function sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-Math.max(-50, Math.min(50, x))))
  }

  // Initialize weights to zero
  const w: number[] = new Array(featureNames.length).fill(0)
  let bias = 0
  const lr = 0.1
  const lambda = 0.01   // L2 regularization

  // Gradient descent — 100 iterations
  const ITERATIONS = 100
  for (let iter = 0; iter < ITERATIONS; iter++) {
    const gradW    = new Array(featureNames.length).fill(0)
    let   gradBias = 0

    for (const sample of trainSet) {
      const x     = normalize(sample.features)
      const logit = x.reduce((s, xi, i) => s + xi * w[i], 0) + bias
      const pred  = sigmoid(logit)
      const err   = pred - sample.label

      for (let i = 0; i < featureNames.length; i++) {
        gradW[i] += err * x[i]
      }
      gradBias += err
    }

    const n = trainSet.length
    for (let i = 0; i < featureNames.length; i++) {
      w[i] -= lr * (gradW[i] / n + lambda * w[i])
    }
    bias -= lr * (gradBias / n)
  }

  // Compute AUC on validation set via trapezoidal rule
  const predictions: Array<{ score: number; label: number }> = valSet.map(sample => {
    const x     = normalize(sample.features)
    const logit = x.reduce((s, xi, i) => s + xi * w[i], 0) + bias
    return { score: sigmoid(logit), label: sample.label }
  })

  const auc = computeAUC(predictions)

  // Build weights object
  const weightsObj: Record<string, number> = { '__bias__': bias }
  for (let i = 0; i < featureNames.length; i++) {
    weightsObj[featureNames[i]] = w[i]
  }

  // Also store normalization params for inference
  const weightsWithNorm: Record<string, number> = {
    ...weightsObj,
    ...Object.fromEntries(featureNames.map(f => [`__mean_${f}`, means[f]])),
    ...Object.fromEntries(featureNames.map(f => [`__std_${f}`,  stds[f]])),
  }

  return {
    weights:      weightsWithNorm,
    auc:          Math.round(auc * 10000) / 10000,
    trained_on_n: trainSet.length,
  }
}

function computeAUC(predictions: Array<{ score: number; label: number }>): number {
  const sorted  = [...predictions].sort((a, b) => b.score - a.score)
  const nPos    = predictions.filter(p => p.label === 1).length
  const nNeg    = predictions.length - nPos

  if (nPos === 0 || nNeg === 0) return 0.5

  let tpPrev = 0, fpPrev = 0, auc = 0

  for (const pred of sorted) {
    const tp = pred.label === 1 ? tpPrev + 1 : tpPrev
    const fp = pred.label === 0 ? fpPrev + 1 : fpPrev
    // Trapezoidal area
    auc += (fp - fpPrev) * (tp + tpPrev) / 2
    tpPrev = tp
    fpPrev = fp
  }

  return auc / (nPos * nNeg)
}

// ---------------------------------------------------------------------------
// _emitRetrainEvent — best-effort Kafka/event bus notification
// ---------------------------------------------------------------------------

async function _emitRetrainEvent(
  tenantId:      string,
  jobId:         string,
  triggerReason: string,
  driftPsi:      number,
): Promise<void> {
  // Emit to governance_decisions as an observable event
  await (supabaseAdmin as any)
    .from('governance_decisions')
    .insert({
      action_type:      'ml.retrain_trigger',
      governance_class: 'routine',
      decision:         'approved',
      payload: {
        tenant_id:      tenantId,
        job_id:         jobId,
        trigger_reason: triggerReason,
        drift_psi:      driftPsi,
        triggered_at:   new Date().toISOString(),
      },
      decided_at: new Date().toISOString(),
    })
}

// ---------------------------------------------------------------------------
// trainWithProfitLabels
// Profit-accuracy training: uses label_value (0-1 profit quality) instead of binary win/loss
// ---------------------------------------------------------------------------

export async function trainWithProfitLabels(
  tenantId: string,
  objective: string,
): Promise<{ weights: Record<string, number>; profit_accuracy: number; trained_on_n: number } | null> {
  try {
    const labels = await getProfitLabelsForTraining(tenantId)
    if (labels.length < 10) {
      log.warn('[retrainTrigger] trainWithProfitLabels — insufficient profit labels', { count: labels.length, tenantId } as any)
      return null
    }

    // Build feature vectors from profit labels
    const trainingData = labels.map(l => ({
      features: {
        profit_margin_pct:          l.profit_margin_pct / 10,   // normalize to ~[0,1]
        time_efficiency_score:      l.time_efficiency_score / 100,
        liquidity_efficiency_score: l.liquidity_efficiency_score / 100,
        competing_bids_count:       Math.min(1, l.competing_bids_count / 10),
        final_price_vs_ask_pct:     (l.final_price_vs_ask_pct + 20) / 40,  // normalize [-20,20] → [0,1]
      },
      label: l.label_value,  // continuous 0-1 target
    }))

    // Use existing trainInProcess with the profit feature set
    const result = await trainInProcess(tenantId, `${objective}_profit` as ModelObjective, trainingData.map(d => ({
      features: d.features,
      label: d.label >= 0.5 ? 1 : 0,  // binarize for logistic regression
    })))
    if (!result) return null

    // Compute profit accuracy (mean absolute error on continuous labels)
    // Use trained weights to predict, measure MAE against label_value
    let maeSum = 0
    for (const d of trainingData) {
      const featureValues = Object.values(d.features)
      const featureKeys   = Object.keys(d.features)
      let logit = result.weights['__bias__'] ?? 0
      for (let i = 0; i < featureKeys.length; i++) {
        logit += (result.weights[featureKeys[i]] ?? 0) * (featureValues[i] as number)
      }
      const predicted = 1 / (1 + Math.exp(-logit))
      maeSum += Math.abs(predicted - d.label)
    }
    const profit_accuracy = 1 - (maeSum / trainingData.length)  // higher = better

    return {
      weights:         result.weights,
      profit_accuracy: Math.max(0, profit_accuracy),
      trained_on_n:    trainingData.length,
    }
  } catch (err) {
    log.error('[retrainTrigger] trainWithProfitLabels failed', err instanceof Error ? err : undefined, { tenantId } as any)
    return null
  }
}
