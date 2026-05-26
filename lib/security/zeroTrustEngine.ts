// =============================================================================
// Agency Group — SH-ROS | AMI: 22506
// Zero Trust Engine — RBAC/ABAC enforcement + Session Management + JIT Access
// Wave 44 Agent 1 — Production Lock
// =============================================================================

import { createHash, randomBytes } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'

let log: { info: (m: string, c?: Record<string, unknown>) => void; warn: (m: string, c?: Record<string, unknown>) => void; error: (m: string, c?: Record<string, unknown>) => void }
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { logger } = require('@/lib/observability/logger')
  log = logger
} catch {
  log = {
    info: (m: string, c?: Record<string, unknown>) => console.log('[security]', m, c ?? {}),
    warn: (m: string, c?: Record<string, unknown>) => console.warn('[security]', m, c ?? {}),
    error: (m: string, c?: Record<string, unknown>) => console.error('[security]', m, c ?? {}),
  }
}

const TENANT_ID = process.env.DEFAULT_TENANT_ID ?? process.env.SYSTEM_ORG_ID ?? '00000000-0000-0000-0000-000000000001'

// ── Types ──────────────────────────────────────────────────────────────

export type Role = 'ADMIN' | 'OPERATOR' | 'ANALYST' | 'INVESTOR' | 'AUDITOR' | 'READONLY'
export type Permission =
  | 'capital:execute' | 'capital:read'
  | 'legal:sign' | 'legal:read'
  | 'investor:manage' | 'investor:read'
  | 'supply:ingest' | 'supply:read'
  | 'audit:read' | 'system:admin'
  | 'ml:train' | 'ml:read'

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: [
    'capital:execute', 'capital:read',
    'legal:sign', 'legal:read',
    'investor:manage', 'investor:read',
    'supply:ingest', 'supply:read',
    'audit:read', 'system:admin',
    'ml:train', 'ml:read',
  ],
  OPERATOR: [
    'capital:read', 'legal:read',
    'investor:manage', 'investor:read',
    'supply:ingest', 'supply:read',
    'ml:read',
  ],
  ANALYST: [
    'capital:read', 'legal:read',
    'investor:read', 'supply:read',
    'ml:read', 'audit:read',
  ],
  INVESTOR: ['capital:read', 'investor:read', 'supply:read'],
  AUDITOR: [
    'capital:read', 'legal:read',
    'audit:read', 'investor:read',
    'supply:read', 'ml:read',
  ],
  READONLY: ['capital:read', 'investor:read', 'supply:read'],
}

export interface SecurityContext {
  user_id: string
  session_id: string
  tenant_id: string
  roles: Role[]
  permissions: Permission[]
  mfa_verified: boolean
  ip_address: string
  user_agent: string
  issued_at: string
  expires_at: string
  jit_elevated: boolean
}

export interface AccessDecision {
  allowed: boolean
  reason: string
  risk_score: number // 0-100
  requires_mfa: boolean
  audit_required: boolean
}

// ── Access Evaluation (pure / synchronous) ─────────────────────────────

const HIGH_RISK_PERMISSIONS: Permission[] = ['capital:execute', 'legal:sign']
const WRITE_PERMISSIONS: Permission[] = ['capital:execute', 'legal:sign', 'investor:manage', 'supply:ingest', 'ml:train', 'system:admin']

export function evaluateAccess(
  ctx: SecurityContext,
  permission: Permission,
  _resourceId?: string,
): AccessDecision {
  // Build effective permissions from roles
  const effectivePermissions = new Set<Permission>()
  for (const role of ctx.roles) {
    const rolePerms = ROLE_PERMISSIONS[role] ?? []
    for (const p of rolePerms) effectivePermissions.add(p)
  }
  // Also include explicit permissions on the context
  for (const p of ctx.permissions) effectivePermissions.add(p)

  const hasPermission = effectivePermissions.has(permission)

  if (!hasPermission) {
    return {
      allowed: false,
      reason: `Permission '${permission}' not granted to roles [${ctx.roles.join(', ')}]`,
      risk_score: 0,
      requires_mfa: false,
      audit_required: false,
    }
  }

  const isHighRisk = HIGH_RISK_PERMISSIONS.includes(permission)
  const isWrite = WRITE_PERMISSIONS.includes(permission)

  if (isHighRisk && !ctx.mfa_verified) {
    return {
      allowed: false,
      reason: `Permission '${permission}' requires MFA verification — session not MFA-verified`,
      risk_score: 100,
      requires_mfa: true,
      audit_required: true,
    }
  }

  let risk_score = 0
  if (isHighRisk) {
    risk_score = ctx.mfa_verified ? 20 : 100
  } else if (isWrite && !ctx.mfa_verified) {
    risk_score = 50
  } else if (isWrite) {
    risk_score = 25
  }

  return {
    allowed: true,
    reason: `Access granted for '${permission}' via roles [${ctx.roles.join(', ')}]${ctx.jit_elevated ? ' (JIT elevated)' : ''}`,
    risk_score,
    requires_mfa: isHighRisk,
    audit_required: isHighRisk || isWrite,
  }
}

