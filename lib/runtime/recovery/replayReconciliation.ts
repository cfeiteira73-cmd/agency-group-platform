// AGENCY GROUP — SH-ROS Recovery: replayReconciliation | AMI: 22506
// Replay consistency — verifies that replayed events produce safe, consistent
// outcomes and detects conflicts between original and replayed execution.

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReplayVerification {
  matches: boolean
  differences: string[]
  safe_to_replay: boolean
}

export interface ReplayConflict {
  original_event_id: string
  replayed_event_id: string
  conflict_type: string
  detected_at: string
}

// Fields that must match between original and replay for a safe verification
const COMPARABLE_FIELDS: ReadonlyArray<string> = [
  'type',
  'org_id',
  'priority',
]

// ─── ReplayReconciliation ─────────────────────────────────────────────────────

export class ReplayReconciliation {
  /**
   * Verify a replay against the original event.
   * Checks that critical fields match and the replay is safe to execute.
   */
  async verifyReplay(
    original_event_id: string,
    replayed_event_id: string,
    org_id: string
  ): Promise<ReplayVerification> {
    const differences: string[] = []

    try {
      const [original, replayed] = await Promise.all([
        this._fetchEvent(original_event_id, org_id),
        this._fetchEvent(replayed_event_id, org_id),
      ])

      if (!original) {
        return {
          matches: false,
          differences: [`original event ${original_event_id} not found`],
          safe_to_replay: false,
        }
      }

      if (!replayed) {
        return {
          matches: false,
          differences: [`replayed event ${replayed_event_id} not found`],
          safe_to_replay: false,
        }
      }

      // Compare critical fields
      for (const field of COMPARABLE_FIELDS) {
        if (original[field] !== replayed[field]) {
          differences.push(`${field}: original="${original[field]}" replayed="${replayed[field]}"`)
        }
      }

      // A replay is safe if the original is in a terminal state (completed/failed/dlq)
      const originalStatus = original.status as string
      const isTerminal = ['completed', 'failed', 'dlq'].includes(originalStatus)

      // Check for duplicate completion — original completed but replay would re-trigger
      if (originalStatus === 'completed') {
        differences.push(`original already completed — replay may cause duplicate side effects`)
      }

      const matches = differences.length === 0
      const safe_to_replay = isTerminal && originalStatus !== 'completed'

      return { matches, differences, safe_to_replay }
    } catch (err) {
      console.warn('[ReplayReconciliation] verifyReplay error:', err)
      return {
        matches: false,
        differences: [`verification error: ${String(err)}`],
        safe_to_replay: false,
      }
    }
  }

  /**
   * Detect replay conflicts across all events for an org.
   * A conflict exists when two events share the same correlation_id but have
   * different types or contradictory statuses.
   */
  async detectReplayConflicts(org_id: string): Promise<ReplayConflict[]> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabaseAdmin as any
      const { data, error } = await sb
        .from('runtime_events')
        .select('event_id, correlation_id, type, status, timestamp')
        .eq('org_id', org_id)
        .not('correlation_id', 'is', null)
        .order('timestamp', { ascending: true })

      if (error) throw error

      // Group by correlation_id
      const byCorrelation = new Map<string, Array<Record<string, unknown>>>()
      for (const row of data ?? []) {
        const r = row as Record<string, unknown>
        const cid = r.correlation_id as string
        if (!byCorrelation.has(cid)) byCorrelation.set(cid, [])
        byCorrelation.get(cid)!.push(r)
      }

      const conflicts: ReplayConflict[] = []
      const detected_at = new Date().toISOString()

      for (const [, events] of byCorrelation) {
        if (events.length < 2) continue

        // Look for completed + pending/processing in the same correlation chain
        const statuses = events.map((e) => e.status as string)
        const hasCompleted = statuses.includes('completed')
        const hasPending = statuses.some((s) => ['pending', 'processing'].includes(s))

        if (hasCompleted && hasPending) {
          const original = events[0]
          const replayed = events[events.length - 1]
          conflicts.push({
            original_event_id: original.event_id as string,
            replayed_event_id: replayed.event_id as string,
            conflict_type: 'replay_of_completed_event',
            detected_at,
          })
        }

        // Look for type mismatch in same correlation chain
        const types = new Set(events.map((e) => e.type as string))
        if (types.size > 1) {
          const original = events[0]
          const replayed = events[events.length - 1]
          conflicts.push({
            original_event_id: original.event_id as string,
            replayed_event_id: replayed.event_id as string,
            conflict_type: `type_mismatch: ${[...types].join(' vs ')}`,
            detected_at,
          })
        }
      }

      return conflicts
    } catch (err) {
      console.warn('[ReplayReconciliation] detectReplayConflicts error:', err)
      return []
    }
  }

  /**
   * Resolve a replay conflict by marking the replayed event as failed
   * and logging the resolution to learning_events for audit.
   */
  async resolveConflict(conflict: ReplayConflict): Promise<void> {
    try {
      // Mark the replayed event as failed to prevent double execution
      await supabaseAdmin
        .from('runtime_events')
        .update({
          status: 'failed',
          updated_at: new Date().toISOString(),
          error_message: `Replay conflict resolved: ${conflict.conflict_type}`,
        } as Record<string, unknown>)
        .eq('event_id', conflict.replayed_event_id)

      // Audit log
      await supabaseAdmin.from('learning_events').insert({
        event_type: 'replay_conflict_resolved',
        agent_email: 'system:replay-reconciliation',
        metadata: {
          ...conflict,
          resolution: 'replayed_event_failed',
          resolution_id: randomUUID(),
        },
      })
    } catch (err) {
      console.warn('[ReplayReconciliation] resolveConflict error:', err)
    }
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async _fetchEvent(
    event_id: string,
    org_id: string
  ): Promise<Record<string, unknown> | null> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabaseAdmin as any
      const { data, error } = await sb
        .from('runtime_events')
        .select('event_id, org_id, type, status, priority, correlation_id, timestamp')
        .eq('event_id', event_id)
        .eq('org_id', org_id)
        .single()

      if (error || !data) return null
      return data as Record<string, unknown>
    } catch {
      return null
    }
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const replayReconciliation = new ReplayReconciliation()
