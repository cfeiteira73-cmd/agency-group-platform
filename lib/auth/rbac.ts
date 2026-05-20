// =============================================================================
// Agency Group — Enterprise RBAC
// lib/auth/rbac.ts
// Role-Based Access Control with tenant isolation.
// TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Role =
  | 'super_admin'
  | 'tenant_owner'
  | 'broker_admin'
  | 'broker'
  | 'analyst'
  | 'finance'
  | 'readonly'

export type Permission =
  | 'deals:read'       | 'deals:write'       | 'deals:delete'
  | 'contacts:read'    | 'contacts:write'    | 'contacts:delete'
  | 'ai:invoke'        | 'ai:audit_read'
  | 'analytics:read'   | 'analytics:export'
  | 'billing:read'     | 'billing:manage'
  | 'replay:trigger'   | 'control_tower:read'
  | 'tenants:manage'   | 'agents:manage'

// ---------------------------------------------------------------------------
// Role hierarchy — index 0 = highest authority
// ---------------------------------------------------------------------------

const ROLE_HIERARCHY: Role[] = [
  'super_admin',
  'tenant_owner',
  'broker_admin',
  'broker',
  'analyst',
  'finance',
  'readonly',
]

// ---------------------------------------------------------------------------
// Permission matrix
// ---------------------------------------------------------------------------

const ALL_PERMISSIONS: Permission[] = [
  'deals:read', 'deals:write', 'deals:delete',
  'contacts:read', 'contacts:write', 'contacts:delete',
  'ai:invoke', 'ai:audit_read',
  'analytics:read', 'analytics:export',
  'billing:read', 'billing:manage',
  'replay:trigger', 'control_tower:read',
  'tenants:manage', 'agents:manage',
]

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  super_admin: [...ALL_PERMISSIONS],

  tenant_owner: ALL_PERMISSIONS.filter(p => p !== 'tenants:manage'),

  broker_admin: [
    'deals:read', 'deals:write', 'deals:delete',
    'contacts:read', 'contacts:write', 'contacts:delete',
    'ai:invoke', 'ai:audit_read',
    'analytics:read',
    'control_tower:read',
    'agents:manage',
    'replay:trigger',
  ],

  broker: [
    'deals:read', 'deals:write',
    'contacts:read', 'contacts:write',
    'ai:invoke',
  ],

  analyst: [
    'deals:read',
    'contacts:read',
    'analytics:read', 'analytics:export',
    'ai:audit_read',
    'control_tower:read',
  ],

  finance: [
    'billing:read', 'billing:manage',
    'analytics:read', 'analytics:export',
    'deals:read',
  ],

  readonly: [
    'deals:read',
    'contacts:read',
    'analytics:read',
  ],
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if the given role has the specified permission.
 */
export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}

/**
 * Returns true if `role` is at or above `requiredRole` in the hierarchy.
 * Lower index = higher authority.
 */
export function requiresRole(role: Role, requiredRole: Role): boolean {
  const roleIdx     = ROLE_HIERARCHY.indexOf(role)
  const requiredIdx = ROLE_HIERARCHY.indexOf(requiredRole)
  if (roleIdx === -1 || requiredIdx === -1) return false
  return roleIdx <= requiredIdx
}

/**
 * Returns true if the role can invoke AI features.
 */
export function canInvokeAI(role: Role): boolean {
  return hasPermission(role, 'ai:invoke')
}

/**
 * Returns true if the role can manage tenant configuration.
 */
export function canManageTenant(role: Role): boolean {
  return hasPermission(role, 'tenants:manage')
}

// ---------------------------------------------------------------------------
// Route guard
// ---------------------------------------------------------------------------

/**
 * Returns a 403 NextResponse if the role does not have the required permission.
 * Returns null if the caller is authorized — the caller should continue.
 *
 * Usage:
 *   const denied = assertPermission(req, role, 'deals:write')
 *   if (denied) return denied
 */
export function assertPermission(
  _req: NextRequest,
  role: Role | undefined,
  permission: Permission,
): NextResponse | null {
  if (!role || !hasPermission(role, permission)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return null
}
