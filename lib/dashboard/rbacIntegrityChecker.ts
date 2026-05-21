// Agency Group — RBAC Integrity Checker
// lib/dashboard/rbacIntegrityChecker.ts
// TypeScript strict — 0 errors
//
// Verifies RBAC enforcement across all portal sections.
// Maps portal sections to required RBAC permissions.
// Detects: privilege escalation attempts, role bypass patterns.

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type PortalSection =
  | 'dashboard'
  | 'crm'
  | 'deals'
  | 'imoveis'
  | 'analytics'
  | 'investidores'
  | 'campanhas'
  | 'outbound'
  | 'governance'
  | 'admin'
  | 'juridico'
  | 'financeiro'

export interface RBACIntegrityReport {
  report_id: string
  tenant_id: string

  section_permissions: {
    section: PortalSection
    required_permission: string
    required_role: string
    rbac_policy_exists: boolean
    last_access_decision_at: string | null
    access_denied_count_7d: number
    integrity: 'enforced' | 'missing' | 'unknown'
  }[]

  privilege_escalation_attempts: {
    actor_id: string
    attempted_section: string
    detected_at: string
    blocked: boolean
  }[]

  role_distribution: {
    role: string
    user_count: number
    pct: number
  }[]

  rbac_score: number    // 0–100
  policies_active: number
  policies_missing: number

  generated_at: string
}

// ─── Section → Permission Mapping ────────────────────────────────────────────

const SECTION_PERMISSIONS: Record<PortalSection, { permission: string; role: string }> = {
  dashboard:    { permission: 'portal.read',         role: 'agent' },
  crm:          { permission: 'contacts.read',        role: 'agent' },
  deals:        { permission: 'deals.read',           role: 'agent' },
  imoveis:      { permission: 'properties.read',      role: 'agent' },
  analytics:    { permission: 'analytics.read',       role: 'manager' },
  investidores: { permission: 'investors.read',       role: 'manager' },
  campanhas:    { permission: 'campaigns.write',      role: 'manager' },
  outbound:     { permission: 'contacts.write',       role: 'agent' },
  governance:   { permission: 'admin.governance',     role: 'admin' },
  admin:        { permission: 'admin.full',           role: 'admin' },
  juridico:     { permission: 'legal.read',           role: 'agent' },
  financeiro:   { permission: 'finance.read',         role: 'agent' },
}

const ALL_SECTIONS = Object.keys(SECTION_PERMISSIONS) as PortalSection[]

// ─── Role Hierarchy (lower index = lower privilege) ───────────────────────────
const ROLE_HIERARCHY: Record<string, number> = {
  agent: 1,
  manager: 2,
  admin: 3,
  super_admin: 4,
}

// ─── Section Permission Check ─────────────────────────────────────────────────

export async function checkSectionPermissions(
  tenantId: string,
): Promise<RBACIntegrityReport['section_permissions']> {
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Fetch all rbac_policies for this tenant
  const { data: policies } = await (supabaseAdmin as any)
    .from('rbac_policies')
    .select('permission, role, resource_pattern')
    .eq('tenant_id', tenantId)

  const policyPermissions = new Set<string>()
  if (policies && Array.isArray(policies)) {
    for (const p of policies) {
      const perm: string = (p as Record<string, unknown>).permission as string ?? ''
      if (perm) policyPermissions.add(perm)
    }
  }

  const results: RBACIntegrityReport['section_permissions'] = []

  for (const section of ALL_SECTIONS) {
    const { permission, role } = SECTION_PERMISSIONS[section]

    const rbac_policy_exists = policyPermissions.has(permission)

    // Last access decision for this section
    const { data: lastDecision } = await (supabaseAdmin as any)
      .from('access_decisions_log')
      .select('created_at')
      .eq('tenant_id', tenantId)
      .ilike('resource_path', `%/${section}%`)
      .order('created_at', { ascending: false })
      .limit(1)

    const last_access_decision_at: string | null =
      lastDecision && Array.isArray(lastDecision) && lastDecision.length > 0
        ? ((lastDecision[0] as Record<string, unknown>).created_at as string)
        : null

    // Denied count in last 7 days
    const deniedResult = await (supabaseAdmin as any)
      .from('access_decisions_log')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('decision', 'deny')
      .ilike('resource_path', `%/${section}%`)
      .gte('created_at', since7d)
    const access_denied_count_7d: number = deniedResult.count ?? 0

    let integrity: 'enforced' | 'missing' | 'unknown'
    if (rbac_policy_exists && last_access_decision_at !== null) {
      integrity = 'enforced'
    } else if (!rbac_policy_exists) {
      integrity = 'missing'
    } else {
      integrity = 'unknown'
    }

    results.push({
      section,
      required_permission: permission,
      required_role: role,
      rbac_policy_exists,
      last_access_decision_at,
      access_denied_count_7d,
      integrity,
    })
  }

  return results
}

// ─── Privilege Escalation Detection ──────────────────────────────────────────

