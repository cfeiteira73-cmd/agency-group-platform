// =============================================================================
// Agency Group — Kafka Consumer Base Class
// lib/events/kafkaConsumerBase.ts
//
// Abstract base for all Kafka/Redpanda consumers in the SH-ROS platform.
// - Dynamic import of kafkajs (zero cost when KAFKA_BROKERS not set)
// - Configurable retry + DLQ routing on non-retryable failures
// - Graceful start / stop lifecycle
//
// TypeScript strict — 0 errors
// =============================================================================

import { dlqProducer, DLQProducer } from './dlqProducer'
import log from '@/lib/logger'
import { supabaseAdmin } from '@/lib/supabase'

// ─── Public interfaces ────────────────────────────────────────────────────────

export interface ConsumerConfig {
  /** Kafka consumer group ID */
  groupId: string
  /** Topics to subscribe to */
  topics: string[]
  /** Whether to start consuming from the earliest offset (default: false) */
  fromBeginning?: boolean
  /** Kafka session timeout in ms (default: 30 000) */
  sessionTimeoutMs?: number
  /** Kafka heartbeat interval in ms (default: 3 000) */
  heartbeatIntervalMs?: number
  /** Max message processing retries before routing to DLQ (unused in base — reserved for subclasses) */
  maxRetries?: number
}

export interface ConsumeResult {
  /** Whether the message was processed successfully */
  success: boolean
  /**
   * If success is false, indicates whether the error is transient and the
   * message can be retried. Non-retryable messages go straight to DLQ.
   */
  retryable: boolean
  /** Human-readable error description when success is false */
  error?: string
}

// ─── kafkajs internal types (minimal surface for dynamic import) ──────────────

interface KafkaMessage {
  offset: string
  key: Buffer | null
  value: Buffer | null
}

interface EachMessagePayload {
  topic: string
  partition: number
  message: KafkaMessage
}

interface KafkaConsumerInstance {
  connect(): Promise<void>
  subscribe(opts: { topics: string[]; fromBeginning?: boolean }): Promise<void>
  run(opts: { eachMessage: (payload: EachMessagePayload) => Promise<void> }): Promise<void>
  disconnect(): Promise<void>
}

// ─── Abstract base class ──────────────────────────────────────────────────────

/**
 * Extend this class to build a typed consumer for a specific domain.
 *
 * ```ts
 * class PropertyConsumer extends KafkaConsumerBase {
 *   async processMessage(topic, partition, offset, key, value) {
 *     // process value …
 *     return { success: true, retryable: false }
 *   }
 * }
 * ```
 */
export abstract class KafkaConsumerBase {
  protected readonly config: ConsumerConfig
  private consumer: KafkaConsumerInstance | null = null
  private running = false

  constructor(config: ConsumerConfig) {
    this.config = config
  }

  /**
   * Called once per Kafka message.
   *
   * @param topic     - Topic the message was consumed from
   * @param partition - Partition number
   * @param offset    - Message offset (string, as Kafka returns it)
   * @param key       - Message key, or null if none
   * @param value     - Parsed message value (JSON.parse attempted; falls back to raw string)
   * @returns ConsumeResult indicating success or failure disposition
   */
  abstract processMessage(
    topic: string,
    partition: number,
    offset: string,
    key: string | null,
    value: unknown,
  ): Promise<ConsumeResult>

