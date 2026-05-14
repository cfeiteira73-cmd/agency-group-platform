// AGENCY GROUP — SH-ROS Queue: queueProvider | AMI: 22506
// Abstract interface + factory for the distributed event queue infrastructure.
// Persist-before-execute: events are saved to runtime_events BEFORE agents run.

import type { RuntimeEvent, RuntimeEventType } from '@/lib/runtime/types'

// ─── QueueHealth ─────────────────────────────────────────────────────────────

export interface QueueHealth {
  provider: string
  status: 'healthy' | 'degraded' | 'unavailable'
  lag: number
  dlq_count: number
  latency_p50: number
  latency_p95: number
  latency_p99: number
}

// ─── QueueMetrics ─────────────────────────────────────────────────────────────

export interface QueueMetrics {
  provider: string
  org_id?: string
  enqueued_total: number
  dequeued_total: number
  ack_total: number
  nack_total: number
  dlq_total: number
  replay_total: number
  lag: number
  throughput_per_min: number
  partition_count: number
  consumer_count: number
}

// ─── ReplayOptions ────────────────────────────────────────────────────────────

export interface ReplayOptions {
  org_id?: string
  trace_id?: string
  event_chain?: string[]
  from_timestamp?: string
  to_timestamp?: string
  event_types?: RuntimeEventType[]
  limit?: number
  dry_run?: boolean
}

// ─── IQueueProvider ──────────────────────────────────────────────────────────

export interface IQueueProvider {
  /** Enqueue an event. Returns the message ID assigned by the provider. */
  enqueue(event: RuntimeEvent): Promise<string>

  /** Dequeue up to `count` events for a given org (default 10). */
  dequeue(org_id: string, count?: number): Promise<RuntimeEvent[]>

  /** Acknowledge successful processing of a message. */
  ack(messageId: string, org_id: string): Promise<void>

  /** Negative-acknowledge — marks failure, moves to DLQ if max retries exceeded. */
  nack(messageId: string, org_id: string, reason: string): Promise<void>

  /** Return current health snapshot of the queue backend. */
  getHealth(): Promise<QueueHealth>

  /** Return aggregate metrics, optionally scoped to an org. */
  getMetrics(org_id?: string): Promise<QueueMetrics>

  /**
   * Replay events matching the given options.
   * Returns the count of events re-enqueued.
   */
  replay(opts: ReplayOptions): Promise<number>

  /** Gracefully close connections. */
  close(): Promise<void>
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Returns the best available queue provider:
 *  1. RedisStreamProvider — if REDIS_URL is set and Redis is reachable
 *  2. DBFallbackProvider  — always available, backed by Supabase runtime_events
 *
 * NOTE: KafkaProvider is not included in the auto-factory because it requires
 * explicit topic provisioning. Instantiate KafkaProvider directly when needed.
 */
export function createQueueProvider(): IQueueProvider {
  if (process.env.REDIS_URL) {
    try {
      // Lazy import so the module can load even when ioredis is not installed.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { RedisStreamProvider } = require('./redisStreamProvider') as {
        RedisStreamProvider: new () => IQueueProvider
      }
      return new RedisStreamProvider()
    } catch (err) {
      console.error('[QueueFactory] Redis provider failed to initialise — falling back to DB:', err)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { DBFallbackProvider } = require('./dbFallbackProvider') as {
    DBFallbackProvider: new () => IQueueProvider
  }
  return new DBFallbackProvider()
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const queueProvider: IQueueProvider = createQueueProvider()
