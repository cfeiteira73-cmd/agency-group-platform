// AGENCY GROUP — SH-ROS Runtime Workflows: workflowSnapshots | AMI: 22506
// Workflow state snapshots — backed by learning_events, tenant-isolated
// =============================================================================

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import logger from '@/lib/logger'
import type { WorkflowSnapshot } from './workflowEngine'

// ─── Store ────────────────────────────────────────────────────────────────────

export class WorkflowSnapshotStore {
  /**
   * Persist a workflow snapshot at a given step.
   * Stored in learning_events with event_type='workflow_snapshot'.
   */
  async save(
    workflow_id: string,
    step_id: string,
    state: Record<string, unknown>
  ): Promise<void> {
    const snapshot_id = randomUUID()
    const now = new Date().toISOString()

    // Extract org_id from state so we can set it on the event row for tenant isolation
    const org_id = (state['org_id'] as string) ?? 'unknown'

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseAdmin.from('learning_events') as any).insert({
      event_type: 'workflow_snapshot',
      org_id,
      metadata: {
        snapshot_id,
        workflow_id,
        step_id,
        state,
        saved_at: now,
      },
      created_at: now,
    })

    if (error) {
      logger.error('[WorkflowSnapshotStore] Failed to save snapshot', {
        error,
        workflow_id,
        step_id,
      })
      throw new Error(`Snapshot save failed: ${error.message}`)
    }

    logger.info('[WorkflowSnapshotStore] Snapshot saved', {
      snapshot_id,
      workflow_id,
      step_id,
    })
  }

  /**
   * Load all snapshots for a workflow, ordered chronologically.
   */
  async load(workflow_id: string): Promise<WorkflowSnapshot[]> {
    const { data, error } = await supabaseAdmin
      .from('learning_events')
      .select('metadata, created_at')
      .eq('event_type', 'workflow_snapshot')
      .contains('metadata', { workflow_id })
      .order('created_at', { ascending: true })

    if (error) {
      logger.error('[WorkflowSnapshotStore] Failed to load snapshots', { error, workflow_id })
      return []
    }

    return (data ?? []).map((row) => {
      const meta = row.metadata as Record<string, unknown>
      return {
        id: meta['snapshot_id'] as string,
        workflow_id,
        step_id: meta['step_id'] as string,
        state: (meta['state'] as Record<string, unknown>) ?? {},
        created_at: row.created_at as string,
      }
    })
  }

  /**
   * Load the most recent snapshot for a workflow.
   */
  async loadLatest(workflow_id: string): Promise<WorkflowSnapshot | null> {
    const { data, error } = await supabaseAdmin
      .from('learning_events')
      .select('metadata, created_at')
      .eq('event_type', 'workflow_snapshot')
      .contains('metadata', { workflow_id })
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) {
      return null
    }

    const meta = data.metadata as Record<string, unknown>
    return {
      id: meta['snapshot_id'] as string,
      workflow_id,
      step_id: meta['step_id'] as string,
      state: (meta['state'] as Record<string, unknown>) ?? {},
      created_at: data.created_at as string,
    }
  }

  /**
   * Prune old snapshots — keep only the last N for a given workflow.
   * Default: keep last 10 snapshots.
   */
  async prune(workflow_id: string, keep_last = 10): Promise<void> {
    const all = await this.load(workflow_id)

    if (all.length <= keep_last) return

    const to_delete = all.slice(0, all.length - keep_last)
    const snapshot_ids = to_delete.map((s) => s.id)

    for (const snapshot_id of snapshot_ids) {
      const { error } = await supabaseAdmin
        .from('learning_events')
        .delete()
        .eq('event_type', 'workflow_snapshot')
        .contains('metadata', { snapshot_id })

      if (error) {
        logger.warn('[WorkflowSnapshotStore] Failed to prune snapshot', {
          error,
          snapshot_id,
          workflow_id,
        })
      }
    }

    logger.info('[WorkflowSnapshotStore] Pruned snapshots', {
      workflow_id,
      pruned: to_delete.length,
      kept: keep_last,
    })
  }
}

export const workflowSnapshotStore = new WorkflowSnapshotStore()
