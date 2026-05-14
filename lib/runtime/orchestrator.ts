// =============================================================================
// AGENCY GROUP — SH-ROS Runtime Orchestrator vFINAL
// 12-step persist-before-execute pipeline — all gaps from audit closed
// AMI: 22506 | SH-ROS Production Runtime
//
// FIXES applied in this version:
//   FIX-1  _persistEvent: throw on non-23505 DB errors (was silently return true)
//   FIX-2  _finalise: set status='failed' when ALL agents fail (was always 'completed')
//   FIX-3  _handleAgentFailure: DLQ updates ORIGINAL event via correlation_id (not retry event)
//   FIX-4  _emitFollowUps: structured error capture + failed follow-ups persisted to DB
//   FIX-5  rankOutputs wired: agent outputs ranked by EV and included in trace
//   FIX-6  hasRecentEvent alias: now delegates to hotMemory cache
// =============================================================================

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
import type { AgentId, AgentOutputContract } from '@/lib/agents/types'
import { BaseAgent } from '@/lib/agents/base'

// ─── Custom errors ────────────────────────────────────────────────────────────

export class RuntimeValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RuntimeValidationError'
  }
}

export class RuntimePersistError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RuntimePersistError'
  }
}

// ─── Extended trace (includes EV ranking) ────────────────────────────────────

export interface RuntimeExecutionTraceExtended extends RuntimeExecutionTrace {
  ranked_outputs: Array<AgentOutputContract & { ev: number }>
  top_ev: number
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

class RuntimeOrchestrator {

  // ─── Step 1+: Full 12-step dispatch ──────────────────────────────────────────

  async dispatch(event: RuntimeEvent): Promise<RuntimeExecutionTrace> {
    const started_at = new Date().toISOString()
    const start_ms   = Date.now()

    // STEP 2: Schema validation
    this._validate(event)

    // STEP 3: Persist event (status=pending) — NO EXECUTION BEFORE THIS
    // FIX-1: Non-23505 DB errors now throw — guaranteed persist-before-execute
    const persisted = await this._persistEvent(event)

    // STEP 4: Idempotency — duplicate event_id, return early
    if (!persisted) {
      return this._duplicateTrace(event, started_at)
    }

    // STEP 5: Mark processing
    await this._setStatus(event.event_id, 'processing')

    // STEP 6: Route to agents
    const agentIds = EVENT_AGENT_ROUTING[event.type] ?? []

    // STEPS 7–8: Execute agents + collect outputs
    const { completed, failed, outputs, followUpEvents } = await this._executeAgents(event, agentIds)

    // FIX-5: Rank outputs by EV — Decision Engine now active in execution pipeline
    const ranked_outputs = decisionEngine.rankOutputs(outputs)
    const top_ev         = ranked_outputs[0]?.ev ?? 0

    // Compute trace metrics
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

    // STEP 9: Finalise — update DB row with result
    // FIX-2: Status set to 'failed' when ALL agents fail
    await this._finalise(event, trace, ranked_outputs, top_ev)

    // STEP 10: Update HOT memory
    hotMemory.add(event.org_id, {
      event_id:        event.event_id,
      org_id:          event.org_id,
      type:            event.type,
      status:          completed.length === 0 && failed.length > 0 ? 'failed' : 'completed',
      priority:        event.priority,
      timestamp:       event.timestamp,
      payload_summary: JSON.stringify(event.payload).slice(0, 200),
      latency_ms,
      economic_score,
    })

    // STEP 11: Emit follow-up events (FIX-4: structured error capture)
    void this._emitFollowUps(followUpEvents, event)

    // STEP 12: Observability log
    console.info('[SH-ROS]', {
      trace_id:         event.metadata.trace_id,
      correlation_id:   event.correlation_id,
      event_id:         event.event_id,
      org_id:           event.org_id,
      type:             event.type,
      latency_ms,
      agents_triggered: agentIds.length,
      agents_completed: completed.length,
      agents_failed:    failed.length,
      economic_score,
      top_ev:           Math.round(top_ev),
    })

    return trace
  }

  // ─── STEP 3: Persist event ────────────────────────────────────────────────────
  // FIX-1: Non-23505 errors throw RuntimePersistError — hard stop, no execution

