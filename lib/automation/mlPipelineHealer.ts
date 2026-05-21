// Agency Group — ML Pipeline Healer
// lib/automation/mlPipelineHealer.ts
// Detects stale ML jobs, re-triggers retraining, rolls back to last checkpoint.
// NEVER deletes model checkpoints. Only signals, never executes training directly.

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MLPipelineStatus {
  pipeline_name: string
  last_run_at: string | null
  status: 'HEALTHY' | 'STALE' | 'FAILED' | 'UNKNOWN'
  staleness_hours: number
  checkpoint_available: boolean
  action_taken: 'NONE' | 'RETRAIN_SIGNAL_SENT' | 'ROLLBACK_SIGNAL_SENT' | 'ALERT_EMITTED'
}

export interface MLHealingReport {
  tenant_id: string
  generated_at: string
  pipelines_checked: number
  pipelines_healed: number
  statuses: MLPipelineStatus[]
  overall_ml_health: 'HEALTHY' | 'DEGRADED' | 'CRITICAL'
}

// ─── STALE threshold ──────────────────────────────────────────────────────────

const STALE_THRESHOLD_HOURS = 168 // 7 days

// ─── computeStalenessHours ────────────────────────────────────────────────────

function computeStalenessHours(lastRunAt: string | null): number {
  if (!lastRunAt) return 999999
  const lastRun = new Date(lastRunAt).getTime()
  const now = Date.now()
  return (now - lastRun) / (1000 * 60 * 60)
}

// ─── emitRetrainSignal ────────────────────────────────────────────────────────

async function emitRetrainSignal(
  pipelineName: string,
  tenantId: string,
  reason: string,
  priority: 'HIGH' | 'NORMAL',
): Promise<void> {
  const { error } = await (supabaseAdmin as any).from('ml_retraining_signals').insert({
    tenant_id: tenantId,
    pipeline_name: pipelineName,
    reason,
    priority,
    emitted_at: new Date().toISOString(),
  })

  if (error) {
    log.info('[mlPipelineHealer] emitRetrainSignal error', {
      pipelineName,
      error: error.message,
    })
  } else {
    log.info('[mlPipelineHealer] retrain signal emitted', { pipelineName, reason, priority })
  }
}

// ─── emitRollbackSignal ───────────────────────────────────────────────────────

async function emitRollbackSignal(
  pipelineName: string,
  tenantId: string,
  targetCheckpoint: string | null,
  reason: string,
): Promise<void> {
  const { error } = await (supabaseAdmin as any).from('ml_rollback_signals').insert({
    tenant_id: tenantId,
    pipeline_name: pipelineName,
    target_checkpoint: targetCheckpoint,
    reason,
    emitted_at: new Date().toISOString(),
  })

  if (error) {
    log.info('[mlPipelineHealer] emitRollbackSignal error', {
      pipelineName,
      error: error.message,
    })
  } else {
    log.info('[mlPipelineHealer] rollback signal emitted', { pipelineName, targetCheckpoint })
  }
}

// ─── checkMLPipelineHealth ────────────────────────────────────────────────────

/**
 * Checks ml_model_registry for stale or failed pipelines.
 * Emits retrain/rollback signals as needed (never executes training directly).
 * Gracefully skips if ml_model_registry table is missing.
 * Persists report to ml_healing_reports.
 */
