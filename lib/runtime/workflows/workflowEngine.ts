// AGENCY GROUP — SH-ROS Runtime Workflows: workflowEngine | AMI: 22506
// Core workflow engine abstraction — factory returns Temporal or DB provider
// =============================================================================

import { randomUUID } from 'crypto'

// ─── Core Types ───────────────────────────────────────────────────────────────

export interface WorkflowHandle {
  workflow_id: string
  run_id: string
  org_id: string
  started_at: string
}

export interface WorkflowSnapshot {
  id: string
  workflow_id: string
  step_id: string
  state: Record<string, unknown>
  created_at: string
}

export interface WorkflowStatus {
  workflow_id: string
  run_id: string
  org_id: string
  status: 'running' | 'paused' | 'completed' | 'failed' | 'cancelled' | 'awaiting_approval'
  started_at: string
  completed_at?: string
  current_step?: string
  error?: string
  snapshots: WorkflowSnapshot[]
}

export interface WorkflowContext {
  workflow_id: string
  org_id: string
  correlation_id: string
  step_id: string
  input: Record<string, unknown>
  state: Record<string, unknown>
  emit(event_type: string, payload: Record<string, unknown>): void
}

export interface WorkflowStep {
  id: string
  name: string
  handler: (ctx: WorkflowContext) => Promise<unknown>
  timeout_ms?: number
  retry_count?: number
}

export interface WorkflowDefinition {
  name: string
  version: string
  org_id: string
  steps: WorkflowStep[]
  compensation_steps?: WorkflowStep[]
  timeout_ms?: number
  requires_approval?: boolean
}

// ─── Engine Interface ─────────────────────────────────────────────────────────

export interface IWorkflowEngine {
  startWorkflow(def: WorkflowDefinition, input: Record<string, unknown>): Promise<WorkflowHandle>
  pauseWorkflow(workflow_id: string): Promise<void>
  resumeWorkflow(workflow_id: string, signal?: Record<string, unknown>): Promise<void>
  cancelWorkflow(workflow_id: string, reason: string): Promise<void>
  getStatus(workflow_id: string): Promise<WorkflowStatus>
  listActive(org_id: string, limit?: number): Promise<WorkflowStatus[]>
  replay(workflow_id: string): Promise<void>
}

// ─── DB-backed Provider (default when TEMPORAL_ADDRESS is not set) ─────────────

import { supabaseAdmin } from '@/lib/supabase'
import logger from '@/lib/logger'

class DBWorkflowProvider implements IWorkflowEngine {
  async startWorkflow(
    def: WorkflowDefinition,
    input: Record<string, unknown>
  ): Promise<WorkflowHandle> {
    const workflow_id = randomUUID()
    const run_id = randomUUID()
    const started_at = new Date().toISOString()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseAdmin.from('learning_events') as any).insert({
      event_type: 'workflow_started',
      org_id: def.org_id,
      metadata: {
        workflow_id,
        run_id,
        workflow_name: def.name,
        workflow_version: def.version,
        status: 'running',
        current_step: def.steps[0]?.id ?? null,
        started_at,
        input,
        requires_approval: def.requires_approval ?? false,
      },
      created_at: started_at,
    })

    if (error) {
      logger.error('[WorkflowEngine] Failed to persist workflow start', { error, workflow_id })
      throw new Error(`Failed to start workflow: ${error.message}`)
    }

    logger.info('[WorkflowEngine] Workflow started', {
      workflow_id,
      name: def.name,
      org_id: def.org_id,
    })

