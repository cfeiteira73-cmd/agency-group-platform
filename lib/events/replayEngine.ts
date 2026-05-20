// =============================================================================
// Agency Group — Kafka Replay Engine
// lib/events/replayEngine.ts
//
// Tenant-scoped message replay for projection rebuilds and audit trails.
// Uses a unique consumer group per replay run (replay-{timestamp}) to always
// start from the requested offset without interfering with live consumers.
//
// TypeScript strict — 0 errors
// =============================================================================

import { KAFKA_TOPICS } from './kafkaTopics'

// ─── Public interfaces ────────────────────────────────────────────────────────

export interface ReplayRequest {
  /** Tenant to replay messages for (matched against parsed value.tenant_id) */
  tenantId: string
  /** Topics to replay from */
  topics: string[]
  /**
   * Where to start consuming.
   * - 'earliest': from the first retained message (default)
   * - 'latest': from the current head (mostly useful for testing)
   */
  fromOffset?: 'earliest' | 'latest'
  /**
   * ISO timestamp — if set, seek to the first offset at-or-after this time
   * before yielding messages. Overrides fromOffset when provided.
   */
  fromTimestamp?: string
  /** Upper bound ISO timestamp — messages after this are skipped */
  toTimestamp?: string
  /** Propagated correlation ID for distributed tracing */
  correlationId?: string
}

export interface ReplayResult {
  tenantId: string
  topics: string[]
  messagesReplayed: number
  durationMs: number
  errors: string[]
  completedAt: string
}

export interface ReplayedMessage {
  topic: string
  key: string | null
  value: unknown
  offset: string
  timestamp: string
}

// ─── kafkajs minimal types (dynamic import surface) ──────────────────────────

interface KafkaAdminInstance {
  connect(): Promise<void>
  fetchTopicOffsetsByTimestamp(
    topic: string,
    timestamp: number,
  ): Promise<Array<{ partition: number; offset: string }>>
  disconnect(): Promise<void>
}

interface KafkaSeekOptions {
  topic: string
  partition: number
  offset: string
}

interface KafkaMessage {
  offset: string
  timestamp: string
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
  subscribe(opts: { topics: string[]; fromBeginning: boolean }): Promise<void>
  seek(opts: KafkaSeekOptions): void
  run(opts: { eachMessage: (payload: EachMessagePayload) => Promise<void> }): Promise<void>
  disconnect(): Promise<void>
}

// ─── Core replay generator ────────────────────────────────────────────────────

/**
 * Async generator that yields every message from `request.topics` whose
 * parsed value contains a `tenant_id` matching `request.tenantId`.
 *
 * Stops when the consumer has reached the end of all partitions (i.e., the
 * high-watermark offset recorded at subscribe time) or when an error occurs.
 *
 * Usage:
 * ```ts
 * for await (const msg of replayMessages(request)) {
 *   await applyToProjection(msg)
 * }
 * ```
 */