export async function checkMLPipelineHealth(tenantId: string): Promise<MLHealingReport> {
  const generatedAt = new Date().toISOString()
  const statuses: MLPipelineStatus[] = []
  let pipelinesHealed = 0

  try {
    const { data: models, error: registryError } = await (supabaseAdmin as any)
      .from('ml_model_registry')
      .select('pipeline_name, last_trained_at, training_status, checkpoint_path, model_version')
      .eq('tenant_id', tenantId)

    if (registryError) {
      // Gracefully skip — table may not exist yet
      log.info('[mlPipelineHealer] ml_model_registry unavailable — skipping', {
        error: registryError.message,
      })
    } else {
      const rows = (
        models as {
          pipeline_name: string
          last_trained_at: string | null
          training_status: string | null
          checkpoint_path: string | null
          model_version: string | null
        }[]
      ) ?? []

      for (const row of rows) {
        const stalenessHours = computeStalenessHours(row.last_trained_at)
        const isFailed = row.training_status === 'failed'
        const isStale = stalenessHours > STALE_THRESHOLD_HOURS
        const checkpointAvailable =
          row.checkpoint_path != null && row.checkpoint_path.trim().length > 0

        let pipelineStatus: MLPipelineStatus['status'] = 'HEALTHY'
        if (isFailed) {
          pipelineStatus = 'FAILED'
        } else if (isStale) {
          pipelineStatus = 'STALE'
        }

        let actionTaken: MLPipelineStatus['action_taken'] = 'NONE'

        if (isFailed || isStale) {
          // Emit retrain signal
          try {
            await emitRetrainSignal(
              row.pipeline_name,
              tenantId,
              isFailed ? 'Training status is failed' : `Stale: ${Math.round(stalenessHours)}h since last run`,
              isFailed ? 'HIGH' : 'NORMAL',
            )
            actionTaken = 'RETRAIN_SIGNAL_SENT'
            pipelinesHealed++
          } catch (err) {
            log.info('[mlPipelineHealer] retrain signal error', {
              pipelineName: row.pipeline_name,
              error: String(err),
            })
            actionTaken = 'ALERT_EMITTED'
          }

          // For FAILED pipelines: also emit rollback signal if checkpoint available
          if (isFailed && checkpointAvailable) {
            try {
              await emitRollbackSignal(
                row.pipeline_name,
                tenantId,
                row.checkpoint_path,
                'Training failed — rolling back to last checkpoint',
              )
              // Keep RETRAIN_SIGNAL_SENT as primary action (retrain also fired)
              if (actionTaken !== 'RETRAIN_SIGNAL_SENT') {
                actionTaken = 'ROLLBACK_SIGNAL_SENT'
              }
            } catch (err) {
              log.info('[mlPipelineHealer] rollback signal error', {
                pipelineName: row.pipeline_name,
                error: String(err),
              })
            }
          }
        }

        statuses.push({
          pipeline_name: row.pipeline_name,
          last_run_at: row.last_trained_at,
          status: pipelineStatus,
          staleness_hours: Math.round(stalenessHours * 10) / 10,
          checkpoint_available: checkpointAvailable,
          action_taken: actionTaken,
        })
      }
    }
  } catch (err) {
    log.info('[mlPipelineHealer] unexpected error during pipeline check', { error: String(err) })
  }

  // Compute overall health
  const failedCount = statuses.filter(s => s.status === 'FAILED').length
  const staleCount = statuses.filter(s => s.status === 'STALE').length
  const total = statuses.length

  let overall_ml_health: MLHealingReport['overall_ml_health'] = 'HEALTHY'
  if (total === 0) {
    overall_ml_health = 'HEALTHY'
  } else if (failedCount > 0 || staleCount / total > 0.5) {
    overall_ml_health = 'CRITICAL'
  } else if (staleCount > 0) {
    overall_ml_health = 'DEGRADED'
  }

  const report: MLHealingReport = {
    tenant_id: tenantId,
    generated_at: generatedAt,
    pipelines_checked: statuses.length,
    pipelines_healed: pipelinesHealed,
    statuses,
    overall_ml_health,
  }

  // Persist report (fire-and-forget)
  void (supabaseAdmin as any)
    .from('ml_healing_reports')
    .insert({
      tenant_id: tenantId,
      generated_at: generatedAt,
      pipelines_checked: report.pipelines_checked,
      pipelines_healed: report.pipelines_healed,
      overall_ml_health: report.overall_ml_health,
      statuses: JSON.stringify(statuses),
    })
    .catch((e: unknown) => console.warn('[mlPipelineHealer] persist report error', e))

  log.info('[mlPipelineHealer] healing report generated', {
    pipelines_checked: report.pipelines_checked,
    pipelines_healed: report.pipelines_healed,
    overall_ml_health: report.overall_ml_health,
  })

  return report
}
