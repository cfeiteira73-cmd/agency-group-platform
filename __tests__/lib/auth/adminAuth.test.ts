// =============================================================================
// Tests — lib/auth/adminAuth.ts  (pure functions only)
// =============================================================================

import { describe, it, expect, vi } from 'vitest'

vi.mock('../../../lib/supabase', () => ({ supabaseAdmin: {}, supabase: {} }))

import {
  hasPermission,
  getPermissions,
  hasAllPermissions,
  hasAnyPermission,
  isRoleAtLeast,
} from '../../../lib/auth/adminAuth'
import type { AdminRole, AdminAction } from '../../../lib/auth/adminAuth'

// ---------------------------------------------------------------------------
// hasPermission — analyst (most restrictive)
// ---------------------------------------------------------------------------

describe('hasPermission — analyst', () => {
  it('can read reviews', () => {
    expect(hasPermission('analyst', 'review:read')).toBe(true)
  })

  it('cannot approve reviews', () => {
    expect(hasPermission('analyst', 'review:approve')).toBe(false)
  })

  it('cannot reject reviews', () => {
    expect(hasPermission('analyst', 'review:reject')).toBe(false)
  })

  it('can read analytics', () => {
    expect(hasPermission('analyst', 'analytics:read')).toBe(true)
  })

  it('cannot export analytics', () => {
    expect(hasPermission('analyst', 'analytics:export')).toBe(false)
  })

  it('can read distribution', () => {
    expect(hasPermission('analyst', 'distribution:read')).toBe(true)
  })

  it('cannot pause distribution', () => {
    expect(hasPermission('analyst', 'distribution:pause')).toBe(false)
  })

  it('can read commercial', () => {
    expect(hasPermission('analyst', 'commercial:read')).toBe(true)
  })

  it('cannot write commercial', () => {
    expect(hasPermission('analyst', 'commercial:write')).toBe(false)
  })

  it('cannot grant roles', () => {
    expect(hasPermission('analyst', 'roles:grant')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// hasPermission — reviewer
// ---------------------------------------------------------------------------

describe('hasPermission — reviewer', () => {
  it('can approve reviews', () => {
    expect(hasPermission('reviewer', 'review:approve')).toBe(true)
  })

  it('can reject reviews', () => {
    expect(hasPermission('reviewer', 'review:reject')).toBe(true)
  })

  it('can override score', () => {
    expect(hasPermission('reviewer', 'review:override_score')).toBe(true)
  })

  it('cannot override routing', () => {
    expect(hasPermission('reviewer', 'review:override_routing')).toBe(false)
  })

  it('cannot pause distribution', () => {
    expect(hasPermission('reviewer', 'distribution:pause')).toBe(false)
  })

  it('cannot grant roles', () => {
    expect(hasPermission('reviewer', 'roles:grant')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// hasPermission — ops_manager
// ---------------------------------------------------------------------------

describe('hasPermission — ops_manager', () => {
  it('can pause distribution', () => {
    expect(hasPermission('ops_manager', 'distribution:pause')).toBe(true)
  })

  it('can resume distribution', () => {
    expect(hasPermission('ops_manager', 'distribution:resume')).toBe(true)
  })

  it('can force route', () => {
    expect(hasPermission('ops_manager', 'distribution:force_route')).toBe(true)
  })

  it('can acknowledge alerts', () => {
    expect(hasPermission('ops_manager', 'system:acknowledge_alerts')).toBe(true)
  })

  it('can resolve alerts', () => {
    expect(hasPermission('ops_manager', 'system:resolve_alerts')).toBe(true)
  })

  it('can replay jobs', () => {
    expect(hasPermission('ops_manager', 'system:replay_jobs')).toBe(true)
  })

  it('can write commercial', () => {
    expect(hasPermission('ops_manager', 'commercial:write')).toBe(true)
  })

  it('cannot grant roles', () => {
    expect(hasPermission('ops_manager', 'roles:grant')).toBe(false)
  })

  it('can override routing', () => {
    expect(hasPermission('ops_manager', 'review:override_routing')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// hasPermission — super_admin
// ---------------------------------------------------------------------------

describe('hasPermission — super_admin', () => {
  it('can grant roles', () => {
    expect(hasPermission('super_admin', 'roles:grant')).toBe(true)
  })

  it('can revoke roles', () => {
    expect(hasPermission('super_admin', 'roles:revoke')).toBe(true)
  })

  it('has all ops_manager permissions', () => {
    const opPermissions: AdminAction[] = [
      'distribution:pause', 'distribution:resume', 'distribution:force_route',
      'system:replay_jobs', 'commercial:write', 'review:override_routing',
    ]
    opPermissions.forEach(action => {
      expect(hasPermission('super_admin', action)).toBe(true)
    })
  })
})

// ---------------------------------------------------------------------------
// getPermissions
// ---------------------------------------------------------------------------

describe('getPermissions', () => {
  it('returns array of actions for analyst', () => {
    const perms = getPermissions('analyst')
    expect(Array.isArray(perms)).toBe(true)
    expect(perms.length).toBeGreaterThan(0)
  })

  it('super_admin has more permissions than analyst', () => {
    expect(getPermissions('super_admin').length).toBeGreaterThan(getPermissions('analyst').length)
  })

  it('each role has more permissions than the role below', () => {
    expect(getPermissions('super_admin').length).toBeGreaterThanOrEqual(getPermissions('ops_manager').length)
    expect(getPermissions('ops_manager').length).toBeGreaterThan(getPermissions('reviewer').length)
    expect(getPermissions('reviewer').length).toBeGreaterThan(getPermissions('analyst').length)
  })

  it('includes known permission for analyst', () => {
    expect(getPermissions('analyst')).toContain('analytics:read')
  })
})

// ---------------------------------------------------------------------------
// hasAllPermissions
// ---------------------------------------------------------------------------

describe('hasAllPermissions', () => {
  it('true when role has all listed permissions', () => {
    expect(hasAllPermissions('ops_manager', ['distribution:pause', 'distribution:resume'])).toBe(true)
  })

  it('false when role lacks one permission', () => {
    expect(hasAllPermissions('reviewer', ['review:approve', 'distribution:pause'])).toBe(false)
  })

  it('true for empty list', () => {
    expect(hasAllPermissions('analyst', [])).toBe(true)
  })

  it('super_admin can do all ops + review actions', () => {
    const actions: AdminAction[] = [
      'review:approve', 'distribution:pause', 'system:replay_jobs',
      'commercial:write', 'roles:grant', 'roles:revoke',
    ]
    expect(hasAllPermissions('super_admin', actions)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// hasAnyPermission
// ---------------------------------------------------------------------------

describe('hasAnyPermission', () => {
  it('true when role has at least one permission', () => {
    expect(hasAnyPermission('analyst', ['review:read', 'distribution:pause'])).toBe(true)
  })

  it('false when role has none of the listed permissions', () => {
    expect(hasAnyPermission('analyst', ['roles:grant', 'roles:revoke', 'distribution:pause'])).toBe(false)
  })

  it('false for empty list', () => {
    expect(hasAnyPermission('super_admin', [])).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// isRoleAtLeast
// ---------------------------------------------------------------------------

describe('isRoleAtLeast', () => {
  it('analyst >= analyst', () => {
    expect(isRoleAtLeast('analyst', 'analyst')).toBe(true)
  })

  it('reviewer >= analyst', () => {
    expect(isRoleAtLeast('reviewer', 'analyst')).toBe(true)
  })

  it('ops_manager >= reviewer', () => {
    expect(isRoleAtLeast('ops_manager', 'reviewer')).toBe(true)
  })

  it('super_admin >= ops_manager', () => {
    expect(isRoleAtLeast('super_admin', 'ops_manager')).toBe(true)
  })

  it('super_admin >= analyst', () => {
    expect(isRoleAtLeast('super_admin', 'analyst')).toBe(true)
  })

  it('analyst is NOT >= reviewer', () => {
    expect(isRoleAtLeast('analyst', 'reviewer')).toBe(false)
  })

  it('reviewer is NOT >= ops_manager', () => {
    expect(isRoleAtLeast('reviewer', 'ops_manager')).toBe(false)
  })

  it('ops_manager is NOT >= super_admin', () => {
    expect(isRoleAtLeast('ops_manager', 'super_admin')).toBe(false)
  })

  it('analyst is NOT >= super_admin', () => {
    expect(isRoleAtLeast('analyst', 'super_admin')).toBe(false)
  })

  it('role equals minimum returns true for all roles', () => {
    const roles: AdminRole[] = ['analyst', 'reviewer', 'ops_manager', 'super_admin']
    roles.forEach(r => expect(isRoleAtLeast(r, r)).toBe(true))
  })
})
