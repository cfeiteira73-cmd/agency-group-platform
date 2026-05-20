// =============================================================================
// Agency Group — Event Stream Backbone
// lib/events/streamBackbone.ts
//
// Pluggable event streaming layer. Current: Upstash Redis Streams.
// Interface designed for Kafka/NATS JetStream drop-in (Phase 3).
//
// REDIS STREAMS API (Upstash REST):
//   XADD stream_key * field1 val1 field2 val2  → appends entry
//   XLEN stream_key                              → length
//   XRANGE stream_key - + COUNT n               → read entries
//   XDEL stream_key id                          → delete entry (for GC)
//
// TypeScript strict — 0 errors
// =============================================================================

import type { BaseEvent } from './types'
import { getStreamKey } from './globalOrdering'

// ─── Interface ────────────────────────────────────────────────────────────────

export interface StreamPublishResult {
  stream_id: string        // Redis entry ID (e.g., '1716148200000-0')
  stream_key: string       // Redis key
  ok: boolean
}

export interface StreamEntry {
  id: string               // Redis entry ID
  event: BaseEvent
}

export interface EventStreamBackbone {
  /**
   * Publish an event to the stream.
   * Returns StreamPublishResult with the Redis entry ID.
   */
  publish(event: BaseEvent): Promise<StreamPublishResult>

  /**
   * Read recent entries from a stream.
   * @param tenantId   Tenant to read from
   * @param eventType  Event type (stream name suffix)
   * @param count      Max entries to return (default 10)
   * @param fromId     Start reading from this ID ('0' = from beginning, '$' = new only)
   */
  readRange(
    tenantId: string,
    eventType: string,
    count?: number,
    fromId?: string,
  ): Promise<StreamEntry[]>

  /**
   * Get the current depth (number of entries) for a stream.
   */
  getDepth(tenantId: string, eventType: string): Promise<number>

  /**
   * Trim a stream to the last N entries (for storage management).
   */
  trim(tenantId: string, eventType: string, maxLen: number): Promise<void>
}

// ─── Redis Streams Adapter (Upstash REST) ────────────────────────────────────

export class RedisStreamsAdapter implements EventStreamBackbone {
  private readonly url: string
  private readonly token: string

  constructor() {
    const url   = process.env.UPSTASH_REDIS_REST_URL
    const token = process.env.UPSTASH_REDIS_REST_TOKEN
    if (!url || !token) throw new Error('UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN required')
    this.url   = url
    this.token = token
  }

  private async cmd<T>(command: unknown[]): Promise<T> {
    const res = await fetch(`${this.url}/pipeline`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify([command]),
      signal:  AbortSignal.timeout(2000),
    })
    if (!res.ok) throw new Error(`Redis cmd failed: ${res.status}`)
    const [[{ result, error }]] = await res.json() as [[{ result: T; error: string | null }]]
    if (error) throw new Error(`Redis error: ${error}`)
    return result
  }

  async publish(event: BaseEvent): Promise<StreamPublishResult> {
    const streamKey = getStreamKey(event.tenant_id, event.event_type)
    try {
      const payload = JSON.stringify(event)
      const entryId = await this.cmd<string>([
        'XADD', streamKey, 'MAXLEN', '~', 10000, '*',
        'event_id',      event.event_id,
        'event_type',    event.event_type,
        'tenant_id',     event.tenant_id,
        'occurred_at',   event.occurred_at,
        'partition_key', event.partition_key ?? '',
        'payload',       payload,
      ])
      return { stream_id: entryId, stream_key: streamKey, ok: true }
    } catch (err) {
      console.warn('[StreamBackbone] publish error:', err)
      return { stream_id: '', stream_key: streamKey, ok: false }
    }
  }

  async readRange(
    tenantId: string,
    eventType: string,
    count = 10,
    fromId = '-',
  ): Promise<StreamEntry[]> {
    const streamKey = getStreamKey(tenantId, eventType)
    try {
      type XRangeEntry = [string, string[]]
      const entries = await this.cmd<XRangeEntry[]>([
        'XRANGE', streamKey, fromId, '+', 'COUNT', count,
      ])
      return (entries ?? []).map(([id, fields]) => {
        const fieldMap: Record<string, string> = {}
        for (let i = 0; i < fields.length; i += 2) {
          fieldMap[fields[i]] = fields[i + 1]
        }
        let parsedEvent: BaseEvent
        try {
          parsedEvent = JSON.parse(fieldMap['payload'] ?? '{}') as BaseEvent
        } catch {
          parsedEvent = {
            event_id:       fieldMap['event_id']   ?? id,
            event_type:     fieldMap['event_type']  as BaseEvent['event_type'] ?? 'lead_created',
            tenant_id:      fieldMap['tenant_id']  ?? tenantId,
            occurred_at:    fieldMap['occurred_at'] ?? new Date().toISOString(),
            correlation_id: null,
            source_system:  'api',
            schema_version: '1.0',
          }
        }
        return { id, event: parsedEvent }
      })
    } catch { return [] }
  }

  async getDepth(tenantId: string, eventType: string): Promise<number> {
    const streamKey = getStreamKey(tenantId, eventType)
    try {
      return await this.cmd<number>(['XLEN', streamKey])
    } catch { return 0 }
  }

  async trim(tenantId: string, eventType: string, maxLen: number): Promise<void> {
    const streamKey = getStreamKey(tenantId, eventType)
    try {
      await this.cmd(['XTRIM', streamKey, 'MAXLEN', maxLen])
    } catch { /* non-blocking */ }
  }
}

