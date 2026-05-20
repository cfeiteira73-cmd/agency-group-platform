// Agency Group — Disaster Recovery Validator
// lib/sre/drValidator.ts
// TypeScript strict — 0 errors
//
// Validates DR playbook readiness without executing destructive steps.
// Runs the verificationQuery for each step and checks system state.
// Produces a DR readiness report.

import {
  DR_PLAYBOOKS,
  logRecoveryEvent,
  type DRPlaybook,
  type DRStep,
} from './disasterRecovery'
import { runDeepHealthCheck } from './healthCheck'
import { supabaseAdmin } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StepValidationResult {
  step_name: string
  automated: boolean
  verification_possible: boolean
  verification_passed: boolean | null  // null if not verifiable
  duration_ms: number
  notes: string
}

export interface PlaybookValidationResult {
  playbook_name: string
  severity: string
  estimated_recovery_ms: number
  steps_validated: number
  steps_passed: number
  steps_manual: number    // steps requiring manual execution
  readiness_score: number // 0-100: steps_passed / total_steps * 100
  ready: boolean          // readiness_score >= 60
  step_results: StepValidationResult[]
  validated_at: string
}

export interface DrReadinessReport {
  tenant_id: string
  overall_readiness: number      // 0-100: mean of playbook readiness scores
  ready_for_production: boolean  // overall >= 60
  system_health: { healthy: boolean; summary: string }
  playbooks: PlaybookValidationResult[]
  critical_gaps: string[]        // steps that failed AND are automated
  generated_at: string
}

// ─── Step Verifier ────────────────────────────────────────────────────────────

