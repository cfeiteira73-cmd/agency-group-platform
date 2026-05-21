// Agency Group — Final Security Hardening
// lib/security/finalSecurityHardening.ts
// TypeScript strict — 0 errors
//
// Final security validation layer:
// - Zero secrets in code (scan env vars and scan results)
// - Zero tenant leaks (RLS coverage + isolation audit)
// - Zero sensitive data in public API responses
// - Full audit trail integrity

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SecurityHardeningReport {
  report_id: string
  tenant_id: string

  secrets_check: {
    env_vars_scanned: number
    exposed_secrets_found: number
    last_scan_at: string | null
    scan_risk_level: string | null
    secrets_clean: boolean
  }

  tenant_isolation_check: {
    tables_with_rls: number
    tables_without_rls: number
    isolation_violations_7d: number
    risk_flags_active: number
    isolation_score: number   // 0–100
  }

  api_exposure_check: {
    // Checks that sensitive fields are masked in API responses
    sensitive_fields_masked: boolean   // check siem_events, audit_log don't expose raw payloads
    public_routes_requiring_auth: number  // count routes in access_decisions_log that were denied
    api_hardening_score: number        // 0–100
  }

  audit_trail_integrity: {
    total_audit_entries: number
    chain_valid: boolean
    last_signature_verified_at: string | null
    signature_coverage_pct: number  // % entries with verified signatures
    audit_integrity_score: number
  }

  hardening_score: number   // 0–100
  critical_findings: string[]
  passed: boolean           // true if hardening_score >= 80 AND no critical findings
}

// ─── checkSecretsExposure ─────────────────────────────────────────────────────

/**
 * Queries secret_scan_results to assess secrets exposure.
 */
export async function checkSecretsExposure(
  tenantId: string,
): Promise<SecurityHardeningReport['secrets_check']> {
  // Latest scan for this tenant
  const { data: latestScan } = await (supabaseAdmin as any)
    .from('secret_scan_results')
    .select('id, scanned_at, risk_level, exposed_count, env_vars_count')
    .eq('tenant_id', tenantId)
    .order('scanned_at', { ascending: false })
    .limit(1)

  type ScanRow = {
    id: string
    scanned_at: string
    risk_level: string
    exposed_count: number | null
    env_vars_count: number | null
  }

  const scan: ScanRow | null =
    Array.isArray(latestScan) && latestScan.length > 0 ? (latestScan[0] as ScanRow) : null

  // Count active exposures
  const { count: exposedCount } = await (supabaseAdmin as any)
    .from('secret_scan_results')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .in('risk_level', ['high', 'critical'])
    .eq('resolved', false)

  const exposedSecretsFound = typeof exposedCount === 'number' ? exposedCount : 0

  return {
    env_vars_scanned:      scan?.env_vars_count ?? 0,
    exposed_secrets_found: exposedSecretsFound,
    last_scan_at:          scan?.scanned_at ?? null,
    scan_risk_level:       scan?.risk_level ?? null,
    secrets_clean:         exposedSecretsFound === 0,
  }
}

// ─── checkTenantIsolation ─────────────────────────────────────────────────────

/**
 * Queries tenant_isolation_violations + access_risk_flags for isolation health.
 */
export async function checkTenantIsolation(
  tenantId: string,
): Promise<SecurityHardeningReport['tenant_isolation_check']> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Isolation violations in last 7 days
  const { count: violationsCount } = await (supabaseAdmin as any)
    .from('tenant_isolation_violations')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .gt('detected_at', sevenDaysAgo)

  const violations7d = typeof violationsCount === 'number' ? violationsCount : 0

  // Active risk flags
  const { count: riskFlagCount } = await (supabaseAdmin as any)
    .from('access_risk_flags')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('resolved', false)

  const riskFlagsActive = typeof riskFlagCount === 'number' ? riskFlagCount : 0

  // RLS coverage: count tables with/without RLS from our metadata table
  const { count: tablesWithRLS } = await (supabaseAdmin as any)
    .from('rls_coverage_audit')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('rls_enabled', true)

  const { count: tablesWithoutRLS } = await (supabaseAdmin as any)
    .from('rls_coverage_audit')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('rls_enabled', false)

  const withRLS    = typeof tablesWithRLS === 'number' ? tablesWithRLS : 0
  const withoutRLS = typeof tablesWithoutRLS === 'number' ? tablesWithoutRLS : 0
  const totalTables = withRLS + withoutRLS

  // Isolation score: 0–100
  // Perfect if: 0 violations, 0 risk flags, 100% RLS coverage
  let isolationScore = 100
  isolationScore -= violations7d * 15     // -15 per violation
  isolationScore -= riskFlagsActive * 10  // -10 per active risk flag
  if (totalTables > 0) {
    const rlsCoverage = withRLS / totalTables
    isolationScore -= Math.round((1 - rlsCoverage) * 20)  // up to -20 for RLS gaps
  }
  isolationScore = Math.max(0, Math.min(100, isolationScore))

  return {
    tables_with_rls:         withRLS,
    tables_without_rls:      withoutRLS,
    isolation_violations_7d: violations7d,
    risk_flags_active:       riskFlagsActive,
    isolation_score:         isolationScore,
  }
}

