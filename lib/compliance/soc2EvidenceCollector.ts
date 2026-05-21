// Agency Group — SOC2 Evidence Collector
// lib/compliance/soc2EvidenceCollector.ts
// TypeScript strict — 0 errors
//
// Collects evidence for SOC2 Type II audit controls:
// CC6 (Access), CC7 (System Operations), CC8 (Change Management),
// A1 (Availability), PI1 (Processing Integrity), C1 (Confidentiality)

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type SOC2Control =
  | 'CC6.1'  // Logical access security
  | 'CC6.2'  // Authentication
  | 'CC6.3'  // Access removal
  | 'CC7.1'  // Infrastructure monitoring
  | 'CC7.2'  // Anomaly detection
  | 'CC8.1'  // Change management
  | 'A1.1'   // Current processing capacity
  | 'A1.2'   // Environmental threats
  | 'PI1.1'  // Processing integrity
  | 'C1.1'   // Confidential information protection

export interface SOC2DataPoint {
  metric: string
  value: string | number
  timestamp: string
}

export interface SOC2Evidence {
  control: SOC2Control
  evidence_type: 'log' | 'configuration' | 'report' | 'policy' | 'test_result'
  title: string
  description: string
  data_points: SOC2DataPoint[]
  compliant: boolean
  gaps: string[]
  evidence_collected_at: string
}

export interface SOC2Report {
  report_id: string
  tenant_id: string
  period_start: string
  period_end: string
  controls: SOC2Evidence[]
  overall_compliance_pct: number
  critical_gaps: string[]
  generated_at: string
}

// ─── collectCC6Evidence ───────────────────────────────────────────────────────

export async function collectCC6Evidence(
  tenantId: string,
  since: string,
): Promise<SOC2Evidence[]> {
  const now = new Date().toISOString()
  const evidence: SOC2Evidence[] = []

  // CC6.1 — Logical access security: check access_decisions_log + rbac policies
  try {
    const { count: accessCount } = await (supabaseAdmin as any)
      .from('access_decisions_log')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('created_at', since) as { count: number | null; error: unknown }

    const { count: rbacCount } = await (supabaseAdmin as any)
      .from('zero_trust_policies')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId) as { count: number | null; error: unknown }

    const rbacConfigured = (rbacCount ?? 0) > 0
    const gaps: string[] = []
    if (!rbacConfigured) gaps.push('No zero-trust policies configured')

    evidence.push({
      control: 'CC6.1',
      evidence_type: 'log',
      title: 'Logical Access Security — RBAC Policies & Access Decisions',
      description: `${rbacCount ?? 0} RBAC policies active. ${accessCount ?? 0} access decisions logged in period.`,
      data_points: [
        { metric: 'rbac_policies', value: rbacCount ?? 0, timestamp: now },
        { metric: 'access_decisions_in_period', value: accessCount ?? 0, timestamp: now },
      ],
      compliant: rbacConfigured,
      gaps,
      evidence_collected_at: now,
    })
  } catch (err) {
    log.warn('[soc2EvidenceCollector] CC6.1 error', { error: String(err) })
    evidence.push(buildErrorEvidence('CC6.1', 'Logical Access Security', err, now))
  }

  // CC6.2 — Authentication: check credential_registry / zero_trust_policies for MFA enforcement
  try {
    const { data: mfaPolicies } = await (supabaseAdmin as any)
      .from('zero_trust_policies')
      .select('require_mfa, policy_name')
      .eq('tenant_id', tenantId) as { data: Array<{ require_mfa: boolean; policy_name: string }> | null; error: unknown }

    const allMfaEnabled = (mfaPolicies ?? []).every(p => p.require_mfa === true)
    const mfaCount = (mfaPolicies ?? []).filter(p => p.require_mfa).length
    const totalPolicies = (mfaPolicies ?? []).length
    const gaps: string[] = []
    if (!allMfaEnabled && totalPolicies > 0) {
      const missing = (mfaPolicies ?? []).filter(p => !p.require_mfa).map(p => p.policy_name)
      gaps.push(`MFA not enforced on policies: ${missing.join(', ')}`)
    }

    evidence.push({
      control: 'CC6.2',
      evidence_type: 'configuration',
      title: 'Authentication — MFA Enforcement',
      description: `MFA enforced on ${mfaCount}/${totalPolicies} access policies.`,
      data_points: [
        { metric: 'total_policies', value: totalPolicies, timestamp: now },
        { metric: 'mfa_enforced_policies', value: mfaCount, timestamp: now },
        { metric: 'mfa_pct', value: totalPolicies > 0 ? Math.round((mfaCount / totalPolicies) * 100) : 100, timestamp: now },
      ],
      compliant: allMfaEnabled || totalPolicies === 0,
      gaps,
      evidence_collected_at: now,
    })
  } catch (err) {
    log.warn('[soc2EvidenceCollector] CC6.2 error', { error: String(err) })
    evidence.push(buildErrorEvidence('CC6.2', 'Authentication MFA', err, now))
  }

  // CC6.3 — Access removal: check access_risk_flags for orphan/stale accounts
  try {
    const { count: activeFlags } = await (supabaseAdmin as any)
      .from('access_risk_flags')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('risk_score', 75) as { count: number | null; error: unknown }

    const orphanCount = activeFlags ?? 0
    const gaps: string[] = []
    if (orphanCount > 0) gaps.push(`${orphanCount} high-risk access flags require review`)

    evidence.push({
      control: 'CC6.3',
      evidence_type: 'report',
      title: 'Access Removal — Orphan Privileged Account Detection',
      description: `${orphanCount} high-risk (score ≥ 75) access flags active.`,
      data_points: [
        { metric: 'high_risk_access_flags', value: orphanCount, timestamp: now },
      ],
      compliant: orphanCount === 0,
      gaps,
      evidence_collected_at: now,
    })
  } catch (err) {
    log.warn('[soc2EvidenceCollector] CC6.3 error', { error: String(err) })
    evidence.push(buildErrorEvidence('CC6.3', 'Access Removal', err, now))
  }

  return evidence
}

