// Agency Group — Idempotent Consumer Mixin
// lib/events/idempotentConsumer.ts
// TypeScript strict — 0 errors
//
// Extends KafkaConsumerBase with Redis-backed deduplication.
// Messages seen within TTL window are skipped and acked.
// Falls back to processing if Redis is unavailable (prefer at-least-once over at-most-once).

import { KafkaConsumerBase, type ConsumerConfig, type ConsumeResult } from './kafkaConsumerBase'

export interface IdempotentConsumerConfig extends ConsumerConfig {
  /** How long to remember a processed message offset. Default: 3600 (1 hour). */
  deduplicationTtlSeconds?: number
  /** Redis key prefix for the seen-set. Default: 'kafka:seen'. */
  redisKeyPrefix?: string
}

// ─── Upstash REST response shape ─────────────────────────────────────────────

interface UpstashSetResponse {
  result: string | null
}

// ─── Abstract base with deduplication ────────────────────────────────────────

/**
 * IdempotentKafkaConsumer wraps every incoming message with a Redis check
 * keyed by `${keyPrefix}:${topic}:${partition}:${offset}`.
 *
 * On partition rebalance Kafka may re-deliver messages already committed.
 * This class prevents double-processing of idempotency-sensitive operations
 * such as commission calculations and deal stage transitions.
 *
 * Subclasses implement `processUniqueMessage` instead of `processMessage`.
 *
 * ```ts
 * class CommissionConsumer extends IdempotentKafkaConsumer {
 *   async processUniqueMessage(topic, partition, offset, key, value) {
 *     // runs at-most-once per offset within the TTL window
 *     return { success: true, retryable: false }
 *   }
 * }
 * ```
 */
export abstract class IdempotentKafkaConsumer extends KafkaConsumerBase {
  private readonly ttl: number
  private readonly keyPrefix: string

  constructor(config: IdempotentConsumerConfig) {
    super(config)
    this.ttl = config.deduplicationTtlSeconds ?? 3600
    this.keyPrefix = config.redisKeyPrefix ?? 'kafka:seen'
  }

  /**
   * Override of KafkaConsumerBase.processMessage.
   * Checks the Redis seen-set before delegating to processUniqueMessage.
   * Duplicate messages return `{ success: true, retryable: false }` so the
   * base class auto-acks them without routing to DLQ.
   */
  override async processMessage(
    topic: string,
    partition: number,
    offset: string,
    key: string | null,
    value: unknown,
  ): Promise<ConsumeResult> {
    const seen = await this.checkAndMarkSeen(topic, partition, offset)
    if (seen) {
      // Already processed within TTL window — safe to ack without re-processing
      console.debug(
        `[IdempotentConsumer:${this.config.groupId}] duplicate skipped — ${topic}:${partition}:${offset}`,
      )
      return { success: true, retryable: false }
    }
    return this.processUniqueMessage(topic, partition, offset, key, value)
  }

  /**
   * Subclasses implement this method instead of `processMessage`.
   * Guaranteed to be called at-most-once per `(topic, partition, offset)` tuple
   * within the deduplication TTL window.
   */
  abstract processUniqueMessage(
    topic: string,
    partition: number,
    offset: string,
    key: string | null,
    value: unknown,
  ): Promise<ConsumeResult>

  // ─── Private: Redis deduplication ──────────────────────────────────────────

  /**
   * Attempts a Redis SET NX EX to mark the offset as seen.
   *
   * Returns:
   *  - `true`  → key already existed (duplicate — skip processing)
   *  - `false` → key was new (first delivery — process normally)
   *            → or Redis unavailable (fallback: process to preserve at-least-once)
   */
  private async checkAndMarkSeen(
    topic: string,
    partition: number,
    offset: string,
  ): Promise<boolean> {
    const redisUrl   = process.env.UPSTASH_REDIS_REST_URL
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN

    if (!redisUrl || !redisToken) {
      // No Redis configured — deduplication disabled, fall through to processing
      return false
    }

    const seenKey = `${this.keyPrefix}:${topic}:${partition}:${offset}`

    try {
      // Upstash REST: SET key 1 NX EX <ttl>
      // Returns 'OK' when key is NEW (not seen before)
      // Returns null when key already EXISTS (duplicate)
      const url = `${redisUrl}/set/${encodeURIComponent(seenKey)}/1/nx/ex/${this.ttl}`
      const response = await fetch(url, {
        method:  'GET',
        headers: { Authorization: `Bearer ${redisToken}` },
      })

      if (!response.ok) {
        // Redis returned a non-2xx — treat as unavailable, process the message
        console.warn(
          `[IdempotentConsumer:${this.config.groupId}] Redis SET returned ${response.status} — processing message anyway`,
        )
        return false
      }

      const body = await response.json() as UpstashSetResponse

      // SET NX: result === 'OK' means key was just created (first time) → NOT a duplicate
      //         result === null means key existed already                → IS a duplicate
      return body.result === null
    } catch (err) {
      // Network or JSON parse error — fallback to at-least-once processing
      console.warn(
        `[IdempotentConsumer:${this.config.groupId}] Redis check failed (${
          err instanceof Error ? err.message : String(err)
        }) — processing message anyway`,
      )
      return false
    }
  }
}
