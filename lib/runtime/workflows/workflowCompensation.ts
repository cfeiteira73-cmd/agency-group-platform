// AGENCY GROUP — SH-ROS Runtime Workflows: workflowCompensation | AMI: 22506
// Saga compensation — runs rollback steps in reverse order on failure
// =============================================================================

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import logger from '@/lib/logger'
import { workflowEngine, type WorkflowContext } from './workflowEngine'
import { workflowSnapshotStore } from './workflowSnapshots'
import { workflowRegistry } from './workflowRegistry'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CompensationResult {
  workflow_id: string
  compensated_steps: string[]
  failed_compensation_steps: string[]
  completed_at: string
}

// ─── Engine ───────────────────────────────────────────────────────────────────

export class WorkflowCompensationEngine {
  private readonly customHandlers = new Map<
    string,
    (ctx: WorkflowContext) => Promise<void>
  >()

  /**
   * Register a custom compensation handler for a step_id.
   * Overrides the compensation_steps from the workflow definition.
   */
  registerCompensation(
    step_id: string,
    handler: (ctx: WorkflowContext) => Promise<void>
  ): void {
    this.customHandlers.set(step_id, handler)
    logger.info('[WorkflowCompensation] Custom handler registered', { step_id })
  }

  /**
   * Compensate a failed workflow using the saga pattern.
   * Runs compensation steps in reverse order from the failed step.
   */
  async compensate(
    workflow_id: string,
    failed_step_id: string,
    error: Error
  ): Promise<CompensationResult> {
    const compensated_steps: string[] = []
    const failed_compensation_steps: string[] = []
    const now = new Date().toISOString()

    logger.info('[WorkflowCompensation] Starting saga compensation', {
      workflow_id,
      failed_step_id,
      error: error.message,
    })

    // 1. Retrieve workflow status to get org_id
    let status
    try {
      status = await workflowEngine.getStatus(workflow_id)
    } catch (err) {
      logger.error('[WorkflowCompensation] Cannot get workflow status', {
        workflow_id,
        err,
      })
      return {
        workflow_id,
        compensated_steps: [],
        failed_compensation_steps: [],
        completed_at: now,
      }
    }

    // 2. Load snapshots to reconstruct execution state
    const snapshots = await workflowSnapshotStore.load(workflow_id)
    const latestState =
      snapshots[snapshots.length - 1]?.state ?? {}

    // 3. Determine workflow name from state
    const workflowName = (latestState['workflow_name'] as string) ?? 'unknown'
    const def = workflowRegistry.get(workflowName)

    if (!def) {
      logger.error('[WorkflowCompensation] Workflow definition not found', {
        workflowName,
        workflow_id,
      })
      return {
        workflow_id,
        compensated_steps: [],
        failed_compensation_steps: [failed_step_id],
        completed_at: now,
      }
    }

    // 4. Determine which steps ran (in order) before failure
    const executed_step_ids = snapshots.map((s) => s.step_id)
    const failed_step_index = def.steps.findIndex((s) => s.id === failed_step_id)
    const steps_to_compensate = executed_step_ids
      .filter((sid) => {
        const idx = def.steps.findIndex((s) => s.id === sid)
        return idx >= 0 && idx < failed_step_index
      })
      .reverse() // Reverse order = saga rollback

    // 5. Build context for compensation
    const emittedEvents: Array<{ type: string; payload: Record<string, unknown> }> = []
    const compensationCtx: WorkflowContext = {
      workflow_id,
      org_id: status.org_id,
      correlation_id: randomUUID(),
      step_id: 'compensation',
      input: latestState['input'] as Record<string, unknown> ?? {},
      state: { ...latestState },
      emit(event_type: string, payload: Record<string, unknown>) {
        emittedEvents.push({ type: event_type, payload })
      },
    }

    // 6. Run compensation_steps from definition (reversed) for each executed step
    const compensationSteps = def.compensation_steps ?? []

    for (const step_id of steps_to_compensate) {
      // Check for custom handler first
      const customHandler = this.customHandlers.get(step_id)

      // Find matching compensation step from definition
      const defCompensationStep = compensationSteps.find((cs) =>
        cs.id.includes(step_id) || cs.id === `rollback_${step_id}`
      )

      const handlerToRun = customHandler
        ? async () => { await customHandler({ ...compensationCtx, step_id }) }
        : defCompensationStep
          ? async () => { await defCompensationStep.handler({ ...compensationCtx, step_id: defCompensationStep.id }) }
          : null

      if (!handlerToRun) {
        logger.warn('[WorkflowCompensation] No compensation handler for step', {
          step_id,
          workflow_id,
        })
        continue
      }

      try {
        await handlerToRun()
        compensated_steps.push(step_id)
        logger.info('[WorkflowCompensation] Step compensated', { step_id, workflow_id })
      } catch (compErr) {
        failed_compensation_steps.push(step_id)
        logger.error('[WorkflowCompensation] Compensation step failed', {
          step_id,
          workflow_id,
          error: compErr instanceof Error ? compErr.message : String(compErr),
        })
      }
    }

    // 7. Persist compensation result
    const completed_at = new Date().toISOString()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin.from('learning_events') as any).insert({
      event_type: 'workflow_compensation_complete',
      org_id: status.org_id,
      metadata: {
        workflow_id,
        failed_step_id,
        original_error: error.message,
        compensated_steps,
        failed_compensation_steps,
        emitted_events: emittedEvents,
        completed_at,
      },
      created_at: completed_at,
    })

    logger.info('[WorkflowCompensation] Saga compensation complete', {
      workflow_id,
      compensated: compensated_steps.length,
      failed: failed_compensation_steps.length,
    })

    return {
      workflow_id,
      compensated_steps,
      failed_compensation_steps,
      completed_at,
    }
  }
}

export const workflowCompensationEngine = new WorkflowCompensationEngine()
