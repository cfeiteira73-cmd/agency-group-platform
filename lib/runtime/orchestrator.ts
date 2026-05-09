// =============================================================================
// AGENCY GROUP — SH-ROS Runtime Orchestrator v1.0
// Event → Agent dispatcher with validation, dedup, parallel execution
// AMI: 22506 | SH-ROS Runtime Core
// =============================================================================

import { randomUUID } from 'crypto'
import {
  EVENT_AGENT_ROUTING,
  type RuntimeEvent,
  type RuntimeEventType,
  type RuntimeExecutionTrace,
  type SystemAlertPayload,
} from './types'
import { shortTermMemory } from './memory'
import { agentRegistry } from '@/lib/agents/registry'
import type { AgentContext, AgentId } from '@/lib/agents/types'

// ─── Custom error ─────────────────────────────────────────────────────────────

export class RuntimeValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RuntimeValidationError'
  }
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

class RuntimeOrchestrator {
  /** event_id → processed_at ms (for TTL-based dedup) */
  private _processedEvents = new Map<string, number>()
  private DEDUP_TTL_MS = 5 * 60_000 // 5 minutes

  async dispatch(event: RuntimeEvent): Promise<RuntimeExecutionTrace> {
    const started_at = new Date().toISOString()
    const start_ms   = Date.now()

    // 1. Schema validation
    this._validate(event)

    // 2. Deduplication — return cached trace shape if already processed
    if (this._isDuplicate(event.event_id)) {
      return {
        event_id:          event.event_id,
        event_type:        event.type,
        org_id:            event.org_id,
        correlation_id:    event.correlation_id,
        agents_triggered:  [],
        agents_completed:  [],
        agents_failed:     [],
        total_duration_ms: 0,
        started_at,
        completed_at:      new Date().toISOString(),
        error:             'duplicate_event',
      }
    }

    // Register as processed before execution (optimistic dedup)
    this._processedEvents.set(event.event_id, Date.now())
    this._cleanExpiredDedup()

    // 3. Store event in short-term memory
    shortTermMemory.add(event.org_id, {
      event_id:        event.event_id,
      type:            event.type,
      timestamp:       event.timestamp,
      payload_summary: JSON.stringify(event.payload).slice(0, 200),
    })

    // 4. Resolve agent IDs for this event type
    const agentIds = this._getAgents(event.type)

    if (agentIds.length === 0) {
      return {
        event_id:          event.event_id,
        event_type:        event.type,
        org_id:            event.org_id,
        correlation_id:    event.correlation_id,
        agents_triggered:  [],
        agents_completed:  [],
        agents_failed:     [],
        total_duration_ms: Date.now() - start_ms,
        started_at,
        completed_at:      new Date().toISOString(),
      }
    }

    // 5. Build contexts and run agents in parallel
    const agentRuns = agentIds.map(agentId => {
      const agent = agentRegistry.get(agentId)
      if (!agent) {
        return Promise.resolve({
          agentId,
          ok: false,
          error: `Agent '${agentId}' not registered`,
        })
      }
      const ctx = this._buildContext(event, agentId)
      return agent.run(ctx).then(
        result => ({ agentId, ok: result.status !== 'failed', error: result.error }),
        err    => ({ agentId, ok: false, error: err instanceof Error ? err.message : String(err) }),
      )
    })

    const settled = await Promise.allSettled(agentRuns)

    // 6. Separate succeeded vs failed
    const completed: AgentId[] = []
    const failed: AgentId[] = []

    for (const result of settled) {
      if (result.status === 'fulfilled') {
        if (result.value.ok) {
          completed.push(result.value.agentId)
        } else {
          failed.push(result.value.agentId)
          // 7. Emit follow-up SYSTEM_ALERT for each failure (best-effort, fire-and-forget)
          void this._emitFailureAlert(event, result.value.agentId, result.value.error)
        }
      } else {
        // Promise itself rejected (shouldn't happen but be safe)
        console.error('[Orchestrator] Unexpected rejection in agent run', result.reason)
      }
    }

    const completed_at = new Date().toISOString()

    return {
      event_id:          event.event_id,
      event_type:        event.type,
      org_id:            event.org_id,
      correlation_id:    event.correlation_id,
      agents_triggered:  agentIds,
      agents_completed:  completed,
      agents_failed:     failed,
      total_duration_ms: Date.now() - start_ms,
      started_at,
      completed_at,
    }
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private _validate(event: RuntimeEvent): void {
    if (!event.event_id || typeof event.event_id !== 'string') {
      throw new RuntimeValidationError('event_id is required and must be a string')
    }
    if (!event.org_id || typeof event.org_id !== 'string') {
      throw new RuntimeValidationError('org_id is required and must be a string')
    }
    if (!event.timestamp || isNaN(Date.parse(event.timestamp))) {
      throw new RuntimeValidationError('timestamp is required and must be a valid ISO8601 string')
    }
    if (!event.type) {
      throw new RuntimeValidationError('event type is required')
    }
    if (!event.source_system) {
      throw new RuntimeValidationError('source_system is required')
    }
    if (!event.correlation_id) {
      throw new RuntimeValidationError('correlation_id is required')
    }
  }

  private _isDuplicate(event_id: string): boolean {
    return this._processedEvents.has(event_id)
  }

  private _getAgents(type: RuntimeEventType): AgentId[] {
    return EVENT_AGENT_ROUTING[type] ?? []
  }

  private _buildContext(event: RuntimeEvent, agentId: AgentId): AgentContext {
    return {
      org_id:         event.org_id,
      correlation_id: event.correlation_id,
      event_id:       event.event_id,
      trigger_event:  event.type,
      triggered_by:   'event',
      triggered_at:   new Date().toISOString(),
      dry_run:        false,
    }
  }

  private _cleanExpiredDedup(): void {
    const now = Date.now()
    for (const [id, ts] of this._processedEvents) {
      if (now - ts > this.DEDUP_TTL_MS) {
        this._processedEvents.delete(id)
      }
    }
  }

  private async _emitFailureAlert(
    originalEvent: RuntimeEvent,
    agentId: AgentId,
    error: string | null | undefined,
  ): Promise<void> {
    try {
      const alertEvent: RuntimeEvent = {
        event_id:       randomUUID(),
        org_id:         originalEvent.org_id,
        type:           'SYSTEM_ALERT',
        timestamp:      new Date().toISOString(),
        correlation_id: originalEvent.correlation_id,
        source_system:  'agent',
        payload:        {
          severity:  'warning',
          message:   `Agent '${agentId}' failed during dispatch of event '${originalEvent.event_id}'`,
          component: agentId,
          error:     error ?? 'unknown',
        } satisfies SystemAlertPayload,
      }
      await this.dispatch(alertEvent)
    } catch {
      // Best-effort — never let alert dispatch throw
    }
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const orchestrator = new RuntimeOrchestrator()
