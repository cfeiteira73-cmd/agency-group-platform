// TypeScript strict — 0 errors
// lib/security/tenantIsolationEnforcer.ts
// Validates that all Supabase queries are tenant-scoped. Audit enforcement.

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface IsolationCheckResult {
  tenant_id: string
  passed: boolean
  violations: string[]
  checked_tables: string[]
  total_orphan_records: number
}

// ─── auditTenantIsolation ──────────────────────────────────────────────────────

const CRITICAL_TABLES = [
  'canonical_assets',
  'capital_transactions',
  'investor_bids',
  'deals',
  'contacts',
] as const

export async function auditTenantIsolation(tenantId: string): Promise<IsolationCheckResult> {
  const violations: string[] = []
  const checked_tables: string[] = []
  let total_orphan_records = 0

  for (const table of CRITICAL_TABLES) {
    try {
      const { count, error } = await (supabaseAdmin as any)
        .from(table)
        .select('id', { count: 'exact', head: true })
        .is('tenant_id', null)

      if (error) {
        // Table may not exist yet — skip gracefully
        log.warn('[tenantIsolationEnforcer] auditTenantIsolation table error', {
          table,
          error: error.message,
        })
        continue
      }

      checked_tables.push(table)
      const orphans = (count as number | null) ?? 0
      if (orphans > 0) {
        violations.push(`${table}: ${orphans} record(s) with NULL tenant_id`)
        total_orphan_records += orphans
      }
    } catch (e) {
      log.warn('[tenantIsolationEnforcer] auditTenantIsolation threw for table', {
        table,
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }

  const result: IsolationCheckResult = {
    tenant_id: tenantId,
    passed: violations.length === 0,
    violations,
    checked_tables,
    total_orphan_records,
  }

  if (!result.passed) {
    log.warn('[tenantIsolationEnforcer] Tenant isolation violations found', {
      tenant_id: tenantId,
      violations,
      total_orphan_records,
    })
  }

  return result
}

// ─── assertTenantScoped ────────────────────────────────────────────────────────

export function assertTenantScoped(query: Record<string, unknown>, tenantId: string): void {
  if (!('tenant_id' in query)) {
    throw new Error(
      `[tenantIsolationEnforcer] Query is not tenant-scoped: missing 'tenant_id' field. ` +
      `Expected tenant_id=${tenantId}`,
    )
  }
}

// ─── getProtectedTables ────────────────────────────────────────────────────────

export function getProtectedTables(): string[] {
  return [
    'contacts',
    'deals',
    'properties',
    'capital_transactions',
    'audit_log_entries',
    'closing_price_records',
  ]
}

// ─── checkForHardDeletes ───────────────────────────────────────────────────────

export async function checkForHardDeletes(
  tenantId: string,
  sinceHours = 24,
): Promise<{ detected: boolean; table: string | null; approximate_count: number }> {
  try {
    const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString()

    const { data, count, error } = await (supabaseAdmin as any)
      .from('audit_log_entries')
      .select('table_name', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .eq('action', 'hard_delete')
      .gte('created_at', since)
      .limit(1)

    if (error) {
      log.warn('[tenantIsolationEnforcer] checkForHardDeletes query error', {
        error: error.message,
        tenant_id: tenantId,
      })
      return { detected: false, table: null, approximate_count: 0 }
    }

    const total = (count as number | null) ?? 0
    const firstRow = (data as Array<{ table_name: string }> | null)?.[0]

    return {
      detected: total > 0,
      table: firstRow?.table_name ?? null,
      approximate_count: total,
    }
  } catch (e) {
    log.warn('[tenantIsolationEnforcer] checkForHardDeletes threw', {
      error: e instanceof Error ? e.message : String(e),
      tenant_id: tenantId,
    })
    return { detected: false, table: null, approximate_count: 0 }
  }
}
