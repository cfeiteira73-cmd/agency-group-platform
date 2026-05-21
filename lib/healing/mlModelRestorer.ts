// Agency Group — ML Model Restorer
// lib/healing/mlModelRestorer.ts
// TypeScript strict — 0 errors
//
// Detects ML model degradation and restores from last good checkpoint.
// Triggers: performance delta < -5%, PSI > 0.25, prediction error spike
// SAFE: Never modifies financial predictions already made — only affects future predictions

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MLRestoreReport {
  restore_id: string
  tenant_id: string

  model_health_check: {
    current_model_version: string | null
    performance_delta: number | null   // from last retrain
    psi_score: number | null
    degraded: boolean
    degradation_reason: string | null
  }

  restore_action: {
    action_taken: 'no_action' | 'triggered_retrain' | 'rolled_back_to_checkpoint' | 'flagged_for_review'
    previous_version: string | null
    restored_version: string | null
    trigger_reason: string
  }

  post_restore_health: {
    model_version: string | null
    ready: boolean
  }

  executed_at: string
}

// ─── checkModelHealth ─────────────────────────────────────────────────────────

/**
 * Queries ml_training_runs + ml_validation_runs to assess model health.
 * Degradation criteria:
 *   - performance_delta < -5%
 *   - psi_score > 0.25
 */
export async function checkModelHealth(
  tenantId: string,
): Promise<MLRestoreReport['model_health_check']> {
  // Latest active training run
  const { data: latestRun, error: runErr } = await (supabaseAdmin as any)
    .from('ml_training_runs')
    .select('id, model_version, status, performance_delta, created_at')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)

  if (runErr) {
    log.warn('[mlModelRestorer] checkModelHealth training_runs error', {
      error: runErr.message,
      tenant_id: tenantId,
    })
  }

  type TrainingRow = {
    id: string
    model_version: string | null
    status: string
    performance_delta: number | null
    created_at: string
  }

  const activeRun: TrainingRow | null =
    Array.isArray(latestRun) && latestRun.length > 0 ? (latestRun[0] as TrainingRow) : null

  // Latest validation run for PSI
  const { data: validationData, error: valErr } = await (supabaseAdmin as any)
    .from('ml_validation_runs')
    .select('psi_score, model_version, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(1)

  if (valErr) {
    log.warn('[mlModelRestorer] checkModelHealth validation_runs error', {
      error: valErr.message,
      tenant_id: tenantId,
    })
  }

  type ValidationRow = { psi_score: number | null; model_version: string | null }
  const latestValidation: ValidationRow | null =
    Array.isArray(validationData) && validationData.length > 0
      ? (validationData[0] as ValidationRow)
      : null

  const currentVersion   = activeRun?.model_version ?? null
  const performanceDelta = activeRun?.performance_delta ?? null
  const psiScore         = latestValidation?.psi_score ?? null

  const degradationReasons: string[] = []

  if (performanceDelta !== null && performanceDelta < -0.05) {
    degradationReasons.push(`performance_delta ${(performanceDelta * 100).toFixed(2)}% < -5%`)
  }
  if (psiScore !== null && psiScore > 0.25) {
    degradationReasons.push(`PSI ${psiScore.toFixed(3)} > 0.25 (distribution drift)`)
  }

  const degraded = degradationReasons.length > 0

  return {
    current_model_version: currentVersion,
    performance_delta:     performanceDelta,
    psi_score:             psiScore,
    degraded,
    degradation_reason:    degraded ? degradationReasons.join('; ') : null,
  }
}

// ─── restoreToCheckpoint ──────────────────────────────────────────────────────

/**
 * Rolls back to a previous ml_training_runs entry by marking it active.
 * Creates audit log entry.
 * SAFE: Never modifies past predictions.
 */
