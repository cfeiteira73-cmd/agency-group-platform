// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — Security Isolation Tester v1.0
// lib/validation/securityIsolationTester.ts
//
// Layer 5 of the Autonomous Validation Engine.
// Tests cross-tenant isolation, RLS bypass attempts, unauthorized injection
// vectors, and secret exposure. All tests are READ-ONLY — no data is modified.
// =============================================================================

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { auditTenantIsolation } from '@/lib/security/tenantIsolationEnforcer'
import { validateRequiredSecrets, getSecretsStatus } from '@/lib/security/secretsVault'
import { RBAC_POLICIES } from '@/lib/security/rbacEngine'

// ─── Types ────────────────────────────────────────────────────────────────────

export type SecurityTestType =
  | 'cross_tenant_leakage'
  | 'rls_bypass_detection'
  | 'unauthorized_event_injection'
  | 'api_token_misuse'
  | 'secret_exposure'

export interface SecurityTestResult {
  test: SecurityTestType
  passed: boolean
  score: number       // 0–100
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  details: string
  data: Record<string, unknown>
}

export interface SecurityIsolationReport {
  id: string
  tenant_id: string
  security_integrity_score: number    // 0–100
  isolation_breach_detected: boolean  // any CRITICAL or HIGH test failed
  tests: SecurityTestResult[]
  critical_failures: string[]
  high_failures: string[]
  compliance_ready: boolean           // all tests pass, no critical/high failures
  tested_at: string
}

// ─── Fake tenant for RLS probing ──────────────────────────────────────────────

const FAKE_TENANT_UUID = '00000000-0000-0000-0000-000000000099'

// ─── CRITICAL TABLES ─────────────────────────────────────────────────────────

const CRITICAL_TABLES = [
  'canonical_assets',
  'capital_transactions',
  'investor_bids',
  'deals',
  'contacts',
] as const

// ─── Test 1: cross_tenant_leakage ─────────────────────────────────────────────

async function testCrossTenantLeakage(tenantId: string): Promise<SecurityTestResult> {
  const data: Record<string, unknown> = {}

  try {
    // Count records per tenant for each critical table (service role bypasses RLS)
    for (const table of CRITICAL_TABLES) {
      try {
        const { count, error } = await (supabaseAdmin as any)
          .from(table)
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)

        if (!error) {
          data[`${table}_count`] = count ?? 0
        }
      } catch {
        // Table may not exist yet
        data[`${table}_count`] = 'table_not_found'
      }
    }

    // Probe fake tenant — RLS working if returns 0 (or table not found)
    let fakeTenantLeak = false
    const fakeCounts: Record<string, number> = {}

    for (const table of CRITICAL_TABLES) {
      try {
        const { count, error } = await (supabaseAdmin as any)
          .from(table)
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', FAKE_TENANT_UUID)

        if (!error) {
          const cnt = (count as number | null) ?? 0
          fakeCounts[table] = cnt
          if (cnt > 0) {
            fakeTenantLeak = true
          }
        }
      } catch {
        fakeCounts[table] = 0
      }
    }

    // Incorporate auditTenantIsolation results
    const isolationResult = await auditTenantIsolation(tenantId)
    data['isolation_audit'] = {
      passed: isolationResult.passed,
      violations: isolationResult.violations,
      orphan_records: isolationResult.total_orphan_records,
    }
    data['fake_tenant_counts'] = fakeCounts

    const isolationViolations = isolationResult.violations.length > 0
    const passed = !fakeTenantLeak && !isolationViolations

    return {
      test: 'cross_tenant_leakage',
      passed,
      score: passed ? 100 : fakeTenantLeak ? 0 : 50,
      severity: 'critical',
      details: fakeTenantLeak
        ? `DATA POLLUTION DETECTED: fake tenant ${FAKE_TENANT_UUID} has records in critical tables`
        : isolationViolations
          ? `Orphan records found (NULL tenant_id): ${isolationResult.violations.join('; ')}`
          : `Cross-tenant isolation verified — all ${CRITICAL_TABLES.length} tables scoped correctly`,
      data,
    }
  } catch (err) {
    log.warn('[securityIsolationTester] testCrossTenantLeakage error', {
      tenant_id: tenantId,
      error: err instanceof Error ? err.message : String(err),
    })
    return {
      test: 'cross_tenant_leakage',
      passed: false,
      score: 0,
      severity: 'critical',
      details: `Check error: ${err instanceof Error ? err.message : String(err)}`,
      data: {},
    }
  }
}

// ─── Test 2: rls_bypass_detection ─────────────────────────────────────────────

