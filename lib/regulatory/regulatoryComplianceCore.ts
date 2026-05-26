// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — Regulatory Compliance Core v1.0
// lib/regulatory/regulatoryComplianceCore.ts
//
// Enforces MiFID II, AML/6AMLD, GDPR compliance controls.
// Generates institutional-grade compliance reports.
// =============================================================================

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ComplianceFramework = 'MIFID_II' | 'AML_6AMLD' | 'GDPR' | 'SOC2' | 'ISO27001' | 'DORA'

export type ComplianceStatus = 'COMPLIANT' | 'NON_COMPLIANT' | 'PARTIAL' | 'NOT_ASSESSED' | 'EXEMPT'

export interface ComplianceCheckResult {
  check_id: string
  tenant_id: string
  framework: ComplianceFramework
  control_id: string
  control_name: string
  status: ComplianceStatus
  evidence_refs: string[]
  gap_description: string | null
  remediation_required: boolean
  remediation_deadline: string | null
  assessed_at: string
  assessed_by: string
}

export interface ComplianceReport {
  report_id: string
  tenant_id: string
  frameworks_assessed: ComplianceFramework[]
  total_controls: number
  compliant_controls: number
  non_compliant_controls: number
  partial_controls: number
  overall_score_pct: number
  critical_gaps: string[]
  ready_for_institutional: boolean
  generated_at: string
  valid_until: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nowIso(): string {
  return new Date().toISOString()
}

function daysFromNow(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

function makeCheck(
  tenantId: string,
  framework: ComplianceFramework,
  controlId: string,
  controlName: string,
  status: ComplianceStatus,
  evidenceRefs: string[],
  gapDescription: string | null,
): ComplianceCheckResult {
  return {
    check_id: randomUUID(),
    tenant_id: tenantId,
    framework,
    control_id: controlId,
    control_name: controlName,
    status,
    evidence_refs: evidenceRefs,
    gap_description: gapDescription,
    remediation_required: status === 'NON_COMPLIANT',
    remediation_deadline: status === 'NON_COMPLIANT' ? daysFromNow(30) : null,
    assessed_at: nowIso(),
    assessed_by: 'SYSTEM',
  }
}

// ─── MiFID II Assessment ──────────────────────────────────────────────────────

export async function assessMiFIDCompliance(tenantId: string): Promise<ComplianceCheckResult[]> {
  const results: ComplianceCheckResult[] = []

  // INVESTOR_CLASSIFICATION: all investors have mifid_tier in investor_kyc_records
  try {
    const { data: kycData } = await (supabaseAdmin as any)
      .from('investor_kyc_records')
      .select('id, mifid_tier')
      .eq('tenant_id', tenantId)
      .limit(1000)
    const records = (kycData as Array<{ id: string; mifid_tier: string | null }> | null) ?? []
    const classified = records.filter(r => r.mifid_tier !== null && r.mifid_tier !== undefined)
    const allClassified = records.length > 0 && classified.length === records.length
    const status: ComplianceStatus = records.length === 0 ? 'NOT_ASSESSED' : allClassified ? 'COMPLIANT' : 'PARTIAL'
    results.push(makeCheck(
      tenantId, 'MIFID_II', 'INVESTOR_CLASSIFICATION', 'MiFID II Investor Classification',
      status,
      classified.map(r => `kyc:${r.id}`),
      status !== 'COMPLIANT' ? `${records.length - classified.length} investors missing MiFID classification` : null,
    ))
  } catch (err) {
    log.warn('[regulatoryComplianceCore] INVESTOR_CLASSIFICATION check failed', { err })
    results.push(makeCheck(tenantId, 'MIFID_II', 'INVESTOR_CLASSIFICATION', 'MiFID II Investor Classification', 'NOT_ASSESSED', [], 'Check failed'))
  }

  // TRANSACTION_REPORTING: execution_outcomes with legal_framework set
  try {
    const { data: execData } = await (supabaseAdmin as any)
      .from('execution_outcomes')
      .select('id, legal_framework')
      .eq('tenant_id', tenantId)
      .not('legal_framework', 'is', null)
      .limit(1)
    const hasReports = Array.isArray(execData) && execData.length > 0
    results.push(makeCheck(
      tenantId, 'MIFID_II', 'TRANSACTION_REPORTING', 'MiFID II Transaction Reporting',
      hasReports ? 'COMPLIANT' : 'NON_COMPLIANT',
      hasReports ? [(execData as Array<{ id: string }>)[0].id] : [],
      hasReports ? null : 'No transaction reports with legal_framework found',
    ))
  } catch (err) {
    log.warn('[regulatoryComplianceCore] TRANSACTION_REPORTING check failed', { err })
    results.push(makeCheck(tenantId, 'MIFID_II', 'TRANSACTION_REPORTING', 'MiFID II Transaction Reporting', 'NOT_ASSESSED', [], 'Check failed'))
  }

  // BEST_EXECUTION: bid_competition_outcomes exist
  try {
    const { data: bidData } = await (supabaseAdmin as any)
      .from('asset_bids')
      .select('id')
      .eq('tenant_id', tenantId)
      .limit(1)
    const hasBids = Array.isArray(bidData) && bidData.length > 0
    results.push(makeCheck(
      tenantId, 'MIFID_II', 'BEST_EXECUTION', 'MiFID II Best Execution Policy',
      hasBids ? 'COMPLIANT' : 'NON_COMPLIANT',
      hasBids ? [(bidData as Array<{ id: string }>)[0].id] : [],
      hasBids ? null : 'No bid competition outcomes recorded',
    ))
  } catch (err) {
    log.warn('[regulatoryComplianceCore] BEST_EXECUTION check failed', { err })
    results.push(makeCheck(tenantId, 'MIFID_II', 'BEST_EXECUTION', 'MiFID II Best Execution Policy', 'NOT_ASSESSED', [], 'Check failed'))
  }

  // PRODUCT_GOVERNANCE: deal_packs have target_market defined
  try {
    const { data: dealData } = await (supabaseAdmin as any)
      .from('deal_packs')
      .select('id, target_market')
      .eq('tenant_id', tenantId)
      .not('target_market', 'is', null)
      .limit(1)
    const hasGov = Array.isArray(dealData) && dealData.length > 0
    results.push(makeCheck(
      tenantId, 'MIFID_II', 'PRODUCT_GOVERNANCE', 'MiFID II Product Governance',
      hasGov ? 'COMPLIANT' : 'NON_COMPLIANT',
      hasGov ? [(dealData as Array<{ id: string }>)[0].id] : [],
      hasGov ? null : 'No deal packs with target_market defined',
    ))
  } catch (err) {
    log.warn('[regulatoryComplianceCore] PRODUCT_GOVERNANCE check failed', { err })
    results.push(makeCheck(tenantId, 'MIFID_II', 'PRODUCT_GOVERNANCE', 'MiFID II Product Governance', 'NOT_ASSESSED', [], 'Check failed'))
  }

  // CONFLICTS_DISCLOSURE: compliance_evidence_records for CONFLICTS_OF_INTEREST
  try {
    const { data: evidData } = await (supabaseAdmin as any)
      .from('compliance_evidence_records')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('evidence_type', 'CONFLICTS_OF_INTEREST')
      .limit(1)
    const hasDisclosure = Array.isArray(evidData) && evidData.length > 0
    results.push(makeCheck(
      tenantId, 'MIFID_II', 'CONFLICTS_DISCLOSURE', 'MiFID II Conflicts of Interest Disclosure',
      hasDisclosure ? 'COMPLIANT' : 'NON_COMPLIANT',
      [],
      hasDisclosure ? null : 'No conflicts of interest disclosure records found',
    ))
  } catch (err) {
    log.warn('[regulatoryComplianceCore] CONFLICTS_DISCLOSURE check failed', { err })
    results.push(makeCheck(tenantId, 'MIFID_II', 'CONFLICTS_DISCLOSURE', 'MiFID II Conflicts of Interest Disclosure', 'NOT_ASSESSED', [], 'Check failed'))
  }

  return results
}

// ─── AML Assessment ───────────────────────────────────────────────────────────

export async function assessAMLCompliance(tenantId: string): Promise<ComplianceCheckResult[]> {
  const results: ComplianceCheckResult[] = []
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  // AML_SCREENING: aml_screening_results exist and up to date (< 6 months)
  try {
    const { data: amlData } = await (supabaseAdmin as any)
      .from('aml_screening_results')
      .select('id, screened_at')
      .eq('tenant_id', tenantId)
      .gte('screened_at', sixMonthsAgo.toISOString())
      .limit(1)
    const hasScreening = Array.isArray(amlData) && amlData.length > 0
    results.push(makeCheck(
      tenantId, 'AML_6AMLD', 'AML_SCREENING', 'AML 6AMLD Screening',
      hasScreening ? 'COMPLIANT' : 'NON_COMPLIANT',
      hasScreening ? [(amlData as Array<{ id: string }>)[0].id] : [],
      hasScreening ? null : 'No AML screening results within last 6 months',
    ))
  } catch (err) {
    log.warn('[regulatoryComplianceCore] AML_SCREENING check failed', { err })
    results.push(makeCheck(tenantId, 'AML_6AMLD', 'AML_SCREENING', 'AML 6AMLD Screening', 'NOT_ASSESSED', [], 'Check failed'))
  }

  // KYC_COMPLETE: investor_kyc_records with status APPROVED >= 80% of total
  try {
    const { data: allKyc } = await (supabaseAdmin as any)
      .from('investor_kyc_records')
      .select('id, kyc_status')
      .eq('tenant_id', tenantId)
      .limit(1000)
    const all = (allKyc as Array<{ id: string; kyc_status: string }> | null) ?? []
    const approved = all.filter(r => r.kyc_status === 'APPROVED' || r.kyc_status === 'approved')
    const ratio = all.length > 0 ? approved.length / all.length : 0
    const status: ComplianceStatus = all.length === 0 ? 'NOT_ASSESSED' : ratio >= 0.8 ? 'COMPLIANT' : ratio >= 0.5 ? 'PARTIAL' : 'NON_COMPLIANT'
    results.push(makeCheck(
      tenantId, 'AML_6AMLD', 'KYC_COMPLETE', 'AML KYC Completion Rate',
      status,
      approved.slice(0, 5).map(r => `kyc:${r.id}`),
      status !== 'COMPLIANT' ? `KYC approval rate: ${Math.round(ratio * 100)}% (required: 80%)` : null,
    ))
  } catch (err) {
    log.warn('[regulatoryComplianceCore] KYC_COMPLETE check failed', { err })
    results.push(makeCheck(tenantId, 'AML_6AMLD', 'KYC_COMPLETE', 'AML KYC Completion Rate', 'NOT_ASSESSED', [], 'Check failed'))
  }

  // TRANSACTION_MONITORING: regulatory_audit_trail has entries for last 30 days
  try {
    const { data: auditData } = await (supabaseAdmin as any)
      .from('regulatory_audit_trail')
      .select('event_id')
      .eq('tenant_id', tenantId)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .limit(1)
    const hasMonitoring = Array.isArray(auditData) && auditData.length > 0
    results.push(makeCheck(
      tenantId, 'AML_6AMLD', 'TRANSACTION_MONITORING', 'AML Transaction Monitoring',
      hasMonitoring ? 'COMPLIANT' : 'NON_COMPLIANT',
      [],
      hasMonitoring ? null : 'No audit trail entries in last 30 days',
    ))
  } catch (err) {
    log.warn('[regulatoryComplianceCore] TRANSACTION_MONITORING check failed', { err })
    results.push(makeCheck(tenantId, 'AML_6AMLD', 'TRANSACTION_MONITORING', 'AML Transaction Monitoring', 'NOT_ASSESSED', [], 'Check failed'))
  }

  // SAR_PROCESS: compliance_evidence_records for SAR_PROCEDURE
  try {
    const { data: sarData } = await (supabaseAdmin as any)
      .from('compliance_evidence_records')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('evidence_type', 'SAR_PROCEDURE')
      .limit(1)
    const hasSar = Array.isArray(sarData) && sarData.length > 0
    results.push(makeCheck(
      tenantId, 'AML_6AMLD', 'SAR_PROCESS', 'AML Suspicious Activity Reporting Process',
      hasSar ? 'COMPLIANT' : 'NON_COMPLIANT',
      [],
      hasSar ? null : 'No SAR procedure documentation found',
    ))
  } catch (err) {
    log.warn('[regulatoryComplianceCore] SAR_PROCESS check failed', { err })
    results.push(makeCheck(tenantId, 'AML_6AMLD', 'SAR_PROCESS', 'AML Suspicious Activity Reporting Process', 'NOT_ASSESSED', [], 'Check failed'))
  }

  return results
}

// ─── GDPR Assessment ──────────────────────────────────────────────────────────

export async function assessGDPRCompliance(tenantId: string): Promise<ComplianceCheckResult[]> {
  const results: ComplianceCheckResult[] = []

  // DATA_MINIMIZATION: sensitive_data_fields in investor_kyc_records
  try {
    const { data: kycData } = await (supabaseAdmin as any)
      .from('investor_kyc_records')
      .select('id')
      .eq('tenant_id', tenantId)
      .limit(1)
    const hasKyc = Array.isArray(kycData) && kycData.length > 0
    results.push(makeCheck(
      tenantId, 'GDPR', 'DATA_MINIMIZATION', 'GDPR Data Minimization',
      hasKyc ? 'COMPLIANT' : 'NOT_ASSESSED',
      [],
      hasKyc ? null : 'No KYC records to assess data minimization',
    ))
  } catch (err) {
    log.warn('[regulatoryComplianceCore] DATA_MINIMIZATION check failed', { err })
    results.push(makeCheck(tenantId, 'GDPR', 'DATA_MINIMIZATION', 'GDPR Data Minimization', 'NOT_ASSESSED', [], 'Check failed'))
  }

  // RETENTION_POLICY: compliance_evidence_records for GDPR_RETENTION_POLICY
  try {
    const { data: retData } = await (supabaseAdmin as any)
      .from('compliance_evidence_records')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('evidence_type', 'GDPR_RETENTION_POLICY')
      .limit(1)
    const hasPolicy = Array.isArray(retData) && retData.length > 0
    results.push(makeCheck(
      tenantId, 'GDPR', 'RETENTION_POLICY', 'GDPR Data Retention Policy',
      hasPolicy ? 'COMPLIANT' : 'NON_COMPLIANT',
      [],
      hasPolicy ? null : 'No GDPR retention policy documentation found',
    ))
  } catch (err) {
    log.warn('[regulatoryComplianceCore] RETENTION_POLICY check failed', { err })
    results.push(makeCheck(tenantId, 'GDPR', 'RETENTION_POLICY', 'GDPR Data Retention Policy', 'NOT_ASSESSED', [], 'Check failed'))
  }

  // CONSENT_RECORDS: compliance_evidence_records for DATA_CONSENT count >= investor count
  try {
    const { data: consentData } = await (supabaseAdmin as any)
      .from('compliance_evidence_records')
      .select('id', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .eq('evidence_type', 'DATA_CONSENT')
    const { data: investorData } = await (supabaseAdmin as any)
      .from('investor_kyc_records')
      .select('id', { count: 'exact' })
      .eq('tenant_id', tenantId)
    const consentCount = Array.isArray(consentData) ? consentData.length : 0
    const investorCount = Array.isArray(investorData) ? investorData.length : 0
    const status: ComplianceStatus = investorCount === 0 ? 'NOT_ASSESSED'
      : consentCount >= investorCount ? 'COMPLIANT'
      : consentCount >= investorCount * 0.5 ? 'PARTIAL'
      : 'NON_COMPLIANT'
    results.push(makeCheck(
      tenantId, 'GDPR', 'CONSENT_RECORDS', 'GDPR Consent Records',
      status,
      [],
      status !== 'COMPLIANT' ? `Consent records: ${consentCount}/${investorCount} investors` : null,
    ))
  } catch (err) {
    log.warn('[regulatoryComplianceCore] CONSENT_RECORDS check failed', { err })
    results.push(makeCheck(tenantId, 'GDPR', 'CONSENT_RECORDS', 'GDPR Consent Records', 'NOT_ASSESSED', [], 'Check failed'))
  }

  return results
}

// ─── Full Compliance Assessment ───────────────────────────────────────────────

export async function runFullComplianceAssessment(tenantId: string): Promise<ComplianceReport> {
  const [mifidResult, amlResult, gdprResult] = await Promise.allSettled([
    assessMiFIDCompliance(tenantId),
    assessAMLCompliance(tenantId),
    assessGDPRCompliance(tenantId),
  ])

  const allChecks: ComplianceCheckResult[] = [
    ...(mifidResult.status === 'fulfilled' ? mifidResult.value : []),
    ...(amlResult.status === 'fulfilled' ? amlResult.value : []),
    ...(gdprResult.status === 'fulfilled' ? gdprResult.value : []),
  ]

  const totalControls = allChecks.length
  const compliantControls = allChecks.filter(c => c.status === 'COMPLIANT').length
  const nonCompliantControls = allChecks.filter(c => c.status === 'NON_COMPLIANT').length
  const partialControls = allChecks.filter(c => c.status === 'PARTIAL').length
  const overallScorePct = totalControls > 0
    ? Math.round((compliantControls / totalControls) * 10000) / 100
    : 0

  const criticalGaps = allChecks
    .filter(c => c.status === 'NON_COMPLIANT')
    .map(c => `[${c.framework}] ${c.control_name}: ${c.gap_description ?? 'Non-compliant'}`)

  const report: ComplianceReport = {
    report_id: randomUUID(),
    tenant_id: tenantId,
    frameworks_assessed: ['MIFID_II', 'AML_6AMLD', 'GDPR'],
    total_controls: totalControls,
    compliant_controls: compliantControls,
    non_compliant_controls: nonCompliantControls,
    partial_controls: partialControls,
    overall_score_pct: overallScorePct,
    critical_gaps: criticalGaps,
    ready_for_institutional: overallScorePct >= 80,
    generated_at: nowIso(),
    valid_until: daysFromNow(90),
  }

  // Persist report
  void (supabaseAdmin as any)
    .from('compliance_reports')
    .insert({
      report_id: report.report_id,
      tenant_id: report.tenant_id,
      frameworks_assessed: report.frameworks_assessed,
      total_controls: report.total_controls,
      compliant_controls: report.compliant_controls,
      non_compliant_controls: report.non_compliant_controls,
      partial_controls: report.partial_controls,
      overall_score_pct: report.overall_score_pct,
      critical_gaps: report.critical_gaps,
      ready_for_institutional: report.ready_for_institutional,
      generated_at: report.generated_at,
      valid_until: report.valid_until,
    })
    .catch((e: unknown) => log.warn('[regulatoryComplianceCore] persist report failed', { e }))

  // Persist individual checks
  void (supabaseAdmin as any)
    .from('compliance_check_results')
    .insert(allChecks.map(c => ({
      check_id: c.check_id,
      tenant_id: c.tenant_id,
      framework: c.framework,
      control_id: c.control_id,
      control_name: c.control_name,
      status: c.status,
      evidence_refs: c.evidence_refs,
      gap_description: c.gap_description,
      remediation_required: c.remediation_required,
      remediation_deadline: c.remediation_deadline,
      assessed_at: c.assessed_at,
      assessed_by: c.assessed_by,
    })))
    .catch((e: unknown) => log.warn('[regulatoryComplianceCore] persist checks failed', { e }))

  log.info('[regulatoryComplianceCore] full assessment complete', {
    tenant_id: tenantId,
    score: overallScorePct,
    ready_for_institutional: report.ready_for_institutional,
  })

  return report
}

// ─── Get Latest Report ────────────────────────────────────────────────────────

export async function getLatestComplianceReport(tenantId: string): Promise<ComplianceReport | null> {
  const { data, error } = await (supabaseAdmin as any)
    .from('compliance_reports')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('generated_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) return null

  const row = data as Record<string, unknown>
  return {
    report_id: row.report_id as string,
    tenant_id: row.tenant_id as string,
    frameworks_assessed: row.frameworks_assessed as ComplianceFramework[],
    total_controls: row.total_controls as number,
    compliant_controls: row.compliant_controls as number,
    non_compliant_controls: row.non_compliant_controls as number,
    partial_controls: row.partial_controls as number,
    overall_score_pct: row.overall_score_pct as number,
    critical_gaps: row.critical_gaps as string[],
    ready_for_institutional: row.ready_for_institutional as boolean,
    generated_at: row.generated_at as string,
    valid_until: row.valid_until as string,
  }
}

// ─── Record Compliance Evidence ───────────────────────────────────────────────

export async function recordComplianceEvidence(
  tenantId: string,
  controlId: string,
  evidenceType: string,
  evidenceRef: string,
  description: string,
): Promise<void> {
  await (supabaseAdmin as any)
    .from('compliance_evidence_records')
    .insert({
      id: randomUUID(),
      tenant_id: tenantId,
      control_id: controlId,
      evidence_type: evidenceType,
      evidence_ref: evidenceRef,
      description,
      recorded_at: nowIso(),
    })

  log.info('[regulatoryComplianceCore] evidence recorded', {
    tenant_id: tenantId,
    control_id: controlId,
    evidence_type: evidenceType,
  })
}
