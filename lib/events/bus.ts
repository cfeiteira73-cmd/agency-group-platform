// =============================================================================
// AGENCY GROUP — Event Bus v1.1
// Backing store: Supabase learning_events (production-safe)
// Future: Redis Streams / Kafka pluggable via adapter pattern
// Fire-and-forget — NEVER throws — NEVER blocks request path
// AMI: 22506 | SH-ROS Event Bus
// DLQ: failed events written back to learning_events with metadata.dlq=true
// =============================================================================

import { randomUUID } from 'crypto'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase'
import type { AnyPlatformEvent, BaseEvent, EventType } from './types'

// ─── Poison-event guard ───────────────────────────────────────────────────────

const MAX_PAYLOAD_BYTES = 64 * 1024  // 64 KB — reject oversized events before Redis

/**
 * Returns true if the payload should be quarantined rather than published.
 * Reasons: non-object, exceeds 64 KB serialized, or not JSON-serializable.
 *
 * Usage:
 *   if (isEventPoisoned(event)) { ... skip ... }
 */
export function isEventPoisoned(payload: unknown): boolean {
  try {
    const size = JSON.stringify(payload).length
    if (size > MAX_PAYLOAD_BYTES) return true
    if (!payload || typeof payload !== 'object') return true
    return false
  } catch { return true }
}

// ─── Adapter interface (pluggable backends) ───────────────────────────────────

interface EventBusAdapter {
  publish(event: AnyPlatformEvent): Promise<void>
}

// ─── DLQ adapter ─────────────────────────────────────────────────────────────
//
// Writes failed events back to the same learning_events table with
// metadata.dlq = true so the /api/events/replay route can find and re-publish them.
// Fire-and-forget — NEVER throws — NEVER blocks the caller.

async function dlqPush(event: AnyPlatformEvent, originalError: string): Promise<void> {
  try {
    const { error: dlqError } = await supabaseAdmin
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
          dlq:            true,
          dlq_at:         new Date().toISOString(),
          original_error: originalError,
        },
        created_at: event.occurred_at,
      })
    if (dlqError) {
      // DLQ write also failed — last resort: structured console log
      console.error('[EventBus][DLQ] failed to write DLQ entry', {
        event_type:     event.event_type,
        event_id:       event.event_id,
        dlq_error:      dlqError.message,
        original_error: originalError,
      })
    }
  } catch (err) {
    // Absolute safety — never propagate from DLQ path
    console.error('[EventBus][DLQ] unexpected error', {
      event_type:     event.event_type,
      event_id:       event.event_id,
      err:            err instanceof Error ? err.message : String(err),
      original_error: originalError,
    })
  }
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
      // DLQ: store failed event for manual replay or automated retry
      void dlqPush(event, error.message)
    }
  }
}

// ─── Deduplication — Upstash Redis (distributed) + in-memory fallback ────────
//
// Production: uses Upstash SETNX (SET if Not eXists) with 60s TTL.
//   Key: `ev_dedup:{key}` — atomic, survives cold starts and rolling deploys.
// Dev / fallback: in-memory Map (resets on process restart — acceptable for dev).
//
// Redis is called fire-and-forget async; we return `false` (not duplicate)
// on any Redis error to prevent false-positive dedup from blocking events.

const _recentKeys = new Map<string, number>()
const DEDUP_TTL_MS = 60_000
const DEDUP_REDIS_TTL_SEC = 60

const _upstashConfigured =
  typeof process !== 'undefined' &&
  !!process.env.UPSTASH_REDIS_REST_URL &&
  !!process.env.UPSTASH_REDIS_REST_TOKEN

async function isDuplicateRedis(key: string): Promise<boolean> {
  try {
    const url   = process.env.UPSTASH_REDIS_REST_URL!
    const token = process.env.UPSTASH_REDIS_REST_TOKEN!
    const res = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([
        // SET key 1 NX EX ttl → returns "OK" if set (not duplicate), null if already exists
        ['SET', `ev_dedup:${key}`, '1', 'NX', 'EX', String(DEDUP_REDIS_TTL_SEC)],
      ]),
      signal: AbortSignal.timeout(300), // 300ms max — never block event publishing
    })
    if (!res.ok) return false // fail open
    const json = await res.json() as Array<{ result: string | null }>
    // result is "OK" if newly set (not a duplicate), null if key already existed
    return json[0]?.result === null
  } catch {
    return false // fail open — better to allow duplicate than drop events
  }
}

function isDuplicateMemory(key: string): boolean {
  const now = Date.now()
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
   * Dedup uses Upstash Redis in production (distributed, survives cold starts).
   * Falls back to in-memory if Redis is not configured (dev/test).
   */
  async publish(event: AnyPlatformEvent): Promise<void> {
    try {
      // Poison-event guard — skip publishing and log, never throw
      if (isEventPoisoned(event)) {
        console.warn('[EventBus] poisoned event dropped', {
          event_type: (event as Partial<AnyPlatformEvent>).event_type ?? 'unknown',
          event_id:   (event as Partial<AnyPlatformEvent>).event_id   ?? 'unknown',
        })
        return
      }
      const dedupKey = `${event.tenant_id}:${event.idempotency_key ?? `${event.event_type}:${event.event_id}`}`
      const isDup = _upstashConfigured
        ? await isDuplicateRedis(dedupKey)
        : isDuplicateMemory(dedupKey)
      if (isDup) return
      this.persistToHistory(event)
      void this.adapter.publish(event)
    } catch (err) {
      // Absolute safety — never propagate, but log so silent drops are visible
      console.warn('[EventBus] publish error (event dropped):', err instanceof Error ? err.message : err)
    }
  }

  /** Build a base event skeleton */
  createBase(
    type: EventType,
    opts: { correlation_id?: string | null; source_system?: BaseEvent['source_system']; tenant_id?: string }
  ): Omit<BaseEvent, 'event_type'> {
    return {
      event_id:       randomUUID(),
      occurred_at:    new Date().toISOString(),
      correlation_id: opts.correlation_id ?? null,
      tenant_id:      opts.tenant_id ?? 'default',
      source_system:  opts.source_system ?? 'api',
      schema_version: '1.0',
    }
  }

  /**
   * Persist event to event_history for audit, replay, and causal tracing.
   * Fire-and-forget — NEVER throws — NEVER blocks the publish path.
   * Controlled by EVENT_HISTORY_ENABLED env var (fail-open if not set).
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private persistToHistory(event: AnyPlatformEvent): void {
    // Opt-out model: write to event_history unless explicitly disabled.
    // Set EVENT_HISTORY_ENABLED=false in env to turn off (e.g., local dev without the table).
    if (process.env.EVENT_HISTORY_ENABLED === 'false') return
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void createClient<any>(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
      .from('event_history')
      .insert({
        event_id:        event.event_id,
        correlation_id:  event.correlation_id ?? 'unknown',
        tenant_id:       event.tenant_id ?? 'agency-group',
        event_type:      event.event_type,
        idempotency_key: event.idempotency_key ?? null,
        payload:         event as unknown as Record<string, unknown>,
        source_system:   event.source_system ?? null,
        version:         1,
        published_at:    event.occurred_at ?? new Date().toISOString(),
      })
      .then(({ error }: { error: { message: string } | null }) => {
        if (error) console.warn('[event-bus] event_history insert failed:', error.message)
      })
  }

  /** Replace the adapter (for Redis Streams, Kafka, etc.) */
  setAdapter(adapter: EventBusAdapter): void {
    this.adapter = adapter
  }
}

export const eventBus = new EventBus()
export type { EventBusAdapter }
