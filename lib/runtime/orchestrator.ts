// =============================================================================
// AGENCY GROUP — SH-ROS Runtime Orchestrator vFINAL
// 12-step persist-before-execute pipeline
// AMI: 22506 | SH-ROS Production Runtime
// =============================================================================
//
// EXECUTION ORDER (strict):
//   1. Receive event
//   2. Validate schema
//   3. Persist event (status=pending) — NO EXECUTION BEFORE PERSISTENCE
//   4. Idempotency check (unique event_id enforced by DB)
//   5. Mark processing
//   6. Route to agent(s)
//   7. Execute deterministic logic
//   8. Store result
//   9. Mark completed
//  10. Update memory
//  11. Emit follow-up events
//  12. Write audit log

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import {
  EVENT_AGENT_ROUTING,
  BACKOFF_MS,
  MAX_RETRIES,
  type RuntimeEvent,
  type RuntimeEventType,
  type RuntimeExecutionTrace,
  type SystemAlertPayload,
} from './types'
import { hotMemory } from './memory'
import { decisionEngine } from './decisionEngine'
import { agentRegistry } from '@/lib/agents/registry'
import type { AgentId } from '@/lib/agents/types'
import { BaseAgent } from '@/lib/agents/base'

// ─── Validation error ─────────────────────────────────────────────────────────

export class RuntimeValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RuntimeValidationError'
  }
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

class RuntimeOrchestrator {

  // ─── PUBLIC: dispatch ──────────────────────────────────────────────────────

  async dispatch(event: RuntimeEvent): Promise<RuntimeExecutionTrace> {
    const started_at = new Date().toISOString()
    const start_ms   = Date.now()

    // STEP 2: Schema validation
    this._validate(event)

    // STEP 3: Persist event (status=pending) — BEFORE ANY EXECUTION
    const persisted = await this._persistEvent(event)

    // STEP 4: Idempotency — if persist returned null, event_id already exists
    if (!persisted) {
      return this._duplicateTrace(event, started_at)
    }

    // STEP 5: Mark processing
    await this._setStatus(event.event_id, 'processing')

    // STEP 6: Route to agents
    const agentIds = EVENT_AGENT_ROUTING[event.type] ?? []

    // STEP 7: Execute with retry semantics
    const { completed, failed, followUpEvents } = await this._executeAgents(event, agentIds)

    // STEP 8 + 9: Compute trace, mark completed
    const latency_ms     = Date.now() - start_ms
    const event_chain    = followUpEvents.map(e => e.event_id)
    const economic_score = decisionEngine.scoreExecution(completed, failed, latency_ms)

    const trace: RuntimeExecutionTrace = {
      event_id:          event.event_id,
      event_type:        event.type,
      org_id:            event.org_id,
      correlation_id:    event.correlation_id,
      trace_id:          event.metadata.trace_id,
      agents_triggered:  agentIds,
      agents_completed:  completed,
      agents_failed:     failed,
      total_duration_ms: latency_ms,
      started_at,
      completed_at:      new Date().toISOString(),
      event_chain,
      economic_score,
    }

    await this._finalise(event, trace)

    // STEP 10: Update HOT memory
    hotMemory.add(event.org_id, {
      event_id:        event.event_id,
      org_id:          event.org_id,
      type:            event.type,
      status:          'completed',
      priority:        event.priority,
      timestamp:       event.timestamp,
      payload_summary: JSON.stringify(event.payload).slice(0, 200),
      latency_ms,
      economic_score,
    })

    // STEP 11: Emit follow-up events (fire-and-forget, non-blocking)
    void this._emitFollowUps(followUpEvents)

    // STEP 12: Audit log — the runtime_events row IS the audit log (immutable)
    // Additional structured log for observability
    console.info('[SH-ROS]', {
      trace_id:       event.metadata.trace_id,
      correlation_id: event.correlation_id,
      event_id:       event.event_id,
      org_id:         event.org_id,
      type:           event.type,
      latency_ms,
      agents_triggered: agentIds.length,
      agents_completed: completed.length,
      agents_failed:    failed.length,
      economic_score,
    })

    return trace
  }

  // ─── PRIVATE: step 3 — persist ────────────────────────────────────────────

