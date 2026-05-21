// Agency Group — System Health Report
// lib/dashboard/systemHealthReport.ts
// TypeScript strict — 0 errors
//
// Aggregates all health data into structured SYSTEM HEALTH REPORT.
// Sources: portal_health_maps, gap_detection_reports, system_truth_audits, component_coverage_reports
// Output: Critical/High/Medium/Low issue counts + top issues

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HealthIssue {
  title: string
  description: string
  affected_component: string
  fix_effort: string
}

export interface SystemHealthReport {
  report_id: string
  tenant_id: string

  issues: {
    critical: HealthIssue[]
    high: HealthIssue[]
    medium: HealthIssue[]
    low: HealthIssue[]
  }

  counts: {
    critical: number
    high: number
    medium: number
    low: number
    total: number
  }

  health_score: number   // 0–100
  status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL'

  top_3_critical_actions: string[]

  generated_at: string
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function toHealthIssue(raw: Record<string, unknown>): HealthIssue {
  return {
    title:              String(raw['title']              ?? 'Unknown issue'),
    description:        String(raw['description']        ?? ''),
    affected_component: String(raw['affected_component'] ?? 'unknown'),
    fix_effort:         String(raw['fix_effort']         ?? 'medium'),
  }
}

// ─── Core functions ───────────────────────────────────────────────────────────

/**
 * Combines issues from portal_health_maps, gap_detection_reports,
 * system_truth_audits and component_coverage_reports into a unified set.
 */
export async function aggregateIssues(
  tenantId: string,
): Promise<SystemHealthReport['issues']> {
  const result: SystemHealthReport['issues'] = {
    critical: [],
    high: [],
    medium: [],
    low: [],
  }

  // ── portal_health_maps ─────────────────────────────────────────────────────
  const { data: healthMaps } = await (supabaseAdmin as any)
    .from('portal_health_maps')
    .select('issues')
    .eq('tenant_id', tenantId)
    .order('generated_at', { ascending: false })
    .limit(1)

  if (healthMaps && healthMaps.length > 0) {
    const issues = healthMaps[0].issues as Record<string, unknown[]> | null
    if (issues) {
      for (const raw of issues['CRITICAL'] ?? []) {
        result.critical.push(toHealthIssue(raw as Record<string, unknown>))
      }
      for (const raw of issues['HIGH'] ?? []) {
        result.high.push(toHealthIssue(raw as Record<string, unknown>))
      }
      for (const raw of issues['MEDIUM'] ?? []) {
        result.medium.push(toHealthIssue(raw as Record<string, unknown>))
      }
      for (const raw of issues['LOW'] ?? []) {
        result.low.push(toHealthIssue(raw as Record<string, unknown>))
      }
    }
  }

  // ── gap_detection_reports ──────────────────────────────────────────────────
  const { data: gapReports } = await (supabaseAdmin as any)
    .from('gap_detection_reports')
    .select('critical_gaps, high_gaps, medium_gaps')
    .eq('tenant_id', tenantId)
    .order('generated_at', { ascending: false })
    .limit(1)

  if (gapReports && gapReports.length > 0) {
    const r = gapReports[0] as Record<string, unknown[]>
    for (const gap of r['critical_gaps'] ?? []) {
      const g = gap as Record<string, unknown>
      result.critical.push({
        title:              String(g['gap_type']       ?? 'Critical gap detected'),
        description:        String(g['description']    ?? ''),
        affected_component: String(g['component']      ?? 'system'),
        fix_effort:         String(g['fix_effort']     ?? 'large'),
      })
    }
    for (const gap of r['high_gaps'] ?? []) {
      const g = gap as Record<string, unknown>
      result.high.push({
        title:              String(g['gap_type']       ?? 'High gap detected'),
        description:        String(g['description']    ?? ''),
        affected_component: String(g['component']      ?? 'system'),
        fix_effort:         String(g['fix_effort']     ?? 'medium'),
      })
    }
    for (const gap of r['medium_gaps'] ?? []) {
      const g = gap as Record<string, unknown>
      result.medium.push({
        title:              String(g['gap_type']       ?? 'Medium gap detected'),
        description:        String(g['description']    ?? ''),
        affected_component: String(g['component']      ?? 'system'),
        fix_effort:         String(g['fix_effort']     ?? 'small'),
      })
    }
  }

  // ── system_truth_audits ────────────────────────────────────────────────────
  const { data: truthAudits } = await (supabaseAdmin as any)
    .from('system_truth_audits')
    .select('dimensions, overall_status')
    .eq('tenant_id', tenantId)
    .order('audited_at', { ascending: false })
    .limit(1)

  if (truthAudits && truthAudits.length > 0) {
    const dims = (truthAudits[0].dimensions ?? {}) as Record<string, { score: number; status: string; summary: string }>
    for (const [dim, info] of Object.entries(dims)) {
      if (info.status === 'fail') {
        result.critical.push({
          title:              `System truth FAIL: ${dim}`,
          description:        info.summary,
          affected_component: dim,
          fix_effort:         'large',
        })
      } else if (info.status === 'warn') {
        result.high.push({
          title:              `System truth WARN: ${dim}`,
          description:        info.summary,
          affected_component: dim,
          fix_effort:         'medium',
        })
      }
    }
  }

  // ── component_coverage_reports ─────────────────────────────────────────────
  const { data: coverageReports } = await (supabaseAdmin as any)
    .from('component_coverage_reports')
    .select('dead_sections, coverage_score')
    .eq('tenant_id', tenantId)
    .order('generated_at', { ascending: false })
    .limit(1)

  if (coverageReports && coverageReports.length > 0) {
    const deadSections = (coverageReports[0].dead_sections ?? []) as string[]
    const coverageScore = (coverageReports[0].coverage_score ?? 100) as number
    if (deadSections.length > 0) {
      result.medium.push({
        title:              `${deadSections.length} dead portal section(s) detected`,
        description:        `Unused sections: ${deadSections.slice(0, 5).join(', ')}`,
        affected_component: 'portal/components',
        fix_effort:         'small',
      })
    }
    if (coverageScore < 70) {
      result.high.push({
        title:              `Low component coverage score: ${coverageScore.toFixed(0)}/100`,
        description:        'Multiple portal sections lack real data or error states',
        affected_component: 'portal/components',
        fix_effort:         'medium',
      })
    }
  }

  return result
}

/**
 * Computes health score: 100 − (critical×25 + high×10 + medium×3 + low×1), min 0.
 */
export function computeHealthScore(counts: SystemHealthReport['counts']): number {
  const raw = 100 - (counts.critical * 25 + counts.high * 10 + counts.medium * 3 + counts.low * 1)
  return Math.max(0, raw)
}

/**
 * Derives status label from health score.
 */
function deriveStatus(score: number, criticalCount: number): SystemHealthReport['status'] {
  if (criticalCount > 0 || score < 50) return 'CRITICAL'
  if (score < 80) return 'DEGRADED'
  return 'HEALTHY'
}

/**
 * Builds the top-3 critical actions from the issue sets.
 */
function buildTop3Actions(issues: SystemHealthReport['issues']): string[] {
  const actions: string[] = []
  const criticals = issues.critical.slice(0, 3)
  for (const issue of criticals) {
    actions.push(`[CRITICAL] Fix ${issue.affected_component}: ${issue.title}`)
  }
  // Fill from high if needed
  if (actions.length < 3) {
    for (const issue of issues.high.slice(0, 3 - actions.length)) {
      actions.push(`[HIGH] Fix ${issue.affected_component}: ${issue.title}`)
    }
  }
  // Fill from medium if still needed
  if (actions.length < 3) {
    for (const issue of issues.medium.slice(0, 3 - actions.length)) {
      actions.push(`[MEDIUM] Resolve ${issue.affected_component}: ${issue.title}`)
    }
  }
  if (actions.length === 0) {
    actions.push('No critical actions — system is healthy')
  }
  return actions.slice(0, 3)
}

/**
 * Persists the report to system_health_reports.
 */
export async function persistReport(report: SystemHealthReport): Promise<void> {
  const { error } = await (supabaseAdmin as any)
    .from('system_health_reports')
    .insert({
      id:                    report.report_id,
      tenant_id:             report.tenant_id,
      issues:                report.issues,
      counts:                report.counts,
      health_score:          report.health_score,
      status:                report.status,
      top_3_critical_actions: report.top_3_critical_actions,
      generated_at:          report.generated_at,
    })

  if (error) {
    log.warn('[systemHealthReport] persist_failed', { error: error.message })
  }
}

/**
 * Main entry point — generates and persists a full System Health Report.
 */
export async function generateSystemHealthReport(tenantId: string): Promise<SystemHealthReport> {
  log.info('[systemHealthReport] start', { tenant_id: tenantId })

  const issues = await aggregateIssues(tenantId)

  const counts: SystemHealthReport['counts'] = {
    critical: issues.critical.length,
    high:     issues.high.length,
    medium:   issues.medium.length,
    low:      issues.low.length,
    total:    issues.critical.length + issues.high.length + issues.medium.length + issues.low.length,
  }

  const health_score = computeHealthScore(counts)
  const status       = deriveStatus(health_score, counts.critical)
  const top_3        = buildTop3Actions(issues)
  const generated_at = new Date().toISOString()

  const report: SystemHealthReport = {
    report_id:              randomUUID(),
    tenant_id:              tenantId,
    issues,
    counts,
    health_score,
    status,
    top_3_critical_actions: top_3,
    generated_at,
  }

  await persistReport(report)

  log.info('[systemHealthReport] complete', {
    tenant_id:    tenantId,
    health_score,
    status,
    counts,
  })

  return report
}
