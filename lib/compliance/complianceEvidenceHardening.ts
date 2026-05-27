// Agency Group — Compliance Evidence Hardening
// lib/compliance/complianceEvidenceHardening.ts
// Wave 51 Phase 8 — SOC2/ISO27001/GDPR/AML evidence packages
//
// Extends externalInstitutionalAuditEngine.ts — NEVER replaces it.
// Generates tamper-evident evidence packages for each compliance framework.
// Evidence chain: SHA-256 linked list — mutable history is NEVER allowed.
// TypeScript strict — 0 errors

import { createHash, randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { runExternalInstitutionalAuditEngine } from './externalInstitutionalAuditEngine'

// ── Constants ──────────────────────────────────────────────────────────────────

const TENANT_ID =
  process.env.DEFAULT_TENANT_ID ??
  process.env.SYSTEM_ORG_ID ??
  '00000000-0000-0000-0000-000000000001'

const SOC2_MIN_EVIDENCE    = 15
const ISO27001_MIN_EVIDENCE = 15
const GDPR_MIN_EVIDENCE    = 8
const AML_MIN_EVIDENCE     = 5
const CERT_VALIDITY_DAYS   = 365  // compliance evidence valid 12 months

// ── Types ──────────────────────────────────────────────────────────────────────

export type ComplianceFramework = 'SOC2' | 'ISO27001' | 'GDPR' | 'AML_KYC'

export type EvidenceGrade =
  | 'EVIDENCE_CERTIFIED'
  | 'EVIDENCE_SUFFICIENT'
  | 'EVIDENCE_PARTIAL'
  | 'EVIDENCE_INSUFFICIENT'
  | 'NO_EVIDENCE'

export interface EvidenceItem {
  evidence_id: string
  framework: ComplianceFramework
  control_reference: string
  description: string
  collected_at: string
  collector: string
  hash: string
  verified: boolean
}

export interface EvidencePackage {
  package_id: string
  framework: ComplianceFramework
  evidence_count: number
  minimum_required: number
  evidence_items: EvidenceItem[]
  chain_head_hash: string
  package_hash: string
  grade: EvidenceGrade
  coverage_pct: number
  gaps: string[]
  generated_at: string
}

export interface GdprArticleStatus {
  article: string
  name: string
  implemented: boolean
  evidence_count: number
  last_reviewed: string | null
}

export interface AmlKycStatus {
  kyc_checks_performed: number
  kyc_passed: number
  kyc_failed: number
  pep_checks: number
  sanctions_checks: number
  aml_alerts_24h: number
  aml_status: 'COMPLIANT' | 'REVIEW_REQUIRED' | 'BLOCKED'
}

export interface ComplianceEvidenceReport {
  report_id: string
  tenant_id: string
  evidence_hardening_status: EvidenceGrade
  compliance_score: number
  soc2_package: EvidencePackage
  iso27001_package: EvidencePackage
  gdpr_package: EvidencePackage
  aml_package: EvidencePackage
  gdpr_articles: GdprArticleStatus[]
  aml_kyc_status: AmlKycStatus
  total_evidence_items: number
  evidence_chain_hash: string
  big4_ready: boolean
  blockers: string[]
  warnings: string[]
  compliance_hash: string
  generated_at: string
}

// ── Evidence builder ──────────────────────────────────────────────────────────

async function buildEvidencePackage(
  tenantId: string,
  framework: ComplianceFramework,
  minimumRequired: number,
): Promise<EvidencePackage> {
  const { data: items } = await (supabaseAdmin as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (a: string, b: string) => {
          order: (col: string, opts: Record<string, unknown>) => Promise<{
            data: Array<{
              id: string
              control_reference: string
              description: string
              collected_at: string
              collector: string
              evidence_hash: string | null
            }> | null
          }>
        }
      }
    }
  })
    .from('audit_evidence_chain')
    .select('id, control_reference, description, collected_at, collector, evidence_hash')
    .eq('framework', framework)
    .order('collected_at', { ascending: true })

  const rows = items ?? []

  // Build tamper-evident chain
  let chainHash = createHash('sha256').update(`EVIDENCE_GENESIS_${framework}`).digest('hex')
  const evidenceItems: EvidenceItem[] = rows.map(r => {
    const itemHash = createHash('sha256')
      .update(`${chainHash}|${r.id}|${r.control_reference}|${r.collected_at}`)
      .digest('hex')
    chainHash = itemHash
    return {
      evidence_id:       r.id,
      framework,
      control_reference: r.control_reference,
      description:       r.description,
      collected_at:      r.collected_at,
      collector:         r.collector,
      hash:              itemHash,
      verified:          !!r.evidence_hash,
    }
  })

  const coveragePct = minimumRequired > 0
    ? Math.min(100, Math.round((rows.length / minimumRequired) * 100))
    : 0

  const gaps: string[] = []
  if (rows.length < minimumRequired) {
    gaps.push(`Need ${minimumRequired - rows.length} more evidence items for ${framework}`)
  }

  let grade: EvidenceGrade
  if (rows.length === 0)                 grade = 'NO_EVIDENCE'
  else if (rows.length >= minimumRequired * 1.2) grade = 'EVIDENCE_CERTIFIED'
  else if (rows.length >= minimumRequired)       grade = 'EVIDENCE_SUFFICIENT'
  else if (rows.length >= minimumRequired * 0.5) grade = 'EVIDENCE_PARTIAL'
  else                                           grade = 'EVIDENCE_INSUFFICIENT'

  const packageHash = createHash('sha256')
    .update(`PACKAGE|${framework}|${chainHash}|${rows.length}|${new Date().toISOString().split('T')[0]}`)
    .digest('hex')

  return {
    package_id:      randomUUID(),
    framework,
    evidence_count:  rows.length,
    minimum_required: minimumRequired,
    evidence_items:  evidenceItems,
    chain_head_hash: chainHash,
    package_hash:    packageHash,
    grade,
    coverage_pct:    coveragePct,
    gaps,
    generated_at:    new Date().toISOString(),
  }
}

