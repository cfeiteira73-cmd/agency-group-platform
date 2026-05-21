// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — Kafka Event Replay Engine (kafka_event_log) v1.0
// lib/events/kafkaEventReplay.ts
//
// Cursor-based pagination replay over the kafka_event_log Supabase table.
// Named kafkaEventReplay.ts to avoid collision with the existing replayEngine.ts
// (which replays from event_history / Kafka broker).
//
// Reads from kafka_event_log, sorted by emitted_at ASC, id ASC.
// Cursor = last event_id in the returned batch.
//
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import type { EventTopic, DomainEvent } from './eventRouter'

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ReplayOptions {
  tenant_id: string
  topic?: EventTopic
  from_event_id?: string    // resume from this event (cursor — exclusive)
  from_timestamp?: string   // or from this time (ISO)
  to_timestamp?: string
  entity_id?: string
  limit?: number            // default 100, max 1000
}

export interface ReplayResult {
  events: DomainEvent[]
  next_cursor: string | null   // last event_id in batch, null if no more
  total_replayed: number
  has_more: boolean
}

// ─── replayEvents ─────────────────────────────────────────────────────────────

/**
 * Replays events from kafka_event_log using cursor-based pagination.
 * Safe to call repeatedly: pass next_cursor as from_event_id on subsequent
 * calls to page through all matching events.
 */
export async function replayEvents(opts: ReplayOptions): Promise<ReplayResult> {
  try {
    const limit = Math.min(opts.limit ?? 100, 1000)

    // ── cursor-based sub-select: get the emitted_at of the cursor event ───────
    let cursorTimestamp: string | null = null
    if (opts.from_event_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: cursorRow } = await (supabaseAdmin as any)
        .from('kafka_event_log')
        .select('emitted_at, id')
        .eq('event_id', opts.from_event_id)
        .single() as { data: { emitted_at: string; id: string } | null }

      if (cursorRow) {
        cursorTimestamp = cursorRow.emitted_at
      }
    }

    // ── Build query ────────────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabaseAdmin as any)
      .from('kafka_event_log')
      .select('event_id, topic, tenant_id, entity_id, entity_type, payload, correlation_id, schema_version, emitted_at')
      .eq('tenant_id', opts.tenant_id)
      .order('emitted_at', { ascending: true })
      .order('id', { ascending: true })
      .limit(limit + 1)   // +1 to detect has_more

    if (opts.topic)          query = query.eq('topic', opts.topic)
    if (opts.entity_id)      query = query.eq('entity_id', opts.entity_id)
    if (cursorTimestamp)     query = query.gt('emitted_at', cursorTimestamp)
    else if (opts.from_timestamp) query = query.gte('emitted_at', opts.from_timestamp)
    if (opts.to_timestamp)   query = query.lte('emitted_at', opts.to_timestamp)

    const { data, error } = await query as {
      data:  Array<Record<string, unknown>> | null
      error: { message: string } | null
    }

    if (error) {
      log.warn('[kafkaEventReplay] query failed', {
        tenant_id: opts.tenant_id,
        error:     error.message,
      })
      return { events: [], next_cursor: null, total_replayed: 0, has_more: false }
    }

    const rows = data ?? []
    const has_more = rows.length > limit
    const slice    = has_more ? rows.slice(0, limit) : rows

    const events: DomainEvent[] = slice.map(row => ({
      event_id:       String(row['event_id'] ?? ''),
      topic:          (row['topic'] as EventTopic),
      tenant_id:      String(row['tenant_id'] ?? opts.tenant_id),
      entity_id:      String(row['entity_id'] ?? ''),
      entity_type:    String(row['entity_type'] ?? ''),
      payload:        (row['payload'] as Record<string, unknown>) ?? {},
      correlation_id: row['correlation_id'] != null ? String(row['correlation_id']) : undefined,
      emitted_at:     String(row['emitted_at'] ?? new Date().toISOString()),
      schema_version: String(row['schema_version'] ?? '1.0'),
    }))

    const next_cursor = events.length > 0 ? events[events.length - 1].event_id : null

    return {
      events,
      next_cursor: has_more ? next_cursor : null,
      total_replayed: events.length,
      has_more,
    }
  } catch (err) {
    log.warn('[kafkaEventReplay] replayEvents error', {
      tenant_id: opts.tenant_id,
      error:     err instanceof Error ? err.message : String(err),
    })
    return { events: [], next_cursor: null, total_replayed: 0, has_more: false }
  }
}

// ─── replayFromBeginning ──────────────────────────────────────────────────────

/**
 * Returns the first page (up to 100 events) of the full event history for a
 * tenant, optionally filtered to a single topic. Use has_more + next_cursor
 * to page through all events.
 */
export async function replayFromBeginning(
  tenantId: string,
  topic?: EventTopic,
): Promise<ReplayResult> {
  return replayEvents({ tenant_id: tenantId, topic, limit: 100 })
}
