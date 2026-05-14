// AGENCY GROUP — SH-ROS Learning: learningSnapshots | AMI: 22506
import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import type { AgentWeights } from './reinforcementWeights'
import type { AccuracyStats } from './outcomeTracking'
import type { ROIStats } from './roiOptimization'

export interface LearningSnapshot {
  snapshot_id: string
  org_id: string
  created_at: string
  agent_weights: Record<string, AgentWeights>
  accuracy_stats: Record<string, AccuracyStats>
  roi_stats: ROIStats | null
  description?: string
}

export class LearningSnapshotStore {
  async save(org_id: string, description?: string): Promise<LearningSnapshot> {
    const snapshot_id = randomUUID()
    const snapshot: LearningSnapshot = {
      snapshot_id, org_id,
      created_at:    new Date().toISOString(),
      agent_weights: {},
      accuracy_stats: {},
      roi_stats:     null,
      description,
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabaseAdmin.from('learning_events') as any).insert({
        event_type:    'learning_snapshot',
        source_system: 'agent',
        metadata:      snapshot,
      })
    } catch (err) {
      console.warn('[LearningSnapshotStore] save failed:', err instanceof Error ? err.message : String(err))
    }

    return snapshot
  }

  async load(snapshot_id: string, org_id: string): Promise<LearningSnapshot | null> {
    try {
      const { data } = await supabaseAdmin
        .from('learning_events')
        .select('metadata')
        .eq('event_type', 'learning_snapshot')
        .limit(500)

      const match = (data ?? []).find(r =>
        (r.metadata as Record<string, unknown> | null)?.snapshot_id === snapshot_id &&
        (r.metadata as Record<string, unknown>)?.org_id === org_id,
      )
      return match ? (match.metadata as unknown as LearningSnapshot) : null
    } catch { return null }
  }

  async listSnapshots(org_id: string): Promise<LearningSnapshot[]> {
    try {
      const since = new Date(Date.now() - 365 * 86_400_000).toISOString()
      const { data } = await supabaseAdmin
        .from('learning_events')
        .select('metadata, created_at')
        .eq('event_type', 'learning_snapshot')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(50)

      return (data ?? [])
        .filter(r => (r.metadata as Record<string, unknown> | null)?.org_id === org_id)
        .map(r => r.metadata as unknown as LearningSnapshot)
    } catch { return [] }
  }

  async rollback(snapshot_id: string, org_id: string): Promise<void> {
    const snapshot = await this.load(snapshot_id, org_id)
    if (!snapshot) throw new Error(`Snapshot ${snapshot_id} not found for org ${org_id}`)

    try {
      // Log rollback as auditable learning change
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabaseAdmin.from('learning_events') as any).insert({
        event_type:    'learning_change',
        source_system: 'agent',
        metadata:      {
          change_id: randomUUID(), org_id,
          type:           'snapshot_restore',
          reason:         `Rollback to snapshot ${snapshot_id}`,
          changed_by:     'system',
          auto_approved:  false,
          timestamp:      new Date().toISOString(),
          before:         {},
          after:          snapshot,
        },
      })
    } catch (err) {
      console.warn('[LearningSnapshotStore] rollback log failed:', err instanceof Error ? err.message : String(err))
    }
  }
}

export const learningSnapshotStore = new LearningSnapshotStore()
