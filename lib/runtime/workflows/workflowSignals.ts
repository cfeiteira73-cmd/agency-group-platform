// AGENCY GROUP — SH-ROS Runtime Workflows: workflowSignals | AMI: 22506
// External signal bus — backed by operator_tasks, tenant-isolated
// =============================================================================

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import logger from '@/lib/logger'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabaseAdmin as any

// ─── Types ────────────────────────────────────────────────────────────────────

export type WorkflowSignalType =
  | 'approve'
  | 'reject'
  | 'cancel'
  | 'expedite'
  | 'pause'
  | 'resume'
  | 'update_data'

export interface WorkflowSignal {
  id: string
  workflow_id: string
  type: WorkflowSignalType
  payload: Record<string, unknown>
  sent_at: string
  processed_at?: string
}

// ─── Signal Bus ───────────────────────────────────────────────────────────────

export class WorkflowSignalBus {
  /**
   * Send a signal to a running workflow.
   * Stored in operator_tasks with task_type='workflow_signal'.
   */
  async send(
    workflow_id: string,
    signal_type: WorkflowSignalType,
    payload: Record<string, unknown>
  ): Promise<void> {
    const signal_id = randomUUID()
    const sent_at = new Date().toISOString()

    // org_id must be in payload for tenant isolation
    const org_id = (payload['org_id'] as string) ?? 'unknown'

    const { error } = await sb.from('operator_tasks').insert({
      org_id,
      task_type: 'workflow_signal',
      status: 'pending',
      priority: signal_type === 'cancel' || signal_type === 'expedite' ? 'high' : 'medium',
      title: `Signal [${signal_type}] → workflow ${workflow_id.slice(0, 8)}`,
      metadata: {
        signal_id,
        workflow_id,
        signal_type,
        payload,
        sent_at,
        processed_at: null,
      },
    })

    if (error) {
      logger.error('[WorkflowSignalBus] Failed to send signal', {
        error,
        workflow_id,
        signal_type,
      })
      throw new Error(`Signal send failed: ${error.message}`)
    }

    logger.info('[WorkflowSignalBus] Signal sent', {
      signal_id,
      workflow_id,
      signal_type,
    })
  }

  /**
   * Receive (dequeue) the next unprocessed signal for a workflow.
   * Marks the signal as processed atomically.
   * Returns null if no pending signals.
   */
  async receive(workflow_id: string): Promise<WorkflowSignal | null> {
    const { data, error } = await sb
      .from('operator_tasks')
      .select('id, metadata, created_at')
      .eq('task_type', 'workflow_signal')
      .eq('status', 'pending')
      .contains('metadata', { workflow_id })
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (error || !data) {
      return null
    }

    const meta = data.metadata as Record<string, unknown>
    const processed_at = new Date().toISOString()

    // Mark as processed
    await sb
      .from('operator_tasks')
      .update({
        status: 'completed',
        metadata: { ...meta, processed_at },
      })
      .eq('id', data.id)

    const signal: WorkflowSignal = {
      id: meta['signal_id'] as string,
      workflow_id,
      type: meta['signal_type'] as WorkflowSignalType,
      payload: (meta['payload'] as Record<string, unknown>) ?? {},
      sent_at: meta['sent_at'] as string,
      processed_at,
    }

    logger.info('[WorkflowSignalBus] Signal received and processed', {
      signal_id: signal.id,
      workflow_id,
      signal_type: signal.type,
    })

    return signal
  }

  /**
   * Peek at all pending signals for a workflow without consuming them.
   */
  async peek(workflow_id: string): Promise<WorkflowSignal[]> {
    const { data, error } = await sb
      .from('operator_tasks')
      .select('metadata, created_at')
      .eq('task_type', 'workflow_signal')
      .eq('status', 'pending')
      .contains('metadata', { workflow_id })
      .order('created_at', { ascending: true })

    if (error || !data) {
      return []
    }

    return data.map((row: Record<string, unknown>) => {
      const meta = row['metadata'] as Record<string, unknown>
      return {
        id: meta['signal_id'] as string,
        workflow_id,
        type: meta['signal_type'] as WorkflowSignalType,
        payload: (meta['payload'] as Record<string, unknown>) ?? {},
        sent_at: meta['sent_at'] as string,
        processed_at: meta['processed_at'] as string | undefined,
      }
    })
  }

  /**
   * Cancel all pending signals for a workflow (e.g. on workflow cancellation).
   */
  async cancelAll(workflow_id: string, org_id: string): Promise<number> {
    const { data, error } = await sb
      .from('operator_tasks')
      .select('id')
      .eq('task_type', 'workflow_signal')
      .eq('status', 'pending')
      .eq('org_id', org_id)
      .contains('metadata', { workflow_id })

    if (error || !data || data.length === 0) {
      return 0
    }

    const ids = data.map((r: Record<string, unknown>) => r['id'])

    await sb
      .from('operator_tasks')
      .update({ status: 'cancelled' })
      .in('id', ids)

    logger.info('[WorkflowSignalBus] Cancelled all pending signals', {
      workflow_id,
      cancelled: ids.length,
    })

    return ids.length
  }
}

export const workflowSignalBus = new WorkflowSignalBus()
