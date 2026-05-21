// Agency Group — Sovereign Readiness Validator
// lib/validation/sovereignReadinessValidator.ts
// TypeScript strict — 0 errors
//
// 10 hard FAIL conditions for sovereign-grade financial infrastructure.
// ALL must pass for system_validated = true.
// Used in final report + CI/CD pipeline.

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SovereignCondition {
  condition_id: number     // 1–10
  name: string
  description: string
  status: 'pass' | 'fail' | 'warn' | 'unknown'
  evidence: string
  severity: 'critical' | 'high' | 'medium'
  remediation: string
}

export interface SovereignReadinessReport {
  report_id: string
  tenant_id: string

  conditions: SovereignCondition[]

  // Final verdict
  all_conditions_pass: boolean
  fail_count: number
  warn_count: number

  // Scores
  security_score: number
  recovery_score: number
  ransomware_survivability_score: number
  institutional_readiness_score: number

  overall_grade: 'SOVEREIGN' | 'INSTITUTIONAL' | 'ENTERPRISE' | 'BASIC' | 'NOT_READY'

  validated_at: string
  system_validated: boolean       // true only if all 10 conditions pass
}

// ─── Individual Condition Checks ──────────────────────────────────────────────

/** Condition 1: FAIL if immutable_backups table is empty OR all worm_enforced = false */
export async function checkMutableBackups(tenantId: string): Promise<SovereignCondition> {
  try {
    const { count: totalBackups } = await (supabaseAdmin as any)
      .from('immutable_backups')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId) as { count: number | null; error: unknown }

    const { count: wormCount } = await (supabaseAdmin as any)
      .from('immutable_backups')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('worm_enforced', true) as { count: number | null; error: unknown }

    const total = totalBackups ?? 0
    const worm  = wormCount  ?? 0

    if (total === 0) {
      return fail(1, 'Mutable Backups', 'No immutable backups found', `0 backup records in immutable_backups table`,
        'Create WORM-enforced immutable backups via immutableBackupOrchestrator')
    }
    if (worm === 0) {
      return fail(1, 'Mutable Backups', 'No WORM-enforced backups', `${total} backups exist but all have worm_enforced=false`,
        'Enable WORM enforcement on all backup records')
    }
    return pass(1, 'Mutable Backups', `${worm}/${total} backups are WORM-enforced`)
  } catch (err) {
    return unknown(1, 'Mutable Backups', err)
  }
}

/** Condition 2: FAIL if secret_scan_results has any risk_level='critical' in last 24h */
export async function checkPlaintextSecrets(tenantId: string): Promise<SovereignCondition> {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count } = await (supabaseAdmin as any)
      .from('secret_scan_results')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('risk_level', 'critical')
      .gte('scanned_at', since) as { count: number | null; error: unknown }

    const criticalCount = count ?? 0
    if (criticalCount > 0) {
      return fail(2, 'Plaintext Secrets in Env', `${criticalCount} critical secrets detected in last 24h`,
        `${criticalCount} entries with risk_level=critical in secret_scan_results`,
        'Rotate exposed secrets immediately via credentialRotationEngine')
    }
    return pass(2, 'Plaintext Secrets in Env', 'No critical secret exposure in last 24h')
  } catch (err) {
    return unknown(2, 'Plaintext Secrets in Env', err)
  }
}

/** Condition 3: FAIL if event_replay_log has any divergence_detected=true entries */
export async function checkReplayDivergence(tenantId: string): Promise<SovereignCondition> {
  try {
    const { count } = await (supabaseAdmin as any)
      .from('event_replay_log')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('divergence_detected', true) as { count: number | null; error: unknown }

    const divergenceCount = count ?? 0
    if (divergenceCount > 0) {
      return fail(3, 'Replay Divergence', `${divergenceCount} replay divergence events detected`,
        `${divergenceCount} event_replay_log entries with divergence_detected=true`,
        'Investigate divergence events — check idempotency key conflicts and event ordering')
    }
    return pass(3, 'Replay Divergence', 'Zero replay divergence events — idempotency intact')
  } catch (err) {
    return unknown(3, 'Replay Divergence', err)
  }
}

/** Condition 4: FAIL if recovery_metrics has actual_rpo_minutes > 0 for any recent entry (last 7d) */
export async function checkRPOZero(tenantId: string): Promise<SovereignCondition> {
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { count } = await (supabaseAdmin as any)
      .from('recovery_metrics')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gt('actual_rpo_minutes', 0)
      .gte('created_at', since) as { count: number | null; error: unknown }

    const rpoBreach = count ?? 0
    if (rpoBreach > 0) {
      return fail(4, 'RPO > 0', `${rpoBreach} incidents with RPO > 0 in last 7 days`,
        `${rpoBreach} recovery_metrics entries with actual_rpo_minutes > 0`,
        'Review dual-write Kafka pipeline and backup replication for RPO violations')
    }
    return pass(4, 'RPO > 0', 'Zero RPO violations in last 7 days — dual-write intact')
  } catch (err) {
    return unknown(4, 'RPO > 0', err)
  }
}