    return { workflow_id, run_id, org_id: def.org_id, started_at }
  }

  async pauseWorkflow(workflow_id: string): Promise<void> {
    await this._updateWorkflowStatus(workflow_id, 'paused')
  }

  async resumeWorkflow(
    workflow_id: string,
    signal?: Record<string, unknown>
  ): Promise<void> {
    const { data, error } = await supabaseAdmin
      .from('learning_events')
      .select('metadata')
      .eq('event_type', 'workflow_started')
      .contains('metadata', { workflow_id })
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) {
      throw new Error(`Workflow ${workflow_id} not found for resume`)
    }

    const meta = data.metadata as Record<string, unknown>
    const updatedMeta: Record<string, unknown> = {
      ...meta,
      status: 'running',
      resumed_at: new Date().toISOString(),
    }
    if (signal) {
      updatedMeta['resume_signal'] = signal
    }

    await supabaseAdmin
      .from('learning_events')
      .update({ metadata: updatedMeta })
      .eq('event_type', 'workflow_started')
      .contains('metadata', { workflow_id })

    logger.info('[WorkflowEngine] Workflow resumed', { workflow_id, signal })
  }

  async cancelWorkflow(workflow_id: string, reason: string): Promise<void> {
    const { data } = await supabaseAdmin
      .from('learning_events')
      .select('metadata')
      .eq('event_type', 'workflow_started')
      .contains('metadata', { workflow_id })
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (data) {
      const meta = data.metadata as Record<string, unknown>
      await supabaseAdmin
        .from('learning_events')
        .update({
          metadata: {
            ...meta,
            status: 'cancelled',
            cancel_reason: reason,
            cancelled_at: new Date().toISOString(),
          },
        })
        .eq('event_type', 'workflow_started')
        .contains('metadata', { workflow_id })
    }

    logger.info('[WorkflowEngine] Workflow cancelled', { workflow_id, reason })
  }

  async getStatus(workflow_id: string): Promise<WorkflowStatus> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseAdmin.from('learning_events') as any)
      .select('metadata, org_id')
      .eq('event_type', 'workflow_started')
      .contains('metadata', { workflow_id })
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) {
      throw new Error(`Workflow ${workflow_id} not found`)
    }

    const meta = data.metadata as Record<string, unknown>

    // Load snapshots
    const { data: snapshotRows } = await supabaseAdmin
      .from('learning_events')
      .select('metadata, created_at')
      .eq('event_type', 'workflow_snapshot')
      .contains('metadata', { workflow_id })
      .order('created_at', { ascending: true })

    const snapshots: WorkflowSnapshot[] = (snapshotRows ?? []).map((row) => {
      const sm = row.metadata as Record<string, unknown>
      return {
        id: sm['snapshot_id'] as string,
        workflow_id,
        step_id: sm['step_id'] as string,
        state: (sm['state'] as Record<string, unknown>) ?? {},
        created_at: row.created_at as string,
      }
    })

    return {
      workflow_id,
      run_id: meta['run_id'] as string,
      org_id: data.org_id as string,
      status: (meta['status'] as WorkflowStatus['status']) ?? 'running',
      started_at: meta['started_at'] as string,
      completed_at: meta['completed_at'] as string | undefined,
      current_step: meta['current_step'] as string | undefined,
      error: meta['error'] as string | undefined,
      snapshots,
    }
  }

  async listActive(org_id: string, limit = 50): Promise<WorkflowStatus[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseAdmin.from('learning_events') as any)
      .select('metadata, created_at')
      .eq('event_type', 'workflow_started')
      .eq('org_id', org_id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      logger.error('[WorkflowEngine] listActive query failed', { error, org_id })
      return []
    }

    return (data ?? [])
      .filter((row: Record<string, unknown>) => {
        const meta = row['metadata'] as Record<string, unknown>
        return meta['status'] === 'running' || meta['status'] === 'paused' || meta['status'] === 'awaiting_approval'
      })
      .map((row: Record<string, unknown>) => {
        const meta = row['metadata'] as Record<string, unknown>
        return {
          workflow_id: meta['workflow_id'] as string,
          run_id: meta['run_id'] as string,
          org_id,
          status: meta['status'] as WorkflowStatus['status'],
          started_at: meta['started_at'] as string,
          completed_at: meta['completed_at'] as string | undefined,
          current_step: meta['current_step'] as string | undefined,
          error: meta['error'] as string | undefined,
          snapshots: [],
        }
      })
  }

  async replay(workflow_id: string): Promise<void> {
    const status = await this.getStatus(workflow_id)
    if (status.status === 'running') {
      throw new Error(`Cannot replay running workflow ${workflow_id}`)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: original } = await (supabaseAdmin.from('learning_events') as any)
      .select('metadata, org_id')
      .eq('event_type', 'workflow_started')
      .contains('metadata', { workflow_id })
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!original) {
      throw new Error(`Workflow ${workflow_id} not found for replay`)
    }

    const meta = original.metadata as Record<string, unknown>
    const new_workflow_id = randomUUID()
    const new_run_id = randomUUID()
    const now = new Date().toISOString()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin.from('learning_events') as any).insert({
      event_type: 'workflow_started',
      org_id: original.org_id,
      metadata: {
        ...meta,
        workflow_id: new_workflow_id,
        run_id: new_run_id,
        status: 'running',
        started_at: now,
        replayed_from: workflow_id,
        completed_at: undefined,
        error: undefined,
      },
      created_at: now,
    })

    logger.info('[WorkflowEngine] Workflow replayed', {
      original_id: workflow_id,
      new_workflow_id,
    })
  }

  private async _updateWorkflowStatus(
    workflow_id: string,
    status: WorkflowStatus['status']
  ): Promise<void> {
    const { data } = await supabaseAdmin
      .from('learning_events')
      .select('metadata')
      .eq('event_type', 'workflow_started')
      .contains('metadata', { workflow_id })
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (data) {
      const meta = data.metadata as Record<string, unknown>
      await supabaseAdmin
        .from('learning_events')
        .update({ metadata: { ...meta, status } })
        .eq('event_type', 'workflow_started')
        .contains('metadata', { workflow_id })
    }
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

function createWorkflowEngine(): IWorkflowEngine {
  if (process.env['TEMPORAL_ADDRESS']) {
    // Lazy import to avoid compile errors when @temporalio/client is absent
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { TemporalWorkflowProvider } = require('./temporalProvider') as {
        TemporalWorkflowProvider: new () => IWorkflowEngine
      }
      return new TemporalWorkflowProvider()
    } catch {
      logger.warn('[WorkflowEngine] Temporal package unavailable — falling back to DB provider')
    }
  }
  return new DBWorkflowProvider()
}

export const workflowEngine = createWorkflowEngine()
