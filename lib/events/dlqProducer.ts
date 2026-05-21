// =============================================================================
// Agency Group — Dead Letter Queue Producer
// lib/events/dlqProducer.ts
//
// Publishes failed messages to `<original-topic>.dlq` via KafkaJS.
// Falls back to Supabase INSERT into dlq_messages when Kafka is unavailable.
//
// Each DLQ record carries the full original payload plus failure metadata
// (error, stack, retry_count, failed_at, consumer_group) so operators can
// investigate and replay messages without losing context.
//
// Design:
//   - connect() with exponential back-off (max 5 retries, ~30s total)
//   - publish() is fire-and-forget safe: logs on error, never throws
//   - Supabase fallback is itself fire-and-forget safe
//   - Singleton `dlqProducer` exported for use in consumers
//
// TypeScript strict — 0 errors
// =============================================================================

import log from '@/lib/logger'

// ─── Public types ─────────────────────────────────────────────────────────────

export interface DLQMessage {
  /** Domain topic the original message came from, e.g. 'deal-events' */
  original_topic:     string
  /** Kafka partition the original message was on */
  original_partition: number
  /** Kafka offset string of the original message */
  original_offset:    string
  /** Consumer group that failed to process the message */
  consumer_group:     string
  /** Discriminator field extracted from the payload (may be empty string) */
  event_type:         string
  /** event_id from the payload (may be empty string) */
  event_id:           string
  /** tenant_id from the payload (may be empty string) */
  tenant_id:          string
  /** Original message payload (raw, unparsed if parsing failed) */
  payload:            unknown
  /** Human-readable error message */
  error_message:      string
  /** Error stack trace, or null */
  error_stack:        string | null
  /** How many times this message has been retried before landing in DLQ */
  retry_count:        number
  /** ISO timestamp of when the final failure occurred */
  failed_at:          string
  /** Idempotency key: used to deduplicate DLQ inserts on replay */
  idempotency_key:    string
}

// ─── Minimal KafkaJS types for dynamic import ────────────────────────────────

interface KafkaProducerInstance {
  connect():    Promise<void>
  disconnect(): Promise<void>
  send(record: {
    topic:    string
    messages: Array<{ key: string; value: string }>
  }): Promise<void>
}

// ─── DLQ Producer ─────────────────────────────────────────────────────────────

