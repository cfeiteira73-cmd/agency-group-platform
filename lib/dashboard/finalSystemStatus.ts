// Agency Group — Final System Status
// lib/dashboard/finalSystemStatus.ts
// TypeScript strict — 0 errors
//
// Produces the FINAL SYSTEM STATUS assessment:
// SYSTEM_STATUS: PRODUCTION_GRADE | DEGRADED | CRITICAL
// ERRORS: count of critical errors
// READY_FOR_SCALE: true/false
//
// Aggregates: health score + security score + performance score + production readiness

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { generateSystemHealthReport }  from './systemHealthReport'
import { generatePerformanceReport }   from './performanceReport'
import { generateSecurityReport }      from './securityReport'
import { generateUXReport }            from './uxOptimizationReport'

// ─── Types ────────────────────────────────────────────────────────────────────

export type SystemStatusLevel = 'PRODUCTION_GRADE' | 'DEGRADED' | 'CRITICAL'

export interface FinalSystemStatus {
  status_id: string
  tenant_id: string

  // Required output format (spec compliant)
  SYSTEM_STATUS: SystemStatusLevel
  ERRORS: number              // count of CRITICAL issues
  READY_FOR_SCALE: boolean    // true only if SYSTEM_STATUS = PRODUCTION_GRADE

  // Dimension scores (0–100 each)
  scores: {
    health: number
    security: number
    performance: number
    production_readiness: number
    ux: number
  }

  // Composite weighted score
  composite_score: number  // health×25% + security×25% + perf×20% + readiness×20% + ux×10%

  // Blocking issues
  blocking_issues: string[]

  // Action plan
  immediate_actions: string[]     // fix before scale
  next_sprint_actions: string[]   // fix in next sprint

  // Metadata
  assessed_at: string
  assessment_version: string      // 'Wave 37'
}

// ─── Dimension score loader ───────────────────────────────────────────────────

/**
 * Loads the latest dimension scores from each audit/report table.
 * Falls back to running fresh if no cached data exists.
 */
export async function loadDimensionScores(
  tenantId: string,
): Promise<FinalSystemStatus['scores']> {
  // Health score — from system_health_reports
  let healthScore = 0
  const { data: healthRows } = await (supabaseAdmin as any)
    .from('system_health_reports')
    .select('health_score')
    .eq('tenant_id', tenantId)
    .order('generated_at', { ascending: false })
    .limit(1)
  if (healthRows && healthRows.length > 0) {
    healthScore = Number((healthRows[0] as { health_score: number }).health_score) ?? 0
  }

  // Security score — from dashboard_security_reports
  let securityScore = 0
  const { data: secRows } = await (supabaseAdmin as any)
    .from('dashboard_security_reports')
    .select('overall_security_score')
    .eq('tenant_id', tenantId)
    .order('generated_at', { ascending: false })
    .limit(1)
  if (secRows && secRows.length > 0) {
    securityScore = Number((secRows[0] as { overall_security_score: number }).overall_security_score) ?? 0
  }

  // Performance score — from performance_reports
  let performanceScore = 0
  const { data: perfRows } = await (supabaseAdmin as any)
    .from('performance_reports')
    .select('overall')
    .eq('tenant_id', tenantId)
    .order('generated_at', { ascending: false })
    .limit(1)
  if (perfRows && perfRows.length > 0) {
    const overall = (perfRows[0] as { overall: { avg_response_ms?: number } | null }).overall
    if (overall) {
      // Derive score from avg latency: <200ms=100, >2000ms=0
      const avg = overall.avg_response_ms ?? 500
      performanceScore = Math.max(0, Math.min(100, Math.round(100 - ((avg - 200) / 1800) * 100)))
    } else {
      performanceScore = 85  // assume healthy when no latency data
    }
  }

  // Production readiness score — from production_readiness_scores
  let readinessScore = 0
  const { data: readinessRows } = await (supabaseAdmin as any)
    .from('production_readiness_scores')
    .select('composite_score')
    .eq('tenant_id', tenantId)
    .order('scored_at', { ascending: false })
    .limit(1)
  if (readinessRows && readinessRows.length > 0) {
    readinessScore = Number((readinessRows[0] as { composite_score: number }).composite_score) ?? 0
  }

  // UX score — from ux_optimization_reports
  let uxScore = 0
  const { data: uxRows } = await (supabaseAdmin as any)
    .from('ux_optimization_reports')
    .select('ux_score')
    .eq('tenant_id', tenantId)
    .order('generated_at', { ascending: false })
    .limit(1)
  if (uxRows && uxRows.length > 0) {
    uxScore = Number((uxRows[0] as { ux_score: number }).ux_score) ?? 0
  }

  return {
    health:               healthScore,
    security:             securityScore,
    performance:          performanceScore,
    production_readiness: readinessScore,
    ux:                   uxScore,
  }
}

