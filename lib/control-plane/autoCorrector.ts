// Agency Group — Auto Corrector
// lib/control-plane/autoCorrector.ts
// Applies SAFE automated corrections based on diagnostic issues.
// GUARDRAILS: never touches financial data, deals, ledger, settlements.
// Only: cache invalidation, metric reset, pipeline re-trigger signals.

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import type { Issue } from './autodiagnosticEngine'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CorrectionAction {
  action_id: string
  issue_severity: Issue['severity']
  component: string
  action_type:
    | 'CACHE_INVALIDATE'
    | 'METRIC_RESET'
    | 'PIPELINE_SIGNAL'
    | 'THROTTLE_ADJUST'
    | 'ALERT_EMIT'
    | 'NO_OP'
  description: string
  applied_at: string
  success: boolean
  error?: string
}

// ─── Guardrail: Financial component names — ALERT_EMIT only, never touch data ─

const FINANCIAL_COMPONENTS = new Set([
  'deals',
  'ledger',
  'capital',
  'settlement',
  'billing',
  'payments',
  'revenue',
  'invoice',
])

function isFinancialComponent(component: string): boolean {
  const lower = component.toLowerCase()
  for (const fc of FINANCIAL_COMPONENTS) {
    if (lower.includes(fc)) return true
  }
  return false
}

// ─── Action builders ──────────────────────────────────────────────────────────

async function emitAlertOnly(
  issue: Issue,
  tenantId: string,
  description: string,
): Promise<CorrectionAction> {
  const action_id = `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const applied_at = new Date().toISOString()

  log.warn('[autoCorrector] ALERT_EMIT (financial component — no data touch)', {
    component: issue.component,
    severity: issue.severity,
    message: issue.message,
    tenant_id: tenantId,
  })

  const action: CorrectionAction = {
    action_id,
    issue_severity: issue.severity,
    component: issue.component,
    action_type: 'ALERT_EMIT',
    description,
    applied_at,
    success: true,
  }

  void (supabaseAdmin as any)
    .from('correction_actions')
    .insert({
      tenant_id: tenantId,
      action_id,
      issue_severity: issue.severity,
      component: issue.component,
      action_type: 'ALERT_EMIT',
      description,
      applied_at,
      success: true,
    })
    .then(({ error }: { error: any }) => {
      if (error) log.warn('[autoCorrector] persist ALERT_EMIT failed', { error: error.message })
    })
    .catch((e: unknown) => console.warn('[autoCorrector] persist error', e))

  return action
}

async function emitPipelineRestartSignal(
  issue: Issue,
  tenantId: string,
): Promise<CorrectionAction> {
  const action_id = `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const applied_at = new Date().toISOString()
  const description = `Pipeline restart signal for component "${issue.component}" due to: ${issue.message}`

  let success = true
  let errorMsg: string | undefined

  try {
    const { error } = await (supabaseAdmin as any)
      .from('pipeline_restart_signals')
      .insert({
        tenant_id: tenantId,
        pipeline_name: issue.component,
        signal_type: 'RESTART',
        reason: issue.message,
        emitted_at: applied_at,
      })

    if (error) {
      success = false
      errorMsg = error.message
      log.warn('[autoCorrector] pipeline_restart_signals insert failed', { error: error.message })
    }
  } catch (err) {
    success = false
    errorMsg = err instanceof Error ? err.message : String(err)
    log.warn('[autoCorrector] pipeline restart signal exception', { error: errorMsg })
  }

  const action: CorrectionAction = {
    action_id,
    issue_severity: issue.severity,
    component: issue.component,
    action_type: 'PIPELINE_SIGNAL',
    description,
    applied_at,
    success,
    ...(errorMsg ? { error: errorMsg } : {}),
  }

  void (supabaseAdmin as any)
    .from('correction_actions')
    .insert({
      tenant_id: tenantId,
      action_id,
      issue_severity: issue.severity,
      component: issue.component,
      action_type: 'PIPELINE_SIGNAL',
      description,
      applied_at,
      success,
      error_message: errorMsg ?? null,
    })
    .then(({ error }: { error: any }) => {
      if (error) log.warn('[autoCorrector] persist action failed', { error: error.message })
    })
    .catch((e: unknown) => console.warn('[autoCorrector] persist error', e))

  return action
}