  /**
   * Connect to Kafka and begin consuming messages.
   * No-ops gracefully when KAFKA_BROKERS is not set.
   */
  async start(): Promise<void> {
    const brokersEnv = process.env.KAFKA_BROKERS
    if (!brokersEnv) {
      log.warn(
        `[KafkaConsumer:${this.config.groupId}] KAFKA_BROKERS not set — consumer not started`,
        { group_id: this.config.groupId },
      )
      return
    }

    const brokers = brokersEnv
      .split(',')
      .map((b) => b.trim())
      .filter(Boolean)

    if (brokers.length === 0) {
      log.warn(
        `[KafkaConsumer:${this.config.groupId}] KAFKA_BROKERS is empty — consumer not started`,
        { group_id: this.config.groupId },
      )
      return
    }

    try {
      const { Kafka, logLevel } = await import('kafkajs')

      const kafka = new Kafka({
        clientId: `ag-${this.config.groupId}`,
        brokers,
        logLevel: logLevel.WARN,
        retry: { initialRetryTime: 300, retries: 5 },
      })

      // Cast to our minimal interface — kafkajs types are complex and the
      // dynamic-import return type cannot be inferred without a type declaration.
      this.consumer = kafka.consumer({
        groupId:           this.config.groupId,
        sessionTimeout:    this.config.sessionTimeoutMs    ?? 30_000,
        heartbeatInterval: this.config.heartbeatIntervalMs ?? 3_000,
      }) as unknown as KafkaConsumerInstance

      await this.consumer.connect()
      await this.consumer.subscribe({
        topics:        this.config.topics,
        fromBeginning: this.config.fromBeginning ?? false,
      })

      this.running = true
      log.info(
        `[KafkaConsumer:${this.config.groupId}] started — topics: ${this.config.topics.join(', ')}`,
        { group_id: this.config.groupId, topics: this.config.topics },
      )

      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }: EachMessagePayload) => {
          const key   = message.key?.toString() ?? null
          let value: unknown

          try {
            value = JSON.parse(message.value?.toString() ?? 'null')
          } catch {
            value = message.value?.toString() ?? null
          }

          try {
            const result = await this.processMessage(
              topic,
              partition,
              message.offset,
              key,
              value,
            )

            if (!result.success && !result.retryable) {
              await this.routeToDlq(
                topic, partition, message.offset, key, value,
                result.error ?? 'non-retryable failure', 0,
              )
            }
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err)
            log.error(
              `[KafkaConsumer:${this.config.groupId}] unhandled processMessage error`,
              err instanceof Error ? err : undefined,
              { topic, partition, offset: message.offset, error: errMsg },
            )
            await this.routeToDlq(
              topic, partition, message.offset, key, value, errMsg, 0,
            )
          }
        },
      })
    } catch (err) {
      log.error(
        `[KafkaConsumer:${this.config.groupId}] start failed — consumer is DEAD`,
        err instanceof Error ? err : undefined,
        { group_id: this.config.groupId, error: err instanceof Error ? err.message : String(err) },
      )
      // Persist a durable signal so monitoring can detect silent consumer death
      void (supabaseAdmin as any)
        .from('system_health_alerts')
        .insert({
          alert_type:  'kafka_consumer_start_failure',
          service:     `kafka-consumer-${this.config.groupId}`,
          message:     `Consumer failed to start: ${err instanceof Error ? err.message : String(err)}`,
          severity:    'critical',
          metadata:    { group_id: this.config.groupId, topics: this.config.topics },
          occurred_at: new Date().toISOString(),
        })
        .catch(() => { /* best-effort */ })
    }
  }

  /**
   * Gracefully disconnect from Kafka.
   * Safe to call even if start() was never invoked.
   */
  async stop(): Promise<void> {
    this.running = false
    if (this.consumer) {
      try {
        await this.consumer.disconnect()
        log.info(`[KafkaConsumer:${this.config.groupId}] stopped`, { group_id: this.config.groupId })
      } catch (err) {
        log.warn(
          `[KafkaConsumer:${this.config.groupId}] stop error`,
          { group_id: this.config.groupId, error: err instanceof Error ? err.message : String(err) },
        )
      } finally {
        this.consumer = null
      }
    }
  }

  /** Returns true while the consumer is connected and running. */
  isRunning(): boolean {
    return this.running
  }

  /**
   * Routes a failed message to its DLQ topic (`{originalTopic}.dlq`).
   *
   * Publishes via dlqProducer (KafkaJS → Supabase fallback).
   * Never throws — a secondary error during DLQ routing is logged and swallowed
   * so the consumer offset is still committed and processing continues.
   */
  protected async routeToDlq(
    topic:     string,
    partition: number,
    offset:    string,
    key:       string | null,
    value:     unknown,
    error:     string,
    retryCount: number,
  ): Promise<void> {
    const dlqMsg = DLQProducer.buildDLQMessage(
      topic,
      partition,
      offset,
      this.config.groupId,
      value,
      new Error(error),
      retryCount,
    )

    await dlqProducer.publish(dlqMsg)
      .catch(e => log.error(
        '[consumer] DLQ publish failed',
        e instanceof Error ? e : undefined,
        { topic, event_id: dlqMsg.event_id },
      ))
  }
}