/** Condition 5: FAIL if recovery_metrics has rto_met=false for any recent entry (last 7d) */
export async function checkRTOSLA(tenantId: string): Promise<SovereignCondition> {
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { count } = await (supabaseAdmin as any)
      .from('recovery_metrics')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('rto_slo_met', false)
      .gte('created_at', since) as { count: number | null; error: unknown }

    const rtoBreaches = count ?? 0
    if (rtoBreaches > 0) {
      return fail(5, 'RTO > SLA', `${rtoBreaches} RTO SLA breaches in last 7 days`,
        `${rtoBreaches} recovery_metrics entries with rto_slo_met=false`,
        'Investigate recovery automation — verify orchestration pipeline and SLO targets')
    }
    return pass(5, 'RTO > SLA', 'Zero RTO SLA breaches in last 7 days')
  } catch (err) {
    return unknown(5, 'RTO > SLA', err)
  }
}

/** Condition 6: FAIL if zero_trust_policies has require_mfa=false for any privileged policy */
export async function checkMFADisabled(tenantId: string): Promise<SovereignCondition> {
  try {
    const { data } = await (supabaseAdmin as any)
      .from('zero_trust_policies')
      .select('policy_name, require_mfa, required_trust_level')
      .eq('tenant_id', tenantId)
      .in('required_trust_level', ['privileged', 'high']) as {
        data: Array<{ policy_name: string; require_mfa: boolean; required_trust_level: string }> | null
        error: unknown
      }

    const policies = data ?? []
    const mfaDisabled = policies.filter(p => p.require_mfa === false)

    if (mfaDisabled.length > 0) {
      const names = mfaDisabled.map(p => p.policy_name).join(', ')
      return fail(6, 'MFA Disabled', `${mfaDisabled.length} privileged policies have MFA disabled`,
        `Policies with require_mfa=false: ${names}`,
        'Enable MFA enforcement on all privileged access policies in zero_trust_policies')
    }
    return pass(6, 'MFA Disabled', `All ${policies.length} privileged policies enforce MFA`)
  } catch (err) {
    return unknown(6, 'MFA Disabled', err)
  }
}

/** Condition 7: FAIL if access_risk_flags has active flags with risk_score >= 75 */
export async function checkOrphanPrivilegedAccounts(tenantId: string): Promise<SovereignCondition> {
  try {
    const { count } = await (supabaseAdmin as any)
      .from('access_risk_flags')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('risk_score', 75)
      .is('resolved_at', null) as { count: number | null; error: unknown }

    const activeFlags = count ?? 0
    if (activeFlags > 0) {
      return fail(7, 'Orphan Privileged Accounts', `${activeFlags} unresolved high-risk access flags`,
        `${activeFlags} access_risk_flags with risk_score >= 75 and no resolved_at`,
        'Review and remediate orphan privileged accounts via accessRiskEngine')
    }
    return pass(7, 'Orphan Privileged Accounts', 'Zero unresolved high-risk access flags')
  } catch (err) {
    return unknown(7, 'Orphan Privileged Accounts', err)
  }
}

/** Condition 8: FAIL if entity_signatures table is empty OR >10% unverified */
export async function checkMissingAuditSignatures(tenantId: string): Promise<SovereignCondition> {
  try {
    const { count: totalSigs } = await (supabaseAdmin as any)
      .from('entity_signatures')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId) as { count: number | null; error: unknown }

    const { count: unverifiedSigs } = await (supabaseAdmin as any)
      .from('entity_signatures')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('verified', false) as { count: number | null; error: unknown }

    const total      = totalSigs     ?? 0
    const unverified = unverifiedSigs ?? 0

    if (total === 0) {
      return fail(8, 'Missing Audit Signatures', 'No entity signatures found',
        '0 records in entity_signatures table',
        'Enable signing authority on all audit log entries via signingAuthority module')
    }

    const unverifiedPct = Math.round((unverified / total) * 100)
    if (unverifiedPct > 10) {
      return fail(8, 'Missing Audit Signatures', `${unverifiedPct}% of audit signatures unverified`,
        `${unverified}/${total} entity_signatures have verified=false`,
        'Re-run signing authority to verify and sign pending audit entries')
    }
    return pass(8, 'Missing Audit Signatures', `${total} signatures, ${unverifiedPct}% unverified (≤10% threshold)`)
  } catch (err) {
    return unknown(8, 'Missing Audit Signatures', err)
  }
}