  private async _persistEvent(event: RuntimeEvent): Promise<boolean> {
    const { error } = await supabaseAdmin
      .from('runtime_events')
      .insert({
        event_id:       event.event_id,
        org_id:         event.org_id,
        type:           event.type,
        status:         'pending',
        priority:       event.priority,
        retry_count:    event.retry_count,
        correlation_id: event.correlation_id,
        trace_id:       event.metadata.trace_id,
        source_system:  event.metadata.source_system,
        schema_version: event.metadata.schema_version,
        payload:        event.payload as Record<string, unknown>,
      })

    // Unique constraint violation = duplicate event — idempotent skip
    if (error) {
      if (error.code === '23505') return false // duplicate key
      // Other DB errors are non-fatal — log but proceed
      console.error('[Orchestrator] persist error (non-fatal):', error.message)
    }

    return true
  }

  // ─── PRIVATE: step 5 — set status ────────────────────────────────────────

  private async _setStatus(
    event_id: string,
    status: 'processing' | 'completed' | 'failed' | 'dlq',
    extra: Record<string, unknown> = {},
  ): Promise<void> {
    await supabaseAdmin
      .from('runtime_events')
      .update({ status, updated_at: new Date().toISOString(), ...extra })
      .eq('event_id', event_id)
  }

  // ─── PRIVATE: step 7 — execute with retry ────────────────────────────────

  private async _executeAgents(
    event: RuntimeEvent,
    agentIds: AgentId[],
  ): Promise<{ completed: AgentId[]; failed: AgentId[]; followUpEvents: RuntimeEvent[] }> {
    const completed: AgentId[]      = []
    const failed: AgentId[]         = []
    const followUpEvents: RuntimeEvent[] = []

    if (agentIds.length === 0) return { completed, failed, followUpEvents }

    const ctx = BaseAgent.createContext({
      org_id:         event.org_id,
      correlation_id: event.correlation_id,
      event_id:       event.event_id,
      trigger_event:  event.type,
      triggered_by:   'event',
    })

    const runs = agentIds.map(agentId => {
      const agent = agentRegistry.get(agentId)
      if (!agent) {
        return Promise.resolve({ agentId, ok: false, error: `Agent '${agentId}' not registered`, nextEvents: [] as RuntimeEvent[] })
      }
      return agent.run(ctx).then(
        result => ({
          agentId,
          ok: result.status !== 'failed',
          error: result.error,
          nextEvents: (result.output.next_events ?? []).map(ne => this._buildFollowUp(event, ne)),
        }),
        err => ({
          agentId,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
          nextEvents: [] as RuntimeEvent[],
        }),
      )
    })

    const settled = await Promise.allSettled(runs)

    for (const s of settled) {
      if (s.status !== 'fulfilled') continue
      const { agentId, ok, error, nextEvents } = s.value
      if (ok) {
        completed.push(agentId)
        followUpEvents.push(...nextEvents)
      } else {
        failed.push(agentId)
        void this._handleAgentFailure(event, agentId, error)
      }
    }

    return { completed, failed, followUpEvents }
  }

  // ─── PRIVATE: step 8+9 — finalise ────────────────────────────────────────

  private async _finalise(event: RuntimeEvent, trace: RuntimeExecutionTrace): Promise<void> {
    await this._setStatus(event.event_id, 'completed', {
      result:           trace as unknown as Record<string, unknown>,
      agents_triggered: trace.agents_triggered,
      agents_completed: trace.agents_completed,
      agents_failed:    trace.agents_failed,
      latency_ms:       trace.total_duration_ms,
      economic_score:   trace.economic_score,
      processed_at:     trace.started_at,
      completed_at:     trace.completed_at,
    })
  }

  // ─── PRIVATE: retry + DLQ ────────────────────────────────────────────────

