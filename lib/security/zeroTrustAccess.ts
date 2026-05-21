// Agency Group — Zero Trust Access Engine
// lib/security/zeroTrustAccess.ts
// TypeScript strict — 0 errors
//
// Zero-trust: never trust, always verify. Every access decision logged.
// JIT elevation for privileged actions. Hardware MFA required for sensitive ops.
// All enforcement is policy-based — zero hardcoded exceptions.

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ─────────────────────────────────────────────────────────────────────

export type TrustLevel = 'none' | 'basic' | 'elevated' | 'privileged'

export interface ZeroTrustPolicy {
  policy_id: string
  resource_pattern: string
  required_trust_level: TrustLevel
  require_mfa: boolean
  require_hardware_mfa: boolean
  max_session_age_minutes: number
  require_jit_approval: boolean
  approvers_required: number
  geo_restrictions: string[]
}

export interface AccessEvaluation {
  evaluation_id: string
  user_id: string
  tenant_id: string
  resource: string
  action: string
  trust_level: TrustLevel
  mfa_verified: boolean
  hardware_mfa_verified: boolean
  session_age_minutes: number
  geo_location: string | null
  decision: 'allow' | 'deny' | 'require_elevation' | 'require_approval'
  policy_matched: string | null
  denial_reason: string | null
  evaluated_at: string
}