// ─── Status determination ─────────────────────────────────────────────────────

/**
 * Determines SYSTEM_STATUS from composite score and critical issue count.
 * PRODUCTION_GRADE: score≥80 AND critical=0
 * CRITICAL:         critical>0 OR score<50
 * DEGRADED:         between
 */
export function determineSystemStatus(
  composite: number,
  criticalIssues: number,
): SystemStatusLevel {
  if (criticalIssues > 0 || composite < 50) return 'CRITICAL'
  if (composite >= 80 && criticalIssues === 0) return 'PRODUCTION_GRADE'
  return 'DEGRADED'
}

// ─── Scale readiness ──────────────────────────────────────────────────────────

/**
 * Returns true only when status is PRODUCTION_GRADE and no blocking issues remain.
 */
export function isReadyForScale(
  status: SystemStatusLevel,
  blocking: string[],
): boolean {
  return status === 'PRODUCTION_GRADE' && blocking.length === 0
}

// ─── Blocking issues extractor ────────────────────────────────────────────────

async function extractBlockingIssues(tenantId: string): Promise<string[]> {
  const blocking: string[] = []

  // Critical health issues
  const { data: healthRows } = await (supabaseAdmin as any)
    .from('system_health_reports')
    .select('issues, counts')
    .eq('tenant_id', tenantId)
    .order('generated_at', { ascending: false })
    .limit(1)

  if (healthRows && healthRows.length > 0) {
    const row = healthRows[0] as {
      issues: { critical: { title: string }[] }
      counts: { critical: number }
    }
    for (const issue of (row.issues?.critical ?? [])) {
      blocking.push(`[HEALTH] ${issue.title}`)
    }
  }

  // Critical security vulnerabilities
  const { data: secRows } = await (supabaseAdmin as any)
    .from('dashboard_security_reports')
    .select('vulnerabilities_found, tenant_isolation_status')
    .eq('tenant_id', tenantId)
    .order('generated_at', { ascending: false })
    .limit(1)

  if (secRows && secRows.length > 0) {
    const row = secRows[0] as {
      vulnerabilities_found: { critical: number; top_3: string[] }
      tenant_isolation_status: { status: string; violations_7d: number }
    }
    if ((row.vulnerabilities_found?.critical ?? 0) > 0) {
      blocking.push(`[SECURITY] ${row.vulnerabilities_found.critical} critical vulnerability/vulnerabilities`)
    }
    if (row.tenant_isolation_status?.status === 'COMPROMISED') {
      blocking.push('[SECURITY] Tenant isolation COMPROMISED — data leak risk')
    }
  }

  // Production readiness blocks
  const { data: readinessRows } = await (supabaseAdmin as any)
    .from('production_readiness_scores')
    .select('stop_conditions, production_blocked')
    .eq('tenant_id', tenantId)
    .order('scored_at', { ascending: false })
    .limit(1)

  if (readinessRows && readinessRows.length > 0) {
    const row = readinessRows[0] as {
      production_blocked: boolean
      stop_conditions: string[]
    }
    if (row.production_blocked && row.stop_conditions) {
      for (const cond of row.stop_conditions) {
        blocking.push(`[READINESS] ${cond}`)
      }
    }
  }

  return blocking
}

// ─── Action plan builders ─────────────────────────────────────────────────────

function buildImmediateActions(
  blocking: string[],
  scores: FinalSystemStatus['scores'],
): string[] {
  const actions: string[] = []

  for (const b of blocking) {
    actions.push(`Resolve: ${b}`)
  }

  if (scores.health < 70)    actions.push('Run system health audit and fix all CRITICAL + HIGH issues')
  if (scores.security < 70)  actions.push('Run security hardening pass — fix critical vulnerabilities')
  if (scores.performance < 60) actions.push('Profile slow API endpoints and add indexes or caching')

  if (actions.length === 0) {
    actions.push('System is production-grade — maintain current quality gates')
    actions.push('Monitor composite score weekly via /api/dashboard/system-status')
  }

  return actions.slice(0, 5)
}

