// AGENCY GROUP — SH-ROS Runtime Workflows: workflowRecovery | AMI: 22506
// Workflow-specific recovery — stuck detection, checkpoint recovery, orphan detection
// =============================================================================

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import logger from '@/lib/logger'
import { workflowEngine, type WorkflowHandle, type WorkflowStatus } from './workflowEngine'
import { workflowSnapshotStore } from './workflowSnapshots'
import { workflowRegistry } from './workflowRegistry'

// Default stuck threshold: 30 minutes
const DEFAULT_STUCK_THRESHOLD_MS = 30 * 60 * 1000

// ─── Recovery Engine ──────────────────────────────────────────────────────────

export class WorkflowRecoveryEngine {
  /**
   * Detect and recover stuck workflows.
   * A workflow is "stuck" if it has been in 'running' or 'paused' status
   * for longer than stuck_threshold_ms without any snapshot update.
   *
   * Returns the number of workflows recovered.
   */
  async recoverStuck(
    org_id?: string,
    stuck_threshold_ms = DEFAULT_STUCK_THRESHOLD_MS
  ): Promise<number> {
    const cutoff = new Date(Date.now() - stuck_threshold_ms).toISOString()

    // TENANT ISOLATION BUG FIX: Supabase query builder is IMMUTABLE — each chained
    // method returns a NEW object. The original `query.eq(...)` pattern silently drops
    // the tenant filter because the result is never assigned back.
    // SCHEMA FIX: learning_events uses 'tenant_id' UUID, NOT 'org_id' — verified by
    // DB schema audit (20260430_002_organizations_tenant_foundation.sql). Filtering on
    // 'org_id' silently returns 0 rows as the column does not exist.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabaseAdmin.from('learning_events') as any)
      .select('metadata, tenant_id, created_at')
      .eq('event_type', 'workflow_started')
      .lt('created_at', cutoff)

    if (org_id) {
      query = query.eq('tenant_id', org_id)   // ← MUST reassign (immutable builder)
    }

    const { data, error } = await query.order('created_at', { ascending: true }).limit(100)

    if (error) {
      logger.error('[WorkflowRecovery] Failed to query stuck workflows', { error })
      return 0
    }

    const stuckWorkflows = (data ?? []).filter((row: Record<string, unknown>) => {
      const meta = row['metadata'] as Record<string, unknown>
      const status = meta['status'] as string
      return status === 'running' || status === 'paused'
    })

    if (stuckWorkflows.length === 0) {
      logger.info('[WorkflowRecovery] No stuck workflows found', { org_id, cutoff })
      return 0
    }

    let recovered = 0

    for (const row of stuckWorkflows) {
      const meta = row.metadata as Record<string, unknown>
      const workflow_id = meta['workflow_id'] as string

      try {
        await this.recoverFromCheckpoint(workflow_id)
        recovered++
        logger.info('[WorkflowRecovery] Recovered stuck workflow', { workflow_id })
      } catch (err) {
        logger.error('[WorkflowRecovery] Failed to recover stuck workflow', {
          workflow_id,
          error: err instanceof Error ? err.message : String(err),
        })

        // Mark as failed after recovery attempt
        const { data: existing } = await supabaseAdmin
          .from('learning_events')
          .select('metadata')
          .eq('event_type', 'workflow_started')
          .contains('metadata', { workflow_id })
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (existing) {
          const existingMeta = existing.metadata as Record<string, unknown>
          await supabaseAdmin
            .from('learning_events')
            .update({
              metadata: {
                ...existingMeta,
                status: 'failed',
                error: 'Auto-recovery failed after stuck threshold',
                failed_at: new Date().toISOString(),
              },
            })
            .eq('event_type', 'workflow_started')
            .contains('metadata', { workflow_id })
        }
      }
    }

    logger.info('[WorkflowRecovery] Stuck workflow recovery complete', {
      total_stuck: stuckWorkflows.length,
      recovered,
    })

    return recovered
  }