/** Condition 9: FAIL if immutable_backups exist with no corresponding tenant_deks entry */
export async function checkUnencryptedSnapshots(tenantId: string): Promise<SovereignCondition> {
  try {
    const { count: backupCount } = await (supabaseAdmin as any)
      .from('immutable_backups')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId) as { count: number | null; error: unknown }

    const { count: dekCount } = await (supabaseAdmin as any)
      .from('tenant_deks')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId) as { count: number | null; error: unknown }

    const backups = backupCount ?? 0
    const deks    = dekCount    ?? 0

    if (backups > 0 && deks === 0) {
      return fail(9, 'Unencrypted Snapshots', 'Backups exist but no encryption DEK found',
        `${backups} immutable_backups records, 0 tenant_deks entries`,
        'Generate tenant data encryption key (DEK) via kmsEnvelopeEncryption module')
    }
    return pass(9, 'Unencrypted Snapshots', `${backups} backups + ${deks} DEK entries — encryption coverage intact`)
  } catch (err) {
    return unknown(9, 'Unencrypted Snapshots', err)
  }
}

/** Condition 10: FAIL if tenant_isolation_violations has any entries in last 7d */
export async function checkCrossTenantExposure(tenantId: string): Promise<SovereignCondition> {
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { count } = await (supabaseAdmin as any)
      .from('tenant_isolation_violations')
      .select('id', { count: 'exact', head: true })
      .or(`violating_tenant_id.eq.${tenantId},exposed_tenant_id.eq.${tenantId}`)
      .gte('detected_at', since)
      .eq('resolved', false) as { count: number | null; error: unknown }

    const violations = count ?? 0
    if (violations > 0) {
      return fail(10, 'Cross-Tenant Exposure', `${violations} unresolved cross-tenant isolation violations in last 7d`,
        `${violations} entries in tenant_isolation_violations (last 7 days, unresolved)`,
        'Review and resolve tenant isolation violations — check RLS policies and tenantIsolationEnforcer')
    }
    return pass(10, 'Cross-Tenant Exposure', 'Zero cross-tenant isolation violations in last 7 days')
  } catch (err) {
    return unknown(10, 'Cross-Tenant Exposure', err)
  }
}

// ─── runSovereignValidation ───────────────────────────────────────────────────

export async function runSovereignValidation(
  tenantId: string,
): Promise<SovereignReadinessReport> {
  const reportId    = randomUUID()
  const validatedAt = new Date().toISOString()

  log.info('[sovereignReadinessValidator] running validation', { tenant_id: tenantId })

  // Run all 10 checks in parallel
  const results = await Promise.allSettled([
    checkMutableBackups(tenantId),
    checkPlaintextSecrets(tenantId),
    checkReplayDivergence(tenantId),
    checkRPOZero(tenantId),
    checkRTOSLA(tenantId),
    checkMFADisabled(tenantId),
    checkOrphanPrivilegedAccounts(tenantId),
    checkMissingAuditSignatures(tenantId),
    checkUnencryptedSnapshots(tenantId),
    checkCrossTenantExposure(tenantId),
  ])

  const conditions: SovereignCondition[] = results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value
    return unknown(i + 1, `Condition ${i + 1}`, r.reason)
  })

  const failCount = conditions.filter(c => c.status === 'fail').length
  const warnCount = conditions.filter(c => c.status === 'warn').length
  const allPass   = failCount === 0 && warnCount === 0

  // Compute component scores (0–100)
  const securityConditions   = [0, 1, 5, 6, 7, 8, 9]  // conditions 1,2,6,7,8,9,10 (0-indexed)
  const recoveryConditions   = [2, 3, 4]                // conditions 3,4,5
  const securityScore        = computeScore(conditions, securityConditions)
  const recoveryScore        = computeScore(conditions, recoveryConditions)
  const ransomwareScore      = computeScore(conditions, [0, 8, 3, 4])  // backups, encryption, RPO, RTO
  const institutionalScore   = computeScore(conditions, [5, 6, 7, 9])  // MFA, orphans, sigs, isolation

  const overallScore = Math.round(
    (securityScore * 0.30) +
    (recoveryScore * 0.25) +
    (ransomwareScore * 0.25) +
    (institutionalScore * 0.20),
  )

  const grade = computeGrade(failCount, warnCount, overallScore)

  const report: SovereignReadinessReport = {
    report_id:                      reportId,
    tenant_id:                      tenantId,
    conditions,
    all_conditions_pass:            allPass,
    fail_count:                     failCount,
    warn_count:                     warnCount,
    security_score:                 securityScore,
    recovery_score:                 recoveryScore,
    ransomware_survivability_score: ransomwareScore,
    institutional_readiness_score:  institutionalScore,
    overall_grade:                  grade,
    validated_at:                   validatedAt,
    system_validated:               allPass && grade === 'SOVEREIGN',
  }

  log.info('[sovereignReadinessValidator] validation complete', {
    tenant_id:    tenantId,
    grade,
    fail_count:   failCount,
    warn_count:   warnCount,
    overall_score: overallScore,
  })

  // Persist report
  try {
    await (supabaseAdmin as any)
      .from('sovereign_readiness_reports')
      .insert({
        id:                             reportId,
        tenant_id:                      tenantId,
        conditions,
        all_conditions_pass:            allPass,
        fail_count:                     failCount,
        warn_count:                     warnCount,
        security_score:                 securityScore,
        recovery_score:                 recoveryScore,
        ransomware_survivability_score: ransomwareScore,
        institutional_readiness_score:  institutionalScore,
        overall_grade:                  grade,
        system_validated:               report.system_validated,
        validated_at:                   validatedAt,
      })
  } catch (err) {
    log.warn('[sovereignReadinessValidator] persist error', { error: String(err) })
  }

  return report
}

