// AGENCY GROUP — SH-ROS Recovery: recoverySnapshots | AMI: 22506
// Recovery state snapshots — point-in-time captures of runtime_events status
// distribution before and after recovery passes. Stored in learning_events.

import { supabaseAdmin } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RecoverySnapshot {
  snapshot_id: string
  org_id?: string
  type: 'pre_recovery' | 'post_recovery'
  event_count: number
  status_distribution: Record<string, number>
  created_at: string
  metadata: Record<string, unknown>
}

// ─── RecoverySnapshotStore ────────────────────────────────────────────────────

export class RecoverySnapshotStore {
  /**
   * Persist a recovery snapshot to learning_events.
   * Snapshots are immutable — once written they are never updated.
   */
  async save(snapshot: RecoverySnapshot): Promise<void> {
    try {
      await supabaseAdmin.from('learning_events').insert({
        event_type: 'recovery_snapshot',
        agent_email: 'system:recovery-snapshot-store',
        metadata: snapshot as unknown as Record<string, unknown>,
      })
    } catch (err) {
      console.warn('[RecoverySnapshotStore] save error:', err)
    }
  }

  /**
   * Load a specific snapshot by ID.
   * Scans learning_events for event_type='recovery_snapshot'.
   */
  async load(snapshot_id: string): Promise<RecoverySnapshot | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('learning_events')
        .select('metadata')
        .eq('event_type', 'recovery_snapshot')
        .order('created_at', { ascending: false })

      if (error) throw error

      for (const row of data ?? []) {
        const snap = (row as Record<string, unknown>).metadata as RecoverySnapshot
        if (snap?.snapshot_id === snapshot_id) return snap
      }

      return null
    } catch (err) {
      console.warn('[RecoverySnapshotStore] load error:', err)
      return null
    }
  }

  /**
   * List recent snapshots, optionally filtered by org.
   */
  async listRecent(org_id?: string, limit = 20): Promise<RecoverySnapshot[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('learning_events')
        .select('metadata, created_at')
        .eq('event_type', 'recovery_snapshot')
        .order('created_at', { ascending: false })
        .limit(limit * 3) // over-fetch to allow org filtering

      if (error) throw error

      const results = (data ?? [])
        .map((row) => (row as Record<string, unknown>).metadata as RecoverySnapshot)
        .filter((snap) => snap && (!org_id || snap.org_id === org_id))

      return results.slice(0, limit)
    } catch (err) {
      console.warn('[RecoverySnapshotStore] listRecent error:', err)
      return []
    }
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const recoverySnapshotStore = new RecoverySnapshotStore()
