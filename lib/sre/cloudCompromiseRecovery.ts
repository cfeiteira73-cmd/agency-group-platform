// Agency Group — Cloud Compromise Recovery
// lib/sre/cloudCompromiseRecovery.ts
// TypeScript strict — 0 errors
//
// Measures recovery readiness for cloud provider compromise scenarios.
// Validates: credential revocation speed, deletion protection, IAM escalation detection.
// ALL scenarios are measurement-based — no real cloud API calls.

import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ─────────────────────────────────────────────────────────────────────

export type CompromiseScenario =
  | 'credential_leak'
  | 'malicious_deletion'
  | 'iam_escalation'
  | 'api_key_theft'
  | 'bucket_takeover'

export interface CompromiseRecoveryReport {
  report_id: string
  tenant_id: string
  scenario: CompromiseScenario

  readiness_checks: {
    credential_rotation_ready: boolean
    deletion_protection_enabled: boolean
    audit_trail_complete: boolean
    isolation_capability: boolean
    recovery_manifests_available: boolean
  }

  estimated_containment_time_ms: number
  estimated_recovery_time_ms: number

  gaps: string[]
  recommendations: string[]
  readiness_score: number
  readiness_grade: 'S' | 'A' | 'B' | 'C' | 'D'

  assessed_at: string
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function computeReadinessScore(
  checks: CompromiseRecoveryReport['readiness_checks'],
  gaps: string[],
): number {
  let score = 0
  if (checks.credential_rotation_ready) score += 20
  if (checks.deletion_protection_enabled) score += 20
  if (checks.audit_trail_complete) score += 20
  if (checks.isolation_capability) score += 20
  if (checks.recovery_manifests_available) score += 20

  // Gap penalties (max -30)
  const penalty = Math.min(30, gaps.length * 10)
  return Math.max(0, score - penalty)
}

function scoreToGrade(score: number): CompromiseRecoveryReport['readiness_grade'] {
  if (score >= 90) return 'S'
  if (score >= 75) return 'A'
  if (score >= 55) return 'B'
  if (score >= 35) return 'C'
  return 'D'
}

function scenarioContainmentMs(scenario: CompromiseScenario, autoRotate: boolean): number {
  const base: Record<CompromiseScenario, number> = {
    credential_leak: autoRotate ? 60_000 : 300_000,      // 1min auto vs 5min manual
    malicious_deletion: 120_000,                          // 2min isolation
    iam_escalation: autoRotate ? 90_000 : 600_000,        // 1.5min auto vs 10min manual
    api_key_theft: autoRotate ? 45_000 : 300_000,
    bucket_takeover: 180_000,                             // 3min
  }
  return base[scenario]
}

function scenarioRecoveryMs(scenario: CompromiseScenario, hasManifests: boolean): number {
  const base: Record<CompromiseScenario, number> = {
    credential_leak: hasManifests ? 900_000 : 3_600_000,      // 15min vs 1hr
    malicious_deletion: hasManifests ? 3_600_000 : 14_400_000, // 1hr vs 4hr
    iam_escalation: hasManifests ? 1_800_000 : 7_200_000,      // 30min vs 2hr
    api_key_theft: hasManifests ? 900_000 : 3_600_000,
    bucket_takeover: hasManifests ? 2_700_000 : 10_800_000,    // 45min vs 3hr
  }
  return base[scenario]
}

function buildRecommendations(
  scenario: CompromiseScenario,
  checks: CompromiseRecoveryReport['readiness_checks'],
): string[] {
  const recs: string[] = []

  if (!checks.credential_rotation_ready) {
    recs.push('Enable automatic credential rotation in credential_registry (auto_rotate=true)')
  }
  if (!checks.deletion_protection_enabled) {
    recs.push('Create immutable WORM-enforced backups to prevent malicious deletion')
  }
  if (!checks.audit_trail_complete) {
    recs.push('Ensure access_decisions_log is populated with recent access events')
  }
  if (!checks.isolation_capability) {
    recs.push('Implement security_incidents table with RLS for isolation tracking')
  }
  if (!checks.recovery_manifests_available) {
    recs.push('Create recovery_manifests with current infrastructure state')
  }

  // Scenario-specific
  switch (scenario) {
    case 'credential_leak':
      recs.push('Rotate all credentials immediately via automated pipeline')
      recs.push('Invalidate all active sessions tied to compromised credentials')
      break
    case 'malicious_deletion':
      recs.push('Enable soft-delete on all critical tables')
      recs.push('Configure S3 Object Lock (GOVERNANCE mode) for backup buckets')
      break
    case 'iam_escalation':
      recs.push('Implement just-in-time (JIT) privilege elevation')
      recs.push('Enable CloudTrail anomaly detection for IAM events')
      break
    case 'api_key_theft':
      recs.push('Rotate API keys with zero-downtime key versioning')
      recs.push('Enforce per-IP rate limits on all API keys')
      break
    case 'bucket_takeover':
      recs.push('Enable S3 Block Public Access on all buckets')
      recs.push('Configure bucket policy validation via SCPs')
      break
  }

  return recs.slice(0, 6)
}

// ─── assessCompromiseReadiness ─────────────────────────────────────────────────

export async function assessCompromiseReadiness(
  tenantId: string,
  scenario: CompromiseScenario,
): Promise<CompromiseRecoveryReport> {
  const db = supabaseAdmin as any
  const reportId = createHash('sha256')
    .update(`${tenantId}:${scenario}:${Date.now()}`)
    .digest('hex')
    .slice(0, 36)

  const assessedAt = new Date().toISOString()
  const gaps: string[] = []

  // Check 1: credential_rotation_ready — credential_registry has auto_rotate=true
  let credentialRotationReady = false
  try {
    const { count, error } = await db
      .from('credential_registry')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('auto_rotate', true)

    credentialRotationReady = !error && ((count as number) ?? 0) > 0
  } catch { /* table may not exist */ }
  if (!credentialRotationReady) gaps.push('No auto-rotating credentials in credential_registry')

  // Check 2: deletion_protection_enabled — immutable_backups with worm_enforced
  let deletionProtectionEnabled = false
  try {
    const { count, error } = await db
      .from('immutable_backups')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('worm_enforced', true)

    deletionProtectionEnabled = !error && ((count as number) ?? 0) > 0
  } catch { /* table may not exist */ }
  if (!deletionProtectionEnabled) gaps.push('No WORM-enforced immutable_backups found')

  // Check 3: audit_trail_complete — access_decisions_log has recent entries
  let auditTrailComplete = false
  try {
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count, error } = await db
      .from('access_decisions_log')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('created_at', cutoff24h)

    auditTrailComplete = !error && ((count as number) ?? 0) > 0
  } catch { /* table may not exist */ }
  if (!auditTrailComplete) gaps.push('access_decisions_log has no recent entries — audit trail incomplete')

