// AGENCY GROUP — SH-ROS Runtime Workflows: temporalProvider | AMI: 22506
// Temporal.io integration — type-only imports, dynamic require for optional dep
// =============================================================================

import { randomUUID } from 'crypto'
import logger from '@/lib/logger'
import type {
  IWorkflowEngine,
  WorkflowHandle,
  WorkflowStatus,
  WorkflowDefinition,
  WorkflowSnapshot,
} from './workflowEngine'

// ─── Temporal type stubs (avoided hard dep — resolved at runtime if present) ──

interface TemporalClient {
  workflow: {
    start(workflow: unknown, options: Record<string, unknown>): Promise<{ workflowId: string; firstExecutionRunId: string }>
    getHandle(workflowId: string): TemporalWorkflowHandle
  }
}

interface TemporalWorkflowHandle {
  workflowId: string
  describe(): Promise<{
    status: { name: string }
    startTime: Date
    closeTime?: Date
    memo?: Record<string, unknown>
  }>
  signal(signalName: string, ...args: unknown[]): Promise<void>
  terminate(reason: string): Promise<void>
}

interface TemporalClientModule {
  Client: new (opts: { connection: unknown; namespace: string }) => TemporalClient
  Connection: {
    connect(opts: { address: string }): Promise<unknown>
  }
}

// ─── Status mapping ───────────────────────────────────────────────────────────

function mapTemporalStatus(
  name: string
): WorkflowStatus['status'] {
  switch (name) {
    case 'RUNNING':        return 'running'
    case 'COMPLETED':      return 'completed'
    case 'FAILED':         return 'failed'
    case 'CANCELLED':      return 'cancelled'
    case 'TIMED_OUT':      return 'failed'
    case 'CONTINUED_AS_NEW': return 'running'
    case 'TERMINATED':     return 'cancelled'
    default:               return 'running'
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export class TemporalWorkflowProvider implements IWorkflowEngine {
  private clientPromise: Promise<TemporalClient> | null = null

  private async getClient(): Promise<TemporalClient> {
    if (!this.clientPromise) {
      this.clientPromise = this._connect()
    }
    return this.clientPromise
  }

  private async _connect(): Promise<TemporalClient> {
    const address = process.env['TEMPORAL_ADDRESS'] ?? 'localhost:7233'
    const namespace = process.env['TEMPORAL_NAMESPACE'] ?? 'default'
    const MAX_ATTEMPTS = 3
    const BACKOFF_MS = [500, 1500, 4000]

    let lastError: Error = new Error('Temporal connection failed')

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        // Dynamic import — graceful if @temporalio/client is absent
        let temporalModule: TemporalClientModule
        try {
          temporalModule = await import('@temporalio/client') as unknown as TemporalClientModule
        } catch {
          throw new Error('@temporalio/client package is not installed. Install it or unset TEMPORAL_ADDRESS.')
        }

        const connection = await temporalModule.Connection.connect({ address })
        const client = new temporalModule.Client({ connection, namespace })

        logger.info('[TemporalProvider] Connected', { address, namespace })
        return client
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        logger.warn('[TemporalProvider] Connection attempt failed', {
          attempt: attempt + 1,
          address,
          error: lastError.message,
        })

        if (attempt < MAX_ATTEMPTS - 1) {
          await new Promise<void>((resolve) => setTimeout(resolve, BACKOFF_MS[attempt]))
        }
      }
    }

    // Reset promise so next call retries
    this.clientPromise = null
    throw lastError
  }

  async startWorkflow(
    def: WorkflowDefinition,
    input: Record<string, unknown>
  ): Promise<WorkflowHandle> {
    const client = await this.getClient()
    const workflow_id = `${def.name}-${def.org_id}-${randomUUID()}`
    const started_at = new Date().toISOString()

    const handle = await client.workflow.start('agencyGroupWorkflow', {
      taskQueue: process.env['TEMPORAL_TASK_QUEUE'] ?? 'agency-group',
      workflowId: workflow_id,
      args: [{ definition: def, input }],
      memo: {
        org_id: def.org_id,
        workflow_name: def.name,
        workflow_version: def.version,
        requires_approval: def.requires_approval ?? false,
      },
    })

    logger.info('[TemporalProvider] Workflow started', {
      workflow_id,
      run_id: handle.firstExecutionRunId,
      name: def.name,
      org_id: def.org_id,
    })

    return {
      workflow_id: handle.workflowId,
      run_id: handle.firstExecutionRunId,
      org_id: def.org_id,
      started_at,
    }
  }

  async pauseWorkflow(workflow_id: string): Promise<void> {
    const client = await this.getClient()
    const handle = client.workflow.getHandle(workflow_id)
    await handle.signal('pause')
    logger.info('[TemporalProvider] Workflow paused', { workflow_id })
  }

  async resumeWorkflow(
    workflow_id: string,
    signal?: Record<string, unknown>
  ): Promise<void> {
    const client = await this.getClient()
    const handle = client.workflow.getHandle(workflow_id)
    await handle.signal('resume', signal ?? {})
    logger.info('[TemporalProvider] Workflow resumed', { workflow_id })
  }

  async cancelWorkflow(workflow_id: string, reason: string): Promise<void> {
    const client = await this.getClient()
    const handle = client.workflow.getHandle(workflow_id)
    await handle.terminate(reason)
    logger.info('[TemporalProvider] Workflow cancelled', { workflow_id, reason })
  }

  async getStatus(workflow_id: string): Promise<WorkflowStatus> {
    const client = await this.getClient()
    const handle = client.workflow.getHandle(workflow_id)
    const desc = await handle.describe()

    const memo = (desc.memo ?? {}) as Record<string, unknown>

    return {
      workflow_id,
      run_id: workflow_id,
      org_id: (memo['org_id'] as string) ?? '',
      status: mapTemporalStatus(desc.status.name),
      started_at: desc.startTime.toISOString(),
      completed_at: desc.closeTime?.toISOString(),
      snapshots: [] as WorkflowSnapshot[],
    }
  }

  async listActive(org_id: string, _limit = 50): Promise<WorkflowStatus[]> {
    // Temporal list requires separate gRPC call — return empty for now to avoid
    // blocking; in production implement via WorkflowService.listWorkflowExecutions
    logger.warn('[TemporalProvider] listActive not fully implemented for Temporal — use Temporal Web UI', {
      org_id,
    })
    return []
  }

  async replay(workflow_id: string): Promise<void> {
    // Temporal native replay goes through tctl or the reset API
    // Signal to start a reset in the workflow worker
    const client = await this.getClient()
    const handle = client.workflow.getHandle(workflow_id)
    await handle.signal('replay')
    logger.info('[TemporalProvider] Replay signal sent', { workflow_id })
  }
}