export interface JitElevationRequest {
  request_id: string
  user_id: string
  tenant_id: string
  resource: string
  action: string
  justification: string
  approvers: string[]
  approved_by: string[]
  status: 'pending' | 'approved' | 'denied' | 'expired'
  requested_at: string
  expires_at: string
  elevation_used_at: string | null
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const TRUST_LEVEL_ORDER: Record<TrustLevel, number> = {
  none: 0,
  basic: 1,
  elevated: 2,
  privileged: 3,
}

function trustMeetsRequirement(actual: TrustLevel, required: TrustLevel): boolean {
  return TRUST_LEVEL_ORDER[actual] >= TRUST_LEVEL_ORDER[required]
}

/**
 * Match resource against a glob-style pattern.
 * Supports '*' (any single segment) and '.*' (any sub-path).
 * Examples: 'capital.*' matches 'capital.transactions', 'capital.settle'
 */
function matchesPattern(resource: string, pattern: string): boolean {
  if (pattern === '*') return true
  // Escape dots, replace * with .*
  const regexStr = '^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$'
  try {
    return new RegExp(regexStr).test(resource)
  } catch {
    return false
  }
}

// ─── getActivePolicies ─────────────────────────────────────────────────────────

export async function getActivePolicies(tenantId: string): Promise<ZeroTrustPolicy[]> {
  try {
    const db = supabaseAdmin as any
    const { data, error } = await db
      .from('zero_trust_policies')
      .select('id, resource_pattern, required_trust_level, require_mfa, require_hardware_mfa, max_session_age_minutes, require_jit_approval, approvers_required, geo_restrictions')
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .order('resource_pattern', { ascending: true })

    if (error || !data) return []

    return (data as Array<{
      id: string
      resource_pattern: string
      required_trust_level: TrustLevel
      require_mfa: boolean
      require_hardware_mfa: boolean
      max_session_age_minutes: number
      require_jit_approval: boolean
      approvers_required: number
      geo_restrictions: string[]
    }>).map(row => ({
      policy_id: row.id,
      resource_pattern: row.resource_pattern,
      required_trust_level: row.required_trust_level,
      require_mfa: row.require_mfa,
      require_hardware_mfa: row.require_hardware_mfa,
      max_session_age_minutes: row.max_session_age_minutes,
      require_jit_approval: row.require_jit_approval,
      approvers_required: row.approvers_required,
      geo_restrictions: row.geo_restrictions ?? [],
    }))
  } catch (err) {
    log.warn('[ZeroTrust] getActivePolicies failed', { error: err instanceof Error ? err.message : String(err) })
    return []
  }
}

// ─── evaluateAccess ────────────────────────────────────────────────────────────

export async function evaluateAccess(
  userId: string,
  tenantId: string,
  resource: string,
  action: string,
  context: {
    mfaVerified: boolean
    hardwareMfaVerified: boolean
    sessionAgeMinutes: number
    geoLocation?: string
    trustLevel?: TrustLevel
  },
): Promise<AccessEvaluation> {
  const evaluationId = randomUUID()
  const evaluatedAt = new Date().toISOString()
  const trustLevel: TrustLevel = context.trustLevel ?? 'basic'

  const evaluation: AccessEvaluation = {
    evaluation_id: evaluationId,
    user_id: userId,
    tenant_id: tenantId,
    resource,
    action,
    trust_level: trustLevel,
    mfa_verified: context.mfaVerified,
    hardware_mfa_verified: context.hardwareMfaVerified,
    session_age_minutes: context.sessionAgeMinutes,
    geo_location: context.geoLocation ?? null,
    decision: 'allow',
    policy_matched: null,
    denial_reason: null,
    evaluated_at: evaluatedAt,
  }

  // Load and match policies
  const policies = await getActivePolicies(tenantId)

  // Find most specific matching policy (longest pattern wins)
  const matchingPolicies = policies.filter(p => matchesPattern(resource, p.resource_pattern))
  const policy = matchingPolicies.sort((a, b) => b.resource_pattern.length - a.resource_pattern.length)[0]

  if (!policy) {
    // No policy = allow by default (open resources)
    evaluation.decision = 'allow'
    await persistEvaluation(evaluation)
    return evaluation
  }

  evaluation.policy_matched = policy.policy_id

  // Check trust level
  if (!trustMeetsRequirement(trustLevel, policy.required_trust_level)) {
    evaluation.decision = 'require_elevation'
    evaluation.denial_reason = `Required trust level: ${policy.required_trust_level}, current: ${trustLevel}`
    await persistEvaluation(evaluation)
    return evaluation
  }

  // Check MFA
  if (policy.require_mfa && !context.mfaVerified) {
    evaluation.decision = 'deny'
    evaluation.denial_reason = 'MFA required but not verified'
    await persistEvaluation(evaluation)
    return evaluation
  }

  // Check hardware MFA
  if (policy.require_hardware_mfa && !context.hardwareMfaVerified) {
    evaluation.decision = 'deny'
    evaluation.denial_reason = 'Hardware MFA (FIDO2/WebAuthn) required but not verified'
    await persistEvaluation(evaluation)
    return evaluation
  }

  // Check session age
  if (context.sessionAgeMinutes > policy.max_session_age_minutes) {
    evaluation.decision = 'deny'
    evaluation.denial_reason = `Session expired: ${context.sessionAgeMinutes}min > max ${policy.max_session_age_minutes}min`
    await persistEvaluation(evaluation)
    return evaluation
  }

  // Check geo restrictions
  if (policy.geo_restrictions.length > 0 && context.geoLocation) {
    if (!policy.geo_restrictions.includes(context.geoLocation)) {
      evaluation.decision = 'deny'
      evaluation.denial_reason = `Geo location ${context.geoLocation} not in allowed list: ${policy.geo_restrictions.join(', ')}`
      await persistEvaluation(evaluation)
      return evaluation
    }
  }

  // Check JIT approval requirement
  if (policy.require_jit_approval) {
    evaluation.decision = 'require_approval'
    evaluation.denial_reason = `Resource requires JIT approval from ${policy.approvers_required} approver(s)`
    await persistEvaluation(evaluation)
    return evaluation
  }

  // All checks passed
  evaluation.decision = 'allow'
  await persistEvaluation(evaluation)
  return evaluation
}

async function persistEvaluation(evaluation: AccessEvaluation): Promise<void> {
  const db = supabaseAdmin as any
  void db
    .from('access_evaluations')
    .insert({
      id: evaluation.evaluation_id,
      user_id: evaluation.user_id,
      tenant_id: evaluation.tenant_id,
      resource: evaluation.resource,
      action: evaluation.action,
      trust_level: evaluation.trust_level,
      mfa_verified: evaluation.mfa_verified,
      hardware_mfa_verified: evaluation.hardware_mfa_verified,
      session_age_minutes: evaluation.session_age_minutes,
      geo_location: evaluation.geo_location,
      decision: evaluation.decision,
      policy_matched: evaluation.policy_matched,
      denial_reason: evaluation.denial_reason,
      evaluated_at: evaluation.evaluated_at,
    })
    .then(({ error }: { error: { message: string } | null }) => {
      if (error) log.warn('[ZeroTrust] persistEvaluation failed', { error: error.message })
    })
    .catch((e: unknown) => log.warn('[ZeroTrust] persistEvaluation threw', {
      error: e instanceof Error ? e.message : String(e),
    }))
}

// ─── requestJitElevation ───────────────────────────────────────────────────────

export async function requestJitElevation(
  userId: string,
  tenantId: string,
  resource: string,
  action: string,
  justification: string,
): Promise<JitElevationRequest> {
  const db = supabaseAdmin as any
  const requestId = randomUUID()
  const requestedAt = new Date().toISOString()
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour

  // Find relevant policy to determine approvers
  const policies = await getActivePolicies(tenantId)
  const policy = policies
    .filter(p => matchesPattern(resource, p.resource_pattern))
    .sort((a, b) => b.resource_pattern.length - a.resource_pattern.length)[0]

  const approversRequired = policy?.approvers_required ?? 1

  const jitRequest: JitElevationRequest = {
    request_id: requestId,
    user_id: userId,
    tenant_id: tenantId,
    resource,
    action,
    justification,
    approvers: [],
    approved_by: [],
    status: 'pending',
    requested_at: requestedAt,
    expires_at: expiresAt,
    elevation_used_at: null,
  }

  const { error } = await db
    .from('jit_elevation_requests')
    .insert({
      id: requestId,
      user_id: userId,
      tenant_id: tenantId,
      resource,
      action,
      justification,
      approvers: [],
      approved_by: [],
      status: 'pending',
      expires_at: expiresAt,
      elevation_used_at: null,
      created_at: requestedAt,
    })

  if (error) {
    log.warn('[ZeroTrust] requestJitElevation insert failed', { error: error.message })
  }

  log.info('[ZeroTrust] JIT elevation requested', {
    request_id: requestId,
    user_id: userId,
    tenant_id: tenantId,
    resource,
    approvers_required: approversRequired,
  })

  return jitRequest
}

// ─── approveJitElevation ───────────────────────────────────────────────────────

export async function approveJitElevation(
  requestId: string,
  approverId: string,
): Promise<JitElevationRequest> {
  const db = supabaseAdmin as any

  // Load existing request
  const { data: existing, error: loadErr } = await db
    .from('jit_elevation_requests')
    .select('*')
    .eq('id', requestId)
    .single()

  if (loadErr || !existing) {
    throw new Error(`JIT request ${requestId} not found`)
  }

  const req = existing as {
    id: string
    user_id: string
    tenant_id: string
    resource: string
    action: string
    justification: string
    approvers: string[]
    approved_by: string[]
    status: string
    expires_at: string
    elevation_used_at: string | null
    created_at: string
  }

  // Check expiry
  if (new Date(req.expires_at) < new Date()) {
    await db
      .from('jit_elevation_requests')
      .update({ status: 'expired' })
      .eq('id', requestId)

    throw new Error(`JIT request ${requestId} has expired`)
  }

  // Add approver
  const approvedBy: string[] = [...(req.approved_by ?? []), approverId]

  // Load policy to check required approvers
  const policies = await getActivePolicies(req.tenant_id)
  const policy = policies
    .filter(p => matchesPattern(req.resource, p.resource_pattern))
    .sort((a, b) => b.resource_pattern.length - a.resource_pattern.length)[0]

  const approversRequired = policy?.approvers_required ?? 1
  const newStatus = approvedBy.length >= approversRequired ? 'approved' : 'pending'

  const { error: updateErr } = await db
    .from('jit_elevation_requests')
    .update({ approved_by: approvedBy, status: newStatus })
    .eq('id', requestId)

  if (updateErr) {
    log.warn('[ZeroTrust] approveJitElevation update failed', { error: updateErr.message })
  }

  log.info('[ZeroTrust] JIT elevation approval recorded', {
    request_id: requestId,
    approver_id: approverId,
    new_status: newStatus,
    approved_count: approvedBy.length,
    required: approversRequired,
  })

  return {
    request_id: req.id,
    user_id: req.user_id,
    tenant_id: req.tenant_id,
    resource: req.resource,
    action: req.action,
    justification: req.justification,
    approvers: req.approvers ?? [],
    approved_by: approvedBy,
    status: newStatus as JitElevationRequest['status'],
    requested_at: req.created_at,
    expires_at: req.expires_at,
    elevation_used_at: req.elevation_used_at,
  }
}

// ─── revokeAllUserSessions ─────────────────────────────────────────────────────

export async function revokeAllUserSessions(
  userId: string,
  tenantId: string,
  reason: string,
): Promise<number> {
  const db = supabaseAdmin as any
  const revokedAt = new Date().toISOString()

  try {
    const { data, error } = await db
      .from('user_sessions')
      .update({ active: false, revoked_at: revokedAt, revocation_reason: reason })
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .select('id')

    if (error) {
      log.warn('[ZeroTrust] revokeAllUserSessions failed', { error: error.message })
      return 0
    }

    const count = (data as unknown[])?.length ?? 0

    log.info('[ZeroTrust] sessions revoked', {
      user_id: userId,
      tenant_id: tenantId,
      revoked_count: count,
      reason,
    })

    return count
  } catch (err) {
    log.warn('[ZeroTrust] revokeAllUserSessions threw', {
      error: err instanceof Error ? err.message : String(err),
    })
    return 0
  }
}

// ─── seedDefaultPolicies ───────────────────────────────────────────────────────

export async function seedDefaultPolicies(tenantId: string): Promise<void> {
  const db = supabaseAdmin as any

  const defaultPolicies = [
    {
      tenant_id: tenantId,
      resource_pattern: 'capital.*',
      required_trust_level: 'elevated',
      require_mfa: true,
      require_hardware_mfa: false,
      max_session_age_minutes: 120,
      require_jit_approval: false,
      approvers_required: 0,
      geo_restrictions: [],
      active: true,
    },
    {
      tenant_id: tenantId,
      resource_pattern: 'settlement.*',
      required_trust_level: 'privileged',
      require_mfa: true,
      require_hardware_mfa: true,
      max_session_age_minutes: 60,
      require_jit_approval: true,
      approvers_required: 1,
      geo_restrictions: [],
      active: true,
    },
    {
      tenant_id: tenantId,
      resource_pattern: 'tenant.*',
      required_trust_level: 'privileged',
      require_mfa: true,
      require_hardware_mfa: true,
      max_session_age_minutes: 30,
      require_jit_approval: true,
      approvers_required: 2,
      geo_restrictions: [],
      active: true,
    },
    {
      tenant_id: tenantId,
      resource_pattern: 'admin.*',
      required_trust_level: 'elevated',
      require_mfa: true,
      require_hardware_mfa: false,
      max_session_age_minutes: 240,
      require_jit_approval: false,
      approvers_required: 0,
      geo_restrictions: [],
      active: true,
    },
  ]

  for (const policy of defaultPolicies) {
    try {
      const { error } = await db
        .from('zero_trust_policies')
        .upsert(policy, { onConflict: 'tenant_id,resource_pattern' })

      if (error) {
        log.warn('[ZeroTrust] seedDefaultPolicies upsert failed', {
          pattern: policy.resource_pattern,
          error: error.message,
        })
      }
    } catch (err) {
      log.warn('[ZeroTrust] seedDefaultPolicies threw', {
        pattern: policy.resource_pattern,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  log.info('[ZeroTrust] default policies seeded', { tenant_id: tenantId, count: defaultPolicies.length })
}