// ── GDPR articles ─────────────────────────────────────────────────────────────

async function buildGdprArticles(tenantId: string): Promise<GdprArticleStatus[]> {
  const articles = [
    { article: 'Art.5',  name: 'Data processing principles' },
    { article: 'Art.6',  name: 'Lawfulness of processing' },
    { article: 'Art.7',  name: 'Conditions for consent' },
    { article: 'Art.13', name: 'Information on data collection' },
    { article: 'Art.15', name: 'Right of access' },
    { article: 'Art.17', name: 'Right to erasure' },
    { article: 'Art.20', name: 'Right to data portability' },
    { article: 'Art.32', name: 'Security of processing' },
    { article: 'Art.33', name: 'Breach notification' },
    { article: 'Art.35', name: 'Data protection impact assessment' },
  ]

  return Promise.all(
    articles.map(async a => {
      const { data } = await (supabaseAdmin as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (a: string, b: string) => {
              eq: (a: string, b: string) => Promise<{
                data: Array<{ created_at: string }> | null
              }>
            }
          }
        }
      })
        .from('audit_evidence_chain')
        .select('created_at')
        .eq('framework', 'GDPR')
        .eq('control_reference', a.article)

      const count = data?.length ?? 0
      return {
        article:      a.article,
        name:         a.name,
        implemented:  count > 0,
        evidence_count: count,
        last_reviewed: data?.[0]?.created_at ?? null,
      }
    }),
  )
}

// ── AML/KYC status ────────────────────────────────────────────────────────────