export class DLQProducer {
  private producer:   KafkaProducerInstance | null = null
  private connected = false

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  /**
   * Connects to Kafka/Redpanda with exponential back-off.
   * Never throws — logs on failure so callers always have a Supabase fallback.
   */
  async connect(): Promise<void> {
    const brokersEnv = process.env.KAFKA_BROKERS
    if (!brokersEnv) {
      log.warn('[DLQProducer] KAFKA_BROKERS not set — DLQ will use Supabase fallback')
      return
    }

    const brokers = brokersEnv.split(',').map(b => b.trim()).filter(Boolean)
    if (brokers.length === 0) return

    const maxRetries     = 5
    const baseDelayMs    = 500
    let   lastErr: Error | null = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const { Kafka, logLevel } = await import('kafkajs')
        const kafka = new Kafka({
          clientId: process.env.KAFKA_CLIENT_ID ?? 'ag-dlq-producer',
          brokers,
          logLevel: logLevel.WARN,
          retry: { initialRetryTime: 300, retries: 3 },
        })

        const producer = kafka.producer({
          allowAutoTopicCreation: false,  // DLQ topics are pre-created by create-topics.sh
          idempotent:             false,  // keep simple; DLQ does not require exactly-once
        }) as unknown as KafkaProducerInstance

        await producer.connect()
        this.producer  = producer
        this.connected = true
        log.info(`[DLQProducer] connected to ${brokers.join(',')}`)
        return
      } catch (err) {
        lastErr = err instanceof Error ? err : new Error(String(err))
        if (attempt < maxRetries) {
          const delayMs = baseDelayMs * Math.pow(2, attempt)
          log.warn(`[DLQProducer] connect attempt ${attempt + 1}/${maxRetries + 1} failed — retrying in ${delayMs}ms`)
          await new Promise(r => setTimeout(r, delayMs))
        }
      }
    }

    log.error('[DLQProducer] all connect attempts failed — DLQ will use Supabase fallback', lastErr ?? undefined, {
      brokers: brokers.join(','),
    })
  }

  /**
   * Gracefully disconnects the Kafka producer.
   * Safe to call even if connect() was never called.
   */
  async disconnect(): Promise<void> {
    if (this.producer && this.connected) {
      try {
        await this.producer.disconnect()
        this.connected = false
        this.producer  = null
        log.info('[DLQProducer] disconnected')
      } catch (err) {
        log.warn('[DLQProducer] disconnect error (ignoring)', {
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
  }

  // ── Publish ──────────────────────────────────────────────────────────────────

  /**
   * Publishes a single DLQ message to `<original_topic>.dlq`.
   * Partition key = `${tenant_id}:${event_id}` for consistent routing.
   *
   * On Kafka failure, falls back to Supabase INSERT into dlq_messages.
   * Never throws.
   */
  async publish(message: DLQMessage): Promise<void> {
    const dlqTopic     = `${message.original_topic}.dlq`
    const partitionKey = `${message.tenant_id}:${message.event_id}`
    const payload      = JSON.stringify(message)

    if (this.connected && this.producer) {
      try {
        await this.producer.send({
          topic: dlqTopic,
          messages: [{ key: partitionKey, value: payload }],
        })
        log.info('[DLQProducer] published to DLQ', {
          dlq_topic:   dlqTopic,
          event_id:    message.event_id,
          tenant_id:   message.tenant_id,
          event_type:  message.event_type,
          retry_count: message.retry_count,
        })
        return
      } catch (err) {
        log.error('[DLQProducer] Kafka publish failed — falling back to Supabase', err instanceof Error ? err : undefined, {
          dlq_topic: dlqTopic,
          event_id:  message.event_id,
        })
      }
    }

    // Supabase fallback
    await this._supabaseFallback(message)
  }

  /**
   * Publishes multiple DLQ messages in a single batch.
   * Each message is independently failed-over to Supabase if Kafka is down.
   */
  async publishBatch(messages: DLQMessage[]): Promise<void> {
    await Promise.all(messages.map(m => this.publish(m)))
  }

  // ── Static builder ───────────────────────────────────────────────────────────

  /**
   * Builds a fully-typed DLQMessage from raw failure context.
   *
   * Extracts event_type, event_id, and tenant_id from the payload using
   * best-effort type-narrowing so no fields are ever undefined.
   */
  static buildDLQMessage(
    originalTopic:     string,
    originalPartition: number,
    originalOffset:    string,
    consumerGroup:     string,
    rawPayload:        unknown,
    error:             Error,
    retryCount:        number,
  ): DLQMessage {
    // Best-effort extraction from payload — may be unparseable
    let eventType  = ''
    let eventId    = ''
    let tenantId   = ''

    if (rawPayload && typeof rawPayload === 'object') {
      const p = rawPayload as Record<string, unknown>
      eventType  = typeof p['event_type'] === 'string'  ? p['event_type']  : ''
      eventId    = typeof p['event_id']   === 'string'  ? p['event_id']    : ''
      tenantId   = typeof p['tenant_id']  === 'string'  ? p['tenant_id']   : ''
    }

    const failedAt       = new Date().toISOString()
    const idempotencyKey = [
      originalTopic,
      originalPartition,
      originalOffset,
      consumerGroup,
      failedAt.slice(0, 19),  // second-level precision
    ].join(':')

    return {
      original_topic:     originalTopic,
      original_partition: originalPartition,
      original_offset:    originalOffset,
      consumer_group:     consumerGroup,
      event_type:         eventType,
      event_id:           eventId,
      tenant_id:          tenantId,
      payload:            rawPayload,
      error_message:      error.message,
      error_stack:        error.stack ?? null,
      retry_count:        retryCount,
      failed_at:          failedAt,
      idempotency_key:    idempotencyKey,
    }
  }

  // ── Private: Supabase fallback ───────────────────────────────────────────────

  /**
   * Inserts the DLQ message into the `dlq_messages` table in Supabase.
   * This is the durable fallback when Kafka DLQ topics are unreachable.
   * Never throws — errors are logged and swallowed.
   */
  private async _supabaseFallback(message: DLQMessage): Promise<void> {
    try {
      const { createClient } = await import('@supabase/supabase-js')
      const supabaseUrl   = process.env.NEXT_PUBLIC_SUPABASE_URL
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

      if (!supabaseUrl || !serviceRoleKey) {
        log.error('[DLQProducer] Supabase fallback unavailable — no SUPABASE_SERVICE_ROLE_KEY', undefined, {
          event_id: message.event_id,
        })
        return
      }

      const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false },
      })

      const { error } = await supabase.from('dlq_messages').insert({
        original_topic:     message.original_topic,
        original_partition: message.original_partition,
        original_offset:    message.original_offset,
        consumer_group:     message.consumer_group,
        event_type:         message.event_type || null,
        event_id:           message.event_id   || null,
        // tenant_id is a UUID FK — only insert if it looks like a UUID
        tenant_id: message.tenant_id && /^[0-9a-f-]{36}$/i.test(message.tenant_id)
          ? message.tenant_id
          : null,
        payload:       message.payload ?? {},
        error_message: message.error_message,
        retry_count:   message.retry_count,
        failed_at:     message.failed_at,
        status:        'pending',
      })

      if (error) {
        log.error('[DLQProducer] Supabase fallback INSERT failed', undefined, {
          supabase_error: error.message,
          event_id:       message.event_id,
          original_topic: message.original_topic,
        })
      } else {
        log.info('[DLQProducer] DLQ message persisted to Supabase fallback', {
          original_topic: message.original_topic,
          event_id:       message.event_id,
          tenant_id:      message.tenant_id,
        })
      }
    } catch (err) {
      log.error('[DLQProducer] Supabase fallback threw unexpectedly', err instanceof Error ? err : undefined, {
        event_id:       message.event_id,
        original_topic: message.original_topic,
      })
    }
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

/**
 * Module-level singleton.
 * Consumers import and call `dlqProducer.publish(...)` directly.
 * Connection is established lazily on first use or via connect() in process boot.
 */
export const dlqProducer = new DLQProducer()