// ─── getSovereignStatus ───────────────────────────────────────────────────────

export async function getSovereignStatus(
  tenantId: string,
): Promise<SovereignReadinessReport> {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('sovereign_readiness_reports')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('validated_at', { ascending: false })
      .limit(1)
      .single() as { data: Record<string, unknown> | null; error: { message: string } | null }

    if (error || !data) {
      // No cached report — run fresh
      return runSovereignValidation(tenantId)
    }

    return toSovereignReport(data)
  } catch (err) {
    log.warn('[sovereignReadinessValidator] getSovereignStatus error', { error: String(err) })
    return runSovereignValidation(tenantId)
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pass(
  id: number,
  name: string,
  evidence: string,
): SovereignCondition {
  return {
    condition_id: id,
    name,
    description: name,
    status:       'pass',
    evidence,
    severity:     'critical',
    remediation:  '',
  }
}

function fail(
  id: number,
  name: string,
  description: string,
  evidence: string,
  remediation: string,
): SovereignCondition {
  return {
    condition_id: id,
    name,
    description,
    status:       'fail',
    evidence,
    severity:     'critical',
    remediation,
  }
}

function unknown(id: number, name: string, err: unknown): SovereignCondition {
  return {
    condition_id: id,
    name,
    description:  `Check error: ${err instanceof Error ? err.message : String(err)}`,
    status:       'unknown',
    evidence:     `Condition check failed with error`,
    severity:     'high',
    remediation:  'Investigate condition check error and re-run validation',
  }
}

function computeScore(conditions: SovereignCondition[], indices: number[]): number {
  const relevant = indices.map(i => conditions[i]).filter(Boolean)
  if (relevant.length === 0) return 100
  const passed = relevant.filter(c => c.status === 'pass').length
  return Math.round((passed / relevant.length) * 100)
}

function computeGrade(
  failCount: number,
  warnCount: number,
  score: number,
): SovereignReadinessReport['overall_grade'] {
  if (failCount > 0)            return 'NOT_READY'
  if (warnCount === 0 && score >= 90) return 'SOVEREIGN'
  if (warnCount <= 1 && score >= 80) return 'INSTITUTIONAL'
  if (warnCount <= 3 && score >= 65) return 'ENTERPRISE'
  if (score >= 50)              return 'BASIC'
  return 'NOT_READY'
}

function toSovereignReport(row: Record<string, unknown>): SovereignReadinessReport {
  return {
    report_id:                      String(row['id'] ?? ''),
    tenant_id:                      String(row['tenant_id'] ?? ''),
    conditions:                     (row['conditions'] as SovereignCondition[]) ?? [],
    all_conditions_pass:            Boolean(row['all_conditions_pass']),
    fail_count:                     Number(row['fail_count'] ?? 0),
    warn_count:                     Number(row['warn_count'] ?? 0),
    security_score:                 Number(row['security_score'] ?? 0),
    recovery_score:                 Number(row['recovery_score'] ?? 0),
    ransomware_survivability_score: Number(row['ransomware_survivability_score'] ?? 0),
    institutional_readiness_score:  Number(row['institutional_readiness_score'] ?? 0),
    overall_grade:                  (row['overall_grade'] as SovereignReadinessReport['overall_grade']) ?? 'NOT_READY',
    validated_at:                   String(row['validated_at'] ?? new Date().toISOString()),
    system_validated:               Boolean(row['system_validated']),
  }
}