export async function detectPrivilegeEscalation(
  tenantId: string,
): Promise<RBACIntegrityReport['privilege_escalation_attempts']> {
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Access decisions that were denied where actor tried a resource above their role
  const { data: deniedDecisions } = await (supabaseAdmin as any)
    .from('access_decisions_log')
    .select('actor_id, resource_path, actor_role, required_role, created_at, decision')
    .eq('tenant_id', tenantId)
    .eq('decision', 'deny')
    .gte('created_at', since7d)
    .limit(200)

  const attempts: RBACIntegrityReport['privilege_escalation_attempts'] = []

  if (!deniedDecisions || !Array.isArray(deniedDecisions)) return attempts

  for (const row of deniedDecisions) {
    const r = row as Record<string, unknown>
    const actorRole: string = r.actor_role as string ?? 'agent'
    const requiredRole: string = r.required_role as string ?? 'admin'

    const actorLevel = ROLE_HIERARCHY[actorRole] ?? 1
    const requiredLevel = ROLE_HIERARCHY[requiredRole] ?? 3

    // Privilege escalation: actor tried to access a resource requiring a higher role
    if (actorLevel < requiredLevel) {
      attempts.push({
        actor_id: r.actor_id as string,
        attempted_section: r.resource_path as string,
        detected_at: r.created_at as string,
        blocked: r.decision === 'deny',
      })
    }
  }

  return attempts
}

// ─── Role Distribution ────────────────────────────────────────────────────────

async function computeRoleDistribution(
  tenantId: string,
): Promise<RBACIntegrityReport['role_distribution']> {
  const { data: roleData } = await (supabaseAdmin as any)
    .from('portal_users')
    .select('role')
    .eq('tenant_id', tenantId)

  if (!roleData || !Array.isArray(roleData)) return []

  const counts: Record<string, number> = {}
  for (const row of roleData) {
    const r: string = (row as Record<string, unknown>).role as string ?? 'agent'
    counts[r] = (counts[r] ?? 0) + 1
  }

  const total = roleData.length || 1

  return Object.entries(counts).map(([role, user_count]) => ({
    role,
    user_count,
    pct: Math.round((user_count / total) * 100),
  }))
}

// ─── RBAC Score ───────────────────────────────────────────────────────────────

export function computeRBACScore(report: Partial<RBACIntegrityReport>): number {
  const sections = report.section_permissions ?? []
  const total = sections.length || 1
  const enforced = sections.filter((s) => s.integrity === 'enforced').length
  const missing = sections.filter((s) => s.integrity === 'missing').length

  const baseScore = (enforced / total) * 100

  // Penalise privilege escalation attempts (especially unblocked ones)
  const escalationAttempts = report.privilege_escalation_attempts ?? []
  const unblockedEscalations = escalationAttempts.filter((a) => !a.blocked).length
  const escalationPenalty = Math.min(unblockedEscalations * 15, 40)
  const missingPenalty = Math.min(missing * 5, 30)

  return Math.max(0, Math.min(100, Math.round(baseScore - escalationPenalty - missingPenalty)))
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

export async function runRBACIntegrityCheck(
  tenantId: string,
): Promise<RBACIntegrityReport> {
  const report_id = randomUUID()

  log.info('[rbacIntegrityChecker] starting check', { report_id, tenantId })

  const [section_permissions, privilege_escalation_attempts, role_distribution] =
    await Promise.all([
      checkSectionPermissions(tenantId).catch((e: unknown) => {
        log.warn('[rbacIntegrityChecker] checkSectionPermissions failed', { error: String(e) })
        return [] as RBACIntegrityReport['section_permissions']
      }),
      detectPrivilegeEscalation(tenantId).catch((e: unknown) => {
        log.warn('[rbacIntegrityChecker] detectPrivilegeEscalation failed', { error: String(e) })
        return [] as RBACIntegrityReport['privilege_escalation_attempts']
      }),
      computeRoleDistribution(tenantId).catch((e: unknown) => {
        log.warn('[rbacIntegrityChecker] computeRoleDistribution failed', { error: String(e) })
        return [] as RBACIntegrityReport['role_distribution']
      }),
    ])

  const partial: Partial<RBACIntegrityReport> = {
    section_permissions,
    privilege_escalation_attempts,
  }

  const rbac_score = computeRBACScore(partial)
  const policies_active = section_permissions.filter((s) => s.rbac_policy_exists).length
  const policies_missing = section_permissions.filter((s) => !s.rbac_policy_exists).length

  const report: RBACIntegrityReport = {
    report_id,
    tenant_id: tenantId,
    section_permissions,
    privilege_escalation_attempts,
    role_distribution,
    rbac_score,
    policies_active,
    policies_missing,
    generated_at: new Date().toISOString(),
  }

  log.info('[rbacIntegrityChecker] completed', {
    report_id,
    rbac_score,
    policies_active,
    policies_missing,
    escalation_attempts: privilege_escalation_attempts.length,
  })

  return report
}