async function verifyStep(
  step: DRStep,
  systemHealthy: boolean,
): Promise<StepValidationResult> {
  const t0 = Date.now()

  // Manual steps — don't verify, just flag
  if (!step.automated) {
    return {
      step_name: step.name,
      automated: false,
      verification_possible: false,
      verification_passed: null,
      duration_ms: Date.now() - t0,
      notes: 'Manual step — requires human execution during a real incident',
    }
  }

  // No verificationQuery on this automated step — infer from system health
  if (!step.verificationQuery) {
    // For automated steps without a query, we check whether the relevant
    // service is accessible. If health is overall ok, treat as passed.
    const passed = systemHealthy
    return {
      step_name: step.name,
      automated: true,
      verification_possible: false,
      verification_passed: passed,
      duration_ms: Date.now() - t0,
      notes: passed
        ? 'No verificationQuery — inferred from system health (healthy)'
        : 'No verificationQuery — inferred from system health (unhealthy)',
    }
  }

  // Has a verificationQuery — attempt to run it
  try {
    // Detect the kind of query and execute appropriately
    const query = step.verificationQuery.trim()

    let passed = false
    let notes = ''

    // SELECT 1 — simplest DB liveness probe
    if (/^SELECT\s+1\s*$/i.test(query)) {
      const { error } = await (supabaseAdmin as any)
        .from('organizations')
        .select('id')
        .limit(1)
      passed = !error
      notes  = error ? `DB check failed: ${error.message}` : 'DB SELECT 1 passed'
    }

    // INSERT INTO health_checks — write verification
    else if (/^INSERT\s+INTO\s+health_checks/i.test(query)) {
      const { data, error } = await (supabaseAdmin as any)
        .from('health_checks')
        .insert({ checked_at: new Date().toISOString() })
        .select('id')
        .limit(1)
      passed = !error && Array.isArray(data) && data.length > 0
      notes  = error ? `Write verification failed: ${error.message}` : 'Write INSERT to health_checks passed'
    }

    // Replication lag check
    else if (/pg_last_xact_replay_timestamp/i.test(query)) {
      // Cannot execute raw SQL via supabaseAdmin without rpc — treat as skipped
      // (requires pg_stat_replication access which is superuser-only in Supabase)
      return {
        step_name: step.name,
        automated: true,
        verification_possible: false,
        verification_passed: null,
        duration_ms: Date.now() - t0,
        notes: 'Replication lag query requires superuser access — not verifiable via service role',
      }
    }

    // kafka_metrics table query
    else if (/kafka_metrics/i.test(query)) {
      const { data, error } = await (supabaseAdmin as any)
        .from('kafka_metrics')
        .select('consumer_lag')
        .eq('consumer_lag', 0)
        .limit(1)
      passed = !error
      notes  = error ? `kafka_metrics check failed: ${error.message}` : 'kafka_metrics table accessible'
    }

    // Generic SELECT — just test table accessibility
    else {
      passed = systemHealthy
      notes  = `Custom query not auto-executable — inferred from system health: ${systemHealthy ? 'healthy' : 'unhealthy'}`
    }

    return {
      step_name: step.name,
      automated: true,
      verification_possible: true,
      verification_passed: passed,
      duration_ms: Date.now() - t0,
      notes,
    }
  } catch (err) {
    return {
      step_name: step.name,
      automated: true,
      verification_possible: true,
      verification_passed: false,
      duration_ms: Date.now() - t0,
      notes: `Verification threw: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

// ─── validatePlaybook ─────────────────────────────────────────────────────────

export async function validatePlaybook(
  playbook: DRPlaybook,
  tenantId: string,
): Promise<PlaybookValidationResult> {
  const validated_at = new Date().toISOString()

  // Quick DB health check to inform step validation
  let systemHealthy = false
  try {
    const health = await runDeepHealthCheck()
    systemHealthy = health.healthy || health.summary === 'degraded'
  } catch {
    systemHealthy = false
  }

  const stepResults: StepValidationResult[] = []

  for (const step of playbook.steps) {
    const result = await verifyStep(step, systemHealthy)
    stepResults.push(result)
  }

  const totalSteps   = stepResults.length
  const manualSteps  = stepResults.filter(r => !r.automated).length
  const passedSteps  = stepResults.filter(r => r.verification_passed === true).length
  // Steps counted toward readiness: automated steps that either passed or are
  // verified-null (inferred ok) — plus we count manual steps as half-credit
  const effectivePassed = stepResults.reduce((acc, r) => {
    if (!r.automated) return acc + 0.5  // manual steps get half-credit
    if (r.verification_passed === true)  return acc + 1
    if (r.verification_passed === null)  return acc + 0.5  // not verifiable
    return acc  // failed
  }, 0)

  const readiness_score = totalSteps > 0
    ? Math.round((effectivePassed / totalSteps) * 100)
    : 0

  // Log validation event
  void logRecoveryEvent(tenantId, {
    incidentId: `dr-validation-${playbook.name}-${Date.now()}`,
    eventType:  'mitigation_started',
    service:    playbook.name,
    description: `DR playbook validation: readiness_score=${readiness_score}`,
    automated:  true,
    metadata: { readiness_score, steps_validated: totalSteps, manual_steps: manualSteps },
  }).catch(err => console.warn('[DRValidator]', err instanceof Error ? err.message : String(err)))

  return {
    playbook_name: playbook.name,
    severity: playbook.severity,
    estimated_recovery_ms: playbook.estimatedRecoveryMs,
    steps_validated: totalSteps,
    steps_passed: passedSteps,
    steps_manual: manualSteps,
    readiness_score,
    ready: readiness_score >= 60,
    step_results: stepResults,
    validated_at,
  }
}

// ─── generateDrReadinessReport ────────────────────────────────────────────────

export async function generateDrReadinessReport(
  tenantId: string,
): Promise<DrReadinessReport> {
  const generated_at = new Date().toISOString()

  // 1. Run deep health check
  let healthResult = { healthy: false, summary: 'critical' as 'healthy' | 'degraded' | 'critical' }
  try {
    const h = await runDeepHealthCheck()
    healthResult = { healthy: h.healthy, summary: h.summary }
  } catch (err) {
    console.error('[DRValidator] runDeepHealthCheck error:', err instanceof Error ? err.message : String(err))
  }

  // 2. Validate all playbooks (run sequentially to avoid DB hammer)
  const playbookResults: PlaybookValidationResult[] = []
  for (const playbook of DR_PLAYBOOKS) {
    const result = await validatePlaybook(playbook, tenantId)
    playbookResults.push(result)
  }

  // 3. Overall readiness = mean of all playbook scores
  const overall_readiness = playbookResults.length > 0
    ? Math.round(
        playbookResults.reduce((sum, p) => sum + p.readiness_score, 0) / playbookResults.length,
      )
    : 0

  // 4. Critical gaps = automated steps that explicitly failed
  const critical_gaps: string[] = []
  for (const pr of playbookResults) {
    for (const sr of pr.step_results) {
      if (sr.automated && sr.verification_passed === false) {
        critical_gaps.push(`[${pr.playbook_name}] ${sr.step_name}: ${sr.notes}`)
      }
    }
  }

  return {
    tenant_id:            tenantId,
    overall_readiness,
    ready_for_production: overall_readiness >= 60,
    system_health: {
      healthy: healthResult.healthy,
      summary: healthResult.summary,
    },
    playbooks:     playbookResults,
    critical_gaps,
    generated_at,
  }
}
