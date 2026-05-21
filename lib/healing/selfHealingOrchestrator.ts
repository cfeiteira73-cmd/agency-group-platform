// Agency Group — Self-Healing Orchestrator
// lib/healing/selfHealingOrchestrator.ts
// TypeScript strict — 0 errors
//
// Master self-healing coordinator. Runs all healers in sequence.
// CRITICAL RULE: Financial state (capital, escrow, settlement) is NEVER auto-corrected.
//   Any financial anomaly → audit log entry + human alert ONLY.

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { runEventStreamHealing }       from './eventStreamHealer'
import { rebuildFromClosedTransactions, rebuildLiquidityScores } from './liquidityGraphRebuilder'
import { runMLModelRestore }           from './mlModelRestorer'

// ─── Types ────────────────────────────────────────────────────────────────────

export type HealingAction =
  | 'heal_orphan_events'
  | 'trigger_replay_gaps'
  | 'rebuild_liquidity_graph'
  | 'restore_ml_checkpoint'
  | 'create_backup_snapshot'
  | 'refresh_market_calibration'
  | 'log_financial_anomaly'       // NEVER auto-fix financial state

export interface SelfHealingReport {
  healing_run_id: string
  tenant_id: string

  anomalies_detected: {
    type: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    description: string
    auto_fixable: boolean   // false for all financial anomalies
  }[]

  healing_actions: {
    action: HealingAction
    status: 'completed' | 'failed' | 'skipped' | 'deferred_to_human'
    result: string
    duration_ms: number
  }[]

  // Financial anomalies — always human review
  financial_alerts: {
    alert_type: string
    description: string
    affected_records: number
    audit_entry_id: string | null
  }[]

  system_health_before: number   // 0–100
  system_health_after: number    // 0–100
  improvement: number

  human_review_required: boolean
  human_review_items: string[]

  executed_at: string
  dry_run: boolean
}

// ─── computeSystemHealth ──────────────────────────────────────────────────────

/**
 * Computes an aggregate 0–100 health score from multiple subsystems.
 */
export async function computeSystemHealth(tenantId: string): Promise<number> {
  const now       = new Date()
  const cutoff30m = new Date(now.getTime() - 30 * 60 * 1000).toISOString()
  const cutoff48h = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString()
  const cutoff7d  = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

  let score = 100

  // -10 per 10 orphan events
  const { count: orphanCount } = await (supabaseAdmin as any)
    .from('kafka_event_log')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .is('processed_at', null)
    .lt('emitted_at', cutoff30m)

  if (typeof orphanCount === 'number' && orphanCount > 0) {
    score -= Math.min(20, Math.floor(orphanCount / 10) * 10)
  }

  // -15 if no successful ML run in 48h
  const { count: mlCount } = await (supabaseAdmin as any)
    .from('ml_training_runs')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .in('status', ['active', 'completed'])
    .gt('created_at', cutoff48h)

  if (typeof mlCount === 'number' && mlCount === 0) {
    score -= 15
  }

  // -10 if market calibration stale > 7d
  const { count: calibCount } = await (supabaseAdmin as any)
    .from('market_zone_calibrations')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .gt('calibrated_at', cutoff7d)

  if (typeof calibCount === 'number' && calibCount === 0) {
    score -= 10
  }

  // -20 if financial_consistency_audits has score < 80
  const { data: finAudits } = await (supabaseAdmin as any)
    .from('financial_consistency_audits')
    .select('score')
    .eq('tenant_id', tenantId)
    .lt('score', 80)
    .limit(1)

  if (Array.isArray(finAudits) && finAudits.length > 0) {
    score -= 20
  }

  // -15 if gap_detection_reports has production_blocked = true
  const { count: blockedCount } = await (supabaseAdmin as any)
    .from('gap_detection_reports')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('production_blocked', true)

  if (typeof blockedCount === 'number' && blockedCount > 0) {
    score -= 15
  }

  return Math.max(0, Math.min(100, score))
}

// ─── detectSystemAnomalies ────────────────────────────────────────────────────

/**
 * Runs quick checks across all subsystems to build the anomaly list.
 */