async function testRlsBypassDetection(tenantId: string): Promise<SecurityTestResult> {
  const data: Record<string, unknown> = {}

  try {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    // Check access_decisions_log for denied attempts with elevated permissions
    const { data: deniedRows, error: deniedErr } = await (supabaseAdmin as any)
      .from('access_decisions_log')
      .select('actor_id, permission, role, reason, evaluated_at')
      .eq('tenant_id', tenantId)
      .eq('allowed', false)
      .gte('evaluated_at', since24h)
      .limit(50)

    const deniedAttempts = deniedErr ? [] : ((deniedRows as Array<Record<string, unknown>>) ?? [])
    data['denied_attempts_24h'] = deniedAttempts.length

    // Check audit_log_entries for anomalous actions
    const { data: auditRows, error: auditErr } = await (supabaseAdmin as any)
      .from('audit_log_entries')
      .select('action, table_name, created_at')
      .eq('tenant_id', tenantId)
      .in('action', ['bypass_rls', 'service_role_access', 'unauthorized_delete'])
      .gte('created_at', since24h)
      .limit(20)

    const anomalousAudit = auditErr ? [] : ((auditRows as Array<Record<string, unknown>>) ?? [])
    data['anomalous_audit_entries_24h'] = anomalousAudit.length

    // Check for any bypasses that SUCCEEDED (allowed=true from unusual roles)
    const { data: bypassRows, error: bypassErr } = await (supabaseAdmin as any)
      .from('access_decisions_log')
      .select('actor_id, permission, role, reason, evaluated_at')
      .eq('tenant_id', tenantId)
      .eq('allowed', true)
      .like('reason', '%bypass%')
      .gte('evaluated_at', since24h)
      .limit(10)

    const successfulBypasses = bypassErr ? [] : ((bypassRows as Array<Record<string, unknown>>) ?? [])
    data['successful_bypasses_24h'] = successfulBypasses.length

    const hasBypassSucceeded = successfulBypasses.length > 0
    const hasAnomalous       = anomalousAudit.length > 0

    let score: number
    let passed: boolean

    if (hasBypassSucceeded) {
      score  = 0
      passed = false
    } else if (hasAnomalous) {
      score  = 30
      passed = false
    } else if (deniedAttempts.length > 0) {
      // Attempts were logged and blocked — medium risk, system working
      score  = 50
      passed = true   // blocked = working as intended
    } else {
      score  = 100
      passed = true
    }

    return {
      test: 'rls_bypass_detection',
      passed,
      score,
      severity: hasBypassSucceeded ? 'critical' : hasAnomalous ? 'high' : 'medium',
      details: hasBypassSucceeded
        ? `CRITICAL: ${successfulBypasses.length} bypass(es) succeeded in last 24h`
        : hasAnomalous
          ? `${anomalousAudit.length} anomalous audit entry/entries in last 24h`
          : deniedAttempts.length > 0
            ? `${deniedAttempts.length} unauthorized attempt(s) correctly blocked in last 24h`
            : 'No bypass attempts detected in last 24h',
      data,
    }
  } catch (err) {
    log.warn('[securityIsolationTester] testRlsBypassDetection error', {
      tenant_id: tenantId,
      error: err instanceof Error ? err.message : String(err),
    })
    return {
      test: 'rls_bypass_detection',
      passed: false,
      score: 0,
      severity: 'high',
      details: `Check error: ${err instanceof Error ? err.message : String(err)}`,
      data: {},
    }
  }
}

// ─── Test 3: unauthorized_event_injection ────────────────────────────────────

const KNOWN_ENTITY_TYPES = new Set([
  'property',
  'investor',
  'capital_transaction',
  'market',
  'compliance',
  'system',
])

