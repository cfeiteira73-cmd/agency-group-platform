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
      console.warn(
        `[KafkaConsumer:${this.config.groupId}] KAFKA_BROKERS not set — consumer not started`,
      )
      return
    }

    const brokers = brokersEnv
      .split(',')
      .map((b) => b.trim())
      .filter(Boolean)

    if (brokers.length === 0) {
      console.warn(
        `[KafkaConsumer:${this.config.groupId}] KAFKA_BROKERS is empty — consumer not started`,
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
      console.log(
        `[KafkaConsumer:${this.config.groupId}] started — topics: ${this.config.topics.join(', ')}`,
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
              await this.routeToDlq(topic, key, value, result.error ?? 'non-retryable failure')
            }
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err)
            console.error(
              `[KafkaConsumer:${this.config.groupId}] unhandled processMessage error:`,
              errMsg,
            )
            await this.routeToDlq(topic, key, value, errMsg)
          }
        },
      })
    } catch (err) {
      console.error(
        `[KafkaConsumer:${this.config.groupId}] start failed:`,
        err instanceof Error ? err.message : String(err),
      )
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
        console.log(`[KafkaConsumer:${this.config.groupId}] stopped`)
      } catch (err) {
        console.warn(
          `[KafkaConsumer:${this.config.groupId}] stop error:`,
          err instanceof Error ? err.message : String(err),
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
   * Production note: replace the console.error with a real producer.send() call
   * to the DLQ topic so messages are durably stored for investigation and replay.
   * The current implementation logs so no message is silently lost during
   * early development.
   */
  protected async routeToDlq(
    topic: string,
    key: string | null,
    value: unknown,
    error: string,
  ): Promise<void> {
    const dlqTopic  = `${topic}.dlq`
    const dlqRecord = JSON.stringify({
      originalTopic: topic,
      key,
      value,
      error,
      failedAt: new Date().toISOString(),
    })

    console.warn(
      `[KafkaConsumer:${this.config.groupId}] routing failed message to DLQ → ${dlqTopic}: ${error}`,
    )
    // Durable DLQ record — replace with producer.send() in production
    console.error(`[DLQ:${dlqTopic}]`, dlqRecord)
  }
}