// ── Session Management ─────────────────────────────────────────────────

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function createSessionToken(
  userId: string,
  tenantId: string,
  roles: Role[],
  ipAddress: string,
  mfaVerified: boolean,
): string {
  const token = randomBytes(32).toString('hex')
  const tokenHash = hashToken(token)
  const sessionId = randomBytes(16).toString('hex')
  const issuedAt = new Date()
  const expiresAt = new Date(issuedAt.getTime() + 8 * 60 * 60 * 1000) // 8 hours

  const permissions: Permission[] = []
  for (const role of roles) {
    const rolePerms = ROLE_PERMISSIONS[role] ?? []
    for (const p of rolePerms) {
      if (!permissions.includes(p)) permissions.push(p)
    }
  }

  void (supabaseAdmin as any)
    .from('security_sessions')
    .insert({
      session_id: sessionId,
      tenant_id: tenantId ?? TENANT_ID,
      user_id: userId,
      token_hash: tokenHash,
      roles: roles as string[],
      permissions: permissions as string[],
      ip_address: ipAddress,
      user_agent: '',
      mfa_verified: mfaVerified,
      jit_elevated: false,
      issued_at: issuedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
    })
    .then(({ error }: { error: unknown }) => {
      if (error) log.warn('[zeroTrust] Failed to persist session', { session_id: sessionId, error })
    })
    .catch((e: unknown) => console.warn('[zeroTrustEngine] createSessionToken', e))

  return token
}

export async function validateSession(token: string): Promise<SecurityContext | null> {
  const tokenHash = hashToken(token)

  const { data, error } = await (supabaseAdmin as any)
    .from('security_sessions')
    .select('*')
    .eq('token_hash', tokenHash)
    .eq('revoked', false)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (error || !data) {
    return null
  }

  // Fire-and-forget: update last_seen_at
  void (supabaseAdmin as any)
    .from('security_sessions')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('token_hash', tokenHash)
    .then(({ error: e }: { error: unknown }) => {
      if (e) log.warn('[zeroTrust] Failed to update last_seen_at', { token_hash: tokenHash })
    })
    .catch((e: unknown) => console.warn('[zeroTrustEngine] validateSession update', e))

  return {
    user_id: data.user_id as string,
    session_id: data.session_id as string,
    tenant_id: data.tenant_id as string,
    roles: (data.roles as Role[]) ?? [],
    permissions: (data.permissions as Permission[]) ?? [],
    mfa_verified: data.mfa_verified as boolean,
    ip_address: data.ip_address as string,
    user_agent: data.user_agent as string,
    issued_at: data.issued_at as string,
    expires_at: data.expires_at as string,
    jit_elevated: data.jit_elevated as boolean,
  }
}

export async function revokeSession(sessionId: string, reason: string): Promise<void> {
  const { error } = await (supabaseAdmin as any)
    .from('security_sessions')
    .update({ revoked: true, revoke_reason: reason })
    .eq('session_id', sessionId)

  if (error) {
    log.error('[zeroTrust] Failed to revoke session', { session_id: sessionId, error })
  } else {
    log.info('[zeroTrust] Session revoked', { session_id: sessionId, reason })
  }
}

// ── JIT Access Control ─────────────────────────────────────────────────

export async function grantJitAccess(
  userId: string,
  sessionId: string,
  permission: Permission,
  durationMinutes: number,
  approvedBy: string,
): Promise<void> {
  const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000)

  void (supabaseAdmin as any)
    .from('jit_access_grants')
    .insert({
      tenant_id: TENANT_ID,
      user_id: userId,
      session_id: sessionId,
      permission,
      approved_by: approvedBy,
      expires_at: expiresAt.toISOString(),
      revoked: false,
    })
    .then(({ error }: { error: unknown }) => {
      if (error) log.warn('[zeroTrust] Failed to insert JIT grant', { user_id: userId, permission, error })
      else log.info('[zeroTrust] JIT access granted', { user_id: userId, permission, duration_minutes: durationMinutes, approved_by: approvedBy })
    })
    .catch((e: unknown) => console.warn('[zeroTrustEngine] grantJitAccess', e))
}

export async function checkJitGrant(userId: string, permission: Permission): Promise<boolean> {
  const { data, error } = await (supabaseAdmin as any)
    .from('jit_access_grants')
    .select('id')
    .eq('user_id', userId)
    .eq('permission', permission)
    .eq('revoked', false)
    .gt('expires_at', new Date().toISOString())
    .limit(1)

  if (error) {
    log.warn('[zeroTrust] Failed to check JIT grant', { user_id: userId, permission, error })
    return false
  }

  return Array.isArray(data) && data.length > 0
}