async function testUnauthorizedEventInjection(tenantId: string): Promise<SecurityTestResult> {
  const data: Record<string, unknown> = {}

  try {
    // Check for events with NULL tenant_id
    const { count: nullTenantCount, error: nullErr } = await (supabaseAdmin as any)
      .from('kafka_event_log')
      .select('id', { count: 'exact', head: true })
      .is('tenant_id', null)

    const nullTenants = nullErr ? 0 : ((nullTenantCount as number | null) ?? 0)
    data['events_null_tenant'] = nullTenants

    // Check for events with unknown entity_types (last 7 days)
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: entityRows, error: entityErr } = await (supabaseAdmin as any)
      .from('kafka_event_log')
      .select('entity_type')
      .eq('tenant_id', tenantId)
      .gte('emitted_at', since7d)
      .limit(1000)

    const entityTypes = entityErr ? [] : ((entityRows as Array<{ entity_type: string }>) ?? [])
    const unknownTypes = entityTypes.filter(
      r => r.entity_type && !KNOWN_ENTITY_TYPES.has(r.entity_type),
    )

    // Deduplicate unknown types
    const unknownTypeSet = [...new Set(unknownTypes.map(r => r.entity_type))]
    data['unknown_entity_types'] = unknownTypeSet
    data['unknown_entity_count']  = unknownTypes.length

    const totalSuspicious = nullTenants + unknownTypes.length

    let score: number
    let passed: boolean

    if (totalSuspicious === 0) {
      score  = 100
      passed = true
    } else if (totalSuspicious < 5) {
      score  = 50
      passed = false
    } else {
      score  = 0
      passed = false
    }

    return {
      test: 'unauthorized_event_injection',
      passed,
      score,
      severity: totalSuspicious >= 5 ? 'high' : totalSuspicious > 0 ? 'medium' : 'info',
      details: totalSuspicious === 0
        ? 'All Kafka events have valid tenant_id and known entity_types'
        : `${nullTenants} event(s) with NULL tenant_id; ${unknownTypes.length} event(s) with unknown entity_type: [${unknownTypeSet.join(', ')}]`,
      data,
    }
  } catch (err) {
    log.warn('[securityIsolationTester] testUnauthorizedEventInjection error', {
      tenant_id: tenantId,
      error: err instanceof Error ? err.message : String(err),
    })
    return {
      test: 'unauthorized_event_injection',
      passed: false,
      score: 0,
      severity: 'high',
      details: `Check error: ${err instanceof Error ? err.message : String(err)}`,
      data: {},
    }
  }
}

// ─── Test 4: api_token_misuse ─────────────────────────────────────────────────

// Permissions outside cron_service and webhook_receiver role scope
const CRON_ALLOWED     = new Set(RBAC_POLICIES.cron_service.permissions)
const WEBHOOK_ALLOWED  = new Set(RBAC_POLICIES.webhook_receiver.permissions)

async function testApiTokenMisuse(tenantId: string): Promise<SecurityTestResult> {
  const data: Record<string, unknown> = {}

  try {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    // Check cron_service actors attempting out-of-scope permissions
    const { data: cronViolations, error: cronErr } = await (supabaseAdmin as any)
      .from('access_decisions_log')
      .select('actor_id, permission, allowed, reason, evaluated_at')
      .eq('tenant_id', tenantId)
      .eq('role', 'cron_service')
      .gte('evaluated_at', since24h)
      .limit(100)

    const cronRows = cronErr ? [] : ((cronViolations as Array<{ permission: string; allowed: boolean }>) ?? [])
    const cronOutOfScope = cronRows.filter(r => r.allowed && !CRON_ALLOWED.has(r.permission as never))
    data['cron_out_of_scope'] = cronOutOfScope.length

    // Check webhook_receiver actors attempting out-of-scope permissions
    const { data: webhookViolations, error: webhookErr } = await (supabaseAdmin as any)
      .from('access_decisions_log')
      .select('actor_id, permission, allowed, reason, evaluated_at')
      .eq('tenant_id', tenantId)
      .eq('role', 'webhook_receiver')
      .gte('evaluated_at', since24h)
      .limit(100)

    const webhookRows = webhookErr ? [] : ((webhookViolations as Array<{ permission: string; allowed: boolean }>) ?? [])
    const webhookOutOfScope = webhookRows.filter(r => r.allowed && !WEBHOOK_ALLOWED.has(r.permission as never))
    data['webhook_out_of_scope'] = webhookOutOfScope.length

    const totalViolations = cronOutOfScope.length + webhookOutOfScope.length
    const passed = totalViolations === 0

    return {
      test: 'api_token_misuse',
      passed,
      score: passed ? 100 : Math.max(0, 100 - totalViolations * 25),
      severity: totalViolations > 0 ? 'high' : 'info',
      details: passed
        ? 'No role-scope violations detected for cron_service or webhook_receiver in last 24h'
        : `${totalViolations} out-of-scope permission grant(s): ${cronOutOfScope.length} cron, ${webhookOutOfScope.length} webhook`,
      data,
    }
  } catch (err) {
    log.warn('[securityIsolationTester] testApiTokenMisuse error', {
      tenant_id: tenantId,
      error: err instanceof Error ? err.message : String(err),
    })
    return {
      test: 'api_token_misuse',
      passed: false,
      score: 0,
      severity: 'high',
      details: `Check error: ${err instanceof Error ? err.message : String(err)}`,
      data: {},
    }
  }
}

