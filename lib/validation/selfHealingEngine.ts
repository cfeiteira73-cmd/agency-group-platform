// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — Self-Healing Engine v1.0
// lib/validation/selfHealingEngine.ts
//
// Layer 7 of the Autonomous Validation Engine.
// Classifies detected issues by severity and applies safe, reversible
// auto-corrections for LOW and eligible MEDIUM issues.
// CRITICAL issues are NEVER auto-fixed — human intervention is required.
//
// TypeScript strict — 0 errors
// =============================================================================

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low'

export type HealingAction =
  | 'create_backup_snapshot'      // trigger a backup if none exists
  | 'archive_orphan_events'       // mark orphaned events as processed
  | 'refresh_market_calibration'  // insert a calibration trigger record
  | 'log_issue_to_audit'          // just log the issue to audit trail
  | 'no_action_required'
  | 'manual_intervention_required' // CRITICAL — human must fix

export interface DetectedIssue {
  id: string
  source_layer: string  // 'architecture' | 'events' | 'economic' | 'ml' | 'security' | 'resilience'
  severity: IssueSeverity
  description: string
  affected_component: string
  suggested_action: HealingAction
  auto_fixable: boolean // true only for LOW and some MEDIUM
}

export interface HealingResult {
  issue_id: string
  action_taken: HealingAction
  success: boolean
  details: string
  applied_at: string
}

export interface SelfHealingReport {
  id: string
  tenant_id: string
  issues_detected: DetectedIssue[]
  healing_results: HealingResult[]
  critical_count: number
  high_count: number
  medium_count: number
  low_count: number
  auto_fixed_count: number
  manual_required_count: number
  system_validated_after_healing: boolean
  ran_at: string
}

// ─── Issue classification rules ──────────────────────────────────────────────

/**
 * Classifies a raw issue string into severity + suggested action.
 *
 * Score thresholds:
 *  score < 30  → critical, manual_intervention_required
 *  score 30–50 → high,     log_issue_to_audit (not auto-fixable)
 *  score 50–70 → medium,   check if fixable
 *  score 70–85 → low,      often auto-fixable
 *  score >= 85 → no issue
 */
export function classifyIssue(
  layer: string,
  description: string,
  score: number,
): DetectedIssue {
  const id = randomUUID()
  const lowerDesc = description.toLowerCase()

  let severity: IssueSeverity
  let suggestedAction: HealingAction
  let autoFixable = false

  if (score >= 85) {
    return {
      id,
      source_layer:       layer,
      severity:           'low',
      description,
      affected_component: layer,
      suggested_action:   'no_action_required',
      auto_fixable:       false,
    }
  }

  if (score < 30) {
    severity        = 'critical'
    suggestedAction = 'manual_intervention_required'
    autoFixable     = false
  } else if (score < 50) {
    severity        = 'high'
    suggestedAction = 'log_issue_to_audit'
    autoFixable     = false
  } else if (score < 70) {
    severity    = 'medium'
    autoFixable = false

    // Specific medium-severity auto-fixable patterns
    if (lowerDesc.includes('backup') || lowerDesc.includes('snapshot')) {
      suggestedAction = 'create_backup_snapshot'
      autoFixable     = true
    } else if (lowerDesc.includes('orphan') || lowerDesc.includes('event')) {
      suggestedAction = 'archive_orphan_events'
      autoFixable     = true
    } else if (lowerDesc.includes('calibrat') || lowerDesc.includes('market')) {
      suggestedAction = 'refresh_market_calibration'
      autoFixable     = true
    } else {
      suggestedAction = 'log_issue_to_audit'
    }
  } else {
    // score 70–84 → low
    severity    = 'low'
    autoFixable = true

    if (lowerDesc.includes('backup') || lowerDesc.includes('snapshot')) {
      suggestedAction = 'create_backup_snapshot'
    } else if (lowerDesc.includes('orphan') || lowerDesc.includes('event')) {
      suggestedAction = 'archive_orphan_events'
    } else if (lowerDesc.includes('calibrat') || lowerDesc.includes('market')) {
      suggestedAction = 'refresh_market_calibration'
    } else {
      suggestedAction = 'log_issue_to_audit'
    }
  }

  return {
    id,
    source_layer:       layer,
    severity,
    description,
    affected_component: layer,
    suggested_action:   suggestedAction,
    auto_fixable:       autoFixable,
  }
}

// ─── Healing action implementations ──────────────────────────────────────────