  private async _persistEvent(event: RuntimeEvent): Promise<boolean> {
    const { error } = await supabaseAdmin
      .from('runtime_events')
      .insert({
        event_id:        event.event_id,
        org_id:          event.org_id,
        type:            event.type,
        status:          'pending',
        priority:        event.priority,
        retry_count:     event.retry_count,
        correlation_id:  event.correlation_id,
        trace_id:        event.metadata.trace_id,
        source_system:   event.metadata.source_system,
        schema_version:  event.metadata.schema_version,
        payload:         event.payload as Record<string, unknown>,
        event_timestamp: event.timestamp,      // original emitter wall-clock (migration 017)
        event_chain:     [event.event_id],     // causality chain starts with self (migration 017)
      })

    if (error) {
      if (error.code === '23505') {
        // Duplicate event_id — idempotent skip (not an error)
        return false
      }
      // FIX-1: Any other DB error is fatal — throw to prevent execution without persistence
      throw new RuntimePersistError(`Event persistence failed: ${error.message} (code: ${error.code})`)
    }

    return true
  }

  // ─── STEP 5+9: Status helpers ─────────────────────────────────────────────────

  private async _setStatus(
    event_id: string,
    status: 'processing' | 'completed' | 'failed' | 'dlq',
    extra: Record<string, unknown> = {},
  ): Promise<void> {
    const { error } = await supabaseAdmin
      .from('runtime_events')
      .update({ status, updated_at: new Date().toISOString(), ...extra })
      .eq('event_id', event_id)

    if (error) {
      // Non-fatal — log but don't throw (event was already persisted)
      console.error('[Orchestrator] _setStatus failed:', { event_id, status, error: error.message })
    }
  }

  // ─── STEPS 7–8: Execute agents ────────────────────────────────────────────────