export async function detectSystemAnomalies(
  tenantId: string,
): Promise<SelfHealingReport['anomalies_detected']> {
  const anomalies: SelfHealingReport['anomalies_detected'] = []
  const now       = new Date()
  const cutoff30m = new Date(now.getTime() - 30 * 60 * 1000).toISOString()
  const cutoff48h = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString()
  const cutoff7d  = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // 1. Orphan events
  const { count: orphanCount } = await (supabaseAdmin as any)
    .from('kafka_event_log')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .is('processed_at', null)
    .lt('emitted_at', cutoff30m)

  if (typeof orphanCount === 'number' && orphanCount > 0) {
    anomalies.push({
      type:         'orphan_events',
      severity:     orphanCount > 50 ? 'high' : 'medium',
      description:  `${orphanCount} unprocessed events older than 30 minutes`,
      auto_fixable: true,
    })
  }

  // 2. Stale ML model
  const { count: mlCount } = await (supabaseAdmin as any)
    .from('ml_training_runs')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .in('status', ['active', 'completed'])
    .gt('created_at', cutoff48h)

  if (typeof mlCount === 'number' && mlCount === 0) {
    anomalies.push({
      type:         'stale_ml_model',
      severity:     'high',
      description:  'No successful ML training run in the last 48 hours',
      auto_fixable: true,
    })
  }

  // 3. Stale market calibration
  const { count: calibCount } = await (supabaseAdmin as any)
    .from('market_zone_calibrations')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .gt('calibrated_at', cutoff7d)

  if (typeof calibCount === 'number' && calibCount === 0) {
    anomalies.push({
      type:         'stale_market_calibration',
      severity:     'medium',
      description:  'No market zone calibrations updated in the last 7 days',
      auto_fixable: true,
    })
  }

  // 4. Financial consistency audit failure (NEVER auto-fix)
  const { data: finAudits } = await (supabaseAdmin as any)
    .from('financial_consistency_audits')
    .select('id, score, created_at')
    .eq('tenant_id', tenantId)
    .lt('score', 80)
    .order('created_at', { ascending: false })
    .limit(5)

  if (Array.isArray(finAudits) && finAudits.length > 0) {
    anomalies.push({
      type:         'financial_consistency_failure',
      severity:     'critical',
      description:  `${finAudits.length} financial consistency audit(s) with score < 80`,
      auto_fixable: false,  // CRITICAL: never auto-fix financial state
    })
  }

  // 5. Production-blocked gaps (NEVER auto-fix)
  const { data: blockedGaps } = await (supabaseAdmin as any)
    .from('gap_detection_reports')
    .select('id, gap_type, description')
    .eq('tenant_id', tenantId)
    .eq('production_blocked', true)
    .limit(10)

  if (Array.isArray(blockedGaps) && blockedGaps.length > 0) {
    anomalies.push({
      type:         'production_blocked_gaps',
      severity:     'critical',
      description:  `${blockedGaps.length} production-blocking gap(s) detected`,
      auto_fixable: false,  // CRITICAL: human must review
    })
  }

  return anomalies
}

// ─── executeHealingPlan ───────────────────────────────────────────────────────

/**
 * Executes healing actions for each detected anomaly.
 * Financial anomalies are always deferred to human review.
 */
export async function executeHealingPlan(
  tenantId: string,
  anomalies: SelfHealingReport['anomalies_detected'],
  dryRun: boolean,
): Promise<SelfHealingReport['healing_actions']> {
  const actions: SelfHealingReport['healing_actions'] = []

  for (const anomaly of anomalies) {
    if (!anomaly.auto_fixable) {
      // Financial / critical → always defer to human
      actions.push({
        action:      'log_financial_anomaly',
        status:      'deferred_to_human',
        result:      `deferred: ${anomaly.description}`,
        duration_ms: 0,
      })
      continue
    }

    const t0 = Date.now()

    switch (anomaly.type) {
      case 'orphan_events': {
        try {
          const report = await runEventStreamHealing(tenantId, dryRun)
          const archived = report.actions_taken.find(a => a.action === 'archive_orphan')?.count ?? 0
          const replays  = report.actions_taken.find(a => a.action === 'trigger_replay')?.count ?? 0
          actions.push({
            action:      'heal_orphan_events',
            status:      'completed',
            result:      `archived ${archived} orphans, triggered ${replays} replays`,
            duration_ms: Date.now() - t0,
          })
        } catch (err) {
          actions.push({
            action:      'heal_orphan_events',
            status:      'failed',
            result:      err instanceof Error ? err.message : String(err),
            duration_ms: Date.now() - t0,
          })
        }
        break
      }

      case 'stale_ml_model': {
        try {
          const mlReport = await runMLModelRestore(tenantId, dryRun)
          actions.push({
            action:      'restore_ml_checkpoint',
            status:      'completed',
            result:      `action: ${mlReport.restore_action.action_taken}, version: ${mlReport.post_restore_health.model_version ?? 'unknown'}`,
            duration_ms: Date.now() - t0,
          })
        } catch (err) {
          actions.push({
            action:      'restore_ml_checkpoint',
            status:      'failed',
            result:      err instanceof Error ? err.message : String(err),
            duration_ms: Date.now() - t0,
          })
        }
        break
      }

      case 'stale_market_calibration': {
        try {
          const [rebuildReport, rescored] = await Promise.all([
            rebuildFromClosedTransactions(tenantId, dryRun),
            rebuildLiquidityScores(tenantId, dryRun),
          ])
          actions.push({
            action:      'rebuild_liquidity_graph',
            status:      rebuildReport.rebuild_status === 'failed' ? 'failed' : 'completed',
            result:      `zones_recalibrated: ${rebuildReport.rebuilt_metrics.zones_recalibrated}, rescored: ${rescored}`,
            duration_ms: Date.now() - t0,
          })
        } catch (err) {
          actions.push({
            action:      'rebuild_liquidity_graph',
            status:      'failed',
            result:      err instanceof Error ? err.message : String(err),
            duration_ms: Date.now() - t0,
          })
        }
        break
      }

      default: {
        actions.push({
          action:      'log_financial_anomaly',
          status:      'skipped',
          result:      `no handler for anomaly type: ${anomaly.type}`,
          duration_ms: 0,
        })
      }
    }
  }

  return actions
}

