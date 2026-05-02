// =============================================================================
// Agency Group — Admin Role & Permission Layer
// lib/auth/adminAuth.ts
//
// ROLES:
//   super_admin  — full access + role management + schema changes
//   ops_manager  — operational controls + distribution + review queue
//   reviewer     — deal review only (approve/reject/override)
//   analyst      — read-only analytics + dashboards
//
// PERMISSIONS are additive — higher roles include lower role permissions.
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AdminRole = 'super_admin' | 'ops_manager' | 'reviewer' | 'analyst'

export type AdminAction =
  // Deal review
  | 'review:read'
  | 'review:approve'
  | 'review:reject'
  | 'review:override_score'
  | 'review:override_routing'
  // Distribution controls
  | 'distribution:read'
  | 'distribution:pause'
  | 'distribution:resume'
  | 'distribution:force_route'
  // Analytics
  | 'analytics:read'
  | 'analytics:export'
  // System
  | 'system:read_alerts'
  | 'system:acknowledge_alerts'
  | 'system:resolve_alerts'
  | 'system:read_jobs'
  | 'system:replay_jobs'
  // Commercial
  | 'commercial:read'
  | 'commercial:write'
  // Roles
  | 'roles:read'
  | 'roles:grant'
  | 'roles:revoke'
  // Audit
  | 'audit:read'

export interface AdminUser {
  user_email:  string
  role:        AdminRole
  is_active:   boolean
  granted_at:  string
  granted_by?: string
}

// ---------------------------------------------------------------------------
// PURE: Permission matrix — what each role can do
// ---------------------------------------------------------------------------

const ROLE_PERMISSIONS: Record<AdminRole, Set<AdminAction>> = {
  analyst: new Set<AdminAction>([
    'review:read',
    'analytics:read',
    'system:read_alerts',
    'system:read_jobs',
    'commercial:read',
    'audit:read',
    'distribution:read',
    'roles:read',
  ]),

  reviewer: new Set<AdminAction>([
    'review:read',
    'review:approve',
    'review:reject',
    'review:override_score',
    'analytics:read',
    'system:read_alerts',
    'system:read_jobs',
    'commercial:read',
    'audit:read',
    'distribution:read',
    'roles:read',
  ]),

  ops_manager: new Set<AdminAction>([
    'review:read',
    'review:approve',
    'review:reject',
    'review:override_score',
    'review:override_routing',
    'distribution:read',
    'distribution:pause',
    'distribution:resume',
    'distribution:force_route',
    'analytics:read',
    'analytics:export',
    'system:read_alerts',
    'system:acknowledge_alerts',
    'system:resolve_alerts',
    'system:read_jobs',
    'system:replay_jobs',
    'commercial:read',
    'commercial:write',
    'audit:read',
    'roles:read',
  ]),

  super_admin: new Set<AdminAction>([
    'review:read',
    'review:approve',
    'review:reject',
    'review:override_score',
    'review:override_routing',
    'distribution:read',
    'distribution:pause',
    'distribution:resume',
    'distribution:force_route',
    'analytics:read',
    'analytics:export',
    'system:read_alerts',
    'system:acknowledge_alerts',
    'system:resolve_alerts',
    'system:read_jobs',
    'system:replay_jobs',
    'commercial:read',
    'commercial:write',
    'audit:read',
    'roles:read',
    'roles:grant',
    'roles:revoke',
  ]),
}

// ---------------------------------------------------------------------------
// PURE: Check if a role has a specific permission
// ---------------------------------------------------------------------------

export function hasPermission(role: AdminRole, action: AdminAction): boolean {
  return ROLE_PERMISSIONS[role]?.has(action) ?? false
}

// ---------------------------------------------------------------------------
// PURE: Get all permissions for a role
// ---------------------------------------------------------------------------

export function getPermissions(role: AdminRole): AdminAction[] {
  return [...(ROLE_PERMISSIONS[role] ?? new Set())]
}

// ---------------------------------------------------------------------------
// PURE: Check if a role can perform multiple actions (all must pass)
// ---------------------------------------------------------------------------

export function hasAllPermissions(role: AdminRole, actions: AdminAction[]): boolean {
  return actions.every(a => hasPermission(role, a))
}

// ---------------------------------------------------------------------------
// PURE: Check if a role can perform at least one action from a list
// ---------------------------------------------------------------------------

export function hasAnyPermission(role: AdminRole, actions: AdminAction[]): boolean {
  return actions.some(a => hasPermission(role, a))
}

// ---------------------------------------------------------------------------
// PURE: Compare role authority (returns true if roleA >= roleB)
// ---------------------------------------------------------------------------

const ROLE_LEVEL: Record<AdminRole, number> = {
  analyst:     1,
  reviewer:    2,
  ops_manager: 3,
  super_admin: 4,
}

export function isRoleAtLeast(role: AdminRole, minimum: AdminRole): boolean {
  return (ROLE_LEVEL[role] ?? 0) >= (ROLE_LEVEL[minimum] ?? 0)
}

// ---------------------------------------------------------------------------
// DB: Fetch admin role for a user
// ---------------------------------------------------------------------------

export async function getAdminRole(email: string): Promise<AdminUser | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from('admin_roles')
    .select('user_email, role, is_active, granted_at, granted_by')
    .eq('user_email', email)
    .eq('is_active', true)
    .single()

  if (error) return null
  return data as AdminUser
}

// ---------------------------------------------------------------------------
// DB: Grant a role to a user
// ---------------------------------------------------------------------------

export async function grantRole(
  userEmail:  string,
  role:       AdminRole,
  grantedBy:  string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabaseAdmin as any)
    .from('admin_roles')
    .upsert({
      user_email: userEmail,
      role,
      is_active:  true,
      granted_by: grantedBy,
      granted_at: new Date().toISOString(),
      revoked_at: null,
      revoked_by: null,
    }, { onConflict: 'user_email' })

  if (error) throw new Error(`grantRole: ${error.message}`)
}

// ---------------------------------------------------------------------------
// DB: Revoke a role from a user
// ---------------------------------------------------------------------------

export async function revokeRole(
  userEmail: string,
  revokedBy: string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabaseAdmin as any)
    .from('admin_roles')
    .update({
      is_active:  false,
      revoked_at: new Date().toISOString(),
      revoked_by: revokedBy,
    })
    .eq('user_email', userEmail)

  if (error) throw new Error(`revokeRole: ${error.message}`)
}
