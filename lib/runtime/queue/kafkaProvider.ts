// AGENCY GROUP — SH-ROS Queue: kafkaProvider | AMI: 22506
// Kafka implementation using kafkajs.
// Priority-partitioned topics, GZIP compression, idempotent producer, per-org partition key.

import { Kafka, logLevel, CompressionTypes, type Producer, type Consumer, type Admin } from 'kafkajs'
import type { RuntimeEvent } from '@/lib/runtime/types'
import type {
  IQueueProvider,
  QueueHealth,
  QueueMetrics,
  ReplayOptions,
} from './queueProvider'

// ─── Constants ────────────────────────────────────────────────────────────────

const CONSUMER_GROUP = 'sh-ros-agents'
const DLQ_TOPIC = 'sh-ros-dlq'
const PRIORITY_TOPICS: Record<RuntimeEvent['priority'], string> = {
  critical: 'sh-ros-events-critical',
  high: 'sh-ros-events-high',
  medium: 'sh-ros-events-medium',
  low: 'sh-ros-events-low',
}
const ALL_TOPICS = [...Object.values(PRIORITY_TOPICS), DLQ_TOPIC]

// ─── KafkaProvider ────────────────────────────────────────────────────────────

export class KafkaProvider implements IQueueProvider {
  private readonly kafka: Kafka
  private producer: Producer | null = null
  private consumer: Consumer | null = null
  private admin: Admin | null = null
  private readonly PROVIDER = 'kafka'

  constructor() {
    const brokers = process.env.KAFKA_BROKERS
    if (!brokers) {
      throw new Error('[KafkaProvider] KAFKA_BROKERS is not set')
    }

    this.kafka = new Kafka({
      clientId: process.env.KAFKA_CLIENT_ID ?? 'agency-group-sh-ros',
      brokers: brokers.split(',').map((b) => b.trim()),
      logLevel: logLevel.ERROR,
      retry: {
        retries: 5,
        initialRetryTime: 300,
        factor: 1.5,
      },
    })
  }

  // ─── Lazy init helpers ────────────────────────────────────────────────────

  private async getProducer(): Promise<Producer> {
    if (!this.producer) {
      this.producer = this.kafka.producer({
        idempotent: true,
        maxInFlightRequests: 5,
        transactionalId: `sh-ros-producer-${process.pid}`,
      })
      await this.producer.connect()
    }
    return this.producer
  }

  private async getConsumer(): Promise<Consumer> {
    if (!this.consumer) {
      this.consumer = this.kafka.consumer({
        groupId: CONSUMER_GROUP,
        sessionTimeout: 30_000,
        heartbeatInterval: 3_000,
        maxWaitTimeInMs: 5_000,
      })
      await this.consumer.connect()
      await this.consumer.subscribe({
        topics: Object.values(PRIORITY_TOPICS),
        fromBeginning: false,
      })
    }
    return this.consumer
  }

  private async getAdmin(): Promise<Admin> {
    if (!this.admin) {
      this.admin = this.kafka.admin()
      await this.admin.connect()
    }
    return this.admin
  }

  // ─── Partition key: deterministic by org_id ───────────────────────────────

  private partitionKey(org_id: string): string {
    return org_id
  }

  // ── enqueue ────────────────────────────────────────────────────────────────

  async enqueue(event: RuntimeEvent): Promise<string> {
    try {
      const producer = await this.getProducer()
      const topic = PRIORITY_TOPICS[event.priority]

      const result = await producer.send({
        topic,
        compression: CompressionTypes.GZIP,
        messages: [
          {
            key: this.partitionKey(event.org_id),
            value: JSON.stringify(event),
            headers: {
              event_id: event.event_id,
              org_id: event.org_id,
              type: event.type,
              trace_id: event.metadata.trace_id,
              schema_version: event.metadata.schema_version,
            },
          },
        ],
      })

      const meta = result[0]
      if (!meta) throw new Error('[KafkaProvider] No record metadata returned from send')

      // Composite message ID: topic:partition:offset
      return `${topic}:${meta.partition}:${meta.baseOffset}`
    } catch (err) {
      console.error('[KafkaProvider] enqueue error:', err)
      throw err
    }
  }

  // ── dequeue ────────────────────────────────────────────────────────────────
  // Kafka consumer is pull-based via run(). This method starts a bounded batch run.