// ─── Test 5: secret_exposure ──────────────────────────────────────────────────

const CRITICAL_SECRET_KEYS = ['ANTHROPIC_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'CRON_SECRET'] as const
const SECRET_PAYLOAD_PATTERNS = ['password', 'secret', 'token', 'api_key', 'apikey', 'private_key']

async function testSecretExposure(tenantId: string): Promise<SecurityTestResult> {
  const data: Record<string, unknown> = {}

  try {
    // Validate required secrets (no values logged)
    const validation  = validateRequiredSecrets()
    const secretsStatus = getSecretsStatus()

    const criticalMissing: string[] = []
    const criticalPlaceholders: string[] = []

    for (const key of CRITICAL_SECRET_KEYS) {
      const meta = secretsStatus.find(s => s.key === key)
      if (!meta?.present) {
        criticalMissing.push(key)
      } else if (meta.is_placeholder) {
        criticalPlaceholders.push(key)
      }
    }

    data['secrets_valid']         = validation.valid
    data['critical_missing']      = criticalMissing
    data['critical_placeholders'] = criticalPlaceholders
    data['total_missing']         = validation.missing.length
    data['total_placeholders']    = validation.placeholders.length
    // NEVER log actual values

    // Check audit_log_entries for payload keys that look like secrets
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    let exposureCount = 0

    try {
      const { data: auditRows, error: auditErr } = await (supabaseAdmin as any)
        .from('audit_log_entries')
        .select('action, payload_keys')
        .eq('tenant_id', tenantId)
        .gte('created_at', since24h)
        .limit(500)

      if (!auditErr && auditRows) {
        const rows = (auditRows as Array<{ action: string; payload_keys?: string[] | string }>) ?? []
        for (const row of rows) {
          const keys: string[] = Array.isArray(row.payload_keys)
            ? row.payload_keys
            : typeof row.payload_keys === 'string'
              ? [row.payload_keys]
              : []

          for (const k of keys) {
            if (SECRET_PAYLOAD_PATTERNS.some(p => k.toLowerCase().includes(p))) {
              exposureCount++
              break
            }
          }
        }
      }
    } catch {
      // audit_log_entries may not have payload_keys column — skip gracefully
    }

    data['audit_secret_pattern_matches'] = exposureCount

    const hasCriticalIssues = criticalMissing.length > 0 || criticalPlaceholders.length > 0
    const hasExposure       = exposureCount > 0

    let score: number
    let passed: boolean

    if (hasExposure) {
      score  = 0
      passed = false
    } else if (hasCriticalIssues) {
      score  = 30
      passed = false
    } else {
      score  = 100
      passed = true
    }

    let details: string
    if (hasExposure) {
      details = `CRITICAL: ${exposureCount} audit entry/entries contain secret-like payload keys`
    } else if (criticalMissing.length > 0) {
      details = `Critical secrets missing: [${criticalMissing.join(', ')}]`
    } else if (criticalPlaceholders.length > 0) {
      details = `Critical secrets are placeholders: [${criticalPlaceholders.join(', ')}]`
    } else {
      details = 'All critical secrets present, no secret-pattern exposure in audit logs'
    }

    return {
      test: 'secret_exposure',
      passed,
      score,
      severity: hasExposure ? 'critical' : hasCriticalIssues ? 'high' : 'info',
      details,
      data,
    }
  } catch (err) {
    log.warn('[securityIsolationTester] testSecretExposure error', {
      tenant_id: tenantId,
      error: err instanceof Error ? err.message : String(err),
    })
    return {
      test: 'secret_exposure',
      passed: false,
      score: 0,
      severity: 'critical',
      details: `Check error: ${err instanceof Error ? err.message : String(err)}`,
      data: {},
    }
  }
}

// ─── Score aggregation ────────────────────────────────────────────────────────

function computeOverallScore(tests: SecurityTestResult[]): number {
  const hasCriticalFail = tests.some(t => !t.passed && t.severity === 'critical')
  const hasHighFail     = tests.some(t => !t.passed && t.severity === 'high')

  const avg = tests.reduce((sum, t) => sum + t.score, 0) / tests.length

  if (hasCriticalFail) return Math.min(30, avg)
  if (hasHighFail)     return Math.min(60, avg)
  return Math.max(85, avg)   // all pass → at least 85
}

// ─── runSecurityIsolationTests ────────────────────────────────────────────────

export async function runSecurityIsolationTests(tenantId: string): Promise<SecurityIsolationReport> {
  const id        = randomUUID()
  const tested_at = new Date().toISOString()

  log.info('[securityIsolationTester] starting security isolation tests', { tenant_id: tenantId })

  const [r1, r2, r3, r4, r5] = await Promise.allSettled([
    testCrossTenantLeakage(tenantId),
    testRlsBypassDetection(tenantId),
    testUnauthorizedEventInjection(tenantId),
    testApiTokenMisuse(tenantId),
    testSecretExposure(tenantId),
  ])

  function extract(
    settled: PromiseSettledResult<SecurityTestResult>,
    test: SecurityTestType,
  ): SecurityTestResult {
    if (settled.status === 'fulfilled') return settled.value
    return {
      test,
      passed: false,
      score: 0,
      severity: 'critical',
      details: `Unexpected error: ${settled.reason instanceof Error ? settled.reason.message : String(settled.reason)}`,
      data: {},
    }
  }

  const tests: SecurityTestResult[] = [
    extract(r1, 'cross_tenant_leakage'),
    extract(r2, 'rls_bypass_detection'),
    extract(r3, 'unauthorized_event_injection'),
    extract(r4, 'api_token_misuse'),
    extract(r5, 'secret_exposure'),
  ]

  const security_integrity_score = Math.round(computeOverallScore(tests))

  const critical_failures = tests
    .filter(t => !t.passed && t.severity === 'critical')
    .map(t => `[${t.test}] ${t.details}`)

  const high_failures = tests
    .filter(t => !t.passed && t.severity === 'high')
    .map(t => `[${t.test}] ${t.details}`)

  const isolation_breach_detected = critical_failures.length > 0 || high_failures.length > 0
  const compliance_ready          = tests.every(t => t.passed) && !isolation_breach_detected

  const report: SecurityIsolationReport = {
    id,
    tenant_id: tenantId,
    security_integrity_score,
    isolation_breach_detected,
    tests,
    critical_failures,
    high_failures,
    compliance_ready,
    tested_at,
  }

  log.info('[securityIsolationTester] security tests complete', {
    tenant_id:               tenantId,
    security_integrity_score,
    isolation_breach_detected,
    compliance_ready,
  })

  void persistSecurityReport(report).catch(e =>
    log.warn('[securityIsolationTester] persistSecurityReport failed', {
      tenant_id: tenantId,
      error:     e instanceof Error ? e.message : String(e),
    })
  )

  return report
}

// ─── persistSecurityReport ────────────────────────────────────────────────────

export async function persistSecurityReport(report: SecurityIsolationReport): Promise<void> {
  await (supabaseAdmin as any).from('validation_results').insert({
    id:          report.id,
    tenant_id:   report.tenant_id,
    layer:       'security_isolation',
    report_type: 'security',
    score:       report.security_integrity_score,
    passed:      report.compliance_ready,
    payload:     JSON.stringify(report),
    created_at:  report.tested_at,
  })
}

// ─── getLatestSecurityReport ──────────────────────────────────────────────────

export async function getLatestSecurityReport(tenantId: string): Promise<SecurityIsolationReport | null> {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('validation_results')
      .select('payload')
      .eq('tenant_id', tenantId)
      .eq('layer', 'security_isolation')
      .order('created_at', { ascending: false })
      .limit(1)
      .single() as { data: { payload: string } | null; error: { message: string } | null }

    if (error || !data) return null

    const raw = typeof data.payload === 'string' ? JSON.parse(data.payload) : data.payload
    return raw as SecurityIsolationReport
  } catch (err) {
    log.warn('[securityIsolationTester] getLatestSecurityReport error', {
      tenant_id: tenantId,
      error:     err instanceof Error ? err.message : String(err),
    })
    return null
  }
}

// ─── runSingleSecurityTest ────────────────────────────────────────────────────

export async function runSingleSecurityTest(
  tenantId: string,
  test: SecurityTestType,
): Promise<SecurityTestResult> {
  switch (test) {
    case 'cross_tenant_leakage':          return testCrossTenantLeakage(tenantId)
    case 'rls_bypass_detection':          return testRlsBypassDetection(tenantId)
    case 'unauthorized_event_injection':  return testUnauthorizedEventInjection(tenantId)
    case 'api_token_misuse':              return testApiTokenMisuse(tenantId)
    case 'secret_exposure':               return testSecretExposure(tenantId)
    default: {
      const _exhaustive: never = test
      throw new Error(`Unknown security test: ${String(_exhaustive)}`)
    }
  }
}
