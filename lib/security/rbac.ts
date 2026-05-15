// AGENCY GROUP — SH-ROS Security: Role-Based Access Control | AMI: 22506
// Phase Ω∞-1: Security 78→98 — RBAC layer
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import logger from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type RoleName = 'admin' | 'analyst' | 'agent' | 'readonly' | 'service'

export const ROLE_PERMISSIONS: Record<RoleName, string[]> = {
  admin: [
    'deals:read', 'deals:write', 'deals:delete',
    'contacts:read', 'contacts:write', 'contacts:delete',
    'agents:read', 'agents:write',
    'analytics:read', 'analytics:export',
    'audit:read',
    'compliance:read', 'compliance:write',
    'queue:read', 'queue:replay', 'queue:dlq',
    'workflows:read', 'workflows:write',
    'settings:read', 'settings:write',
    'economics:read',
    'forensics:read',
    'recovery:read', 'recovery:write',
    'tenancy:admin',
  ],
  analyst: [
    'deals:read', 'contacts:read',
    'analytics:read', 'analytics:export',
    'economics:read', 'forensics:read',
    'audit:read',
  ],
  agent: [
    'deals:read', 'deals:write',
    'contacts:read', 'contacts:write',
    'analytics:read',
  ],
  readonly: [
    'deals:read', 'contacts:read', 'analytics:read',
  ],
  service: ['*'],
}

export interface UserRole {
  org_id: string
  user_id: string
  role_name: RoleName
  permissions: string[]
}

// ─── RBAC Engine ──────────────────────────────────────────────────────────────

export class RBACEngine {
  private _cache = new Map<string, { roles: UserRole[]; expires: number }>()
  private readonly CACHE_TTL = 60_000 // 1 minute

  /**
   * Get effective roles for a user in an org.
   * Cached for 60s to avoid repeated DB hits on every request.
   */
  async getUserRoles(user_id: string, org_id: string): Promise<UserRole[]> {
    const key = `${org_id}:${user_id}`
    const cached = this._cache.get(key)
    if (cached && cached.expires > Date.now()) return cached.roles

    const sb = supabaseAdmin as unknown as {
      from: (t: string) => unknown
    }

    const { data, error } = await (sb.from('rbac_user_roles') as {
      select: (c: string) => {
        eq: (a: string, b: string) => {
          eq: (a: string, b: string) => {
            gt: (a: string, b: string) => Promise<{ data: unknown[]; error: unknown }>
            then: (resolve: (v: { data: unknown[]; error: unknown }) => void) => void
          }
        }
      }
    }).select('role_name, expires_at')
      .eq('user_id', user_id)
      .eq('org_id', org_id) as unknown as { data: Array<{ role_name: string; expires_at: string | null }>; error: unknown }

    if (error) {
      logger.error('[RBAC] getUserRoles failed', { error, user_id, org_id })
      return []
    }

    const now = new Date().toISOString()
    const roles: UserRole[] = (data ?? [])
      .filter(r => !r.expires_at || r.expires_at > now)
      .map(r => ({
        org_id,
        user_id,
        role_name: r.role_name as RoleName,
        permissions: ROLE_PERMISSIONS[r.role_name as RoleName] ?? [],
      }))

    this._cache.set(key, { roles, expires: Date.now() + this.CACHE_TTL })
    return roles
  }

  /**
   * Check if a user has a specific permission in an org.
   */
  async hasPermission(user_id: string, org_id: string, permission: string): Promise<boolean> {
    const roles = await this.getUserRoles(user_id, org_id)
    for (const role of roles) {
      if (role.permissions.includes('*') || role.permissions.includes(permission)) return true
    }
    return false
  }

  /**
   * Assert permission — throws if denied.
   */
  async assertPermission(user_id: string, org_id: string, permission: string): Promise<void> {
    const allowed = await this.hasPermission(user_id, org_id, permission)
    if (!allowed) {
      logger.warn('[RBAC] Permission denied', { user_id, org_id, permission })
      throw new RBACDeniedError(user_id, org_id, permission)
    }
  }

  /**
   * Grant a role to a user.
   */
  async grantRole(
    org_id: string,
    user_id: string,
    role_name: RoleName,
    granted_by: string,
    expires_at?: string
  ): Promise<void> {
    const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }
    const { error } = await (sb.from('rbac_user_roles') as {
      upsert: (data: unknown, opts?: unknown) => Promise<{ error: unknown }>
    }).upsert({
      org_id, user_id, role_name, granted_by,
      granted_at: new Date().toISOString(),
      expires_at: expires_at ?? null,
    }, { onConflict: 'org_id,user_id,role_name' })

    if (error) {
      logger.error('[RBAC] grantRole failed', { error, org_id, user_id, role_name })
      throw new Error(`RBAC grantRole failed: ${(error as { message: string }).message}`)
    }

    // Invalidate cache
    this._cache.delete(`${org_id}:${user_id}`)
    logger.info('[RBAC] Role granted', { org_id, user_id, role_name, granted_by })
  }

  /**
   * Revoke a role from a user.
   */
  async revokeRole(org_id: string, user_id: string, role_name: RoleName): Promise<void> {
    const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }
    const { error } = await (sb.from('rbac_user_roles') as {
      delete: () => { eq: (a: string, b: string) => { eq: (a: string, b: string) => { eq: (a: string, b: string) => Promise<{ error: unknown }> } } }
    }).delete()
      .eq('org_id', org_id)
      .eq('user_id', user_id)
      .eq('role_name', role_name)

    if (error) {
      logger.error('[RBAC] revokeRole failed', { error, org_id, user_id, role_name })
      throw new Error(`RBAC revokeRole failed: ${(error as { message: string }).message}`)
    }

    this._cache.delete(`${org_id}:${user_id}`)
    logger.info('[RBAC] Role revoked', { org_id, user_id, role_name })
  }

  /**
   * List all users with roles in an org.
   */
  async listOrgRoles(org_id: string): Promise<Array<{ user_id: string; role_name: RoleName; granted_at: string }>> {
    const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }
    const { data, error } = await (sb.from('rbac_user_roles') as {
      select: (c: string) => { eq: (a: string, b: string) => Promise<{ data: unknown[]; error: unknown }> }
    }).select('user_id, role_name, granted_at')
      .eq('org_id', org_id) as unknown as {
        data: Array<{ user_id: string; role_name: string; granted_at: string }>
        error: unknown
      }

    if (error) return []
    return (data ?? []).map(r => ({
      user_id: r.user_id,
      role_name: r.role_name as RoleName,
      granted_at: r.granted_at,
    }))
  }

  invalidateCache(org_id: string, user_id: string): void {
    this._cache.delete(`${org_id}:${user_id}`)
  }
}

export class RBACDeniedError extends Error {
  constructor(
    public readonly user_id: string,
    public readonly org_id: string,
    public readonly permission: string
  ) {
    super(`RBAC denied: user=${user_id} org=${org_id} permission=${permission}`)
    this.name = 'RBACDeniedError'
  }
}

export const rbacEngine = new RBACEngine()