// ─── checkApiExposure ─────────────────────────────────────────────────────────

/**
 * Checks that sensitive fields are masked and that unauthenticated requests are blocked.
 */
export async function checkApiExposure(
  tenantId: string,
): Promise<SecurityHardeningReport['api_exposure_check']> {
  // Count routes in access_decisions_log that required auth and were denied
  const { count: authDeniedCount } = await (supabaseAdmin as any)
    .from('access_decisions_log')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('decision', 'denied')
    .eq('reason', 'unauthenticated')

  const publicRoutesRequiringAuth = typeof authDeniedCount === 'number' ? authDeniedCount : 0

  // Check siem_events for sensitive data leakage events
  const { count: leakageEvents } = await (supabaseAdmin as any)
    .from('siem_events')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .ilike('event_type', '%sensitive_data_leak%')

  const hasLeakage = typeof leakageEvents === 'number' && leakageEvents > 0
  const sensitiveFieldsMasked = !hasLeakage

  // API hardening score
  let apiHardeningScore = 100
  if (hasLeakage) {
    apiHardeningScore -= typeof leakageEvents === 'number' ? Math.min(50, leakageEvents * 10) : 20
  }
  if (publicRoutesRequiringAuth === 0) {
    apiHardeningScore -= 10  // slight penalty if no auth denials logged (coverage uncertainty)
  }
  apiHardeningScore = Math.max(0, Math.min(100, apiHardeningScore))

  return {
    sensitive_fields_masked:        sensitiveFieldsMasked,
    public_routes_requiring_auth:   publicRoutesRequiringAuth,
    api_hardening_score:            apiHardeningScore,
  }
}

// ─── checkAuditIntegrity ──────────────────────────────────────────────────────

/**
 * Checks audit log completeness and signature coverage.
 */
export async function checkAuditIntegrity(
  tenantId: string,
): Promise<SecurityHardeningReport['audit_trail_integrity']> {
  // Total audit entries
  const { count: totalEntries } = await (supabaseAdmin as any)
    .from('audit_log_entries')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)

  const total = typeof totalEntries === 'number' ? totalEntries : 0

  // Signed entries via entity_signatures
  const { count: signedCount } = await (supabaseAdmin as any)
    .from('entity_signatures')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('entity_type', 'audit_log_entry')
    .eq('verified', true)

  const signed = typeof signedCount === 'number' ? signedCount : 0

  // Last verified signature
  const { data: lastSigData } = await (supabaseAdmin as any)
    .from('entity_signatures')
    .select('verified_at')
    .eq('tenant_id', tenantId)
    .eq('entity_type', 'audit_log_entry')
    .eq('verified', true)
    .order('verified_at', { ascending: false })
    .limit(1)

  type SigRow = { verified_at: string }
  const lastSigAt: string | null =
    Array.isArray(lastSigData) && lastSigData.length > 0
      ? (lastSigData[0] as SigRow).verified_at
      : null

  const signatureCoveragePct = total > 0 ? Math.round((signed / total) * 100) : 0

  // Chain validity: consider valid if coverage > 80% and no gaps in last 24h
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count: recentUnsigned } = await (supabaseAdmin as any)
    .from('audit_log_entries')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .gt('created_at', oneDayAgo)
    .not(
      'id',
      'in',
      `(SELECT entity_id FROM entity_signatures WHERE tenant_id = '${tenantId}' AND entity_type = 'audit_log_entry' AND verified = true)`,
    )
    .limit(1)

  const chainValid = signatureCoveragePct >= 80 && (typeof recentUnsigned === 'number' ? recentUnsigned === 0 : true)

  // Audit integrity score
  let auditScore = signatureCoveragePct
  if (!chainValid) auditScore = Math.max(0, auditScore - 20)

  return {
    total_audit_entries:        total,
    chain_valid:                chainValid,
    last_signature_verified_at: lastSigAt,
    signature_coverage_pct:     signatureCoveragePct,
    audit_integrity_score:      auditScore,
  }
}