async function emitThrottleAdjust(issue: Issue, tenantId: string): Promise<CorrectionAction> {
  const action_id = `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const applied_at = new Date().toISOString()
  const description = `Throttle override for "${issue.component}" — reducing RPS to 10 for 10 minutes due to: ${issue.message}`
  const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  let success = true
  let errorMsg: string | undefined

  try {
    const { error } = await (supabaseAdmin as any)
      .from('throttle_overrides')
      .insert({
        tenant_id: tenantId,
        endpoint_pattern: `*${issue.component}*`,
        max_rps: 10,
        reason: issue.message,
        active: true,
        expires_at,
      })

    if (error) {
      success = false
      errorMsg = error.message
      log.warn('[autoCorrector] throttle_overrides insert failed', { error: error.message })
    }
  } catch (err) {
    success = false
    errorMsg = err instanceof Error ? err.message : String(err)
    log.warn('[autoCorrector] throttle adjust exception', { error: errorMsg })
  }

  const action: CorrectionAction = {
    action_id,
    issue_severity: issue.severity,
    component: issue.component,
    action_type: 'THROTTLE_ADJUST',
    description,
    applied_at,
    success,
    ...(errorMsg ? { error: errorMsg } : {}),
  }

  void (supabaseAdmin as any)
    .from('correction_actions')
    .insert({
      tenant_id: tenantId,
      action_id,
      issue_severity: issue.severity,
      component: issue.component,
      action_type: 'THROTTLE_ADJUST',
      description,
      applied_at,
      success,
      error_message: errorMsg ?? null,
    })
    .then(({ error }: { error: any }) => {
      if (error) log.warn('[autoCorrector] persist action failed', { error: error.message })
    })
    .catch((e: unknown) => console.warn('[autoCorrector] persist error', e))

  return action
}

async function emitRefreshSignal(issue: Issue, tenantId: string): Promise<CorrectionAction> {
  const action_id = `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const applied_at = new Date().toISOString()
  const description = `Data refresh signal for entity "${issue.component}" due to: ${issue.message}`

  let success = true
  let errorMsg: string | undefined

  try {
    const { error } = await (supabaseAdmin as any)
      .from('refresh_signals')
      .insert({
        tenant_id: tenantId,
        entity_type: issue.component,
        reason: issue.message,
        emitted_at: applied_at,
      })

    if (error) {
      success = false
      errorMsg = error.message
      log.warn('[autoCorrector] refresh_signals insert failed', { error: error.message })
    }
  } catch (err) {
    success = false
    errorMsg = err instanceof Error ? err.message : String(err)
    log.warn('[autoCorrector] refresh signal exception', { error: errorMsg })
  }

  const action: CorrectionAction = {
    action_id,
    issue_severity: issue.severity,
    component: issue.component,
    action_type: 'PIPELINE_SIGNAL',
    description,
    applied_at,
    success,
    ...(errorMsg ? { error: errorMsg } : {}),
  }

  void (supabaseAdmin as any)
    .from('correction_actions')
    .insert({
      tenant_id: tenantId,
      action_id,
      issue_severity: issue.severity,
      component: issue.component,
      action_type: 'PIPELINE_SIGNAL',
      description,
      applied_at,
      success,
      error_message: errorMsg ?? null,
    })
    .then(({ error }: { error: any }) => {
      if (error) log.warn('[autoCorrector] persist action failed', { error: error.message })
    })
    .catch((e: unknown) => console.warn('[autoCorrector] persist error', e))

  return action
}

async function noOpAction(issue: Issue, tenantId: string): Promise<CorrectionAction> {
  const action_id = `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const applied_at = new Date().toISOString()
  const description = `LOW severity issue logged only — no automated action taken. Component: "${issue.component}"`

  log.info('[autoCorrector] NO_OP for LOW severity issue', {
    component: issue.component,
    message: issue.message,
    tenant_id: tenantId,
  })

  const action: CorrectionAction = {
    action_id,
    issue_severity: issue.severity,
    component: issue.component,
    action_type: 'NO_OP',
    description,
    applied_at,
    success: true,
  }

  void (supabaseAdmin as any)
    .from('correction_actions')
    .insert({
      tenant_id: tenantId,
      action_id,
      issue_severity: issue.severity,
      component: issue.component,
      action_type: 'NO_OP',
      description,
      applied_at,
      success: true,
      error_message: null,
    })
    .then(({ error }: { error: any }) => {
      if (error) log.warn('[autoCorrector] persist NO_OP failed', { error: error.message })
    })
    .catch((e: unknown) => console.warn('[autoCorrector] persist error', e))

  return action
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export async function applyCorrections(
  issues: Issue[],
  tenantId: string,
): Promise<CorrectionAction[]> {
  if (issues.length === 0) return []

  log.info('[autoCorrector] Applying corrections', {
    issue_count: issues.length,
    tenant_id: tenantId,
  })

  const actions = await Promise.all(
    issues.map(async (issue): Promise<CorrectionAction> => {
      // Guardrail: financial components → ALERT_EMIT only
      if (isFinancialComponent(issue.component)) {
        return emitAlertOnly(
          issue,
          tenantId,
          `Financial component alert: ${issue.severity} — ${issue.message}`,
        )
      }

      switch (issue.severity) {
        case 'CRITICAL':
          // CRITICAL queue failures → pipeline restart signal
          return emitPipelineRestartSignal(issue, tenantId)

        case 'HIGH':
          // HIGH latency → throttle adjust
          return emitThrottleAdjust(issue, tenantId)

        case 'MEDIUM':
          // MEDIUM data freshness → refresh signal
          return emitRefreshSignal(issue, tenantId)

        case 'LOW':
        default:
          // LOW → log only, no action
          return noOpAction(issue, tenantId)
      }
    }),
  )

  const successCount = actions.filter((a) => a.success).length
  log.info('[autoCorrector] Corrections applied', {
    total: actions.length,
    success: successCount,
    tenant_id: tenantId,
  })

  return actions
}
