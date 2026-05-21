// TypeScript strict — 0 errors
// lib/security/rbacEngine.ts
// RBAC + ABAC hybrid for financial-grade access control

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ─────────────────────────────────────────────────────────────────────

export type SystemRole =
  | 'super_admin'
  | 'tenant_admin'
  | 'agent'
  | 'investor_portal'
  | 'compliance_officer'
  | 'data_analyst'
  | 'cron_service'
  | 'webhook_receiver'

export type Permission =
  | 'capital.execute'
  | 'capital.view'
  | 'compliance.audit_read'
  | 'compliance.kyc_write'
  | 'ml.predict'
  | 'ml.retrain'
  | 'properties.write'
  | 'properties.read'
  | 'deals.write'
  | 'deals.read'
  | 'sre.chaos'
  | 'sre.recovery'
  | 'data.export'
  | 'admin.all'

export interface RBACPolicy {
  role: SystemRole
  permissions: Permission[]
  conditions?: {
    require_mfa?: boolean
    max_amount_eur?: number
    time_restrictions?: { start_hour: number; end_hour: number }
  }
}

export interface AccessDecision {
  allowed: boolean
  role: SystemRole | null
  permission: Permission
  reason: string
  abac_conditions_met: boolean
  evaluated_at: string
}

// ─── ALL_PERMISSIONS ──────────────────────────────────────────────────────────

const ALL_PERMISSIONS: Permission[] = [
  'capital.execute',
  'capital.view',
  'compliance.audit_read',
  'compliance.kyc_write',
  'ml.predict',
  'ml.retrain',
  'properties.write',
  'properties.read',
  'deals.write',
  'deals.read',
  'sre.chaos',
  'sre.recovery',
  'data.export',
  'admin.all',
]

// ─── RBAC_POLICIES ────────────────────────────────────────────────────────────

export const RBAC_POLICIES: Record<SystemRole, RBACPolicy> = {
  super_admin: {
    role: 'super_admin',
    permissions: ALL_PERMISSIONS,
  },
  tenant_admin: {
    role: 'tenant_admin',
    permissions: ALL_PERMISSIONS.filter(p => p !== 'sre.chaos' && p !== 'sre.recovery'),
  },
  agent: {
    role: 'agent',
    permissions: [
      'properties.read',
      'properties.write',
      'deals.read',
      'deals.write',
      'capital.view',
      'ml.predict',
    ],
  },
  investor_portal: {
    role: 'investor_portal',
    permissions: [
      'properties.read',
      'capital.view',
      'capital.execute',
    ],
    conditions: {
      max_amount_eur: 10_000_000, // 10M EUR cap
    },
  },
  compliance_officer: {
    role: 'compliance_officer',
    permissions: [
      'compliance.audit_read',
      'compliance.kyc_write',
      'capital.view',
      'deals.read',
    ],
  },
  data_analyst: {
    role: 'data_analyst',
    permissions: [
      'properties.read',
      'deals.read',
      'ml.predict',
      'data.export',
    ],
  },
  cron_service: {
    role: 'cron_service',
    permissions: [
      'ml.retrain',
      'ml.predict',
      'data.export',
      'sre.chaos',
    ],
  },
  webhook_receiver: {
    role: 'webhook_receiver',
    permissions: [
      'properties.write',
      'deals.write',
    ],
  },
}

// ─── checkAccess ──────────────────────────────────────────────────────────────

export async function checkAccess(
  tenantId: string,
  actorId: string,
  permission: Permission,
  context?: {
    amount_eur?: number
    current_hour_utc?: number
  },
): Promise<AccessDecision> {
  const evaluated_at = new Date().toISOString()

  let role: SystemRole | null = null
  try {
    role = await getRoleForActor(tenantId, actorId)
  } catch (e) {
    log.warn('[rbacEngine] getRoleForActor threw', {
      error: e instanceof Error ? e.message : String(e),
      actor_id: actorId,
    })
    role = 'agent' // default fallback
  }

  const policy = RBAC_POLICIES[role]

  // Check admin.all — grants everything
  const hasPermission =
    policy.permissions.includes('admin.all') ||
    policy.permissions.includes(permission)

  if (!hasPermission) {
    const decision: AccessDecision = {
      allowed: false,
      role,
      permission,
      reason: `role:${role} does not have permission:${permission}`,
      abac_conditions_met: false,
      evaluated_at,
    }
    void _logAccessDecision(tenantId, actorId, decision)
    return decision
  }

  // ABAC conditions check
  let abac_conditions_met = true
  let abacReason = ''

  if (policy.conditions) {
    const { max_amount_eur, time_restrictions } = policy.conditions

    if (max_amount_eur !== undefined && context?.amount_eur !== undefined) {
      if (context.amount_eur > max_amount_eur) {
        abac_conditions_met = false
        abacReason = `amount_eur:${context.amount_eur} exceeds max_amount_eur:${max_amount_eur}`
      }
    }

    if (time_restrictions && abac_conditions_met) {
      const hour = context?.current_hour_utc ?? new Date().getUTCHours()
      const { start_hour, end_hour } = time_restrictions
      if (hour < start_hour || hour >= end_hour) {
        abac_conditions_met = false
        abacReason = `time_restriction:current_hour(${hour}) outside [${start_hour},${end_hour})`
      }
    }
  }

  const allowed = hasPermission && abac_conditions_met
  const decision: AccessDecision = {
    allowed,
    role,
    permission,
    reason: allowed
      ? `granted:role:${role}`
      : abacReason || `denied:abac_conditions_not_met`,
    abac_conditions_met,
    evaluated_at,
  }

  void _logAccessDecision(tenantId, actorId, decision)
  return decision
}