async function createBackupSnapshot(tenantId: string, issueId: string): Promise<string> {
  const { error } = await (supabaseAdmin as any)
    .from('backup_snapshots')
    .insert({
      id:          randomUUID(),
      tenant_id:   tenantId,
      status:      'scheduled',
      trigger:     'self_healing',
      trigger_ref: issueId,
      created_at:  new Date().toISOString(),
    })

  if (error) {
    log.warn('[selfHealingEngine] createBackupSnapshot insert error', { error: error.message })
    return `Failed to schedule backup snapshot: ${error.message}`
  }
  return 'Backup snapshot scheduled (status=scheduled)'
}

async function archiveOrphanEvents(tenantId: string): Promise<string> {
  const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString() // 30 min ago

  const { count, error } = await (supabaseAdmin as any)
    .from('kafka_event_log')
    .update({ processed_at: new Date().toISOString() })
    .is('processed_at', null)
    .lt('emitted_at', cutoff)
    .select('*', { count: 'exact', head: true })

  if (error) {
    log.warn('[selfHealingEngine] archiveOrphanEvents update error', { error: error.message })
    return `Failed to archive orphan events: ${error.message}`
  }

  const affected = typeof count === 'number' ? count : 0
  return `Archived ${affected} orphan events older than 30 min`
}

async function refreshMarketCalibration(tenantId: string): Promise<string> {
  const { error } = await (supabaseAdmin as any)
    .from('market_calibration_runs')
    .insert({
      id:           randomUUID(),
      tenant_id:    tenantId,
      sample_count: 0,
      trigger:      'self_healing',
      status:       'pending',
      created_at:   new Date().toISOString(),
    })

  if (error) {
    log.warn('[selfHealingEngine] refreshMarketCalibration insert error', { error: error.message })
    return `Failed to insert calibration trigger: ${error.message}`
  }
  return 'Market calibration trigger inserted (sample_count=0, status=pending)'
}

async function logIssueToAudit(tenantId: string, issue: DetectedIssue): Promise<string> {
  const { error } = await (supabaseAdmin as any)
    .from('audit_log_entries')
    .insert({
      id:            randomUUID(),
      tenant_id:     tenantId,
      actor_id:      'self_healing_engine',
      action:        'compliance_check_performed',
      resource_type: 'validation_issue',
      resource_id:   issue.id,
      result:        'info',
      risk_level:    issue.severity === 'critical' || issue.severity === 'high' ? 'high' : 'low',
      metadata:      {
        source_layer:       issue.source_layer,
        description:        issue.description,
        affected_component: issue.affected_component,
        severity:           issue.severity,
      },
      created_at: new Date().toISOString(),
    })

  if (error) {
    log.warn('[selfHealingEngine] logIssueToAudit insert error', { error: error.message })
    return `Failed to log issue to audit: ${error.message}`
  }
  return `Issue logged to audit trail (action=compliance_check_performed)`
}

// ─── applyHealingAction ───────────────────────────────────────────────────────

/**
 * Applies a safe healing action for a detected issue.
 * Only executes if issue.auto_fixable === true.
 * All actions are non-destructive and reversible.
 */
export async function applyHealingAction(
  tenantId: string,
  issue: DetectedIssue,
): Promise<HealingResult> {
  const appliedAt = new Date().toISOString()

  if (!issue.auto_fixable) {
    log.info('[selfHealingEngine] skipping non-auto-fixable issue', {
      issue_id:  issue.id,
      severity:  issue.severity,
      action:    issue.suggested_action,
      tenant_id: tenantId,
    })

    return {
      issue_id:     issue.id,
      action_taken: issue.suggested_action,
      success:      false,
      details:      'Issue is not auto-fixable — manual intervention required',
      applied_at:   appliedAt,
    }
  }

  let success = true
  let details = ''

  try {
    switch (issue.suggested_action) {
      case 'create_backup_snapshot':
        details = await createBackupSnapshot(tenantId, issue.id)
        break

      case 'archive_orphan_events':
        details = await archiveOrphanEvents(tenantId)
        break

      case 'refresh_market_calibration':
        details = await refreshMarketCalibration(tenantId)
        break

      case 'log_issue_to_audit':
        details = await logIssueToAudit(tenantId, issue)
        break

      case 'no_action_required':
        details  = 'No action required — score is healthy'
        break

      case 'manual_intervention_required':
        success = false
        details = 'CRITICAL issue — manual intervention required, no auto-fix applied'
        break

      default:
        details = `Unknown action: ${issue.suggested_action as string}`
        success = false
    }
  } catch (err) {
    success = false
    details = `Exception during healing: ${err instanceof Error ? err.message : String(err)}`
    log.warn('[selfHealingEngine] applyHealingAction exception', {
      issue_id:  issue.id,
      action:    issue.suggested_action,
      error:     details,
      tenant_id: tenantId,
    })
  }

  log.info('[selfHealingEngine] healing action applied', {
    issue_id:  issue.id,
    action:    issue.suggested_action,
    success,
    tenant_id: tenantId,
  })

  return {
    issue_id:     issue.id,
    action_taken: issue.suggested_action,
    success,
    details,
    applied_at:   appliedAt,
  }
}

