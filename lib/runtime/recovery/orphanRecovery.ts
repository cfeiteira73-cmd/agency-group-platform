// AGENCY GROUP — SH-ROS Recovery: orphanRecovery | AMI: 22506
// Orphaned event recovery — detects and resets events stuck in 'processing'
// beyond a configurable threshold. Default: 5 minutes.

import { supabaseAdmin } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OrphanedEvent {
  event_id: string
  org_id: string
  type: string
  status: string
  stuck_since: string
  stuck_duration_ms: number
  correlation_id: string
}

export interface RecoveryAction {
  event_id: string
  action: 'reset_to_pending' | 'mark_failed' | 'requeue' | 'skip'
  success: boolean
  error?: string
}

// Events with retry_count >= this threshold are marked failed instead of reset
const FAILED_RETRY_THRESHOLD = 3
// Default: 5 minutes
const DEFAULT_THRESHOLD_MS = 5 * 60 * 1000

// ─── OrphanRecovery ───────────────────────────────────────────────────────────

export class OrphanRecovery {
  /**
   * Detect events stuck in 'processing' beyond threshold_ms.
   * Query: runtime_events WHERE status='processing' AND updated_at < now()-threshold
   */
  async detect(org_id?: string, threshold_ms = DEFAULT_THRESHOLD_MS): Promise<OrphanedEvent[]> {
    try {
      const cutoff = new Date(Date.now() - threshold_ms).toISOString()

      let query = supabaseAdmin
        .from('runtime_events')
        .select('event_id, org_id, type, status, updated_at, correlation_id, retry_count')
        .eq('status', 'processing')
        .lt('updated_at', cutoff)

      if (org_id) query = query.eq('org_id', org_id)

      const { data, error } = await query
      if (error) throw error

      const now = Date.now()

      return (data ?? []).map((row) => {
        const r = row as Record<string, unknown>
        const updatedAt = r.updated_at as string
        return {
          event_id: r.event_id as string,
          org_id: r.org_id as string,
          type: r.type as string,
          status: r.status as string,
          stuck_since: updatedAt,
          stuck_duration_ms: now - new Date(updatedAt).getTime(),
          correlation_id: (r.correlation_id as string) ?? '',
        }
      })
    } catch (err) {
      console.warn('[OrphanRecovery] detect error:', err)
      return []
    }
  }

  /**
   * Recover a single orphaned event.
   * - retry_count < FAILED_RETRY_THRESHOLD → reset_to_pending
   * - retry_count >= FAILED_RETRY_THRESHOLD → mark_failed (exhausted retries)
   */
  async recover(orphan: OrphanedEvent): Promise<RecoveryAction> {
    try {
      // Check current retry count
      const { data: current, error: fetchErr } = await supabaseAdmin
        .from('runtime_events')
        .select('retry_count')
        .eq('event_id', orphan.event_id)
        .single()

      if (fetchErr) throw fetchErr

      const retryCount = ((current as Record<string, unknown>).retry_count as number) ?? 0

      if (retryCount >= FAILED_RETRY_THRESHOLD) {
        // Exhausted retries — move to failed
        const { error } = await supabaseAdmin
          .from('runtime_events')
          .update({
            status: 'failed',
            updated_at: new Date().toISOString(),
            error_message: `Orphan recovery: exceeded ${FAILED_RETRY_THRESHOLD} retries`,
          } as Record<string, unknown>)
          .eq('event_id', orphan.event_id)

        if (error) throw error

        return { event_id: orphan.event_id, action: 'mark_failed', success: true }
      }

      // Reset to pending for retry
      const { error } = await supabaseAdmin
        .from('runtime_events')
        .update({
          status: 'pending',
          retry_count: retryCount + 1,
          updated_at: new Date().toISOString(),
          error_message: `Orphan recovery: reset after ${orphan.stuck_duration_ms}ms stuck`,
        } as Record<string, unknown>)
        .eq('event_id', orphan.event_id)

      if (error) throw error

      return { event_id: orphan.event_id, action: 'reset_to_pending', success: true }
    } catch (err) {
      const msg = String(err)
      console.warn('[OrphanRecovery] recover error for', orphan.event_id, ':', msg)
      return { event_id: orphan.event_id, action: 'skip', success: false, error: msg }
    }
  }

  /**
   * Detect and recover all orphaned events in one pass.
   * Returns all RecoveryActions attempted.
   */
  async recoverAll(org_id?: string, threshold_ms = DEFAULT_THRESHOLD_MS): Promise<RecoveryAction[]> {
    const orphans = await this.detect(org_id, threshold_ms)
    if (orphans.length === 0) return []

    const actions: RecoveryAction[] = []
    for (const orphan of orphans) {
      const action = await this.recover(orphan)
      actions.push(action)
    }

    return actions
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const orphanRecovery = new OrphanRecovery()