  async dequeue(org_id: string, count = 10): Promise<RuntimeEvent[]> {
    const collected: RuntimeEvent[] = []
    let resolved = false

    try {
      const consumer = await this.getConsumer()

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true
            resolve()
          }
        }, 5_000)

        consumer
          .run({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            eachBatch: async ({ batch, resolveOffset, heartbeat, isRunning }: any) => {
              for (const message of batch.messages) {
                if (!isRunning() || collected.length >= count) break

                if (message.value) {
                  try {
                    const raw = JSON.parse(message.value.toString()) as unknown
                    if (isRuntimeEvent(raw) && raw.org_id === org_id) {
                      collected.push(raw)
                      resolveOffset(message.offset)
                      await heartbeat()
                    }
                  } catch {
                    // Skip malformed messages
                  }
                }

                if (collected.length >= count) {
                  clearTimeout(timeout)
                  if (!resolved) {
                    resolved = true
                    resolve()
                  }
                  break
                }
              }
            },
          })
          .catch((err: unknown) => {
            if (!resolved) {
              resolved = true
              clearTimeout(timeout)
              reject(err)
            }
          })
      })

      return collected
    } catch (err) {
      console.error('[KafkaProvider] dequeue error:', err)
      return collected
    }
  }

  // ── ack ────────────────────────────────────────────────────────────────────
  // In Kafka, acks are implicit via commitOffsets. Here we accept the composite ID.

  async ack(messageId: string, _org_id: string): Promise<void> {
    try {
      if (!this.consumer) return
      const parts = messageId.split(':')
      if (parts.length !== 3) return

      const [topic, partition, offset] = parts
      await this.consumer.commitOffsets([
        { topic: topic!, partition: parseInt(partition!, 10), offset: String(parseInt(offset!, 10) + 1) },
      ])
    } catch (err) {
      console.error('[KafkaProvider] ack error:', err)
      throw err
    }
  }

  // ── nack ───────────────────────────────────────────────────────────────────

  async nack(messageId: string, org_id: string, reason: string): Promise<void> {
    try {
      const producer = await this.getProducer()

      await producer.send({
        topic: DLQ_TOPIC,
        compression: CompressionTypes.GZIP,
        messages: [
          {
            key: this.partitionKey(org_id),
            value: JSON.stringify({
              original_message_id: messageId,
              org_id,
              reason,
              failed_at: new Date().toISOString(),
            }),
            headers: {
              org_id,
              reason,
            },
          },
        ],
      })
    } catch (err) {
      console.error('[KafkaProvider] nack error:', err)
      throw err
    }
  }

  // ── getHealth ──────────────────────────────────────────────────────────────

  async getHealth(): Promise<QueueHealth> {
    try {
      const admin = await this.getAdmin()
      const start = Date.now()
      const topics = await admin.listTopics()
      const latency = Date.now() - start

      const hasAllTopics = ALL_TOPICS.every((t) => topics.includes(t))
      let lag = 0

      try {
        const offsets = await admin.fetchTopicOffsets(PRIORITY_TOPICS['critical'])
        lag = offsets.reduce((acc, p) => acc + parseInt(p.high, 10) - parseInt(p.low, 10), 0)
      } catch {
        // Non-fatal
      }

      let dlqLen = 0
      try {
        const dlqOffsets = await admin.fetchTopicOffsets(DLQ_TOPIC)
        dlqLen = dlqOffsets.reduce((acc, p) => acc + parseInt(p.high, 10) - parseInt(p.low, 10), 0)
      } catch {
        // Non-fatal
      }

      const status: QueueHealth['status'] = !hasAllTopics || latency > 2000
        ? 'degraded'
        : latency < 200
          ? 'healthy'
          : 'degraded'

      return {
        provider: this.PROVIDER,
        status,
        lag,
        dlq_count: dlqLen,
        latency_p50: latency,
        latency_p95: latency * 1.5,
        latency_p99: latency * 2,
      }
    } catch (err) {
      console.error('[KafkaProvider] getHealth error:', err)
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
      const admin = await this.getAdmin()

      let totalEnqueued = 0
      let totalLag = 0
      let partitionCount = 0
      let dlqTotal = 0

      for (const topic of Object.values(PRIORITY_TOPICS)) {
        try {
          const offsets = await admin.fetchTopicOffsets(topic)
          partitionCount += offsets.length
          for (const p of offsets) {
            totalEnqueued += parseInt(p.high, 10)
          }

          if (org_id) {
            const groupOffsets = await admin.fetchOffsets({ groupId: CONSUMER_GROUP, topics: [topic] })
            for (const t of groupOffsets) {
              for (const p of t.partitions) {
                const topicOffsets = await admin.fetchTopicOffsets(topic)
                const partition = topicOffsets.find((o) => o.partition === p.partition)
                if (partition) {
                  totalLag += Math.max(0, parseInt(partition.high, 10) - parseInt(p.offset, 10))
                }
              }
            }
          }
        } catch {
          // Non-fatal
        }
      }

      try {
        const dlqOffsets = await admin.fetchTopicOffsets(DLQ_TOPIC)
        dlqTotal = dlqOffsets.reduce((acc, p) => acc + parseInt(p.high, 10) - parseInt(p.low, 10), 0)
      } catch {
        // Non-fatal
      }

      return {
        provider: this.PROVIDER,
        org_id,
        enqueued_total: totalEnqueued,
        dequeued_total: totalEnqueued - totalLag,
        ack_total: totalEnqueued - totalLag - dlqTotal,
        nack_total: dlqTotal,
        dlq_total: dlqTotal,
        replay_total: 0,
        lag: totalLag,
        throughput_per_min: 0,
        partition_count: partitionCount,
        consumer_count: 1,
      }
    } catch (err) {
      console.error('[KafkaProvider] getMetrics error:', err)
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
        partition_count: 0,
        consumer_count: 0,
      }
    }
  }

  // ── replay ─────────────────────────────────────────────────────────────────

  async replay(opts: ReplayOptions): Promise<number> {
    try {
      if (opts.dry_run) {
        const admin = await this.getAdmin()
        const dlqOffsets = await admin.fetchTopicOffsets(DLQ_TOPIC)
        const total = dlqOffsets.reduce((acc, p) => acc + parseInt(p.high, 10) - parseInt(p.low, 10), 0)
        return Math.min(total, opts.limit ?? total)
      }

      // Re-produce from DLQ topic into priority topics
      // This requires a temporary consumer reading the DLQ
      const tempConsumer = this.kafka.consumer({
        groupId: `sh-ros-replay-${Date.now()}`,
        sessionTimeout: 30_000,
      })

      await tempConsumer.connect()
      await tempConsumer.subscribe({ topic: DLQ_TOPIC, fromBeginning: true })

      const producer = await this.getProducer()
      let replayed = 0
      const limit = opts.limit ?? 1000

      await new Promise<void>((resolve) => {
        let done = false

        const finish = () => {
          if (!done) {
            done = true
            resolve()
          }
        }

        tempConsumer
          .run({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            eachMessage: async ({ message }: any) => {
              if (replayed >= limit) {
                finish()
                return
              }

              if (!message.value) return

              try {
                const raw = JSON.parse(message.value.toString()) as unknown

                if (isRuntimeEvent(raw)) {
                  if (opts.org_id && raw.org_id !== opts.org_id) return
                  if (opts.event_types?.length && !opts.event_types.includes(raw.type)) return

                  const topic = PRIORITY_TOPICS[raw.priority]
                  await producer.send({
                    topic,
                    compression: CompressionTypes.GZIP,
                    messages: [
                      {
                        key: this.partitionKey(raw.org_id),
                        value: JSON.stringify({ ...raw, retry_count: 0 }),
                      },
                    ],
                  })
                  replayed++
                }
              } catch {
                // Skip malformed
              }

              if (replayed >= limit) finish()
            },
          })
          .catch(finish)

        setTimeout(finish, 10_000)
      })

      await tempConsumer.disconnect()
      return replayed
    } catch (err) {
      console.error('[KafkaProvider] replay error:', err)
      return 0
    }
  }

  // ── close ──────────────────────────────────────────────────────────────────

  async close(): Promise<void> {
    try {
      await Promise.allSettled([
        this.producer?.disconnect(),
        this.consumer?.disconnect(),
        this.admin?.disconnect(),
      ])
    } catch (err) {
      console.error('[KafkaProvider] close error:', err)
    }
  }
}

// ─── Type guard ───────────────────────────────────────────────────────────────

function isRuntimeEvent(value: unknown): value is RuntimeEvent {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v['event_id'] === 'string' &&
    typeof v['org_id'] === 'string' &&
    typeof v['type'] === 'string' &&
    typeof v['priority'] === 'string' &&
    typeof v['retry_count'] === 'number'
  )
}