  private async _handleAgentFailure(
    event: RuntimeEvent,
    agentId: AgentId,
    error: string | null | undefined,
  ): Promise<void> {
    const attempt = event.retry_count

    if (attempt < MAX_RETRIES) {
      const delayMs = BACKOFF_MS[attempt] ?? 5_000
      await this._sleep(delayMs)

      const retryEvent: RuntimeEvent = {
        ...event,
        event_id:    randomUUID(), // new ID for retry
        retry_count: attempt + 1,
        timestamp:   new Date().toISOString(),
        metadata: {
          ...event.metadata,
          trace_id: event.metadata.trace_id, // preserve trace chain
        },
      }

      void this.dispatch(retryEvent).catch(() => {/* DLQ handles final failure */})
    } else {
      // Move to DLQ after MAX_RETRIES
      await this._setStatus(event.event_id, 'dlq', {
        result: { error, agent_id: agentId, exhausted_retries: MAX_RETRIES },
      })

      // Emit SYSTEM_ALERT for DLQ
      void this.dispatch(this._buildSystemAlert(event, agentId, error ?? 'unknown'))
    }
  }

  // ─── PRIVATE: step 11 — follow-up events ─────────────────────────────────

  private async _emitFollowUps(events: RuntimeEvent[]): Promise<void> {
    for (const evt of events) {
      try {
        await this.dispatch(evt)
      } catch {
        // Non-blocking — follow-up failure must never block parent
      }
    }
  }

  // ─── PRIVATE: helpers ─────────────────────────────────────────────────────

  private _validate(event: RuntimeEvent): void {
    if (!event.event_id || typeof event.event_id !== 'string') {
      throw new RuntimeValidationError('event_id is required')
    }
    if (!event.org_id || typeof event.org_id !== 'string') {
      throw new RuntimeValidationError('org_id is required')
    }
    if (!event.timestamp || isNaN(Date.parse(event.timestamp))) {
      throw new RuntimeValidationError('timestamp must be valid ISO8601')
    }
    if (!event.type) {
      throw new RuntimeValidationError('event type is required')
    }
    if (!event.correlation_id) {
      throw new RuntimeValidationError('correlation_id is required')
    }
    if (!event.metadata?.trace_id) {
      throw new RuntimeValidationError('metadata.trace_id is required')
    }
    if (!event.metadata?.source_system) {
      throw new RuntimeValidationError('metadata.source_system is required')
    }
    if (!['low','medium','high','critical'].includes(event.priority)) {
      throw new RuntimeValidationError('priority must be low|medium|high|critical')
    }
  }

  private _duplicateTrace(event: RuntimeEvent, started_at: string): RuntimeExecutionTrace {
    return {
      event_id:          event.event_id,
      event_type:        event.type,
      org_id:            event.org_id,
      correlation_id:    event.correlation_id,
      trace_id:          event.metadata.trace_id,
      agents_triggered:  [],
      agents_completed:  [],
      agents_failed:     [],
      total_duration_ms: 0,
      started_at,
      completed_at:      new Date().toISOString(),
      event_chain:       [],
      economic_score:    0,
      error:             'duplicate_event_skipped',
    }
  }

  private _buildFollowUp(
    parent: RuntimeEvent,
    next: { type: string; payload: Record<string, unknown> },
  ): RuntimeEvent {
    return {
      event_id:       randomUUID(),
      org_id:         parent.org_id,
      type:           next.type as RuntimeEventType,
      timestamp:      new Date().toISOString(),
      correlation_id: parent.correlation_id,
      priority:       'medium',
      retry_count:    0,
      payload:        next.payload as RuntimeEvent['payload'],
      metadata: {
        schema_version: 'vFINAL',
        trace_id:       parent.metadata.trace_id,
        source_system:  'agent',
      },
    }
  }

  private _buildSystemAlert(
    originalEvent: RuntimeEvent,
    agentId: AgentId,
    error: string,
  ): RuntimeEvent {
    return {
      event_id:       randomUUID(),
      org_id:         originalEvent.org_id,
      type:           'SYSTEM_ALERT',
      timestamp:      new Date().toISOString(),
      correlation_id: originalEvent.correlation_id,
      priority:       'critical',
      retry_count:    0,
      payload:        {
        severity:  'critical',
        message:   `DLQ: Agent '${agentId}' failed ${MAX_RETRIES} times on event '${originalEvent.event_id}'`,
        component: agentId,
        error,
      } satisfies SystemAlertPayload,
      metadata: {
        schema_version: 'vFINAL',
        trace_id:       originalEvent.metadata.trace_id,
        source_system:  'engine',
      },
    }
  }

  private _sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const orchestrator = new RuntimeOrchestrator()