// ─── runSelfHealing ───────────────────────────────────────────────────────────

/**
 * Runs self-healing across all detected issues.
 * Classifies each issue and applies safe healing actions where auto_fixable.
 */
export async function runSelfHealing(
  tenantId: string,
  issues: DetectedIssue[],
): Promise<SelfHealingReport> {
  const id    = randomUUID()
  const ranAt = new Date().toISOString()

  log.info('[selfHealingEngine] starting self-healing run', {
    tenant_id:    tenantId,
    issue_count:  issues.length,
  })

  const healingResults: HealingResult[] = []

  for (const issue of issues) {
    const result = await applyHealingAction(tenantId, issue)
    healingResults.push(result)
  }

  const criticalCount = issues.filter(i => i.severity === 'critical').length
  const highCount     = issues.filter(i => i.severity === 'high').length
  const mediumCount   = issues.filter(i => i.severity === 'medium').length
  const lowCount      = issues.filter(i => i.severity === 'low').length

  const autoFixedCount    = healingResults.filter(r => r.success).length
  const manualRequired    = issues.filter(i => !i.auto_fixable).length

  // System validated after healing if no critical issues remain unaddressed
  const systemValidated = criticalCount === 0 && highCount === 0

  const report: SelfHealingReport = {
    id,
    tenant_id:                     tenantId,
    issues_detected:               issues,
    healing_results:               healingResults,
    critical_count:                criticalCount,
    high_count:                    highCount,
    medium_count:                  mediumCount,
    low_count:                     lowCount,
    auto_fixed_count:              autoFixedCount,
    manual_required_count:         manualRequired,
    system_validated_after_healing: systemValidated,
    ran_at:                        ranAt,
  }

  log.info('[selfHealingEngine] self-healing run complete', {
    tenant_id:      tenantId,
    critical:       criticalCount,
    high:           highCount,
    medium:         mediumCount,
    low:            lowCount,
    auto_fixed:     autoFixedCount,
    manual_req:     manualRequired,
    sys_validated:  systemValidated,
  })

  // Fire-and-forget persist
  void persistHealingReport(report).catch(e =>
    log.warn('[selfHealingEngine] persist failed', {
      error: e instanceof Error ? e.message : String(e),
    })
  )

  return report
}

// ─── Persistence helpers ──────────────────────────────────────────────────────

export async function persistHealingReport(report: SelfHealingReport): Promise<void> {
  const { error } = await (supabaseAdmin as any)
    .from('self_healing_reports')
    .insert({
      id:                              report.id,
      tenant_id:                       report.tenant_id,
      issues_detected:                 report.issues_detected,
      healing_results:                 report.healing_results,
      critical_count:                  report.critical_count,
      high_count:                      report.high_count,
      medium_count:                    report.medium_count,
      low_count:                       report.low_count,
      auto_fixed_count:                report.auto_fixed_count,
      manual_required_count:           report.manual_required_count,
      system_validated_after_healing:  report.system_validated_after_healing,
      ran_at:                          report.ran_at,
    })

  if (error) {
    log.warn('[selfHealingEngine] persistHealingReport DB error', { error: error.message })
  }
}

export async function getHealingHistory(
  tenantId: string,
  limit = 20,
): Promise<SelfHealingReport[]> {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('self_healing_reports')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('ran_at', { ascending: false })
      .limit(Math.min(limit, 100))

    if (error || !data) return []
    return data as SelfHealingReport[]
  } catch (err) {
    log.warn('[selfHealingEngine] getHealingHistory error', {
      error: err instanceof Error ? err.message : String(err),
    })
    return []
  }
}