// ─── In-Memory Adapter (for testing / dev without Redis) ─────────────────────

export class InMemoryStreamAdapter implements EventStreamBackbone {
  private readonly streams = new Map<string, StreamEntry[]>()
  private seq = 0

  async publish(event: BaseEvent): Promise<StreamPublishResult> {
    const key = getStreamKey(event.tenant_id, event.event_type)
    if (!this.streams.has(key)) this.streams.set(key, [])
    const id = `${Date.now()}-${++this.seq}`
    this.streams.get(key)!.push({ id, event })
    return { stream_id: id, stream_key: key, ok: true }
  }

  async readRange(tenantId: string, eventType: string, count = 10): Promise<StreamEntry[]> {
    const key = getStreamKey(tenantId, eventType)
    return (this.streams.get(key) ?? []).slice(-count)
  }

  async getDepth(tenantId: string, eventType: string): Promise<number> {
    return (this.streams.get(getStreamKey(tenantId, eventType)) ?? []).length
  }

  async trim(tenantId: string, eventType: string, maxLen: number): Promise<void> {
    const key = getStreamKey(tenantId, eventType)
    const entries = this.streams.get(key) ?? []
    if (entries.length > maxLen) this.streams.set(key, entries.slice(-maxLen))
  }
}

// ─── Kafka Stub (Phase 3 — drop-in when KafkaJS wired up) ───────────────────

export class KafkaStreamAdapter implements EventStreamBackbone {
  constructor() {
    console.warn('[StreamBackbone] KafkaStreamAdapter is a stub — wire up kafkajs in Phase 3')
  }
  async publish(event: BaseEvent): Promise<StreamPublishResult> {
    return { stream_id: event.event_id, stream_key: `kafka:${event.tenant_id}:${event.event_type}`, ok: false }
  }
  async readRange(): Promise<StreamEntry[]> { return [] }
  async getDepth(): Promise<number> { return 0 }
  async trim(): Promise<void> { /* stub */ }
}

// ─── Singleton factory ────────────────────────────────────────────────────────

let _backbone: EventStreamBackbone | null = null

export function getStreamBackbone(): EventStreamBackbone {
  if (_backbone) return _backbone
  const backend = process.env.EVENT_STREAM_BACKEND ?? 'redis'
  if (backend === 'kafka') {
    _backbone = new KafkaStreamAdapter()
  } else if (process.env.UPSTASH_REDIS_REST_URL) {
    _backbone = new RedisStreamsAdapter()
  } else {
    _backbone = new InMemoryStreamAdapter()
  }
  return _backbone
}