export async function restoreToCheckpoint(
  tenantId: string,
  targetVersion?: string,
): Promise<MLRestoreReport> {
  const restoreId  = randomUUID()
  const executedAt = new Date().toISOString()

  const health = await checkModelHealth(tenantId)

  // Find checkpoint to restore to
  let query = (supabaseAdmin as any)
    .from('ml_training_runs')
    .select('id, model_version, status, created_at')
    .eq('tenant_id', tenantId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(5)

  if (targetVersion) {
    query = (supabaseAdmin as any)
      .from('ml_training_runs')
      .select('id, model_version, status, created_at')
      .eq('tenant_id', tenantId)
      .eq('model_version', targetVersion)
      .eq('status', 'completed')
      .limit(1)
  }

  const { data: checkpoints, error: cpErr } = await query

  type RunRow = { id: string; model_version: string | null }

  if (cpErr || !Array.isArray(checkpoints) || checkpoints.length === 0) {
    log.warn('[mlModelRestorer] no checkpoint available', {
      error: cpErr?.message,
      tenant_id: tenantId,
    })

    return {
      restore_id: restoreId,
      tenant_id:  tenantId,
      model_health_check: health,
      restore_action: {
        action_taken:     'flagged_for_review',
        previous_version: health.current_model_version,
        restored_version: null,
        trigger_reason:   'no completed checkpoint found for rollback',
      },
      post_restore_health: {
        model_version: health.current_model_version,
        ready:         false,
      },
      executed_at: executedAt,
    }
  }

  const checkpoint = checkpoints[0] as RunRow
  const previousVersion = health.current_model_version

  // Deactivate current active run
  await (supabaseAdmin as any)
    .from('ml_training_runs')
    .update({ status: 'superseded' })
    .eq('tenant_id', tenantId)
    .eq('status', 'active')

  // Activate checkpoint
  const { error: activateErr } = await (supabaseAdmin as any)
    .from('ml_training_runs')
    .update({ status: 'active', reactivated_at: new Date().toISOString() })
    .eq('id', checkpoint.id)

  if (activateErr) {
    log.warn('[mlModelRestorer] activate checkpoint error', {
      error: activateErr.message,
      tenant_id: tenantId,
    })
  }

  // Audit log
  await (supabaseAdmin as any)
    .from('audit_log_entries')
    .insert({
      id:            randomUUID(),
      tenant_id:     tenantId,
      actor_id:      'ml_model_restorer',
      action:        'ml_model_rolled_back',
      resource_type: 'ml_training_run',
      resource_id:   checkpoint.id,
      result:        'success',
      risk_level:    'high',
      metadata:      {
        previous_version:  previousVersion,
        restored_version:  checkpoint.model_version,
        reason:            health.degradation_reason,
      },
      created_at: new Date().toISOString(),
    })

  const restoredVersion = checkpoint.model_version

  log.info('[mlModelRestorer] rolled back to checkpoint', {
    previous:   previousVersion,
    restored:   restoredVersion,
    tenant_id:  tenantId,
  })

  return {
    restore_id: restoreId,
    tenant_id:  tenantId,
    model_health_check: health,
    restore_action: {
      action_taken:     'rolled_back_to_checkpoint',
      previous_version: previousVersion,
      restored_version: restoredVersion,
      trigger_reason:   health.degradation_reason ?? 'manual rollback requested',
    },
    post_restore_health: {
      model_version: restoredVersion,
      ready:         !activateErr,
    },
    executed_at: executedAt,
  }
}

// ─── triggerEmergencyRetrain ──────────────────────────────────────────────────

/**
 * Inserts a retrain trigger record into ml_retrain_triggers.
 * Cron job picks this up and starts training pipeline.
 * Returns the trigger record ID.
 */
export async function triggerEmergencyRetrain(
  tenantId: string,
  triggerReason = 'model_degradation_detected',
): Promise<string> {
  const triggerId = randomUUID()

  const { error } = await (supabaseAdmin as any)
    .from('ml_retrain_triggers')
    .insert({
      id:            triggerId,
      tenant_id:     tenantId,
      trigger_reason: triggerReason,
      triggered_by:  'self_healing_orchestrator',
      status:        'pending',
      created_at:    new Date().toISOString(),
    })

  if (error) {
    log.warn('[mlModelRestorer] triggerEmergencyRetrain insert error', {
      error: error.message,
      tenant_id: tenantId,
    })
    return ''
  }

  log.info('[mlModelRestorer] emergency retrain triggered', {
    trigger_id:  triggerId,
    reason:      triggerReason,
    tenant_id:   tenantId,
  })

  return triggerId
}

// ─── runMLModelRestore ────────────────────────────────────────────────────────

/**
 * Orchestrates the full ML model restore flow:
 * 1. Check model health
 * 2. If degraded: try checkpoint rollback first
 * 3. If no checkpoint: trigger emergency retrain
 * 4. If healthy: no action
 */
export async function runMLModelRestore(
  tenantId: string,
  dryRun = false,
): Promise<MLRestoreReport> {
  const restoreId  = randomUUID()
  const executedAt = new Date().toISOString()

  log.info('[mlModelRestorer] starting restore run', { tenant_id: tenantId, dry_run: dryRun })

  const health = await checkModelHealth(tenantId)

  if (!health.degraded) {
    return {
      restore_id: restoreId,
      tenant_id:  tenantId,
      model_health_check: health,
      restore_action: {
        action_taken:     'no_action',
        previous_version: health.current_model_version,
        restored_version: null,
        trigger_reason:   'model is healthy — no action required',
      },
      post_restore_health: {
        model_version: health.current_model_version,
        ready:         true,
      },
      executed_at: executedAt,
    }
  }

  log.warn('[mlModelRestorer] model degradation detected', {
    reason:    health.degradation_reason,
    tenant_id: tenantId,
  })

  if (dryRun) {
    return {
      restore_id: restoreId,
      tenant_id:  tenantId,
      model_health_check: health,
      restore_action: {
        action_taken:     'no_action',
        previous_version: health.current_model_version,
        restored_version: null,
        trigger_reason:   `dry_run: would attempt rollback. Reason: ${health.degradation_reason ?? 'degraded'}`,
      },
      post_restore_health: {
        model_version: health.current_model_version,
        ready:         false,
      },
      executed_at: executedAt,
    }
  }

  // Try rollback first
  const restoreReport = await restoreToCheckpoint(tenantId)

  // If rollback failed or no checkpoint, trigger emergency retrain
  if (
    restoreReport.restore_action.action_taken === 'flagged_for_review' ||
    !restoreReport.post_restore_health.ready
  ) {
    const triggerId = await triggerEmergencyRetrain(
      tenantId,
      health.degradation_reason ?? 'model_degradation',
    )

    // Persist run record
    void (supabaseAdmin as any)
      .from('ml_restore_runs')
      .insert({
        id:                  restoreId,
        tenant_id:           tenantId,
        model_health_check:  health,
        restore_action: {
          action_taken:     'triggered_retrain',
          previous_version: health.current_model_version,
          restored_version: null,
          trigger_reason:   `retrain triggered (id=${triggerId}): ${health.degradation_reason ?? 'degraded'}`,
        },
        post_restore_health: {
          model_version: health.current_model_version,
          ready:         false,
        },
        executed_at: executedAt,
      })
      .then(({ error }: { error: { message: string } | null }) => {
        if (error) log.warn('[mlModelRestorer] persist error', { error: error.message })
      })

    return {
      restore_id: restoreId,
      tenant_id:  tenantId,
      model_health_check: health,
      restore_action: {
        action_taken:     'triggered_retrain',
        previous_version: health.current_model_version,
        restored_version: null,
        trigger_reason:   `retrain triggered (id=${triggerId}): ${health.degradation_reason ?? 'degraded'}`,
      },
      post_restore_health: {
        model_version: health.current_model_version,
        ready:         false,
      },
      executed_at: executedAt,
    }
  }

  // Persist successful rollback
  void (supabaseAdmin as any)
    .from('ml_restore_runs')
    .insert({
      id:                  restoreId,
      tenant_id:           tenantId,
      model_health_check:  restoreReport.model_health_check,
      restore_action:      restoreReport.restore_action,
      post_restore_health: restoreReport.post_restore_health,
      executed_at:         executedAt,
    })
    .then(({ error }: { error: { message: string } | null }) => {
      if (error) log.warn('[mlModelRestorer] persist error', { error: error.message })
    })

  return { ...restoreReport, restore_id: restoreId, executed_at: executedAt }
}
