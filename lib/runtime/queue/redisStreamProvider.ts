// AGENCY GROUP — SH-ROS Queue: redisStreamProvider | AMI: 22506
// Redis Streams implementation using ioredis.
// Stream per org for tenant isolation. Consumer groups for agent coordination.

import Redis from 'ioredis'
import type { RuntimeEvent } from '@/lib/runtime/types'
import { MAX_RETRIES } from '@/lib/runtime/types'
import type {
  IQueueProvider,
  QueueHealth,
  QueueMetrics,
  ReplayOptions,
} from './queueProvider'

// ─── Constants ────────────────────────────────────────────────────────────────

const CONSUMER_GROUP = 'sh-ros-agents'
const CONSUMER_NAME = `consumer-${process.pid}`
const STREAM_PREFIX = 'sh-ros:events'
const DLQ_PREFIX = 'sh-ros:dlq'
const MAX_STREAM_LEN = 100_000 // MAXLEN per stream
const BLOCK_MS = 2_000 // XREADGROUP BLOCK time

// ─── Redis Streams entry shape ────────────────────────────────────────────────

type XAddFields = string[]

function eventToFields(event: RuntimeEvent): XAddFields {
  return [
    'event_id', event.event_id,
    'org_id', event.org_id,
    'type', event.type,
    'timestamp', event.timestamp,
    'correlation_id', event.correlation_id,
    'priority', event.priority,
    'retry_count', String(event.retry_count),
    'payload', JSON.stringify(event.payload),
    'metadata', JSON.stringify(event.metadata),
  ]
}

function fieldsToEvent(fields: string[]): RuntimeEvent | null {
  try {
    const map: Record<string, string> = {}
    for (let i = 0; i < fields.length; i += 2) {
      map[fields[i]] = fields[i + 1]
    }
    return {
      event_id: map['event_id'],
      org_id: map['org_id'],
      type: map['type'] as RuntimeEvent['type'],
      timestamp: map['timestamp'],
      correlation_id: map['correlation_id'],
      priority: map['priority'] as RuntimeEvent['priority'],
      retry_count: parseInt(map['retry_count'] ?? '0', 10),
      payload: JSON.parse(map['payload'] ?? '{}') as RuntimeEvent['payload'],
      metadata: JSON.parse(map['metadata'] ?? '{}') as RuntimeEvent['metadata'],
    }
  } catch {
    return null
  }
}

// ─── RedisStreamProvider ──────────────────────────────────────────────────────

export class RedisStreamProvider implements IQueueProvider {
  private readonly redis: Redis
  private readonly PROVIDER = 'redis-streams'
  private isConnected = false