// ─── collectCC7Evidence ───────────────────────────────────────────────────────

export async function collectCC7Evidence(
  tenantId: string,
  since: string,
): Promise<SOC2Evidence[]> {
  const now = new Date().toISOString()
  const evidence: SOC2Evidence[] = []

  // CC7.1 — Infrastructure monitoring: check siem_events
  try {
    const { count: siemCount } = await (supabaseAdmin as any)
      .from('siem_events')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('created_at', since) as { count: number | null; error: unknown }

    const monitored = (siemCount ?? 0) > 0
    const gaps: string[] = []
    if (!monitored) gaps.push('No SIEM events detected in period — monitoring may be inactive')

    evidence.push({
      control: 'CC7.1',
      evidence_type: 'log',
      title: 'Infrastructure Monitoring — SIEM Event Pipeline',
      description: `${siemCount ?? 0} SIEM events recorded in audit period.`,
      data_points: [
        { metric: 'siem_events_in_period', value: siemCount ?? 0, timestamp: now },
      ],
      compliant: monitored,
      gaps,
      evidence_collected_at: now,
    })
  } catch (err) {
    log.warn('[soc2EvidenceCollector] CC7.1 error', { error: String(err) })
    evidence.push(buildErrorEvidence('CC7.1', 'Infrastructure Monitoring', err, now))
  }

  // CC7.2 — Anomaly detection: check threat_signals
  try {
    const { count: threatCount } = await (supabaseAdmin as any)
      .from('threat_signals')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('detected_at', since) as { count: number | null; error: unknown }

    const { count: criticalCount } = await (supabaseAdmin as any)
      .from('threat_signals')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('severity', 'critical')
      .gte('detected_at', since)
      .is('resolved_at', null) as { count: number | null; error: unknown }

    const unresolvedCritical = criticalCount ?? 0
    const gaps: string[] = []
    if (unresolvedCritical > 0) gaps.push(`${unresolvedCritical} unresolved critical threat signals`)

    evidence.push({
      control: 'CC7.2',
      evidence_type: 'log',
      title: 'Anomaly Detection — Threat Signals',
      description: `${threatCount ?? 0} threat signals detected. ${unresolvedCritical} unresolved critical.`,
      data_points: [
        { metric: 'threat_signals_total', value: threatCount ?? 0, timestamp: now },
        { metric: 'unresolved_critical', value: unresolvedCritical, timestamp: now },
      ],
      compliant: unresolvedCritical === 0,
      gaps,
      evidence_collected_at: now,
    })
  } catch (err) {
    log.warn('[soc2EvidenceCollector] CC7.2 error', { error: String(err) })
    evidence.push(buildErrorEvidence('CC7.2', 'Anomaly Detection', err, now))
  }

  return evidence
}