// ─── logFinancialAnomalyToAudit ───────────────────────────────────────────────

async function logFinancialAnomalyToAudit(
  tenantId: string,
  alert: SelfHealingReport['financial_alerts'][0],
): Promise<string | null> {
  const auditId = randomUUID()

  const { error } = await (supabaseAdmin as any)
    .from('audit_log_entries')
    .insert({
      id:            auditId,
      tenant_id:     tenantId,
      actor_id:      'self_healing_orchestrator',
      action:        'financial_anomaly_detected',
      resource_type: 'financial_state',
      resource_id:   tenantId,
      result:        'info',
      risk_level:    'critical',
      metadata:      {
        alert_type:        alert.alert_type,
        description:       alert.description,
        affected_records:  alert.affected_records,
      },
      created_at: new Date().toISOString(),
    })

  if (error) {
    log.warn('[selfHealingOrchestrator] audit log insert error', { error: error.message })
    return null
  }

  return auditId
}

// ─── runSelfHealing ───────────────────────────────────────────────────────────

/**
 * Master self-healing orchestrator.
 * Runs all healers in sequence and produces a comprehensive report.
 * CRITICAL: Financial anomalies are logged to audit trail and flagged for human review only.
 */
export async function runSelfHealing(
  tenantId: string,
  dryRun = false,
): Promise<SelfHealingReport> {
  const healingRunId = randomUUID()
  const executedAt   = new Date().toISOString()

  log.info('[selfHealingOrchestrator] starting healing run', {
    healing_run_id: healingRunId,
    tenant_id:      tenantId,
    dry_run:        dryRun,
  })

  // 1. Compute health before
  const healthBefore = await computeSystemHealth(tenantId)

  // 2. Detect anomalies
  const anomalies = await detectSystemAnomalies(tenantId)

  // 3. Separate financial anomalies (never auto-fix)
  const financialAnomalies = anomalies.filter(a => !a.auto_fixable)
  const healableAnomalies  = anomalies.filter(a => a.auto_fixable)

  // 4. Log financial anomalies to audit trail
  const financialAlerts: SelfHealingReport['financial_alerts'] = []
  for (const fa of financialAnomalies) {
    const auditId = await logFinancialAnomalyToAudit(tenantId, {
      alert_type:        fa.type,
      description:       fa.description,
      affected_records:  0,
      audit_entry_id:    null,
    })

    financialAlerts.push({
      alert_type:        fa.type,
      description:       fa.description,
      affected_records:  0,
      audit_entry_id:    auditId,
    })
  }

  // 5. Execute healing plan for auto-fixable anomalies
  const healingActions = await executeHealingPlan(tenantId, healableAnomalies, dryRun)

  // 6. Compute health after
  const healthAfter = dryRun ? healthBefore : await computeSystemHealth(tenantId)
  const improvement = Math.max(0, healthAfter - healthBefore)

  // 7. Build human review items
  const humanReviewItems: string[] = [
    ...financialAlerts.map(fa => `[${fa.alert_type}] ${fa.description}`),
    ...healingActions
      .filter(a => a.status === 'failed')
      .map(a => `Healing failed for action ${a.action}: ${a.result}`),
  ]

  const humanReviewRequired = humanReviewItems.length > 0

  const report: SelfHealingReport = {
    healing_run_id:       healingRunId,
    tenant_id:            tenantId,
    anomalies_detected:   anomalies,
    healing_actions:      healingActions,
    financial_alerts:     financialAlerts,
    system_health_before: healthBefore,
    system_health_after:  healthAfter,
    improvement,
    human_review_required: humanReviewRequired,
    human_review_items:    humanReviewItems,
    executed_at:           executedAt,
    dry_run:               dryRun,
  }

  // Persist
  void (supabaseAdmin as any)
    .from('self_healing_runs')
    .insert({
      id:                    healingRunId,
      tenant_id:             tenantId,
      anomalies_detected:    anomalies,
      healing_actions:       healingActions,
      financial_alerts:      financialAlerts,
      system_health_before:  healthBefore,
      system_health_after:   healthAfter,
      improvement,
      human_review_required: humanReviewRequired,
      human_review_items:    humanReviewItems,
      dry_run:               dryRun,
      executed_at:           executedAt,
    })
    .then(({ error }: { error: { message: string } | null }) => {
      if (error) log.warn('[selfHealingOrchestrator] persist error', { error: error.message })
    })

  log.info('[selfHealingOrchestrator] healing run complete', {
    healing_run_id:  healingRunId,
    health_before:   healthBefore,
    health_after:    healthAfter,
    improvement,
    human_review:    humanReviewRequired,
    anomalies:       anomalies.length,
    actions:         healingActions.length,
    tenant_id:       tenantId,
  })

  return report
}