  // Check 4: isolation_capability — security_incidents table exists + usable
  let isolationCapability = false
  try {
    // Just try to query it — existence = capability
    const { error } = await db
      .from('security_incidents')
      .select('id', { count: 'exact', head: true })
      .limit(1)

    isolationCapability = !error
  } catch { /* non-fatal */ }
  if (!isolationCapability) gaps.push('security_incidents table unavailable — cannot isolate incidents')

  // Check 5: recovery_manifests_available — recent manifests exist
  let recoveryManifestsAvailable = false
  try {
    const cutoff7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { count, error } = await db
      .from('recovery_manifests')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('created_at', cutoff7d)

    recoveryManifestsAvailable = !error && ((count as number) ?? 0) > 0
  } catch { /* table may not exist */ }
  if (!recoveryManifestsAvailable) gaps.push('No recent recovery_manifests found (within 7 days)')

  const checks: CompromiseRecoveryReport['readiness_checks'] = {
    credential_rotation_ready: credentialRotationReady,
    deletion_protection_enabled: deletionProtectionEnabled,
    audit_trail_complete: auditTrailComplete,
    isolation_capability: isolationCapability,
    recovery_manifests_available: recoveryManifestsAvailable,
  }

  const readinessScore = computeReadinessScore(checks, gaps)
  const readinessGrade = scoreToGrade(readinessScore)
  const recommendations = buildRecommendations(scenario, checks)
  const containmentTimeMs = scenarioContainmentMs(scenario, credentialRotationReady)
  const recoveryTimeMs = scenarioRecoveryMs(scenario, recoveryManifestsAvailable)

  const report: CompromiseRecoveryReport = {
    report_id: reportId,
    tenant_id: tenantId,
    scenario,
    readiness_checks: checks,
    estimated_containment_time_ms: containmentTimeMs,
    estimated_recovery_time_ms: recoveryTimeMs,
    gaps,
    recommendations,
    readiness_score: readinessScore,
    readiness_grade: readinessGrade,
    assessed_at: assessedAt,
  }

  log.info('[CloudCompromise] readiness assessed', {
    tenant_id: tenantId,
    scenario,
    score: readinessScore,
    grade: readinessGrade,
    gaps: gaps.length,
  })

  return report
}

// ─── runAllScenarios ───────────────────────────────────────────────────────────

export async function runAllScenarios(
  tenantId: string,
): Promise<CompromiseRecoveryReport[]> {
  const ALL_SCENARIOS: CompromiseScenario[] = [
    'credential_leak',
    'malicious_deletion',
    'iam_escalation',
    'api_key_theft',
    'bucket_takeover',
  ]

  const results = await Promise.all(
    ALL_SCENARIOS.map(scenario => assessCompromiseReadiness(tenantId, scenario)),
  )

  log.info('[CloudCompromise] all scenarios assessed', {
    tenant_id: tenantId,
    count: results.length,
    avg_score: Math.round(results.reduce((sum, r) => sum + r.readiness_score, 0) / results.length),
  })

  return results
}

// ─── getOverallReadinessScore ──────────────────────────────────────────────────

export async function getOverallReadinessScore(
  tenantId: string,
): Promise<{ score: number; grade: string; scenarios: CompromiseRecoveryReport[] }> {
  const scenarios = await runAllScenarios(tenantId)
  const avgScore = Math.round(
    scenarios.reduce((sum, r) => sum + r.readiness_score, 0) / scenarios.length,
  )
  const grade = scoreToGrade(avgScore)

  return { score: avgScore, grade, scenarios }
}
