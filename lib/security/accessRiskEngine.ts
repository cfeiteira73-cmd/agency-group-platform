// Agency Group — Access Risk Engine
// lib/security/accessRiskEngine.ts
// TypeScript strict — 0 errors
//
// Behavioral access risk scoring using pattern matching on session records
// and access decisions. Identifies high-risk access patterns proactively.

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ─────────────────────────────────────────────────────────────────────

export type RiskLevelLabel = 'low' | 'medium' | 'high' | 'critical'

export interface AccessRiskProfile {
  user_id: string
  tenant_id: string
  risk_score: number
  risk_level: RiskLevelLabel

  factors: {
    off_hours_access: boolean
    privilege_escalations_24h: number
    unique_resources_accessed_1h: number
    failed_access_attempts_1h: number
    jit_elevations_active: number
    geo_anomaly: boolean
    new_session_from_unknown_ip: boolean
  }

  recent_high_risk_actions: string[]
  last_evaluated_at: string
}

// ─── Score helpers ──────────────────────────────────────────────────────────────

function computeScore(factors: AccessRiskProfile['factors']): number {
  let score = 0

  if (factors.off_hours_access) score += 15
  if (factors.privilege_escalations_24h > 3) score += 25
  if (factors.unique_resources_accessed_1h > 50) score += 20
  if (factors.failed_access_attempts_1h > 5) score += 20
  if (factors.geo_anomaly) score += 20

  // Partial scores for lower thresholds
  if (factors.privilege_escalations_24h > 0 && factors.privilege_escalations_24h <= 3) score += 10
  if (factors.failed_access_attempts_1h > 2 && factors.failed_access_attempts_1h <= 5) score += 10
  if (factors.jit_elevations_active > 0) score += 5
  if (factors.new_session_from_unknown_ip) score += 10

  return Math.min(100, score)
}

function scoreToLevel(score: number): RiskLevelLabel {
  if (score >= 75) return 'critical'
  if (score >= 50) return 'high'
  if (score >= 25) return 'medium'
  return 'low'
}

function isOffHours(isoTimestamp: string): boolean {
  // Off-hours = outside 07:00–22:00 local time (approximate via UTC)
  const hour = new Date(isoTimestamp).getUTCHours()
  return hour < 7 || hour >= 22
}

// ─── evaluateUserRisk ───────────────────────────────────────────────────────────