  /**
   * Recover a workflow from its latest checkpoint (snapshot).
   * Creates a new workflow run that continues from the last saved state.
   */
  async recoverFromCheckpoint(workflow_id: string): Promise<WorkflowHandle> {
    let status: WorkflowStatus
    try {
      status = await workflowEngine.getStatus(workflow_id)
    } catch {
      throw new Error(`Workflow ${workflow_id} not found`)
    }

    const latestSnapshot = await workflowSnapshotStore.loadLatest(workflow_id)

    if (!latestSnapshot) {
      // No snapshot — can only restart from beginning
      logger.warn('[WorkflowRecovery] No snapshot found, attempting cold recovery', {
        workflow_id,
      })
    }

    const workflowName = (latestSnapshot?.state['workflow_name'] as string) ?? 'unknown'
    const def = workflowRegistry.get(workflowName)

    if (!def) {
      throw new Error(`Workflow definition '${workflowName}' not found — cannot recover`)
    }

    const recoveredInput: Record<string, unknown> = {
      ...(latestSnapshot?.state['input'] as Record<string, unknown> ?? {}),
      recovered_from: workflow_id,
      recovered_at: new Date().toISOString(),
      resume_from_step: latestSnapshot?.step_id ?? def.steps[0]?.id,
    }

    const defWithOrg = { ...def, org_id: status.org_id }
    const handle = await workflowEngine.startWorkflow(defWithOrg, recoveredInput)

    // Persist recovery audit record
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin.from('learning_events') as any).insert({
      event_type: 'workflow_recovered',
      org_id: status.org_id,
      metadata: {
        original_workflow_id: workflow_id,
        new_workflow_id: handle.workflow_id,
        new_run_id: handle.run_id,
        resume_from_step: latestSnapshot?.step_id ?? 'beginning',
        recovered_at: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    })

    logger.info('[WorkflowRecovery] Workflow recovered from checkpoint', {
      original_id: workflow_id,
      new_id: handle.workflow_id,
      resume_from: latestSnapshot?.step_id ?? 'beginning',
    })

    return handle
  }

  /**
   * Detect orphaned workflows — runs that are in 'running' state but have no
   * recent snapshot activity (likely died without proper error handling).
   */
  async detectOrphaned(org_id: string): Promise<string[]> {
    const orphan_threshold = new Date(Date.now() - DEFAULT_STUCK_THRESHOLD_MS).toISOString()

    // SCHEMA FIX: learning_events column is 'tenant_id' UUID, not 'org_id'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseAdmin.from('learning_events') as any)
      .select('metadata, created_at')
      .eq('event_type', 'workflow_started')
      .eq('tenant_id', org_id)
      .lt('created_at', orphan_threshold)
      .order('created_at', { ascending: false })
      .limit(200)

    if (error || !data) {
      logger.error('[WorkflowRecovery] detectOrphaned query failed', { error, org_id })
      return []
    }

    const runningWorkflows = data.filter((row: Record<string, unknown>) => {
      const meta = row['metadata'] as Record<string, unknown>
      return meta['status'] === 'running'
    })

    const orphaned: string[] = []

    for (const row of runningWorkflows) {
      const meta = row.metadata as Record<string, unknown>
      const workflow_id = meta['workflow_id'] as string

      // Check if there are any recent snapshots
      const { data: snapshotData } = await supabaseAdmin
        .from('learning_events')
        .select('created_at')
        .eq('event_type', 'workflow_snapshot')
        .contains('metadata', { workflow_id })
        .gt('created_at', orphan_threshold)
        .limit(1)

      const hasRecentActivity = snapshotData && snapshotData.length > 0

      if (!hasRecentActivity) {
        orphaned.push(workflow_id)
      }
    }

    if (orphaned.length > 0) {
      logger.warn('[WorkflowRecovery] Orphaned workflows detected', {
        org_id,
        count: orphaned.length,
        workflow_ids: orphaned.slice(0, 5),
      })
    }

    return orphaned
  }

  /**
   * Force-complete a stuck or broken workflow with a provided final state.
   * Use with caution — bypasses normal workflow logic.
   */
  async forceComplete(
    workflow_id: string,
    final_state: Record<string, unknown>
  ): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabaseAdmin.from('learning_events') as any)
      .select('metadata, org_id')
      .eq('event_type', 'workflow_started')
      .contains('metadata', { workflow_id })
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!data) {
      throw new Error(`Workflow ${workflow_id} not found for force-complete`)
    }

    const meta = data.metadata as Record<string, unknown>
    const now = new Date().toISOString()

    await supabaseAdmin
      .from('learning_events')
      .update({
        metadata: {
          ...meta,
          status: 'completed',
          completed_at: now,
          force_completed: true,
          final_state,
        },
      })
      .eq('event_type', 'workflow_started')
      .contains('metadata', { workflow_id })

    // Save final snapshot
    await workflowSnapshotStore.save(
      workflow_id,
      'force_complete',
      {
        ...final_state,
        org_id: data.org_id,
        forced_at: now,
        forced_by: 'WorkflowRecoveryEngine',
      }
    )

    // Persist audit
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin.from('learning_events') as any).insert({
      event_type: 'workflow_force_completed',
      org_id: data.org_id as string,
      metadata: {
        workflow_id,
        forced_at: now,
        final_state,
      },
      created_at: now,
    })

    logger.warn('[WorkflowRecovery] Workflow force-completed', { workflow_id, final_state })
  }
}

export const workflowRecoveryEngine = new WorkflowRecoveryEngine()
