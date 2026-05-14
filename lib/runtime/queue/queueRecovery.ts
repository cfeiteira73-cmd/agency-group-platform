// AGENCY GROUP — SH-ROS Queue: queueRecovery | AMI: 22506
// Queue-level recovery — stuck messages, provider failover, integrity checks, DB reconciliation.

import { supabaseAdmin } from '@/lib/supabase'
import type { RuntimeEvent } from '@/lib/runtime/types'
import type { IQueueProvider } from './queueProvider'

// ─── Default stuck threshold ──────────────────────────────────────────────────

const DEFAULT_STUCK_THRESHOLD_MS = 5 * 60 * 1_000 // 5 minutes

// ─── QueueRecoveryEngine ──────────────────────────────────────────────────────

export class QueueRecoveryEngine {

  // ── recoverStuckMessages ───────────────────────────────────────────────────
  // Finds events in 'processing' status for longer than threshold and resets them to 'pending'.

  async recoverStuckMessages(org_id?: string, stuck_threshold_ms = DEFAULT_STUCK_THRESHOLD_MS): Promise<number> {
    try {
      const cutoff = new Date(Date.now() - stuck_threshold_ms).toISOString()

      let q = supabaseAdmin
        .from('runtime_events')
        .update({ status: 'pending', updated_at: new Date().toISOString() })
        .eq('status', 'processing')
        .lt('updated_at', cutoff)

      if (org_id) q = q.eq('org_id', org_id)

      const { data, error } = await q.select('event_id')
      if (error) throw error

      const count = (data as { event_id: string }[] | null)?.length ?? 0
      if (count > 0) {
        console.warn(`[QueueRecoveryEngine] Recovered ${count} stuck messages${org_id ? ` for org ${org_id}` : ''}`)
      }

      return count
    } catch (err) {
      console.error('[QueueRecoveryEngine] recoverStuckMessages error:', err)
      return 0
    }
  }

  // ── recoverFromProviderFailure ─────────────────────────────────────────────
  // Re-enqueues all pending/processing events via the fallback provider.

  async recoverFromProviderFailure(fallback_provider: IQueueProvider): Promise<number> {
    let recovered = 0

    try {
      const { data, error } = await supabaseAdmin
        .from('runtime_events')
        .select('*')
        .in('status', ['pending', 'processing'])
        .order('priority_weight', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(500)

      if (error) throw error
      if (!data || data.length === 0) return 0

      for (const row of data as Record<string, unknown>[]) {
        try {
          await fallback_provider.enqueue({
            event_id: row['event_id'] as string,
            org_id: row['org_id'] as string,
            type: row['type'] as RuntimeEvent['type'],
            timestamp: row['timestamp'] as string,
            correlation_id: row['correlation_id'] as string,
            priority: row['priority'] as RuntimeEvent['priority'],
            retry_count: (row['retry_count'] as number) ?? 0,
            payload: (row['payload'] as RuntimeEvent['payload']),
            metadata: (row['metadata'] as RuntimeEvent['metadata']),
          })
          recovered++
        } catch (enqErr) {
          console.error('[QueueRecoveryEngine] Failed to re-enqueue event:', row['event_id'], enqErr)
        }
      }

      console.warn(`[QueueRecoveryEngine] Provider failover recovery: ${recovered}/${data.length} events re-enqueued`)
    } catch (err) {
      console.error('[QueueRecoveryEngine] recoverFromProviderFailure error:', err)
    }

    return recovered
  }

  // ── validateQueueIntegrity ─────────────────────────────────────────────────

  async validateQueueIntegrity(org_id: string): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = []

    try {
      // 1. Check for duplicate event_ids
      const { data: dupeData, error: dupeErr } = await supabaseAdmin
        .from('runtime_events')
        .select('event_id')
        .eq('org_id', org_id)

      if (dupeErr) throw dupeErr

      const ids = (dupeData as { event_id: string }[] | null)?.map((r) => r.event_id) ?? []
      const uniqueIds = new Set(ids)
      if (ids.length !== uniqueIds.size) {
        issues.push(`Duplicate event_ids detected: ${ids.length - uniqueIds.size} duplicates`)
      }

      // 2. Check for events stuck in 'processing' > 5 minutes
      const stuckCutoff = new Date(Date.now() - DEFAULT_STUCK_THRESHOLD_MS).toISOString()
      const { count: stuckCount, error: stuckErr } = await supabaseAdmin
        .from('runtime_events')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', org_id)
        .eq('status', 'processing')
        .lt('updated_at', stuckCutoff)

      if (stuckErr) throw stuckErr
      if ((stuckCount ?? 0) > 0) {
        issues.push(`${stuckCount} events stuck in 'processing' status for > 5 minutes`)
      }

      // 3. Check for negative retry_count
      const { count: negRetryCount, error: negRetryErr } = await supabaseAdmin
        .from('runtime_events')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', org_id)
        .lt('retry_count', 0)

      if (negRetryErr) throw negRetryErr
      if ((negRetryCount ?? 0) > 0) {
        issues.push(`${negRetryCount} events have negative retry_count`)
      }

      // 4. Check for events with unknown status
      const validStatuses = ['pending', 'processing', 'completed', 'failed', 'dlq']
      const { data: statusData, error: statusErr } = await supabaseAdmin
        .from('runtime_events')
        .select('status')
        .eq('org_id', org_id)
        .not('status', 'in', `(${validStatuses.join(',')})`)
        .limit(10)

      if (statusErr) throw statusErr
      if (statusData && statusData.length > 0) {
        const unknownStatuses = [...new Set((statusData as { status: string }[]).map((r) => r.status))]
        issues.push(`Events with unknown status: ${unknownStatuses.join(', ')}`)
      }

    } catch (err) {
      console.error('[QueueRecoveryEngine] validateQueueIntegrity error:', err)
      issues.push(`Validation query failed: ${err instanceof Error ? err.message : String(err)}`)
    }

    return { valid: issues.length === 0, issues }
  }

  // ── reconcileWithDB ────────────────────────────────────────────────────────
  // Compares in-flight queue state with DB and resolves discrepancies.

  async reconcileWithDB(org_id: string): Promise<{ reconciled: number; discrepancies: number }> {
    let reconciled = 0
    let discrepancies = 0

    try {
      // Find events that are 'processing' but have no corresponding queue activity
      // (updated more than 2 minutes ago → likely orphaned)
      const cutoff = new Date(Date.now() - 2 * 60 * 1_000).toISOString()

      const { data, error } = await supabaseAdmin
        .from('runtime_events')
        .select('event_id, status, updated_at, retry_count')
        .eq('org_id', org_id)
        .eq('status', 'processing')
        .lt('updated_at', cutoff)

      if (error) throw error
      if (!data || data.length === 0) return { reconciled: 0, discrepancies: 0 }

      discrepancies = data.length

      // Reset to pending for reprocessing
      const ids = (data as { event_id: string }[]).map((r) => r.event_id)
      const { error: updateErr } = await supabaseAdmin
        .from('runtime_events')
        .update({ status: 'pending', updated_at: new Date().toISOString() })
        .in('event_id', ids)
        .eq('org_id', org_id)

      if (updateErr) throw updateErr

      reconciled = ids.length
      console.warn(`[QueueRecoveryEngine] Reconciled ${reconciled} orphaned processing events for org ${org_id}`)

    } catch (err) {
      console.error('[QueueRecoveryEngine] reconcileWithDB error:', err)
    }

    return { reconciled, discrepancies }
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const queueRecoveryEngine = new QueueRecoveryEngine()
