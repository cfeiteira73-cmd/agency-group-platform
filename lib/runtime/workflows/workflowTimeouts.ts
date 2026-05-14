// AGENCY GROUP — SH-ROS Runtime Workflows: workflowTimeouts | AMI: 22506
// Workflow timeout management — step and workflow-level timeout tracking
// =============================================================================

import logger from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TimeoutEntry {
  timeout_ms: number
  started_at: number // Unix ms
  timer?: ReturnType<typeof setTimeout>
}

interface WorkflowTimeoutRecord {
  workflow_id: string
  workflow_started_at: number
  workflow_timeout?: TimeoutEntry
  step_timeouts: Map<string, TimeoutEntry>
  callbacks: Array<(step_id?: string) => void>
}

export interface TimeoutStatus {
  workflow_id: string
  step_timeouts: Record<string, number>
  workflow_timeout?: number
  elapsed_ms: number
}

// ─── Manager ─────────────────────────────────────────────────────────────────

export class WorkflowTimeoutManager {
  private readonly records = new Map<string, WorkflowTimeoutRecord>()

  private getOrCreate(workflow_id: string): WorkflowTimeoutRecord {
    if (!this.records.has(workflow_id)) {
      this.records.set(workflow_id, {
        workflow_id,
        workflow_started_at: Date.now(),
        step_timeouts: new Map(),
        callbacks: [],
      })
    }
    return this.records.get(workflow_id)!
  }

  /**
   * Set a timeout for a specific step within a workflow.
   * Fires all registered callbacks with the step_id on expiry.
   */
  setStepTimeout(workflow_id: string, step_id: string, timeout_ms: number): void {
    const record = this.getOrCreate(workflow_id)
    const started_at = Date.now()

    // Clear any existing timer for this step
    this.clearStepTimeout(workflow_id, step_id)

    const timer = setTimeout(() => {
      logger.warn('[WorkflowTimeoutManager] Step timeout fired', {
        workflow_id,
        step_id,
        timeout_ms,
      })
      record.callbacks.forEach((cb) => {
        try {
          cb(step_id)
        } catch (err) {
          logger.error('[WorkflowTimeoutManager] Callback error on step timeout', { err, step_id })
        }
      })
    }, timeout_ms)

    record.step_timeouts.set(step_id, { timeout_ms, started_at, timer })

    logger.info('[WorkflowTimeoutManager] Step timeout set', {
      workflow_id,
      step_id,
      timeout_ms,
    })
  }

  /**
   * Clear a step timeout before it fires (e.g. step completed successfully).
   */
  clearStepTimeout(workflow_id: string, step_id: string): void {
    const record = this.records.get(workflow_id)
    if (!record) return

    const entry = record.step_timeouts.get(step_id)
    if (entry?.timer) {
      clearTimeout(entry.timer)
    }
    record.step_timeouts.delete(step_id)

    logger.info('[WorkflowTimeoutManager] Step timeout cleared', { workflow_id, step_id })
  }

  /**
   * Set a global timeout for the entire workflow.
   * Fires callbacks with no step_id on expiry.
   */
  setWorkflowTimeout(workflow_id: string, timeout_ms: number): void {
    const record = this.getOrCreate(workflow_id)

    // Clear existing workflow timeout if any
    if (record.workflow_timeout?.timer) {
      clearTimeout(record.workflow_timeout.timer)
    }

    const started_at = Date.now()

    const timer = setTimeout(() => {
      logger.warn('[WorkflowTimeoutManager] Workflow-level timeout fired', {
        workflow_id,
        timeout_ms,
      })
      record.callbacks.forEach((cb) => {
        try {
          cb(undefined)
        } catch (err) {
          logger.error('[WorkflowTimeoutManager] Callback error on workflow timeout', {
            err,
            workflow_id,
          })
        }
      })
    }, timeout_ms)

    record.workflow_timeout = { timeout_ms, started_at, timer }

    logger.info('[WorkflowTimeoutManager] Workflow timeout set', {
      workflow_id,
      timeout_ms,
    })
  }

  /**
   * Get current timeout status for a workflow.
   */
  getTimeoutStatus(workflow_id: string): TimeoutStatus {
    const record = this.records.get(workflow_id)
    if (!record) {
      return {
        workflow_id,
        step_timeouts: {},
        elapsed_ms: 0,
      }
    }

    const elapsed_ms = Date.now() - record.workflow_started_at

    const step_timeouts: Record<string, number> = {}
    for (const [step_id, entry] of record.step_timeouts.entries()) {
      const remaining = entry.timeout_ms - (Date.now() - entry.started_at)
      step_timeouts[step_id] = Math.max(0, remaining)
    }

    let workflow_timeout: number | undefined
    if (record.workflow_timeout) {
      const remaining = record.workflow_timeout.timeout_ms - elapsed_ms
      workflow_timeout = Math.max(0, remaining)
    }

    return {
      workflow_id,
      step_timeouts,
      workflow_timeout,
      elapsed_ms,
    }
  }

  /**
   * Register a callback to fire when any timeout (step or workflow) expires.
   * Callback receives step_id if a step timed out, undefined if the whole workflow timed out.
   */
  onTimeout(workflow_id: string, callback: (step_id?: string) => void): void {
    const record = this.getOrCreate(workflow_id)
    record.callbacks.push(callback)
  }

  /**
   * Clean up all timers for a workflow (call on completion or cancellation).
   */
  cleanup(workflow_id: string): void {
    const record = this.records.get(workflow_id)
    if (!record) return

    // Clear all step timers
    for (const entry of record.step_timeouts.values()) {
      if (entry.timer) clearTimeout(entry.timer)
    }

    // Clear workflow timer
    if (record.workflow_timeout?.timer) {
      clearTimeout(record.workflow_timeout.timer)
    }

    this.records.delete(workflow_id)

    logger.info('[WorkflowTimeoutManager] Cleaned up timers', { workflow_id })
  }
}

export const workflowTimeoutManager = new WorkflowTimeoutManager()
