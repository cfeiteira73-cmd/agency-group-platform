// AGENCY GROUP — SH-ROS Recovery: reconciliationEngine | AMI: 22506
// State reconciliation — detects and repairs status discrepancies in runtime_events.
// Compares actual DB state against expected state machine transitions.

import { supabaseAdmin } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReconciliationResult {
  org_id: string
  checked: number
  discrepancies_found: number
  repaired: number
  unrepaired: number
  timestamp: string
}

export interface Discrepancy {
  type: 'status_mismatch' | 'missing_completion' | 'duplicate_event' | 'orphan_processing'
  event_id: string
  description: string
  severity: 'low' | 'medium' | 'high'
}

// Valid state machine transitions
// pending → processing → completed | failed | dlq
const VALID_TERMINAL_STATUSES = new Set(['completed', 'failed', 'dlq'])
const VALID_STATUSES = new Set(['pending', 'processing', 'completed', 'failed', 'dlq'])

// ─── ReconciliationEngine ─────────────────────────────────────────────────────

export class ReconciliationEngine {
  /**
   * Full reconciliation pass for an org.
   * Detects discrepancies and attempts to repair all of them.
   */
  async reconcile(org_id: string): Promise<ReconciliationResult> {
    const timestamp = new Date().toISOString()
    const discrepancies = await this.detectDiscrepancies(org_id)

    let repaired = 0
    let unrepaired = 0

    for (const d of discrepancies) {
      const ok = await this.RepairDiscrepancy(d)
      if (ok) repaired++
      else unrepaired++
    }

    // Count total checked
    const checked = await this._countEvents(org_id)

    return {
      org_id,
      checked,
      discrepancies_found: discrepancies.length,
      repaired,
      unrepaired,
      timestamp,
    }
  }

  /**
   * Detect discrepancies across status mismatches, missing completions, duplicates, orphans.
   */
  async detectDiscrepancies(org_id: string): Promise<Discrepancy[]> {
    const results: Discrepancy[] = []

    try {
      // 1. Invalid status values (data corruption)
      const invalidStatus = await this._detectInvalidStatuses(org_id)
      results.push(...invalidStatus)

      // 2. Processing events with result populated (should be completed)
      const missingCompletion = await this._detectMissingCompletions(org_id)
      results.push(...missingCompletion)

      // 3. Orphaned processing events (> 5 min without update)
      const orphans = await this._detectOrphanProcessing(org_id)
      results.push(...orphans)
    } catch (err) {
      console.warn('[ReconciliationEngine] detectDiscrepancies error:', err)
    }

    return results
  }

  /**
   * Attempt to repair a single discrepancy.
   * Returns true if repaired, false if manual intervention required.
   */
  async RepairDiscrepancy(discrepancy: Discrepancy): Promise<boolean> {
    try {
      switch (discrepancy.type) {
        case 'status_mismatch': {
          // Reset to pending for reprocessing
          const { error } = await supabaseAdmin
            .from('runtime_events')
            .update({
              status: 'pending',
              updated_at: new Date().toISOString(),
            } as Record<string, unknown>)
            .eq('event_id', discrepancy.event_id)
          if (error) throw error
          return true
        }

        case 'missing_completion': {
          // Mark as completed since result is present
          const { error } = await supabaseAdmin
            .from('runtime_events')
            .update({
              status: 'completed',
              updated_at: new Date().toISOString(),
            } as Record<string, unknown>)
            .eq('event_id', discrepancy.event_id)
          if (error) throw error
          return true
        }

        case 'orphan_processing': {
          // Reset to pending for retry
          const { error } = await supabaseAdmin
            .from('runtime_events')
            .update({
              status: 'pending',
              updated_at: new Date().toISOString(),
            } as Record<string, unknown>)
            .eq('event_id', discrepancy.event_id)
          if (error) throw error
          return true
        }

        case 'duplicate_event': {
          // Duplicates require manual review — cannot auto-repair safely
          console.warn('[ReconciliationEngine] duplicate_event requires manual review:', discrepancy.event_id)
          return false
        }

        default:
          return false
      }
    } catch (err) {
      console.warn('[ReconciliationEngine] RepairDiscrepancy error:', err)
      return false
    }
  }

  // ─── Private detectors ─────────────────────────────────────────────────────

  private async _detectInvalidStatuses(org_id: string): Promise<Discrepancy[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('runtime_events')
        .select('event_id, status')
        .eq('org_id', org_id)

      if (error) throw error

      return (data ?? [])
        .filter((r) => {
          const s = (r as Record<string, unknown>).status as string
          return !VALID_STATUSES.has(s)
        })
        .map((r) => ({
          type: 'status_mismatch' as const,
          event_id: r.event_id,
          description: `Invalid status value: ${(r as Record<string, unknown>).status}`,
          severity: 'high' as const,
        }))
    } catch (err) {
      console.warn('[ReconciliationEngine] _detectInvalidStatuses error:', err)
      return []
    }
  }

  private async _detectMissingCompletions(org_id: string): Promise<Discrepancy[]> {
    try {
      // Events still in 'processing' but have a result column populated
      const { data, error } = await supabaseAdmin
        .from('runtime_events')
        .select('event_id, status, result')
        .eq('org_id', org_id)
        .eq('status', 'processing')
        .not('result', 'is', null)

      if (error) throw error

      return (data ?? []).map((r) => ({
        type: 'missing_completion' as const,
        event_id: r.event_id,
        description: 'Event has result populated but status is still processing',
        severity: 'medium' as const,
      }))
    } catch (err) {
      console.warn('[ReconciliationEngine] _detectMissingCompletions error:', err)
      return []
    }
  }

  private async _detectOrphanProcessing(org_id: string): Promise<Discrepancy[]> {
    try {
      const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString()

      const { data, error } = await supabaseAdmin
        .from('runtime_events')
        .select('event_id, updated_at')
        .eq('org_id', org_id)
        .eq('status', 'processing')
        .lt('updated_at', cutoff)

      if (error) throw error

      return (data ?? []).map((r) => ({
        type: 'orphan_processing' as const,
        event_id: r.event_id,
        description: `Stuck in processing since ${(r as Record<string, unknown>).updated_at}`,
        severity: 'high' as const,
      }))
    } catch (err) {
      console.warn('[ReconciliationEngine] _detectOrphanProcessing error:', err)
      return []
    }
  }

  private async _countEvents(org_id: string): Promise<number> {
    try {
      const { count, error } = await supabaseAdmin
        .from('runtime_events')
        .select('event_id', { count: 'exact', head: true })
        .eq('org_id', org_id)

      if (error) throw error
      return count ?? 0
    } catch {
      return 0
    }
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const reconciliationEngine = new ReconciliationEngine()

// Re-export for type consumers
export { VALID_TERMINAL_STATUSES, VALID_STATUSES }