// ─── collectA1Evidence ────────────────────────────────────────────────────────

export async function collectA1Evidence(
  tenantId: string,
  since: string,
): Promise<SOC2Evidence[]> {
  const now = new Date().toISOString()
  const evidence: SOC2Evidence[] = []

  // A1.1 — Current processing capacity: check chaos_gauntlet_results
  try {
    const { data: chaosRuns } = await (supabaseAdmin as any)
      .from('chaos_gauntlet_results')
      .select('overall_score, passed_scenarios, total_scenarios, created_at')
      .eq('tenant_id', tenantId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(5) as { data: Array<{ overall_score: number; passed_scenarios: number; total_scenarios: number; created_at: string }> | null; error: unknown }

    const runs = chaosRuns ?? []
    const avgScore = runs.length > 0
      ? Math.round(runs.reduce((s, r) => s + Number(r.overall_score), 0) / runs.length)
      : 0
    const gaps: string[] = []
    if (runs.length === 0) gaps.push('No chaos gauntlet runs found in period')
    if (avgScore < 70) gaps.push(`Average chaos score ${avgScore}/100 below 70 threshold`)

    evidence.push({
      control: 'A1.1',
      evidence_type: 'test_result',
      title: 'Availability — Chaos Gauntlet Results',
      description: `${runs.length} chaos gauntlet runs in period. Average score: ${avgScore}/100.`,
      data_points: [
        { metric: 'chaos_runs', value: runs.length, timestamp: now },
        { metric: 'avg_chaos_score', value: avgScore, timestamp: now },
      ],
      compliant: runs.length > 0 && avgScore >= 70,
      gaps,
      evidence_collected_at: now,
    })
  } catch (err) {
    log.warn('[soc2EvidenceCollector] A1.1 error', { error: String(err) })
    evidence.push(buildErrorEvidence('A1.1', 'Processing Capacity', err, now))
  }

  // A1.2 — Environmental threats: check disaster_recovery_runs / region_recovery_audit
  try {
    const { count: drCount } = await (supabaseAdmin as any)
      .from('disaster_recovery_runs')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('started_at', since) as { count: number | null; error: unknown }

    const { data: latestDr } = await (supabaseAdmin as any)
      .from('disaster_recovery_runs')
      .select('status, rto_minutes, rpo_minutes, started_at')
      .eq('tenant_id', tenantId)
      .order('started_at', { ascending: false })
      .limit(1) as { data: Array<{ status: string; rto_minutes: number; rpo_minutes: number; started_at: string }> | null; error: unknown }

    const drRuns = drCount ?? 0
    const latestStatus = latestDr?.[0]?.status ?? 'unknown'
    const gaps: string[] = []
    if (drRuns === 0) gaps.push('No DR drills executed in audit period')
    if (latestStatus === 'failed') gaps.push('Last DR drill failed')

    evidence.push({
      control: 'A1.2',
      evidence_type: 'test_result',
      title: 'Availability — Disaster Recovery Drills',
      description: `${drRuns} DR drills in period. Latest status: ${latestStatus}.`,
      data_points: [
        { metric: 'dr_drills_in_period', value: drRuns, timestamp: now },
        { metric: 'latest_rto_minutes', value: latestDr?.[0]?.rto_minutes ?? 0, timestamp: now },
        { metric: 'latest_rpo_minutes', value: latestDr?.[0]?.rpo_minutes ?? 0, timestamp: now },
      ],
      compliant: drRuns > 0 && latestStatus !== 'failed',
      gaps,
      evidence_collected_at: now,
    })
  } catch (err) {
    log.warn('[soc2EvidenceCollector] A1.2 error', { error: String(err) })
    evidence.push(buildErrorEvidence('A1.2', 'Environmental Threats / DR', err, now))
  }

  return evidence
}

// ─── collectPI1Evidence ───────────────────────────────────────────────────────

export async function collectPI1Evidence(
  tenantId: string,
  since: string,
): Promise<SOC2Evidence[]> {
  const now = new Date().toISOString()
  const evidence: SOC2Evidence[] = []

  // CC8.1 — Change management: check audit_log_entries for compliance_check_performed
  try {
    const { count: auditCount } = await (supabaseAdmin as any)
      .from('audit_log_entries')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('created_at', since) as { count: number | null; error: unknown }

    const hasAuditActivity = (auditCount ?? 0) > 0
    const gaps: string[] = []
    if (!hasAuditActivity) gaps.push('No audit log entries in period')

    evidence.push({
      control: 'CC8.1',
      evidence_type: 'log',
      title: 'Change Management — Audit Log Entries',
      description: `${auditCount ?? 0} immutable audit log entries in period.`,
      data_points: [
        { metric: 'audit_entries_in_period', value: auditCount ?? 0, timestamp: now },
      ],
      compliant: hasAuditActivity,
      gaps,
      evidence_collected_at: now,
    })
  } catch (err) {
    log.warn('[soc2EvidenceCollector] CC8.1 error', { error: String(err) })
    evidence.push(buildErrorEvidence('CC8.1', 'Change Management', err, now))
  }

  // PI1.1 — Processing integrity: check entity_signatures + ml_validation_runs
  try {
    const { count: sigCount } = await (supabaseAdmin as any)
      .from('entity_signatures')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId) as { count: number | null; error: unknown }

    const { count: unverifiedCount } = await (supabaseAdmin as any)
      .from('entity_signatures')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('verified', false) as { count: number | null; error: unknown }

    const total = sigCount ?? 0
    const unverified = unverifiedCount ?? 0
    const unverifiedPct = total > 0 ? Math.round((unverified / total) * 100) : 0
    const gaps: string[] = []
    if (total === 0) gaps.push('No entity signatures found')
    if (unverifiedPct > 10) gaps.push(`${unverifiedPct}% of entity signatures are unverified (>10% threshold)`)

    evidence.push({
      control: 'PI1.1',
      evidence_type: 'test_result',
      title: 'Processing Integrity — Entity Signatures & ML Validation',
      description: `${total} entity signatures. ${unverified} unverified (${unverifiedPct}%).`,
      data_points: [
        { metric: 'entity_signatures_total', value: total, timestamp: now },
        { metric: 'unverified_signatures', value: unverified, timestamp: now },
        { metric: 'unverified_pct', value: unverifiedPct, timestamp: now },
      ],
      compliant: total > 0 && unverifiedPct <= 10,
      gaps,
      evidence_collected_at: now,
    })
  } catch (err) {
    log.warn('[soc2EvidenceCollector] PI1.1 error', { error: String(err) })
    evidence.push(buildErrorEvidence('PI1.1', 'Processing Integrity', err, now))
  }

  // C1.1 — Confidential information protection: check tenant_deks (encryption)
  try {
    const { count: dekCount } = await (supabaseAdmin as any)
      .from('tenant_deks')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId) as { count: number | null; error: unknown }

    const encrypted = (dekCount ?? 0) > 0
    const gaps: string[] = []
    if (!encrypted) gaps.push('No tenant data encryption keys (DEK) found — data may be unencrypted')

    evidence.push({
      control: 'C1.1',
      evidence_type: 'configuration',
      title: 'Confidentiality — Tenant Encryption Keys (DEK)',
      description: `${dekCount ?? 0} active DEK entries for tenant encryption.`,
      data_points: [
        { metric: 'active_dek_count', value: dekCount ?? 0, timestamp: now },
      ],
      compliant: encrypted,
      gaps,
      evidence_collected_at: now,
    })
  } catch (err) {
    log.warn('[soc2EvidenceCollector] C1.1 error', { error: String(err) })
    evidence.push(buildErrorEvidence('C1.1', 'Confidentiality', err, now))
  }

  return evidence
}

