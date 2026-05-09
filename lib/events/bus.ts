// =============================================================================
// AGENCY GROUP — Event Bus v1.0
// Backing store: Supabase learning_events (production-safe)
// Future: Redis Streams / Kafka pluggable via adapter pattern
// Fire-and-forget — NEVER throws — NEVER blocks request path
// AMI: 22506 | SH-ROS Event Bus
// =============================================================================

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import type { AnyPlatformEvent, BaseEvent, EventType } from './types'

// ─── Adapter interface (pluggable backends) ───────────────────────────────────

interface EventBusAdapter {
  publish(event: AnyPlatformEvent): Promise<void>
}

// ─── Supabase adapter (current) ───────────────────────────────────────────────

class SupabaseEventAdapter implements EventBusAdapter {
  async publish(event: AnyPlatformEvent): Promise<void> {
    const { error } = await supabaseAdmin
      .from('learning_events')
      .insert({
        event_type:     event.event_type,
        correlation_id: event.correlation_id,
        source_system:  event.source_system,
        metadata: {
          event_id:       event.event_id,
          schema_version: event.schema_version,
          occurred_at:    event.occurred_at,
          ...('payload' in event ? { payload: (event as AnyPlatformEvent & { payload: unknown }).payload } : {}),
        },
        created_at: event.occurred_at,
      })
    if (error) {
      // Structured error — never throw, never block
      console.error('[EventBus] publish failed', { event_type: event.event_type, error: error.message })
    }
  }
}

// ─── Deduplication (in-process, 60s TTL) ─────────────────────────────────────

const _recentKeys = new Map<string, number>()
const DEDUP_TTL_MS = 60_000

function isDuplicate(key: string): boolean {
  const now = Date.now()
  // Evict stale
  for (const [k, ts] of _recentKeys) {
    if (now - ts > DEDUP_TTL_MS) _recentKeys.delete(k)
  }
  if (_recentKeys.has(key)) return true
  _recentKeys.set(key, now)
  return false
}

// ─── Event Bus class ──────────────────────────────────────────────────────────

class EventBus {
  private adapter: EventBusAdapter = new SupabaseEventAdapter()

  /**
   * Publish an event. Fire-and-forget — never throws.
   * Supports idempotency_key deduplication (60s window).
   */
  async publish(event: AnyPlatformEvent): Promise<void> {
    try {
      const dedupKey = event.idempotency_key ?? `${event.event_type}:${event.event_id}`
      if (isDuplicate(dedupKey)) return
      void this.adapter.publish(event)
    } catch {
      // Absolute safety — never propagate
    }
  }

  /** Build a base event skeleton */
  createBase(
    type: EventType,
    opts: { correlation_id?: string | null; source_system?: BaseEvent['source_system'] }
  ): Omit<BaseEvent, 'event_type'> {
    return {
      event_id:       randomUUID(),
      occurred_at:    new Date().toISOString(),
      correlation_id: opts.correlation_id ?? null,
      source_system:  opts.source_system ?? 'api',
      schema_version: '1.0',
    }
  }

  /** Replace the adapter (for Redis Streams, Kafka, etc.) */
  setAdapter(adapter: EventBusAdapter): void {
    this.adapter = adapter
  }
}

export const eventBus = new EventBus()
export type { EventBusAdapter }