async function _logAccessDecision(
  tenantId: string,
  actorId: string,
  d: AccessDecision,
): Promise<void> {
  const tid = tenantId || (process.env.DEFAULT_TENANT_ID ?? process.env.SYSTEM_ORG_ID ?? '00000000-0000-0000-0000-000000000001')
  try {
    await (supabaseAdmin as any).from('access_decisions_log').insert({
      tenant_id:    tid,
      actor_id:     actorId,
      permission:   d.permission,
      allowed:      d.allowed,
      role:         d.role,
      reason:       d.reason,
      evaluated_at: d.evaluated_at,
    })
  } catch (e) {
    log.warn('[rbacEngine] _logAccessDecision failed', {
      error: e instanceof Error ? e.message : String(e),
    })
  }
}

// ─── assignRole ───────────────────────────────────────────────────────────────

export async function assignRole(
  tenantId: string,
  actorId: string,
  role: SystemRole,
): Promise<void> {
  const tid = tenantId || (process.env.DEFAULT_TENANT_ID ?? process.env.SYSTEM_ORG_ID ?? '00000000-0000-0000-0000-000000000001')
  const { error } = await (supabaseAdmin as any)
    .from('tenant_user_roles')
    .upsert(
      {
        tenant_id:   tid,
        actor_id:    actorId,
        role,
        assigned_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id,actor_id' },
    )

  if (error) {
    throw new Error(`[rbacEngine] assignRole failed: ${(error as { message: string }).message}`)
  }

  log.info('[rbacEngine] Role assigned', { tenant_id: tid, actor_id: actorId, role })
}

// ─── getRoleForActor ──────────────────────────────────────────────────────────

export async function getRoleForActor(
  tenantId: string,
  actorId: string,
): Promise<SystemRole> {
  const tid = tenantId || (process.env.DEFAULT_TENANT_ID ?? process.env.SYSTEM_ORG_ID ?? '00000000-0000-0000-0000-000000000001')

  const { data, error } = await (supabaseAdmin as any)
    .from('tenant_user_roles')
    .select('role')
    .eq('tenant_id', tid)
    .eq('actor_id', actorId)
    .maybeSingle()

  if (error) {
    log.warn('[rbacEngine] getRoleForActor query error', {
      error: error.message,
      actor_id: actorId,
    })
    return 'agent'
  }

  const row = data as { role: string } | null
  if (!row?.role) return 'agent'

  // Validate it's a known role
  const knownRoles = Object.keys(RBAC_POLICIES) as SystemRole[]
  if (knownRoles.includes(row.role as SystemRole)) {
    return row.role as SystemRole
  }

  return 'agent'
}

// ─── listRoleAssignments ──────────────────────────────────────────────────────

export async function listRoleAssignments(
  tenantId: string,
): Promise<Array<{ actor_id: string; role: SystemRole; assigned_at: string }>> {
  const tid = tenantId || (process.env.DEFAULT_TENANT_ID ?? process.env.SYSTEM_ORG_ID ?? '00000000-0000-0000-0000-000000000001')

  const { data, error } = await (supabaseAdmin as any)
    .from('tenant_user_roles')
    .select('actor_id, role, assigned_at')
    .eq('tenant_id', tid)
    .order('assigned_at', { ascending: false })

  if (error) {
    log.warn('[rbacEngine] listRoleAssignments query error', { error: error.message })
    return []
  }

  return ((data as Array<{ actor_id: string; role: string; assigned_at: string }>) ?? []).map(
    row => ({
      actor_id:    row.actor_id,
      role:        row.role as SystemRole,
      assigned_at: row.assigned_at,
    }),
  )
}