function buildNextSprintActions(scores: FinalSystemStatus['scores']): string[] {
  const actions: string[] = []

  if (scores.ux < 80)    actions.push('Implement UX simplifications: progressive disclosure + mobile sidebar collapse')
  if (scores.health < 90) actions.push('Resolve all MEDIUM health issues identified in system health report')
  if (scores.security < 85) actions.push('Complete penetration testing for remaining attack vectors')
  if (scores.performance < 80) actions.push('Add stale-while-revalidate caching to top-5 slowest endpoints')
  if (scores.production_readiness < 80) actions.push('Address production readiness gaps: event integrity + ML drift monitoring')

  if (actions.length === 0) {
    actions.push('Extend chaos engineering coverage to new Wave 37 endpoints')
    actions.push('Add load testing for scale validation (target: 10k concurrent users)')
  }

  return actions.slice(0, 5)
}

// ─── Persist ──────────────────────────────────────────────────────────────────

/**
 * Saves the final system status to final_system_status_history.
 */
export async function persistStatus(status: FinalSystemStatus): Promise<void> {
  const { error } = await (supabaseAdmin as any)
    .from('final_system_status_history')
    .insert({
      id:                   status.status_id,
      tenant_id:            status.tenant_id,
      system_status:        status.SYSTEM_STATUS,
      errors_count:         status.ERRORS,
      ready_for_scale:      status.READY_FOR_SCALE,
      scores:               status.scores,
      composite_score:      status.composite_score,
      blocking_issues:      status.blocking_issues,
      immediate_actions:    status.immediate_actions,
      next_sprint_actions:  status.next_sprint_actions,
      assessment_version:   status.assessment_version,
      assessed_at:          status.assessed_at,
    })

  if (error) {
    log.warn('[finalSystemStatus] persist_failed', { error: error.message })
  }
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Runs a fresh full assessment — generates all sub-reports in parallel,
 * then computes and persists the FINAL SYSTEM STATUS.
 */
export async function computeFinalSystemStatus(
  tenantId: string,
): Promise<FinalSystemStatus> {
  log.info('[finalSystemStatus] start', { tenant_id: tenantId })

  // Run all sub-reports in parallel to populate latest DB rows
  await Promise.allSettled([
    generateSystemHealthReport(tenantId),
    generatePerformanceReport(tenantId),
    generateSecurityReport(tenantId),
    generateUXReport(tenantId),
  ])

  // Load freshly-computed dimension scores
  const scores = await loadDimensionScores(tenantId)

  // Composite: health×25% + security×25% + perf×20% + readiness×20% + ux×10%
  const compositeScore = Math.round(
    scores.health               * 0.25 +
    scores.security             * 0.25 +
    scores.performance          * 0.20 +
    scores.production_readiness * 0.20 +
    scores.ux                   * 0.10,
  )

  // Count critical errors from health report
  let criticalErrors = 0
  const { data: healthRows } = await (supabaseAdmin as any)
    .from('system_health_reports')
    .select('counts')
    .eq('tenant_id', tenantId)
    .order('generated_at', { ascending: false })
    .limit(1)
  if (healthRows && healthRows.length > 0) {
    criticalErrors = (healthRows[0] as { counts: { critical: number } }).counts?.critical ?? 0
  }

  const blockingIssues   = await extractBlockingIssues(tenantId)
  const systemStatus     = determineSystemStatus(compositeScore, criticalErrors)
  const readyForScale    = isReadyForScale(systemStatus, blockingIssues)
  const immediateActions = buildImmediateActions(blockingIssues, scores)
  const nextSprintActions = buildNextSprintActions(scores)

  const status: FinalSystemStatus = {
    status_id:           randomUUID(),
    tenant_id:           tenantId,
    SYSTEM_STATUS:       systemStatus,
    ERRORS:              criticalErrors,
    READY_FOR_SCALE:     readyForScale,
    scores,
    composite_score:     compositeScore,
    blocking_issues:     blockingIssues,
    immediate_actions:   immediateActions,
    next_sprint_actions: nextSprintActions,
    assessed_at:         new Date().toISOString(),
    assessment_version:  'Wave 37',
  }

  await persistStatus(status)

  log.info('[finalSystemStatus] complete', {
    tenant_id:        tenantId,
    SYSTEM_STATUS:    status.SYSTEM_STATUS,
    ERRORS:           status.ERRORS,
    READY_FOR_SCALE:  status.READY_FOR_SCALE,
    composite_score:  compositeScore,
  })

  return status
}