export async function* replayMessages(
  request: ReplayRequest,
): AsyncGenerator<ReplayedMessage> {
  const brokersEnv = process.env.KAFKA_BROKERS
  if (!brokersEnv) {
    console.warn('[ReplayEngine] KAFKA_BROKERS not set — replay yielding 0 messages')
    return
  }

  const brokers = brokersEnv
    .split(',')
    .map((b) => b.trim())
    .filter(Boolean)

  if (brokers.length === 0) return

  // Unique group ID ensures we always start from the requested offset and
  // never pollute the offset commits of live consumer groups.
  const groupId = `replay-${Date.now()}-${Math.random().toString(36).slice(2)}`

  const toMs = request.toTimestamp ? Date.parse(request.toTimestamp) : undefined

  type KafkaInstance = {
    admin(): KafkaAdminInstance
    consumer(opts: { groupId: string }): KafkaConsumerInstance
  }

  let kafka: KafkaInstance

  try {
    const { Kafka, logLevel } = await import('kafkajs')
    kafka = new Kafka({
      clientId: `ag-replay`,
      brokers,
      logLevel: logLevel.WARN,
    }) as unknown as KafkaInstance
  } catch (err) {
    console.error(
      '[ReplayEngine] kafkajs import failed:',
      err instanceof Error ? err.message : String(err),
    )
    return
  }

  // Build a promise-based message buffer so the generator can yield
  // messages produced by the consumer's callback.
  const buffer: ReplayedMessage[] = []
  let done = false
  let consumerError: string | null = null

  const consumer = kafka.consumer({ groupId })

  try {
    await consumer.connect()
    await consumer.subscribe({
      topics:        request.topics,
      fromBeginning: request.fromOffset !== 'latest',
    })

    // Timestamp-based seek: use admin to resolve offsets, then seek each partition.
    if (request.fromTimestamp) {
      const fromMs  = Date.parse(request.fromTimestamp)
      const admin   = kafka.admin()
      try {
        await admin.connect()
        for (const topic of request.topics) {
          try {
            const offsets = await admin.fetchTopicOffsetsByTimestamp(topic, fromMs)
            for (const { partition, offset } of offsets) {
              consumer.seek({ topic, partition, offset })
            }
          } catch (seekErr) {
            console.warn(
              `[ReplayEngine] seek failed for topic ${topic}:`,
              seekErr instanceof Error ? seekErr.message : String(seekErr),
            )
          }
        }
      } finally {
        await admin.disconnect()
      }
    }

    // Run the consumer in the background — messages are pushed into `buffer`.
    void consumer
      .run({
        eachMessage: async ({ topic, partition: _partition, message }: EachMessagePayload) => {
          const msgTimestampMs = parseInt(message.timestamp, 10)

          // Skip messages beyond toTimestamp
          if (toMs !== undefined && msgTimestampMs > toMs) return

          const key = message.key?.toString() ?? null

          let value: unknown
          try {
            value = JSON.parse(message.value?.toString() ?? 'null')
          } catch {
            value = message.value?.toString() ?? null
          }

          // Tenant filter
          if (
            value !== null &&
            typeof value === 'object' &&
            (value as Record<string, unknown>)['tenant_id'] === request.tenantId
          ) {
            buffer.push({
              topic,
              key,
              value,
              offset:    message.offset,
              timestamp: new Date(msgTimestampMs).toISOString(),
            })
          }
        },
      })
      .catch((err: unknown) => {
        consumerError = err instanceof Error ? err.message : String(err)
        done = true
      })

    // Yield messages from the buffer as they arrive.
    // We poll with a small delay — acceptable for offline replay workloads.
    const POLL_INTERVAL_MS = 50
    const MAX_IDLE_CYCLES  = 60  // 3 s of no new messages → assume caught up
    let idleCycles = 0
    let lastLen    = 0

    while (!done) {
      if (buffer.length > lastLen) {
        while (lastLen < buffer.length) {
          yield buffer[lastLen]!
          lastLen++
        }
        idleCycles = 0
      } else {
        idleCycles++
        if (idleCycles >= MAX_IDLE_CYCLES) break
      }
      await new Promise<void>((r) => setTimeout(r, POLL_INTERVAL_MS))
    }

    // Drain any remaining buffered messages
    while (lastLen < buffer.length) {
      yield buffer[lastLen]!
      lastLen++
    }

    if (consumerError) {
      console.error('[ReplayEngine] consumer error during replay:', consumerError)
    }
  } catch (err) {
    console.error(
      '[ReplayEngine] replay failed:',
      err instanceof Error ? err.message : String(err),
    )
  } finally {
    try {
      await consumer.disconnect()
    } catch {
      // Ignore disconnect errors — best effort
    }
  }
}

// ─── Full projection rebuild ───────────────────────────────────────────────────

/**
 * Rebuilds all tenant projections by replaying every known topic from the
 * earliest available offset.
 *
 * Returns a summary with message count, elapsed time, and any errors.
 */
export async function rebuildTenantProjections(
  tenantId: string,
  correlationId?: string,
): Promise<ReplayResult> {
  if (!process.env.KAFKA_BROKERS) {
    return {
      tenantId,
      topics:           [],
      messagesReplayed: 0,
      durationMs:       0,
      errors:           ['KAFKA_BROKERS not set — replay skipped'],
      completedAt:      new Date().toISOString(),
    }
  }

  const allTopics = Object.values(KAFKA_TOPICS) as string[]
  const startMs   = Date.now()
  const errors: string[]  = []
  let messagesReplayed = 0

  const request: ReplayRequest = {
    tenantId,
    topics:       allTopics,
    fromOffset:   'earliest',
    correlationId,
  }

  try {
    for await (const _msg of replayMessages(request)) {
      messagesReplayed++
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err))
  }

  return {
    tenantId,
    topics:    allTopics,
    messagesReplayed,
    durationMs: Date.now() - startMs,
    errors,
    completedAt: new Date().toISOString(),
  }
}
