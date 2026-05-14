// AGENCY GROUP — SH-ROS Runtime Workflows: workflowReplay | AMI: 22506
// Workflow replay from snapshot — supports dry-run, from-step, from-beginning
// =============================================================================

import logger from '@/lib/logger'
import { workflowEngine, type WorkflowHandle } from './workflowEngine'
import { workflowSnapshotStore } from './workflowSnapshots'
import { workflowRegistry } from './workflowRegistry'

// ─── Replay Engine ────────────────────────────────────────────────────────────

export class WorkflowReplayEngine {
  /**
   * Replay a workflow from a specific step snapshot forward.
   * If from_step_id is omitted, replays from the latest snapshot.
   */
  async replayFromSnapshot(
    workflow_id: string,
    from_step_id?: string
  ): Promise<WorkflowHandle> {
    const validation = await this.validateReplayable(workflow_id)
    if (!validation.replayable) {
      throw new Error(`Workflow ${workflow_id} is not replayable: ${validation.reason}`)
    }

    const snapshots = await workflowSnapshotStore.load(workflow_id)
    if (snapshots.length === 0) {
      throw new Error(`No snapshots found for workflow ${workflow_id}`)
    }

    let targetSnapshot = snapshots[snapshots.length - 1]

    if (from_step_id) {
      const found = snapshots.find((s) => s.step_id === from_step_id)
      if (!found) {
        throw new Error(`Snapshot for step ${from_step_id} not found in workflow ${workflow_id}`)
      }
      targetSnapshot = found
    }

    const status = await workflowEngine.getStatus(workflow_id)
    const workflowName: string =
      (targetSnapshot.state['workflow_name'] as string) ?? 'unknown'

    const def = workflowRegistry.get(workflowName)
    if (!def) {
      throw new Error(`Workflow definition '${workflowName}' not found in registry`)
    }

    // Clone definition with org_id from snapshot state
    const orgId = (targetSnapshot.state['org_id'] as string) ?? status.org_id
    const defWithOrg = { ...def, org_id: orgId }

    logger.info('[WorkflowReplayEngine] Replaying from snapshot', {
      workflow_id,
      from_step_id: targetSnapshot.step_id,
      org_id: orgId,
    })

    const handle = await workflowEngine.startWorkflow(defWithOrg, {
      ...targetSnapshot.state,
      replayed_from: workflow_id,
      replay_from_step: targetSnapshot.step_id,
    })

    return handle
  }

  /**
   * Replay a workflow from the very beginning with original input.
   */
  async replayFromBeginning(workflow_id: string): Promise<WorkflowHandle> {
    const validation = await this.validateReplayable(workflow_id)
    if (!validation.replayable) {
      throw new Error(`Workflow ${workflow_id} is not replayable: ${validation.reason}`)
    }

    const status = await workflowEngine.getStatus(workflow_id)

    const snapshots = await workflowSnapshotStore.load(workflow_id)
    const firstSnapshot = snapshots[0]

    const workflowName: string =
      (firstSnapshot?.state['workflow_name'] as string) ?? 'unknown'

    const def = workflowRegistry.get(workflowName)
    if (!def) {
      throw new Error(`Workflow definition '${workflowName}' not found in registry`)
    }

    const originalInput = (firstSnapshot?.state['input'] as Record<string, unknown>) ?? {}
    const defWithOrg = { ...def, org_id: status.org_id }

    logger.info('[WorkflowReplayEngine] Replaying from beginning', {
      workflow_id,
      workflow_name: workflowName,
      org_id: status.org_id,
    })

    const handle = await workflowEngine.startWorkflow(defWithOrg, {
      ...originalInput,
      replayed_from: workflow_id,
      replay_mode: 'full',
    })

    return handle
  }

  /**
   * Dry-run replay — compute which steps would execute and estimate duration.
   * No side effects.
   */
  async dryRunReplay(
    workflow_id: string
  ): Promise<{ steps_to_replay: string[]; estimated_duration_ms: number }> {
    const snapshots = await workflowSnapshotStore.load(workflow_id)
    const latest = snapshots[snapshots.length - 1]

    if (!latest) {
      return { steps_to_replay: [], estimated_duration_ms: 0 }
    }

    const workflowName = (latest.state['workflow_name'] as string) ?? 'unknown'
    const def = workflowRegistry.get(workflowName)

    if (!def) {
      return { steps_to_replay: [], estimated_duration_ms: 0 }
    }

    const executed_step_ids = new Set(snapshots.map((s) => s.step_id))
    const steps_to_replay = def.steps
      .filter((s) => !executed_step_ids.has(s.id))
      .map((s) => s.id)

    const estimated_duration_ms = def.steps
      .filter((s) => steps_to_replay.includes(s.id))
      .reduce((sum, s) => sum + (s.timeout_ms ?? 30_000), 0)

    logger.info('[WorkflowReplayEngine] Dry run analysis', {
      workflow_id,
      steps_to_replay,
      estimated_duration_ms,
    })

    return { steps_to_replay, estimated_duration_ms }
  }

  /**
   * Validate whether a workflow can be replayed.
   */
  async validateReplayable(
    workflow_id: string
  ): Promise<{ replayable: boolean; reason?: string }> {
    let status
    try {
      status = await workflowEngine.getStatus(workflow_id)
    } catch {
      return { replayable: false, reason: 'Workflow not found' }
    }

    if (status.status === 'running') {
      return { replayable: false, reason: 'Workflow is currently running' }
    }

    if (status.status === 'awaiting_approval') {
      return { replayable: false, reason: 'Workflow is awaiting approval' }
    }

    const snapshots = await workflowSnapshotStore.load(workflow_id)
    if (snapshots.length === 0 && status.status !== 'failed') {
      return {
        replayable: false,
        reason: 'No snapshots available — workflow may not have persisted state',
      }
    }

    return { replayable: true }
  }
}

export const workflowReplayEngine = new WorkflowReplayEngine()