  constructor() {
    if (!process.env.REDIS_URL) {
      throw new Error('[RedisStreamProvider] REDIS_URL is not set')
    }

    this.redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
    })

    this.redis.on('connect', () => {
      this.isConnected = true
    })

    this.redis.on('error', (err: Error) => {
      console.error('[RedisStreamProvider] Connection error:', err.message)
      this.isConnected = false
    })

    this.redis.on('close', () => {
      this.isConnected = false
    })

    // Eagerly connect
    this.redis.connect().catch((err: Error) => {
      console.error('[RedisStreamProvider] Failed to connect:', err.message)
    })
  }

  // ─── Stream key helpers ───────────────────────────────────────────────────

  private streamKey(org_id: string): string {
    return `${STREAM_PREFIX}:${org_id}`
  }

  private dlqKey(org_id: string): string {
    return `${DLQ_PREFIX}:${org_id}`
  }

  // ─── Ensure consumer group exists ─────────────────────────────────────────

  private async ensureGroup(streamKey: string): Promise<void> {
    try {
      await this.redis.xgroup('CREATE', streamKey, CONSUMER_GROUP, '$', 'MKSTREAM')
    } catch (err: unknown) {
      // BUSYGROUP = group already exists, safe to ignore
      if (err instanceof Error && !err.message.includes('BUSYGROUP')) {
        throw err
      }
    }
  }

  // ── enqueue ────────────────────────────────────────────────────────────────

  async enqueue(event: RuntimeEvent): Promise<string> {
    try {
      const key = this.streamKey(event.org_id)
      await this.ensureGroup(key)

      const messageId = await this.redis.xadd(
        key,
        'MAXLEN', '~', String(MAX_STREAM_LEN),
        '*',
        ...eventToFields(event),
      )

      if (!messageId) throw new Error('XADD returned null message ID')
      return messageId
    } catch (err) {
      console.error('[RedisStreamProvider] enqueue error:', err)
      throw err
    }
  }

  // ── dequeue ────────────────────────────────────────────────────────────────

  async dequeue(org_id: string, count = 10): Promise<RuntimeEvent[]> {
    try {
      const key = this.streamKey(org_id)
      await this.ensureGroup(key)

      // Read new messages (>) from the consumer group
      const results = await this.redis.xreadgroup(
        'GROUP', CONSUMER_GROUP, CONSUMER_NAME,
        'COUNT', String(count),
        'BLOCK', String(BLOCK_MS),
        'STREAMS', key, '>',
      ) as [string, [string, string[]][]][] | null

      if (!results || results.length === 0) return []

      const events: RuntimeEvent[] = []
      for (const [, entries] of results) {
        for (const [, fields] of entries) {
          const event = fieldsToEvent(fields)
          if (event) events.push(event)
        }
      }

      return events
    } catch (err) {
      console.error('[RedisStreamProvider] dequeue error:', err)
      return []
    }
  }

  // ── ack ────────────────────────────────────────────────────────────────────

  async ack(messageId: string, org_id: string): Promise<void> {
    try {
      const key = this.streamKey(org_id)
      await this.redis.xack(key, CONSUMER_GROUP, messageId)
    } catch (err) {
      console.error('[RedisStreamProvider] ack error:', err)
      throw err
    }
  }

  // ── nack ───────────────────────────────────────────────────────────────────

  async nack(messageId: string, org_id: string, reason: string): Promise<void> {
    try {
      const streamKey = this.streamKey(org_id)

      // Fetch the message from the PEL to check retry count
      const pending = await this.redis.xpending(
        streamKey,
        CONSUMER_GROUP,
        messageId,
        messageId,
        '1',
      ) as [string, string, number, number][] | null

      const deliveryCount = pending?.[0]?.[3] ?? 0

      if (deliveryCount >= MAX_RETRIES) {
        // Move to DLQ stream
        const dlqKey = this.dlqKey(org_id)
        await this.redis.xadd(
          dlqKey,
          'MAXLEN', '~', '10000',
          '*',
          'original_message_id', messageId,
          'org_id', org_id,
          'reason', reason,
          'failed_at', new Date().toISOString(),
          'delivery_count', String(deliveryCount),
        )
        // Ack from main stream to remove from PEL
        await this.redis.xack(streamKey, CONSUMER_GROUP, messageId)
      } else {
        // Leave in PEL — will be picked up by XAUTOCLAIM / next XREADGROUP pending pass
        // Update delivery metadata by claiming and re-adding to stream
        // ioredis XCLAIM sets the delivery count; we just log and leave it pending
        console.warn(
          `[RedisStreamProvider] nack: msg ${messageId} for org ${org_id} — attempt ${deliveryCount}/${MAX_RETRIES} — reason: ${reason}`,
        )
      }
    } catch (err) {
      console.error('[RedisStreamProvider] nack error:', err)
      throw err
    }
  }

  // ── getHealth ──────────────────────────────────────────────────────────────

  async getHealth(): Promise<QueueHealth> {
    try {
      const start = Date.now()
      await this.redis.ping()
      const latency = Date.now() - start

      // Sample lag from a few known org streams (if any)
      // We use the global keyspace to estimate overall lag
      let totalLag = 0
      let dlqTotal = 0

      try {
        const streamKeys = await this.redis.keys(`${STREAM_PREFIX}:*`)
        for (const key of streamKeys) {
          const len = await this.redis.xlen(key)
          totalLag += len
        }
        const dlqKeys = await this.redis.keys(`${DLQ_PREFIX}:*`)
        for (const key of dlqKeys) {
          const len = await this.redis.xlen(key)
          dlqTotal += len
        }
      } catch {
        // Non-fatal — partial health
      }

      let status: QueueHealth['status'] = 'healthy'
      if (latency > 500 || totalLag > 5000) status = 'degraded'
      if (latency > 2000) status = 'unavailable'

      return {
        provider: this.PROVIDER,
        status,
        lag: totalLag,
        dlq_count: dlqTotal,
        latency_p50: latency,
        latency_p95: latency * 1.5,
        latency_p99: latency * 2,
      }
    } catch (err) {
      console.error('[RedisStreamProvider] getHealth error:', err)
      return {
        provider: this.PROVIDER,
        status: 'unavailable',
        lag: 0,
        dlq_count: 0,
        latency_p50: 0,
        latency_p95: 0,
        latency_p99: 0,
      }
    }
  }

  // ── getMetrics ─────────────────────────────────────────────────────────────

  async getMetrics(org_id?: string): Promise<QueueMetrics> {
    try {
      let streamLen = 0
      let pendingCount = 0
      let dlqLen = 0

      if (org_id) {
        const key = this.streamKey(org_id)
        const dlqKey = this.dlqKey(org_id)

        streamLen = await this.redis.xlen(key).catch(() => 0)
        dlqLen = await this.redis.xlen(dlqKey).catch(() => 0)

        try {
          const pendingSummary = await this.redis.xpending(key, CONSUMER_GROUP) as
            | [number, string, string, [string, string][]]
            | null
          pendingCount = pendingSummary?.[0] ?? 0
        } catch {
          pendingCount = 0
        }
      } else {
        const streamKeys = await this.redis.keys(`${STREAM_PREFIX}:*`).catch(() => [] as string[])
        const dlqKeys = await this.redis.keys(`${DLQ_PREFIX}:*`).catch(() => [] as string[])

        for (const k of streamKeys) streamLen += await this.redis.xlen(k).catch(() => 0)
        for (const k of dlqKeys) dlqLen += await this.redis.xlen(k).catch(() => 0)
      }

      return {
        provider: this.PROVIDER,
        org_id,
        enqueued_total: streamLen,
        dequeued_total: streamLen - pendingCount,
        ack_total: streamLen - pendingCount - dlqLen,
        nack_total: dlqLen,
        dlq_total: dlqLen,
        replay_total: 0,
        lag: pendingCount,
        throughput_per_min: 0, // computed externally by QueueMetricsCollector
        partition_count: 1,
        consumer_count: 1,
      }
    } catch (err) {
      console.error('[RedisStreamProvider] getMetrics error:', err)
      return {
        provider: this.PROVIDER,
        org_id,
        enqueued_total: 0,
        dequeued_total: 0,
        ack_total: 0,
        nack_total: 0,
        dlq_total: 0,
        replay_total: 0,
        lag: 0,
        throughput_per_min: 0,
        partition_count: 1,
        consumer_count: 1,
      }
    }
  }

  // ── replay ─────────────────────────────────────────────────────────────────

  async replay(opts: ReplayOptions): Promise<number> {
    try {
      const orgIds = opts.org_id ? [opts.org_id] : []

      if (orgIds.length === 0) {
        // Discover all orgs from DLQ keys
        const dlqKeys = await this.redis.keys(`${DLQ_PREFIX}:*`)
        for (const key of dlqKeys) {
          const org = key.replace(`${DLQ_PREFIX}:`, '')
          orgIds.push(org)
        }
      }

      if (orgIds.length === 0) return 0

      let totalReplayed = 0
      const limit = opts.limit ?? 1000

      for (const org of orgIds) {
        if (opts.dry_run) {
          const len = await this.redis.xlen(this.dlqKey(org)).catch(() => 0)
          totalReplayed += Math.min(len, limit)
          continue
        }

        const entries = await this.redis.xrange(
          this.dlqKey(org),
          opts.from_timestamp ?? '-',
          opts.to_timestamp ?? '+',
          'COUNT', String(limit),
        ) as [string, string[]][]

        for (const [, fields] of entries) {
          const event = fieldsToEvent(fields)
          if (event) {
            try {
              await this.enqueue({ ...event, retry_count: 0 })
              await this.redis.xdel(this.dlqKey(org), fields[0])
              totalReplayed++
            } catch {
              // Continue with remaining events
            }
          }
        }
      }

      return totalReplayed
    } catch (err) {
      console.error('[RedisStreamProvider] replay error:', err)
      return 0
    }
  }

  // ── close ──────────────────────────────────────────────────────────────────

  async close(): Promise<void> {
    try {
      await this.redis.quit()
    } catch (err) {
      console.error('[RedisStreamProvider] close error:', err)
      // Force disconnect if quit fails
      this.redis.disconnect()
    }
  }
}