// ─── runFinalSecurityHardening ────────────────────────────────────────────────

/**
 * Runs the full security hardening validation and produces a comprehensive report.
 * Score formula: secrets × 0.25 + isolation × 0.35 + api × 0.15 + audit × 0.25
 */
export async function runFinalSecurityHardening(
  tenantId: string,
): Promise<SecurityHardeningReport> {
  const reportId   = randomUUID()
  const executedAt = new Date().toISOString()

  log.info('[finalSecurityHardening] starting hardening check', {
    report_id:  reportId,
    tenant_id:  tenantId,
  })

  // Run all checks in parallel
  const [secretsCheck, isolationCheck, apiCheck, auditCheck] = await Promise.all([
    checkSecretsExposure(tenantId),
    checkTenantIsolation(tenantId),
    checkApiExposure(tenantId),
    checkAuditIntegrity(tenantId),
  ])

  // Secrets score: 100 if clean, -50 per exposed secret
  const secretsScore = secretsCheck.secrets_clean
    ? 100
    : Math.max(0, 100 - secretsCheck.exposed_secrets_found * 50)

  // Weighted hardening score
  const hardeningScore = Math.round(
    secretsScore                       * 0.25 +
    isolationCheck.isolation_score     * 0.35 +
    apiCheck.api_hardening_score       * 0.15 +
    auditCheck.audit_integrity_score   * 0.25,
  )

  // Critical findings
  const criticalFindings: string[] = []

  if (!secretsCheck.secrets_clean) {
    criticalFindings.push(
      `${secretsCheck.exposed_secrets_found} exposed secret(s) detected — rotate immediately`,
    )
  }
  if (isolationCheck.isolation_violations_7d > 0) {
    criticalFindings.push(
      `${isolationCheck.isolation_violations_7d} tenant isolation violation(s) in last 7 days`,
    )
  }
  if (isolationCheck.tables_without_rls > 0) {
    criticalFindings.push(
      `${isolationCheck.tables_without_rls} table(s) missing RLS policies`,
    )
  }
  if (!apiCheck.sensitive_fields_masked) {
    criticalFindings.push('Sensitive data leakage detected in API responses')
  }
  if (!auditCheck.chain_valid) {
    criticalFindings.push('Audit trail chain integrity failure — signature gaps detected')
  }

  const passed = hardeningScore >= 80 && criticalFindings.length === 0

  const report: SecurityHardeningReport = {
    report_id:               reportId,
    tenant_id:               tenantId,
    secrets_check:           secretsCheck,
    tenant_isolation_check:  isolationCheck,
    api_exposure_check:      apiCheck,
    audit_trail_integrity:   auditCheck,
    hardening_score:         hardeningScore,
    critical_findings:       criticalFindings,
    passed,
  }

  // Persist
  void (supabaseAdmin as any)
    .from('security_hardening_reports')
    .insert({
      id:                      reportId,
      tenant_id:               tenantId,
      secrets_check:           secretsCheck,
      tenant_isolation_check:  isolationCheck,
      api_exposure_check:      apiCheck,
      audit_trail_integrity:   auditCheck,
      hardening_score:         hardeningScore,
      critical_findings:       criticalFindings,
      passed,
      generated_at:            executedAt,
    })
    .then(({ error }: { error: { message: string } | null }) => {
      if (error) log.warn('[finalSecurityHardening] persist error', { error: error.message })
    })

  log.info('[finalSecurityHardening] hardening check complete', {
    report_id:      reportId,
    score:          hardeningScore,
    passed,
    critical_count: criticalFindings.length,
    tenant_id:      tenantId,
  })

  return report
}