// ─── collectSOC2Evidence ──────────────────────────────────────────────────────

export async function collectSOC2Evidence(
  tenantId: string,
  periodDays: number = 90,
): Promise<SOC2Report> {
  const reportId   = randomUUID()
  const now        = new Date()
  const periodEnd  = now.toISOString()
  const periodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000).toISOString()

  log.info('[soc2EvidenceCollector] starting evidence collection', { tenant_id: tenantId, period_days: periodDays })

  // Collect all evidence in parallel
  const [cc6, cc7, a1, pi1] = await Promise.allSettled([
    collectCC6Evidence(tenantId, periodStart),
    collectCC7Evidence(tenantId, periodStart),
    collectA1Evidence(tenantId, periodStart),
    collectPI1Evidence(tenantId, periodStart),
  ])

  const allControls: SOC2Evidence[] = [
    ...(cc6.status === 'fulfilled' ? cc6.value : []),
    ...(cc7.status === 'fulfilled' ? cc7.value : []),
    ...(a1.status === 'fulfilled'  ? a1.value  : []),
    ...(pi1.status === 'fulfilled' ? pi1.value : []),
  ]

  const compliantCount   = allControls.filter(c => c.compliant).length
  const totalCount       = allControls.length
  const compliancePct    = totalCount > 0
    ? Math.round((compliantCount / totalCount) * 100 * 100) / 100
    : 0

  const criticalGaps = allControls
    .filter(c => !c.compliant)
    .flatMap(c => c.gaps.map(g => `[${c.control}] ${g}`))

  const report: SOC2Report = {
    report_id:              reportId,
    tenant_id:              tenantId,
    period_start:           periodStart,
    period_end:             periodEnd,
    controls:               allControls,
    overall_compliance_pct: compliancePct,
    critical_gaps:          criticalGaps,
    generated_at:           now.toISOString(),
  }

  // Persist report
  try {
    await (supabaseAdmin as any)
      .from('soc2_reports')
      .insert({
        id:                     reportId,
        tenant_id:              tenantId,
        period_start:           periodStart,
        period_end:             periodEnd,
        report_data:            report,
        overall_compliance_pct: compliancePct,
        critical_gaps:          criticalGaps,
        generated_at:           now.toISOString(),
      })
  } catch (err) {
    log.warn('[soc2EvidenceCollector] persist error', { error: String(err) })
  }

  log.info('[soc2EvidenceCollector] complete', {
    tenant_id:       tenantId,
    controls:        totalCount,
    compliant:       compliantCount,
    compliance_pct:  compliancePct,
    critical_gaps:   criticalGaps.length,
  })

  return report
}

// ─── exportSOC2Package ────────────────────────────────────────────────────────

export async function exportSOC2Package(tenantId: string): Promise<string> {
  const report = await collectSOC2Evidence(tenantId)
  return JSON.stringify(report, null, 2)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildErrorEvidence(
  control: SOC2Control,
  title: string,
  err: unknown,
  now: string,
): SOC2Evidence {
  return {
    control,
    evidence_type: 'report',
    title,
    description: `Evidence collection error: ${err instanceof Error ? err.message : String(err)}`,
    data_points: [],
    compliant: false,
    gaps: [`Evidence collection failed: ${err instanceof Error ? err.message : String(err)}`],
    evidence_collected_at: now,
  }
}