export async function evaluateUserRisk(
  userId: string,
  tenantId: string,
): Promise<AccessRiskProfile> {
  const db = supabaseAdmin as any
  const now = new Date()
  const lastEvaluatedAt = now.toISOString()
  const cutoff1h = new Date(now.getTime() - 60 * 60 * 1000).toISOString()
  const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()

  let offHoursAccess = false
  let privilegeEscalations24h = 0
  let uniqueResourcesAccessed1h = 0
  let failedAccessAttempts1h = 0
  let jitElevationsActive = 0
  let geoAnomaly = false
  let newSessionFromUnknownIp = false
  const recentHighRiskActions: string[] = []

  // ── Check access_evaluations for patterns ────────────────────────────────────
  try {
    const { data: evalData } = await db
      .from('access_evaluations')
      .select('resource, decision, geo_location, evaluated_at, denial_reason')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .gte('evaluated_at', cutoff24h)
      .order('evaluated_at', { ascending: false })
      .limit(500)

    const evals = (evalData ?? []) as Array<{
      resource: string
      decision: string
      geo_location: string | null
      evaluated_at: string
      denial_reason: string | null
    }>

    // Off-hours access (check most recent)
    if (evals.length > 0) {
      offHoursAccess = isOffHours(evals[0].evaluated_at)
    }

    // Failed access attempts in last 1h
    const failedIn1h = evals.filter(
      e => e.decision === 'deny' && e.evaluated_at >= cutoff1h,
    )
    failedAccessAttempts1h = failedIn1h.length

    // Unique resources in last 1h
    const resourcesIn1h = new Set(
      evals.filter(e => e.evaluated_at >= cutoff1h).map(e => e.resource),
    )
    uniqueResourcesAccessed1h = resourcesIn1h.size

    // Geo anomaly: multiple different geos in last 1h
    const geosIn1h = new Set(
      evals
        .filter(e => e.evaluated_at >= cutoff1h && e.geo_location !== null)
        .map(e => e.geo_location!),
    )
    geoAnomaly = geosIn1h.size > 2

    // High risk actions from denials
    for (const e of failedIn1h.slice(0, 5)) {
      if (e.denial_reason) {
        recentHighRiskActions.push(`deny:${e.resource} — ${e.denial_reason}`)
      }
    }
  } catch { /* non-fatal */ }

  // ── Check privileged_session_log for escalations in 24h ─────────────────────
  try {
    const { count: escalationCount } = await db
      .from('privileged_session_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .eq('action_type', 'jit_elevation_use')
      .gte('recorded_at', cutoff24h)

    privilegeEscalations24h = (escalationCount as number) ?? 0

    if (privilegeEscalations24h > 0) {
      recentHighRiskActions.push(`${privilegeEscalations24h} JIT escalations in last 24h`)
    }
  } catch { /* non-fatal */ }

  // ── Check jit_elevation_requests for active elevations ──────────────────────
  try {
    const { count: jitCount } = await db
      .from('jit_elevation_requests')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .eq('status', 'approved')
      .is('elevation_used_at', null)
      .gte('expires_at', now.toISOString())

    jitElevationsActive = (jitCount as number) ?? 0
  } catch { /* non-fatal */ }

  // ── Check user_sessions for new unknown IPs ──────────────────────────────────
  try {
    const { data: sessionData } = await db
      .from('privileged_session_log')
      .select('ip_address')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .gte('recorded_at', cutoff1h)
      .not('ip_address', 'is', null)
      .limit(20)

    const sessions = (sessionData ?? []) as Array<{ ip_address: string }>
    const uniqueIps = new Set(sessions.map(s => s.ip_address))
    newSessionFromUnknownIp = uniqueIps.size > 1 // Multiple IPs in 1h = suspicious
  } catch { /* non-fatal */ }

  const factors: AccessRiskProfile['factors'] = {
    off_hours_access: offHoursAccess,
    privilege_escalations_24h: privilegeEscalations24h,
    unique_resources_accessed_1h: uniqueResourcesAccessed1h,
    failed_access_attempts_1h: failedAccessAttempts1h,
    jit_elevations_active: jitElevationsActive,
    geo_anomaly: geoAnomaly,
    new_session_from_unknown_ip: newSessionFromUnknownIp,
  }

  const riskScore = computeScore(factors)
  const riskLevel = scoreToLevel(riskScore)

  return {
    user_id: userId,
    tenant_id: tenantId,
    risk_score: riskScore,
    risk_level: riskLevel,
    factors,
    recent_high_risk_actions: recentHighRiskActions.slice(0, 10),
    last_evaluated_at: lastEvaluatedAt,
  }
}

// ─── runRiskScan ───────────────────────────────────────────────────────────────

export async function runRiskScan(
  tenantId: string,
): Promise<{
  high_risk_users: AccessRiskProfile[]
  total_users_evaluated: number
  scan_duration_ms: number
}> {
  const t0 = Date.now()
  const db = supabaseAdmin as any

  // Get distinct users who have accessed resources in the last 24h
  let userIds: string[] = []
  try {
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: userData } = await db
      .from('access_evaluations')
      .select('user_id')
      .eq('tenant_id', tenantId)
      .gte('evaluated_at', cutoff24h)

    const rows = (userData ?? []) as Array<{ user_id: string }>
    userIds = [...new Set(rows.map(r => r.user_id))].slice(0, 100) // cap at 100 users per scan
  } catch { /* non-fatal */ }

  // Also include users with privileged session records
  try {
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: sessionUserData } = await db
      .from('privileged_session_log')
      .select('user_id')
      .eq('tenant_id', tenantId)
      .gte('recorded_at', cutoff24h)

    const sessionRows = (sessionUserData ?? []) as Array<{ user_id: string }>
    const sessionUserIds = sessionRows.map(r => r.user_id)
    userIds = [...new Set([...userIds, ...sessionUserIds])].slice(0, 100)
  } catch { /* non-fatal */ }

  if (userIds.length === 0) {
    return {
      high_risk_users: [],
      total_users_evaluated: 0,
      scan_duration_ms: Date.now() - t0,
    }
  }

  // Evaluate each user (sequential to avoid DB overload)
  const profiles: AccessRiskProfile[] = []
  for (const userId of userIds) {
    try {
      const profile = await evaluateUserRisk(userId, tenantId)
      profiles.push(profile)
    } catch { /* non-fatal */ }
  }

  const highRiskUsers = profiles.filter(p => p.risk_level === 'high' || p.risk_level === 'critical')

  // Flag high-risk users
  for (const user of highRiskUsers) {
    void flagHighRiskUser(
      user.user_id,
      user.tenant_id,
      `Auto-flagged: risk_score=${user.risk_score}, level=${user.risk_level}`,
    ).catch((e: unknown) => log.warn('[AccessRisk] flagHighRiskUser failed', {
      error: e instanceof Error ? e.message : String(e),
    }))
  }

  const scanDurationMs = Date.now() - t0

  log.info('[AccessRisk] risk scan complete', {
    tenant_id: tenantId,
    total_evaluated: userIds.length,
    high_risk_count: highRiskUsers.length,
    scan_duration_ms: scanDurationMs,
  })

  return {
    high_risk_users: highRiskUsers,
    total_users_evaluated: userIds.length,
    scan_duration_ms: scanDurationMs,
  }
}

// ─── flagHighRiskUser ──────────────────────────────────────────────────────────

export async function flagHighRiskUser(
  userId: string,
  tenantId: string,
  reason: string,
): Promise<void> {
  const db = supabaseAdmin as any

  try {
    const { error } = await db
      .from('access_risk_flags')
      .insert({
        user_id: userId,
        tenant_id: tenantId,
        reason,
        active: true,
        flagged_at: new Date().toISOString(),
      })

    if (error) {
      log.warn('[AccessRisk] flagHighRiskUser insert failed', { error: error.message, user_id: userId })
    } else {
      log.info('[AccessRisk] user flagged', { user_id: userId, tenant_id: tenantId, reason })
    }
  } catch (err) {
    log.warn('[AccessRisk] flagHighRiskUser threw', {
      error: err instanceof Error ? err.message : String(err),
      user_id: userId,
    })
  }
}

// ─── getRiskFlags ──────────────────────────────────────────────────────────────

export async function getRiskFlags(
  tenantId: string,
): Promise<Array<{ user_id: string; reason: string; flagged_at: string }>> {
  try {
    const db = supabaseAdmin as any
    const { data, error } = await db
      .from('access_risk_flags')
      .select('user_id, reason, flagged_at')
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .order('flagged_at', { ascending: false })
      .limit(100)

    if (error || !data) return []

    return data as Array<{ user_id: string; reason: string; flagged_at: string }>
  } catch (err) {
    log.warn('[AccessRisk] getRiskFlags failed', {
      error: err instanceof Error ? err.message : String(err),
    })
    return []
  }
}