  private async _executeAgents(
    event: RuntimeEvent,
    agentIds: AgentId[],
  ): Promise<{
    completed:     AgentId[]
    failed:        AgentId[]
    outputs:       AgentOutputContract[]
    followUpEvents: RuntimeEvent[]
  }> {
    const completed:      AgentId[]           = []
    const failed:         AgentId[]           = []
    const outputs:        AgentOutputContract[] = []
    const followUpEvents: RuntimeEvent[]       = []

    if (agentIds.length === 0) {
      return { completed, failed, outputs, followUpEvents }
    }

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
        return Promise.resolve({
          agentId,
          ok:         false,
          error:      `Agent '${agentId}' not registered`,
          output:     null as AgentOutputContract | null,
          nextEvents: [] as RuntimeEvent[],
        })
      }
      return agent.run(ctx).then(
        result => ({
          agentId,
          ok:         result.status !== 'failed',
          error:      result.error,
          output:     result.output as AgentOutputContract,
          nextEvents: (result.output.next_events ?? []).map(ne =>
            this._buildFollowUp(event, ne)
          ),
        }),
        err => ({
          agentId,
          ok:         false,
          error:      err instanceof Error ? err.message : String(err),
          output:     null as AgentOutputContract | null,
          nextEvents: [] as RuntimeEvent[],
        }),
      )
    })

    const settled = await Promise.allSettled(runs)

    for (const s of settled) {
      if (s.status !== 'fulfilled') continue
      const { agentId, ok, error, output, nextEvents } = s.value
      if (ok) {
        completed.push(agentId)
        if (output) outputs.push(output)
        followUpEvents.push(...nextEvents)
      } else {
        failed.push(agentId)
        // FIX-3: Pass original event_id so DLQ can update the right record
        void this._handleAgentFailure(event, agentId, error)
      }
    }

    return { completed, failed, outputs, followUpEvents }
  }

  // ─── STEP 9: Finalise ─────────────────────────────────────────────────────────
  // FIX-2: status='failed' when ALL agents fail

  private async _finalise(
    event: RuntimeEvent,
    trace: RuntimeExecutionTrace,
    ranked_outputs: Array<AgentOutputContract & { ev: number }>,
    top_ev: number,
  ): Promise<void> {
    const allFailed = trace.agents_failed.length > 0 && trace.agents_completed.length === 0
    const status    = allFailed ? 'failed' : 'completed'

    await this._setStatus(event.event_id, status, {
      result: {
        ...trace,
        ranked_outputs: ranked_outputs.map(o => ({
          agent:       o.agent,
          ev:          Math.round(o.ev),
          priority:    o.priority,
          insight:     o.insight,
          confidence:  o.confidence,
          probability: o.probability,
          risk_score:  o.risk_score,
        })),
        top_ev: Math.round(top_ev),
      } as Record<string, unknown>,
      agents_triggered: trace.agents_triggered,
      agents_completed: trace.agents_completed,
      agents_failed:    trace.agents_failed,
      latency_ms:       trace.total_duration_ms,
      economic_score:   trace.economic_score,
      processed_at:     trace.started_at,
      completed_at:     trace.completed_at,
    })
  }

  // ─── Retry + DLQ ─────────────────────────────────────────────────────────────
  // FIX-3: DLQ updates the ORIGINAL event via correlation_id + retry_count=0

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
        event_id:    randomUUID(), // new ID for each retry attempt
        retry_count: attempt + 1,
        timestamp:   new Date().toISOString(),
        metadata:    { ...event.metadata }, // preserve trace chain
      }

      void this.dispatch(retryEvent).catch(err => {
        console.error('[Orchestrator] retry dispatch failed:', {
          original_event_id: event.event_id,
          retry_event_id:    retryEvent.event_id,
          error:             err instanceof Error ? err.message : String(err),
        })
      })
    } else {
      // FIX-3: After MAX_RETRIES — mark the current retry event as DLQ
      await this._setStatus(event.event_id, 'dlq', {
        result: {
          error,
          agent_id:          agentId,
          exhausted_retries: MAX_RETRIES,
          dlq_at:            new Date().toISOString(),
        },
      })

      // FIX-3: Also update the ORIGINAL event (retry_count=0, same correlation_id) to DLQ
      const { error: origUpdateError } = await supabaseAdmin
        .from('runtime_events')
        .update({
          status:     'dlq',
          updated_at: new Date().toISOString(),
          result:     {
            error,
            agent_id:          agentId,
            dlq_via_retry:     event.event_id,
            exhausted_retries: MAX_RETRIES,
          },
        })
        .eq('correlation_id', event.correlation_id)
        .eq('retry_count', 0)
        .neq('event_id', event.event_id) // don't double-update the current retry

      if (origUpdateError) {
        console.warn('[Orchestrator] original event DLQ update failed:', origUpdateError.message)
      }

      // Emit SYSTEM_ALERT (with error capture — not fire-and-forget)
      try {
        await this.dispatch(this._buildSystemAlert(event, agentId, error ?? 'unknown'))
      } catch (alertErr) {
        console.error('[Orchestrator] SYSTEM_ALERT dispatch failed after DLQ:', {
          original_event_id: event.event_id,
          error: alertErr instanceof Error ? alertErr.message : String(alertErr),
        })
      }
    }
  }

  // ─── STEP 11: Follow-up events ────────────────────────────────────────────────
  // FIX-4: Errors captured and persisted — not silently swallowed

  private async _emitFollowUps(events: RuntimeEvent[], parentEvent: RuntimeEvent): Promise<void> {
    for (const evt of events) {
      try {
        await this.dispatch(evt)
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        console.error('[Orchestrator] follow-up dispatch failed:', {
          follow_up_event_id: evt.event_id,
          type:               evt.type,
          parent_event_id:    parentEvent.event_id,
          error:              errorMsg,
        })

        // Persist a 'failed' record so the follow-up is traceable
        const { error: persistErr } = await supabaseAdmin
          .from('runtime_events')
          .insert({
            event_id:        evt.event_id,
            org_id:          evt.org_id,
            type:            evt.type,
            status:          'failed',
            priority:        evt.priority,
            retry_count:     0,
            correlation_id:  evt.correlation_id,
            trace_id:        evt.metadata.trace_id,
            source_system:   evt.metadata.source_system,
            schema_version:  evt.metadata.schema_version,
            payload:         evt.payload as Record<string, unknown>,
            event_timestamp: evt.timestamp,                              // migration 017
            event_chain:     [parentEvent.event_id, evt.event_id],      // causality: parent → child
            result: {
              error:           'follow-up dispatch failed',
              original_error:  errorMsg,
              parent_event_id: parentEvent.event_id,
            },
          })
          .select('event_id')
          .maybeSingle()

        if (persistErr && persistErr.code !== '23505') {
          console.error('[Orchestrator] follow-up failed-persist also failed:', persistErr.message)
        }
      }
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

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
    if (!['low', 'medium', 'high', 'critical'].includes(event.priority)) {
      throw new RuntimeValidationError('priority must be low|medium|high|critical')
    }
    if (typeof event.retry_count !== 'number' || event.retry_count < 0) {
      throw new RuntimeValidationError('retry_count must be a non-negative number')
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
        message:   `DLQ: Agent '${agentId}' exhausted ${MAX_RETRIES} retries on event '${originalEvent.event_id}'`,
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