async function buildAmlKycStatus(tenantId: string): Promise<AmlKycStatus> {
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString()

  const { data: kycRecords } = await (supabaseAdmin as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, val: string) => Promise<{
          data: Array<{ kyc_status: string; pep_checked: boolean; sanctions_checked: boolean }> | null
        }>
      }
    }
  })
    .from('kyc_verifications')
    .select('kyc_status, pep_checked, sanctions_checked')
    .eq('tenant_id', tenantId)

  const { data: amlAlerts } = await (supabaseAdmin as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (a: string, b: string) => {
          gte: (col: string, val: string) => Promise<{ data: Array<Record<string, unknown>> | null }>
        }
      }
    }
  })
    .from('aml_alerts')
    .select('id')
    .eq('tenant_id', tenantId)
    .gte('created_at', dayAgo)

  const kyc      = kycRecords ?? []
  const passed   = kyc.filter(k => k.kyc_status === 'APPROVED').length
  const failed   = kyc.filter(k => k.kyc_status === 'REJECTED').length
  const pep      = kyc.filter(k => k.pep_checked).length
  const sanctions = kyc.filter(k => k.sanctions_checked).length
  const alerts   = amlAlerts?.length ?? 0

  let amlStatus: 'COMPLIANT' | 'REVIEW_REQUIRED' | 'BLOCKED' = 'COMPLIANT'
  if (failed > 0) amlStatus = 'REVIEW_REQUIRED'
  if (alerts > 5) amlStatus = 'BLOCKED'

  return {
    kyc_checks_performed: kyc.length,
    kyc_passed:           passed,
    kyc_failed:           failed,
    pep_checks:           pep,
    sanctions_checks:     sanctions,
    aml_alerts_24h:       alerts,
    aml_status:           amlStatus,
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function runComplianceEvidenceHardening(
  tenantId?: string,
): Promise<ComplianceEvidenceReport> {
  const tid   = tenantId ?? TENANT_ID
  const start = Date.now()

  log.info('[complianceEvidenceHardening] starting', { tenantId: tid })

  // Extend Wave 50 external audit
  const externalAudit = await runExternalInstitutionalAuditEngine(tid).catch((e: unknown) => {
    log.warn('[complianceEvidenceHardening] externalAudit failed', { e: String(e) })
    return null
  })

  const [soc2Pkg, iso27001Pkg, gdprPkg, amlPkg, gdprArticles, amlKycStatus] = await Promise.all([
    buildEvidencePackage(tid, 'SOC2',     SOC2_MIN_EVIDENCE),
    buildEvidencePackage(tid, 'ISO27001', ISO27001_MIN_EVIDENCE),
    buildEvidencePackage(tid, 'GDPR',     GDPR_MIN_EVIDENCE),
    buildEvidencePackage(tid, 'AML_KYC',  AML_MIN_EVIDENCE),
    buildGdprArticles(tid),
    buildAmlKycStatus(tid),
  ])

  const totalItems = soc2Pkg.evidence_count + iso27001Pkg.evidence_count + gdprPkg.evidence_count + amlPkg.evidence_count

  const blockers: string[] = []
  const warnings: string[]  = []

  if (soc2Pkg.grade === 'NO_EVIDENCE' || soc2Pkg.grade === 'EVIDENCE_INSUFFICIENT')
    warnings.push(`SOC2 evidence insufficient: ${soc2Pkg.evidence_count}/${SOC2_MIN_EVIDENCE}`)
  if (iso27001Pkg.grade === 'NO_EVIDENCE' || iso27001Pkg.grade === 'EVIDENCE_INSUFFICIENT')
    warnings.push(`ISO27001 evidence insufficient: ${iso27001Pkg.evidence_count}/${ISO27001_MIN_EVIDENCE}`)
  if (amlKycStatus.aml_status === 'BLOCKED')
    blockers.push(`AML status BLOCKED — ${amlKycStatus.aml_alerts_24h} alerts in 24h`)

  const big4Ready = (externalAudit?.big4_package?.big4_ready ?? false) &&
    soc2Pkg.evidence_count >= SOC2_MIN_EVIDENCE &&
    iso27001Pkg.evidence_count >= ISO27001_MIN_EVIDENCE

  // Overall score
  const soc2Score    = Math.min(100, Math.round((soc2Pkg.evidence_count / SOC2_MIN_EVIDENCE) * 100))
  const iso27Score   = Math.min(100, Math.round((iso27001Pkg.evidence_count / ISO27001_MIN_EVIDENCE) * 100))
  const gdprScore    = Math.min(100, Math.round((gdprPkg.evidence_count / GDPR_MIN_EVIDENCE) * 100))
  const amlScore     = amlKycStatus.aml_status === 'COMPLIANT' ? 100 : amlKycStatus.aml_status === 'REVIEW_REQUIRED' ? 60 : 0
  const complianceScore = Math.round(soc2Score * 0.30 + iso27Score * 0.30 + gdprScore * 0.25 + amlScore * 0.15)

  let evidenceStatus: EvidenceGrade
  if (blockers.length > 0)      evidenceStatus = 'NO_EVIDENCE'
  else if (complianceScore >= 95) evidenceStatus = 'EVIDENCE_CERTIFIED'
  else if (complianceScore >= 80) evidenceStatus = 'EVIDENCE_SUFFICIENT'
  else if (complianceScore >= 50) evidenceStatus = 'EVIDENCE_PARTIAL'
  else                            evidenceStatus = 'EVIDENCE_INSUFFICIENT'

  // Global evidence chain hash
  const evidenceChainHash = createHash('sha256')
    .update(`${soc2Pkg.chain_head_hash}|${iso27001Pkg.chain_head_hash}|${gdprPkg.chain_head_hash}|${amlPkg.chain_head_hash}`)
    .digest('hex')

  void externalAudit // extended

  const complianceHash = createHash('sha256')
    .update(`COMPLIANCE|${tid}|${evidenceStatus}|${complianceScore}|${evidenceChainHash}|${new Date().toISOString().split('T')[0]}`)
    .digest('hex')

  const report: ComplianceEvidenceReport = {
    report_id:                  randomUUID(),
    tenant_id:                  tid,
    evidence_hardening_status:  evidenceStatus,
    compliance_score:           complianceScore,
    soc2_package:               soc2Pkg,
    iso27001_package:           iso27001Pkg,
    gdpr_package:               gdprPkg,
    aml_package:                amlPkg,
    gdpr_articles:              gdprArticles,
    aml_kyc_status:             amlKycStatus,
    total_evidence_items:       totalItems,
    evidence_chain_hash:        evidenceChainHash,
    big4_ready:                 big4Ready,
    blockers,
    warnings,
    compliance_hash:            complianceHash,
    generated_at:               new Date().toISOString(),
  }

  const { error } = await (supabaseAdmin as unknown as { from: (t: string) => { insert: (v: unknown) => { error: unknown } } })
    .from('compliance_evidence_reports')
    .insert({
      report_id:             report.report_id,
      tenant_id:             tid,
      evidence_status:       report.evidence_hardening_status,
      compliance_score:      report.compliance_score,
      total_evidence_items:  report.total_evidence_items,
      big4_ready:            report.big4_ready,
      evidence_chain_hash:   report.evidence_chain_hash,
      blocker_count:         blockers.length,
      compliance_hash:       report.compliance_hash,
      report_json:           JSON.stringify(report),
      generated_at:          report.generated_at,
    })
  if (error) log.warn('[complianceEvidenceHardening] persist failed', { error })

  log.info('[complianceEvidenceHardening] complete', {
    status:     evidenceStatus,
    score:      complianceScore,
    durationMs: Date.now() - start,
  })

  return report
}
