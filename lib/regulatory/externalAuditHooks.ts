// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — External Audit Hooks v1.0
// lib/regulatory/externalAuditHooks.ts
//
// Hooks for external auditors (PwC, Deloitte, EY, KPMG) and pen-test pipelines.
// Manages audit engagements, findings, and evidence packages.
// =============================================================================

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type AuditorFirm = 'PWC' | 'DELOITTE' | 'EY' | 'KPMG' | 'INTERNAL'

export interface AuditEngagement {
  engagement_id: string
  tenant_id: string
  auditor_firm: AuditorFirm
  audit_type: 'FINANCIAL' | 'SOC2' | 'PENETRATION_TEST' | 'COMPLIANCE' | 'AML'
  scope: string[]
  status: 'PLANNED' | 'IN_PROGRESS' | 'FINDINGS_REVIEW' | 'COMPLETED' | 'CANCELLED'
  started_at: string | null
  completed_at: string | null
  findings_count: number
  critical_findings: number
  report_url: string | null
  created_at: string
}

export interface AuditFinding {
  finding_id: string
  engagement_id: string
  tenant_id: string
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL'
  category: string
  title: string
  description: string
  affected_component: string
  remediation_status: 'OPEN' | 'IN_PROGRESS' | 'REMEDIATED' | 'ACCEPTED_RISK'
  remediation_deadline: string | null
  created_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nowIso(): string {
  return new Date().toISOString()
}

// ─── Create Audit Engagement ──────────────────────────────────────────────────

export async function createAuditEngagement(
  tenantId: string,
  firm: AuditorFirm,
  auditType: AuditEngagement['audit_type'],
  scope: string[],
): Promise<AuditEngagement> {
  const engagement: AuditEngagement = {
    engagement_id: randomUUID(),
    tenant_id: tenantId,
    auditor_firm: firm,
    audit_type: auditType,
    scope,
    status: 'PLANNED',
    started_at: null,
    completed_at: null,
    findings_count: 0,
    critical_findings: 0,
    report_url: null,
    created_at: nowIso(),
  }

  await (supabaseAdmin as any)
    .from('audit_engagements')
    .insert({
      engagement_id: engagement.engagement_id,
      tenant_id: engagement.tenant_id,
      auditor_firm: engagement.auditor_firm,
      audit_type: engagement.audit_type,
      scope: engagement.scope,
      status: engagement.status,
      started_at: engagement.started_at,
      completed_at: engagement.completed_at,
      findings_count: engagement.findings_count,
      critical_findings: engagement.critical_findings,
      report_url: engagement.report_url,
      created_at: engagement.created_at,
    })

  log.info('[externalAuditHooks] engagement created', {
    engagement_id: engagement.engagement_id,
    firm,
    audit_type: auditType,
  })

  return engagement
}

// ─── Record Audit Finding ─────────────────────────────────────────────────────

export async function recordAuditFinding(
  engagementId: string,
  finding: Omit<AuditFinding, 'finding_id' | 'created_at' | 'engagement_id' | 'tenant_id'>,
  tenantId: string,
): Promise<AuditFinding> {
  const full: AuditFinding = {
    finding_id: randomUUID(),
    engagement_id: engagementId,
    tenant_id: tenantId,
    ...finding,
    created_at: nowIso(),
  }

  await (supabaseAdmin as any)
    .from('audit_findings')
    .insert({
      finding_id: full.finding_id,
      engagement_id: full.engagement_id,
      tenant_id: full.tenant_id,
      severity: full.severity,
      category: full.category,
      title: full.title,
      description: full.description,
      affected_component: full.affected_component,
      remediation_status: full.remediation_status,
      remediation_deadline: full.remediation_deadline,
      created_at: full.created_at,
    })

  // Update findings_count and critical_findings on engagement
  const isCritical = full.severity === 'CRITICAL'
  void (supabaseAdmin as any).rpc('increment_finding_counts', {
    p_engagement_id: engagementId,
    p_is_critical: isCritical,
  }).catch(() => {
    // Fallback: manual increment via select + update
    void (async () => {
      try {
        const { data } = await (supabaseAdmin as any)
          .from('audit_engagements')
          .select('findings_count, critical_findings')
          .eq('engagement_id', engagementId)
          .single()
        if (data) {
          const row = data as { findings_count: number; critical_findings: number }
          await (supabaseAdmin as any)
            .from('audit_engagements')
            .update({
              findings_count: row.findings_count + 1,
              critical_findings: row.critical_findings + (isCritical ? 1 : 0),
            })
            .eq('engagement_id', engagementId)
        }
      } catch (e) {
        log.warn('[externalAuditHooks] fallback findings_count update failed', { e })
      }
    })()
  })

  log.info('[externalAuditHooks] finding recorded', {
    finding_id: full.finding_id,
    engagement_id: engagementId,
    severity: full.severity,
  })

  return full
}

// ─── Generate Audit Evidence ──────────────────────────────────────────────────

export async function generateAuditEvidence(
  tenantId: string,
  scope: string[],
): Promise<Record<string, unknown>> {
  const [
    kycResult,
    amlResult,
    execResult,
    auditResult,
    reportResult,
  ] = await Promise.allSettled([
    (supabaseAdmin as any)
      .from('investor_kyc_records')
      .select('id', { count: 'exact' })
      .eq('tenant_id', tenantId),
    (supabaseAdmin as any)
      .from('aml_screening_results')
      .select('id', { count: 'exact' })
      .eq('tenant_id', tenantId),
    (supabaseAdmin as any)
      .from('execution_outcomes')
      .select('id', { count: 'exact' })
      .eq('tenant_id', tenantId),
    (supabaseAdmin as any)
      .from('regulatory_audit_trail')
      .select('event_id', { count: 'exact' })
      .eq('tenant_id', tenantId),
    (supabaseAdmin as any)
      .from('compliance_reports')
      .select('overall_score_pct')
      .eq('tenant_id', tenantId)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single(),
  ])

  const kycCount = kycResult.status === 'fulfilled' && Array.isArray(kycResult.value.data)
    ? (kycResult.value.data as unknown[]).length : 0
  const amlCount = amlResult.status === 'fulfilled' && Array.isArray(amlResult.value.data)
    ? (amlResult.value.data as unknown[]).length : 0
  const execCount = execResult.status === 'fulfilled' && Array.isArray(execResult.value.data)
    ? (execResult.value.data as unknown[]).length : 0
  const auditCount = auditResult.status === 'fulfilled' && Array.isArray(auditResult.value.data)
    ? (auditResult.value.data as unknown[]).length : 0
  const latestScore = reportResult.status === 'fulfilled' && reportResult.value.data
    ? (reportResult.value.data as { overall_score_pct: number }).overall_score_pct : null

  const evidence: Record<string, unknown> = {
    generated_at: nowIso(),
    tenant_id: tenantId,
    scope_requested: scope,
    kyc_verifications_count: kycCount,
    aml_screenings_count: amlCount,
    execution_outcomes_count: execCount,
    audit_trail_entries_count: auditCount,
    latest_compliance_score_pct: latestScore,
  }

  log.info('[externalAuditHooks] audit evidence generated', {
    tenant_id: tenantId,
    kyc_count: kycCount,
    aml_count: amlCount,
  })

  return evidence
}

// ─── Get Active Engagements ───────────────────────────────────────────────────

export async function getActiveEngagements(tenantId: string): Promise<AuditEngagement[]> {
  const { data, error } = await (supabaseAdmin as any)
    .from('audit_engagements')
    .select('*')
    .eq('tenant_id', tenantId)
    .in('status', ['PLANNED', 'IN_PROGRESS', 'FINDINGS_REVIEW'])
    .order('created_at', { ascending: false })

  if (error || !Array.isArray(data)) return []

  return (data as Array<Record<string, unknown>>).map(row => ({
    engagement_id: row.engagement_id as string,
    tenant_id: row.tenant_id as string,
    auditor_firm: row.auditor_firm as AuditorFirm,
    audit_type: row.audit_type as AuditEngagement['audit_type'],
    scope: row.scope as string[],
    status: row.status as AuditEngagement['status'],
    started_at: row.started_at as string | null,
    completed_at: row.completed_at as string | null,
    findings_count: row.findings_count as number,
    critical_findings: row.critical_findings as number,
    report_url: row.report_url as string | null,
    created_at: row.created_at as string,
  }))
}

// ─── Close Engagement ─────────────────────────────────────────────────────────

export async function closeEngagement(
  engagementId: string,
  reportUrl: string,
  tenantId: string,
): Promise<void> {
  await (supabaseAdmin as any)
    .from('audit_engagements')
    .update({
      status: 'COMPLETED',
      completed_at: nowIso(),
      report_url: reportUrl,
    })
    .eq('engagement_id', engagementId)
    .eq('tenant_id', tenantId)

  log.info('[externalAuditHooks] engagement closed', {
    engagement_id: engagementId,
    report_url: reportUrl,
  })
}
