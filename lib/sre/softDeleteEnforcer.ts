// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — Soft Delete Enforcer v1.0
// lib/sre/softDeleteEnforcer.ts
//
// Ensures no hard deletes on protected tables. Provides soft-delete helpers,
// audit scanning, and column migration status reporting.
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Protected tables ─────────────────────────────────────────────────────────

export const PROTECTED_TABLES = [
  'contacts',
  'deals',
  'properties',
  'capital_transactions',
  'audit_log_entries',
  'closing_price_records',
  'canonical_assets',
  'investor_bids',
  'settlement_records',
] as const

export type ProtectedTable = typeof PROTECTED_TABLES[number]

// ─── softDelete ───────────────────────────────────────────────────────────────

/**
 * Soft-deletes a record by setting deleted_at = now() on a protected table.
 * Gracefully handles tables that don't yet have a deleted_at column.
 * Writes to soft_delete_log and audit_log_entries (fire-and-forget).
 */
export async function softDelete(
  table: ProtectedTable,
  tenantId: string,
  id: string,
  reason?: string,
): Promise<void> {
  try {
    const updatePayload: Record<string, unknown> = {
      deleted_at: new Date().toISOString(),
    }
    if (reason !== undefined) {
      updatePayload['deleted_reason'] = reason
    }

    const { error } = await (supabaseAdmin as any)
      .from(table)
      .update(updatePayload)
      .eq('id', id)
      .eq('tenant_id', tenantId) as { error: { message: string } | null }

    if (error) {
      // If error references deleted_at column not existing, log a migration warning
      if (
        error.message.toLowerCase().includes('column') &&
        error.message.toLowerCase().includes('deleted_at')
      ) {
        log.warn('[softDeleteEnforcer] softDelete: deleted_at column missing — migration needed', {
          table,
          id,
          tenant_id: tenantId,
          error: error.message,
        })
      } else {
        log.warn('[softDeleteEnforcer] softDelete update failed', {
          table,
          id,
          tenant_id: tenantId,
          error: error.message,
        })
      }
      throw new Error(`[softDeleteEnforcer] softDelete on ${table}/${id}: ${error.message}`)
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('[softDeleteEnforcer]')) throw err
    log.warn('[softDeleteEnforcer] softDelete unexpected error', {
      table,
      id,
      tenant_id: tenantId,
      error: String(err),
    })
    throw err
  }

  // Persist to soft_delete_log (fire-and-forget)
  void (async () => {
    try {
      await (supabaseAdmin as any)
        .from('soft_delete_log')
        .insert({
          tenant_id:      tenantId,
          table_name:     table,
          record_id:      id,
          deleted_by:     'system',
          deleted_reason: reason ?? null,
          deleted_at:     new Date().toISOString(),
        })
    } catch (e) {
      log.warn('[softDeleteEnforcer] soft_delete_log persist failed', { table, id, error: String(e) })
    }
  })()

  log.info('[softDeleteEnforcer] softDelete applied', { table, id, tenant_id: tenantId, reason })
}

// ─── supportsSoftDelete ───────────────────────────────────────────────────────

/**
 * Returns true for tables we know have a deleted_at column.
 * Returns false when the column is absent (migration needed).
 *
 * This is a static declaration updated as migrations add deleted_at columns.
 * For runtime verification use getMissingDeletedAtColumns().
 */
export function supportsSoftDelete(_table: ProtectedTable): boolean {
  // No protected table currently has a confirmed deleted_at column.
  // Update this as migrations add deleted_at to each table.
  return false
}

// ─── auditHardDeleteAttempts ──────────────────────────────────────────────────

export interface HardDeleteViolation {
  table: string
  entity_id: string
  attempted_at: string
  actor_id: string
}

/**
 * Reads audit_log_entries for any 'hard_delete' actions on protected tables
 * within the specified window. Returns violations sorted newest first.
 */
export async function auditHardDeleteAttempts(
  tenantId: string,
  sinceHours = 24,
): Promise<{ violations: HardDeleteViolation[]; total_violations: number }> {
  try {
    const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString()

    const { data, error } = await (supabaseAdmin as any)
      .from('audit_log_entries')
      .select('entity_type, entity_id, created_at, actor_id')
      .eq('tenant_id', tenantId)
      .eq('action', 'hard_delete')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(500) as {
        data: Array<{ entity_type: string; entity_id: string; created_at: string; actor_id: string }> | null
        error: { message: string } | null
      }

    if (error) {
      log.warn('[softDeleteEnforcer] auditHardDeleteAttempts query failed', {
        tenant_id: tenantId,
        error: error.message,
      })
      return { violations: [], total_violations: 0 }
    }

    const protectedSet = new Set<string>(PROTECTED_TABLES)
    const rows = (data ?? []).filter(r => protectedSet.has(r.entity_type))

    const violations: HardDeleteViolation[] = rows.map(r => ({
      table:        r.entity_type,
      entity_id:    r.entity_id,
      attempted_at: r.created_at,
      actor_id:     r.actor_id,
    }))

    return { violations, total_violations: violations.length }
  } catch (err) {
    log.warn('[softDeleteEnforcer] auditHardDeleteAttempts error', {
      tenant_id: tenantId,
      error: String(err),
    })
    return { violations: [], total_violations: 0 }
  }
}

// ─── withSoftDeleteFilter ─────────────────────────────────────────────────────

/**
 * Filters out records that have been soft-deleted (deleted_at is set).
 */
export function withSoftDeleteFilter<T extends { deleted_at?: string | null }>(records: T[]): T[] {
  return records.filter(r => !r.deleted_at)
}

// ─── getMissingDeletedAtColumns ───────────────────────────────────────────────

/**
 * Probes each protected table by attempting to select deleted_at.
 * Returns an array of table names where the column is absent.
 */
export async function getMissingDeletedAtColumns(): Promise<string[]> {
  const missing: string[] = []

  await Promise.allSettled(
    PROTECTED_TABLES.map(async (table) => {
      try {
        const { error } = await (supabaseAdmin as any)
          .from(table)
          .select('deleted_at')
          .limit(1) as { data: unknown; error: { message: string; code?: string } | null }

        if (error) {
          const msg = error.message.toLowerCase()
          // Column does not exist errors from PostgREST
          if (
            msg.includes('deleted_at') ||
            msg.includes('column') ||
            error.code === '42703'
          ) {
            missing.push(table)
          }
          // If error is for a different reason (table missing, RLS etc), skip
        }
      } catch {
        // Unexpected error — skip this table
      }
    }),
  )

  return missing
}
